import { ratingFrom, review } from './fsrs.js'

/**
 * What one answer writes (sections 3 and 6): the next FSRS state of the
 * item, the answer itself, and the mistake log.
 *
 * Pure, so the rules are tested without a database (bb.test.mjs):
 *
 *   RATING. A flashcard is rated by the student (1 to 4). A question the app
 *   marks itself is rated from the answer and the confidence picked before
 *   the reveal: wrong is Again, right but unsure or guessed is Hard, right
 *   and sure is Good (ratingFrom in fsrs.js).
 *
 *   A PRETEST DOES NOT COUNT. "This score doesn't count": the guess is
 *   recorded as an answer (it is still retrieval practice, and it gives the
 *   item its first schedule), but it never enters the mistake log, so a
 *   guess on a chapter never studied is not an error.
 *
 *   THE MISTAKE LOG. Every wrong or guessed answer goes in, with the trap
 *   behind the chosen option as its misconception. "Sure and wrong" is
 *   flagged and stays flagged until it is resolved. It is resolved by being
 *   right three times on three different days: a second right answer on the
 *   same day does not move the streak, and a wrong one resets it.
 */
export const RESOLVE_STREAK = 3

const localDay = (d) => {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

/**
 * item      { id, course_id, concept_id, type, bloom, options }
 * card      the bb_schedule row, or null for a first answer
 * choice    the option index picked (questions), or null
 * rating    1..4 (flashcards), or null to derive it
 * correct   for flashcards, derived from the rating when absent
 * mistake   the bb_mistakes row for this item, or null
 */
export function answerRows({ item, card = null, choice = null, rating = null, correct = null, confidence = null, mistake = null, now = new Date(), ms = null, mode = null, sessionId = null, dayOf = localDay }) {
  const marked = item.type !== 'flash' && item.type !== 'cloze'
  let right = correct
  if (marked && right == null) right = choice != null && Number(choice) === Number(item.answer?.index)
  const grade = rating ?? (marked ? ratingFrom(right, confidence) : 3)
  if (right == null) right = grade > 1

  const next = review(card, grade, now)
  const { interval, ...state } = next
  const schedule = { item_id: item.id, course_id: item.course_id, ...state }
  const answer = {
    item_id: item.id,
    course_id: item.course_id,
    concept_id: item.concept_id ?? null,
    session_id: sessionId,
    rating: grade,
    confidence: confidence ?? null,
    correct: right,
    bloom: item.bloom ?? null,
    ms: ms == null ? null : Math.max(0, Math.round(ms)),
    mode,
  }

  const today = dayOf(now)
  let log = null
  const pretest = mode === 'pretest'
  const sureWrong = !right && confidence === 'sure'
  if (!pretest && (!right || confidence === 'guess')) {
    const trap = choice != null ? item.options?.[choice]?.why ?? null : null
    log = {
      item_id: item.id,
      course_id: item.course_id,
      concept_id: item.concept_id ?? null,
      misconception: !right ? trap ?? mistake?.misconception ?? null : mistake?.misconception ?? null,
      confident: sureWrong || Boolean(mistake?.confident && !mistake?.resolved_at),
      right_streak: right && mistake && !mistake.resolved_at ? mistake.right_streak ?? 0 : 0,
      last_right_on: right ? mistake?.last_right_on ?? null : null,
      resolved_at: null,
    }
  } else if (right && mistake && !mistake.resolved_at) {
    const counts = mistake.last_right_on !== today
    const streak = (mistake.right_streak ?? 0) + (counts ? 1 : 0)
    log = {
      item_id: item.id,
      course_id: item.course_id,
      concept_id: mistake.concept_id ?? item.concept_id ?? null,
      misconception: mistake.misconception ?? null,
      confident: Boolean(mistake.confident),
      right_streak: streak,
      last_right_on: today,
      resolved_at: streak >= RESOLVE_STREAK ? new Date(now).toISOString() : null,
    }
  }

  return { schedule, answer, mistake: log, rating: grade, correct: right, interval, sureWrong: !pretest && sureWrong }
}
