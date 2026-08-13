import { strokeStyle, toPath, viewBox } from '../lib/ink'

/**
 * Handwriting, rendered.
 *
 * An SVG rather than an image, which is the whole reason the strokes are
 * stored as numbers: this is sharp on the grid card at 150px and sharp again
 * in the full entry at 900px, from the same forty lines of JSON, with nothing
 * uploaded, nothing resized and nothing to 404 later.
 *
 * `crop` is the difference between the thumbnail and the page. A grid card
 * showing a whole A4 canvas with three words in the top corner is a card
 * showing nothing, so a thumbnail zooms to the writing; the reader shows the
 * page as it was drawn, because where somebody put something on the page is
 * part of what they wrote.
 *
 * Decorative by default: handwriting is an image of text that no screen reader
 * can read, and captioning it "handwritten note" is the honest description. If
 * the entry carries a typed title the caller passes it as `label`, which is
 * the only alt text here that would ever be true.
 */
export default function InkPreview({ ink, crop = false, label, className = '' }) {
  const strokes = ink?.strokes ?? []

  return (
    <svg
      viewBox={viewBox(ink, { crop })}
      className={className}
      role={label ? 'img' : 'presentation'}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : 'true'}
      /* The drawing keeps its proportions and sits in the middle of whatever
         box it is given, rather than stretching to fill it. Handwriting that
         has been squashed on one axis is unmistakably wrong in a way a
         photograph is not. */
      preserveAspectRatio="xMidYMid meet"
    >
      {strokes.map((s, i) => {
        const st = strokeStyle(s)
        return (
          <path
            key={i}
            d={toPath(s.p)}
            fill="none"
            stroke={st.color}
            strokeWidth={st.width}
            strokeOpacity={st.opacity}
            strokeLinecap={st.cap}
            strokeLinejoin="round"
          />
        )
      })}
    </svg>
  )
}
