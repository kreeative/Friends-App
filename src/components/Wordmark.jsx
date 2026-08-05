import { APP_NAME } from '../legal/content'

/**
 * The wordmark, extracted from the supplied artwork with a real alpha channel
 * rather than colour-keyed, so it carries no fringe on any ground.
 *
 * Two colourways exist because two were supplied: pink, and yellow. Neither
 * is used to carry information — a logotype identifies, it does not signal —
 * which is why it sits outside the pink/green/yellow job system entirely.
 */
const SRC = {
  wordmark: { pink: '/brand/wordmark.png', yellow: '/brand/wordmark-yellow.png' },
  monogram: {
    pink: '/brand/monogram.png',
    yellow: '/brand/monogram-yellow.png',
    blue: '/brand/monogram-blue.png',
  },
}

export default function Wordmark({ className = '', width = 260, variant = 'pink' }) {
  return (
    <img
      src={SRC.wordmark[variant] ?? SRC.wordmark.pink}
      alt={APP_NAME}
      className={`h-auto select-none ${className}`}
      style={{ width }}
      draggable="false"
    />
  )
}

/** The ampersand alone — for tight spaces and the app icon. */
export function Monogram({ size = 40, className = '', variant = 'pink' }) {
  return (
    <img
      src={SRC.monogram[variant] ?? SRC.monogram.pink}
      alt=""
      aria-hidden="true"
      className={`select-none ${className}`}
      style={{ height: size, width: 'auto' }}
      draggable="false"
    />
  )
}
