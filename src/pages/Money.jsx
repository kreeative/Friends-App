import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { money, moneyParts } from '../lib/money'
import { summarise } from '../lib/budget'
import { currencySymbol, minorDigits } from '../lib/currency'
import { clearDraft, hasFreshDraft, readDraft, useDraft } from '../lib/draft'
import { loadBudget } from '../lib/budgetData'
import { errorText, isMissingColumn, isMissingTable, isNetworkError } from '../lib/dberr'
import { detectCountry, spendOver } from '../lib/benchmarks'
import { history as savingsHistory, recentRate } from '../lib/savings'
import { fromCents, localISO, toCents, txnPayload, withoutField } from '../lib/txn'
import { Empty, Screen, Section, TopBar } from '../components/ui'
import ActionBar, {
  BookIcon, EnvelopeIcon, GaugeIcon, ListIcon, PiggyIcon, PlanIcon, ScaleIcon, SuitcaseIcon,
} from '../components/ActionBar'
import Savings from '../components/Savings'
import Benchmarks from '../components/Benchmarks'
import Formation from '../components/Formation'
import CatDisc from '../components/CatDisc'
import SpendDonut from '../components/SpendDonut'
import TransactionHistory from '../components/TransactionHistory'
import Projects from '../components/Projects'
import ProjectDetail from '../components/ProjectDetail'
import { loadProjectProfiles, loadProjects } from '../lib/projectData'
import BudgetIntro from '../components/BudgetIntro'
import SpendTrend from '../components/SpendTrend'
import TransactionSheet from '../components/TransactionSheet'
import PlanVsActual from '../components/PlanVsActual'
import Envelopes, { SpendableBar } from '../components/Envelopes'
import { ENVELOPE_CATEGORIES, allocationsFor, spendable, toAllocate } from '../lib/envelope'
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

/**
 * One amount, typed straight into a tile.
 *
 * The plan form used to be three `.field` boxes stacked down a page: a filled
 * rectangle, a label above it, a note under it, three times. That is a web
 * form from 2012 sitting inside an app whose every other money surface is a
 * card with a name at the top and a number at the bottom, and the mismatch is
 * the whole of what was wrong with it.
 *
 * So the box goes and the tile stays. The tile IS the input: it is a `<label>`,
 * so a tap anywhere on it puts the caret in the number, which makes it a much
 * bigger target than the 44px-high field it replaces.
 *
 * The currency mark rides in the label row rather than beside the digits. Put
 * next to the number it has to switch sides between "$12" and "12 $", and the
 * trailing case leaves the symbol stranded at the far edge of the tile with the
 * number at the other. In the label row it is in the same place in both
 * languages and still says what unit you are typing.
 *
 * THE RING IS THE AFFORDANCE, AND IT IS A MEASURED ONE.
 *
 * With the box gone there was nothing at rest saying this tile takes a caret:
 * the glass card's own edge is ink at 8%, which measures about 1.1:1 against
 * the card and is a seam, not a boundary. `.field`'s fill is not much better.
 * WCAG 1.4.11 asks 3:1 of anything required to identify a control, so this is
 * ink at 50%, and ringprobe.mjs measures the painted pixels rather than
 * trusting the arithmetic.
 *
 * Ink rather than the accent because the accent has to work in both themes and
 * in sea it is yellow: #FFD60A on white is 1.41:1, and a boundary nobody can
 * see is not a boundary.
 *
 * Which is also why focus does not swap the ring for the accent, the way
 * `.field:focus` does app-wide. Doing that took a focused field in sea from
 * 3.3:1 to roughly 1.4:1, so putting the caret in it made its edge harder to
 * see than leaving it alone. The ring stays ink and goes to 2px, and the accent
 * arrives as a glow outside it: measured, focus is 4.5:1 in both themes, which
 * is stronger than rest rather than weaker.
 */
