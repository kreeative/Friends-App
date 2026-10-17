import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { BB_LOGO } from './logo'
import { useT } from '../lib/i18n'
import { anchorChip } from '../lib/bb/quality'
import { chipFor, examChip } from '../lib/bb/exams'
import { citeOf, splitRich } from '../lib/bb/cite'

/**
 * The few pieces every Hakkilo screen shares. Everything else comes from
 * the Rich & Friends kit (ui.jsx, StickerKit, the .lg cards). The app was
 * Beauty & Brain, then Nerd; its code, tables and API keep the bb name.
 *
 * COLOURS: BLACK AND WHITE AT REST, COLOUR WHEN SOMETHING HAPPENS. "Let's
 * keep the color for a specific event like when you select or click or
 * switch something in, and keep the regular color" (Kee). A screen nobody
 * has touched is white, grey and ink; a colour appears because the student
 * did something:
 *
 *   ink        #111111  text, primary buttons, bars. White on it 18.9:1.
 *   lilac      #CFC2FF  "a light purple": pressed, and where you are. Ink
 *                       on it 11.5:1.
 *   lilac soft #E6DFFF  what you picked: an option, a chip, a length.
 *   yellow     #F8CB02  the logo yellow: switched on, and the highlighter.
 *   green      #1E7B34  right, and only right, once the answer is checked.
 *
 * Black stays on white, the pastels and the yellow, never on a dark or
 * saturated ground. Colour is never the only signal: a tick, a word or an
 * icon always says the same thing.
 */
export const INK = '#111111'
export const LILAC = '#CFC2FF'
export const LILAC_SOFT = '#E6DFFF'
export const LOGO_YELLOW = '#F8CB02'
export const GREEN = '#1E7B34'

/**
 * A SMALL ACTION IS A PILL, NEVER AN UNDERLINED WORD.
 *
 * "J'aime pas trop quand les trucs sont soulignes. Ca peut etre en gras, ca
 * peut etre a l'interieur d'un petit rond ou d'un petit bouton" (Kee). Every
 * action that is not the page's big button: a pill with a hairline edge,
 * lilac while it is pressed like every press here, solid grey when it
 * cannot be pressed (#52525B on #E4E4E7). A link that ended a sentence
 * leaves the sentence and becomes one under it. PILL_ROUND is the same for
 * a cross alone; PILL_DANGER for what deletes.
 */
const PILL_SHAPE = 'press inline-flex min-h-[2.25rem] items-center justify-center gap-1.5 rounded-pill border bg-surface px-3.5 py-1 text-small font-semibold transition-colors active:bg-[#CFC2FF] disabled:border-transparent disabled:bg-[#E4E4E7] disabled:text-[#52525B]'
export const PILL = `${PILL_SHAPE} border-ink/15 text-ink hover:border-ink`
export const PILL_DANGER = `${PILL_SHAPE} border-negative/40 text-negative hover:border-negative`
export const PILL_ROUND = 'press inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-pill border border-ink/15 bg-surface text-body text-ink transition-colors hover:border-ink active:bg-[#CFC2FF] disabled:border-transparent disabled:bg-[#E4E4E7] disabled:text-[#52525B]'

/**
 * The wordmark, as artwork: "Hakkilo" in Crosner outlines, one path per
 * letter, bouncing like the Beauty & Brain and Nerd wordmarks before it.
 * Hakkilo is intelligence, the mind, wisdom, in Fulfulde. Kee chose the look
 * out of four: the logo yellow, outlined in ink, on a lilac tile ("le jaune
 * sur le noir j'aime pas, le violet pastel et le jaune est plus chill").
 * Yellow on lilac alone measures 1.06:1 and only its hue tells the two
 * apart; the ink line is what makes the letters readable, down to the 36px
 * top bar. It is drawn under the fill (paint-order), so half of it shows and
 * the letters keep their own width. Drawn small, the line is thicker in
 * letter units.
 * `tile="none"` draws the letters in ink, with no tile and no line.
 * `layout`: stacked and line are the word, mono is the "H" alone, for the
 * rail and the app icon, where seven letters would be too small to read.
 *
 * The margin follows the word's height more than its width: a seven-letter
 * word padded by its width floated in a tall lilac block, letters filling
 * under half of it.
 *
 * `square`: the tile is a square, the letters centred in it, with the
 * corners of the rail's rows (13px on 44). "Le logo a gauche est pas bien
 * dispose dans la grille" (Kee): the rail's H was a 44 by 51 tile, taller
 * than every row under it, with corners of its own; square, it is one more
 * 44px row of the same column.
 */
const OUTLINE = { stacked: 6, line: 8, mono: 8 }

export function BBLogo({ layout = 'stacked', tile = 'lilac', className = '', pad = 0.16, square = false, title }) {
  const art = BB_LOGO[layout] ?? BB_LOGO.stacked
  const p = Math.round(Math.max(art.w * 0.6, art.h) * pad)
  const side = Math.max(art.w, art.h) + p * 2
  const w = square ? side : art.w + p * 2
  const h = square ? side : art.h + p * 2
  const rx = Math.round(square ? (side * 13) / 44 : Math.min(w, h) * 0.14)
  const tiled = tile !== 'none'
  const label = title ?? 'Hakkilo'
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className={className} data-hook="bb-logo">
      {tiled && <rect width={w} height={h} rx={rx} fill={LILAC} />}
      <g
        transform={`translate(${(w - art.w) / 2} ${(h - art.h) / 2})`}
        fill={tiled ? LOGO_YELLOW : INK}
        {...(tiled ? { stroke: INK, strokeWidth: OUTLINE[layout] ?? 6, strokeLinejoin: 'round', paintOrder: 'stroke' } : {})}
      >
        {art.paths.map((path, i) => (
          <path key={i} d={path.d} fillRule={path.evenodd ? 'evenodd' : 'nonzero'} />
        ))}
      </g>
    </svg>
  )
}

