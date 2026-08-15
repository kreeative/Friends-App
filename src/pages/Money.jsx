import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { money } from '../lib/money'
import { summarise } from '../lib/budget'
import { minorDigits } from '../lib/currency'
import { clearDraft, hasFreshDraft, readDraft, useDraft } from '../lib/draft'
import { loadBudget } from '../lib/budgetData'
import { errorText, isMissingColumn, isNetworkError } from '../lib/dberr'
import { fromCents, localISO, toCents, txnPayload, withoutField } from '../lib/txn'
import { Empty, Field, Screen, Section, TopBar } from '../components/ui'
import BudgetIntro from '../components/BudgetIntro'
import BudgetTiles from '../components/BudgetTiles'
import TransactionSheet from '../components/TransactionSheet'
import PlanVsActual from '../components/PlanVsActual'
import FixedCharges from '../components/FixedCharges'

/**
 * The money screen.
 *
 * Deliberately not an envelope budgeter. See supabase/19_budget.sql for the
 * reasoning; the short version is that logging every coffee is work people
 * stop doing by March, and this app's promise is sixty seconds. So the screen
 * answers one question, in one number: what can I spend today without
 * breaking the month.
 *
 * Setting up is the only part that takes real effort, and it is asked for once.
 */

/**
 * toCents and fromCents now live in src/lib/txn.js.
 *
 * They moved so they could be tested. toCents in particular had a fault
 * nobody could see from here: it turned every separator into a decimal point,
 * so "1,000" typed by anyone using English grouping parsed as one dollar and
 * a rent of 1,850 was stored as 1.85. See the file for what replaced it and
 * why the ambiguous case is resolved the way it is.
 *
 * Every amount in the database is an integer with two implied decimals in
 * every currency, so the column never means something different depending on
 * a setting. What changes per currency is only how many decimals a person is
 * shown and asked for: a plan form offering "500.00" in CFA francs is offering
 * two decimals of a currency that has none. See src/lib/currency.js.
 */

/* Unsubmitted plan input, per person. See PlanForm and src/lib/draft.js. */
const DRAFT_KEY = 'rich_friends_budget_draft'

/** The sheet is open, on nothing yet. See the `sheet` state below. */
const NEW = 'new'

function MoneyInput({ value, onChange, digits = 2, autoFocus = false }) {
  return (
    <input
      type="text"
      inputMode="decimal"
      autoFocus={autoFocus}
      className="field"
      value={value}
      placeholder={digits === 0 ? '0' : `0.${'0'.repeat(digits)}`}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

/**
 * How much of what was free has already gone.
 *
 * A bar that actually moves, unlike the fixed rule that used to sit under
 * every Stat. Over 100% it stays full and turns to the warning treatment
 * rather than overflowing its track.
 */
function SpendBar({ spent, pool }) {
  const pct = pool > 0 ? Math.min(100, Math.round((spent / pool) * 100)) : 100
  const over = pool <= 0 || spent > pool
  return (
    <div
      className="mt-5 h-2 w-full overflow-hidden rounded-pill bg-ink/10"
      role="img"
      aria-label={`${pct}%`}
    >
      <div
        className={`h-full rounded-pill transition-[width] duration-500 ${over ? 'bg-ink' : 'bg-accent'}`}
        style={{ width: `${Math.max(pct, 2)}%` }}
      />
    </div>
  )
}

/**
 * The three icons for the three steps.
 *
 * Drawn here rather than pulled from a set, and deliberately not emoji: the
 * emoji came out of the budget banner one commit ago because it sat at a
 * different weight and colour from everything around it and read as clip art
 * stuck to a card. A stroked glyph inherits the ink colour, scales with the
 * type and belongs to the same drawing as the rest of the screen.
 */
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

const ICONS = {
  in: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]" {...stroke}>
      <path d="M12 3v10" />
      <path d="m8 9 4 4 4-4" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  ),
  promised: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]" {...stroke}>
      <path d="M11 3H5a2 2 0 0 0-2 2v6l10 10 8-8L11 3Z" />
      <circle cx="7.6" cy="7.6" r="1.15" />
    </svg>
  ),
  keep: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]" {...stroke}>
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10.5h18" />
      <circle cx="16.5" cy="15" r="1.15" />
    </svg>
  ),
}

