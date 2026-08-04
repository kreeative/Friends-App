import { APP_NAME } from '../legal/content'

/**
 * The wordmark, extracted from the supplied artwork with a real alpha channel
 * rather than colour-keyed, so it carries no dark fringe on a light ground.
 *
 * It is pink on both themes. A logotype is exempt from the contrast rules that
 * govern body text, and the brand pink holds up on black and on white alike —
 * but it is never used to carry information, only to identify.
 */
export default function Wordmark({ className = '', width = 260 }) {
  return (
    <img
      src="/brand/wordmark.png"
      alt={APP_NAME}
      width={width}
      className={`h-auto select-none ${className}`}
      style={{ width }}
      draggable="false"
    />
  )
}

/** The ampersand alone — for tight spaces and the app icon. */
export function Monogram({ size = 40, className = '' }) {
  return (
    <img
      src="/brand/monogram.png"
      alt=""
      aria-hidden="true"
      className={`select-none ${className}`}
      style={{ height: size, width: 'auto' }}
      draggable="false"
    />
  )
}
