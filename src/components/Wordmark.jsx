import { APP_NAME } from '../legal/content'
import { useTheme } from '../lib/theme'

/**
 * The logo, in the theme the visitor chose.
 *
 * The artwork is a filled tile now — the lettering sits on its own coloured
 * ground rather than floating on the page as a transparent PNG. That removes
 * the whole class of problem the previous version kept running into: yellow
 * measures 1.4:1 on white, so a transparent yellow mark needed a plate
 * invented for it. These carry their own, so there is no special case left.
 *
 * Both shapes are square, which is why everything here is sized by one
 * dimension. In a horizontal navigation bar a square tile has to be the
 * monogram — the full wordmark shrunk to bar height is unreadable.
 */
const WORDMARK = {
  sun: '/brand/wordmark-pink.png', // pink ground, yellow lettering
  sea: '/brand/wordmark-blue.png', // blue ground, yellow lettering
}

/**
 * Both monogram tiles sit on yellow, which is now the field colour of sun and
 * the accent of sea — so each theme's mark carries its own second colour on a
 * shared ground, which is exactly the pairing the themes describe.
 */
const MARK = {
  sun: '/brand/mark-pink.png', // yellow ground, pink monogram
  sea: '/brand/mark-blue.png', // yellow ground, blue monogram
}

function Tile({ src, alt, size, className }) {
  return (
    <img
      src={src}
      alt={alt}
      className={`brand-tile select-none ${className}`}
      style={{ width: size, height: size }}
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

/** The ampersand monogram — navigation, tight spaces, the app icon. */
export function Mark({ size = 44, className = '', variant }) {
  const { theme } = useTheme()
  const key = variant ?? theme
  return <Tile src={MARK[key] ?? MARK.sun} alt={APP_NAME} size={size} className={className} />
}

/**
 * Kept as a name because several screens ask for "the logo, handled" — but
 * there is nothing left to handle now that the artwork brings its own
 * ground, so it is simply the wordmark.
 */
export const Lockup = Wordmark
