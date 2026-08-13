import { MOODS, moodById } from '../lib/moods'
import { useT } from '../lib/i18n'

/**
 * "How are you today?". Twelve shapes, one tap.
 *
 * Deliberately optional, and deliberately first. A check-in that opens with
 * twelve goals and a counter asks "did you perform"; opening with this asks
 * "how are you", which is the question that keeps someone in a group after a
 * fortnight where the answer to the first one is no.
 *
 * Nothing downstream requires it. Skipping it costs nothing and is not
 * recorded as a miss.
 */

const FACE = {
  eyes: {
    // Relaxed, shut, curving up, the reference's whole cast wears these.
    closed: (
      <>
        <path d="M30 46q6 7 12 0" />
        <path d="M58 46q6 7 12 0" />
      </>
    ),
    squint: (
      <>
        <path d="M31 43l11 6" />
        <path d="M69 43l-11 6" />
      </>
    ),
  },
  mouth: {
    smile: <path d="M38 62q12 10 24 0" />,
    flat: <path d="M38 65h24" />,
    frown: <path d="M38 68q12-10 24 0" />,
  },
}

function MoodGlyph({ mood }) {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
      <path
        d={mood.path}
        fill={mood.color}
        stroke={mood.color}
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <g
        fill="none"
        stroke="#141216"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {mood.eyes === 'dots' ? (
          <>
            <circle cx="36" cy="46" r="1.8" fill="#141216" stroke="none" />
            <circle cx="64" cy="46" r="1.8" fill="#141216" stroke="none" />
          </>
        ) : (
          FACE.eyes[mood.eyes]
        )}
        {FACE.mouth[mood.mouth]}
      </g>
    </svg>
  )
}

/**
 * @param value      the selected mood id, or null
 * @param onChange   called with the id, or with null when the same one is
 *                   tapped again. Undo has to be as cheap as choosing
 */
export default function MoodBoard({ value, onChange }) {
  const { t } = useT()

  return (
    /**
     * Three across on a phone, four from `sm` up.
     *
     * Four columns on a 390px screen leaves each face about 82px, and
     * "Reconnaissant" and "Plein d'énergie" are wider than that, so the labels
     * ran into their neighbours and the row became unreadable. Three columns
     * give each one about 110px, which every label in both languages fits
     * inside on at most two lines.
     *
     * The row gap is larger than the column gap on purpose. Labels that wrap
     * to a second line need the vertical room; giving them the same horizontal
     * room would cost the width that stopped them colliding.
     */
    <div
      role="radiogroup"
      aria-label={t('mood.question')}
      className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 sm:gap-x-2"
    >
      {MOODS.map((mood) => {
        const selected = value === mood.id
        return (
          <button
            key={mood.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(selected ? null : mood.id)}
            className="press group flex flex-col items-center rounded-inner py-1 text-center"
          >
            {/* A fixed box, not a fraction of the column. The glyphs have to
                line up across rows whatever the label under them does. */}
            <span
              className={`block h-14 w-14 shrink-0 transition-transform duration-200 ease-settle ${
                selected ? 'scale-110' : 'group-hover:scale-105'
              }`}
              style={{
                filter: selected
                  ? `drop-shadow(0 4px 10px ${mood.color}66)`
                  : 'drop-shadow(0 1px 2px rgb(0 0 0 / 0.12))',
              }}
            >
              <MoodGlyph mood={mood} />
            </span>
            {/* Selection is carried by the fill behind the label, not by
                colour on the glyph, the glyph is already the mood's own colour
                and has nowhere left to go.

                rounded-inner rather than a pill: a pill radius on a label that
                has wrapped to two lines reads as a lozenge with the text
                falling out of it. */}
            <span
              /* w-full, not a max-width. A max-width wider than the grid cell
                 is not a limit at all: "Reconnaissant" simply ran out past the
                 right edge of the card. The cell is the limit, so the label
                 takes the cell and wraps inside it. px-1 rather than px-2 buys
                 the eight pixels that keep that word on one line. */
              /* hyphens-auto so the one word that still cannot fit, French
                 "Reconnaissant", breaks with a hyphen where the language
                 allows rather than snapping in half mid-syllable. The locale
                 provider keeps <html lang> in step, which is what the
                 browser's hyphenation dictionary keys on. */
              className={`mt-2 w-full hyphens-auto break-words rounded-inner px-1 py-0.5 text-label font-semibold leading-tight ${
                selected ? 'bg-ink text-bg' : 'text-muted'
              }`}
            >
              {t(`mood.${mood.id}`)}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** The chosen mood, at rest. For the board and the history strip. */
export function MoodBadge({ id, size = 28, withLabel = false }) {
  const { t } = useT()
  const mood = moodById(id)
  if (!mood) return null

  return (
    <span className="inline-flex items-center gap-2 align-middle">
      <span style={{ width: size, height: size }} className="block shrink-0">
        <MoodGlyph mood={mood} />
      </span>
      {withLabel && <span className="text-small text-muted">{t(`mood.${mood.id}`)}</span>}
    </span>
  )
}
