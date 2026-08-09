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
    /**
     * The tile is the wordmark artwork, not the ampersand monogram.
     *
     * The monogram was here because the wordmark is four lines of lettering in
     * a square and does not resolve at bar height. That argument was about
     * legibility, and it was answering a question nobody asks of a logo in a
     * navigation bar: the name is set beside it in type, so the tile does not
     * have to be readable, it has to be recognisable. The wordmark is what is
     * on the app icon, the share card and the sign-in screen, and having the
     * one place people look at every day show something else meant the brand
     * had two marks and no logo.
     *
     * `leading-none` on the name is the alignment fix. Inherited line height
     * gives a 16px name a 26px line box, and centring a 26px box against a
     * 32px tile centres the box rather than the letters, so the word sat low
     * against the mark and the pair read as slightly tipped over. Collapsing
     * the box to the glyphs means what gets centred is what you can see.
     */
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Wordmark size={size} />
      <span
        className={`whitespace-nowrap font-bold leading-none tracking-[-0.02em] text-ink ${
          hideNameOnMobile ? 'hidden sm:inline' : ''
        }`}
        style={{ fontSize: Math.round(size * 0.46) }}
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