/** One of the three things the plan asks for. */
function Step({ icon, title, body }) {
  return (
    <li className="flex items-start gap-3.5">
      {/* The accent at low opacity rather than at full strength. Three
          saturated discs down the left of a card is a colour scheme, not a
          list, and the glyph is the thing meant to be read. */}
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-accent/20 text-ink">
        {ICONS[icon]}
      </span>
      <span className="min-w-0">
        <span className="block text-body font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block text-small text-muted">{body}</span>
      </span>
    </li>
  )
}

/**
 * Nothing set up yet, as one card.
 *
 * This screen used to be a page heading, a centred paragraph of six lines and
 * a button, all of it floating on the ground with no container. Centred prose
 * of that length is the hardest arrangement to read there is, every line
 * starts in a different place, and a screen whose only job is to get somebody
 * to press one button should not open with a paragraph.
 *
 * So the whole thing is one glass card, the heading included, everything left
 * aligned against a single edge, and the paragraph is broken into the three
 * questions the plan form actually asks. Reading the three tells you what the
 * next two minutes involve, which is the only thing the paragraph was for.
 *
 * The card is capped and centred rather than filling the column: at the shell
 * width the lines would run past a comfortable measure and the button would
 * be a stripe across the whole screen.
 */
function BudgetEmpty({ onStart }) {
  const { t } = useT()

  return (
    <div className="mx-auto w-full max-w-md pt-10">
      <div className="lg p-6 sm:p-8">
        <h1 className="text-h1 text-ink">{t('money.title')}</h1>
        <p className="mt-1.5 text-body font-semibold text-ink">{t('money.sub_new')}</p>
        <p className="mt-4 text-small text-muted">{t('money.pitch')}</p>

        <ul className="mt-7 space-y-5">
          <Step icon="in" title={t('money.step_in')} body={t('money.step_in_body')} />
          <Step
            icon="promised"
            title={t('money.step_promised')}
            body={t('money.step_promised_body')}
          />
          <Step icon="keep" title={t('money.step_keep')} body={t('money.step_keep_body')} />
        </ul>

        {/* Full width, because it is the only thing on the card you can do. */}
        <button className="btn-primary press mt-8" onClick={onStart}>
          {t('money.set_up')}
        </button>
      </div>
    </div>
  )
}

