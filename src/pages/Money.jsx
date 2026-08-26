import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { money, moneyParts } from '../lib/money'
import { summarise } from '../lib/budget'
import { currencySymbol, minorDigits } from '../lib/currency'
import { clearDraft, hasFreshDraft, readDraft, useDraft } from '../lib/draft'
import { loadBudget } from '../lib/budgetData'
import { errorText, isMissingColumn, isMissingTable, isNetworkError } from '../lib/dberr'
import { ageBandOf, detectCountry, spendOver } from '../lib/benchmarks'
import { history as savingsHistory, recentRate, savedTotal } from '../lib/savings'
import { fromCents, localISO, toCents, txnPayload, withoutField } from '../lib/txn'
import { Empty, Screen, Section, TopBar } from '../components/ui'
import { EnvelopeIcon, PiggyIcon, PlanIcon, SuitcaseIcon } from '../components/ActionBar'
import BudgetShortcuts from '../components/BudgetShortcuts'
import WealthRank from '../components/WealthRank'
import Savings from '../components/Savings'
import TransactionHistory, { TxnRow } from '../components/TransactionHistory'
import Projects from '../components/Projects'
import ProjectDetail from '../components/ProjectDetail'
import { loadProjectProfiles, loadProjects } from '../lib/projectData'
import BudgetIntro from '../components/BudgetIntro'
import TransactionSheet from '../components/TransactionSheet'
import PlanVsActual from '../components/PlanVsActual'
import Envelopes, { SpendableBar } from '../components/Envelopes'
import { ENVELOPE_CATEGORIES, allocationsFor, spendable, toAllocate, totalAllocated } from '../lib/envelope'
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
 * Every :pane the budget answers to.
 *
 * The list is here rather than derived from the cards below because it also
 * has to accept `history`, which is a sub-page with a heading and a back
 * button like the other four but is reached from the primary button rather
 * than from the section grid. Anything not in this list renders the
 * dashboard, so a typed or stale URL lands somewhere real.
 */
const PANES = ['envelopes', 'plan', 'projects', 'savings', 'history']

/**
 * How many transactions the budget's own page shows.
 *
 * Five, not the twenty the old log pane carried. A dashboard's job with a log
 * is to answer "did that go in", which the newest row answers by itself, and
 * to offer the way to the real question, which is the link beside the heading.
 * Twenty answers neither and pushes the rank card off the first screen.
 */
const RECENT = 5

/** "There is no number here", the way the rest of the screen already spells
    it. An en dash, not an em dash: see CLAUDE.md. */
