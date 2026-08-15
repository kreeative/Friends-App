import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../lib/i18n'
import { CATEGORIES } from '../lib/budget'
import { currencySymbol, minorDigits } from '../lib/currency'
import { KINDS, NOTE_MAX, blankTxn, localISO, toCents, txnFromRow, txnValid } from '../lib/txn'

/**
 * One transaction, as a sheet you pull up.
 *
 * WHAT THIS REPLACED.
 *
 * A form sitting inline on the money screen: a pair of chips, a text box and
 * an Add button, wedged between the summary tiles and the period totals. It
 * worked, and it could only ever say two things. There was no note, no date,
 * and no way back into a row once it was written, so a spend logged on the
 * wrong day was a row you deleted and retyped, and a receipt you wanted to
 * annotate went into a column the screen never wrote to.
 *
 * Everything the row can hold is now asked for, and none of it is compulsory:
 * an amount and a tap on Save is still the whole interaction, and the rows
 * underneath are there when the amount alone is not the story.
 *
 * WHY THERE ARE TWO SEGMENTS AND NOT THREE.
 *
 * A transfer is money leaving one account and arriving in another, which
 * needs two accounts, and this app has none. budget_entry belongs to a person,
 * not to a pocket. A third segment would have to invent both sides of the
 * movement or store neither, and a control that writes a spend while saying
 * "transfer" on it is worse than not offering the word.
 *
 * What people mostly want from it is here under a different name: a movement
 * between your own pockets is a real event you want a record of and is not
 * spending, which is exactly what "leave out of the budget" is for. Accounts
 * are a bigger feature than a form, and this is the form.
 *
 * WHY IT IS A PORTAL.
 *
 * Every page is wrapped in `.page-enter`, whose animation fills forever, and
 * an element with an animated transform is the containing block for fixed
 * descendants even when the value resolves to none. So a `fixed inset-0`
 * declared inside a page is positioned against the page and the panel lands
 * below the fold. See the Sheet in components/ui.jsx, which learned it first.
 */

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" {...stroke}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
)

const ChevronIcon = ({ open }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={`h-4 w-4 shrink-0 text-muted transition-transform duration-200 ease-settle ${
      open ? 'rotate-180' : ''
    }`}
    {...stroke}
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
)

/**
 * How wide the amount field should be, in ch.
 *
 * The field is sized to its own content so the number stays optically centred
 * next to its currency symbol rather than floating in the middle of a
 * full-width box with the symbol stranded at the edge.
 *
 * Digits are one ch each because the face is set in tabular figures here, so
 * a ch is exactly a digit. Separators are narrower and get roughly half. The
 * floor is the width of the placeholder, otherwise an empty field collapses to
 * nothing and there is no caret to aim at.
 */
function fieldWidth(text) {
  const s = String(text ?? '')
  const digits = (s.match(/\d/g) ?? []).length
  const rest = s.length - digits
  return Math.max(1.1, digits + rest * 0.55 + 0.1)
}

/** Label on the left, whatever you tap on the right. */
function Row({ label, children, onClick, htmlFor }) {
  const inner = (
    <>
      <span className="shrink-0 text-body text-ink">{label}</span>
      <span className="flex min-w-0 items-center justify-end gap-2 text-right">{children}</span>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center justify-between gap-4 py-4 text-left"
      >
        {inner}
      </button>
    )
  }

  return (
    <label htmlFor={htmlFor} className="flex w-full items-center justify-between gap-4 py-4">
      {inner}
    </label>
  )
}

