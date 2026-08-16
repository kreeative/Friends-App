import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { money } from '../lib/money'
import { minorDigits } from '../lib/currency'
import { fromCents, localISO, toCents } from '../lib/txn'
import { errorText } from '../lib/dberr'
/* isMissingTable lives with the mood store, which needed the same check first.
   Shared rather than copied: two spellings of "this table is not installed"
   is one spelling too many. */
import { isMissingTable } from '../lib/moodStore'
import { allocationsFor, envelopes, toAllocate, totalAllocated } from '../lib/envelope'

/**
 * One hue per envelope, and why these particular values.
 *
 * The screen was a wall of one colour. Not by accident: this app's ink is
 * #A91C54 in the sun theme, a deep magenta, so a tile whose title, amount,
 * qualifier and field are all "ink" is four pinks stacked, and six of those
 * tiles is a page with no variety in it at all. Colour per category fixes that
 * at the root instead of dimming things until the sameness stops showing.
 *
 * THE RING SHADE IS NOT THE PASTEL, AND THAT IS DELIBERATE.
 *
 * A pastel gauge is an invisible gauge. Measured against this card, rose-500
 * is 3.67:1 but sky-500 is 2.77, emerald-500 2.54, amber-500 2.15 and
 * slate-400 2.56, all under the 3:1 that WCAG 1.4.11 asks of a graphic you
 * need in order to read the screen, and this arc is the only thing carrying
 * the proportion. The 600s clear it across the board: 4.70, 4.10, 3.77, 5.70,
 * 3.19, 4.76 on white, and never below 3.07 on their own wash.
 *
 * So the pastel is the surface and the track, and the arc on top of it is
 * saturated. That is what makes the card read as soft and the gauge as legible
 * at the same time, rather than trading one for the other.
 *
 * Fixed values rather than theme variables, like `green` and `negative`
 * already are in this palette: which colour means "transport" is a fact about
 * the category, not a matter of taste, and having it turn from blue to
 * something else when somebody switches theme would break the one thing the
 * colours are for.
 *
 * Written out as whole class strings because Tailwind scans source text. A
 * template like `stroke-${hue}-600` produces nothing at build time.
 */
const TONE = {
  food:      { arc: 'stroke-rose-600',    track: 'stroke-rose-100',    card: 'bg-rose-50/70 border-rose-100' },
  transport: { arc: 'stroke-sky-600',     track: 'stroke-sky-100',     card: 'bg-sky-50/70 border-sky-100' },
  home:      { arc: 'stroke-emerald-600', track: 'stroke-emerald-100', card: 'bg-emerald-50/70 border-emerald-100' },
  fun:       { arc: 'stroke-violet-600',  track: 'stroke-violet-100',  card: 'bg-violet-50/70 border-violet-100' },
  health:    { arc: 'stroke-amber-600',   track: 'stroke-amber-100',   card: 'bg-amber-50/70 border-amber-100' },
  other:     { arc: 'stroke-slate-500',   track: 'stroke-slate-200',   card: 'bg-slate-50/70 border-slate-200' },
}

/**
 * How much of one envelope has gone, as an arc.
 *
 * Thick rather than hairline: at 6px on a 44px circle the arc is a shape you
 * read at a glance, where the 4px version of this read as a wireframe. The
 * track underneath is always drawn, in the category's own pale tint, so the
 * unspent portion is a visible part of the ring instead of a gap in it.
 *
 * Drawn rather than pulled from a chart library. It is two circles and one
 * dash offset, and the app already refuses a dependency for less.
 */
function Ring({ pct, tone, over, dim, size = 44 }) {
  const stroke = 6
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const mid = size / 2

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      /* Decorative: the number beside it says the same thing in words, and a
         screen reader hitting both would read the tile twice. */
      aria-hidden="true"
      focusable="false"
    >
      <circle cx={mid} cy={mid} r={r} fill="none" strokeWidth={stroke} className={over ? 'stroke-rose-100' : tone.track} />
      {!dim && (
        <circle
          cx={mid}
          cy={mid}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          /* Overspent takes the rose regardless of the category's own hue, so
             the one state worth interrupting somebody for looks the same
             wherever it happens. rose-700 is 6.29:1 here. */
          className={over ? 'stroke-rose-700' : tone.arc}
          strokeDasharray={circumference}
          /* Anti-clockwise from twelve o'clock, which is where an arc that
             means "how far through" is read from. */
          strokeDashoffset={circumference - (circumference * Math.min(100, Math.max(0, pct))) / 100}
          transform={`rotate(-90 ${mid} ${mid})`}
          style={{ transition: 'stroke-dashoffset 500ms cubic-bezier(0.22, 0.61, 0.36, 1)' }}
        />
      )}
    </svg>
  )
}

