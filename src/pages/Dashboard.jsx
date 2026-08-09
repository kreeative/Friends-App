import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { listBooks } from '../lib/library'
import { completionRate, rollingRate } from '../lib/stats'
import { cycleEnd, cyclePhase, soonestUpcoming, untilLabel } from '../lib/time'
import { useT } from '../lib/i18n'
import { Screen, Section, TopBar } from '../components/ui'
import ConsistencyPanel from '../components/ConsistencyPanel'
import WeekStrip from '../components/WeekStrip'
import MoodToday from '../components/MoodToday'
import BudgetToday from '../components/BudgetToday'
import BudgetBanner from '../components/BudgetBanner'
import { stickerFor } from '../lib/art'

/**
 * Home base.
 *
 * Signing in used to land you inside whichever group happened to come back
 * first, with no address for it and no way out that wasn't signing out. This
 * is the page that owns you rather than a group: what you are in, how you
 * are doing across all of it, and what you have bought.
 *
 * Everything here is scoped to the signed-in user. Nothing on this page
 * belongs to one group, which is the whole distinction it exists to draw.
 */

/**
 * A group, as a row rather than as a card.
 *
 * This page used to be six boxes stacked on top of each other. Groups,
 * stats, books, all in their own rounded rectangle. At that point the
 * rectangle stops meaning "these things belong together" and becomes the
 * texture of the page. Rows with one hairline between them separate exactly
 * as well and put nothing on screen that is not information.
 *
 * The sticker is the group's identity. It is picked from the id, so it is
 * stable for the life of the group without needing a column to store it,
 * and it is the illustration doing the work a repeated logo was doing badly.
 */
function GroupRow({ membership, rows, t }) {
  const g = membership.groups
  const mine = rows.filter((r) => r.group_id === g.id)
  const cadence = g.cadence_days ?? null

  /**
   * The period you are in, and failing that the next one to start.
   *
   * This line used to read `open ?? mine[0]`, and mine is sorted newest
   * first, so with no open period it named the furthest one the database had
   * materialised. Four periods ahead on a weekly group is "next one opens in
   * 23d" on the dashboard of a group that meets on Sunday. Nothing was
   * actually locked for a month; the row was reading the wrong row. It is
   * fixed twice over: soonestUpcoming picks the nearest, and a period now
   * runs until the next one starts, so there is almost always an open one.
   */
  const open = mine.find((r) => cyclePhase(r, mine, cadence) === 'open')
  const cycle = open ?? soonestUpcoming(mine, cadence)
  const meIn = open && open.status === 'submitted'

  const inCycle = open ? rows.filter((r) => r.cycle_id === open.cycle_id) : []
  const done = inCycle.filter((r) => r.status === 'submitted').length
  const ends = open ? cycleEnd(open, mine, cadence): null

  const art = stickerFor(g.id)

  return (
    <Link
      to={`/g/${g.id}`}
      className="press group flex items-center gap-4 py-5 no-underline"
    >
      <img
        src={art}
        alt=""
        aria-hidden="true"
        loading="lazy"
        className="h-14 w-14 shrink-0 object-contain transition-transform duration-200 ease-settle group-hover:-rotate-6"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3">
          <h3 className="truncate text-h2 text-ink">{g.name}</h3>
        </div>
        <p className="mt-0.5 text-small text-muted">
          {open
            ? `${t('home.n_of_total', { n: done, total: inCycle.length })} · ${t('board.reveals_in', { t: untilLabel(ends) })}`
            : cycle
              ? t('board.next_opens_in', { t: untilLabel(cycle.opens_at) })
              : t('board.getting_ready')}
        </p>

        {open && (
          <div className="mt-3 h-1 w-full overflow-hidden rounded-pill bg-ink/[0.08]">
            <div
              className="h-full rounded-pill bg-green transition-[width] duration-500 ease-settle"
              style={{ width: `${inCycle.length ? (done / inCycle.length) * 100 : 0}%` }}
            />
          </div>
        )}
      </div>

      {/* Waiting-on-you is the only state that should pull the eye, so it is
          the only one that gets the accent. */}
      {open && (
        <span className={meIn ? 'chip-green shrink-0' : 'chip-accent shrink-0'}>
          {meIn ? t('board.state_in') : t('board.check_in')}
        </span>
      )}
    </Link>
  )
}

