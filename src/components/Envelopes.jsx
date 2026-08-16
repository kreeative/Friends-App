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
 * How much of one envelope has gone, as an arc.
 *
 * Small on purpose. A ring the size of the ones a fitness app puts on its home
 * screen would be the loudest thing in a grid of six and would say the
 * proportion matters more than the amount, which is backwards here: the number
 * a person acts on is how many dollars are left, and the ring is the glance
 * that tells them which tile to read first.
 *
 * Drawn rather than pulled from a chart library. It is two circles and one
 * dash offset, and the app already refuses a dependency for less.
 *
 * The track is always drawn, even for an envelope nobody has funded. In a grid
 * the alternative is a hole where five neighbours have a mark, which reads as
 * something failing to load rather than as an envelope not in use.
 */
function Ring({ pct, over, dim, size = 34 }) {
  const stroke = 4
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
      <circle cx={mid} cy={mid} r={r} fill="none" strokeWidth={stroke} className="stroke-ink/[0.10]" />
      {!dim && (
        <circle
          cx={mid}
          cy={mid}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          /**
           * Ink, not accent, and it is not a style preference.
           *
           * The sea theme's accent is #FFD60A, which measures 1.41:1 against
           * this tile. WCAG 1.4.11 asks 3:1 of any graphic you need in order
           * to understand the screen, and this arc is the only thing on the
           * tile carrying the proportion, so it is squarely in scope. The
           * horizontal bar this replaced got away with the same yellow because
           * it was 8px of full-width fill; four pixels of arc is a much
           * thinner thing to find.
           *
           * Ink measures 7.00:1 in sea and 7.04:1 in sun. It is also what the
           * app already uses for spending: the tiles above draw their spent
           * sparkline in ink and keep accent for what is left. This ring is a
           * spent figure, so it follows that, rather than inventing a third
           * rule for the same quantity.
           */
          className={over ? 'stroke-negative' : 'stroke-ink'}
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
 * Each row underneath is one category's envelope: what went in, a bar showing
 * what has come out of it, and one line saying what that leaves. Two sentences,
 * not one with a sign: "50 $ restant" and "46 $ de plus" are different things
 * to be told and the second is red.
 *
 * The amounts are edited in place. A sheet per envelope would be six sheets to
 * get through on the one screen whose job is to be finished quickly, and the
 * number being typed is the number on the bar, so watching it move as you type
 * is the feedback.
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
      {/* --- the pool ---------------------------------------------------- */}
      <div className={`lg p-5 ${pool < 0 ? 'ring-1 ring-inset ring-negative/40' : ''}`}>
        <p className="eyebrow">{t('env.to_allocate')}</p>
        <p
          className={`mt-2 font-display text-metric leading-none [font-variant-numeric:tabular-nums] ${
            pool < 0 ? 'text-negative' : pool === 0 ? 'text-green' : 'text-ink'
          }`}
        >
          {fmt(pool)}
        </p>
        <p className="lede mt-2 max-w-[38ch]">
          {!s.earned
            ? t('env.no_income')
            : pool > 0
              ? t('env.pool_left', { total: fmt(s.earned) })
              : pool < 0
                ? t('env.pool_over', { over: fmt(Math.abs(pool)) })
                : t('env.pool_done')}
        </p>
        {s.earned > 0 && (
          <p className="mt-1 text-small text-muted [font-variant-numeric:tabular-nums]">
            {t('env.allocated_of', { allocated: fmt(totalAllocated(live)), total: fmt(s.earned) })}
          </p>
        )}
      </div>

      {/**
       * --- one tile per envelope ---------------------------------------
       *
       * A grid of panes rather than the divided list this used to be. Six rows
       * of full-width bar read as a settings screen: one thing after another,
       * each the same shape, nothing to compare without scanning down a
       * column. Six tiles read as six envelopes side by side, which is what
       * they are, and the ring in the corner of each one is comparable to its
       * neighbour at a glance in a way stacked bars are not.
       *
       * Two columns and no more, at every width. Three would fit a tablet and
       * would shrink the ring below the size at which a few degrees of arc is
       * a visible difference, which is the only thing the ring is for.
       */}
      <div className="grid grid-cols-2 gap-3">
        {rows.map((e) => {
          /* Empty rather than a zero when nothing has been put in: the
             placeholder already says 0, and a field pre-filled with 0.00 has to
             be cleared before it can be typed into. */
          const text = draft[e.key] ?? (e.allocated ? fromCents(e.allocated, digits) : '')
          const inUse = e.funded || e.spent > 0
          return (
            <div key={e.key} className="glass flex flex-col rounded-card p-4">
              {/* --- the ring and what it belongs to --- */}
              <div className="flex items-center gap-2.5">
                <Ring pct={e.pct} over={e.over > 0} dim={!inUse} />
                <span className="min-w-0 flex-1 truncate text-label font-semibold uppercase tracking-wide text-muted">
                  {t(`money.cat_${e.key}`)}
                </span>
              </div>

              {/**
               * The loud line, and the one the tile exists to say.
               *
               * "50 $ restant" and "46 $ de plus" are two different sentences,
               * not one number with a sign, so the second is red and says
               * "more" rather than showing a minus. An envelope nobody has
               * touched says so instead of claiming zero is left, which would
               * read as spent rather than as unused.
               */}
              {/* The whole sentence, once, for anything that reads rather
                  than looks. The two lines below are one statement split for
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

              <p
                aria-hidden="true"
                className={`mt-3 font-display leading-none [font-variant-numeric:tabular-nums] ${
                  /* A word, not a figure, so it is set as one. At the heading
                     size "Inutilisee" is as loud as the amounts it sits
                     between and claims the importance they have. */
                  !inUse ? 'text-body text-muted' : e.over > 0 ? 'text-h2 text-negative' : 'text-h2 text-ink'
                }`}
              >
                {!inUse ? t('env.unused') : fmt(e.over > 0 ? e.over : e.remaining)}
              </p>
              {inUse && (
                <p
                  aria-hidden="true"
                  className={`mt-1 text-label ${e.over > 0 ? 'font-semibold text-negative' : 'text-muted'}`}
                >
                  {e.over > 0 ? t('env.over_word') : t('env.remaining_word')}
                </p>
              )}

              {/**
               * The allocation, quiet at the bottom.
               *
               * mt-auto so the field sits on the floor of every tile in a row
               * regardless of how tall its neighbour's label wrapped, which is
               * what stops a grid of these from looking like a ransom note.
               *
               * Still typed in place, not behind a sheet: six sheets to get
               * through on the one screen whose job is to be finished quickly
               * is five too many, and the number being typed drives the ring
               * above it, so watching it move is the feedback.
               */}
              <div className="mt-auto border-t border-hairline pt-2.5">
                <label htmlFor={`env-${e.key}`} className="block text-label text-muted">
                  {t('env.allocated_short')}
                </label>
                <input
                  id={`env-${e.key}`}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  /* The same shape MoneyInput uses on the setup form, so the
                     two money fields on this screen do not disagree about
                     what an empty amount looks like. */
                  placeholder={digits === 0 ? '0' : `0.${'0'.repeat(digits)}`}
                  aria-label={t('env.allocate_to', { category: t(`money.cat_${e.key}`) })}
                  /**
                   * The full width of the tile, on its own line.
                   *
                   * This used to be sized in ch and sat beside its caption. Two
                   * things were wrong with that. A flex child with min-w-0
                   * shrinks below whatever width you set it, so the field
                   * quietly collapsed to a third of its content and clipped
                   * the number it was showing. And even sized correctly, a
                   * caption plus nine characters does not fit a 102px tile at
                   * 320px, so the row could only ever be made to fit by
                   * truncating one of the two.
                   *
                   * Full width and left-aligned has neither problem: the box is
                   * always as wide as there is, and if a value ever does run
                   * past it, it is the TRAILING digits that scroll out of view.
                   * Losing the end of a number people can still see the start
                   * of is recoverable; losing the front of it silently turns
                   * 1 200 000 into 00 000.
                   */
                  className="w-full border-0 bg-transparent p-0 text-left text-small font-semibold text-ink placeholder:text-muted/60 focus:outline-none [font-variant-numeric:tabular-nums]"
                  value={text}
                  onChange={(ev) => setDraft((d) => ({ ...d, [e.key]: ev.target.value }))}
                  onBlur={() => commit(e.key)}
                  onKeyDown={(ev) => ev.key === 'Enter' && ev.currentTarget.blur()}
                />
                {saving === e.key && <span className="text-label text-muted">…</span>}
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
