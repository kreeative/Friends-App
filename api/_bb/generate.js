import { client, fail, gate, heavyModel, keyMap, logUsage, model, ownCourse, profileOf, start, structured } from './common.js'
import { ITEMS_SCHEMA, PROMPTS_VERSION, VERIFIER_SYSTEM, VERIFY_SCHEMA, generatorSystem } from './prompts.js'
import { checkItem } from '../../src/lib/bb/quality.js'
import { canPrepareChapter } from '../../src/lib/bb/plans.js'

/**
 * POST /api/bb/generate { course_id, chapter_id }
 *
 * Prepares exam-level questions for one chapter, a few concepts at a time,
 * through the pipeline of section 5:
 *
 *   1. GENERATE  structured items with their anchors, Bloom level, twin;
 *   2. CODE      schema, anchors that exist, distinct options, key in range,
 *                no outside knowledge as a key, no near-duplicate stem;
 *   3. VERIFY    a separate call solves each item before reading the key,
 *                confirms it, checks the distractors and the anchors:
 *                pass, fix or reject; "pass" also needs the verifier's own
 *                answer to be the key ("never pass an item you had to guess");
 *   4. REVISE    a fixed item goes through the code checks again and is kept
 *                as "revised" with what changed; anything else is rejected.
 *
 * Called repeatedly by the app until it answers { done: true }: each call
 * stays well inside the function's five minutes. The rejection rate is
 * counted on the course (stats.generated / stats.rejected), because above
 * 20% the generator prompt needs work.
 */
const PER_CALL = 3
const PER_CONCEPT = 2
const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n)