/** "Intra", "Intra 2", "Final", or "Examen" for a course from before the midterm and the final. */
export function examName(t, exam) {
  if (exam?.kind === 'midterm') return exam.n ? t('bb.ex.midterm_n', { n: exam.n }) : t('bb.ex.midterm')
  return exam?.kind === 'final' ? t('bb.ex.final') : t('bb.ex.exam')
}

/**
 * "Intra dans 12 jours", with the word, never a colour alone: the course's
 * next exam by its name (src/lib/bb/exams.js), or one exam given as `exam`.
 * Within a week the line round it turns from grey to ink: a deadline is
 * not an event, so it gets weight rather than a colour.
 *
 * With `onEdit` the chip is the way to change the exam: "au lieu de mettre
 * cette grande phrase 'changer la date', quand on clique sur 'exam in 46'
 * on peut changer et enregistrer" (Kee). A pencil at its end says it opens,
 * lilac while it is pressed; its name says which exam it changes.
 *
 * With `link` (and the course), on a page that cannot edit it, Today or the
 * plan, it is the same chip as a link: the course page, that exam's form
 * already open (?examen=, read by src/bb/course/Exams.jsx). Not inside a
 * card that is itself a link: the courses list leaves it a label.
 */
export function ExamChip({ course, exam: one = null, onEdit = null, link = false, className = '', hook = 'exam-chip' }) {
  const { t } = useT()
  const { key, n, exam } = one ? chipFor(one) : examChip(course)
  const soon = n != null && n <= 7
  const text = exam ? t(key, { name: examName(t, exam), n }) : t(key)
  /* One line, always: beside a long course name at 390px it broke into
     "Exam in / 46 days" (Kee's screenshot of the plan). Where both do not
     fit, the row around it wraps the chip under the name instead. */
  const look = `inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill border bg-surface px-3 py-1 text-small font-semibold text-ink ${soon ? 'border-ink' : 'border-ink/15'} ${className}`
  const calendar = (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <rect x="2" y="3" width="12" height="11" rx="2" />
      <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
    </svg>
  )
  if (!onEdit && !(link && course?.id)) {
    return (
      <span data-hook={hook} className={look}>
        {calendar}
        {text}
      </span>
    )
  }
  const named = exam ? t('bb.ex.edit_named', { name: text }) : text
  const inside = (
    <>
      {calendar}
      {text}
      <svg viewBox="0 0 16 16" className="ml-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.6 2.9a1.6 1.6 0 0 1 2.3 2.3L5.6 12.5 2.5 13.4l.9-3.1z" />
        <path d="m9.4 4.1 2.3 2.3" />
      </svg>
    </>
  )
  const live = `${look} press min-h-[2.25rem] transition-colors hover:border-ink active:bg-[#CFC2FF]`
  if (!onEdit) {
    return (
      <Link to={`/hakkilo/cours/${course.id}${exam ? `?examen=${encodeURIComponent(exam.id)}` : ''}`} aria-label={named} title={named} data-hook={hook} className={live}>
        {inside}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onEdit} aria-label={named} title={named} data-hook={hook} className={live}>
      {inside}
    </button>
  )
}

/**
 * A bar with its number beside it, always (section 3: "on screen, always
 * show the number next to the bar"). The logo yellow on a grey track: "la
 * barre de progression, au lieu d'etre noir, ca peut etre colore" (Kee).
 * Painted side by side, lilac at 8% was a smudge and a lilac track made a
 * resting pastel; yellow is what Hakkilo keeps for switched on and the
 * highlighter, and progress is what you have lit up. Yellow on the track is
 * 1.3:1, which is enough here: the number says how much, the fill only
 * shows it.
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
        <div className="h-full rounded-pill" style={{ width: `${v}%`, background: LOGO_YELLOW }} />
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
      <summary className="inline-flex max-w-full cursor-pointer list-none items-center gap-1 rounded-pill border border-ink/30 bg-surface px-2.5 py-0.5 text-[0.8125rem] font-semibold text-ink hover:border-ink/60 group-open:border-ink group-open:bg-[#CFC2FF] [&::-webkit-details-marker]:hidden">
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
    <div className="rounded-inner border-2 border-dashed border-ink/30 bg-[#F4F4F5] px-3 py-2" data-hook="outside">
      <p className="text-[0.8125rem] font-bold uppercase tracking-[0.02em] text-ink">{t('bb.ses.outside')}</p>
      {children && <div className="mt-1 text-small text-ink">{children}</div>}
    </div>
  )
}

/**
 * The big filled button: black with white words at rest. Pressed it turns
 * lilac, disabled it is solid grey, and its words are 14px in a button that
 * kept its size: all three in `[data-surface='bb'] .btn` in index.css, so
 * every button in /hakkilo does the same.
 */
export function BigButton({ className = '', children, ...rest }) {
  /* px-4: 16px a side for 14px words, not the 24 of .btn. Full width on a
     phone the words get 32px more, and "Actualiser mon calendrier" holds
     one line at 320. Set here, on the element: a [data-surface='bb'] rule
     would outrank every px-* a caller sets. */
  return (
    <button {...rest} className={`btn press bg-ink px-4 font-bold text-white hover:opacity-90 ${className}`}>
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
