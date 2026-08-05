import { APP_NAME } from '../legal/content'
import { useTheme } from '../lib/theme'

/**
 * The wordmark, in the accent the visitor chose.
 *
 * The artwork is flat colour over a real alpha channel, so the three
 * colourways are the same shapes with the RGB replaced — no fringe on any
 * ground, and no separate drawing to keep in step.
 *
 * The logo follows the accent rather than carrying information of its own: a
 * logotype identifies, it does not signal. It is also the one place the
 * accent appears at size, which is why nothing else on a page needs to.
 */
const SRC = {
  wordmark: {
    pink: '/brand/wordmark.png',
    yellow: '/brand/wordmark-yellow.png',
    blue: '/brand/wordmark-blue.png',
  },
  monogram: {
    pink: '/brand/monogram.png',
    yellow: '/brand/monogram-yellow.png',
    blue: '/brand/monogram-blue.png',
  },
}

/**
 * Yellow measures 1.4:1 on a white page — as a mark it does not dim, it
 * disappears. That one combination gets a black ground under it; every other
 * one sits directly on the page, because a plate the logo does not need is
 * just another box.
 */
export function useLogoPlate() {
  const { accent, resolved } = useTheme()
  return accent === 'yellow' && resolved === 'light'
}

export default function Wordmark({ className = '', width = 260, variant }) {
  const { accent } = useTheme()
  const key = variant ?? accent
  return (
    <img
      src={SRC.wordmark[key] ?? SRC.wordmark.pink}
      alt={APP_NAME}
      className={`h-auto select-none ${className}`}
      style={{ width }}
      draggable="false"
    />
  )
}

/**
 * The wordmark with the black ground applied only where it is needed. Use
 * this anywhere the mark stands alone; use Wordmark directly when it is
 * already inside a surface you control.
 */
export function Lockup({ width = 150, className = '' }) {
  const plate = useLogoPlate()
  if (!plate) return <Wordmark width={width} className={className} />
  return (
    <span className={`brand-badge ${className}`}>
      <Wordmark width={width} />
    </span>
  )
}

/** The ampersand with the same ground rule as Lockup, for when it is shown
 *  at a size where it is meant to be read rather than felt. */
export function Mark({ size = 64, className = '' }) {
  const plate = useLogoPlate()
  if (!plate) return <Monogram size={size} className={className} />
  return (
    <span className={`brand-badge p-4 ${className}`}>
      <Monogram size={size} />
    </span>
  )
}

/** The ampersand alone — for tight spaces and the app icon. */
export function Monogram({ size = 40, className = '', variant }) {
  const { accent } = useTheme()
  const key = variant ?? accent
  return (
    <img
      src={SRC.monogram[key] ?? SRC.monogram.pink}
      alt=""
      aria-hidden="true"
      className={`select-none ${className}`}
      style={{ height: size, width: 'auto' }}
      draggable="false"
    />
  )
}