function AmountTile({ label, hint, ariaLabel, symbol, value, onChange, digits, autoFocus = false }) {
  return (
    <label
      data-hook="plan-tile"
      data-editable=""
      className="glass-card flex min-h-[7.5rem] cursor-text flex-col justify-between rounded-3xl p-4
                 ring-1 ring-inset ring-ink/50 transition-shadow duration-200 ease-settle
                 focus-within:ring-2 focus-within:ring-ink/60
                 focus-within:shadow-[0_0_0_4px_rgb(var(--c-accent)/0.4)]"
    >
      <span className="block">
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-label font-semibold uppercase leading-tight tracking-wider text-muted">
            {label}
          </span>
          <span className="shrink-0 text-label font-semibold text-muted">{symbol}</span>
        </span>
        {hint && <span className="mt-1 block text-label leading-tight text-muted">{hint}</span>}
      </span>
      <input
        type="text"
        inputMode="decimal"
        autoFocus={autoFocus}
        /* Wins over the tile's own text, which reads as two words plus a
           currency mark. The long-form label the tile dropped lives here. */
        aria-label={ariaLabel}
        value={value}
        placeholder={digits === 0 ? '0' : `0.${'0'.repeat(digits)}`}
        onChange={(e) => onChange(e.target.value)}
        className="mt-3 w-full min-w-0 border-0 bg-transparent p-0 font-display text-h2 font-semibold
                   leading-none text-ink outline-none [font-variant-numeric:tabular-nums]
                   placeholder:font-normal placeholder:text-muted"
      />
    </label>
  )
}

/**
 * A tile you cannot type in, because its number follows from the ones you can.
 *
 * Quieter than the two above it, so the grid reads as "these two you set, these
 * two are what that means" rather than as four fields, two of which mysteriously
 * refuse the caret.
 */
