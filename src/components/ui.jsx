import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../lib/i18n'

export function Screen({ children, className = '' }) {
  // Extra bottom room: the tab bar floats clear of the edge, so content has
  // to clear the bar plus its inset.
  return (
    <div className={`min-h-dvh pb-36 ${className}`}>
      <div className="shell animate-rise">{children}</div>
    </div>
  )
}

/**
 * No sticky bar, no bottom rule. The heading just sits at the top of the page
 * with room around it, one confident thing, which is the whole point.
 */
export function TopBar({ title, right, sub }) {
  // pt-10 rather than pt-14: there is a sticky nav above this now, and the
  // heading was clearing chrome that no longer needed clearing.
  return (
    <header className="flex items-start justify-between gap-4 pb-2 pt-10">
      <div>
        <h1 className="text-h1 text-ink">{title}</h1>
        {sub && <p className="lede mt-2">{sub}</p>}
      </div>
      {right && <div className="pt-1">{right}</div>}
    </header>
  )
}

export function Section({ title, children, action }) {
  return (
    <section className="pt-section">
      {(title || action) && (
        <div className="mb-5 flex items-baseline justify-between gap-4">
          {title && <h2 className="eyebrow">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Empty({ children, action }) {
  return (
    <div className="py-10 text-center">
      <p className="lede mx-auto max-w-[28ch]">{children}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

/** A number and its name. No box, the scale does the work. */
/**
 * One number, its name, and an optional gloss.
 *
 * There used to be a short accent rule between the number and its label. The
 * intent was to get the brand colour in somewhere that yellow could survive,
 * since yellow cannot be type at 1.4:1 on white. The effect was a small bar
 * of fixed width sitting under every metric, which reads as a progress bar
 * pinned at the same fill no matter what the number says. A bar that never
 * moves is worse than no bar: it invites you to compare lengths that carry no
 * information.
 *
 * The label and the hint were also the same size and nearly the same colour,
 * stacked with no room between them, so a two-line label ran into the hint
 * under it. They are now separated by weight and space rather than by a
 * hairline of opacity.
 */
export function Stat({ value, label, hint }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="font-display text-metric leading-none text-ink [font-variant-numeric:tabular-nums]">
        {value}
      </div>
      <div className="mt-3 text-small font-semibold leading-snug text-ink">{label}</div>
      {hint && <div className="mt-1 text-small leading-snug text-muted">{hint}</div>}
    </div>
  )
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      {label && <span className="field-label">{label}</span>}
      {children}
      {/* field-note rather than another run of plain muted text. What survived
          the trim is the guidance carrying a real finding, and it was reading
          as a third line of the same grey as the label above it and the
          placeholder inside the box. */}
      {hint && <span className="field-note">{hint}</span>}
    </label>
  )
}

/**
 * A face, or the initials of one.
 *
 * avatar_url has been on the profile since the first schema and has been
 * filled in by the Google sign-up trigger the whole time, and this component
 * has been ignoring it and drawing initials for everybody. So a picture people
 * already had was never once shown.
 *
 * The fallback is not only for a missing url. A picture can 404 after the
 * storage object is deleted, and a broken-image glyph next to somebody's name
 * is worse than the initials were, so a failed load falls back too. The flag
 * resets whenever the url changes, otherwise one bad image would poison the
 * next one.
 *
 * Decorative in every placement here: the name is always next to it in text,
 * so an alt would be the same words read twice.
 */
export function Avatar({ profile, size = 40 }) {
  const [broken, setBroken] = useState(false)
  const url = profile?.avatar_url

  useEffect(() => setBroken(false), [url])

  const initials = (profile?.display_name ?? '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  if (url && !broken) {
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        onError={() => setBroken(true)}
        className="shrink-0 rounded-pill bg-ink/[0.06] object-cover"
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-pill bg-ink/[0.06] text-small text-muted"
      style={{ width: size, height: size }}
    >
      {initials}
    </div>
  )
}

/**
 * A bottom sheet, and the reason it is a portal.
 *
 * WHY IT WAS RENDERING OFF SCREEN.
 *
 * Every page in this app is wrapped in `.page-enter`, whose animation ends on
 * `transform: none` with `animation-fill-mode: both`. Filling forever means the
 * element keeps a transform animation applied forever, and an element with an
 * animated transform is a containing block for fixed-position descendants even
 * when the value resolves to none. So `position: fixed` inside a page was
 * positioned against the page, not the viewport, and `justify-end` put the
 * panel at the bottom of the whole scrolling document.
 *
 * The scrim covered the screen, because the page is roughly screen-sized, and
 * the sheet itself was somewhere below the fold. Tapping a member opened a
 * dialog nobody could see.
 *
 * A portal to the body is the fix, and it is the right shape anyway: a sheet
 * belongs to the app, not to the paragraph it happened to be declared next to,
 * and hoisting it out means no future page wrapper can capture it either.
 */
export function Sheet({ open, onClose, title, children }) {
  const { t } = useT()
  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-ink/25 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="max-h-[88dvh] animate-rise overflow-y-auto rounded-t-[1.75rem] bg-surface px-6 pb-12 pt-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto w-full max-w-content">
          <div className="mb-8 flex items-baseline justify-between gap-4">
            <h2 className="text-h2">{title}</h2>
            <button onClick={onClose} className="text-small text-muted transition-colors hover:text-ink">
              {t('ui.close')}
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
