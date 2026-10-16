import { client, fail, gate, keyMap, logUsage, model, ownCourse, profileOf, start, structured } from './common.js'
import { CASE_SCHEMA, GRADER_SYSTEM, GRADE_SCHEMA, caseSystem } from './prompts.js'
import { excerptText } from './pipeline.js'
import { shortId } from '../../src/lib/bb/cite.js'
import { normalise } from '../../src/lib/bb/quality.js'

/**
 * The case lab (section 6, phase 2).
 *
 * POST /api/bb/case { course_id, chapter_ids? }
 *   A new case study on one to three chapters (the heaviest ones when none
 *   are named): a realistic situation, the questions, a rubric whose every
 *   line cites the course, and a model answer that cites it too. Names and
 *   figures in the scenario may be invented and the case says so; concepts
 *   may not.
 *
 * POST /api/bb/grade { case_id, answer }
 *   The student's written answer, marked against that rubric on the case
 *   text and the cited excerpts only: points per line with the quote that
 *   earned or missed them, then two or three improvements tied to a line
 *   and an excerpt. Stored, so progress is visible.
 *
 * What the model returns is checked in code before anything is stored
 * (caseFrom, gradeFrom): a rubric line that cites nothing that exists is
 * dropped, a case left with fewer than three lines is refused, points are
 * clamped to what the line is worth, and a "quote" that is not in the
 * student's answer is not shown as one.
 */
const clip = (s, n) => String(s ?? '').replace(/[ \t]+/g, ' ').trim().slice(0, n)
const int = (v, lo, hi, d) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d
}

/** [A3] in the model's text becomes the excerpt's short id, the app's chip. Unknown keys go. */
export function citeKeys(text, anchors) {
  return String(text ?? '').replace(/\[(A\d+)\]/g, (_, k) => (anchors.toId.has(k) ? `[${shortId(anchors.toId.get(k))}]` : ''))
}

/** The model's case, checked. Returns { ok, row } or { ok: false, problems }. */
export function caseFrom(data, anchors) {
  const problems = []
  const d = data ?? {}
  const known = (keys) => [...new Set((Array.isArray(keys) ? keys : []).map(String).filter((k) => anchors.toId.has(k)))]
  const title = clip(d.title, 200)
  const body = String(d.body ?? '').trim().slice(0, 20000)
  if (!title) problems.push('title')
  if (body.length < 200) problems.push('body')
  const questions = (Array.isArray(d.questions) ? d.questions : [])
    .map((q) => ({ prompt: clip(q?.prompt, 1200), points: int(q?.points, 1, 50, 10) }))
    .filter((q) => q.prompt)
    .slice(0, 3)
  if (!questions.length) problems.push('questions')
  const rubric = (Array.isArray(d.rubric) ? d.rubric : [])
    .map((r) => ({ criterion: clip(r?.criterion, 200), points: int(r?.points, 1, 20, 2), looks_for: clip(r?.looks_for, 600), keys: known(r?.anchors) }))
    .filter((r) => r.criterion && r.keys.length)
    .slice(0, 8)
  if (rubric.length < 3) problems.push('rubric')
  const exhibits = (Array.isArray(d.exhibits) ? d.exhibits : [])
    .map((x) => {
      const columns = (Array.isArray(x?.columns) ? x.columns : []).map((c) => clip(c, 60)).slice(0, 6)
      const rows = (Array.isArray(x?.rows) ? x.rows : [])
        .slice(0, 12)
        .map((r) => columns.map((_, i) => clip((Array.isArray(r) ? r : [])[i], 80)))
      return { title: clip(x?.title, 120), columns, rows }
    })
    .filter((x) => x.columns.length >= 2 && x.rows.length)
    .slice(0, 2)
  const modelAnswer = citeKeys(String(d.model_answer ?? '').trim().slice(0, 12000), anchors).trim()
  if (!modelAnswer) problems.push('model_answer')
  if (problems.length) return { ok: false, problems }
  const allKeys = [...new Set([...known(d.anchors), ...rubric.flatMap((r) => r.keys)])]
  return {
    ok: true,
    row: {
      title,
      body,
      exhibits,
      questions,
      rubric: rubric.map(({ keys, ...r }) => ({ ...r, anchor_ids: keys.map((k) => anchors.toId.get(k)) })),
      model_answer: modelAnswer,
      anchor_ids: allKeys.map((k) => anchors.toId.get(k)),
      outside_note: d.outside_note ? clip(d.outside_note, 400) : null,
    },
  }
}

