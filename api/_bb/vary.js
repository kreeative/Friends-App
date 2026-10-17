import { client, fail, gate, keyMap, logUsage, model, ownCourse, profileOf, start, structured } from './common.js'
import { ITEMS_SCHEMA, PROMPTS_VERSION, generatorSystem, variationBrief } from './prompts.js'
import { excerptText, itemRow, vet } from './pipeline.js'

/**
 * POST /api/bb/vary { item_id }
 *
 * Variations of a question in the Mistake log (section 6): another scenario,
 * the same skill, the same concept and level. The mistake then comes back as
 * something to reason through again, not a stem the student has learnt to
 * recognise.
 *
 * They go through the same code checks and the same verifier as every
 * generated question (pipeline.js), and are written with variant_of naming
 * the original. Answering one counts for the original's mistake
 * (src/lib/bb/answer.js), and a session asks an unseen variation before the
 * original (src/lib/bb/sampler.js).
 *
 * Two live variations per question at most: asking again answers with what
 * is there, with no model call. Asked about a variation, it works on the
 * original, so variations never breed variations.
 */
export const PER_ITEM = 2
const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n)

export default async function vary(req, res) {
  const ctx = await start(req, res)
  if (!ctx) return
  const { db, user, body } = ctx
  const one = async (id) => (await db.from('bb_items').select('*').eq('id', id ?? '').eq('user_id', user.id).maybeSingle()).data ?? null
  const asked = await one(body.item_id)
  const item = asked?.variant_of ? await one(asked.variant_of) : asked
  if (!item) return res.status(404).json({ error: 'not_found' })
  if (!['mcq', 'tf'].includes(item.type) || !item.concept_id) return res.status(422).json({ error: 'not_marked' })

  const { count: have } = await db.from('bb_items').select('id', { count: 'exact', head: true }).eq('variant_of', item.id).eq('user_id', user.id).in('quality', ['pass', 'revised'])
  if ((have ?? 0) >= PER_ITEM) return res.status(200).json({ added: 0, rejected: 0, have: have ?? 0 })
  const course = await ownCourse(db, user.id, item.course_id)
  if (!course) return res.status(404).json({ error: 'not_found' })
  if (!(await gate(ctx, res, 'vary'))) return

  const [{ data: concepts }, { data: mistake }, { data: twins }, { data: items }, { data: blueprint }] = await Promise.all([
    db.from('bb_concepts').select('id, name, definition, anchor_ids').eq('course_id', course.id).eq('user_id', user.id),
    db.from('bb_mistakes').select('misconception').eq('item_id', item.id).eq('user_id', user.id).maybeSingle(),
    db.from('bb_twins').select('*').eq('course_id', course.id).eq('user_id', user.id),
    db.from('bb_items').select('stem, concept_id').eq('course_id', course.id).eq('user_id', user.id),
    db.from('bb_blueprints').select('data').eq('course_id', course.id).eq('user_id', user.id).maybeSingle(),
  ])
  const byId = new Map((concepts ?? []).map((c) => [c.id, c]))
  const concept = byId.get(item.concept_id)
  if (!concept) return res.status(404).json({ error: 'not_found' })
  const pairs = (twins ?? []).filter((t) => t.a_concept === concept.id || t.b_concept === concept.id)
  const anchorIds = [...new Set([...(item.anchor_ids ?? []), ...(concept.anchor_ids ?? []), ...pairs.flatMap((t) => t.anchor_ids ?? [])])].slice(0, 30)
  const { data: anchorRows } = anchorIds.length ? await db.from('bb_anchors').select('id, label, excerpt').in('id', anchorIds).eq('user_id', user.id) : { data: [] }
  if (!anchorRows?.length) return res.status(422).json({ error: 'no_anchor' })
  const anchors = keyMap(anchorRows, 'A')

  const stems = (items ?? []).map((i) => i.stem)
  const twinLines = pairs.map((t) => `- ${byId.get(t.a_concept)?.name ?? '?'} vs ${byId.get(t.b_concept)?.name ?? '?'}: ${t.separator}`)
  const brief = [
    variationBrief({
      item,
      concept,
      trap: mistake?.misconception ?? null,
      excerpts: excerptText(anchorRows, anchors),
      existing: (items ?? []).filter((i) => i.concept_id === concept.id).map((i) => clip(i.stem, 160)).slice(-20),
    }),
    ...(twinLines.length ? ['', 'TWINS TO BUILD DISTRACTORS FROM:', ...twinLines] : []),
  ].join('\n')

  const profile = await profileOf(db, user.id)
  const cl = client()
  let gen
  try {
    const format = { ...(course.exam_format ?? {}), ...(blueprint?.data ?? {}) }
    gen = await structured(cl, { system: generatorSystem({ course, profile, language: course.language ?? profile.locale, format }), content: [{ type: 'text', text: brief }], schema: ITEMS_SCHEMA, effort: 'medium', maxTokens: 12000, model: model() })
  } catch (err) {
    return fail(res, err, 'vary')
  }
  if (gen.usage) await logUsage(db, user.id, 'vary', gen.model, gen.usage)
  if (gen.error) return res.status(502).json({ error: gen.error })

  let vetted
  try {
    vetted = await vet(cl, { raw: gen.data?.items, anchors, anchorRows, concepts: new Set(['K1']), existing: stems })
  } catch (err) {
    return fail(res, err, 'vary verify')
  }
  if (vetted.ver?.usage) await logUsage(db, user.id, 'vary', vetted.ver.model, vetted.ver.usage)

  const rows = vetted.kept
    .slice(0, PER_ITEM - (have ?? 0))
    .map((k) => itemRow(k, { userId: user.id, courseId: course.id, chapterId: item.chapter_id, conceptId: concept.id, anchors, variantOf: item.id }))
  if (rows.length) {
    const { error } = await db.from('bb_items').insert(rows)
    if (error) return res.status(500).json({ error: 'write' })
  }
  const stats = course.stats ?? {}
  await db
    .from('bb_courses')
    .update({
      stats: {
        ...stats,
        prompts: PROMPTS_VERSION,
        generated: (stats.generated ?? 0) + rows.length + vetted.rejected,
        rejected: (stats.rejected ?? 0) + vetted.rejected,
        varied: (stats.varied ?? 0) + rows.length,
      },
    })
    .eq('id', course.id)
  return res.status(200).json({ added: rows.length, rejected: vetted.rejected, have: (have ?? 0) + rows.length })
}