export default function Dashboard() {
  const { user, profile } = useAuth()
  const { memberships, loading } = useGroup()
  const { t, locale } = useT()

  const [rows, setRows] = useState([])
  const [books, setBooks] = useState([])
  const [goals, setGoals] = useState([])

  /**
   * One read for every group at once. member_cycle_status is already scoped
   * by RLS to groups you are in, so this does not need a group filter, and
   * fetching per-card would be a request per group on first paint.
   */
  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      const [st, gl, bk] = await Promise.all([
        supabase
          .from('member_cycle_status')
          .select('*')
          .order('opens_at', { ascending: false })
          .limit(400),
        supabase
          .from('goals')
          /* commitment and the two dates are for the week strip: it names the
             goals a given day actually had, and a goal that had not started
             yet on Tuesday was not one of Tuesday's. */
          .select('id, group_id, status, kind, owner_id, commitment, starts_on, ends_on')
          .eq('owner_id', user.id)
          .eq('status', 'active'),
        listBooks().catch(() => []),
      ])
      if (cancelled) return
      setRows(st.data ?? [])
      setGoals(gl.data ?? [])
      setBooks(bk)
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  // Consistency across every group, not per group. Someone in two groups has
  // one habit, and splitting the number in two only flatters the better half.
  const mine = useMemo(() => rows.filter((r) => r.user_id === user?.id), [rows, user?.id])
  const rate = completionRate(mine, 14)
  const trend = useMemo(() => rollingRate(mine, { window: 3, points: 12 }), [mine])

  const owned = books.filter((b) => b.owned)

  /**
   * The one thing that is actually waiting on you.
   *
   * A dashboard that only lists things is a filing cabinet. The whole point
   * of this app is a window that is open right now, so if there is one, it
   * gets said before anything else on the page, and if there are several,
   * it is the one closing soonest, because that is the one you can still
   * miss.
   */
  const waiting = useMemo(() => {
    /* Per group, because when a period ends depends on when that group's
       next one starts, and mine holds every group at once. */
    const open = []
    for (const m of memberships) {
      const cadence = m.groups?.cadence_days ?? null
      const rows = mine.filter((r) => r.group_id === m.group_id)
      for (const r of rows) {
        if (cyclePhase(r, rows, cadence) !== 'open') continue
        if (r.status === 'submitted' || r.status === 'away') continue
        open.push({ row: r, group: m.groups, ends: cycleEnd(r, rows, cadence) })
      }
    }
    open.sort((a, b) => new Date(a.ends) - new Date(b.ends))
    return open[0] ?? null
  }, [mine, memberships])

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? t('home.morning') : hour < 18 ? t('home.afternoon') : t('home.evening')

  const first = (profile?.display_name ?? '').split(' ')[0]

  return (
    <Screen>
      <TopBar
        title={first ? `${greeting}, ${first}.` : greeting}
        sub={waiting ? undefined : t('home.sub')}
      />

      {/**
       * The week, directly under the greeting and above everything that is a
       * feed item.
       *
       * It is not part of the feed. The banner, the waiting card and the
       * sections below all answer "what should I do now"; the strip answers
       * "where am I", which is the question the rest of the page is read
       * against. Chrome for the page, so it sits above the first thing the
       * page has to say rather than competing with it for the top slot.
       */}
      <div className="pt-6">
        <WeekStrip goals={goals} statuses={mine} />
      </div>

      {/**
       * First thing in the feed, above even the waiting-on-you card.
       *
       * It is in the normal flow rather than pinned or floating, so it pushes
       * the rest of the page down instead of sitting over the header, and it
       * leaves with the same transition it arrives with, which means the feed
       * closes the gap smoothly on dismissal rather than snapping shut.
       *
       * It outranks the waiting card only because it is temporary: it appears
       * once, is dismissed once, and is then gone for good, whereas the
       * waiting card is the page's permanent first priority and gets that
       * position back immediately.
       */}
      <BudgetBanner />

      {/**
       * The one block of colour on the page, and it is the size of the thing
       * it is announcing. A dashboard of white rows is a filing cabinet; the
       * field colour lands here because this is the only row that is asking
       * for something.
       *
       * The accent rather than the field, because the ground is the field
       * now, a block of the same colour on the same colour is not a block.
       * Black on it either way by system rule: 4.9:1 on pink, 13.5:1 on
       * yellow.
       */}
      {waiting && (
        <div className="animate-rise pt-6">
          <Link
            to={`/g/${waiting.group.id}/checkin`}
            className="press group block rounded-card bg-accent p-6 no-underline transition-transform duration-200 ease-settle hover:-translate-y-0.5 sm:p-7"
          >
            <span className="block text-label font-bold uppercase tracking-[0.14em] text-on-accent/70">
              {t('board.reveals_in', { t: untilLabel(waiting.ends) })}
            </span>
            <span className="mt-3 block text-h1 font-bold leading-[1.05] tracking-[-0.024em] text-on-accent">
              {t('home.waiting_on_you', { group: waiting.group.name })}
            </span>
            <span className="mt-5 inline-flex items-center gap-2 rounded-pill bg-on-accent px-5 py-2.5 text-small font-bold text-accent">
              {t('board.check_in')}
              <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">
                →
              </span>
            </span>
          </Link>
        </div>
      )}

      {/* First thing under the greeting. Asking how someone is before asking
          what they got done is the whole order of operations this product
          argues for, and it was previously buried inside a check-in window
          that is shut six days out of seven. */}
      <Section title={t('mood.question')}>
        <MoodToday groupCount={memberships.length} />
      </Section>

      {/* Renders its own Section, so it vanishes heading and all when there is
          no plan yet or the migration has not been run. Placed above groups
          because it is about today and the group list is about other people. */}
      <BudgetToday />

      <Section title={t('home.your_groups')} action={
        memberships.length > 0 && (
          <Link to="/start" className="text-small text-ink underline-offset-4 hover:underline">
            {t('home.new')}
          </Link>
        )
      }>
        {loading ? (
          <p className="text-small text-muted">{t('err.loading')}</p>
        ) : memberships.length === 0 ? (
          <div className="lg p-6">
            <p className="max-w-[38ch] text-body text-muted">{t('home.no_groups')}</p>
            <Link to="/start" className="btn-primary press mt-6 inline-flex">
              {t('start.new_group')}
            </Link>
          </div>
        ) : (
          <div className="lg px-5">
            <div className="list">
              {memberships.map((m) => (
                <GroupRow key={m.group_id} membership={m} rows={rows} t={t} />
              ))}
            </div>
          </div>
        )}
      </Section>

      <Section title={t('home.you_overall')}>
        <ConsistencyPanel
          rate={rate}
          trend={trend}
          cycles={mine}
          goalCount={goals.length}
          groupCount={memberships.length}
        />
        <p className="mt-4 text-small text-muted">{t('me.rate_note')}</p>
      </Section>

      <Section
        title={t('home.your_books')}
        action={
          <Link to="/library" className="text-small text-ink underline-offset-4 hover:underline">
            {t('library.read')}
          </Link>
        }
      >
        {owned.length === 0 ? (
          <div className="lg p-6">
            <p className="max-w-[38ch] text-body text-muted">{t('home.no_books')}</p>
            <Link to="/library" className="btn-outline press mt-6 inline-flex">
              {t('library.read_free')}
            </Link>
          </div>
        ) : (
          <div className="lg px-5">
            <div className="list">
            {owned.map((b) => (
              <Link
                key={b.id}
                to={`/library/${b.slug}`}
                className="press flex items-baseline justify-between gap-4 py-5 no-underline"
              >
                <span className="min-w-0">
                  <span className="block truncate text-h2 text-ink">{b.title}</span>
                  {b.subtitle && (
                    <span className="mt-0.5 block text-small text-muted">{b.subtitle}</span>
                  )}
                </span>
                {b.progress?.scroll_pct != null && (
                  <span className="shrink-0 text-small text-muted">
                    {t('library.progress', { pct: Math.round(b.progress.scroll_pct) })}
                  </span>
                )}
              </Link>
            ))}
            </div>
          </div>
        )}
      </Section>
    </Screen>
  )
}