/**
 * Every dollar that arrived, given a job.
 *
 * The pool at the top is income that has actually been LOGGED, less whatever
 * has been handed out. The screen's whole ask is that it reaches zero, so it is
 * the loudest thing here and it is allowed to go negative: handing out more
 * than arrived is the mistake this model exists to catch, and a pool that
 * stopped at zero would say the job was finished.
 *
 * Each card underneath is one category's envelope: a gauge in the category's
 * own colour, what that leaves, and the amount that went in. Two sentences, not
 * one with a sign: "50 $ restant" and "46 $ de trop" are different things to be
 * told, and only the second gets the rose badge.
 *
 * The amounts are edited in place. A sheet per envelope would be six sheets to
 * get through on the one screen whose job is to be finished quickly, and the
 * number being typed is the number driving the gauge, so watching it move as
 * you type is the feedback.
 */
export default function Envelopes({ s, allocations, locale, onChange }) {
  const { user } = useAuth()
  const { t } = useT()
  const fmt = (c) => money(c, s.currency, locale)

  /* How many decimals this currency actually has. The CFA francs have none, so
     a hard-coded two would print "20000.00" in a field where every other money
     input on the screen prints "20000". */
  const digits = minorDigits(s.currency)

  const periodStart = localISO(s.period.start)

  /* What is in each box while it is being typed, keyed by category. A field
     holds a string because "12," is a thing somebody is halfway through
     writing and is not a number yet. */
  const [draft, setDraft] = useState({})
  const [saving, setSaving] = useState(null)
  const [error, setError] = useState(null)

  /* Cleared when the period turns over, so September never opens with August's
     half-typed figure sitting in a field. */
  useEffect(() => {
    setDraft({})
    setError(null)
  }, [periodStart])

  /** The live picture: saved allocations, overridden by anything being typed. */
  const live = useMemo(() => {
    const out = { ...allocations }
    for (const [key, text] of Object.entries(draft)) {
      const c = toCents(text)
      out[key] = c === null ? 0 : Math.max(0, c)
    }
    return out
  }, [allocations, draft])

  const pool = toAllocate({ earned: s.earned, allocations: live })
  const rows = envelopes({
    allocations: live,
    spentByCategory: Object.fromEntries(s.byCategory.map((c) => [c.key, c.cents])),
  })

  async function commit(category) {
    const text = draft[category]
    if (text === undefined) return
    const c = toCents(text)
    const amount = c === null ? 0 : Math.max(0, c)

    setSaving(category)
    setError(null)

    const { error: failed } = await supabase.from('budget_allocation').upsert(
      {
        user_id: user.id,
        period_start: periodStart,
        category,
        amount_cents: amount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,period_start,category' },
    )

    setSaving(null)
    if (failed) {
      /* Naming the migration is the difference between somebody fixing this in
         a minute and filing a bug. */
      setError(isMissingTable(failed) ? t('env.unavailable') : errorText(failed))
      return
    }
    /* The typed value is dropped only once the row is saved, so the field never
       flickers back to the old number between the write and the reload. */
    setDraft((d) => {
      const { [category]: _gone, ...rest } = d
      return rest
    })
    await onChange?.()
  }

  return (
    <div className="space-y-3">
      {/**
       * --- the pool -----------------------------------------------------
       *
       * Three things, in order of how much they matter: the figure, how far
       * through placing it you are, and one sentence of context.
       *
       * It used to be four, and two of them were the same fact. Under the
       * number sat "Encore a placer, sur les 3 000,00 $ rentres" and directly
       * under that "1 830,00 $ places sur 3 000,00 $" -- two lines naming the
       * same total, touching, both in prose. The second is now the bar, which
       * says the proportion faster than either sentence did and leaves the one
       * remaining line room to breathe.
       */}
      <div
        className={`rounded-3xl border p-6 shadow-sm ${
          pool < 0 ? 'border-rose-200 bg-rose-50/70' : 'border-slate-200/80 bg-white/80'
        }`}
      >
        <p className="text-label font-semibold uppercase tracking-wider text-slate-500">
          {t('env.to_allocate')}
        </p>
        <p
          className={`mt-2 font-display text-metric font-bold leading-none [font-variant-numeric:tabular-nums] ${
            pool < 0 ? 'text-rose-700' : pool === 0 ? 'text-emerald-700' : 'text-slate-800'
          }`}
        >
          {fmt(pool)}
        </p>

        {/* Only once there is something to be a proportion OF. A track at zero
            under a zero would be two ways of saying nothing has happened. */}
        {s.earned > 0 && (
          <div
            className="mt-4 h-2 w-full overflow-hidden rounded-pill bg-slate-200/70"
            role="img"
            aria-label={t('env.allocated_of', {
              allocated: fmt(Math.min(totalAllocated(live), s.earned)),
              total: fmt(s.earned),
            })}
          >
            <div
              className={`h-full rounded-pill transition-[width] duration-500 ease-settle ${
                pool < 0 ? 'bg-rose-600' : 'bg-emerald-600'
              }`}
              style={{
                width: `${Math.min(100, Math.round((totalAllocated(live) / s.earned) * 100))}%`,
              }}
            />
          </div>
        )}

        <p className="mt-3 max-w-[38ch] text-small leading-relaxed text-slate-500">
          {!s.earned
            ? t('env.no_income')
            : pool > 0
              ? t('env.pool_left', { total: fmt(s.earned) })
              : pool < 0
                ? t('env.pool_over', { over: fmt(Math.abs(pool)) })
                : t('env.pool_done')}
        </p>
      </div>

      {/**
       * --- one tile per envelope ---------------------------------------
       *
       * A grid of cards rather than the divided list this used to be. Six rows
       * of full-width bar read as a settings screen: one thing after another,
       * all the same shape, nothing comparable without scanning down a column.
       * Six cards read as six envelopes side by side, which is what they are.
       *
       * Two columns and no more, at every width. Three would fit a tablet and
       * would shrink the ring past the size at which a few degrees of arc is a
       * visible difference, which is the only thing the ring is for.
       */}
      <div className="grid grid-cols-2 gap-3">
        {rows.map((e) => {
          /* Empty rather than a zero when nothing has been put in: the
             placeholder already says 0, and a field pre-filled with 0.00 has to
             be cleared before it can be typed into. */
          const text = draft[e.key] ?? (e.allocated ? fromCents(e.allocated, digits) : '')
          const inUse = e.funded || e.spent > 0
          const tone = TONE[e.key] ?? TONE.other
          return (
            <div
              key={e.key}
              className={`flex flex-col rounded-3xl border p-4 shadow-sm ${
                e.over > 0 ? 'border-rose-200 bg-rose-50/70' : tone.card
              }`}
            >
              {/**
               * --- the ring, and under it what it belongs to ---
               *
               * Stacked, not side by side. Inline is the nicer shape and it
               * does not survive the content: a 44px ring plus a gap leaves
               * 83px of a 390px card for the label and 52px of a 320px one,
               * and "NOURRITURE" needs about 85. Every category name was
               * arriving as "NOURRIT..." on the wide layout and worse on the
               * narrow one, which is the one word on the card a person cannot
               * infer from anything else on it.
               *
               * Full width beneath the ring, the longest name fits at every
               * size this app supports, with no truncation and no wrap.
               */}
              <Ring pct={e.pct} tone={tone} over={e.over > 0} dim={!inUse} />
              <span className="mt-2.5 block truncate text-label font-semibold uppercase tracking-wider text-slate-500">
                {t(`money.cat_${e.key}`)}
              </span>

              {/* The whole sentence, once, for anything that reads rather than
                  looks. The lines below are one statement split for
                  typographic reasons, and a screen reader handed them as
                  written would announce a bare number and then a bare word. */}
              <p className="sr-only">
                {!inUse
                  ? t('env.unused')
                  : e.over > 0
                    ? t('env.over_by', { amount: fmt(e.over) })
                    : t('env.remaining', { amount: fmt(e.remaining) })}
                {inUse ? ` ${t('env.spent_of', { spent: fmt(e.spent) })}` : ''}
              </p>

              {/**
               * The loud line, and the one the card exists to say.
               *
               * Overspent is a rose badge rather than red type. Red text at
               * this size is the card shouting at somebody about forty-six
               * dollars; a small pill says the same thing once, in one place,
               * and lets the number stay the same weight as its neighbours so
               * the grid still scans as a grid.
               */}
              {!inUse ? (
                <p aria-hidden="true" className="mt-3 text-body text-slate-400">
                  {t('env.unused')}
                </p>
              ) : e.over > 0 ? (
                <>
                  {/* The colour sits on the paragraph and the pill inherits it,
                      so the amount line is the same shape in both branches:
                      one aria-hidden <p> carrying the state's colour, then one
                      carrying its word. Anything reading the card, a test
                      included, finds them in the same place either way. */}
                  <p aria-hidden="true" className="mt-3 text-rose-700">
                    <span className="inline-block rounded-pill bg-rose-100/80 px-2.5 py-1 font-display text-h2 font-bold leading-none [font-variant-numeric:tabular-nums]">
                      {fmt(e.over)}
                    </span>
                  </p>
                  <p aria-hidden="true" className="mt-1.5 text-label font-semibold text-rose-700">
                    {t('env.over_word')}
                  </p>
                </>
              ) : (
                <>
                  <p
                    aria-hidden="true"
                    className="mt-3 font-display text-h2 font-bold leading-none text-slate-800 [font-variant-numeric:tabular-nums]"
                  >
                    {fmt(e.remaining)}
                  </p>
                  <p aria-hidden="true" className="mt-1 text-label text-slate-500">
                    {t('env.remaining_word')}
                  </p>
                </>
              )}

              {/**
               * The allocation, quiet at the bottom.
               *
               * mt-auto so the field sits on the floor of every card in a row
               * regardless of how tall its neighbour ran, which is what stops a
               * grid of these from looking like a ransom note.
               *
               * Still typed in place, not behind a sheet: six sheets to get
               * through on the one screen whose job is to be finished quickly
               * is five too many, and the number being typed drives the ring
               * above it, so watching it move is the feedback.
               */}
              {/**
               * Caption over field, not caption beside field.
               *
               * A two-column row is the tidier shape and it does not fit the
               * narrow end of this app. The card interior is 96px at 320px,
               * and "Attribue" is 55 of them; add a gap and a six-figure
               * amount at 48 and the row wants 111. The field is the flexible
               * one, so it is the field that collapses, down to 33px, and
               * right-aligned digits collapse by scrolling the FRONT of the
               * number out of sight. That is how 1 200 000 comes to read as
               * 00 000 with nothing on screen to say so.
               *
               * Stacked, the field gets the full width at every size and the
               * caption is never truncated. It costs one line of height.
               */}
              <div className="mt-auto border-t border-slate-200/70 pt-2.5">
                <label htmlFor={`env-${e.key}`} className="block text-label text-slate-500">
                  {t('env.allocated_short')}
                </label>
                <input
                  id={`env-${e.key}`}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  /* The same shape MoneyInput uses on the setup form, so the
                     two money fields on this screen do not disagree about what
                     an empty amount looks like. */
                  placeholder={digits === 0 ? '0' : `0.${'0'.repeat(digits)}`}
                  aria-label={t('env.allocate_to', { category: t(`money.cat_${e.key}`) })}
                  /**
                   * min-w-0 with flex-1, never a width in ch.
                   *
                   * A flex child shrinks below whatever width you set it, so
                   * the ch version of this quietly collapsed to a third of its
                   * content and clipped the number it was showing. Taking the
                   * rest of the row instead means the box is always as wide as
                   * there is, and text-right keeps the digits against the card
                   * edge where the eye already is for the amount above.
                   */
                  className="mt-0.5 w-full border-0 bg-transparent p-0 text-left text-small font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none [font-variant-numeric:tabular-nums]"
                  value={text}
                  onChange={(ev) => setDraft((d) => ({ ...d, [e.key]: ev.target.value }))}
                  onBlur={() => commit(e.key)}
                  onKeyDown={(ev) => ev.key === 'Enter' && ev.currentTarget.blur()}
                />
                {saving === e.key && <span className="text-label text-slate-400">…</span>}
              </div>
            </div>
          )
        })}
      </div>

      {error && (
        <p className="break-words px-1 text-small text-negative" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * The one bar at the top of the screen: what is left of real income.
 *
 * Income minus SPENDING, never minus allocations. Allocating is a plan for
 * money you still have, and a dollar sitting in the rent envelope is still in
 * the account until the rent goes out. A bar that emptied as you allocated
 * would tell somebody they had spent their month by deciding what it was for.
 */
export function SpendableBar({ bar, currency, locale }) {
  const { t } = useT()
  const fmt = (c) => money(c, currency, locale)

  return (
    <div className="lg p-5">
      <p className="eyebrow">{t('env.left_to_spend')}</p>
      <p
        className={`mt-2 font-display text-hero leading-none [font-variant-numeric:tabular-nums] ${
          bar.left < 0 ? 'text-negative' : 'text-ink'
        }`}
      >
        {fmt(bar.left)}
      </p>

      <div className="mt-4 h-2.5 w-full overflow-hidden rounded-pill bg-ink/[0.07]">
        <div
          className={`h-full rounded-pill transition-[width] duration-500 ease-settle ${
            bar.over > 0 ? 'bg-negative' : 'bg-accent'
          }`}
          style={{ width: `${bar.funded ? bar.pct : 0}%` }}
        />
      </div>

      <p className="lede mt-2 max-w-[38ch]">
        {!bar.funded
          ? t('env.no_income_bar')
          : bar.over > 0
            ? t('env.bar_over', { over: fmt(bar.over), earned: fmt(bar.earned) })
            : t('env.bar_of', { spent: fmt(bar.spent), earned: fmt(bar.earned) })}
      </p>
    </div>
  )
}
