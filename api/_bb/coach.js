import { client, gate, logUsage, model, ownCourse, profileOf, start } from './common.js'
import { COACH_MODES, coachSystem } from './prompts.js'
import { apiMessage } from '../syllabus.js'
import { shortId, shortMap } from '../../src/lib/bb/cite.js'

/**
 * POST /api/bb/coach { course_id, messages: [{ role, content }], mode }
 *
 * The coach of section 6, grounded in the student's own course. Streams the
 * answer as plain text as it is written; the app shows it growing.
 *
 * THE COURSE IS THE CACHED PREFIX. The instructions and the course outline
 * (chapters, concepts, the professor's definitions and every excerpt with a
 * short id) form one stable system prompt with a cache breakpoint at its
 * end, so the second message of a conversation reads it from the cache. The
 * mode and the conversation come after it and change freely.
 *
 * Citations: the model writes an excerpt's id in square brackets, [3f9c1d2a],
 * and the app turns each one into a chip ("Cours 7 · slide 6"). An id that
 * is not in the course is shown as plain text, never as a source.
 */
export { shortId }

export async function courseContext(db, userId, courseId, limit = 90000) {
  const [{ data: chapters }, { data: concepts }, { data: anchors }, { data: twins }, { data: signals }, { data: materials }] = await Promise.all([
    db.from('bb_chapters').select('id, title, position').eq('course_id', courseId).eq('user_id', userId).order('position'),
    db.from('bb_concepts').select('id, chapter_id, name, definition, definition_anchor, anchor_ids, weight').eq('course_id', courseId).eq('user_id', userId).order('position'),
    db.from('bb_anchors').select('id, material_id, label, excerpt').eq('course_id', courseId).eq('user_id', userId).order('created_at').order('id'),
    db.from('bb_twins').select('a_concept, b_concept, separator').eq('course_id', courseId).eq('user_id', userId),
    db.from('bb_signals').select('concept_id, quote, strength').eq('course_id', courseId).eq('user_id', userId),
    db.from('bb_materials').select('id, file_name').eq('course_id', courseId).eq('user_id', userId),
  ])
  const fileOf = new Map((materials ?? []).map((m) => [m.id, m.file_name]))
  const name = new Map((concepts ?? []).map((c) => [c.id, c.name]))
  const lines = ['COURSE OUTLINE']
  for (const ch of chapters ?? []) {
    lines.push(`\n## ${ch.title}`)
    for (const c of (concepts ?? []).filter((x) => x.chapter_id === ch.id)) {
      lines.push(`- ${c.name}${c.weight >= 3 ? ' (exam signal)' : ''}${c.definition ? `: "${c.definition}"${c.definition_anchor ? ` [${shortId(c.definition_anchor)}]` : ''}` : ''}`)
    }
  }
  if ((twins ?? []).length) {
    lines.push('\nEASILY CONFUSED')
    for (const t of twins) lines.push(`- ${name.get(t.a_concept)} vs ${name.get(t.b_concept)}: ${t.separator}`)
  }
  if ((signals ?? []).length) {
    lines.push('\nWHAT THE PROFESSOR FLAGGED FOR THE EXAM')
    for (const s of signals) lines.push(`- "${s.quote}"${s.concept_id && name.get(s.concept_id) ? ` (${name.get(s.concept_id)})` : ''}`)
  }
  lines.push('\nEXCERPTS (id, file, place, words)')
  /* One excerpt per short id: the first, as the app reads it (shortMap). */
  for (const [k, a] of shortMap(anchors)) lines.push(`[${k}] ${fileOf.get(a.material_id) ?? ''} · ${a.label}: "${a.excerpt}"`)
  const text = lines.join('\n')
  return text.length > limit ? `${text.slice(0, limit)}\n[outline truncated]` : text
}

export default async function coach(req, res) {
  const ctx = await start(req, res)
  if (!ctx) return
  const { db, user, body } = ctx
  const course = await ownCourse(db, user.id, body.course_id)
  if (!course) return res.status(404).json({ error: 'not_found' })
  const allowed = await gate(ctx, res, 'coach')
  if (!allowed) return

  const history = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 6000) }))
  /* The conversation has to start with the student and end with her. */
  while (history.length && history[0].role !== 'user') history.shift()
  if (!history.length || history.at(-1).role !== 'user') return res.status(400).json({ error: 'no_question' })

  const profile = await profileOf(db, user.id)
  const outline = await courseContext(db, user.id, course.id)
  const examDate = course.exam_at ? new Date(course.exam_at).toISOString().slice(0, 10) : null
  const system = [
    { type: 'text', text: coachSystem({ profile, course, language: course.language ?? profile.locale, examDate }) },
    { type: 'text', text: outline, cache_control: { type: 'ephemeral' } },
    ...(COACH_MODES[body.mode] ? [{ type: 'text', text: COACH_MODES[body.mode] }] : []),
  ]

  const question = history.at(-1).content
  await db.from('bb_coach_messages').insert({ user_id: user.id, course_id: course.id, role: 'user', content: question, mode: COACH_MODES[body.mode] ? body.mode : null })

  res.statusCode = 200
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Accel-Buffering', 'no')

  let answer = ''
  try {
    const stream = client().messages.stream({ model: model(), max_tokens: 6000, system, messages: history, output_config: { effort: 'medium' } })
    stream.on('text', (t) => {
      answer += t
      res.write(t)
    })
    const msg = await stream.finalMessage()
    await logUsage(db, user.id, 'coach', msg.model ?? model(), msg.usage)
    if (msg.stop_reason === 'refusal' && !answer) {
      const calm = profile.locale === 'en' ? "I can't help with that one. Ask me about your course and I'm all yours." : 'Je ne peux pas t’aider sur celle-là. Pose-moi une question sur ton cours et je suis là.'
      answer = calm
      res.write(calm)
    }
  } catch (err) {
    console.error(`bb coach: ${err?.status ?? '-'} ${err?.name ?? 'Error'}: ${apiMessage(err)}`)
    res.write(`\n\n[[error:${err?.status === 429 ? 'busy' : 'model_failed'}]]`)
  }
  if (answer) await db.from('bb_coach_messages').insert({ user_id: user.id, course_id: course.id, role: 'assistant', content: answer.slice(0, 20000) })
  res.end()
}
