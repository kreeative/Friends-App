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
 * A group as it looks from outside: what it is called, where it is in its
 * week, and whether it is waiting on you.
 *
 * The name gets its own line. Sharing one with the status chip meant a flex
 * row where the only shrinkable thing was the title, so "Sunday Four"
 * truncated to "Sunday F…" next to a chip with room to spare.
 */
function GroupCard({ membership, rows, t }) {
  const g = membership.groups
  const mine = rows.filter((r) => r.group_id === g.id)

  const open = mine.find((r) => cyclePhase(r) === 'open')
  const cycle = open ?? mine[0] ?? null
  const meIn = open && open.status === 'submitted'

  // Everyone's row for the open cycle, so the card can say 2 of 4 rather than
  // just "open" — the number is the reason to tap.
  const inCycle = open ? rows.filter((r) => r.cycle_id === open.cycle_id) : []
  const done = inCycle.filter((r) => r.status === 'submitted').length

  return (
    <Link to={`/g/${g.id}`} className="lg lg-interactive block p-5 no-underline">
      <h3 className="truncate text-h2 text-ink">{g.name}</h3>

      <p className="mt-1 text-small text-muted">
        {open
          ? t('checkin.closes_in', { t: untilLabel(open.closes_at) })
          : cycle
            ? t('board.next_opens_in', { t: untilLabel(cycle.opens_at) })
            : t('board.getting_ready')}
      </p>

      {/* How far along the room is, as a bar rather than only a sentence —
          the shape of it is readable before the words are. */}
      {open && (
        <div className="mt-5">
          <div
            className="h-1 w-full overflow-hidden rounded-pill bg-ink/[0.08]"
            role="presentation"
          >
            <div
              className="h-full rounded-pill bg-green transition-[width] duration-500 ease-settle"
              style={{ width: `${inCycle.length ? (done / inCycle.length) * 100 : 0}%` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            {/* Short form. The board's full sentence wrapped to two lines
                beside the chip at card width, and the bar above already
                says the same thing faster. */}
            <span className="text-small text-muted">
              {t('home.n_of_total', { n: done, total: inCycle.length })}
            </span>
            {/* Waiting-on-you is the only state that should pull the eye, so
                it is the only one that gets the accent. */}
            <span className={meIn ? 'chip-green shrink-0' : 'chip-accent shrink-0'}>
              {meIn ? t('board.state_in') : t('board.check_in')}
            </span>
          </div>
        </div>
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
          <div className="lg p-6">
            <p className="text-body text-muted">{t('home.no_groups')}</p>
            <Link to="/start" className="btn-primary press mt-6 inline-flex">
              {t('start.new_group')}
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {memberships.map((m) => (
              <GroupCard key={m.group_id} membership={m} rows={rows} t={t} />
            ))}
          </div>
        )}
      </Section>

      <Section title={t('home.you_overall')}>
        {/* Not the page's Stat component. That one is sized to carry a bare
            screen on its own; three of them inside a card is three competing
            heroes, and the accent rule under each reads as a stray mark once
            there is a border nearby. Divided cells, tabular figures. */}
        <div className="lg grid grid-cols-3 divide-x divide-hairline p-1">
          {[
            [
              rate.total ? `${rate.done}/${rate.total}` : '—',
              t('me.checked_in'),
              rate.pct !== null ? `${rate.pct}%` : t('me.no_cycles'),
            ],
            [goals.length, t('me.live_goals'), null],
            [memberships.length, t('home.groups'), null],
          ].map(([value, label, hint]) => (
            <div key={label} className="px-4 py-5">
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
          <div className="lg p-6">
            <p className="text-body text-muted">{t('home.no_books')}</p>
            <Link to="/library" className="btn-outline press mt-6 inline-flex">
              {t('library.read_free')}
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {owned.map((b) => (
              <Link key={b.id} to={`/library/${b.slug}`} className="lg lg-interactive block p-5 no-underline">
                <h3 className="text-h2 text-ink">{b.title}</h3>
                {b.subtitle && <p className="mt-1 text-small text-muted">{b.subtitle}</p>}
                {b.progress?.scroll_pct != null && (
                  <p className="mt-4 text-small text-muted">
                    {t('library.progress', { pct: Math.round(b.progress.scroll_pct) })}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </Section>
    </Screen>
  )
}
