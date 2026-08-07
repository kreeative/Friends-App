import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { listBooks } from '../lib/library'
import { completionRate } from '../lib/stats'
import { cyclePhase, untilLabel } from '../lib/time'
import { useT } from '../lib/i18n'
import { Screen, Section, TopBar } from '../components/ui'
import Character, { CREW } from '../components/Character'

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
 * This page used to be six boxes stacked on top of each other — groups,
 * stats, books, all in their own rounded rectangle. At that point the
 * rectangle stops meaning "these things belong together" and becomes the
 * texture of the page. Rows with one hairline between them separate exactly
 * as well and put nothing on screen that is not information.
 *
 * The face is the group's identity. It is picked from the id, so it is
 * stable for the life of the group without needing a column to store it —
 * and it is the illustration doing the work a repeated logo was doing badly.
 */
function GroupRow({ membership, rows, t }) {
  const g = membership.groups
  const mine = rows.filter((r) => r.group_id === g.id)

  const open = mine.find((r) => cyclePhase(r) === 'open')
  const cycle = open ?? mine[0] ?? null
  const meIn = open && open.status === 'submitted'

  const inCycle = open ? rows.filter((r) => r.cycle_id === open.cycle_id) : []
  const done = inCycle.filter((r) => r.status === 'submitted').length

  // Sum of the id's hex digits — any stable hash would do; this one needs no
  // import and cannot throw on a malformed id.
  const face = CREW[[...g.id.replace(/-/g, '')].reduce((a, c) => a + (parseInt(c, 16) || 0), 0) % CREW.length]

  return (
    <Link
      to={`/g/${g.id}`}
      className="press group flex items-center gap-4 py-5 no-underline"
    >
      <Character
        who={face}
        size={52}
        className="shrink-0 transition-transform duration-200 ease-settle group-hover:-rotate-6"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3">
          <h3 className="truncate text-h2 text-ink">{g.name}</h3>
        </div>
        <p className="mt-0.5 text-small text-muted">
          {open
            ? `${t('home.n_of_total', { n: done, total: inCycle.length })} · ${t('checkin.closes_in', { t: untilLabel(open.closes_at) })}`
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
   * by RLS to groups you are in, so this does not need a group filter — and
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
          .select('id, group_id, status, kind, owner_id')
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

  const owned = books.filter((b) => b.owned)
  const reading = owned.find((b) => b.progress)

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? t('home.morning') : hour < 18 ? t('home.afternoon') : t('home.evening')

  const first = (profile?.display_name ?? '').split(' ')[0]

  return (
    <Screen>
      <TopBar title={first ? `${greeting}, ${first}.` : greeting} sub={t('home.sub')} />

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
          <div className="py-2">
            <p className="max-w-[38ch] text-body text-muted">{t('home.no_groups')}</p>
            <Link to="/start" className="btn-primary press mt-6 inline-flex">
              {t('start.new_group')}
            </Link>
          </div>
        ) : (
          <div className="list">
            {memberships.map((m) => (
              <GroupRow key={m.group_id} membership={m} rows={rows} t={t} />
            ))}
          </div>
        )}
      </Section>

      <Section title={t('home.you_overall')}>
        {/* Not the page's Stat component. That one is sized to carry a bare
            screen on its own; three of them inside a card is three competing
            heroes, and the accent rule under each reads as a stray mark once
            there is a border nearby. Divided cells, tabular figures. */}
        <div className="grid grid-cols-3 divide-x divide-hairline border-y border-hairline">
          {[
            [
              rate.total ? `${rate.done}/${rate.total}` : '—',
              t('me.checked_in'),
              rate.pct !== null ? `${rate.pct}%` : t('me.no_cycles'),
            ],
            [goals.length, t('me.live_goals'), null],
            [memberships.length, t('home.groups'), null],
          ].map(([value, label, hint]) => (
            <div key={label} className="py-5 pl-4 first:pl-0">
              <div className="text-h1 leading-none text-ink [font-variant-numeric:tabular-nums]">
                {value}
              </div>
              <div className="mt-2.5 text-small text-muted">{label}</div>
              {hint && <div className="text-small text-muted/70">{hint}</div>}
            </div>
          ))}
        </div>
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
          <div className="py-2">
            <p className="max-w-[38ch] text-body text-muted">{t('home.no_books')}</p>
            <Link to="/library" className="btn-outline press mt-6 inline-flex">
              {t('library.read_free')}
            </Link>
          </div>
        ) : (
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
        )}
      </Section>
    </Screen>
  )
}
