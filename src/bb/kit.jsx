import { Fragment } from 'react'
import { BB_LOGO } from './logo'
import { useT } from '../lib/i18n'
import { anchorChip } from '../lib/bb/quality'
import { examLabel } from '../lib/bb/days'
import { citeOf, splitRich } from '../lib/bb/cite'

/**
 * The few pieces every Beauty & Brain screen shares. Everything else comes
 * from the Rich & Friends kit (ui.jsx, StickerKit, the .lg cards).
 *
 * COLOURS: BLACK AND WHITE, WITH SOME COLOURS (Kee's reference: white cards
 * on a light grey ground, black titles, black pill buttons, a few bright
 * accents). The ground and the ink are tokens ([data-surface='bb'] in
 * src/index.css); the accents are here, each with one job:
 *
 *   ink     #111111  primary buttons, the active tab, bars. White on it 18.9:1.
 *   violet  #6B4EFF  the answer actions (check, hand in) and the option
 *                    picked. White on it 5.05:1, so any size.
 *   green   #1E7B34  right, and only right. 5.33:1 on white.
 *   yellow  #F8CB02  the logo yellow: the logo, highlights. Black on it.
 *   pink    #FF007A  the logo pink, kept for the art; text on it stays
 *                    white, bold and large (3.80:1).
 *
 * Their pastels carry black text at 15:1 or more. Colour is never the only
 * signal: a word or an icon always says the same thing.
 */
export const INK = '#111111'
export const VIOLET = '#6B4EFF'
export const GREEN = '#1E7B34'
export const PINK = '#FF007A'
export const LOGO_YELLOW = '#F8CB02'
export const SOFT = { yellow: '#FFF4C2', violet: '#EFEBFF', green: '#E4F5D9', pink: '#FFE3F0', grey: '#F4F4F5' }

/**
 * The wordmark, as artwork: Crosner outlines and Kee's own "&", one path per
 * letter, in the logo yellow on a black tile (the black and white theme;
 * the letters themselves never change). `tile="pink"` and `"turquoise"`
 * still draw the original tiles; `tile="none"` draws the letters in ink.
 * `layout`: stacked ("Beauty" over "& Brain"), line, or mono ("B&B").
 */
const TILES = { ink: INK, pink: PINK, turquoise: '#009DB9' }

