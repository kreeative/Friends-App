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
 * One SHADE per envelope, from the theme's own family.
 *
 * This was a rainbow: rose, sky, emerald, violet, amber, slate, one unrelated
 * hue each. Six hues with nothing to do with the theme, or with one another,
 * is decoration rather than a scale, and next to a palette as deliberate as
 * the rest of this app it read as noise. Now the six are six lightnesses of a
 * single family, and the family follows the theme, so the money screen belongs
 * to whichever one is painting the way every other screen does.
 *
 * THE PALE PARTNER IS THE POINT, NOT A LEFTOVER.
 *
 * Each ring draws its unspent part in `-soft`, the same hue up at 92%
 * lightness. That is what makes a ring read as two shades of one colour rather
 * than a colour and a grey, and it is the thing that was missing when the
 * track was a flat slate tint under six different arcs.
 *
 * Where the ramp stops is set by the gauge, not by taste: every one of these
 * is an arc, so every one needs 3:1 on the white card. See the note beside the
 * values in index.css.
 *
 * Whole class strings because Tailwind scans source text. A template like
 * `stroke-cat-${n}` produces nothing at build time.
 */
const TONE = {
  food:      { arc: 'stroke-cat-1', track: 'stroke-cat-1-soft' },
  transport: { arc: 'stroke-cat-2', track: 'stroke-cat-2-soft' },
  home:      { arc: 'stroke-cat-3', track: 'stroke-cat-3-soft' },
  fun:       { arc: 'stroke-cat-4', track: 'stroke-cat-4-soft' },
  health:    { arc: 'stroke-cat-5', track: 'stroke-cat-5-soft' },
  other:     { arc: 'stroke-cat-6', track: 'stroke-cat-6-soft' },
}

/**
 * The family colour for TEXT on a card, and why it is one value and not six.
 *
 * A shade ramp differentiates by lightness. Text contrast also constrains
 * lightness, and the two pull against each other: measured on white, cat-6 is
 * 3.87:1 in sun, and cat-5 and cat-6 are 4.37 and 3.58 in sea, all under the
 * 4.5 small text needs even though every one of them clears the 3:1 an arc
 * needs. So the lighter half of the ramp can be an arc and cannot be a word.
 *
 * Which means the differentiation has to live in the arc, where there is room
 * for it, and the words take the darkest step of the family: 13.90:1 in sun,
 * 10.76:1 in sea, safe at any size. Everything still belongs to the theme's
 * palette, which is the point; only the arc carries which envelope it is.
 */
const FAMILY_INK = 'text-cat-1'

/**
 * A ring with something in the middle of it.
 *
 * Thick, and that is the point of this version: 6 to 18px of stroke depending
 * on the size, where the first attempt drew 4px and read as a wireframe. A
 * gauge is a shape, not a line.
 *
 * The hole is not decoration either. Putting the figure inside the ring is
 * what makes the two one object instead of a chart with a caption underneath,
 * and it is the single thing every reference for this screen has in common.
 *
 * Drawn rather than pulled from a chart library. It is two circles and a dash
 * offset, and the app already refuses a dependency for less.
 */
