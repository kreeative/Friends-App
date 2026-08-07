/**
 * Die-cut stickers, stuck on top of the page.
 *
 * They sit ABOVE the glass, not behind it. Behind a panel that is only half
 * opaque, a sticker's black outline shows through as a dark patch under the
 * text — which is exactly what it looked like, and what dropped the worst
 * measured contrast to 2.8:1. On top they behave like actual stickers, and
 * the type underneath is unaffected.
 *
 * Placed in the margins so they overlap panel edges rather than words, and
 * the ones that would land on the measure of a narrow screen are not
 * rendered there at all rather than shrunk into specks.
 *
 * Decoration, stated plainly: aria-hidden, pointer-events-none, and nothing
 * depends on seeing them.
 */
const SETS = {
  hero: [
    { src: 'unicorn', top: '-2%', right: '2%', size: 108, tilt: -12, delay: 0 },
    { src: 'pizza', top: '30%', right: '-2%', size: 86, tilt: 14, delay: 1.2 },
    { src: 'cat', bottom: '4%', right: '14%', size: 82, tilt: 8, delay: 2.1 },
    { src: 'cactus', top: '58%', right: '22%', size: 62, tilt: -7, delay: 2.7 },
    // The two that are allowed on a phone, hanging off the panel's corners
    // where there is no text under them.
    { src: 'thumb', bottom: '-3%', left: '-2%', size: 74, tilt: -16, delay: 1.5, phone: true },
    // Was at top -4%, which slid under the sticky header and left half a
    // skull showing — a sticker cropped by chrome reads as a bug, not as
    // depth. Moved down to clear it.
    { src: 'skull', top: '14%', left: '61%', size: 66, tilt: 18, delay: 0.7, phone: true },
  ],
  close: [
    { src: 'lips', top: '-6%', left: '3%', size: 84, tilt: -10, delay: 0.4, phone: true },
    { src: 'koi', bottom: '-5%', right: '5%', size: 92, tilt: 20, delay: 1.8, phone: true },
    { src: 'deer', top: '18%', right: '-2%', size: 70, tilt: 6, delay: 2.4 },
    { src: 'fox', bottom: '20%', left: '-3%', size: 72, tilt: -14, delay: 3.1 },
  ],

  /**
   * The page-wide set.
   *
   * Every page gets stickers now, not just the landing hero — but a page is
   * mostly one narrow column of text with wide empty margins either side, so
   * these live entirely in those margins and none of them is allowed on a
   * phone, where the margin does not exist. Percentages are of the whole
   * scroll height, which is what spreads them down a long page instead of
   * clustering them all in the first screen.
   */
  page: [
    { src: 'unicorn', top: '4%', right: '2%', size: 84, tilt: -11, delay: 0 },
    { src: 'pizza', top: '21%', left: '1%', size: 70, tilt: 13, delay: 1.2 },
    { src: 'skull', top: '38%', right: '3%', size: 66, tilt: 17, delay: 0.7 },
    { src: 'cactus', top: '55%', left: '2%', size: 62, tilt: -8, delay: 2.7 },
    { src: 'cat', top: '70%', right: '2%', size: 74, tilt: 9, delay: 2.1 },
    { src: 'koi', top: '86%', left: '1%', size: 78, tilt: 19, delay: 1.8 },
  ],

  /** Sparser, for the signed-in screens — this is a tool, not a poster. */
  app: [
    { src: 'thumb', top: '8%', right: '1%', size: 62, tilt: -14, delay: 0.4 },
    { src: 'fox', top: '46%', left: '1%', size: 58, tilt: 11, delay: 1.6 },
    { src: 'deer', top: '80%', right: '2%', size: 60, tilt: -6, delay: 2.6 },
  ],
}

export default function Stickers({ set = 'hero' }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20" aria-hidden="true">
      {(SETS[set] ?? []).map((s) => (
        <img
          key={s.src}
          src={`/stickers/${s.src}.png`}
          alt=""
          loading="lazy"
          className={`sticker ${s.phone ? '' : 'hidden md:block'}`}
          style={{
            top: s.top,
            left: s.left,
            right: s.right,
            bottom: s.bottom,
            width: s.size,
            '--tilt': `${s.tilt}deg`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  )
}
