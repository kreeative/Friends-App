/**
 * One drawn mark per spend category, and the tinted disc it sits in.
 *
 * Every reference for this screen leads its transaction rows with a round
 * icon: it is what turns a column of text into a list you can scan without
 * reading, because the shape lands before the word does.
 *
 * Drawn, one stroke weight, matching the ActionBar set. Not emoji, for the
 * reason recorded there: an emoji is a different typeface at a different
 * weight in a colour nothing else on the page uses.
 *
 * The disc takes the category's own shade from the envelope ramp, so the
 * colour a category has on its gauge is the colour it has in the ledger. One
 * fact, one hue, wherever it appears.
 */
const ICON = {
  food: (
    <>
      <path d="M7 3.5v7a2.6 2.6 0 0 0 5.2 0v-7" />
      <path d="M9.6 10.5V20.5" />
      <path d="M17.6 20.5V3.8c-2 .7-3 2.6-3 5.2 0 1.9.9 3 3 3.2" />
    </>
  ),
  transport: (
    <>
      <path d="M4.5 16.5v-4l1.8-4.4A2 2 0 0 1 8.2 7h7.6a2 2 0 0 1 1.9 1.1l1.8 4.4v4" />
      <path d="M4.5 12.5h15" />
      <path d="M7 16.5v1.8M17 16.5v1.8" />
    </>
  ),
  home: (
    <>
      <path d="M4.5 10.2 12 4.2l7.5 6v9.3h-15Z" />
      <path d="M9.8 19.5v-5.2h4.4v5.2" />
    </>
  ),
  fun: (
    <>
      <path d="M12 4.3 14.3 9l5.2.8-3.8 3.6.9 5.1-4.6-2.4-4.6 2.4.9-5.1L4.5 9.8 9.7 9Z" />
    </>
  ),
  health: (
    <>
      <path d="M12 19.4S4.6 15.1 4.6 9.9A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7.4 1.9c0 5.2-7.4 9.5-7.4 9.5Z" />
    </>
  ),
  other: (
    <>
      <path d="M4.6 8.4h14.8v10.2H4.6Z" />
      <path d="M4.6 8.4 6.4 5.2h11.2l1.8 3.2" />
      <path d="M9.8 12h4.4" />
    </>
  ),
  income: (
    <>
      <path d="M12 19V5.4" />
      <path d="m6.8 10.6 5.2-5.2 5.2 5.2" />
    </>
  ),
}

/**
 * Whole class strings, because Tailwind scans source text: a template like
 * `text-cat-${n}` produces nothing at build time. Same order as the envelope
 * ramp, so a category's disc and its gauge are the same step of the family.
 */
const TINT = {
  food: 'text-cat-1 bg-cat-1-soft',
  transport: 'text-cat-2 bg-cat-2-soft',
  home: 'text-cat-3 bg-cat-3-soft',
  fun: 'text-cat-4 bg-cat-4-soft',
  health: 'text-cat-5 bg-cat-5-soft',
  other: 'text-cat-6 bg-cat-6-soft',
  /* Money coming in is not one of the six and should not borrow their family:
     it is the one row in the ledger that is not a spend. */
  income: 'text-green bg-green/10',
}

/** The mark alone, inheriting colour and size from whatever holds it. */
export function CatIcon({ category = 'other', className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {ICON[category] ?? ICON.other}
      </g>
    </svg>
  )
}

/** The mark in its tinted disc, which is how the ledger and the legend use it. */
export default function CatDisc({ category = 'other', size = 38 }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-pill ${TINT[category] ?? TINT.other}`}
      style={{ width: size, height: size }}
    >
      <CatIcon category={category} className={size >= 34 ? 'h-5 w-5' : 'h-4 w-4'} />
    </span>
  )
}
