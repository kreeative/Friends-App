import { useTheme } from '../lib/theme'

/**
 * The cover artwork, one per accent.
 *
 * The pairing is the point: each image is already dominated by the colour it
 * is shown with, so choosing a theme repaints the page rather than putting a
 * second hue beside the first. Same rule the interface follows.
 *
 * Framed rather than full-bleed. The originals are 600 to 1125 pixels wide,
 * and stretching one of those across a viewport would be visibly soft. At
 * this size each is shown at about its own resolution — and no type sits on
 * it, so legibility never depends on what the picture happens to be doing.
 */
const ART = {
  pink: 'bloom-pink',
  yellow: 'bloom-yellow',
  blue: 'bloom-blue',
  // Also in public/photos: bloom-pearl, the shell. Left out only because it
  // carries pink and blue at once, which is the one thing this mapping is
  // for. Swapping it in is one word.
}

export default function Cover({ className = '' }) {
  const { accent } = useTheme()
  const name = ART[accent] ?? ART.pink

  return (
    <div className={`frame ${className}`}>
      <img
        src={`/photos/${name}.webp`}
        alt=""
        aria-hidden="true"
        width={760}
        height={950}
        className="h-full w-full object-cover"
        fetchPriority="high"
      />
    </div>
  )
}
