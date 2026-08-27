import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { money, moneyParts } from '../lib/money'
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
/**
 * One arc colour, six tracks.
 *
 * These were six steps of the category ramp. That ramp is pink to yellow now
 * and its yellow half cannot be an arc: #FFD600 is 1.41:1 on white. So every
 * gauge draws in --c-mark and keeps its own soft track, which is what still
 * tells the six cards apart at a glance; the card's name does the rest.
 */
const TONE = {
  food:      { well: 'bg-cat-1-soft' },
  transport: { well: 'bg-cat-2-soft' },
  home:      { well: 'bg-cat-3-soft' },
  fun:       { well: 'bg-cat-4-soft' },
  health:    { well: 'bg-cat-5-soft' },
  other:     { well: 'bg-cat-6-soft' },
}
/* The same pair the bento uses, so a category's ring is the same object in
   both places. The track cannot be the soft tint any more: the ramp ends in
   cream, and cream on a white card measured 1.06:1, which is a track nobody
   can see and a gauge that reads as a bare arc. */
const ARC = 'stroke-mark'
const TRACK = 'stroke-mark/25'

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
const FAMILY_INK = 'text-ink'

/**
 * An arc with something in the middle of it.
 *
 * `sweep` is the fraction of the circle the gauge occupies. At 1 it is a
 * closed ring; at 0.75 it is the open arch a calorie tracker draws, with the
 * gap centred at the bottom so the shape has a mouth rather than a seam.
 *
 * The open version reads as a DIAL: it has a beginning and an end, so a value
 * has somewhere to travel to. A closed ring has neither, which is why a full
 * circle at 99% and one at 1% look so alike at a glance.
 *
 * The rotation is derived, not typed. Starting the path half a gap past six
 * o'clock is what centres the opening at the bottom, and hard-coding 135deg
 * would silently be wrong the moment sweep changed.
 *
 * Thick, and that is the point: 7 to 14px depending on size, where the first
 * attempt drew 4px and read as a wireframe. A gauge is a shape, not a line.
 * Round caps at both ends, so the arc looks drawn rather than clipped.
 */
/* Exported so the bento dashboard can draw the same ring. Duplicating the arc
   arithmetic was the alternative, and two copies of a dasharray calculation is
   two things to keep in step for no gain. */
