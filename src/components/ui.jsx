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
export function Stat({ value, label, hint }) {
  return (
    <div className="flex-1">
      {/* Yellow cannot be type (1.4:1 on white) so the metric stays ink and
          the yellow arrives as a rule underneath it. */}
      <div className="font-display text-metric text-ink">{value}</div>
      <div className="mt-2 h-1 w-10 rounded-pill bg-accent" />
      <div className="mt-2 text-small text-muted">{label}</div>
      {hint && <div className="text-small text-muted/70">{hint}</div>}
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

export function Avatar({ profile, size = 40 }) {
  const initials = (profile?.display_name ?? '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-pill bg-ink/[0.06] text-small text-muted"
      style={{ width: size, height: size }}
    >
      {initials}
    </div>
  )
}

export function Sheet({ open, onClose, title, children }) {
  const { t } = useT()
  if (!open) return null
  return (
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
    </div>
  )
}