const NO_FIGURE = '\u2013'

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

  /**
   * THE SECTIONS ARE PAGES NOW, AND THE URL IS WHERE THAT LIVES.
   *
   * They used to be `useState('envelopes')` under a row of pills: tapping one
   * swapped a block in the middle of a screen that kept its heading, its hero
   * card, its primary button and its rank card. That is a tab, and it was
   * asked to behave as navigation. Two things were wrong with it and both are
   * fixed by the address bar rather than by styling:
   *
   *   The system back gesture did nothing. Opening Haut Budget and swiping
   *   back left the budget entirely, because as far as the browser was
   *   concerned you had never gone anywhere.
   *
   *   Nothing was linkable. /money was every section at once, so there was no
   *   way to send somebody, or yourself, to the one you meant.
   *
   * So a section is a route: /money/envelopes, /money/plan, /money/projects,
   * /money/savings, and /money/history for the full transaction list. Bare
   * /money is the dashboard.
   *
   * ONE COMPONENT, NOT FIVE ROUTES WITH FIVE FETCHES. Every section reads the
   * same plan, the same entries, the same allocations. Splitting them into
   * sibling route elements would mean five copies of loadBudget and five
   * chances for two of them to disagree about what this period is. React
   * Router points all six paths at this component and the param picks the
   * body, so navigation is a render rather than a reload and the numbers on a
   * section are the numbers the dashboard just showed.
   *
   * An unknown param is the dashboard rather than a crash: /money/typo is a
   * URL somebody can type.
   */
  const { pane: param } = useParams()
  const navigate = useNavigate()
  const pane = PANES.includes(param) ? param : null
  const openPane = (id) => navigate(`/money/${id}`)
  const toBudget = () => navigate('/money')

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
    const svMissing = Boolean(sv.error) && isMissingTable(sv.error)
    /* The migration name left the interface and did not leave the codebase.
       Somebody looking at a "not available yet" card needs to know it is a
       migration, and the person who needs to know that is looking at a console,
       not at a budget. */
    if (svMissing) console.warn('budget_saving is missing: run supabase/39_budget_savings.sql')
    setSavingsMissing(svMissing)
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

  /* The envelopes for THIS period, and the one bar above them. Both read the
     real, logged figures: summarise.earned and summarise.spent. */
  const allocations = useMemo(
    () => allocationsFor(allocRows, localISO(s.period.start)),
    [allocRows, s.period.start],
  )
  const bar = useMemo(() => spendable({ earned: s.earned, spent: s.spent }), [s.earned, s.spent])

  /**
   * The last few transactions, newest first.
   *
   * Up here with the other derived values rather than beside the JSX that
   * uses it, because everything below the `loading`, `missing` and intro
   * branches is past an early return. A hook after one of those runs on some
   * renders and not others, which React counts and refuses: it cost a
   * "rendered more hooks than during the previous render" and a blank budget.
   *
   * `id` breaks the tie, so two transactions logged on the same day come out
   * in a stable order rather than in whatever order the fetch happened to
   * return them.
   */
  const recent = useMemo(
    () =>
      [...entries]
        .sort(
          (a, b) =>
            String(b.happened_on).localeCompare(String(a.happened_on)) ||
            String(b.id).localeCompare(String(a.id)),
        )
        .slice(0, RECENT),
    [entries],
  )

  /* Shared project budgets. Held separately from the personal budget in every
     sense that matters: separate tables, separate policies, separate load.
     Nothing here can widen what a friend can see of the rows above. */
  const [projects, setProjects] = useState([])
  const [projMembers, setProjMembers] = useState([])
  const [projEntries, setProjEntries] = useState([])
  const [projProfiles, setProjProfiles] = useState({})
  const [openProject, setOpenProject] = useState(null)

  /* A section's own drill-down does not survive leaving the section, which is
     the point of leaving it. Without this, going back to the budget and into
     Haut Budget again reopens whichever project you were last inside, which
     as a tab was merely odd and as a route is a page that does not match its
     own URL. */
  useEffect(() => {
    if (pane !== 'projects') setOpenProject(null)
  }, [pane])

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
  /* The age band, from the birthday already on the profile. Null when there is
     none, and the sheet says so and offers the fallback rather than guessing an
     age or silently comparing against the country as though it had been asked
     for. */
  const ageBand = ageBandOf(profile?.birthday)

  const bmClosed = savHistory.filter((r) => r.closed).slice(0, 12)
  const bmCategories = bmClosed.length
    ? spendOver(entries, bmClosed[bmClosed.length - 1].start, bmClosed[0].end)
    : []

  /**
   * Four pillars, and everything that used to be a tab and is not one now.
   *
   * The bar had eight items and four of them did not belong to it:
   *
   *   Apercu       was never a section, it was the page. It is the bento and
   *                the rank card at the top now, always on, never selected.
   *   Historique   the transaction list. Gone as a tab; the full history is
   *                one button away under the primary action, which is a
   *                better home for it than a tab you had to be on to search.
   *   Comparaison  a whole pane for one number. It is the rank card now, and
   *                its methodology is fine print inside a sheet.
   *   Formation    a course does not belong in a budget's tab strip. It lives
   *                on Lectures, with the rest of the reading.
   *
   * What is left is the four things a budget IS: this month's spending, the
   * standing arrangement behind it, the one-off projects beside it, and what
   * survives the month.
   */
  const allocated = totalAllocated(allocations)
  /* Only what a category was given a job for. s.spent includes the categories
     with no envelope, and dividing that by the allocated total draws an arc
     past full for a month nobody overspent. */
  const inEnvelopes = s.byCategory.reduce(
    (n, c) => n + (ENVELOPE_CATEGORIES.includes(c.key) ? c.cents : 0),
    0,
  )
  const saved = savedTotal(savings)
  const target = Number(plan?.savings_target_cents) || 0

  /**
   * The four sections, and the one live number each one is worth opening for.
   *
   * The numbers are the whole reason this is a grid of cards rather than a row
   * of names. A section is a page away now, so "is there anything in Haut
   * Budget" has to be answerable without going there, or the dashboard has
   * sent you on a round trip to find out there was nothing.
   *
   * `dim` is "nothing set up yet", and it changes what the card says rather
   * than only how it looks: a grey zero and a black zero are the same claim,
   * and WCAG 1.4.1 wants the difference carried by something other than the
   * colour anyway. Each dim branch prints the word for "not set up" instead of
   * a figure nobody entered.
   */
  const shortcuts = [
    {
      id: 'envelopes',
      icon: <EnvelopeIcon />,
      label: t('money.tab_envelopes'),
      well: 'bg-cat-1-soft',
      pct: allocated > 0 ? Math.round((inEnvelopes / allocated) * 100) : 0,
      dim: funded === 0,
      value: String(funded),
      word: t('money.sc_env', { n: ENVELOPE_CATEGORIES.length }),
    },
    {
      id: 'plan',
      icon: <PlanIcon />,
      label: t('money.tab_plan'),
      well: 'bg-cat-2-soft',
      pct: liveFixed.length > 0 ? Math.round((paidFixed / liveFixed.length) * 100) : null,
      dim: liveFixed.length === 0,
      value: String(paidFixed),
      word: liveFixed.length === 0 ? t('money.sc_plan_none') : t('money.sc_plan', { n: liveFixed.length }),
    },
    {
      id: 'projects',
      icon: <SuitcaseIcon />,
      label: t('money.tab_projects'),
      well: 'bg-cat-3-soft',
      /* No denominator exists. Three shared projects is not three out of
         anything, so the card wears the section's own mark rather than a ring
         drawn at a fraction nobody measured. */
      pct: null,
      dim: projects.length === 0,
      value: String(projects.length),
      word: t('money.sc_projects'),
    },
    {
      id: 'savings',
      icon: <PiggyIcon />,
      label: t('money.tab_savings'),
      well: 'bg-cat-5-soft',
      pct: target > 0 ? Math.round((saved / target) * 100) : null,
      dim: savingsMissing || saved === 0,
      /* The one card with no number to print. Every other zero here is a
         measured zero: no envelope funded, no charge paid, no project. A
         savings table that has never been installed is not a zero, it is an
         absence, and printing 0,00 $ would be the screen inventing a figure.
         The en dash is what PlanVsActual already uses for the same thing. */
      value: savingsMissing ? NO_FIGURE : fmt(saved),
      word: savingsMissing ? t('money.sc_sav_none') : t('money.sc_sav'),
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

  /**
   * The five sub-pages, by the name each one wears at the top of itself.
   *
   * The heading follows you in. A page still titled "Budget" while it is
   * showing a filtered list of June is a page lying about where you are, and
   * that was already true of the history before any of these were routes.
   */
  const PANE_TITLE = {
    envelopes: t('money.tab_envelopes'),
    plan: t('money.tab_plan'),
    projects: t('money.tab_projects'),
    savings: t('money.tab_savings'),
    history: t('hist.title'),
  }

  return (
    /* The ground the cards are glass over. Without it every .glass-card on
       this screen is just a white box with a blur that returns the colour it
       was given, which is what .glass has always degraded to app-wide. */
    <Screen className="ambient">
      <TopBar
        title={pane ? PANE_TITLE[pane] : t('money.title')}
        sub={
          pane === 'history'
            ? t('hist.count', { n: entries.length })
            : t('money.sub_period', { days: s.period.daysLeft })
        }
        /* Only on a sub-page, and it is the whole reason TopBar grew the
           prop. On the budget itself there is nothing above to go back to:
           the app's own tab bar is where you leave from. */
        back={pane ? toBudget : undefined}
        backLabel={t('hist.back')}
        right={
          /**
           * Editing the plan belongs to the two screens it is about.
           *
           * Inside the history "Modifier" reads as an offer to edit the list,
           * and inside Enveloppes or Haut Budget it offers to edit something
           * that is not on screen. It stays on the budget, where setup starts,
           * and on Plan & Fixe, which is the page the plan IS.
           *
           * An outlined pill, not btn-ghost. Ghost is edgeless by design,
           * which works underneath a filled primary that has already
           * established the row; alone in the corner of a heading it was
           * indistinguishable from a line of bold text and read as a label
           * rather than as the only control on the screen.
           */
          pane === null || pane === 'plan' ? (
            <button className="goal-action press" onClick={() => setEditing(true)}>
              {t('money.edit_plan')}
            </button>
          ) : null
        }
      />

      {pane === null && (
        <>
          {/**
           * 1. WHAT IS LEFT, AND NOTHING ABOVE IT.
           *
           * The one number the whole screen is for. It used to live inside the
           * overview tab, which meant it vanished the moment you looked at
           * anything else; now the sections are pages and it is what the
           * budget's own page opens with.
           *
           * Overcommitted replaces it rather than sitting beside it. That
           * state means the plan itself does not close, so no amount of
           * careful spending fixes it, and showing a spendable figure
           * underneath a warning that the figure is unreachable would be
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
              <SpendableBar bar={bar} currency={s.currency} locale={locale} />
            )}
          </Section>

          {/* 2. The one thing this screen exists to enable, above the sections
                for the same reason Submit sits outside the check-in's four:
                hiding it behind navigation would mean navigating in order to
                record a coffee. */}
          <Section>
            <button className="btn-primary press w-full" onClick={() => setSheet(NEW)}>
              {t('txn.open')}
            </button>
          </Section>

          {/* 3. The four sections, as cards that go somewhere. */}
          <Section title={t('money.sections')}>
            <BudgetShortcuts items={shortcuts} onOpen={openPane} />
          </Section>

          {/**
           * 4. THE LAST FEW, AND THE WAY TO ALL OF THEM.
           *
           * Five rows, not twenty. A dashboard's job with a log is to answer
           * "did that go in", which the newest row answers on its own, and to
           * offer the way to the real question, which is the link beside the
           * heading. Twenty rows answers neither and costs the rank card its
           * place on the first screen.
           *
           * The rows are TransactionHistory's own row component rather than a
           * second rendering of the same fact. They had already drifted once:
           * the excluded badge and the strike-through were added to the
           * history and never reached the summary, so a transaction marked as
           * not counting looked exactly like one that did.
           */}
          <Section
            title={t('money.recent')}
            action={
              entries.length > 0 && (
                <button
                  className="goal-action press shrink-0"
                  data-hook="all-txn"
                  onClick={() => openPane('history')}
                >
                  {t('hist.see_all')}
                </button>
              )
            }
          >
            {recent.length === 0 ? (
              <div className="glass-card rounded-3xl p-5">
                <Empty>{t('hist.none')}</Empty>
              </div>
            ) : (
              <ul className="glass-card divide-y divide-hairline rounded-3xl px-4">
                {recent.map((r) => (
                  <TxnRow
                    key={r.id}
                    row={r}
                    currency={s.currency}
                    locale={locale}
                    onOpen={setSheet}
                  />
                ))}
              </ul>
            )}
          </Section>

          {/* 5. One number, one card, one sheet. See WealthRank for what this
                replaced and why the methodology is fine print now. */}
          <Section>
            <WealthRank
              rate={myRate.rate}
              months={myRate.months}
              country={country}
              band={ageBand}
              onAddTransaction={() => setSheet(NEW)}
            />
          </Section>
        </>
      )}

      {/* Every transaction ever, with its own filters and its own donut. Its
          back button used to be the first thing in its body; the heading
          carries it now, so the page does not offer two ways back. */}
      {pane === 'history' && (
        <Section>
          <TransactionHistory
            entries={entries}
            currency={s.currency}
            locale={locale}
            onOpen={setSheet}
          />
        </Section>
      )}

      {/* Every dollar that arrived, given a job. */}
      {pane === 'envelopes' && (
        <Section title={t('env.title')}>
          <Envelopes s={s} allocations={allocations} locale={locale} onChange={load} />
        </Section>
      )}

      {pane === 'plan' && (
        <>
          {/* What was meant to happen, against what has. The gap between the
              two columns is the interesting part, and it is the thing the old
              single column could not show because it had already merged
              them. */}
          <Section title={t('money.plan_vs_actual')}>
            <PlanVsActual s={s} locale={locale} />
          </Section>

          {/* And the charges themselves, each one planned until you say it
              went out. This is the control the app never had: with no way to
              mark a charge paid, the arithmetic had to assume always or
              never. */}
          {liveFixed.length > 0 && (
            <Section title={t('money.fixed_title')}>
              <FixedCharges fixed={fixed} s={s} locale={locale} onChange={load} />
            </Section>
          )}
        </>
      )}

      {/**
       * Shared, ephemeral budgets.
       *
       * The project drill-down stays a drill-down rather than becoming
       * /money/projects/:id. A route would be shareable, and the thing worth
       * sharing about a project is its invite code, which is on the project
       * itself and works whether or not the URL does. Its own back button
       * returns to the list; the heading's returns to the budget.
       */}
      {pane === 'projects' && (
        <Section>
          {openProject ? (
            (() => {
              const p = projects.find((x) => x.id === openProject)
              /* Left, or removed on another device, between the tap and the
                 render. Fall back to the list rather than to a blank page. */
              if (!p)
                return (
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
                )
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
          className="glass-card relative overflow-hidden rounded-3xl bg-gradient-to-br from-cat-1-soft via-white to-cat-5-soft p-6"
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
