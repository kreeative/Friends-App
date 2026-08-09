import { APP_NAME } from '../legal/content'
import { useTheme } from '../lib/theme'

/**
 * The logo, in the theme the visitor chose.
 *
 * The artwork is a filled tile now, the lettering sits on its own coloured
 * ground rather than floating on the page as a transparent PNG. That removes
 * the whole class of problem the previous version kept running into: yellow
 * measures 1.4:1 on white, so a transparent yellow mark needed a plate
 * invented for it. These carry their own, so there is no special case left.
 *
 * Both shapes are square, which is why everything here is sized by one
 * dimension. In a horizontal navigation bar a square tile has to be the
 * monogram, the full wordmark shrunk to bar height is unreadable.
 */
const WORDMARK = {
  sun: '/brand/wordmark-pink.png', // pink ground, yellow lettering
  sea: '/brand/wordmark-blue.png', // blue ground, yellow lettering
}

/**
 * Both monogram tiles sit on yellow, which is now the field colour of sun and
 * the accent of sea, so each theme's mark carries its own second colour on a
 * shared ground, which is exactly the pairing the themes describe.
 */
const MARK = {
  sun: '/brand/mark-pink.png', // yellow ground, pink monogram
  sea: '/brand/mark-blue.png', // yellow ground, blue monogram
}

/**
 * The corner radius is a proportion, not a number.
 *
 * `.brand-tile` rounds at a fixed 22px, which is a gentle chamfer on a 160px
 * lockup and very nearly a circle on a 32px one. At bar size that was eating
 * the corners of the lettering, which is most of what made the mark in the
 * header look like a blob rather than a logo. A quarter of the side is the
 * app-icon proportion and holds at every size.
 */
function Tile({ src, alt, size, className }) {
  return (
    <img
      src={src}
      alt={alt}
      className={`brand-tile select-none ${className}`}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.26) }}
      draggable="false"
    />
  )
}

/** The full lockup. Readable from about 90px up. */
export default function Wordmark({ size = 160, className = '', variant }) {
  const { theme } = useTheme()
  const key = variant ?? theme
  return (
    <Tile src={WORDMARK[key] ?? WORDMARK.sun} alt={APP_NAME} size={size} className={className} />
  )
}

/** The ampersand monogram. Navigation, tight spaces, the app icon. */
export function Mark({ size = 44, className = '', variant }) {
  const { theme } = useTheme()
  const key = variant ?? theme
  return <Tile src={MARK[key] ?? MARK.sun} alt={APP_NAME} size={size} className={className} />
}

/**
 * The bar logo: the wordmark tile, and nothing beside it.
 *
 * This was a horizontal lockup, the tile plus the name set in type. That
 * arrangement made sense while the tile was the ampersand monogram, which has
 * no words in it, so without the type nothing anywhere said what the site was
 * called. Once the tile became the wordmark the type was the name printed
 * twice in the same 200 pixels, which is what "the logo already says Rich &
 * Friends" means, and it is right.
 *
 * A little larger than the lockup's tile was, because it is carrying the job
 * alone now, and the accessible name comes from the aria-label on the link
 * that wraps it in both headers.
 */
export function LockupInline({ size = 38, className = '' }) {
  return <Wordmark size={size} className={className} />
}

/**
 * Kept as a name because several screens ask for "the logo, handled", but
 * there is nothing left to handle now that the artwork brings its own
 * ground, so it is simply the wordmark.
 */
export const Lockup = Wordmark
