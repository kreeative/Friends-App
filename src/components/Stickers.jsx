import { pickStickers, stickerSrc } from '../lib/art'

/**
 * Die-cut stickers, on a rail.
 *
 * Placement is a rule rather than a list of coordinates. The previous version
 * was twenty-odd hand-picked numbers — a top percentage, a side, a size and a
 * tilt for every sticker — and hand-picked numbers with no rule behind them
 * are exactly what "randomly scattered" looks like, because that is what they
 * are. Four properties varying independently reads as noise however carefully
 * each value was chosen.
 *
 * So: two rails flanking the content column. Even vertical spacing, strict
 * left-right alternation, one size per set, and tilt drawn from a short
 * repeating series. The only thing that varies freely is which sticker lands
 * where.
 *
 * They hang off the column, not off the viewport. Pinned to the viewport edge
 * they drift further from the text the wider the screen gets, which is what
 * makes decoration look unrelated to the thing it is decorating. Anchored to
 * the column they hold the same relationship at every width.
 *
 * They also sit ABOVE the glass rather than behind it. Behind a half-opaque
 * panel a sticker's black outline shows through as a dark patch under the
 * text, which dropped the worst measured contrast to 2.8:1.
 *
 * Decoration, stated plainly: aria-hidden, pointer-events-none, and nothing
 * depends on seeing them.
 */

/** Short and repeating, so tilt reads as a set rather than as jitter. */
const TILTS = [-8, 7, -6, 9]

/**
 * @param names  sticker names, top to bottom
 * @param from   first sticker's position, as % of page height
 * @param to     last sticker's position
 */
function rail(names, { from = 8, to = 90, size = 72 } = {}) {
  const step = names.length > 1 ? (to - from) / (names.length - 1) : 0
  return names.map((src, i) => ({
    src,
    top: `${(from + step * i).toFixed(2)}%`,
    side: i % 2 === 0 ? 'left' : 'right',
    size,
    tilt: TILTS[i % TILTS.length],
    // Staggered on a fixed step so no two bob in phase, without being random.
    delay: ((i * 0.8) % 4).toFixed(1),
  }))
}

/**
 * Names are filtered against what is actually in src/assets/stickers before
 * the rail runs, so the spacing divides the stickers that exist rather than
 * leaving a hole where a renamed one used to be.
 *
 * `column` has to match the width of the content it is flanking, and the two
 * surfaces do not agree: the public pages run to max-w-5xl, the app to the
 * narrower max-w-content. Anchoring both to the same width is what put the
 * public set on top of its own panels rather than beside them.
 *
 * `showAt` follows from that. A rail needs column + 2×(sticker + gap) of
 * viewport before there is anywhere for it to be; below that the stickers are
 * hidden rather than shrunk into the gutter, which would be the unstructured
 * version of having them at all.
 */
const GAP = 28

const SETS = {
  /** The public site — max-w-5xl, so it needs a wide screen. */
  page: {
    column: '64rem',
    showAt: 'xl',
    items: rail(pickStickers(['unicorn', 'pizza', 'skull', 'cactus', 'cat', 'koi']), {
      from: 7,
      to: 91,
      size: 76,
    }),
  },

  /** The signed-in screens: same rule, quieter — a tool, not a poster. */
  app: {
    column: '40rem',
    showAt: 'lg',
    items: rail(pickStickers(['thumb', 'fox', 'lips', 'deer']), {
      from: 12,
      to: 86,
      size: 60,
    }),
  },
}

// Written out so Tailwind's scanner can see both class names as literals.
const VISIBILITY = { lg: 'hidden lg:block', xl: 'hidden xl:block' }

export default function Stickers({ set = 'page' }) {
  const conf = SETS[set]
  if (!conf?.items.length) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-20" aria-hidden="true">
      {/* The rails hang off this, not off the viewport. */}
      <div className="relative mx-auto h-full" style={{ maxWidth: conf.column }}>
        {conf.items.map((s) => (
          <img
            key={s.src}
            src={stickerSrc(s.src)}
            alt=""
            loading="lazy"
            className={`sticker ${VISIBILITY[conf.showAt]}`}
            style={{
              top: s.top,
              [s.side]: `-${s.size + GAP}px`,
              width: s.size,
              '--tilt': `${s.tilt}deg`,
              animationDelay: `${s.delay}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