/** The grader's marks, checked against the rubric and the student's own words. */
export function gradeFrom(data, { rubric, answer, anchors }) {
  const given = new Map()
  for (const c of Array.isArray(data?.criteria) ? data.criteria : []) {
    const i = Number(c?.index)
    if (!Number.isInteger(i) || i < 0 || i >= rubric.length || given.has(i)) continue
    const quote = clip(c?.quote, 300)
    given.set(i, {
      points: Math.round(Math.min(rubric[i].points, Math.max(0, Number(c?.points) || 0)) * 2) / 2,
      /* Shown as the student's words only if they are the student's words. */
      quote: quote && normalise(answer).includes(normalise(quote)) ? quote : '',
      why: clip(c?.why, 500),
    })
  }
  const criteria = rubric.map((r, i) => ({ index: i, criterion: r.criterion, out_of: r.points, ...(given.get(i) ?? { points: 0, quote: '', why: '' }) }))
  const improvements = (Array.isArray(data?.improvements) ? data.improvements : [])
    .map((m) => ({
      rubric_index: Number.isInteger(m?.rubric_index) && m.rubric_index >= 0 && m.rubric_index < rubric.length ? m.rubric_index : null,
      text: clip(m?.text, 500),
      anchor_id: m?.anchor && anchors.toId.has(String(m.anchor)) ? anchors.toId.get(String(m.anchor)) : null,
    }))
    .filter((m) => m.text)
    .slice(0, 3)
  const points = criteria.reduce((s, c) => s + c.points, 0)
  const outOf = rubric.reduce((s, r) => s + r.points, 0)
  return { criteria, improvements, summary: clip(data?.summary, 400), points, out_of: outOf }
}

export async function makeCase(req, res) {
  const ctx = await start(req, res)
  if (!ctx) return
  const { db, user, body } = ctx
  const course = await ownCourse(db, user.id, body.course_id)
  if (!course) return res.status(404).json({ error: 'not_found' })
  if (!(await gate(ctx, res, 'case'))) return

  const [{ data: chapters }, { data: concepts }, { data: twins }, { data: signals }, { data: blueprint }] = await Promise.all([
    db.from('bb_chapters').select('id, title, position').eq('course_id', course.id).eq('user_id', user.id).order('position'),
    db.from('bb_concepts').select('id, chapter_id, name, definition, anchor_ids, weight').eq('course_id', course.id).eq('user_id', user.id),
    db.from('bb_twins').select('*').eq('course_id', course.id).eq('user_id', user.id),
    db.from('bb_signals').select('concept_id, quote, strength').eq('course_id', course.id).eq('user_id', user.id),
    db.from('bb_blueprints').select('data').eq('course_id', course.id).eq('user_id', user.id).maybeSingle(),
  ])
  const weightOf = new Map()
  for (const c of concepts ?? []) weightOf.set(c.chapter_id, (weightOf.get(c.chapter_id) ?? 0) + (c.weight ?? 1))
  const asked = new Set(Array.isArray(body.chapter_ids) ? body.chapter_ids.map(String) : [])
  let picked = (chapters ?? []).filter((c) => asked.has(c.id)).slice(0, 3)
  if (!picked.length) picked = [...(chapters ?? [])].filter((c) => weightOf.get(c.id)).sort((a, b) => weightOf.get(b.id) - weightOf.get(a.id)).slice(0, 2)
  if (!picked.length) return res.status(422).json({ error: 'no_chapters' })
  const inScope = new Set(picked.map((c) => c.id))
  const scoped = (concepts ?? []).filter((c) => inScope.has(c.chapter_id)).sort((a, b) => (b.weight ?? 1) - (a.weight ?? 1)).slice(0, 14)
  const anchorIds = [...new Set(scoped.flatMap((c) => c.anchor_ids ?? []))].slice(0, 45)
  const { data: anchorRows } = anchorIds.length ? await db.from('bb_anchors').select('id, label, excerpt').in('id', anchorIds).eq('user_id', user.id) : { data: [] }
  if (!anchorRows?.length) return res.status(422).json({ error: 'no_anchor' })
  const anchors = keyMap(anchorRows, 'A')
  const ids = new Set(scoped.map((c) => c.id))
  const name = new Map(scoped.map((c) => [c.id, c.name]))

  const brief = [
    `CHAPTERS: ${picked.map((c) => c.title).join(' | ')}`,
    '',
    'CONCEPTS (the case must make the student use several of them, and link chapters when there are two):',
    ...scoped.map((c) => `- ${c.name}${c.definition ? `: "${c.definition}"` : ''} (anchors ${(c.anchor_ids ?? []).map((a) => anchors.toKey.get(a)).filter(Boolean).join(', ')})`),
    '',
    'EXCERPTS:',
    excerptText(anchorRows, anchors),
    '',
    'TWINS (good material for a trap in the case):',
    ...(twins ?? []).filter((t) => ids.has(t.a_concept) && ids.has(t.b_concept)).map((t) => `- ${name.get(t.a_concept)} vs ${name.get(t.b_concept)}: ${t.separator}`),
    '',
    'EXAM SIGNALS:',
    ...(signals ?? []).filter((s) => ids.has(s.concept_id)).map((s) => `- "${s.quote}" (strength ${s.strength})`),
  ].join('\n')

  const profile = await profileOf(db, user.id)
  let out
  try {
    const format = { ...(course.exam_format ?? {}), ...(blueprint?.data ?? {}) }
    out = await structured(client(), { system: caseSystem({ course, profile, language: course.language ?? profile.locale, format }), content: [{ type: 'text', text: brief }], schema: CASE_SCHEMA, effort: 'medium', maxTokens: 16000, model: model() })
  } catch (err) {
    return fail(res, err, 'case')
  }
  if (out.usage) await logUsage(db, user.id, 'case', out.model, out.usage)
  if (out.error) return res.status(502).json({ error: out.error })
  const checked = caseFrom(out.data, anchors)
  if (!checked.ok) return res.status(502).json({ error: 'model_failed', detail: checked.problems.join(',') })
  const { data: row, error } = await db
    .from('bb_cases')
    .insert({ user_id: user.id, course_id: course.id, chapter_ids: picked.map((c) => c.id), ...checked.row })
    .select('*')
    .single()
  if (error) return res.status(500).json({ error: 'write' })
  return res.status(200).json({ case: row })
}