export default async function generate(req, res) {
  const ctx = await start(req, res)
  if (!ctx) return
  const { db, user, body } = ctx
  const course = await ownCourse(db, user.id, body.course_id)
  if (!course) return res.status(404).json({ error: 'not_found' })
  const { data: chapter } = await db.from('bb_chapters').select('*').eq('id', body.chapter_id ?? '').eq('course_id', course.id).eq('user_id', user.id).maybeSingle()
  if (!chapter) return res.status(404).json({ error: 'not_found' })

  const allowed = await gate(ctx, res, 'generate')
  if (!allowed) return
  const { count: prepared } = await db.from('bb_chapters').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('items_ready', true)
  const { count: started } = await db.from('bb_items').select('id', { count: 'exact', head: true }).eq('chapter_id', chapter.id).eq('source', 'ai')
  if (!canPrepareChapter(allowed.sub, prepared ?? 0, chapter.items_ready || (started ?? 0) > 0)) {
    return res.status(402).json({ error: 'plan_chapters', tier: allowed.tier })
  }

  const [{ data: concepts }, { data: items }, { data: twins }, { data: signals }, { data: blueprint }] = await Promise.all([
    db.from('bb_concepts').select('*').eq('chapter_id', chapter.id).eq('user_id', user.id).order('position'),
    db.from('bb_items').select('id, concept_id, stem, quality, source').eq('course_id', course.id).eq('user_id', user.id),
    db.from('bb_twins').select('*').eq('course_id', course.id).eq('user_id', user.id),
    db.from('bb_signals').select('*').eq('course_id', course.id).eq('user_id', user.id),
    db.from('bb_blueprints').select('data').eq('course_id', course.id).eq('user_id', user.id).maybeSingle(),
  ])
  const live = (items ?? []).filter((i) => i.source === 'ai' && (i.quality === 'pass' || i.quality === 'revised'))
  const count = new Map()
  for (const i of live) count.set(i.concept_id, (count.get(i.concept_id) ?? 0) + 1)
  const tried = new Set(chapter.items_ready ? [] : (course.stats?.tried?.[chapter.id] ?? []))
  const pending = (concepts ?? [])
    .filter((c) => (count.get(c.id) ?? 0) < PER_CONCEPT && !tried.has(c.id))
    .sort((a, b) => b.weight - a.weight || a.position - b.position)
  if (!pending.length) {
    await db.from('bb_chapters').update({ items_ready: true }).eq('id', chapter.id)
    return res.status(200).json({ done: true, added: 0, rejected: 0, remaining: 0 })
  }
  const batch = pending.slice(0, PER_CALL)

  // The excerpts these concepts and their twins rest on, with short keys.
  const twinRows = (twins ?? []).filter((t) => batch.some((c) => c.id === t.a_concept || c.id === t.b_concept))
  const anchorIds = [...new Set([...batch.flatMap((c) => c.anchor_ids ?? []), ...twinRows.flatMap((t) => t.anchor_ids ?? [])])]
  const { data: anchorRows } = anchorIds.length ? await db.from('bb_anchors').select('id, label, excerpt').in('id', anchorIds).eq('user_id', user.id) : { data: [] }
  const anchors = keyMap(anchorRows ?? [], 'A')
  const conceptKeys = keyMap(batch, 'K')
  const allConcepts = new Map((concepts ?? []).map((c) => [c.id, c]))
  const profile = await profileOf(db, user.id)
  const language = course.language ?? profile.locale

  const brief = [
    'CONCEPTS (write 2 items for each):',
    ...batch.map((c) => `${conceptKeys.toKey.get(c.id)}: ${c.name}${c.definition ? ` - definition: "${c.definition}"` : ''} (anchors ${(c.anchor_ids ?? []).map((a) => anchors.toKey.get(a)).filter(Boolean).join(', ')})`),
    '',
    'EXCERPTS:',
    ...(anchorRows ?? []).map((a) => `[${anchors.toKey.get(a.id)}] (${a.label}) "${a.excerpt}"`),
    '',
    'TWINS AND MISCONCEPTIONS TO BUILD DISTRACTORS FROM:',
    ...(twinRows.length ? twinRows.map((t) => `- ${allConcepts.get(t.a_concept)?.name ?? '?'} vs ${allConcepts.get(t.b_concept)?.name ?? '?'}: ${t.separator}`) : ['- none listed; use plausible misreadings of the excerpts']),
    '',
    'EXAM SIGNALS:',
    ...((signals ?? []).filter((s) => batch.some((c) => c.id === s.concept_id)).map((s) => `- "${s.quote}" (strength ${s.strength})`)),
    '',
    'EXISTING STEMS (do not reuse or paraphrase):',
    ...live.slice(-30).map((i) => `- ${clip(i.stem, 160)}`),
  ].join('\n')

  const cl = client()
  let gen
  try {
    const format = { ...(course.exam_format ?? {}), ...(blueprint?.data ?? {}) }
    gen = await structured(cl, { system: generatorSystem({ course, profile, language, format }), content: [{ type: 'text', text: brief }], schema: ITEMS_SCHEMA, effort: 'medium', maxTokens: 16000, model: model() })
  } catch (err) {
    return fail(res, err, 'generate')
  }
  if (gen.usage) await logUsage(db, user.id, 'generate', gen.model, gen.usage)
  if (gen.error) return res.status(502).json({ error: gen.error, detail: gen.detail ?? null })

  // Code checks first: an item that fails here costs no verification.
  const anchorKeys = new Set(anchors.toId.keys())
  const existingStems = live.map((i) => i.stem)
  const candidates = []
  let rejected = 0
  for (const it of Array.isArray(gen.data?.items) ? gen.data.items : []) {
    const shaped = shape(it)
    const verdict = checkItem(shaped, { anchors: anchorKeys, existing: [...existingStems, ...candidates.map((c) => c.stem)] })
    if (!verdict.ok || !conceptKeys.toId.has(it.concept)) {
      rejected += 1
      continue
    }
    candidates.push(shaped)
  }

  // Verification, on the excerpts only.
  const kept = []
  if (candidates.length) {
    let ver
    try {
      ver = await structured(cl, {
        system: VERIFIER_SYSTEM,
        content: [{ type: 'text', text: `EXCERPTS:\n${(anchorRows ?? []).map((a) => `[${anchors.toKey.get(a.id)}] (${a.label}) "${a.excerpt}"`).join('\n')}\n\nITEMS:\n${JSON.stringify(candidates.map((c, index) => ({ index, ...c })), null, 1)}` }],
        schema: VERIFY_SCHEMA,
        effort: 'medium',
        maxTokens: 16000,
        model: heavyModel(),
      })
    } catch (err) {
      return fail(res, err, 'verify')
    }
    if (ver.usage) await logUsage(db, user.id, 'generate', ver.model, ver.usage)
    const verdicts = new Map((Array.isArray(ver.data?.verdicts) ? ver.data.verdicts : []).map((v) => [v.index, v]))
    candidates.forEach((item, index) => {
      const v = verdicts.get(index)
      if (!v) return void (rejected += 1)
      if (v.verdict === 'pass' && Number(v.solved) === item.key) return void kept.push({ item, quality: 'pass', note: null })
      if (v.verdict === 'fix' && v.fixed) {
        const fixed = shape(v.fixed)
        const again = checkItem(fixed, { anchors: anchorKeys, existing: existingStems })
        if (again.ok && conceptKeys.toId.has(fixed.concept)) return void kept.push({ item: fixed, quality: 'revised', note: clip(v.reasons, 300) })
      }
      rejected += 1
    })
  }

  const rows = kept.map(({ item, quality, note }) => {
    const conceptId = conceptKeys.toId.get(item.concept)
    return {
      user_id: user.id,
      course_id: course.id,
      chapter_id: chapter.id,
      concept_id: conceptId,
      type: item.type,
      bloom: item.bloom,
      stem: item.stem,
      options: item.options.map((o) => ({ text: o.text, why: o.why, anchor: o.anchor ? anchors.toId.get(o.anchor) ?? null : null, outside: Boolean(o.outside) })),
      answer: { index: item.key },
      explanation: item.explanation || null,
      anchor_ids: item.anchors.map((k) => anchors.toId.get(k)).filter(Boolean),
      outside: false,
      quality,
      revision_note: note,
      source: 'ai',
    }
  })
  if (rows.length) {
    const { error } = await db.from('bb_items').insert(rows)
    if (error) return res.status(500).json({ error: 'write', detail: error.message })
  }

  /* A concept the model could not write a fair item for is not asked again
     on this chapter: it stays a flashcard. */
  const covered = new Set(rows.map((r) => r.concept_id))
  const nowTried = [...tried, ...batch.filter((c) => !covered.has(c.id)).map((c) => c.id)]
  const stats = course.stats ?? {}
  const nextStats = {
    ...stats,
    prompts: PROMPTS_VERSION,
    generated: (stats.generated ?? 0) + rows.length + rejected,
    rejected: (stats.rejected ?? 0) + rejected,
    revised: (stats.revised ?? 0) + rows.filter((r) => r.quality === 'revised').length,
    tried: { ...(stats.tried ?? {}), [chapter.id]: nowTried },
  }
  await db.from('bb_courses').update({ stats: nextStats }).eq('id', course.id)

  const remaining = pending.length - batch.length
  if (remaining <= 0) await db.from('bb_chapters').update({ items_ready: true }).eq('id', chapter.id)
  return res.status(200).json({ done: remaining <= 0, added: rows.length, rejected, remaining, gaps: (gen.data?.gaps ?? []).slice(0, 3) })
}

/** An item as the code checks expect it, whatever the model returned. */
export function shape(it) {
  const type = it?.type === 'tf' ? 'tf' : 'mcq'
  return {
    concept: String(it?.concept ?? ''),
    type,
    bloom: Math.min(6, Math.max(1, Math.round(Number(it?.bloom) || 3))),
    stem: clip(it?.stem, 2000),
    options: (Array.isArray(it?.options) ? it.options : []).map((o) => ({ text: clip(o?.text, 400), why: clip(o?.why, 600), anchor: o?.anchor ?? null, outside: Boolean(o?.outside) })),
    key: Number.isInteger(it?.key) ? it.key : Number(it?.key),
    explanation: clip(it?.explanation, 800),
    anchors: (Array.isArray(it?.anchors) ? it.anchors : []).map(String),
  }
}
