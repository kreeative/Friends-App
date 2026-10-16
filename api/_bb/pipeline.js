import { heavyModel, structured } from './common.js'
import { VERIFIER_SYSTEM, VERIFY_SCHEMA } from './prompts.js'
import { checkItem } from '../../src/lib/bb/quality.js'

/**
 * Steps 2 to 4 of the question pipeline (section 5), shared by every route
 * that writes questions (generate, vary):
 *
 *   2. CODE      schema, anchors that exist, distinct options, key in range,
 *                no outside knowledge as a key, no near-duplicate stem;
 *   3. VERIFY    a separate call solves each item before reading the key,
 *                on the excerpts only: pass, fix or reject. "Pass" also needs
 *                the verifier's own answer to be the key;
 *   4. REVISE    a fixed item goes through the code checks again and is kept
 *                as "revised"; anything else is rejected.
 *
 * One function so the two routes cannot drift apart on what "verified" means.
 * The verifier call can throw (the API refused it): the caller answers with
 * fail(), like any model failure.
 */
const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n)

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

export const excerptText = (rows, anchors) => (rows ?? []).map((a) => `[${anchors.toKey.get(a.id)}] (${a.label}) "${a.excerpt}"`).join('\n')

/**
 * raw         the model's items, as returned
 * anchors     keyMap of the excerpts (A1, A2...)
 * anchorRows  the excerpts themselves, for the verifier
 * concepts    the concept keys an item may name
 * existing    stems already in the bank
 * Returns { kept: [{ item, quality, note }], rejected, ver }: ver is the
 * verifier's answer (for its usage), or null when nothing reached it.
 */
export async function vet(cl, { raw, anchors, anchorRows, concepts, existing = [], system = VERIFIER_SYSTEM, model = heavyModel() }) {
  const anchorKeys = new Set(anchors.toId.keys())
  const candidates = []
  let rejected = 0
  for (const it of Array.isArray(raw) ? raw : []) {
    const shaped = shape(it)
    const verdict = checkItem(shaped, { anchors: anchorKeys, existing: [...existing, ...candidates.map((c) => c.stem)] })
    if (!verdict.ok || !concepts.has(shaped.concept)) {
      rejected += 1
      continue
    }
    candidates.push(shaped)
  }
  if (!candidates.length) return { kept: [], rejected, ver: null }

  const ver = await structured(cl, {
    system,
    content: [{ type: 'text', text: `EXCERPTS:\n${excerptText(anchorRows, anchors)}\n\nITEMS:\n${JSON.stringify(candidates.map((c, index) => ({ index, ...c })), null, 1)}` }],
    schema: VERIFY_SCHEMA,
    effort: 'medium',
    maxTokens: 16000,
    model,
  })
  const verdicts = new Map((Array.isArray(ver.data?.verdicts) ? ver.data.verdicts : []).map((v) => [v.index, v]))
  const kept = []
  candidates.forEach((item, index) => {
    const v = verdicts.get(index)
    if (!v) return void (rejected += 1)
    if (v.verdict === 'pass' && Number(v.solved) === item.key) return void kept.push({ item, quality: 'pass', note: null })
    if (v.verdict === 'fix' && v.fixed) {
      const fixed = shape(v.fixed)
      const again = checkItem(fixed, { anchors: anchorKeys, existing })
      if (again.ok && concepts.has(fixed.concept)) return void kept.push({ item: fixed, quality: 'revised', note: clip(v.reasons, 300) })
    }
    rejected += 1
  })
  return { kept, rejected, ver }
}

/** A kept item as its bb_items row. */
export function itemRow({ item, quality, note }, { userId, courseId, chapterId, conceptId, anchors, variantOf = null }) {
  return {
    user_id: userId,
    course_id: courseId,
    chapter_id: chapterId,
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
    ...(variantOf ? { variant_of: variantOf } : {}),
  }
}