/** The case as the grader reads it: text, exhibits, questions. */
export function caseText(c) {
  const exhibits = (c.exhibits ?? []).map((x) => [`EXHIBIT: ${x.title}`, x.columns.join(' | '), ...x.rows.map((r) => r.join(' | '))].join('\n'))
  return [`CASE: ${c.title}`, c.body, ...exhibits, '', 'QUESTIONS:', ...(c.questions ?? []).map((q, i) => `${i + 1}. ${q.prompt} (${q.points} points)`)].join('\n\n')
}

export async function grade(req, res) {
  const ctx = await start(req, res)
  if (!ctx) return
  const { db, user, body } = ctx
  const answer = String(body.answer ?? '').trim().slice(0, 20000)
  if (answer.length < 20) return res.status(400).json({ error: 'empty' })
  const { data: c } = await db.from('bb_cases').select('*').eq('id', body.case_id ?? '').eq('user_id', user.id).maybeSingle()
  if (!c) return res.status(404).json({ error: 'not_found' })
  if (!(await gate(ctx, res, 'grade'))) return

  const { data: anchorRows } = (c.anchor_ids ?? []).length ? await db.from('bb_anchors').select('id, label, excerpt').in('id', c.anchor_ids).eq('user_id', user.id) : { data: [] }
  const anchors = keyMap(anchorRows ?? [], 'A')
  const rubric = c.rubric ?? []
  const content = [
    caseText(c),
    '',
    'RUBRIC:',
    ...rubric.map((r, i) => `${i}. ${r.criterion} (${r.points} points): ${r.looks_for} [anchors ${(r.anchor_ids ?? []).map((a) => anchors.toKey.get(a)).filter(Boolean).join(', ')}]`),
    '',
    'EXCERPTS:',
    excerptText(anchorRows ?? [], anchors),
    '',
    "THE STUDENT'S ANSWER:",
    answer,
  ].join('\n')
  let out
  try {
    out = await structured(client(), { system: GRADER_SYSTEM, content: [{ type: 'text', text: content }], schema: GRADE_SCHEMA, effort: 'medium', maxTokens: 10000, model: model() })
  } catch (err) {
    return fail(res, err, 'grade')
  }
  if (out.usage) await logUsage(db, user.id, 'grade', out.model, out.usage)
  if (out.error) return res.status(502).json({ error: out.error })
  const marked = gradeFrom(out.data, { rubric, answer, anchors })
  const { data: row, error } = await db
    .from('bb_case_attempts')
    .insert({ user_id: user.id, case_id: c.id, course_id: c.course_id, answer, grade: marked, points: marked.points, out_of: marked.out_of })
    .select('*')
    .single()
  if (error) return res.status(500).json({ error: 'write' })
  return res.status(200).json({ attempt: row })
}