export default function Money() {
  const { user, profile, updateProfile } = useAuth()
  const { t, locale } = useT()

  const [plan, setPlan] = useState(null)
  const [fixed, setFixed] = useState([])
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [introDone, setIntroDone] = useState(false)

  /* The transaction sheet. `sheet` is null when it is closed, a row when it is
     open on something that exists, and NEW when it is open on nothing. Three
     states in one value rather than an `open` boolean beside a `row`, which is
     two values that can disagree: closing while a row is selected leaves the
     row behind, and the next Add opens prefilled with it. */
  const [sheet, setSheet] = useState(null)
  const [saveError, setSaveError] = useState(null)

  const load = useCallback(async () => {
    if (!user) return
    const r = await loadBudget(user.id)
    setMissing(r.missing)
    setPlan(r.plan)
    setFixed(r.fixed)
    setEntries(r.entries)
    setLoading(false)
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  /**
   * Come back into the form you were in the middle of.
   *
   * A reload lands on the money screen, because that is the route. The draft
   * survives it either way, but leaving somebody to rediscover their own
   * numbers by guessing that Edit plan still holds them is most of the problem
   * left unsolved: they see the screen they had before they started, conclude
   * the typing is gone, and are right to.
   *
   * Only once per mount, and only for a draft from the last day. Cancel and
   * Save both clear it, so there is no state this can loop on.
   */
  const resumed = useRef(false)
  useEffect(() => {
    if (resumed.current || loading || missing || !user) return
    resumed.current = true
    if (hasFreshDraft(`${DRAFT_KEY}.${user.id}`)) setEditing(true)
  }, [loading, missing, user?.id])

  const s = useMemo(
    () => summarise({ plan, fixed, entries, today: new Date(), currency: profile?.currency }),
    [plan, fixed, entries, profile?.currency],
  )

  const fmt = (cents) => money(cents, s.currency, locale)

  /**
   * A date somebody would say out loud.
   *
   * The list printed the column raw, so every row carried "2026-08-14". That
   * is the storage format, not a date: it is the one shape of date nobody
   * writes by hand, and twenty of them stacked up is a machine's log rather
   * than a list of things you bought.
   *
   * Split rather than `new Date(iso)`, which parses a bare ISO date as UTC and
   * then renders it in local time, so the row would name the previous day for
   * everybody west of Greenwich. The same trap as localISO, from the other end.
   */
  const dayFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
        day: 'numeric',
        month: 'short',
      }),
    [locale],
  )
  const day = (iso) => {
    const [y, m, d] = String(iso ?? '').slice(0, 10).split('-').map(Number)
    if (!y || !m || !d) return iso ?? ''
    return dayFmt.format(new Date(y, m - 1, d))
  }

  /**
   * What the list shows: this period, counted or not.
   *
   * `s.entries` is the arithmetic set and drops anything flagged excluded,
   * which is correct for every total on the screen and wrong for a list of
   * what you logged. A row that disappears the moment you tick a box is
   * indistinguishable from one you deleted by accident.
   *
   * String comparison rather than Date parsing: both sides are ISO dates, and
   * ISO dates sort lexically, which is most of the reason the format exists.
   */
  const recent = useMemo(() => {
    const from = localISO(s.period.start)
    const to = localISO(s.period.end)
    return entries.filter((r) => {
      const d = String(r.happened_on ?? '').slice(0, 10)
      return d >= from && d < to
    })
  }, [entries, s.period.start, s.period.end])

  /**
   * Write one transaction, new or changed.
   *
   * Optimistic, then reconciled by the reload, so the number under your thumb
   * moves the instant you tap rather than after a round trip.
   *
   * THE THREE WAYS THIS FAILS, AND WHAT EACH ONE DESERVES.
   *
   * The screen used to ignore the result of the insert entirely: `await` with
   * no destructuring, so a refusal from Postgres closed the form, cleared the
   * field and left the optimistic row on screen until the next reload wiped
   * it. Money you thought you had logged, quietly gone. Every branch below
   * exists because of a way that has already happened somewhere in this app.
   *
   * MISSING COLUMN is migration 29 not having been run yet. Sending `excluded`
   * to a database that has never heard of it fails the whole row over a
   * checkbox nobody touched, so it is dropped and sent again. The flag is lost
   * and everything the person typed survives, which is the right way round.
   *
   * NETWORK is worth exactly one retry: the payload was never the problem.
   *
   * ANYTHING ELSE is a real refusal and the only useful thing to do with it is
   * show it, code and all, with the sheet still open and still holding what
   * was typed. See src/lib/dberr.js.
   */
  async function saveEntry(form) {
    const payload = txnPayload(form, user?.id)
    if (!payload) return

    setBusy(true)
    setSaveError(null)

    const editingId = form.id ?? null
    const write = (body) =>
      editingId
        ? supabase.from('budget_entry').update(body).eq('id', editingId)
        : supabase.from('budget_entry').insert(body)

    /* On screen before the request goes out. An edit replaces its own row in
       place so the list does not jump; a new one goes to the top. */
    const optimistic = { ...payload, id: editingId ?? `local-${Date.now()}` }
    setEntries((prev) =>
      editingId
        ? prev.map((r) => (r.id === editingId ? { ...r, ...payload } : r))
        : [optimistic, ...prev],
    )

    let { error } = await write(payload)

    if (isMissingColumn(error, 'excluded')) {
      ;({ error } = await write(withoutField(payload, 'excluded')))
    } else if (isNetworkError(error)) {
      ;({ error } = await write(payload))
    }

    setBusy(false)

    if (error) {
      setSaveError(errorText(error))
      /* Put the list back. The optimistic row is a promise about what the
         database now holds, and it does not. */
      await load()
      return
    }

    setSheet(null)
    await load()
  }

  async function removeEntry(row) {
    const id = row?.id ?? row
    if (!id || String(id).startsWith('local-')) return

    setEntries((prev) => prev.filter((r) => r.id !== id))
    setSheet(null)
    setSaveError(null)

    await supabase.from('budget_entry').delete().eq('id', id)
    await load()
  }

  /**
   * The intro, once.
   *
   * The flag lives on the profile rather than in localStorage so it follows
   * the person to a second device instead of replaying the whole carousel on
   * their laptop. It is written optimistically and the failure is swallowed:
   * somebody who has just watched six slides should not be shown an error,
   * and the worst case of a failed write is seeing them again.
   *
   * Held until loading finishes so the carousel does not flash over a screen
   * that was about to render anyway.
   */
  const seen = profile?.has_seen_budget_intro
  if (!loading && !missing && seen === false && !introDone) {
    const finish = async (start) => {
      setIntroDone(true)
      updateProfile?.({ has_seen_budget_intro: true })
      if (start) setEditing(true)
    }
    return <BudgetIntro onDone={() => finish(true)} onSkip={() => finish(false)} />
  }

  if (missing) {
    return (
      <Screen>
        <TopBar title={t('money.title')} />
        <Empty>{t('money.not_installed')}</Empty>
      </Screen>
    )
  }

  if (loading) {
    return (
      <Screen>
        <TopBar title={t('money.title')} />
      </Screen>
    )
  }

  /**
   * The plan is a page, not a sheet.
   *
   * It was a Sheet, which on a phone is a panel pinned to the bottom of the
   * viewport with its own scroll. With five fields and a repeating list inside
   * it, the panel ran past the floating tab bar and the last row and the save
   * button were behind the chrome, unreachable. A sheet is right for a short
   * confirmation and wrong for the longest form in the app.
   */
  if (editing) {
    return (
      <PlanForm
        plan={plan}
        fixed={fixed}
        userId={user?.id}
        currency={s.currency}
        onCancel={() => setEditing(false)}
        onSaved={async () => {
          setEditing(false)
          await load()
        }}
      />
    )
  }

  /* No plan yet, so no page heading either: the card carries its own, and a
     screen with one card on it does not need a title above the card saying
     the same word. */
  if (!s.ready) {
    return (
      <Screen>
        <BudgetEmpty onStart={() => setEditing(true)} />
      </Screen>
    )
  }

  return (
    <Screen>
      <TopBar
        title={t('money.title')}
        sub={t('money.sub_period', { days: s.period.daysLeft })}
        right={
          /* An outlined pill, not btn-ghost. Ghost is edgeless by design,
             which works underneath a filled primary that has already
             established the row; alone in the corner of a heading it was
             indistinguishable from a line of bold text and read as a label
             rather than as the only control on the screen. */
          <button className="goal-action press" onClick={() => setEditing(true)}>
            {t('money.edit_plan')}
          </button>
        }
      />

      {/**
       * The headline. Two failure states are called out by name rather
       * than left for the reader to infer from a negative number.
       *
       * Overcommitted is the important one and it is not the same as
       * overspent: it means the plan itself does not close, so no amount
       * of careful spending fixes it. Saying "you can spend 4 dollars a
       * day" to somebody whose rent already exceeds their pay would be
       * arithmetically defensible and useless.
       */}
      <Section>
        {s.overcommitted ? (
          <div className="card-warn">
            <div className="text-h2 text-ink">{t('money.overcommitted_title')}</div>
            <p className="mt-2 text-body text-muted">
              {t('money.overcommitted_body', {
                over: fmt(Math.abs(s.plannedPool)),
                fixed: fmt(s.committed + s.savings),
                income: fmt(s.income),
              })}
            </p>
          </div>
        ) : (
          /**
           * In a card, like everything under it.
           *
           * The headline was the one block on this screen sitting loose on the
           * page: the tiles below it are cards, the three lists below those are
           * cards, and the warning branch of this very conditional is a card.
           * So the most important number on the screen was the only thing with
           * no container, which reads as a heading for the tiles rather than as
           * the answer the screen exists to give.
           *
           * The other branch already has `card-warn`, which is the same shape
           * in the alarmed colourway, so the two states now swap one card for
           * another rather than a card for a bare div.
           */
          <div className="lg p-6 sm:p-7">
            {/**
             * The label, the number, the sentence, with air between them.
             *
             * The label and the number were touching: a measured gap of
             * exactly 0px, because the eyebrow carried no bottom margin and
             * the number's line box began where the label's ended. At 13px
             * against 56px that reads as one clipped block rather than as a
             * caption over an answer.
             *
             * The tracking is opened past what .eyebrow gives everywhere else.
             * Uppercase has no descenders to separate the letters, so caps
             * need more space than lowercase at the same size, and Poppins'
             * caps are the widest glyphs in the set. Scoped to this card
             * rather than pushed into .eyebrow, which 38 other places use.
             */}
            <div className="eyebrow mb-2 !text-[0.75rem] !font-medium !tracking-[0.05em]">
              {!s.logged
                ? t('money.balance_label')
                : s.overspent
                  ? t('money.over_label')
                  : t('money.today_label')}
            </div>
            {/**
             * leading-none is gone, so `hero`'s own 1.05 applies.
             *
             * The token sets that line height deliberately: Poppins has a tall
             * x-height and short descenders, and 1.0 gives the glyphs a line
             * box shorter than the space they occupy. Nothing was visibly
             * clipped here because "108,37 $" has no descender, but a currency
             * that renders one, or a negative sign on the overspent branch,
             * would have been sitting in the label above it.
             */}
            <div className="font-display text-hero text-ink [font-variant-numeric:tabular-nums]">
              {fmt(s.logged ? (s.overspent ? s.available : s.perDay) : 0)}
            </div>
            {/**
             * Nothing logged gets a sentence, not a number pretending to be
             * one. This is where the bug was visible: the setup form's figures
             * were divided by the days left and printed as an allowance, so a
             * salary that had not arrived and a rent that had not gone out were
             * both being spent on screen.
             *
             * The plan is still named, because somebody who has just typed it
             * in should see it acknowledged. It is named as a plan.
             */}
            <p className="lede mt-2 max-w-[32ch]">
              {!s.logged
                ? t('money.nothing_logged', { planned: fmt(s.plannedPerDay) })
                : s.overspent
                  ? t('money.over_body', { days: s.period.daysLeft })
                  : t('money.today_body', {
                      left: fmt(s.available),
                      days: s.period.daysLeft,
                    })}
            </p>
            {/* Against the plan, which is what a spend bar is measured on. */}
            <SpendBar spent={s.spent} pool={s.plannedPool} />
          </div>
        )}
      </Section>

      {/* The two squares. Under the headline because they are the same
          fact at more resolution, and above the form because a person
          opening this screen is reading before they are typing. */}
      <Section>
        <BudgetTiles s={s} locale={locale} />
      </Section>

      {/**
       * One button where the form used to be.
       *
       * The form was three controls and a submit, permanently open, sitting
       * between the summary and the totals. Permanently open is the problem:
       * it is a piece of furniture on a screen people mostly come to read,
       * and it pushed the numbers it exists to change below the fold.
       *
       * It also could not grow. Adding a date to it, or a note, or a way back
       * into a row, meant three more permanently-open controls. In a sheet
       * those cost nothing until somebody wants them.
       */}
      <Section>
        <button className="btn-primary press w-full" onClick={() => setSheet(NEW)}>
          {t('txn.open')}
        </button>
      </Section>

      {/* What was meant to happen, against what has. The gap between the two
          columns is the interesting part, and it is the thing the old single
          column could not show because it had already merged them. */}
      <Section title={t('money.plan_vs_actual')}>
        <PlanVsActual s={s} locale={locale} />
      </Section>

      {/* And the charges themselves, each one planned until you say it went
          out. This is the control the app never had: with no way to mark a
          charge paid, the arithmetic had to assume always or never. */}
      {fixed.filter((f) => f.active !== false).length > 0 && (
        <Section title={t('money.fixed_title')}>
          <FixedCharges fixed={fixed} s={s} locale={locale} onChange={load} />
        </Section>
      )}

      {/**
       * Rows, not columns, and not the shared Stat component.
       *
       * Stat renders at text-metric, 3rem, sized for a percentage or a
       * count. Three formatted currency amounts at that size ran straight
       * through each other on a phone. Dropping to heading size stopped
       * the overlap but they still touched, because "CA$1,367.00" is
       * eleven characters and a third of a 420px screen is not enough for
       * it at any size worth reading.
       *
       * Currency width is not predictable: the code, the thousands
       * separator and the locale all move it, and fr-CA writes the symbol
       * on the other end. So the amounts get a full line each and the
       * columns problem stops existing. It also matches the "where it
       * went" list further down, which is the same shape of information.
       */}
      {/* Three figures inside one sheet rather than three lines lying on the
          page. Divided rather than spaced: the hairlines are what say these
          are one set of related numbers and not three unrelated ones. */}
      <Section title={t('money.this_period')}>
        <dl className="lg divide-y divide-hairline px-5">
          {[
            [t('money.left'), fmt(s.available)],
            [t('money.spent'), fmt(s.spent)],
            [t('money.days_left'), String(s.period.daysLeft)],
          ].map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-4 py-4">
              <dt className="text-body text-ink">{label}</dt>
              <dd className="text-body font-semibold text-ink [font-variant-numeric:tabular-nums]">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      {s.byCategory.length > 0 && (
        <Section title={t('money.where')}>
          <ul className="lg divide-y divide-hairline px-5">
            {s.byCategory.map((c) => (
              <li key={c.key} className="flex items-baseline justify-between gap-4 py-4">
                <span className="text-body text-ink">{t(`money.cat_${c.key}`)}</span>
                <span className="text-body font-semibold text-ink [font-variant-numeric:tabular-nums]">
                  {fmt(c.cents)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/**
       * The empty state gets a card too. A lone sentence on the page ground
       * reads as a section that failed to load; inside the container it is
       * the section, saying it is empty.
       *
       * `recent` rather than `s.entries`, because the summary only returns
       * rows inside the period and only the ones that count. Both are right
       * for arithmetic and wrong for a list: a transaction you left out of
       * the budget is still a transaction you logged, and one that vanishes
       * from the list the moment you flip the switch reads as a delete.
       */}
      <Section title={t('money.recent')}>
        {recent.length === 0 ? (
          <div className="lg px-5 py-2">
            <Empty>{t('money.no_entries')}</Empty>
          </div>
        ) : (
          <ul className="lg divide-y divide-hairline px-5">
            {recent.slice(0, 20).map((r) => (
              <li key={r.id}>
                {/* The row is the way back in. Remove used to be the only
                    thing you could do to a transaction from here, sitting as
                    an underlined word at the end of every line: twenty
                    invitations to delete something, and no way to fix a typo
                    short of taking one of them. */}
                <button
                  type="button"
                  onClick={() => setSheet(r)}
                  className="press flex w-full items-baseline justify-between gap-4 py-4 text-left"
                >
                  <span className="min-w-0 flex-1 text-body text-ink">
                    <span className="truncate">
                      {r.note ||
                        (r.kind === 'income'
                          ? t('money.kind_income')
                          : t(`money.cat_${r.category ?? 'other'}`))}
                    </span>
                    <span className="block text-small text-muted">
                      {day(r.happened_on)}
                      {r.note && r.kind === 'expense' && ` · ${t(`money.cat_${r.category ?? 'other'}`)}`}
                      {r.excluded && ` · ${t('txn.excluded_badge')}`}
                    </span>
                  </span>
                  {/* Struck through when it does not count, so the reason the
                      total ignores it is legible from the list rather than
                      only from inside the sheet. The word is there too: a
                      line through text is not something everyone can see. */}
                  {/* Struck through when it does not count, so the reason the
                      total ignores it is legible from the list rather than
                      only from inside the sheet. The word is there too: a
                      line through text is not something everyone can see. */}
                  <span
                    className={`shrink-0 text-body font-semibold text-ink [font-variant-numeric:tabular-nums] ${
                      r.excluded ? 'text-muted line-through' : ''
                    }`}
                  >
                    {r.kind === 'income' ? '+' : ''}
                    {fmt(r.amount_cents)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <TransactionSheet
        open={sheet !== null}
        row={sheet === NEW ? null : sheet}
        currency={s.currency}
        busy={busy}
        error={saveError}
        onClose={() => {
          setSheet(null)
          setSaveError(null)
        }}
        onSave={saveEntry}
        onDelete={removeEntry}
      />
    </Screen>
  )
}

/**
 * The setup.
 *
 * Three questions and a list. Everything else the screen shows is derived, so
 * this is the entire amount of typing the feature ever asks for.
 */
function PlanForm({ plan, fixed, userId, currency, onCancel, onSaved }) {
  const { t } = useT()
  const digits = minorDigits(currency)

  /**
   * Keyed by person, not global.
   *
   * Two people signing in on one phone is ordinary, and a draft is somebody's
   * unfinished sentence about their own rent. Restoring one account's numbers
   * into another account's form would be worse than losing them.
   */
  const draftKey = userId ? `${DRAFT_KEY}.${userId}` : null

  /* Read exactly once, at mount, before any effect can run. A lazy initializer
     rather than an effect, so the seeding effect below sees the decision
     already made and never gets a frame in which it can overwrite it. */
  const saved = useState(() => (draftKey ? readDraft(draftKey) : null))[0]
  const restored = useRef(Boolean(saved))

  const [income, setIncome] = useState(saved?.income ?? '')
  const [savings, setSavings] = useState(saved?.savings ?? '')
  const [rows, setRows] = useState(() => (Array.isArray(saved?.rows) ? saved.rows : []))
  const [busy, setBusy] = useState(false)

  /** The saved plan, in the shape the fields hold it. */
  const asFields = useCallback(
    () => ({
      income: fromCents(plan?.monthly_income_cents, digits) || '',
      savings: fromCents(plan?.savings_target_cents, digits) || '',
      rows: (fixed ?? []).map((f) => ({
        id: f.id,
        label: f.label,
        amount: fromCents(f.amount_cents, digits),
        active: f.active !== false,
      })),
    }),
    [plan, fixed, digits],
  )

  // Re-seeded from the saved plan, so a cancelled edit does not persist. Not
  // when a draft was restored: something typed and not yet saved outranks
  // whatever the server last heard, which is the entire point of the draft.
  useEffect(() => {
    if (restored.current) return
    const next = asFields()
    setIncome(next.income)
    setSavings(next.savings)
    setRows(next.rows)
  }, [asFields])

  /**
   * Persist only what differs from the saved plan.
   *
   * Comparing against the server's own values rather than tracking a `dirty`
   * flag through nine change handlers: a flag is a thing to forget to set on
   * the tenth, and this cannot be forgotten. It also means undoing your own
   * edits clears the draft, so the form stops offering to restore something
   * identical to what is already saved.
   */
  const current = { income, savings, rows }
  const dirty = JSON.stringify(current) !== JSON.stringify(asFields())
  useDraft(draftKey, dirty ? current : null)

  /** Throw the draft away and go back to what the server has. */
  function discardDraft() {
    restored.current = false
    if (draftKey) clearDraft(draftKey)
    const next = asFields()
    setIncome(next.income)
    setSavings(next.savings)
    setRows(next.rows)
  }

  async function save() {
    if (!userId) return
    setBusy(true)

    const { error } = await supabase.from('budget_plan').upsert(
      {
        user_id: userId,
        monthly_income_cents: toCents(income) ?? 0,
        savings_target_cents: toCents(savings) ?? 0,
        /* The period is the calendar month. The column stays at its default
           of 1 rather than being dropped, so no migration is needed and a
           payday setting could come back later without a schema change. */
        period_start_day: 1,
      },
      { onConflict: 'user_id' },
    )

    /* A failed write must not take the draft with it. This used to ignore the
       result entirely, which was survivable while nothing depended on it and
       is not now: clearing the draft after a write that did not land is the
       one way this feature could itself destroy what it exists to protect. */
    if (error) {
      setBusy(false)
      return
    }

    // Rows the user cleared out are removed rather than left at zero, since
    // the amount column refuses zero and a paused row is what `active` is for.
    const keep = rows.filter((r) => r.label.trim() && (toCents(r.amount) ?? 0) > 0)
    const keptIds = keep.map((r) => r.id).filter(Boolean)

    const gone = (fixed ?? []).filter((f) => !keptIds.includes(f.id)).map((f) => f.id)
    if (gone.length) await supabase.from('budget_fixed').delete().in('id', gone)

    for (const r of keep) {
      const payload = {
        user_id: userId,
        label: r.label.trim().slice(0, 60),
        amount_cents: toCents(r.amount),
        active: r.active,
      }
      if (r.id) await supabase.from('budget_fixed').update(payload).eq('id', r.id)
      else await supabase.from('budget_fixed').insert(payload)
    }

    /* Landed. Nothing left to protect, and leaving it would offer the same
       numbers back as a draft the next time the form opens. */
    restored.current = false
    if (draftKey) clearDraft(draftKey)

    setBusy(false)
    await onSaved?.()
  }

  /* Cancel already means "discard what I typed", so it discards the copy of
     what you typed too. The draft is insurance against the page being taken
     away, not against your own decision. */
  function cancel() {
    if (draftKey) clearDraft(draftKey)
    onCancel?.()
  }

  return (
    <Screen>
      <TopBar
        title={t('money.plan_title')}
        right={
          <button className="btn-ghost press" onClick={cancel}>
            {t('money.cancel')}
          </button>
        }
      />

      {/**
        * Said out loud, because silently showing numbers other than the ones
        * on the saved plan is the kind of help that reads as a bug. It also
        * needs a way out: somebody who wanted to start over should not have to
        * clear five fields by hand.
        */}
      {restored.current && dirty && (
        <div className="animate-rise mt-4 flex flex-wrap items-center justify-between gap-3 rounded-inner bg-ink/[0.035] p-4">
          <span className="text-small text-ink">{t('money.draft_restored')}</span>
          <button onClick={discardDraft} className="goal-action press">
            {t('money.draft_discard')}
          </button>
        </div>
      )}
      {/* pb-32 clears the floating tab bar plus its inset, so the save button
          at the end of the list is reachable rather than sitting under it. */}
      <div className="space-y-8 pb-32 pt-4">
        <Field label={t('money.income')} hint={t('money.income_hint')}>
          <MoneyInput value={income} onChange={setIncome} digits={digits} autoFocus />
        </Field>

        <Field label={t('money.savings')} hint={t('money.savings_hint')}>
          <MoneyInput value={savings} onChange={setSavings} digits={digits} />
        </Field>

        <div>
          <span className="field-label">{t('money.fixed')}</span>
          <span className="field-note">{t('money.fixed_hint')}</span>
          <ul className="mt-4 space-y-3">
            {rows.map((r, i) => (
              <li key={r.id ?? `new-${i}`} className="flex gap-2">
                <input
                  className="field flex-1"
                  placeholder={t('money.fixed_label_ph')}
                  value={r.label}
                  onChange={(e) =>
                    setRows((p) => p.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                  }
                />
                <input
                  className="field w-28"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={r.amount}
                  onChange={(e) =>
                    setRows((p) => p.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))
                  }
                />
                <button
                  type="button"
                  className="text-small text-muted underline"
                  onClick={() => setRows((p) => p.filter((_, j) => j !== i))}
                >
                  {t('money.remove')}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn-ghost press mt-4"
            onClick={() => setRows((p) => [...p, { label: '', amount: '', active: true }])}
          >
            {t('money.add_fixed')}
          </button>
        </div>

        <button className="btn-primary press" onClick={save} disabled={busy}>
          {busy ? t('money.saving') : t('money.save')}
        </button>
      </div>
    </Screen>
  )
}
