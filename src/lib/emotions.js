/**
 * How a spend felt.
 *
 * The budget could say what you bought, when, and in which of six categories.
 * It could not say anything about why, and why is the entire question anybody
 * has when they look back at a month and cannot account for two hundred
 * dollars. "Groceries" and "groceries at eleven at night because the day was
 * bad" are the same row to a category and are not the same event.
 *
 * WHY A LIST AND NOT A SINGLE VALUE.
 *
 * Because one purchase is genuinely two things at once. A gift is a gift and
 * an impulse. A takeaway is fatigue and comfort. Forcing a choice between them
 * makes the tag arbitrary, and an arbitrary tag is one nobody trusts three
 * months later when they are trying to read their own history.
 *
 * WHY IDS AND NOT THE WORDS THEMSELVES.
 *
 * The app is bilingual. Storing "Impulsif" means a French phone and an English
 * phone write different values for one feeling, and the totals split in half
 * for a reason nobody can see. The id is the record, the word is a rendering.
 *
 * Pure and importless, so the grouping, the toggling and the arithmetic can be
 * tested under plain node.
 */

/**
 * The palette, in the order it is offered.
 *
 * Three bands, and the order inside each is deliberate: the everyday ones
 * first because they are the honest answer most of the time, and the hardest
 * ones last because a list that opens with 'compulsion' is a list that feels
 * like an accusation before anybody has bought anything.
 *
 * `group` is only for the layout. Nothing is stored per group and nothing
 * downstream asks which band a feeling is in, so regrouping later changes a
 * heading and no data.
 */
export const EMOTIONS = [
  // Neutral and everyday.
  { id: 'neutral', emoji: '😐', group: 'everyday' },
  { id: 'unsure', emoji: '🤷', group: 'everyday' },
  { id: 'routine', emoji: '🔄', group: 'everyday' },

  // Positive and rewarding.
  { id: 'pleasure', emoji: '😊', group: 'positive' },
  { id: 'calm', emoji: '🧘', group: 'positive' },
  { id: 'celebration', emoji: '🥳', group: 'positive' },
  { id: 'gift', emoji: '🎁', group: 'positive' },
  { id: 'selfcare', emoji: '💆', group: 'positive' },

  // Impulse and strain.
  { id: 'impulse', emoji: '💸', group: 'strain' },
  { id: 'stress', emoji: '😬', group: 'strain' },
  { id: 'craving', emoji: '🍔', group: 'strain' },
  { id: 'tired', emoji: '🥱', group: 'strain' },
  { id: 'frustration', emoji: '😡', group: 'strain' },
]

/** The bands, in the order they are drawn. */
export const EMOTION_GROUPS = ['everyday', 'positive', 'strain']

/** Every valid id, for the sanitiser and for the database's check constraint. */
export const EMOTION_IDS = EMOTIONS.map((e) => e.id)

const BY_ID = new Map(EMOTIONS.map((e) => [e.id, e]))

/**
 * How many one transaction may carry.
 *
 * Not a rule about feelings, a bound on the column. Thirteen is the whole
 * palette, so this can only ever be hit by something that is not a person
 * tapping chips, and an unbounded array in a row somebody can create for free
 * is the shape of a table that grows in a way nobody planned.
 */
export const MAX_EMOTIONS = EMOTIONS.length

/**
 * What a new transaction starts with.
 *
 * Neutral, pre-selected, because the point of this is that tagging is
 * effortless. An empty selector asks a question before the amount has been
 * typed; a neutral one that people override when the answer is not neutral
 * asks nothing and still collects the answer when there is one.
 */
export const DEFAULT_EMOTIONS = ['neutral']

/** Is this one of ours? */
export function isEmotion(id) {
  return BY_ID.has(id)
}

/** The emoji for an id, or an empty string. Never throws on a stored unknown. */
export function emojiOf(id) {
  return BY_ID.get(id)?.emoji ?? ''
}

/** The palette for one band, in palette order. */
export function inGroup(group) {
  return EMOTIONS.filter((e) => e.group === group)
}

/**
 * A stored value, made safe to render.
 *
 * Anything can be in that column: a row written before this migration has
 * null, a row written by a later version of the app may carry an id this build
 * has never heard of, and a hand-edited row can hold anything at all. Unknown
 * ids are dropped rather than shown, because an emoji-less chip reading
 * "wibble" next to somebody's rent is worse than one fewer chip.
 *
 * Order is the palette's, not the array's. Two transactions tagged the same
 * two feelings should look identical whichever order they were tapped in.
 */
export function cleanEmotions(raw) {
  if (!Array.isArray(raw)) return []
  const seen = new Set()
  for (const id of raw) if (BY_ID.has(id)) seen.add(id)
  return EMOTION_IDS.filter((id) => seen.has(id))
}

/**
 * Tapping a chip.
 *
 * Off when it was on, on when it was off, and the result is always in palette
 * order so the row of chips under an amount does not reshuffle itself as
 * somebody picks. Unknown ids are refused rather than added, so a stale build
 * cannot write a value the check constraint will reject.
 */
export function toggleEmotion(list, id) {
  if (!BY_ID.has(id)) return cleanEmotions(list)
  const now = cleanEmotions(list)
  const next = now.includes(id) ? now.filter((x) => x !== id) : [...now, id]
  return cleanEmotions(next)
}

/**
 * What was spent under each feeling, over a set of rows.
 *
 * EXPENSES ONLY, AND THAT IS NOT AN OVERSIGHT. This exists to answer "how much
 * did stress cost me this month". Income tagged 'celebration' is a real thing
 * to record and adding it to the same total would produce a number that is
 * neither spending nor net anything.
 *
 * A transaction with two feelings counts its full amount under BOTH. The
 * totals therefore do not sum to the month's spending, and that is the honest
 * arithmetic: forty dollars spent while stressed and impulsive is forty
 * dollars of stressed spending and forty dollars of impulsive spending, not
 * twenty of each. Splitting it would invent a precision nobody expressed.
 *
 * Excluded rows are left out, matching every other total on the screen: a
 * transaction the person told the budget to ignore should not reappear inside
 * an insight about their budget.
 */
export function emotionTotals(entries = []) {
  const cents = new Map(EMOTION_IDS.map((id) => [id, 0]))
  const count = new Map(EMOTION_IDS.map((id) => [id, 0]))

  for (const row of entries) {
    if (!row || row.kind !== 'expense' || row.excluded === true) continue
    const amount = Number(row.amount_cents) || 0
    if (amount <= 0) continue
    for (const id of cleanEmotions(row.emotions)) {
      cents.set(id, cents.get(id) + amount)
      count.set(id, count.get(id) + 1)
    }
  }

  /* Only what actually happened. A bar chart of thirteen feelings, eleven of
     them at zero, is a picture of the palette rather than of the month. */
  return EMOTIONS.filter((e) => count.get(e.id) > 0)
    .map((e) => ({ id: e.id, emoji: e.emoji, group: e.group, cents: cents.get(e.id), count: count.get(e.id) }))
    .sort((a, b) => b.cents - a.cents || a.id.localeCompare(b.id))
}

/** The rows carrying a feeling. A null filter means all of them, unchanged. */
export function filterByEmotion(entries = [], id = null) {
  if (!id || !BY_ID.has(id)) return entries
  return entries.filter((row) => cleanEmotions(row?.emotions).includes(id))
}