export function Gauge({ pct, size, stroke, arc, track, dim = false, sweep = 1, children }) {
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const span = circumference * sweep
  const mid = size / 2
  /* Half the missing wedge, past the bottom of the circle. */
  const rotation = 90 + (1 - sweep) * 180

  /* One dash of `span` followed by a gap longer than the path, so exactly the
     swept portion is painted and nothing wraps around to overlap it. */
  const dash = (fraction) => `${span * fraction} ${circumference}`

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
        <circle
          cx={mid}
          cy={mid}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className={track}
          strokeDasharray={dash(1)}
          transform={`rotate(${rotation} ${mid} ${mid})`}
        />
        {/* Nothing drawn at zero. A round cap on a zero-length dash still
            paints a dot, so an untouched envelope would show a bead sitting at
            the start of its own track and read as "barely spent" rather than
            "not spent". */}
        {!dim && pct > 0 && (
          <circle
            cx={mid}
            cy={mid}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            className={arc}
            strokeDasharray={dash(Math.min(100, Math.max(0, pct)) / 100)}
            transform={`rotate(${rotation} ${mid} ${mid})`}
            style={{ transition: 'stroke-dasharray 600ms cubic-bezier(0.22, 0.61, 0.36, 1)' }}
          />
        )}
      </svg>
      {children != null && (
        /* Inset to the stroke plus a hair, so a long value wraps inside the
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
  /* The dollars at full size, the cents tucked in beside them. Every
     reference for this screen writes a balance that way, and for a figure
     this large the cents are the part nobody reads. */
  const Amount = ({ cents, className = '', ...rest }) => {
    const a = moneyParts(cents, s.currency, locale)
    return (
      <span className={`[font-variant-numeric:tabular-nums] ${className}`} {...rest}>
        {a.head}
        {a.cents && <span className="text-[0.62em] align-baseline text-muted">{a.cents}</span>}
        {a.suffix}
      </span>
    )
  }

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
  /* How much of what came in has been given a job, capped so over-allocating
     fills the arch rather than drawing past its own end. The overshoot is
     carried by the colour and by the words, which is where a reader looks for
     it anyway. */
  const placedPct = s.earned > 0
    ? Math.min(100, Math.round((totalAllocated(live) / s.earned) * 100))
    : 0
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
      /* The migration name left the interface and did not leave the codebase:
         see the same note in Money.jsx. A person reading "not available yet"
         cannot act on a filename; the person who can is reading a console. */
      if (isMissingTable(failed)) console.warn('budget_allocation is missing: run supabase/37_budget_allocation.sql')
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
       * --- the pool ------------------------------------------------------
       *
       * A neutral card, not a colour block. The yellow version of this was the
       * app's own --c-field and it passed every contrast check, but a full
       * panel of #FFD60A is the loudest thing on any screen it lands on, and
       * the palette this is meant to sit in is pastels and neutrals. Slate
       * gives the arc somewhere quiet to be the brightest thing.
       *
       * The gauge is an arch rather than a ring: three quarters of a circle
       * with the gap at the bottom. A dial has a beginning and an end, so a
       * value has somewhere to travel to, where a closed ring at 99% and one
       * at 1% look alike at a glance.
       *
       * The percentage goes in the hole and the amount sits under it. That way
       * round because a percentage is four characters in every currency and an
       * amount is not, so the hole never has to be sized for the long case.
       */}
      <div data-card="pool" className="glass-card glass-card-quiet rounded-3xl p-6">
        <p className="text-label font-semibold uppercase tracking-wider text-muted">
          {t('env.to_allocate')}
        </p>

        <div className="mt-4 flex justify-center">
          <Gauge
            pct={placedPct}
            size={184}
            stroke={14}
            sweep={0.75}
            dim={!s.earned}
            arc={pool < 0 ? 'stroke-negative' : 'stroke-mark'}
            track={pool < 0 ? 'stroke-negative/15' : 'stroke-mark/20'}
          >
            <span
              className={`font-display text-h1 font-bold leading-none [font-variant-numeric:tabular-nums] ${
                pool < 0 ? 'text-negative' : 'text-cat-1'
              }`}
            >
              {s.earned ? `${placedPct} %` : '—'}
            </span>
            <span className="mt-1.5 text-label text-muted">{t('env.placed_word')}</span>
          </Gauge>
        </div>

        {/* The amount, then the sentence. Two lines where there used to be
            three, and the middle one no longer repeats the total the sentence
            under it already names. */}
        <p
          className={`mt-4 text-center font-display text-h2 font-bold leading-none [font-variant-numeric:tabular-nums] ${
            pool < 0 ? 'text-negative' : 'text-ink'
          }`}
        >
          <Amount cents={Math.abs(pool)} data-hook="pool-amount" />{' '}
          <span className="text-body font-semibold text-muted">
            {pool < 0 ? t('env.over_word') : t('env.to_place')}
          </span>
        </p>

        <p className="mx-auto mt-2.5 max-w-[34ch] text-center text-small leading-relaxed text-muted">
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
       * --- one card per envelope ---------------------------------------
       *
       * White, quiet, and the colour lives in the gauge. Two columns and no
       * more at every width: three would fit a tablet and would shrink the
       * gauge past the size at which a few degrees of arc is a visible
       * difference, which is the only thing a gauge is for.
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
              /**
               * The overspent card is tinted, not just its arc.
               *
               * The sun family is deep pinks now, and --c-negative measures
               * 1.07:1 against cat-4 and 1.14 against cat-5: in that theme an
               * over-budget arc is the same colour as an ordinary one, so an
               * arc alone cannot carry the one state worth interrupting
               * somebody for. The card's own ground can, at any hue.
               *
               * WCAG 1.4.1 wants the same thing for a different reason: colour
               * must not be the only signal. The word "de trop" was always
               * there; this makes the card legible as a group at a glance
               * rather than one row at a time.
               */
              className={`flex flex-col rounded-2xl border p-4 shadow-sm ${
                e.over > 0 ? 'border-negative/25 bg-negative/[0.06]' : 'glass-card'
              }`}
            >
              {/**
               * Gauge, then the name underneath it.
               *
               * Beside it is the nicer shape and it does not fit, which I have
               * now measured twice rather than guessed: "NOURRITURE" renders at
               * 86px, and a 46px arch plus its gap leaves 75px of a 390px card
               * and 40px of a 320px one. A single word has nowhere to wrap, so
               * inline did not truncate, it silently SPILLED over the card edge
               * into the gap beside it, which looks fine in a screenshot and is
               * broken everywhere the next word is longer.
               *
               * Underneath, the name has the whole card: 131px at 390 and 96px
               * at 320, against the 86 it wants. Costs one line of height and
               * cannot go wrong.
               */}
              {/* In a tinted well, like the bento's. The well is what tells the
                  six cards apart now that every arc is one colour, and it is
                  also what the track needs to be legible against. */}
              <span
                className={`flex h-[3.75rem] w-[3.75rem] shrink-0 items-center justify-center rounded-2xl ${
                  e.over > 0 ? 'bg-negative/[0.10]' : tone.well
                }`}
              >
                <Gauge
                  pct={e.pct}
                  size={46}
                  stroke={7}
                  sweep={0.75}
                  dim={!inUse}
                  arc={e.over > 0 ? 'stroke-negative' : ARC}
                  track={e.over > 0 ? 'stroke-negative/25' : TRACK}
                />
              </span>
              <span
                className={`mt-2.5 block text-label font-bold uppercase leading-tight tracking-wide ${
                  e.over > 0 ? 'text-negative' : FAMILY_INK
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

              {/* The loud line, and the one the card exists to say. The colour
                  sits on the paragraph in both branches, so the amount is the
                  same shape either way and anything reading the card finds it
                  in the same place. */}
              <p
                aria-hidden="true"
                className={`mt-2 font-display font-bold leading-none [font-variant-numeric:tabular-nums] ${
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
                     two money fields on this screen do not disagree about what
                     an empty amount looks like. */
                  placeholder={digits === 0 ? '0' : `0.${'0'.repeat(digits)}`}
                  aria-label={t('env.allocate_to', { category: t(`money.cat_${e.key}`) })}
                  /**
                   * It has to LOOK like a field.
                   *
                   * Borderless and transparent, it read as one more static
                   * amount on a card full of static amounts, except that it
                   * says "600.00" while everything around it says "600,00 $".
                   * That looks like a formatting bug rather than like the one
                   * thing on the card you can type into, and the raw number is
                   * correct here: it is what you edit, not what you read.
                   *
                   * A tinted well settles it. The odd formatting stops being
                   * an inconsistency and becomes the contents of an input.
                   */
                  className="mt-1 w-full rounded-lg border-0 bg-accent/10 px-2 py-1 text-left text-small font-semibold text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 [font-variant-numeric:tabular-nums]"
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

  /* The headline amount takes the same treatment as the pool card's: cents
     set smaller, so the dollars are what the eye lands on. Three parts, not
     two, because fr-CA puts the symbol after the decimals. */
  const a = moneyParts(bar.left, currency, locale)

  return (
    /**
     * THE HERO.
     *
     * One card carrying the only number the screen exists for, on a wash that
     * fades from white into the theme. The reference this came from puts the
     * heading, the figure and a small badge on one soft panel and lets
     * everything else be small underneath it, which is the right hierarchy
     * for a screen that answers a single question.
     *
     * One flat surface. It was a corner-to-corner gradient, pale pink through
     * white to pale yellow, and the argument for keeping it weak was that
     * every point of saturation on the card the headline sits on is a point of
     * contrast spent. Flat spends none of it, which is the same argument
     * arriving at its end.
     */
    /* Hooks, because this card has now lost .eyebrow, .lg and .lede in three
       separate restyles and took a test suite with it every time. */
    <div
      data-card="spendable"
      className="glass-card relative overflow-hidden rounded-3xl bg-surface p-6"
    >
      {/**
       * The badge rides the label's line, and it is pop pink rather than ink.
       *
       * Pinned to the bottom corner it landed within a few pixels of the end of
       * the note, which is the string most likely to grow: one longer
       * translation and the pill would sit on a sentence. Same fix the plan
       * form's hero already took.
       *
       * And a tint of the accent rather than a near-black slab, which is what
       * "bg-ink text-white" became when ink went to 30 24 27. Ink on the tint
       * measures far past 4.5:1, so the badge can be the theme's own colour
       * instead of the heaviest object on the card. The overspent badge keeps
       * its solid negative fill: that one is meant to interrupt.
       */}
      <div className="flex items-baseline justify-between gap-3">
        <p data-hook="label" className="text-label font-semibold uppercase tracking-wider text-muted">
          {t('env.left_to_spend')}
        </p>
        {bar.funded && (
          <span
            data-hook="pct"
            className={`shrink-0 rounded-pill px-3 py-1 text-label font-semibold [font-variant-numeric:tabular-nums] ${
              bar.over > 0 ? 'bg-negative text-white' : 'bg-accent/[0.35] text-ink'
            }`}
          >
            {bar.over > 0 ? t('env.bar_over_short') : `${bar.pct} %`}
          </span>
        )}
      </div>
      <p
        data-hook="amount"
        className={`mt-2 font-display text-hero leading-none [font-variant-numeric:tabular-nums] ${
          bar.left < 0 ? 'text-negative' : 'text-ink'
        }`}
      >
        {a.head}
        <span className="text-[0.62em] align-baseline text-muted">{a.cents}</span>
        {a.suffix}
      </p>

      <div className="mt-4 h-2.5 w-full overflow-hidden rounded-pill bg-ink/10">
        <div
          className={`h-full rounded-pill transition-[width] duration-500 ease-settle ${
            bar.over > 0 ? 'bg-negative' : 'bg-accent'
          }`}
          style={{ width: `${bar.funded ? bar.pct : 0}%` }}
        />
      </div>

      <p data-hook="note" className="mt-2.5 max-w-[26ch] text-small leading-relaxed text-muted">
        {!bar.funded
          ? t('env.no_income_bar')
          : bar.over > 0
            ? t('env.bar_over', { over: fmt(bar.over), earned: fmt(bar.earned) })
            : t('env.bar_of', { spent: fmt(bar.spent), earned: fmt(bar.earned) })}
      </p>
    </div>
  )
}
