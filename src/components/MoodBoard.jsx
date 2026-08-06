import { MOODS, moodById } from '../lib/moods'
import { useT } from '../lib/i18n'

/**
 * "How are you today?" — twelve shapes, one tap.
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
    // Relaxed, shut, curving up — the reference's whole cast wears these.
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
 *                   tapped again — undo has to be as cheap as choosing
 */
export default function MoodBoard({ value, onChange }) {
  const { t } = useT()

  return (
    <div role="radiogroup" aria-label={t('mood.question')} className="grid grid-cols-4 gap-x-2 gap-y-5">
      {MOODS.map((mood) => {
        const selected = value === mood.id
        return (
          <button
            key={mood.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(selected ? null : mood.id)}
            className="press group flex flex-col items-center gap-2 rounded-inner py-1"
          >
            <span
              className={`block h-[3.25rem] w-[3.25rem] transition-transform duration-200 ease-settle ${
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
            {/* Selection is carried by the ring on the label, not by colour
                on the glyph — the glyph is already the mood's own colour and
                has nowhere left to go. */}
            <span
              className={`rounded-pill px-2 py-0.5 text-center text-small leading-tight ${
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

/** The chosen mood, at rest — for the board and the history strip. */
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
