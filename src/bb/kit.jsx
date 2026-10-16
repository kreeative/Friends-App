import { BB_LOGO } from './logo'
import { useT } from '../lib/i18n'
import { anchorChip } from '../lib/bb/quality'
import { examLabel } from '../lib/bb/days'

/**
 * The few pieces every Beauty & Brain screen shares. Everything else comes
 * from the Rich & Friends kit (ui.jsx, StickerKit, the .lg cards).
 *
 * COLOURS. The logo pink #FF007A leans to the Beauty side (care, streaks,
 * breaks), the logo turquoise #009DB9 to the Brain side (questions,
 * mastery). Words on either are white, bold and at least 19px (the 3:1 bar
 * of large text: white measures 3.80:1 on the pink and 3.22:1 on the
 * turquoise). Anything smaller sits on white or a pastel, in ink.
 */
export const PINK = '#FF007A'
export const TURQ = '#009DB9'
export const LOGO_YELLOW = '#F8CB02'

/**
 * The wordmark, as artwork: Crosner outlines and Kee's own "&", one path per
 * letter, yellow on a pink or turquoise tile, like the Rich & Friends tile.
 * `layout`: stacked ("Beauty" over "& Brain"), line, or mono ("B&B").
 */
export function BBLogo({ layout = 'stacked', tile = 'pink', className = '', pad = 0.16, title }) {
  const art = BB_LOGO[layout] ?? BB_LOGO.stacked
  const p = Math.round(Math.max(art.w, art.h) * pad)
  const w = art.w + p * 2
  const h = art.h + p * 2
  const ground = tile === 'turquoise' ? TURQ : tile === 'pink' ? PINK : null
  const label = title ?? 'Beauty & Brain'
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className={className} data-hook="bb-logo">
      {ground && <rect width={w} height={h} rx={Math.round(Math.min(w, h) * 0.14)} fill={ground} />}
      <g transform={`translate(${p} ${p})`} fill={ground ? LOGO_YELLOW : PINK}>
        {art.paths.map((path, i) => (
          <path key={i} d={path.d} fillRule={path.evenodd ? 'evenodd' : 'nonzero'} />
        ))}
      </g>
    </svg>
  )
}

/** "Examen dans 12 jours", with the word, never a colour alone. */
export function ExamChip({ examAt, className = '' }) {
  const { t } = useT()
  const { key, n } = examLabel(examAt)
  const soon = n != null && n <= 7
  return (
    <span
      data-hook="exam-chip"
      className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-small font-semibold ${soon ? 'bg-[#FFE3F0] text-ink' : 'bg-surface text-ink'} ${className}`}
    >
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <rect x="2" y="3" width="12" height="11" rx="2" />
        <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
      </svg>
      {n == null ? t(key) : t(key, { n })}
    </span>
  )
}

/**
 * A bar with its number beside it, always (section 3: "on screen, always
 * show the number next to the bar"). Turquoise: mastery is the Brain side.
 */
export function Bar({ pct, label, hint, className = '' }) {
  const v = Math.max(0, Math.min(100, Math.round(pct ?? 0)))
  return (
    <div className={className} data-hook="bb-bar">
      <div className="flex items-baseline justify-between gap-3">
        {label && <span className="text-small font-semibold text-ink">{label}</span>}
        <span className="text-small font-bold tabular-nums text-ink">{v}%</span>
      </div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-pill bg-ink/10" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="h-full rounded-pill" style={{ width: `${v}%`, background: TURQ }} />
      </div>
      {hint && <p className="mt-1 text-small text-muted">{hint}</p>}
    </div>
  )
}

/** Where a fact comes from: "Cours 7 · diapo 6". Opens the excerpt on tap. */
export function Anchor({ anchor, fileName }) {
  if (!anchor) return null
  return (
    <details className="group inline-block max-w-full align-top" data-hook="anchor">
      <summary className="inline-flex max-w-full cursor-pointer list-none items-center gap-1 rounded-pill border border-[#009DB9]/50 bg-[#E6F6F9] px-2.5 py-0.5 text-[0.8125rem] font-semibold text-ink [&::-webkit-details-marker]:hidden">
        <svg viewBox="0 0 16 16" className="h-3 w-3 shrink-0" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 2h6l3 3v9H4z" />
          <path d="M10 2v3h3" />
        </svg>
        <span className="truncate">{anchorChip(anchor, fileName)}</span>
      </summary>
      <blockquote className="mt-2 max-w-[60ch] rounded-inner border-l-4 border-[#009DB9] bg-surface px-3 py-2 text-small text-ink">
        «&#8239;{anchor.excerpt}&#8239;»
      </blockquote>
    </details>
  )
}

export function Anchors({ ids, anchors, files, className = '' }) {
  const list = (ids ?? []).map((id) => anchors?.get?.(id)).filter(Boolean)
  if (!list.length) return null
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {list.map((a) => (
        <Anchor key={a.id} anchor={a} fileName={files?.get?.(a.material_id)} />
      ))}
    </div>
  )
}

/** Outside knowledge looks different and says so (section 2.3, rule 2). */
export function Outside({ children }) {
  const { t } = useT()
  return (
    <div className="rounded-inner border-2 border-dashed border-ink/25 bg-[#FFF8D6] px-3 py-2" data-hook="outside">
      <p className="text-[0.8125rem] font-bold uppercase tracking-[0.02em] text-ink">{t('bb.ses.outside')}</p>
      {children && <div className="mt-1 text-small text-ink">{children}</div>}
    </div>
  )
}

/** A big filled button on the brand colour: 19px bold white, the 3:1 bar. */
export function BigButton({ tone = 'pink', className = '', children, ...rest }) {
  const bg = tone === 'turquoise' ? 'bg-[#009DB9]' : 'bg-[#FF007A]'
  return (
    <button
      {...rest}
      className={`btn press ${bg} text-[1.1875rem] font-bold text-white hover:opacity-90 active:opacity-80 ${className}`}
    >
      {children}
    </button>
  )
}

/** A sentence that something went wrong, and what to do. */
export function Note({ tone = 'info', children, className = '' }) {
  const cls = tone === 'error' ? 'border-negative/40 bg-[#FDECEE]' : tone === 'good' ? 'border-green/40 bg-[#E8F5EC]' : 'border-[#009DB9]/40 bg-[#E6F6F9]'
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={`rounded-inner border px-4 py-3 text-small text-ink ${cls} ${className}`}>
      {children}
    </p>
  )
}

/** Maps of anchors and file names, built once per course. */
export function anchorMaps(anchors, materials) {
  return {
    anchors: new Map((anchors ?? []).map((a) => [a.id, a])),
    files: new Map((materials ?? []).map((m) => [m.id, m.file_name])),
  }
}