export function BBLogo({ layout = 'stacked', tile = 'ink', className = '', pad = 0.16, title }) {
  const art = BB_LOGO[layout] ?? BB_LOGO.stacked
  const p = Math.round(Math.max(art.w, art.h) * pad)
  const w = art.w + p * 2
  const h = art.h + p * 2
  const ground = TILES[tile] ?? null
  const label = title ?? 'Beauty & Brain'
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className={className} data-hook="bb-logo">
      {ground && <rect width={w} height={h} rx={Math.round(Math.min(w, h) * 0.14)} fill={ground} />}
      <g transform={`translate(${p} ${p})`} fill={ground ? LOGO_YELLOW : INK}>
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
      className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 text-small font-semibold text-ink ${soon ? 'border-[#F8CB02] bg-[#FFF4C2]' : 'border-ink/10 bg-surface'} ${className}`}
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
 * show the number next to the bar"). Black on a grey track: the number says
 * how much, the fill only shows it.
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
        <div className="h-full rounded-pill" style={{ width: `${v}%`, background: INK }} />
      </div>
      {hint && <p className="mt-1 text-small text-muted">{hint}</p>}
    </div>
  )
}

/**
 * Where a fact comes from: "Cours 7 · diapo 6". Opens the excerpt on tap.
 * `compact` shows the place alone ("diapo 6") where a narrow box would cut
 * the chip before the part that matters; the file name stays in its title
 * and in the opened excerpt.
 */
export function Anchor({ anchor, fileName, compact = false }) {
  if (!anchor) return null
  const full = anchorChip(anchor, fileName)
  return (
    <details className="group inline-block max-w-full align-top" data-hook="anchor">
      <summary className="inline-flex max-w-full cursor-pointer list-none items-center gap-1 rounded-pill border border-ink/30 bg-surface px-2.5 py-0.5 text-[0.8125rem] font-semibold text-ink hover:border-ink/60 group-open:border-ink group-open:bg-ink group-open:text-white [&::-webkit-details-marker]:hidden">
        <svg viewBox="0 0 16 16" className="h-3 w-3 shrink-0" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 2h6l3 3v9H4z" />
          <path d="M10 2v3h3" />
        </svg>
        <span className="truncate" title={compact ? full : undefined}>
          {compact ? anchor.label || full : full}
        </span>
      </summary>
      <blockquote className="mt-2 max-w-[60ch] rounded-inner border-l-4 border-[#F8CB02] bg-surface px-3 py-2 text-small text-ink shadow-[0_1px_0_rgb(17_17_17/0.06)]">
        {compact && fileName && <span className="mb-1 block text-[0.8125rem] font-semibold">{full}</span>}
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
    <div className="rounded-inner border-2 border-dashed border-ink/30 bg-[#FFF4C2] px-3 py-2" data-hook="outside">
      <p className="text-[0.8125rem] font-bold uppercase tracking-[0.02em] text-ink">{t('bb.ses.outside')}</p>
      {children && <div className="mt-1 text-small text-ink">{children}</div>}
    </div>
  )
}

/**
 * The big filled button: black, or violet for the answer actions (check,
 * hand in). White text on both passes at any size; it stays 19px and bold
 * because it is the one thing on the screen to press. The old tone names
 * still work: "pink" is now black, "turquoise" violet. Disabled, it is
 * solid grey: see `[data-surface='bb'] .btn:disabled` in index.css.
 */
export function BigButton({ tone = 'ink', className = '', children, ...rest }) {
  const bg = tone === 'turquoise' || tone === 'violet' ? 'bg-[#6B4EFF]' : 'bg-ink'
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
  const cls = tone === 'error' ? 'border-negative/40 bg-[#FDECEE]' : tone === 'good' ? 'border-[#1E7B34]/40 bg-[#E4F5D9]' : 'border-ink/10 bg-[#F4F4F5]'
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

/** Text with [id] citations turned into chips, **bold** kept, lines kept. */
export function Rich({ text, byShort, files }) {
  const paras = String(text).split(/\n{2,}/)
  return paras.map((p, i) => {
    const lines = p.split('\n')
    const list = lines.every((l) => /^\s*[-*•]\s+/.test(l))
    const inline = (line, key) =>
      splitRich(line).map((part, j) => {
        const cite = citeOf(part)
        if (cite && byShort.has(cite)) {
          const a = byShort.get(cite)
          return (
            <span key={`${key}-${j}`} className="mx-0.5 inline-block align-baseline">
              <Anchor anchor={a} fileName={files.get(a.material_id)} />
            </span>
          )
        }
        if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={`${key}-${j}`}>{part.slice(2, -2)}</strong>
        return <Fragment key={`${key}-${j}`}>{part}</Fragment>
      })
    if (list) {
      return (
        <ul key={i} className="ml-5 list-disc space-y-1">
          {lines.map((l, k) => (
            <li key={k}>{inline(l.replace(/^\s*[-*•]\s+/, ''), `${i}-${k}`)}</li>
          ))}
        </ul>
      )
    }
    /* A div, not a p: a chip is a <details>, which a paragraph may not hold. */
    return (
      <div key={i}>
        {lines.map((l, k) => (
          <Fragment key={k}>
            {k > 0 && <br />}
            {inline(l, `${i}-${k}`)}
          </Fragment>
        ))}
      </div>
    )
  })
}

/**
 * The week's calibration line: "Sure and wrong 3 times this week in
 * Chapter 5, all on Osmosis / Diffusion. 4 times in all, across your
 * courses." The flag and the words carry it, never a colour.
 */
export function weekText(t, week) {
  const head =
    week.chapter && week.pair?.length === 2
      ? t('bb.calib.week_pair', { n: week.n, chapter: week.chapter, a: week.pair[0], b: week.pair[1] })
      : week.chapter
        ? t('bb.calib.week_in', { n: week.n, chapter: week.chapter })
        : t('bb.calib.week', { n: week.total })
  return week.chapter && week.total > week.n ? `${head} ${t('bb.calib.week_total', { n: week.total })}` : head
}