function PlanTile({ label, value }) {
  return (
    <div
      data-hook="plan-tile"
      className="glass-card glass-card-quiet flex min-h-[7.5rem] flex-col justify-between rounded-3xl p-4"
    >
      <p className="text-label font-semibold uppercase leading-tight tracking-wider text-muted">
        {label}
      </p>
      <p className="mt-3 font-display text-h2 font-semibold leading-none text-ink [font-variant-numeric:tabular-nums]">
        {value}
      </p>
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
  /* The envelopes. Their own fetch rather than part of loadBudget, because
     migration 37 may not have been run and a missing table must not take the
     whole money screen down with it. */
  const [allocRows, setAllocRows] = useState([])

  /* The savings ledger, and whether migration 39 has been run. Its own fetch
     for the same reason the envelopes have one: a table nobody has installed
     must not take the money screen down with it. */
  const [savings, setSavings] = useState([])
  const [savingsMissing, setSavingsMissing] = useState(false)

  /**
   * Which country to compare against, remembered.
   *
   * This one IS a preference, unlike the pane: a person's country does not
   * change between visits and asking again every time would be the app
   * forgetting something it was told. Detected once from the browser, then
   * whatever they picked wins for good.
   */
  const [country, setCountry] = useState(() => {
    try {
      const saved = localStorage.getItem('rf.bm.country')
      if (saved) return saved
    } catch {
      /* Private window. Fall through to detection, which needs no storage. */
    }
    return detectCountry(navigator.languages ?? [navigator.language].filter(Boolean))
  })

  const pickCountry = useCallback((code) => {
    setCountry(code)
    try {
      if (code) localStorage.setItem('rf.bm.country', code)
      else localStorage.removeItem('rf.bm.country')
    } catch {
      /* The pane still works for this session, which is what it is for. */
    }
  }, [])

  const load = useCallback(async () => {
    if (!user) return
    const r = await loadBudget(user.id)
    setMissing(r.missing)
    setPlan(r.plan)
    setFixed(r.fixed)
    setEntries(r.entries)
    setLoading(false)

    /* Soft, deliberately. Without migration 37 this comes back with an error
       and the screen carries on with no envelopes rather than an error page for
       a feature somebody has not installed. */
    const { data } = await supabase
      .from('budget_allocation')
      .select('period_start, category, amount_cents')
      .eq('user_id', user.id)
    setAllocRows(data ?? [])

    /* And the savings ledger, soft in the same way. `missing` is the table not
       existing, which is migration 39 not run; any other error leaves the pane
       empty rather than claiming the feature is uninstalled. */
    const sv = await supabase
      .from('budget_saving')
      .select('id, happened_on, amount_cents, source, period_start, note')
      .eq('user_id', user.id)
      .order('happened_on', { ascending: false })
    setSavingsMissing(Boolean(sv.error) && isMissingTable(sv.error))
    setSavings(sv.data ?? [])

    /* Soft in the same way: without migration 38 this returns `missing` and
       the pane shows an empty list rather than an error for a feature nobody
       has installed. */
    const pr = await loadProjects(user.id)
    setProjects(pr.projects)
    setProjMembers(pr.members)
    setProjEntries(pr.entries)
    /* Names for everybody in every project, including payers who have since
       left, so a ledger line never renders a blank name beside a real amount. */
    setProjProfiles(await loadProjectProfiles([
      ...pr.members.map((m) => m.user_id),
      ...pr.entries.map((e) => e.paid_by),
    ]))
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

  /* The envelopes for THIS period, and the one bar above them. Both read the
     real, logged figures: summarise.earned and summarise.spent. */
  const allocations = useMemo(
    () => allocationsFor(allocRows, localISO(s.period.start)),
    [allocRows, s.period.start],
  )
  const bar = useMemo(() => spendable({ earned: s.earned, spent: s.spent }), [s.earned, s.spent])

  /**
   * Which pane is showing.
   *
   * The money screen had grown to nine sections in one column: the headline,
   * the tiles, the button, the envelopes, planned-against-actual, the fixed
   * charges, this period's figures, where it went, and the last twenty
   * transactions. Logging a coffee meant scrolling past six things nobody had
   * asked for, which is the argument the check-in screen made about its own
   * four jobs before it grew this same bar.
   *
   * Not stored anywhere. A tab is where you are, not a preference, and
   * reopening the budget on "Journal" because that is where you finished last
   * time is the app remembering the wrong thing.
   */
  const [pane, setPane] = useState('overview')

  /* Shared project budgets. Held separately from the personal budget in every
     sense that matters: separate tables, separate policies, separate load.
     Nothing here can widen what a friend can see of the rows above. */
  const [projects, setProjects] = useState([])
  const [projMembers, setProjMembers] = useState([])
  const [projEntries, setProjEntries] = useState([])
  const [projProfiles, setProjProfiles] = useState({})
  const [openProject, setOpenProject] = useState(null)

  /* The full history is its own view, reached from the log pane. */
  const [history, setHistory] = useState(false)

  /* And so is a lesson, for the same reason: the menu is eight rows, which is
     too much to scroll past to reach a paragraph. Set by Formation, which owns
     which lesson is open; the chrome it hides belongs to this page. */
  const [reading, setReading] = useState(false)

  /**
   * What each tile says about itself.
   *
   * ActionBar's own note is why these exist: a bar that hides three quarters
   * of a screen leaves the reader no way to know whether the hidden parts are
   * done, half-filled or untouched. So each tile carries its count.
   */
  const liveFixed = fixed.filter((f) => f.active !== false)
  /* The same test summarise and the charge badges apply, so this count cannot
     disagree with the one inside the pane. */
  const paidFixed = liveFixed.filter((f) => {
    const d = String(f.last_paid_on ?? '').slice(0, 10)
    return Boolean(d) && d >= localISO(s.period.start) && d < localISO(s.period.end)
  }).length
  const funded = ENVELOPE_CATEGORIES.filter((k) => (allocations[k] ?? 0) > 0).length

  /**
   * The saving rate the comparison pane reads, computed here rather than there.
   *
   * Over the last twelve CLOSED months, which is the window the published
   * figures use. Null when nothing was ever logged as income, and the pane is
   * built to render that rather than to print a zero it did not measure.
   */
  const savHistory = savingsHistory({ entries, startDay: plan?.period_start_day ?? 1 })
  const myRate = recentRate({ history: savHistory, savings })

  /**
   * The window the shares table compares over: the last twelve CLOSED months.
   *
   * Not `s.byCategory`, which is this period. On the sixth of the month that is
   * two transactions, and the pane reported spending 67 % on food against a
   * national annual average of 15 %. Both figures were right; putting them in
   * one table was not. Empty until a month has closed, which is honest: there
   * is nothing yet to compare.
   */
  const bmClosed = savHistory.filter((r) => r.closed).slice(0, 12)
  const bmCategories = bmClosed.length
    ? spendOver(entries, bmClosed[bmClosed.length - 1].start, bmClosed[0].end)
    : []

  /**
   * Eight rows, and why each one is here.
   *
   * The ask was to think about which menus the budget actually needs, so:
   *
   *   overview   how am I doing. The default, and the only one most days.
   *   envelopes  what is each dollar for.
   *   savings    where the surplus goes. New.
   *   log        what happened, and the way through to the full history.
   *   plan       what I set up, against what happened.
   *   projects   the shared, ephemeral ones. Greece, the car, the flat.
   *   benchmarks how that compares to everybody else. New.
   *   formation  how to do any of this. New.
   *
   * Ordered by how often a row gets pressed rather than by category, so the
   * daily ones are under the thumb and the two you read once are at the end.
   *
   * Nothing was merged to keep the count down. `log` was the candidate, since
   * the overview already shows recent transactions, but it carries the category
   * donut and the overview does not, so folding it would have deleted a view
   * rather than tidied one.
   *
   * The rows themselves are ActionBar's, untouched. A new pane is an entry in
   * this array and an icon, which is the whole point of the component.
   */
  const panes = [
    {
      id: 'overview',
      icon: <GaugeIcon />,
      label: t('money.tab_overview'),
    },
    {
      id: 'envelopes',
      icon: <EnvelopeIcon />,
      label: t('money.tab_envelopes'),
    },
    {
      id: 'savings',
      icon: <PiggyIcon />,
      label: t('money.tab_savings'),
    },
    {
      id: 'log',
      icon: <ListIcon />,
      label: t('money.tab_log'),
    },
    {
      id: 'plan',
      icon: <PlanIcon />,
      label: t('money.tab_plan'),
    },
    {
      id: 'projects',
      icon: <SuitcaseIcon />,
      label: t('money.tab_projects'),
    },
    {
      id: 'benchmarks',
      icon: <ScaleIcon />,
      label: t('money.tab_benchmarks'),
    },
    {
      id: 'formation',
      icon: <BookIcon />,
      label: t('money.tab_formation'),
    },
  ]

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
    /* The ground the cards are glass over. Without it every .glass-card on
       this screen is just a white box with a blur that returns the colour it
       was given, which is what .glass has always degraded to app-wide. */
    <Screen className="ambient">
      <TopBar
        /* The heading follows you in. A page titled "Budget" that is showing
           a filtered list of June is a page lying about where you are. */
        title={history ? t('hist.title') : t('money.title')}
        sub={history ? t('hist.count', { n: entries.length }) : t('money.sub_period', { days: s.period.daysLeft })}
        right={
          /* Nothing to edit from inside the history, and "Modifier" there
             would read as an offer to edit the list. */
          history ? null : (
            /* An outlined pill, not btn-ghost. Ghost is edgeless by design,
               which works underneath a filled primary that has already
               established the row; alone in the corner of a heading it was
               indistinguishable from a line of bold text and read as a label
               rather than as the only control on the screen. */
            <button className="goal-action press" onClick={() => setEditing(true)}>
              {t('money.edit_plan')}
            </button>
          )
        }
      />

      {/**
       * The history takes over the whole body, not just the pane.
       *
       * "Instead of everything being on the same page" was the ask, and a
       * history rendered under the tab grid with the primary button still
       * above it is still the same page. With the chrome gone it reads as a
       * place you went to, which is what makes going back meaningful.
       */}
      {history ? (
        <Section>
          <TransactionHistory
            entries={entries}
            currency={s.currency}
            locale={locale}
            onOpen={setSheet}
            onBack={() => setHistory(false)}
          />
        </Section>
      ) : (
        <>
      {/* Gone while a lesson is open. See the note beside `reading`. */}
      {!reading && <ActionBar items={panes} value={pane} onChange={setPane} />}

      {/**
       * The one button that belongs to no pane.
       *
       * Logging a transaction is what this screen exists to enable, so it sits
       * above the panes for the same reason Submit sits outside the check-in's
       * four: hiding it behind a tab would mean navigating in order to record
       * a coffee. Everything else here is something you read.
       */}
      {!reading && (
        <Section>
          <button className="btn-primary press w-full" onClick={() => setSheet(NEW)}>
            {t('txn.open')}
          </button>
        </Section>
      )}

      {/**
       * One pane at a time, grouped by the question each answers.
       *
       * Overview is "how am I doing", in the three resolutions the screen has
       * for it: the gauge, the two squares, the figures. Envelopes is "what is
       * each dollar for". Plan is "what did I set up", the only pair here
       * about intentions rather than events. Log is "what actually happened".
       *
       * The fixed charges sit with the plan rather than the log, even though
       * marking one paid is an event: the list is the standing set of
       * obligations, which is something you arranged, and the payment is how
       * far through arranging it you are.
       */}
      {pane === 'overview' && (
        <>
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
           * The headline is now "what is left to spend", against real income.
           *
           * It used to be a day rate: what is free, divided by the days
           * remaining. That answers a question about pace, and pace is not the
           * question a zero-based budget asks. The question here is how much of
           * what actually arrived is still there, so the number is income minus
           * spending and the bar fills as the month runs down.
           *
           * The day rate has not been thrown away, it is in the tiles below,
           * where a secondary figure belongs.
           */
          <SpendableBar bar={bar} currency={s.currency} locale={locale} />
        )}
      </Section>

      {/* The shape of the month. Under the headline because it is the same
          fact over time, and full width because that is what a sparkline
          needs; see SpendTrend for what was here before and why it broke. */}
      <Section>
        <SpendTrend s={s} locale={locale} />
      </Section>

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
      {/**
       * Figures inside one sheet rather than lines lying on the page. Divided
       * rather than spaced: the hairlines are what say these are one set of
       * related numbers and not three unrelated ones.
       *
       * Every row here is something no other part of the pane shows. It used
       * to repeat the spent total, which is in the headline sentence, and to
       * label `available` "Restant" while the tile above labelled `balance`
       * "Restant" too. Those are different numbers, they differ by whatever
       * charges are still unpaid, and the pane read as though it could not
       * add up. The row says "after bills" now, and the charges it is net of
       * get a row of their own so the arithmetic is visible rather than
       * mysterious.
       */}
      <Section title={t('money.this_period')}>
        {/**
         * Four tiles, not four rows.
         *
         * The same four facts, but a grid gives each its own object with room
         * for the label above the figure, which is what lets the figure be
         * read at a size worth reading. A divided list gave every one of them
         * the same visual weight as a line of small print.
         *
         * Not aspect-square. The pair of tiles that used to live on this pane
         * were, and a caption in French does not fit in half a phone; these
         * size to their content and hold two short lines each.
         *
         * Every tile is something no other part of the pane shows. The spent
         * total is in the headline sentence and the balance IS the headline,
         * so neither is here.
         */}
        <div className="grid grid-cols-2 gap-3" data-hook="month-tiles">
          {[
            [t('money.after_bills'), fmt(s.available)],
            ...(s.fixedDue > 0 ? [[t('money.still_due'), fmt(s.fixedDue)]] : []),
            [t('money.per_day'), fmt(Math.max(0, s.perDay))],
            [t('money.days_left'), String(s.period.daysLeft)],
          ].map(([label, value]) => (
            /* The figure is pinned to the bottom, not stacked under the
               label. "Restant apres les charges" wraps to two lines and
               "Encore a payer" does not, so a value that simply follows its
               label sits at a different height in each tile and the row
               reads as misaligned rather than as a set. */
            <div
              key={label}
              className="glass-card flex min-h-[6.5rem] flex-col justify-between rounded-3xl p-4"
            >
              <p className="text-label font-semibold uppercase leading-tight tracking-wider text-muted">
                {label}
              </p>
              <p className="mt-2 font-display text-h2 leading-none text-ink [font-variant-numeric:tabular-nums]">
                {value}
              </p>
            </div>
          ))}
        </div>
      </Section>

        </>
      )}

      {pane === 'envelopes' && (
        <>
      {/* Every dollar that arrived, given a job. Above the plan because this is
          about money that is really there, and the plan is an estimate. */}
      <Section title={t('env.title')}>
        <Envelopes s={s} allocations={allocations} locale={locale} onChange={load} />
      </Section>

        </>
      )}

      {/* Where the surplus goes. See src/components/Savings.jsx for why the
          sweep is offered rather than taken. */}
      {pane === 'savings' && (
        <Savings
          userId={user?.id}
          plan={plan}
          entries={entries}
          savings={savings}
          currency={s.currency}
          locale={locale}
          missing={savingsMissing}
          onChange={load}
        />
      )}

      {/* You against published national figures, and nobody else's rows. */}
      {pane === 'benchmarks' && (
        <Benchmarks
          rate={myRate.rate}
          months={myRate.months}
          byCategory={bmCategories}
          country={country}
          onCountry={pickCountry}
          locale={locale}
        />
      )}

      {/* Six lessons, and each one ends in the pane it is about. */}
      {pane === 'formation' && (
        <Formation
          userId={user?.id}
          locale={locale}
          onOpenPane={setPane}
          onReading={setReading}
        />
      )}

      {pane === 'plan' && (
        <>
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

        </>
      )}

      {pane === 'log' && (
        <>
      {s.byCategory.length > 0 && (
        <Section title={t('money.where')}>
          <SpendDonut byCategory={s.byCategory} total={s.spent} currency={s.currency} locale={locale} />
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
      <Section
        title={t('money.recent')}
        /**
         * The way through to everything, beside the heading.
         *
         * It used to sit under the list, which meant scrolling past up to
         * eight rows to find it, and it was gated on having more than eight
         * entries in the first place. Both were wrong for what this leads to.
         * The history is not "more rows": it is the only place with the
         * filters, the search, and any period other than this one, so
         * somebody with three transactions needs it as much as somebody with
         * three hundred.
         *
         * Hidden only when there is genuinely nothing anywhere, since a link
         * to an empty screen is a dead end rather than an affordance.
         */
        action={
          entries.length > 0 ? (
            <button
              className="goal-action press shrink-0"
              data-hook="see-all"
              onClick={() => setHistory(true)}
            >
              {t('hist.see_all')}
            </button>
          ) : null
        }
      >
        {recent.length === 0 ? (
          <div className="lg px-5 py-2">
            <Empty>{t('money.no_entries')}</Empty>
          </div>
        ) : (
          <ul
            /* A stable hook. This list has been ul.lg and is now a slate card;
               anything keyed to the class breaks on the next restyle and says
               nothing about the app when it does. */
            data-ledger=""
            className="glass-card divide-y divide-hairline rounded-3xl px-4"
          >
            {recent.slice(0, 8).map((r) => (
              <li key={r.id}>
                {/* The row is the way back in. Remove used to be the only
                    thing you could do to a transaction from here, sitting as
                    an underlined word at the end of every line: twenty
                    invitations to delete something, and no way to fix a typo
                    short of taking one of them. */}
                <button
                  type="button"
                  onClick={() => setSheet(r)}
                  className="press flex w-full items-center gap-3 py-3.5 text-left"
                >
                  {/* The mark lands before the word does, which is what turns
                      a column of text into a list you can scan. Income gets
                      its own, because it is the one row here that is not a
                      spend and should not borrow a category's colour. */}
                  <CatDisc category={r.kind === 'income' ? 'income' : (r.category ?? 'other')} />
                  {/* Slate, like the donut card above it. The budget's own
                      surfaces are neutral now, and a ledger set in the theme's
                      pink beside a legend set in slate reads as two lists from
                      two different screens. */}
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
                    className={`shrink-0 text-body font-semibold [font-variant-numeric:tabular-nums] ${
                      r.excluded ? 'text-muted line-through' : r.kind === 'income' ? 'text-green' : 'text-ink'
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

        </>
      )}

      {/**
       * Shared, ephemeral budgets.
       *
       * A drill-down rather than a route: opening one swaps the pane's body
       * for the project and the back button swaps it back. A route would be
       * shareable, but the thing worth sharing is the invite code, and that
       * is on the project itself.
       */}
      {pane === 'projects' && (
        <Section>
          {openProject ? (
            (() => {
              const p = projects.find((x) => x.id === openProject)
              /* Left, or removed on another device, between the tap and the
                 render. Fall back to the list rather than to a blank pane. */
              if (!p) return <Projects
                userId={user?.id}
                projects={projects}
                members={projMembers}
                entries={projEntries}
                profiles={projProfiles}
                currency={s.currency}
                locale={locale}
                onOpen={setOpenProject}
                onChange={load}
              />
              return (
                <ProjectDetail
                  project={p}
                  members={projMembers.filter((m) => m.project_id === p.id)}
                  entries={projEntries.filter((e) => e.project_id === p.id)}
                  profiles={projProfiles}
                  userId={user?.id}
                  locale={locale}
                  onBack={() => setOpenProject(null)}
                  onChange={load}
                />
              )
            })()
          ) : (
            <Projects
              userId={user?.id}
              projects={projects}
              members={projMembers}
              entries={projEntries}
              profiles={projProfiles}
              currency={s.currency}
              locale={locale}
              onOpen={setOpenProject}
              onChange={load}
            />
          )}
        </Section>
      )}

        </>
      )}

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
  const { t, locale } = useT()
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

  /**
   * What the numbers on the form add up to, right now.
   *
   * Recomputed from the fields rather than from the saved plan, so the headline
   * answers the question you are in the middle of asking. Typing a rent of 1200
   * and watching the number at the top of the screen drop by 1200 is the only
   * feedback this form has ever offered, and without it the whole thing is data
   * entry with the result hidden behind a Save button.
   *
   * Charges that are paused do not count. `active` is the pause, and a paused
   * charge is money you are not being asked for this month.
   */
  const inCents = toCents(income) ?? 0
  const saveCents = toCents(savings) ?? 0
  const fixedCents = rows.reduce((n, r) => n + (r.active === false ? 0 : (toCents(r.amount) ?? 0)), 0)
  const left = inCents - saveCents - fixedCents
  const savedPct = inCents > 0 ? Math.round((saveCents / inCents) * 100) : 0

  /* The period is the calendar month, so the divisor is this month's length.
     Built from parts rather than by arithmetic on a timestamp: day 0 of next
     month is the last day of this one, and it stays right in February. */
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()

  const fmt = (cents) => money(cents, currency, locale)
  const leftParts = moneyParts(left, currency, locale)
  const { symbol } = currencySymbol(currency, [locale])

  return (
    /* The ground the glass is over. Without it every card here is a white box
       with a blur that returns the colour it was given, which is what the whole
       app's glass degrades to on a flat surface. The overview already carries
       it; the form used to be the one money screen that did not, and the cards
       it now uses are the same cards. */
    <Screen className="ambient">
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
      {/* `Screen` already carries pb-36 for the floating tab bar, so the pb-32
          that used to be here was a second clearance on top of the first: three
          hundred pixels of nothing under the save button. */}
      <div className="pt-4">
        {/**
         * The answer, above the questions.
         *
         * Same card as the one at the top of the overview, deliberately: this
         * form's whole job is to set the number that card shows, so seeing the
         * same card fill in as you type is the shortest possible explanation of
         * what any of these fields are for.
         */}
        <div
          data-card="plan-hero"
          className="glass-card relative overflow-hidden rounded-3xl bg-gradient-to-b from-white to-accent/[0.16] p-6"
        >
          {/* The badge rides the label's line rather than the bottom corner it
              started in. Pinned bottom-right it came within ten pixels of the
              end of the note in French and within eight in English, and the
              note is the string most likely to grow: one longer translation and
              a pill would have been sitting on top of a sentence. */}
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-label font-semibold uppercase tracking-wider text-muted">
              {t('money.plan_left')}
            </p>
            {/* Only once there is an income to be a percentage of. "0 % épargné"
                on an empty form is a fact about nothing. */}
            {inCents > 0 && (
              <span
                data-hook="pct"
                className="shrink-0 rounded-pill bg-accent/[0.35] px-3 py-1 text-label font-semibold text-ink"
              >
                {t('money.plan_saved_pct', { n: savedPct })}
              </span>
            )}
          </div>
          <p
            data-hook="amount"
            className={`mt-2 font-display text-hero leading-none [font-variant-numeric:tabular-nums] ${
              left < 0 ? 'text-negative' : 'text-ink'
            }`}
          >
            {leftParts.head}
            <span className="align-baseline text-[0.62em] text-muted">{leftParts.cents}</span>
            {leftParts.suffix}
          </p>
          <p className="mt-2.5 max-w-[26ch] text-small leading-relaxed text-muted">
            {left < 0 ? t('money.plan_over_note') : t('money.plan_left_note')}
          </p>
        </div>

        {/**
         * Two you set, two that follow.
         *
         * The long labels are gone from sight but not from the accessibility
         * tree: `aria-label` on each input still carries the full sentence, so
         * "Ce qui entre" on screen is still "Ce qui entre (revenu net mensuel)"
         * to a screen reader. A tile that reads as two words to everybody would
         * have been a real regression for anybody who cannot see the grid it
         * sits in.
         */}
        <div className="mt-3 grid grid-cols-2 gap-3" data-hook="plan-tiles">
          <AmountTile
            label={t('money.income_short')}
            hint={t('money.income_tile_hint')}
            ariaLabel={`${t('money.income')}. ${t('money.income_hint')}`}
            symbol={symbol}
            value={income}
            onChange={setIncome}
            digits={digits}
            autoFocus
          />
          <AmountTile
            label={t('money.savings_short')}
            hint={t('money.savings_tile_hint')}
            ariaLabel={`${t('money.savings')}. ${t('money.savings_hint')}`}
            symbol={symbol}
            value={savings}
            onChange={setSavings}
            digits={digits}
          />
          <PlanTile label={t('money.fixed_short')} value={fmt(fixedCents)} />
          <PlanTile label={t('money.plan_per_day')} value={fmt(Math.max(0, Math.round(left / daysInMonth)))} />
        </div>

        <Section
          title={t('money.fixed_short')}
          action={
            <button
              type="button"
              className="goal-action press"
              onClick={() => setRows((p) => [...p, { label: '', amount: '', active: true }])}
            >
              {t('money.add_fixed')}
            </button>
          }
        >
          <p className="-mt-2 mb-4 text-small text-muted">{t('money.fixed_hint')}</p>

          {rows.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-ink/15 p-6 text-center text-small text-muted">
              {t('money.fixed_none')}
            </p>
          ) : (
            <ul className="space-y-2.5">
              {rows.map((r, i) => (
                /**
                 * One charge, as a card rather than as three controls in a row.
                 *
                 * The amount keeps a filled well of its own because it is the
                 * one thing on the row you scan down a column of, and a bare
                 * number floating at the right edge of a card gives the eye no
                 * edge to line up on. The name does not: it is prose, it is
                 * left aligned against the card, and a second box inside the
                 * card would be two edges where one will do.
                 */
                <li
                  key={r.id ?? `new-${i}`}
                  data-hook="fixed-row"
                  className="glass-card flex items-center gap-2 rounded-3xl p-2.5"
                >
                  {/* px-1.5, not px-2.5. Every pixel of padding here comes off
                      the name, and at 390px the column only has so much: the
                      currency mark leaving the well and this padding coming in
                      took the name from 150px to 172px.

                      Measured, not assumed, and it is not a complete fix:
                      "Abonnement musique" wants 193px and is still two glyphs
                      short. An input scrolls rather than truncating, so the
                      name is readable by tapping into it, and getting the rest
                      would mean either a two-line row or a smaller face for the
                      one thing on the row you are reading. Nineteen characters
                      is where the single-line row runs out. */}
                  <input
                    aria-label={t('money.fixed_label_ph')}
                    className="min-w-0 flex-1 rounded-2xl border-0 bg-transparent px-1.5 py-2 text-body
                               font-semibold text-ink outline-none transition-colors duration-200 ease-settle
                               placeholder:font-normal placeholder:text-muted focus:bg-ink/[0.05]"
                    placeholder={t('money.fixed_label_ph')}
                    value={r.label}
                    onChange={(e) =>
                      setRows((p) => p.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                    }
                  />
                  {/* No currency mark in the well. The two tiles above already
                      say what unit this form is in, and repeating "$CA" on
                      every row cost the charge's own name thirty-four pixels
                      it needed: "Abonnement musique" was arriving as
                      "Abonnement m".

                      Same ink ring as the tiles, for the same reason and at the
                      same alpha. It buys slightly less here because it sits on
                      the raised fill rather than on white, but ringprobe
                      measures it at 3.26:1 in sun and 3.21:1 in sea, so it
                      still clears 1.4.11. */}
                  <span
                    className="flex shrink-0 items-baseline rounded-2xl bg-raised px-3 py-2
                               ring-1 ring-inset ring-ink/50 transition-shadow duration-200 ease-settle
                               focus-within:ring-2 focus-within:ring-ink/60
                               focus-within:shadow-[0_0_0_4px_rgb(var(--c-accent)/0.4)]"
                  >
                    <input
                      aria-label={`${t('money.fixed_label_ph')} ${symbol}`}
                      className="w-[4.75rem] min-w-0 border-0 bg-transparent p-0 text-right text-body font-semibold
                                 text-ink outline-none [font-variant-numeric:tabular-nums]
                                 placeholder:font-normal placeholder:text-muted"
                      inputMode="decimal"
                      placeholder={digits === 0 ? '0' : `0.${'0'.repeat(digits)}`}
                      value={r.amount}
                      onChange={(e) =>
                        setRows((p) => p.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))
                      }
                    />
                  </span>
                  {/* An icon, with the word as its accessible name. "Retirer"
                      underlined at the end of every row was a column of blue-ish
                      links down a list of money, and it took the width the name
                      of the charge needed. */}
                  <button
                    type="button"
                    aria-label={t('money.remove')}
                    className="press flex h-8 w-8 shrink-0 items-center justify-center rounded-pill
                               bg-ink/[0.06] text-muted transition-colors duration-200 ease-settle
                               hover:bg-ink/[0.12] hover:text-ink"
                    onClick={() => setRows((p) => p.filter((_, j) => j !== i))}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" {...stroke}>
                      <path d="M6 6 18 18M18 6 6 18" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <button className="btn-primary press mt-8" onClick={save} disabled={busy}>
          {busy ? t('money.saving') : t('money.save')}
        </button>
      </div>
    </Screen>
  )
}
