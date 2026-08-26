/**
 * One drawn mark per spend category, and the tinted disc it sits in.
 *
 * Every reference for this screen leads its transaction rows with a round
 * icon: it is what turns a column of text into a list you can scan without
 * reading, because the shape lands before the word does.
 *
 * Solid, matching the ActionBar set. At 20px inside a 38px disc an outlined
 * glyph is mostly hole: it reads as a smudge against the tint rather than as
 * a fork or a house, and the tint it sits on is pale by design. A filled
 * silhouette is the only thing that survives that size.
 *
 * Holes are cut with fill-rule evenodd, so a glyph stays one colour and keeps
 * inheriting currentColor. Not emoji, for the reason recorded in ActionBar:
 * an emoji is a different typeface at a different weight in a colour nothing
 * else on the page uses.
 *
 * The disc takes the category's own shade from the envelope ramp, so the
 * colour a category has on its gauge is the colour it has in the ledger. One
 * fact, one hue, wherever it appears.
 */
const ICON = {
  food: (
    <>
      {/* Three tines over a stem, and a wedge blade over a handle. The
          shoulders are concave arcs (sweep 0), which is the difference
          between a fork and a lollipop. */}
      <rect x="5.9" y="3.6" width="1.9" height="6.3" rx=".95" />
      <rect x="8.55" y="3.6" width="1.9" height="6.3" rx=".95" />
      <rect x="11.2" y="3.6" width="1.9" height="6.3" rx=".95" />
      <path d="M5.9 8.4h7.2v1.5a3.1 3.1 0 0 0-2.2 2.97v6.2a1.15 1.15 0 0 1-2.3 0v-6.2A3.1 3.1 0 0 0 5.9 9.9Z" />
      <path d="M18.1 3.3V19.1a1.2 1.2 0 0 1-2.4 0V13.1H14.65a.9.9 0 0 1-.9-.9V9.4Z" />
    </>
  ),
  transport: (
    <>
      {/* Cabin, body, wheels. Composed rather than one path, so each piece is
          a shape whose numbers mean something. */}
      <path d="M7.6 5.6h8.8a2.3 2.3 0 0 1 2.17 1.55L20 11H4l1.43-3.85A2.3 2.3 0 0 1 7.6 5.6Z" />
      <rect x="2.6" y="10.4" width="18.8" height="5.6" rx="2.2" />
      <circle cx="7.2" cy="16.8" r="2.1" />
      <circle cx="16.8" cy="16.8" r="2.1" />
    </>
  ),
  home: (
    /* Roof and walls in one outline, the door cut out of it with an arched
       head. Symmetric about x=12: both slopes run 8.2 across, 6.36 down. */
    <path d="M11.12 3.63a1.4 1.4 0 0 1 1.76 0l8.2 6.36a1.4 1.4 0 0 1 .52 1.09V19.2a1.4 1.4 0 0 1-1.4 1.4h-5.3v-4.7a2.9 2.9 0 0 0-5.8 0v4.7H3.8a1.4 1.4 0 0 1-1.4-1.4v-8.12a1.4 1.4 0 0 1 .52-1.09Z" />
  ),
  fun: (
    <path d="M11.05 3.42a1.06 1.06 0 0 1 1.9 0l2.16 4.38 4.83.7a1.06 1.06 0 0 1 .59 1.81l-3.5 3.4.83 4.81a1.06 1.06 0 0 1-1.54 1.12L12 17.37l-4.32 2.27a1.06 1.06 0 0 1-1.54-1.12l.83-4.81-3.5-3.4a1.06 1.06 0 0 1 .59-1.81l4.83-.7Z" />
  ),
  health: (
    <path d="M12 19.9 4.9 12.75a4.85 4.85 0 0 1 0-6.86 4.85 4.85 0 0 1 6.86 0l.24.24.24-.24a4.85 4.85 0 0 1 6.86 0 4.85 4.85 0 0 1 0 6.86Z" />
  ),
  other: (
    /* A bag. The handle is a cut annulus, 2.2 thick all the way round, not a
       filled lobe stuck to the top. */
    <path d="M8.4 7.2V6.6a3.6 3.6 0 0 1 7.2 0v.6h2.9a2 2 0 0 1 1.99 1.8l1.06 10.2a2 2 0 0 1-1.99 2.2H4.45a2 2 0 0 1-1.99-2.2L3.52 9a2 2 0 0 1 1.99-1.8Zm2.2 0h2.8v-.6a1.4 1.4 0 0 0-2.8 0Z" />
  ),
  income: (
    <>
      {/* Fatter than a drawn arrow wants to be, on purpose: it sits in a row
          with a house and a heart, and at 20px a slim arrow reads as lighter
          than its neighbours rather than as a different thing. */}
      <rect x="9.95" y="8.4" width="4.1" height="11.4" rx="2.05" />
      <path d="M12 3.6 18.7 11.5H5.3Z" />
    </>
  ),
}

/**
 * Whole class strings, because Tailwind scans source text: a template like
 * `text-cat-${n}` produces nothing at build time. Same order as the envelope
 * ramp, so a category's disc and its gauge are the same step of the family.
 */
const TINT = {
  food: 'text-mark bg-cat-1-soft',
  transport: 'text-mark bg-cat-2-soft',
  home: 'text-mark bg-cat-3-soft',
  fun: 'text-mark bg-cat-4-soft',
  health: 'text-mark bg-cat-5-soft',
  /**
   * One glyph colour, six tints, and the palette is why.
   *
   * These were six steps of the category ramp, and the ramp is pink to yellow
   * now: its yellow half is 1.41:1 on white, so half the discs would have been
   * a glyph nobody could see. Six distinguishable marks cannot be made from
   * pink and yellow, so the disc says which category it is with the tint behind
   * the glyph, and the row's own words say it in words.
   *
   * `other` no longer needs its special case: it was borrowing cat-3's ink to
   * escape cat-6 at 2.49:1, and there is no cat-6 ink left to escape.
   */
  other: 'text-mark bg-cat-6-soft',
  /* Income is not one of the six and must not borrow their tint. Green is a
     fact about the world rather than a matter of taste, which is why it is not
     a themed token, and it survived the palette change for the same reason
     --c-negative did: "money arrived" and "you overspent" are the two states a
     reader must not misread. Dropped by accident in the rewrite above, which
     silently fell income through to `other` and painted it pink. */
  income: 'text-green bg-green/10',
}

/** The mark alone, inheriting colour and size from whatever holds it. */
export function CatIcon({ category = 'other', className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <g fill="currentColor" fillRule="evenodd" clipRule="evenodd">
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
      /* A stable hook. The glyphs are hand-written paths, and a wrong sweep
         flag or fill-rule fails silently: it renders, it just renders the
         wrong shape. The probe that measures the ink needs to address one
         disc at a time to catch that. */
      data-cat={category}
      className={`flex shrink-0 items-center justify-center rounded-pill ${TINT[category] ?? TINT.other}`}
      style={{ width: size, height: size }}
    >
      <CatIcon category={category} className={size >= 34 ? 'h-5 w-5' : 'h-4 w-4'} />
    </span>
  )
}
