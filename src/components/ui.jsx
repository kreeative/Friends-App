export function Screen({ children, className = '' }) {
  return <div className={`min-h-dvh bg-black pb-24 ${className}`}>{children}</div>
}

export function TopBar({ title, right, sub }) {
  return (
    <header className="hair-b sticky top-0 z-20 bg-black/95 backdrop-blur px-4 pb-3 pt-5">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="font-display text-[22px] font-bold uppercase tracking-tight">{title}</h1>
        {right}
      </div>
      {sub && <p className="label mt-1.5">{sub}</p>}
    </header>
  )
}

export function Section({ title, children, action }) {
  return (
    <section className="px-4 pt-7">
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between">
          <h2 className="label">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Empty({ children }) {
  return <p className="hair px-4 py-6 text-center text-[13px] text-white/40">{children}</p>
}

export function Stat({ value, label, hint }) {
  return (
    <div className="hair flex-1 px-3 py-4">
      <div className="font-display text-[26px] leading-none">{value}</div>
      <div className="label mt-2">{label}</div>
      {hint && <div className="mt-1 font-mono text-[10px] text-white/25">{hint}</div>}
    </div>
  )
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="label mb-1.5 block">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[12px] leading-snug text-white/35">{hint}</span>}
    </label>
  )
}

export function Avatar({ profile, size = 28 }) {
  const initials = (profile?.display_name ?? '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div
      className="hair flex shrink-0 items-center justify-center font-mono text-[10px] text-white/70"
      style={{ width: size, height: size }}
    >
      {initials}
    </div>
  )
}

/** Bottom sheet — the reachable place for a control on a phone. */
export function Sheet({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/70" onClick={onClose}>
      <div
        className="hair-t max-h-[88dvh] overflow-y-auto bg-black px-4 pb-8 pt-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-[18px] uppercase tracking-tight">{title}</h2>
          <button onClick={onClose} className="label px-2 py-1">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