export default function TransactionSheet({
  open,
  row = null,
  currency,
  busy = false,
  error = null,
  onClose,
  onSave,
  onDelete,
}) {
  const { t, locale } = useT()
  const digits = minorDigits(currency)

  const [form, setForm] = useState(() => blankTxn())
  const [catOpen, setCatOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const amountRef = useRef(null)

  const editing = Boolean(row?.id)

  /* Seeded from the row every time the sheet opens, and reset when it closes,
     so yesterday's amount is never sitting in the field the next time somebody
     taps Add. Keyed on the id and on open rather than on the row object, which
     is a new reference on every reload of the page behind the sheet. */
  useEffect(() => {
    if (!open) return
    setForm(row ? txnFromRow(row, digits) : blankTxn())
    setCatOpen(false)
    setConfirmDelete(false)
  }, [open, row?.id, digits])

  /* The caret goes where the typing goes. Only for a new one: opening an
     existing transaction to change its date should not raise a numeric
     keyboard over the row you came to edit. */
  useEffect(() => {
    if (!open || editing) return
    const id = window.setTimeout(() => amountRef.current?.focus(), 120)
    return () => window.clearTimeout(id)
  }, [open, editing])

  /* Escape closes, and the page behind stops scrolling under the panel.
     Without the lock, a flick that starts on the sheet's own scroll area and
     runs past its end scrolls the money screen instead, which on a phone looks
     like the sheet came loose. */
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const sym = useMemo(
    () => currencySymbol(currency, [locale === 'fr' ? 'fr-CA' : 'en-CA', ...(navigator.languages ?? [])]),
    [currency, locale],
  )

  /* How much the amount line has to shrink to fit the panel. Measured after
     layout and before paint, so a long number never renders wide for a frame
     and then snaps. Never above 1: a short amount is not blown up to fill the
     width, it just sits at the hero size like everything else. */
  const fitOuter = useRef(null)
  const fitInner = useRef(null)
  const [fit, setFit] = useState({ scale: 1, height: null })

  useLayoutEffect(() => {
    if (!open) return
    const measure = () => {
      const outer = fitOuter.current
      const inner = fitInner.current
      if (!outer || !inner) return
      const room = outer.clientWidth
      const want = inner.offsetWidth
      const scale = want > 0 && room > 0 ? Math.min(1, room / want) : 1
      /* The box has to lose the height the scale took off it too. A transform
         does not change layout, so without this a shrunk number leaves a band
         of its own former height underneath, and the gap to the segments
         below grows as the amount gets longer. */
      setFit({ scale, height: scale < 1 ? inner.offsetHeight * scale : null })
    }
    measure()
    /* The panel is full width, so a rotation changes the room available. */
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open, form.amount, sym.symbol])

  if (!open) return null

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const valid = txnValid(form)

  /** Today and yesterday by name, because a date is easier to check than to read. */
  const dateLabel = (() => {
    const now = new Date()
    if (form.happened_on === localISO(now)) return t('txn.today')
    const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
    if (form.happened_on === localISO(y)) return t('txn.yesterday')
    return null
  })()

  const symbolClass = 'font-display text-h1 font-semibold leading-none text-muted'

  return createPortal(
    <div
      className="animate-scrim fixed inset-0 z-50 flex flex-col justify-end bg-ink/40 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={editing ? t('txn.edit') : t('txn.new')}
        onClick={(e) => e.stopPropagation()}
        /* The panel is a column with one scrolling middle, not one long
           scrolling box. The save button has to stay under the thumb while a
           category grid is open above it, and a footer inside the scroller
           leaves the screen exactly when it is needed. */
        className="animate-sheet flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-surface"
      >
        {/* --- header ---------------------------------------------------- */}
        <div className="shrink-0 px-5 pt-3">
          <div className="mx-auto h-1 w-10 rounded-pill bg-ink/15" aria-hidden="true" />
          <div className="mt-3 flex items-center gap-3 pb-1">
            {/* Upper left, and a real target rather than a glyph: at 44px it
                is the size a thumb reaching across a phone actually hits. */}
            <button
              type="button"
              onClick={onClose}
              aria-label={t('ui.close')}
              className="press -ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-pill text-muted transition-colors hover:bg-ink/[0.05] hover:text-ink"
            >
              <CloseIcon />
            </button>
            <h2 className="min-w-0 flex-1 text-center text-body font-semibold text-ink">
              {editing ? t('txn.edit') : t('txn.new')}
            </h2>
            {/* Balances the close button, negative margin included. Without
                the matching -mr-2 the title sat four pixels left of centre,
                which is not something anybody would name but is enough to
                make a centred heading look like it was aligned by hand. */}
            <span className="-mr-2 h-11 w-11 shrink-0" aria-hidden="true" />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6">
          <div className="mx-auto w-full max-w-content">
            {/* --- the amount --------------------------------------------- */}
            <div className="pb-7 pt-5 text-center">
              <label htmlFor="txn-amount" className="eyebrow">
                {t('txn.amount')}
              </label>
              {/**
               * The line shrinks to fit rather than being sized by a formula.
               *
               * The inner row is `w-max`, so its layout width is always the
               * natural width of the number plus its symbol, whatever the
               * scale on it: a transform does not change layout. That makes
               * the fit one division against the space actually available,
               * which is the only version of this that survives contact with
               * "F CFA" as a symbol, a seven-figure amount, and a 320px
               * screen at the same time. Guessing from font metrics gets the
               * common case right and clips the rest.
               */}
              {/* The breathing room lives on this wrapper rather than on the
                  measured box, so `clientWidth` below is the space the line
                  may actually occupy and nothing has to subtract padding. */}
              <div className="mt-3 px-2">
                <div
                  ref={fitOuter}
                  className="overflow-hidden"
                  style={fit.height ? { height: `${fit.height}px` } : undefined}
                >
                  <div
                    ref={fitInner}
                    className="mx-auto flex w-max items-baseline justify-center gap-2 will-change-transform"
                    /**
                     * Origin at the LEFT, not the centre.
                     *
                     * When the line is wider than the room, `mx-auto` has no
                     * slack to distribute and collapses to zero, so the box
                     * starts at the left edge and runs off the right. Scaling
                     * that from its own centre moves the midpoint outward by
                     * half the overflow and pushes the number off the panel,
                     * which is the exact bug this measuring was added to fix.
                     *
                     * From the left edge, a fit of room/want lands the scaled
                     * line on exactly the room available, starting where the
                     * room starts. Centred, by construction. And when nothing
                     * needs shrinking the scale is 1, so the origin is moot
                     * and `mx-auto` does the centring as usual.
                     */
                    style={{ transform: `scale(${fit.scale})`, transformOrigin: "left top" }}
                  >
                    {sym.before && <span className={symbolClass}>{sym.symbol}</span>}
                    <input
                      id="txn-amount"
                      ref={amountRef}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      enterKeyHint="done"
                      className="amount-hero"
                      style={{ width: `${fieldWidth(form.amount)}ch` }}
                      placeholder="0"
                      value={form.amount}
                      onChange={(e) => set({ amount: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return
                        e.preventDefault()
                        if (valid && !busy) onSave?.(form)
                      }}
                    />
                    {!sym.before && <span className={symbolClass}>{sym.symbol}</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* --- which way it went -------------------------------------- */}
            <div
              role="radiogroup"
              aria-label={t('txn.direction')}
              className="flex gap-1 rounded-pill bg-ink/[0.05] p-1"
            >
              {KINDS.map((k) => {
                const on = form.kind === k
                return (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => set({ kind: k })}
                    className={`flex-1 rounded-pill px-3 py-2.5 text-small font-semibold transition-colors duration-200 ease-settle ${
                      on ? 'bg-accent text-on-accent shadow-raised' : 'text-muted hover:text-ink'
                    }`}
                  >
                    {t(`txn.kind_${k}`)}
                  </button>
                )
              })}
            </div>

            {/* --- everything else ---------------------------------------- */}
            <div className="lg mt-5 divide-y divide-hairline px-5">
              {/* Category, on an expanding row rather than behind a second
                  sheet. Six values is a grid you can read at a glance, and a
                  modal opened from inside a modal is a stack of panels to get
                  back out of for the sake of one tap. Only for spending: a
                  category on money arriving is stored and never read. */}
              {form.kind === 'expense' && (
                <div>
                  <Row label={t('txn.category')} onClick={() => setCatOpen((v) => !v)}>
                    <span className="truncate font-semibold text-ink">
                      {t(`money.cat_${form.category}`)}
                    </span>
                    <ChevronIcon open={catOpen} />
                  </Row>
                  {catOpen && (
                    <div className="animate-rise flex flex-wrap gap-2 pb-4">
                      {CATEGORIES.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            set({ category: c })
                            setCatOpen(false)
                          }}
                          className={form.category === c ? 'chip-accent press' : 'chip bg-raised text-ink press'}
                        >
                          {t(`money.cat_${c}`)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <Row label={t('txn.note')} htmlFor="txn-note">
                <input
                  id="txn-note"
                  type="text"
                  maxLength={NOTE_MAX}
                  className="w-full min-w-0 border-0 bg-transparent p-0 text-right text-body text-ink placeholder:text-muted/70 focus:outline-none"
                  placeholder={t('txn.note_ph')}
                  value={form.note}
                  onChange={(e) => set({ note: e.target.value })}
                />
              </Row>

              <Row label={t('txn.date')} htmlFor="txn-date">
                {/* The friendly name sits beside the control rather than
                    replacing it. A row that only says "Today" and opens a
                    picker hides which day it actually means the moment you
                    have picked something else. */}
                {dateLabel && <span className="shrink-0 text-small text-muted">{dateLabel}</span>}
                <input
                  id="txn-date"
                  type="date"
                  max={localISO()}
                  className="min-w-0 border-0 bg-transparent p-0 text-right text-body font-semibold text-ink focus:outline-none"
                  value={form.happened_on}
                  onChange={(e) => set({ happened_on: e.target.value })}
                />
              </Row>

              <div className="py-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="min-w-0 text-body text-ink" id="txn-exclude-label">
                    {t('txn.exclude')}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.excluded}
                    aria-labelledby="txn-exclude-label"
                    onClick={() => set({ excluded: !form.excluded })}
                    className="switch press"
                  >
                    <span aria-hidden="true" />
                  </button>
                </div>
                {/* Said only when it is on. The sentence explains a state, and
                    a paragraph under a switch nobody has touched is a
                    paragraph explaining something that is not happening. */}
                {form.excluded && (
                  <p className="animate-rise mt-2 max-w-[42ch] text-small text-muted">
                    {t('txn.exclude_hint')}
                  </p>
                )}
              </div>
            </div>

            {error && (
              <p className="mt-4 break-words text-small text-negative" role="alert">
                {error}
              </p>
            )}

            {/* --- delete, only on something that exists ------------------ */}
            {editing && onDelete && (
              <div className="mt-6">
                {confirmDelete ? (
                  <div className="animate-rise flex flex-wrap items-center justify-between gap-3 rounded-inner bg-ink/[0.035] p-4">
                    <span className="text-small font-semibold text-ink">{t('txn.delete_sure')}</span>
                    <span className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="goal-action press"
                      >
                        {t('txn.delete_no')}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(row)}
                        className="chip press bg-negative text-white"
                      >
                        {t('txn.delete_yes')}
                      </button>
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="press w-full rounded-inner py-3 text-small font-semibold text-negative transition-colors hover:bg-negative/[0.07]"
                  >
                    {t('txn.delete')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* --- save ------------------------------------------------------- */}
        {/* Outside the scroller, so it is under the thumb whatever is open
            above it. The safe-area inset is added rather than assumed: on a
            phone with a home indicator a button flush to the bottom edge is a
            button with a system gesture bar drawn across it. */}
        <div
          className="shrink-0 border-t border-hairline bg-surface px-5 pt-4"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
        >
          <div className="mx-auto w-full max-w-content">
            <button
              type="button"
              onClick={() => onSave?.(form)}
              disabled={!valid || busy}
              className="btn-primary press w-full"
            >
              {busy ? t('txn.saving') : t('txn.save')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
