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

/** The ampersand monogram. Navigation, tight spaces, the app icon. */
export function Mark({ size = 44, className = '', variant }) {
  const { theme } = useTheme()
  const key = variant ?? theme
  return <Tile src={MARK[key] ?? MARK.sun} alt={APP_NAME} size={size} className={className} />
}

/**
 * The name, written out, in a navigation bar.
 *
 * Both headers showed the ampersand monogram, which is a square tile with no
 * words in it, so nothing anywhere on the site actually said what the site was
 * called. The obvious fix does not work: the wordmark artwork is four lines of
 * lettering in a square, readable from about 90px up, and a navigation bar is
 * 32 to 44 high. Dropping it in gives an unreadable smudge and a very tall bar.
 *
 * So the lockup goes horizontal. The tile keeps its job as the mark, and the
 * name is set beside it in the site's own type, which reads at any bar height
 * and stays legible when the bar is glass over a photograph.
 *
 * The name can be dropped below the smallest breakpoint on the app side, where
 * the bar also has to hold a group name and a menu. The tile carries it there,
 * and the accessible name comes from the link's aria-label either way.
 */
export function LockupInline({ size = 32, className = '', hideNameOnMobile = false }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Mark size={size} />
      <span
        className={`whitespace-nowrap font-bold tracking-[-0.02em] text-ink ${
          hideNameOnMobile ? 'hidden sm:inline' : ''
        }`}
        style={{ fontSize: Math.round(size * 0.5) }}
      >
        {APP_NAME}
      </span>
    </span>
  )
}

/**
 * Kept as a name because several screens ask for "the logo, handled", but
 * there is nothing left to handle now that the artwork brings its own
 * ground, so it is simply the wordmark.
 */
export const Lockup = Wordmark
