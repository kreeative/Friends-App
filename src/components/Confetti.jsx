/**
 * The confetti behind a celebration card.
 *
 * Deliberately a background rather than an animation. A burst of falling paper
 * is the right gesture exactly once, and this card can appear three times in a
 * feed on a good week; the third burst is noise, and on the group board it
 * would be several of them firing at different moments down the page.
 *
 * So it is still, scattered, and quiet enough to read across. Drawn as SVG at
 * the sizes it is used, seeded by hand rather than randomised, so the same
 * card looks the same on every render and does not reshuffle itself when React
 * re-renders the list around it.
 *
 * Every piece is the theme's own palette at low alpha. Confetti in six
 * arbitrary party colours would be the one place in the app where a hue means
 * nothing, and it would look like clip art stuck to a card, which is exactly
 * what the emoji were removed for.
 *
 * aria-hidden and pointer-events-none: it is decoration in the honest sense,
 * nothing depends on seeing it, and it must never eat a tap meant for the
 * button underneath.
 */

/* x, y, rotation, length, and which of the three tones. Hand-placed so the
   pieces cluster at the edges and leave the middle of the card, where the text
   sits, comparatively clear. */
const PIECES = [
  [4, 18, -28, 9, 0], [11, 62, 42, 7, 1], [7, 88, 12, 8, 2],
  [17, 8, 65, 8, 2], [24, 40, -52, 6, 0], [15, 33, 22, 7, 1],
  [31, 76, 38, 8, 1], [38, 12, -18, 7, 2], [46, 92, 55, 6, 0],
  [57, 22, 30, 8, 1], [63, 68, -40, 7, 2], [71, 6, 18, 9, 0],
  [78, 48, 62, 6, 1], [84, 84, -25, 8, 2], [90, 28, 45, 7, 0],
  [95, 58, -12, 6, 1], [52, 52, 8, 7, 2], [88, 12, -60, 6, 0],
]

const TONE = [
  'rgb(var(--c-accent) / 0.55)',
  'rgb(var(--c-loud) / 0.4)',
  'rgb(var(--c-ink) / 0.16)',
]

export default function Confetti() {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      {PIECES.map(([x, y, rot, len, tone], i) => (
        <rect
          key={i}
          x={x}
          y={y}
          width={2.2}
          height={len / 4}
          rx={0.8}
          fill={TONE[tone]}
          transform={`rotate(${rot} ${x} ${y})`}
        />
      ))}
    </svg>
  )
}
