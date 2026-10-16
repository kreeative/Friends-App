import { randomUUID } from 'node:crypto'
import { blockFor } from './files.js'
import { client, fail, gate, heavyModel, logUsage, ownCourse, profileOf, start, structured } from './common.js'
import { PROMPTS_VERSION, SOURCE_MAP_SCHEMA, sourceMapSystem } from './prompts.js'

/**
 * POST /api/bb/ingest { material_id }
 *
 * Reads one file of a course and writes its source map (section 2): the
 * chapters it covers, verbatim excerpts with their place ("slide 6"), the
 * concepts with the professor's own definitions, the easily confused pairs,
 * what the professor said would be on the exam, and anything it says about
 * the exam's format.
 *
 * GROUNDING IS CHECKED HERE, NOT TRUSTED. A concept whose anchors were not
 * among the excerpts is dropped; a definition whose anchor is not one of the
 * concept's own loses its anchor; a twin or a signal pointing at nothing is
 * dropped. The model is asked to follow these rules, and code makes sure it
 * did (section 2.3, rule 1).
 *
 * Free flashcards come out of it: every concept with a quoted definition is
 * a card (name -> the professor's words), with no further AI call.
 */
const KINDS = new Set(['definition', 'process', 'list', 'formula', 'comparison', 'example', 'other'])
const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n)
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(n) || lo)))

export default async function ingest(req, res) {
  const ctx = await start(req, res)
  if (!ctx) return
  const { db, user, body } = ctx

  const { data: material } = await db.from('bb_materials').select('*').eq('id', body.material_id ?? '').eq('user_id', user.id).maybeSingle()
  if (!material) return res.status(404).json({ error: 'not_found' })
  const course = await ownCourse(db, user.id, material.course_id)
  if (!course) return res.status(404).json({ error: 'not_found' })
  const allowed = await gate(ctx, res, 'ingest')
  if (!allowed) return

  const setStatus = (status, extra = {}) => db.from('bb_materials').update({ status, ...extra }).eq('id', material.id)
  /* A read that never came back (the function ran out of its five minutes,
     or the tab closed) leaves the file in "reading". It is tried once more;
     a second abandoned read means the file is too long for one read, and it
     fails with that reason instead of being retried, and paid for, forever. */
  if (material.status === 'reading') {
    if (material.error === 'retry') {
      await setStatus('failed', { error: 'too_long' })
      return res.status(422).json({ error: 'too_long' })
    }
    await setStatus('reading', { error: 'retry', reading_at: new Date().toISOString() })
  } else {
    await setStatus('reading', { error: null, reading_at: new Date().toISOString() })
  }

  /* The bytes: from the private bucket, under the caller's own folder only. */
  let bytes = null
  if (material.storage_path) {
    if (!material.storage_path.startsWith(`${user.id}/`)) return res.status(403).json({ error: 'forbidden' })
    const { data: blob, error } = await db.storage.from('bb-materials').download(material.storage_path)
    if (error || !blob) {
      await setStatus('failed', { error: 'download' })
      return res.status(502).json({ error: 'download' })
    }
    bytes = new Uint8Array(await blob.arrayBuffer())
  }
  const prepared = blockFor({ name: material.file_name, mime: material.mime, bytes, pasted: material.pasted_text })
  if (prepared.problem) {
    await setStatus('failed', { error: prepared.problem })
    return res.status(422).json({ error: prepared.problem })
  }

  const profile = await profileOf(db, user.id)
  const { data: chapters } = await db.from('bb_chapters').select('id, title, position').eq('course_id', course.id).eq('user_id', user.id).order('position')
  const existing = chapters ?? []

  /* The document carries the cache breakpoint: a second read of the same
     file within five minutes (a retry) costs a tenth. */
  const content = [
    { ...prepared.block, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: `Build the source map of this ${material.kind === 'exam' ? 'practice exam' : material.kind} (${material.file_name}).` },
  ]

  let out
  try {
    out = await structured(client(), {
      system: sourceMapSystem({ course, profile, existingChapters: existing }),
      content,
      schema: SOURCE_MAP_SCHEMA,
      effort: 'medium',
      maxTokens: 24000,
      model: heavyModel(),
    })
  } catch (err) {
    await setStatus('failed', { error: 'model' })
    return fail(res, err, 'ingest')
  }
  if (out.usage) await logUsage(db, user.id, 'ingest', out.model, out.usage)
  if (out.error) {
    await setStatus('failed', { error: out.error })
    return res.status(out.error === 'refused' ? 422 : 502).json({ error: out.error, detail: out.detail ?? null })
  }

  const map = out.data ?? {}
  const result = await writeMap(db, { user, course, material, map, existing, pages: prepared.pages })
  await setStatus('ready', { processed_at: new Date().toISOString(), pages: prepared.pages ?? null, error: null })
  return res.status(200).json(result)
}

