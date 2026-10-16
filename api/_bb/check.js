import { client, fail, gate, heavyModel, keyMap, logUsage, model, start, structured } from './common.js'
import { ELABORATE_SCHEMA, ELABORATE_SYSTEM, VERIFIER_SYSTEM, VERIFY_SCHEMA } from './prompts.js'
import { checkItem } from '../../src/lib/bb/quality.js'
import { shape } from './generate.js'

/**
 * Two small routes on one item, both grounded in its own excerpts only, never
 * the whole course: cheaper and more precise (section 7, "grading cost").
 *
 * POST /api/bb/elaborate { item_id, text }
 *   After an answer, the student writes one line on WHY it is true
 *   (technique 4). Claude checks the line against the excerpts in one or two
 *   sentences.
 *
 * POST /api/bb/report { item_id, reason }
 *   "This question is wrong" (section 5.6). The item goes to quarantine, the
 *   verifier re-checks it with the student's reason, and the student sees the
 *   outcome: kept, corrected, or removed.
 */
async function loadItem(db, userId, id) {
  const { data: item } = await db.from('bb_items').select('*').eq('id', id ?? '').eq('user_id', userId).maybeSingle()
  if (!item) return null
  const { data: anchorRows } = (item.anchor_ids ?? []).length
    ? await db.from('bb_anchors').select('id, label, excerpt').in('id', item.anchor_ids).eq('user_id', userId)
    : { data: [] }
  return { item, anchorRows: anchorRows ?? [] }
}

const excerpts = (rows, keys) => rows.map((a) => `[${keys ? keys.toKey.get(a.id) : a.label}] (${a.label}) "${a.excerpt}"`).join('\n')

export async function elaborate(req, res) {
  const ctx = await start(req, res)
  if (!ctx) return
  const { db, user, body } = ctx
  const text = String(body.text ?? '').trim().slice(0, 1200)
  if (!text) return res.status(400).json({ error: 'empty' })
  const found = await loadItem(db, user.id, body.item_id)
  if (!found) return res.status(404).json({ error: 'not_found' })
  if (!(await gate(ctx, res, 'elaborate'))) return
  const { item, anchorRows } = found
  const keyed = item.answer?.index != null ? item.options?.[item.answer.index]?.text : item.answer?.text
  let out
  try {
    out = await structured(client(), {
      system: ELABORATE_SYSTEM,
      content: [{ type: 'text', text: `EXCERPTS:\n${excerpts(anchorRows)}\n\nQUESTION: ${item.stem}\nRIGHT ANSWER: ${keyed ?? ''}\n\nTHE STUDENT'S WHY: ${text}` }],
      schema: ELABORATE_SCHEMA,
      effort: 'low',
      /* Thinking counts against max_tokens on this model: room for it. */
      maxTokens: 4000,
      model: model(),
    })
  } catch (err) {
    return fail(res, err, 'elaborate')
  }
  if (out.usage) await logUsage(db, user.id, 'elaborate', out.model, out.usage)
  if (out.error) return res.status(502).json({ error: out.error })
  const verdict = ['right', 'partly', 'wrong'].includes(out.data?.verdict) ? out.data.verdict : 'partly'
  return res.status(200).json({ verdict, feedback: String(out.data?.feedback ?? '').slice(0, 600) })
}

export async function report(req, res) {
  const ctx = await start(req, res)
  if (!ctx) return
  const { db, user, body } = ctx
  const reason = String(body.reason ?? '').trim().slice(0, 600)
  const found = await loadItem(db, user.id, body.item_id)
  if (!found) return res.status(404).json({ error: 'not_found' })
  if (!(await gate(ctx, res, 'report'))) return
  const { item, anchorRows } = found
  if (item.source !== 'ai' || !['mcq', 'tf'].includes(item.type)) {
    /* A flashcard is the professor's own words: nothing to re-verify, it is
       set aside and the student is told so. */
    await db.from('bb_items').update({ quality: 'quarantine', revision_note: reason || null }).eq('id', item.id)
    return res.status(200).json({ outcome: 'removed', reasons: null })
  }
  await db.from('bb_items').update({ quality: 'quarantine' }).eq('id', item.id)

  const keys = keyMap(anchorRows, 'A')
  const asItem = {
    concept: 'K1',
    type: item.type,
    bloom: item.bloom,
    stem: item.stem,
    options: (item.options ?? []).map((o) => ({ text: o.text, why: o.why, anchor: o.anchor ? keys.toKey.get(o.anchor) ?? null : null, outside: Boolean(o.outside) })),
    key: item.answer?.index ?? 0,
    explanation: item.explanation ?? '',
    anchors: (item.anchor_ids ?? []).map((a) => keys.toKey.get(a)).filter(Boolean),
  }
  let out
  try {
    out = await structured(client(), {
      system: `${VERIFIER_SYSTEM}\nA student flagged this item as wrong. Her reason: "${reason || 'no reason given'}". Take it seriously and check it on the excerpts.`,
      content: [{ type: 'text', text: `EXCERPTS:\n${excerpts(anchorRows, keys)}\n\nITEMS:\n${JSON.stringify([{ index: 0, ...asItem }], null, 1)}` }],
      schema: VERIFY_SCHEMA,
      effort: 'medium',
      maxTokens: 8000,
      model: heavyModel(),
    })
  } catch (err) {
    return fail(res, err, 'report')
  }
  if (out.usage) await logUsage(db, user.id, 'report', out.model, out.usage)
  const v = (out.data?.verdicts ?? [])[0]
  if (out.error || !v) return res.status(200).json({ outcome: 'removed', reasons: null })

  if (v.verdict === 'pass' && Number(v.solved) === asItem.key) {
    await db.from('bb_items').update({ quality: item.quality === 'revised' ? 'revised' : 'pass' }).eq('id', item.id)
    return res.status(200).json({ outcome: 'kept', reasons: String(v.reasons ?? '').slice(0, 400) })
  }
  if (v.verdict === 'fix' && v.fixed) {
    const fixed = shape(v.fixed)
    const check = checkItem(fixed, { anchors: new Set(keys.toId.keys()) })
    if (check.ok) {
      await db.from('bb_items').update({
        stem: fixed.stem,
        options: fixed.options.map((o) => ({ text: o.text, why: o.why, anchor: o.anchor ? keys.toId.get(o.anchor) ?? null : null, outside: Boolean(o.outside) })),
        answer: { index: fixed.key },
        explanation: fixed.explanation || null,
        quality: 'revised',
        revision_note: String(v.reasons ?? '').slice(0, 400) || reason || null,
      }).eq('id', item.id)
      return res.status(200).json({ outcome: 'fixed', reasons: String(v.reasons ?? '').slice(0, 400) })
    }
  }
  return res.status(200).json({ outcome: 'removed', reasons: String(v.reasons ?? '').slice(0, 400) })
}
