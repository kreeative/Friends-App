/**
 * Per-buyer watermark.
 *
 * Be clear about what this is: it does not prevent copying, and it is not
 * security. Anything the browser renders can be photographed. What it does is
 * make a leaked copy traceable to the account it came from, which is a far
 * stronger deterrent than a disabled right-click — and unlike DRM it costs the
 * paying reader nothing.
 *
 * It sits behind the text at very low opacity, is not selectable, and is
 * hidden from screen readers so it never intrudes on the reading itself.
 */
export default function Watermark({ name, tag }) {
  if (!name && !tag) return null
  const label = [name, tag].filter(Boolean).join(' · ')

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 select-none overflow-hidden"
      style={{ contain: 'strict' }}
    >
      {Array.from({ length: 14 }).map((_, row) => (
        <div
          key={row}
          className="whitespace-nowrap text-small text-ink"
          style={{
            opacity: 0.035,
            transform: `rotate(-24deg) translateX(${row % 2 ? '-8%' : '0'})`,
            marginTop: '5.5rem',
            letterSpacing: '0.08em',
          }}
        >
          {`${label}   `.repeat(8)}
        </div>
      ))}
    </div>
  )
}

/** The visible, honest version — small, in the margin, not hidden from anyone. */
export function WatermarkNote({ name, tag }) {
  if (!name) return null
  return (
    <p className="mt-10 select-none text-small text-muted/70">
      {name}
      {tag ? ` · ${tag}` : ''}
    </p>
  )
}