/** Validate and write. Exported for the test with a fake database. */
export async function writeMap(db, { user, course, material, map, existing, pages }) {
  const base = { user_id: user.id, course_id: course.id }

  // Chapters: reuse an existing one when the model says so and it exists.
  const known = new Set(existing.map((c) => c.id))
  let position = existing.reduce((m, c) => Math.max(m, c.position ?? 0), -1)
  const chapterId = new Map()
  const newChapters = []
  for (const ch of Array.isArray(map.chapters) ? map.chapters : []) {
    const key = clip(ch?.key, 20)
    if (!key) continue
    if (ch.existing_id && known.has(ch.existing_id)) {
      chapterId.set(key, ch.existing_id)
      continue
    }
    const title = clip(ch.title, 200)
    if (!title) continue
    const id = randomUUID()
    position += 1
    chapterId.set(key, id)
    newChapters.push({ ...base, id, material_id: material.id, position, title, summary: clip(ch.summary, 600) || null })
  }
  if (!chapterId.size) {
    const id = randomUUID()
    position += 1
    chapterId.set('_', id)
    newChapters.push({ ...base, id, material_id: material.id, position, title: clip(material.file_name.replace(/\.[a-z0-9]+$/i, ''), 200) || 'Chapitre', summary: null })
  }
  const firstChapter = chapterId.values().next().value

  // Anchors: verbatim excerpts with their place.
  const anchorId = new Map()
  const anchors = []
  for (const a of Array.isArray(map.anchors) ? map.anchors : []) {
    const key = clip(a?.key, 20)
    const label = clip(a?.label, 80)
    const excerpt = clip(a?.excerpt, 2000)
    if (!key || !label || !excerpt || anchorId.has(key)) continue
    const id = randomUUID()
    anchorId.set(key, id)
    anchors.push({ ...base, id, material_id: material.id, label, excerpt })
  }

  // Concepts: grounded or dropped.
  const conceptId = new Map()
  const concepts = []
  let dropped = 0
  ;(Array.isArray(map.concepts) ? map.concepts : []).forEach((c, n) => {
    const key = clip(c?.key, 20)
    const name = clip(c?.name, 200)
    const cited = (Array.isArray(c?.anchors) ? c.anchors : []).map((k) => anchorId.get(k)).filter(Boolean)
    if (!key || !name || conceptId.has(key) || !cited.length) {
      dropped += 1
      return
    }
    const defAnchor = c.definition_anchor && anchorId.get(c.definition_anchor)
    const definition = clip(c.definition, 1200)
    const id = randomUUID()
    conceptId.set(key, id)
    concepts.push({
      ...base,
      id,
      chapter_id: chapterId.get(clip(c.chapter_key, 20)) ?? firstChapter,
      name,
      definition: definition || null,
      definition_anchor: definition && defAnchor ? defAnchor : null,
      kind: KINDS.has(c.kind) ? c.kind : 'other',
      anchor_ids: [...new Set(defAnchor ? [defAnchor, ...cited] : cited)],
      weight: clamp(c.importance, 1, 3),
      position: n,
    })
  })

  const twins = []
  for (const t of Array.isArray(map.twins) ? map.twins : []) {
    const a = conceptId.get(t?.a)
    const b = conceptId.get(t?.b)
    const separator = clip(t?.separator, 400)
    if (!a || !b || a === b || !separator) continue
    twins.push({ ...base, a_concept: a, b_concept: b, separator, anchor_ids: (t.anchors ?? []).map((k) => anchorId.get(k)).filter(Boolean) })
  }

  const signals = []
  for (const s of Array.isArray(map.signals) ? map.signals : []) {
    const anchor = anchorId.get(s?.anchor)
    const quote = clip(s?.quote, 600)
    if (!anchor || !quote) continue
    const concept = s.concept_key ? conceptId.get(s.concept_key) ?? null : null
    const strength = clamp(s.strength, 1, 3)
    signals.push({ ...base, concept_id: concept, quote, anchor_id: anchor, strength })
    /* A concept the professor flagged weighs at least what she said. */
    const target = concepts.find((c) => c.id === concept)
    if (target) target.weight = Math.max(target.weight, strength)
  }

  // Free flashcards: the concept and the professor's own words.
  const cards = concepts
    .filter((c) => c.definition && c.definition_anchor)
    .map((c) => ({
      ...base,
      chapter_id: c.chapter_id,
      concept_id: c.id,
      type: 'flash',
      bloom: 1,
      stem: c.name,
      answer: { text: c.definition },
      anchor_ids: [c.definition_anchor],
      quality: 'pass',
      source: 'concept',
    }))

  const write = async (table, rows) => {
    if (!rows.length) return
    const { error } = await db.from(table).insert(rows)
    if (error) throw Object.assign(new Error(`${table}: ${error.message}`), { status: 500 })
  }
  await write('bb_chapters', newChapters)
  await write('bb_anchors', anchors)
  await write('bb_concepts', concepts)
  await write('bb_twins', twins)
  await write('bb_signals', signals)
  await write('bb_items', cards)

  // What the material says about the exam, merged, never confirmed by itself.
  const exam = map.exam ?? {}
  const types = (Array.isArray(exam.question_types) ? exam.question_types : []).map((t) => clip(t, 20).toLowerCase()).filter(Boolean)
  if (types.length || exam.count || exam.minutes || exam.has_case != null) {
    const { data: bp } = await db.from('bb_blueprints').select('data').eq('course_id', course.id).maybeSingle()
    const prev = bp?.data ?? {}
    const data = {
      ...prev,
      types: [...new Set([...(prev.types ?? []), ...types])],
      count: exam.count ?? prev.count ?? null,
      minutes: exam.minutes ?? prev.minutes ?? null,
      has_case: exam.has_case ?? prev.has_case ?? null,
      evidence: [...(prev.evidence ?? []), ...(exam.evidence && anchorId.get(exam.evidence) ? [anchorId.get(exam.evidence)] : [])],
    }
    await db.from('bb_blueprints').upsert({ course_id: course.id, user_id: user.id, data, updated_at: new Date().toISOString() })
  }

  const lang = map.language === 'en' || map.language === 'fr' ? map.language : null
  const stats = { ...(course.stats ?? {}), prompts: PROMPTS_VERSION, concepts_dropped: (course.stats?.concepts_dropped ?? 0) + dropped }
  await db.from('bb_courses').update({ stats, ...(course.language ? {} : lang ? { language: lang } : {}) }).eq('id', course.id)

  return { chapters: newChapters.length, reused: chapterId.size - newChapters.length, anchors: anchors.length, concepts: concepts.length, dropped, twins: twins.length, signals: signals.length, cards: cards.length, pages: pages ?? null }
}
