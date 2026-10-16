/**
 * FSRS-5, the spaced-repetition scheduler, as a pure module.
 *
 * Beauty & Brain schedules every reviewable item with it (section 3 of the
 * build prompt): each item keeps a stability (how many days until recall
 * drops to 90%), a difficulty (1 to 10), a due date, reps and lapses.
 *
 * The formulas and the default weights are FSRS-5's, as published with the
 * open-source scheduler (open-spaced-repetition). Written out here rather than
 * pulled in as a dependency so `npm test` runs them under plain node and so
 * every number the app shows can be traced to a line.
 *
 * Ratings: 1 Again, 2 Hard, 3 Good, 4 Easy.
 *
 * Two simplifications, both deliberate for an exam app used in short daily
 * sessions:
 *   - no learning steps measured in minutes beyond "again later today": a
 *     new item rated Again or Hard comes back in the same session (the
 *     session requeues it) and is due again in minutes;
 *   - no interval fuzz: a student comparing two cards on the same day should
 *     see the same arithmetic.
 */

export const W = [
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11,
  0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621,
]
export const DECAY = -0.5
export const FACTOR = 19 / 81
export const RETENTION = 0.9
export const MAX_INTERVAL = 36500
export const DAY = 86400000
export const RATINGS = { again: 1, hard: 2, good: 3, easy: 4 }

const clampD = (d) => Math.min(10, Math.max(1, d))
const round = (x, n = 4) => Math.round(x * 10 ** n) / 10 ** n

/** Probability of recalling, `elapsed` days after the last review. */
export function retrievability(elapsed, stability) {
  if (!(stability > 0)) return 0
  return Math.pow(1 + (FACTOR * Math.max(0, elapsed)) / stability, DECAY)
}

export const initStability = (g, w = W) => Math.max(0.1, w[g - 1])
export const initDifficulty = (g, w = W) => clampD(w[4] - Math.exp(w[5] * (g - 1)) + 1)

/** Difficulty after a rating: linear damping, then mean reversion to D0(Easy). */
export function nextDifficulty(d, g, w = W) {
  const delta = -w[6] * (g - 3)
  const damped = d + (delta * (10 - d)) / 9
  return clampD(w[7] * initDifficulty(4, w) + (1 - w[7]) * damped)
}

/** Stability after a successful recall (Hard, Good or Easy). */
export function recallStability(d, s, r, g, w = W) {
  const hard = g === 2 ? w[15] : 1
  const easy = g === 4 ? w[16] : 1
  return s * (Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp(w[10] * (1 - r)) - 1) * hard * easy + 1)
}

/** Stability after a lapse (Again). Never above what it was. */
export function forgetStability(d, s, r, w = W) {
  const sf = w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp(w[14] * (1 - r))
  return Math.min(sf, s)
}

/** A second look on the same day moves stability a little, not a whole step. */
export const shortTermStability = (s, g, w = W) => s * Math.exp(w[17] * (g - 3 + w[18]))

/** Days until recall falls to `retention`. At 0.9 this is the stability itself. */
export function intervalDays(s, retention = RETENTION) {
  const i = (s / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1)
  return Math.min(MAX_INTERVAL, Math.max(1, Math.round(i)))
}

/**
 * Review one card.
 *
 * card: { state, stability, difficulty, reps, lapses, last_review, due }
 * Returns the next card plus `interval` (days, 0 for "later today").
 */
export function review(card, rating, now = new Date(), { retention = RETENTION, w = W } = {}) {
  const g = Math.round(rating)
  if (!(g >= 1 && g <= 4)) throw new Error(`rating must be 1 to 4, got ${rating}`)
  const c = { state: 'new', stability: 0, difficulty: 0, reps: 0, lapses: 0, last_review: null, ...(card ?? {}) }
  const t = now instanceof Date ? now : new Date(now)
  const last = c.last_review ? new Date(c.last_review) : null
  const elapsed = last ? Math.max(0, (t - last) / DAY) : 0

  let s
  let d
  let state
  let interval
  let lapses = c.lapses ?? 0

  if (c.state === 'new' || !(c.stability > 0)) {
    s = initStability(g, w)
    d = initDifficulty(g, w)
    if (g <= 2) {
      state = 'learning'
      interval = 0
    } else {
      state = 'review'
      interval = intervalDays(s, retention)
    }
  } else {
    const r = retrievability(elapsed, c.stability)
    d = nextDifficulty(c.difficulty, g, w)
    if (elapsed < 1) s = shortTermStability(c.stability, g, w)
    else if (g === 1) s = forgetStability(c.difficulty, c.stability, r, w)
    else s = recallStability(c.difficulty, c.stability, r, g, w)
    if (g === 1) {
      if (c.state === 'review') lapses += 1
      state = c.state === 'review' ? 'relearning' : c.state === 'relearning' ? 'relearning' : 'learning'
      interval = 0
    } else if ((c.state === 'learning' || c.state === 'relearning') && g === 2) {
      state = c.state
      interval = 0
    } else {
      state = 'review'
      interval = intervalDays(s, retention)
    }
  }

  /* "Later today" is ten minutes: the session has already put the card back
     in its own queue; this is what the next session sees if it closes. */
  const due = new Date(t.getTime() + (interval === 0 ? 10 * 60000 : interval * DAY))
  return {
    state,
    stability: round(s),
    difficulty: round(d),
    reps: (c.reps ?? 0) + 1,
    lapses,
    last_review: t.toISOString(),
    due: due.toISOString(),
    interval,
  }
}

/** What each button would do, for the labels under them ("3 j", "16 j"). */
export function preview(card, now = new Date(), opts) {
  return [1, 2, 3, 4].map((g) => review(card, g, now, opts).interval)
}

/** Due now or overdue. */
export const isDue = (card, now = new Date()) => !card?.due || new Date(card.due) <= now

/**
 * A grade from an answer, for items the app marks itself (multiple choice,
 * true/false, typed flashcards): wrong is Again; right but unsure or a
 * guess is Hard; right and sure is Good. Easy stays the student's call.
 */
export function ratingFrom(correct, confidence) {
  if (!correct) return 1
  if (confidence === 'guess' || confidence === 'unsure') return 2
  return 3
}
