import { MOOD_GROUPS, inMoodGroup, moodById, toggleMood } from '../lib/moods'
import { useT } from '../lib/i18n'

/**
 * "How are you today?". Fifteen shapes, as many taps as you like.
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

/**
 * Where the two long labels are allowed to break.
 *
 * The measured problem: a grid cell is 66px at 320 and 89px at 390, and French
 * "Reconnaissant" sets at 99px. It does not fit at either width, so something
 * has to break it.
 *
 * `hyphens: auto` was supposed to, and cannot: it needs a hyphenation
 * dictionary for the document's language, and Chromium ships none for French.
 * With nothing to hyphenate by, `overflow-wrap: break-word` took over and
 * split the word at whatever character the line ran out on, with no hyphen at
 * all. That is what "Reconnaiss / ant" was.
 *
 * So the break points are given rather than derived. U+00AD is a SOFT hyphen:
 * invisible unless the browser actually needs the break, and drawn as a real
 * hyphen when it does. Keyed on the rendered word rather than the mood id,
 * because it is the word that is too long, and the English labels are not.
 *
 * This lives here and not in the i18n table on purpose. The same string is the
 * accessible name of every mood badge in the app, and a table nobody expects to
 * contain invisible characters is a bad place to put them.
 */
const SOFT = {
  Reconnaissant: 'Recon\u00ADnais\u00ADsant',
  Nostalgique: 'Nostal\u00ADgique',
}
const softWrap = (label) => SOFT[label] ?? label

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
 * @param value     the selected mood ids, as an array
 * @param onChange  called with the next array. Undo is tapping again, and it
 *                  has to be as cheap as choosing
 *
 * MULTI-SELECT, AND WHY THE ROLES CHANGED WITH IT.
 *
 * This was a radiogroup, which is the correct role for one-of-many and the
 * wrong one for any-of-many: a screen reader announcing "radio button" tells
 * somebody that picking a second will drop the first, which is exactly the
 * thing that is no longer true. Toggle buttons with aria-pressed say what this
 * now is.
 *
 * GROUPED, BECAUSE FIFTEEN IN ONE RUN IS A WALL.
 *
 * Twelve ordered by valence carried the meaning implicitly and just about held
 * together. Fifteen does not: the eye has nowhere to land and the pleasant end
 * and the hard end are the same undifferentiated grid. Three headings give it
 * somewhere, and the order is deliberate, the good ones first, because a
 * picker that opens on "en colère" is one that reads as an accusation before
 * anybody has answered.
 *
 * `multiple` exists because the journal is not the dashboard. journal_entries
 * .mood is a single text column and an entry is about one moment rather than a
 * whole day, so that editor keeps one-of-many and gets back a bare id; the
 * daily card takes any-of-many and gets back an array. The roles follow the
 * mode, because announcing "radio" for a control that keeps your last answer
 * is worse than announcing nothing.
 */
export default function MoodBoard({ value, onChange, multiple = true }) {
  const { t } = useT()
  const chosen = Array.isArray(value) ? value : value ? [value] : []

  return (
    <div className="space-y-6">
      {MOOD_GROUPS.map((group) => (
        <div key={group}>
          <p className="eyebrow">{t(`mood.group_${group}`)}</p>

          {/**
           * Three across on a phone, four from `sm` up.
           *
           * Four columns on a 390px screen leaves each face about 82px, and
           * "Reconnaissant" and "Plein d'énergie" are wider than that, so the
           * labels ran into their neighbours and the row became unreadable.
           * Three columns give each one about 110px, which every label in both
           * languages fits inside on at most two lines.
           *
           * The row gap is larger than the column gap on purpose. Labels that
           * wrap to a second line need the vertical room; giving them the same
           * horizontal room would cost the width that stopped them colliding.
           */}
          <div
            role={multiple ? 'group' : 'radiogroup'}
            aria-label={t(`mood.group_${group}`)}
            className="mt-3 grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 sm:gap-x-2"
          >
            {inMoodGroup(group).map((mood) => {
              const selected = chosen.includes(mood.id)
              return (
                <button
                  key={mood.id}
                  type="button"
                  {...(multiple
                    ? { 'aria-pressed': selected }
                    : { role: 'radio', 'aria-checked': selected })}
                  onClick={() =>
                    onChange(
                      multiple
                        ? toggleMood(chosen, mood.id)
                        : selected
                          ? null
                          : mood.id,
                    )
                  }
                  className="press group flex flex-col items-center rounded-inner py-1 text-center"
                >
                  {/* A fixed box, not a fraction of the column. The glyphs have
                      to line up across rows whatever the label under them does. */}
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
                      colour on the glyph, the glyph is already the mood's own
                      colour and has nowhere left to go.

                      rounded-inner rather than a pill: a pill radius on a label
                      that has wrapped to two lines reads as a lozenge with the
                      text falling out of it. */}
                  <span
                    /* w-full, not a max-width. A max-width wider than the grid
                       cell is not a limit at all: "Reconnaissant" simply ran out
                       past the right edge of the card. The cell is the limit, so
                       the label takes the cell and wraps inside it. px-1 rather
                       than px-2 buys the eight pixels that keep that word on one
                       line. */
                    /* break-words is GONE. It was the thing snapping words in
                       half: it breaks at whatever character the line runs out
                       on, with no hyphen, so "Reconnaissant" rendered as
                       "Reconnaiss" over "ant". hyphens-auto stays as a bonus
                       where a dictionary exists; softWrap below is what
                       actually does the work. */
                    className={`mt-2 w-full hyphens-auto rounded-inner px-1 py-0.5 text-label font-semibold leading-tight ${
                      selected ? 'bg-ink text-bg' : 'text-muted'
                    }`}
                  >
                    {softWrap(t(`mood.${mood.id}`))}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
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

/**
 * All of today's moods, at rest.
 *
 * Overlapped rather than spaced, so four faces read as one answer with several
 * parts rather than as four separate statements. The z-order runs left to right
 * so each tucks behind the next, the same trick the sign-in stickers use.
 *
 * The names go on one label for the set instead of one each: a screen reader
 * reading "joyful, image, impatient, image" is reading the implementation.
 */
export function MoodBadges({ ids = [], size = 28 }) {
  const { t } = useT()
  const list = (Array.isArray(ids) ? ids : [ids]).filter((id) => moodById(id))
  if (list.length === 0) return null

  return (
    <span className="inline-flex items-center align-middle" aria-label={list.map((id) => t(`mood.${id}`)).join(', ')}>
      {list.map((id, i) => (
        <span
          key={id}
          style={{ width: size, height: size, zIndex: list.length - i, marginLeft: i === 0 ? 0 : -size * 0.28 }}
          className="relative block shrink-0"
          aria-hidden="true"
        >
          <MoodGlyph mood={moodById(id)} />
        </span>
      ))}
    </span>
  )
}
