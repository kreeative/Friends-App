import { useT } from '../lib/i18n'
import { money } from '../lib/money'
import { envelopes } from '../lib/envelope'
import { Gauge } from './Envelopes'

/**
 * The six categories, as a bento grid of cards rather than a list.
 *
 * This is the budget's front page now: what each part of the month is for,
 * how far through it you are, and what is left, six times, at a glance.
 *
 * READ ONLY, DELIBERATELY.
 *
 * The envelopes pane already lets you type an allocation into every card, and
 * putting the same six fields on the dashboard would mean the first thing the
 * budget shows you is a form. A dashboard is something you look at. Each card
 * is a button that opens the envelopes pane, so the way to change a number is
 * one tap from the number itself, which is the only thing the field on the
 * dashboard was buying.
 *
 * The colours are in the note on TONE below.
 */
/**
 * Six tints, one arc colour.
 *
 * The arcs used to be six steps of the category ramp. That ramp is pink to
 * yellow now and its yellow half cannot carry an arc: #FFD600 is 1.41:1 on
 * white. So the ring is always --c-mark, the well is the category's own tint,
 * and the card's own name is what actually says which category it is.
 *
 * The track is the mark at low alpha rather than the well's tint, for the
 * reason it always was: giving both the same colour paints the unspent part of
 * the arc in exactly the colour behind it, and an untouched envelope then reads
 * as no ring at all.
 *
 * Whole class strings, not `bg-cat-${n}-soft`. Tailwind scans source text.
 */
const TONE = {
  food: { well: 'bg-cat-1-soft' },
  transport: { well: 'bg-cat-2-soft' },
  home: { well: 'bg-cat-3-soft' },
  fun: { well: 'bg-cat-4-soft' },
  health: { well: 'bg-cat-5-soft' },
  other: { well: 'bg-cat-6-soft' },
}
const ARC = 'stroke-mark'
const TRACK = 'stroke-mark/25'

export default function CategoryBento({ s, allocations, locale, onOpen }) {
  const { t } = useT()
  const fmt = (c) => money(c, s.currency, locale)

  /* summarise has already walked the period once. Building a second map from
     entries here is one more place for the two to disagree about what counts,
     which is the same argument the envelope lib makes for taking this as an
     argument rather than computing it. */
  const spentByCategory = Object.fromEntries(s.byCategory.map((c) => [c.key, c.cents]))
  const rows = envelopes({ allocations, spentByCategory })

  return (
    <div className="grid grid-cols-2 gap-4" data-hook="bento">
      {rows.map((e) => {
        const inUse = e.funded || e.spent > 0
        const tone = TONE[e.key] ?? TONE.other
        const over = e.over > 0

        return (
          <button
            key={e.key}
            type="button"
            data-bento={e.key}
            onClick={() => onOpen?.(e.key)}
            aria-label={`${t(`money.cat_${e.key}`)}. ${
              !inUse
                ? t('env.unused')
                : over
                  ? t('env.over_by', { amount: fmt(e.over) })
                  : t('env.remaining', { amount: fmt(e.remaining) })
            }`}
            /**
             * The overspent card is tinted, not just its arc.
             *
             * Carried over from the envelope cards and for the reason recorded
             * there: in sun the accent family is deep pinks and --c-negative
             * measures 1.07:1 against cat-4, so an over-budget arc is the same
             * colour as an ordinary one and cannot carry the state alone. WCAG
             * 1.4.1 wants the same thing anyway. The word is under the number
             * in both branches.
             */
            className={`press flex flex-col items-start rounded-3xl border p-4 text-left ${
              over ? 'border-negative/25 bg-negative/[0.06] shadow-sm' : 'glass-card'
            }`}
          >
            <span
              className={`flex h-[3.5rem] w-[3.5rem] shrink-0 items-center justify-center rounded-2xl ${
                over ? 'bg-negative/[0.10]' : tone.well
              }`}
            >
              <Gauge
                pct={e.pct}
                size={40}
                stroke={6}
                sweep={0.75}
                dim={!inUse}
                arc={over ? 'stroke-negative' : ARC}
                track={over ? 'stroke-negative/25' : TRACK}
              />
            </span>

            <span
              className={`mt-3 block truncate text-label font-bold uppercase leading-tight tracking-wide ${
                over ? 'text-negative' : 'text-ink'
              }`}
            >
              {t(`money.cat_${e.key}`)}
            </span>

            {/* The card's whole sentence is on the button's accessible name, so
                these two lines are decoration to anything that reads rather
                than looks. Handed over as written they would announce a bare
                number and then a bare word. */}
            <span
              aria-hidden="true"
              className={`mt-1.5 block font-display font-bold leading-none [font-variant-numeric:tabular-nums] ${
                !inUse ? 'text-body text-muted' : over ? 'text-h2 text-negative' : 'text-h2 text-ink'
              }`}
            >
              {!inUse ? t('env.unused') : fmt(over ? e.over : e.remaining)}
            </span>
            {inUse && (
              <span
                aria-hidden="true"
                className={`mt-1 block text-label ${over ? 'font-semibold text-negative' : 'text-muted'}`}
              >
                {over ? t('env.over_word') : t('env.remaining_word')}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