function Gauge({ pct, size, stroke, arc, track, dim = false, children }) {
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const mid = size / 2

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        /* Decorative: whatever sits in the hole says the same thing in words,
           and a screen reader hitting both would read the card twice. */
        aria-hidden="true"
        focusable="false"
      >
        <circle cx={mid} cy={mid} r={r} fill="none" strokeWidth={stroke} className={track} />
        {!dim && (
          <circle
            cx={mid}
            cy={mid}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            className={arc}
            strokeDasharray={circumference}
            /* Clockwise from twelve o'clock, which is where an arc meaning
               "how far through" is read from. */
            strokeDashoffset={circumference - (circumference * Math.min(100, Math.max(0, pct))) / 100}
            transform={`rotate(-90 ${mid} ${mid})`}
            style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.22, 0.61, 0.36, 1)' }}
          />
        )}
      </svg>
      {children != null && (
        /* inset to the stroke plus a hair, so a long amount wraps inside the
           hole rather than running under the arc. */
        <div
          className="absolute flex flex-col items-center justify-center text-center"
          style={{ inset: stroke + 4 }}
        >
          {children}
        </div>
      )}
    </div>
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
       * --- the pool, and the one loud thing on the page ----------------
       *
       * A big gauge with the figure inside it, on the app's own golden block.
       * --c-field is #FFD60A in BOTH themes and --c-on-field is the text
       * colour designed to sit on it, 5.60:1 in sun and 6.82:1 in sea, so this
       * is the one large colour block the palette already sanctions rather
       * than a lime borrowed from a fitness app that would fight both themes.
       *
       * The figure goes IN the ring rather than beside it. That is what makes
       * the two read as one object instead of a chart with a caption, and it
       * is the single thing every reference for this screen has in common.
       *
       * It also used to be four stacked lines, two of which named the same
       * total: "Encore a placer, sur les 3 000,00 $ rentres" with "1 830,00 $
       * places sur 3 000,00 $" directly beneath it. The ring is now the second
       * of those, so the card says each thing once.
       */}
      {/* NO OPACITY ON ANY TEXT HERE. Softening secondary lines with opacity is
          how the references get their hierarchy, and on a surface this
          saturated it costs too much: the eyebrow at 70% measured 3.72:1 and
          the sentence at 80% measured 4.40:1, both under the 4.5 body text
          needs. Full --c-on-field is 5.60:1 in sun and 6.82:1 in sea, and size
          and weight carry the hierarchy on their own. */}
      <div
        /* A stable hook for anything that needs to find this card. The class
           list is styling and has already changed three times; a test keyed to
           it breaks on every restyle and says nothing about the app. */
        data-card="pool"
        className="overflow-hidden rounded-[2rem] bg-field px-6 py-7 text-on-field shadow-sm"
      >
        <p className="text-label font-semibold uppercase tracking-wider">
          {t('env.to_allocate')}
        </p>

        <div className="mt-4 flex justify-center">
          <Gauge
            pct={s.earned > 0 ? Math.round((Math.min(totalAllocated(live), s.earned) / s.earned) * 100) : 0}
            size={156}
            stroke={15}
            dim={!s.earned}
            /* currentColor both, so the gauge follows --c-on-field into
               whichever theme is painting and never needs a second value. */
            arc="stroke-current"
            track="stroke-current opacity-20"
          >
            <span
              className={`font-display text-h2 font-bold leading-tight [font-variant-numeric:tabular-nums] ${
                pool < 0 ? 'text-rose-700' : ''
              }`}
            >
              {fmt(pool)}
            </span>
            <span className="mt-1 text-label">
              {pool < 0 ? t('env.over_word') : t('env.to_place')}
            </span>
          </Gauge>
        </div>

        {/* One sentence, and a pill for the running total. The pill is the
            shape the references use for a secondary fact on a colour block:
            it survives the busy background where loose small text does not. */}
        <p className="mt-5 text-center text-small leading-relaxed">
          {!s.earned
            ? t('env.no_income')
            : pool > 0
              ? t('env.pool_left', { total: fmt(s.earned) })
              : pool < 0
                ? t('env.pool_over', { over: fmt(Math.abs(pool)) })
                : t('env.pool_done')}
        </p>

        {s.earned > 0 && (
          <p className="mt-4 flex justify-center">
            <span className="rounded-pill bg-on-field/10 px-3.5 py-1.5 text-label font-semibold [font-variant-numeric:tabular-nums]">
              {t('env.allocated_of', {
                allocated: fmt(Math.min(totalAllocated(live), s.earned)),
                total: fmt(s.earned),
              })}
            </span>
          </p>
        )}
      </div>

      {/**
       * --- one card per envelope ---------------------------------------
       *
       * Quiet surfaces, colour in the gauges. Six tinted cards behind six
       * saturated arcs was two colour systems doing one job, and every
       * reference for this screen keeps its cards white and spends the colour
       * on the rings.
       *
       * Two columns and no more, at every width. Three would fit a tablet and
       * would shrink the gauge past the size at which a few degrees of arc is
       * a visible difference, which is the only thing a gauge is for.
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
              data-envelope={e.key}
              className={`flex flex-col rounded-[1.75rem] border bg-white/90 p-4 shadow-sm ${
                e.over > 0 ? 'border-rose-200' : 'border-slate-200/70'
              }`}
            >
              {/* The percentage lives in the hole, not the amount: "100 %" is
                  four characters in every currency on earth, where "1 200,00
                  $" is not, and a hole sized for the long case is a hole with
                  nothing in it the rest of the time. */}
              <Gauge
                pct={e.pct}
                size={62}
                stroke={7}
                dim={!inUse}
                arc={e.over > 0 ? 'stroke-rose-600' : tone.arc}
                track={e.over > 0 ? 'stroke-rose-100' : tone.track}
              >
                {inUse && (
                  /* The family's dark step, not this card's own. See
                     FAMILY_INK: the lighter half of the ramp is legal as an arc
                     and illegal as a word. Overspent overrides either way,
                     because that is a state rather than an identity. */
                  <span
                    className={`text-label font-bold leading-none [font-variant-numeric:tabular-nums] ${
                      e.over > 0 ? 'text-rose-700' : FAMILY_INK
                    }`}
                  >
                    {e.pct}%
                  </span>
                )}
              </Gauge>

              <span
                className={`mt-3 block truncate text-label font-semibold uppercase tracking-wider ${
                  e.over > 0 ? 'text-rose-700' : FAMILY_INK
                }`}
              >
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
               * Overspent is rose and says "de trop"; the badge is gone now
               * that the card behind it is white, because a coloured pill on a
               * coloured card was the thing making this look busy. The colour
               * sits on the paragraph in both branches, so the amount line is
               * the same shape either way and anything reading the card finds
               * it in the same place.
               */}
              <p
                aria-hidden="true"
                className={`mt-1 font-display font-bold leading-none [font-variant-numeric:tabular-nums] ${
                  !inUse ? 'text-body text-slate-400' : e.over > 0 ? 'text-h2 text-rose-600' : 'text-h2 text-slate-800'
                }`}
              >
                {!inUse ? t('env.unused') : fmt(e.over > 0 ? e.over : e.remaining)}
              </p>
              {inUse && (
                <p
                  aria-hidden="true"
                  className={`mt-1 text-label ${e.over > 0 ? 'font-semibold text-rose-600' : 'text-slate-500'}`}
                >
                  {e.over > 0 ? t('env.over_word') : t('env.remaining_word')}
                </p>
              )}

              {/**
               * The allocation, quiet at the bottom.
               *
               * mt-auto so the field sits on the floor of every card in a row
               * regardless of how tall its neighbour ran, which is what stops a
               * grid of these from looking like a ransom note.
               *
               * Caption OVER field, not beside it. A two-column row is the
               * tidier shape and does not fit: the card interior is 96px at
               * 320px and "Attribue" is 55 of them, so a gap and a six-figure
               * amount want 111. The field is the flexible one, so the field
               * collapses, and right-aligned digits collapse by scrolling the
               * FRONT of the number away. That is how 1 200 000 comes to read
               * as 00 000 with nothing on screen to say so.
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
