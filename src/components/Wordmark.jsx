import { APP_NAME } from '../legal/content'
import { useTheme } from '../lib/theme'

/**
 * The logo, in the accent the visitor chose.
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
  pink: '/brand/wordmark-pink.png', // pink ground, yellow lettering
  yellow: '/brand/wordmark-yellow.png', // yellow ground, blue lettering
  blue: '/brand/wordmark-blue.png', // blue ground, yellow lettering
}

/**
 * Only two monogram tiles were drawn, both on yellow. The blue one stands in
 * for the blue theme as well as the yellow one — a yellow-ground mark beside
 * a blue-ground wordmark is a small inconsistency, and the honest fix is a
 * third drawing rather than me recolouring one.
 */
const MARK = {
  pink: '/brand/mark-pink.png', // yellow ground, pink monogram
  yellow: '/brand/mark-blue.png', // yellow ground, blue monogram
  blue: '/brand/mark-blue.png',
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
  const { accent } = useTheme()
  const key = variant ?? accent
  return (
    <Tile src={WORDMARK[key] ?? WORDMARK.pink} alt={APP_NAME} size={size} className={className} />
  )
}

/** The ampersand monogram — navigation, tight spaces, the app icon. */
export function Mark({ size = 44, className = '', variant }) {
  const { accent } = useTheme()
  const key = variant ?? accent
  return <Tile src={MARK[key] ?? MARK.pink} alt={APP_NAME} size={size} className={className} />
}

/**
 * Kept as a name because several screens ask for "the logo, handled" — but
 * there is nothing left to handle now that the artwork brings its own
 * ground, so it is simply the wordmark.
 */
export const Lockup = Wordmark
