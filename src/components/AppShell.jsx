import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { onPendingChange, pendingCount, startAutoFlush } from '../lib/queue'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { useT } from '../lib/i18n'
import { Avatar } from './ui'
import { LockupInline } from './Wordmark'
import Stickers from './Stickers'
import PageTransition from './PageTransition'
import { Slider, useSlider } from './Segmented'

/**
 * Two levels of navigation, because there are two levels of place.
 *
 * The top bar is the same on every screen: it is what stops the app feeling
 * like a room you were shut into. Wherever you are, the logo goes home and
 * your face is one tap from sign-out.
 *
 * The bottom bar is contextual. Outside a group it is the three things that
 * belong to you; inside one it is the four things that belong to the group.
 * A single flat tab bar could not do both without either hiding the
 * dashboard behind a group or listing check-in when there is no group to
 * check into.
 */
const MINE = [
  { to: '/', key: 'nav.home', end: true },
  // Your own goals, which no longer require a group to exist in.
  { to: '/goals', key: 'nav.goals' },
  { to: '/money', key: 'nav.budget' },
  { to: '/library', key: 'nav.library' },
  { to: '/me', key: 'nav.you' },
]

const IN_GROUP = (id) => [
  { to: `/g/${id}`, key: 'nav.board', end: true },
  { to: `/g/${id}/checkin`, key: 'board.check_in' },
  { to: `/g/${id}/goals`, key: 'nav.goals' },
  { to: `/g/${id}/settings`, key: 'nav.group' },
]

function SyncBadge() {
  const [pending, setPending] = useState(pendingCount())
  const [online, setOnline] = useState(navigator.onLine)
  const { reloadGroup } = useGroup()
  const { t } = useT()

  useEffect(() => {
    const stop = startAutoFlush()
    const off = onPendingChange((n) => {
      setPending(n)
      if (n === 0) reloadGroup()
    })
    const on = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', down)
    return () => {
      stop()
      off()
      window.removeEventListener('online', on)
      window.removeEventListener('offline', down)
    }
  }, [])

  if (pending === 0 && online) return null

  return (
    <div className="animate-rise border-b border-hairline bg-surface px-6 py-2.5 text-center text-small text-ink">
      {pending > 0 ? t('sync.queued', { n: pending }) : t('sync.offline')}
    </div>
  )
}

/**
 * Home, who you are, and the way out. Present on every screen.
 *
 * The account menu opens **inside the bar** rather than as a sheet floating
 * under it. The floating version was a second white card laid over the page,
 * with its own rim and its own shadow, hanging off the corner of a bar that
 * already had both. Two stacked sheets for four lines of text reads as a
 * dialog, and on a narrow phone the 240px panel came within a few pixels of
 * the opposite edge of the screen it was supposed to be a corner of.
 *
 * Expanding the bar keeps one sheet on screen. The name, the address and the
 * two things you can do sit inside the border and the padding the bar already
 * has, so nothing new is drawn, the chrome simply gets taller.
 *
 * The animation is the same CSS grid trick MoodToday uses: grid-template-rows
 * from 0fr to 1fr resolves to the content's real height with nothing measured
 * and no dependency. See that file for the longer argument.
 */
function TopNav() {
  const { user, profile, signOut } = useAuth()
  const { activeId, group } = useGroup()
  const { t } = useT()
  const { pathname } = useLocation()
  const [menu, setMenu] = useState(false)

  // A menu that survives navigation is a menu covering the page you asked for.
  useEffect(() => setMenu(false), [pathname])

  useEffect(() => {
    if (!menu) return
    const onKey = (e) => e.key === 'Escape' && setMenu(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menu])

  return (
    <header className="sticky top-0 z-40 px-4 pt-4">
      <nav className="lg lg-chrome mx-auto w-full max-w-content">
        {/* One padded box for both halves. The row used to carry the padding
            itself, which left the panel below it no way to line up with the
            logo without repeating the same numbers. */}
        <div className="px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <Link to="/" aria-label={t('nav.home')} className="press shrink-0">
              <LockupInline size={32} hideNameOnMobile />
            </Link>

            {/* Inside a group the bar says which one, and the name is the way
                back out. Without it every group looks identical from the
                chrome down. */}
            {activeId && group && (
              <>
                <span aria-hidden="true" className="shrink-0 text-muted/40">
                  /
                </span>
                <span className="truncate text-small font-semibold tracking-tight text-ink">
                  {group.name}
                </span>
              </>
            )}

            <button
              onClick={() => setMenu((v) => !v)}
              aria-expanded={menu}
              aria-controls="account-panel"
              aria-label={t('nav.you')}
              className="press ml-auto block shrink-0 rounded-pill"
            >
              <Avatar profile={profile} size={32} />
            </button>
          </div>

          <div
            id="account-panel"
            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-settle motion-reduce:transition-none ${
              menu ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
            aria-hidden={!menu}
          >
            {/* The clip is what makes the closed state actually zero-height
                rather than squashed, and it takes the spacing with it, so a
                shut panel adds nothing at all to the bar. */}
            <div className="overflow-hidden">
              {/* inert while collapsed, so a closed panel is not a tab stop */}
              <fieldset disabled={!menu} className="mt-2.5 border-0 border-t border-hairline p-0 pt-2.5">
                <p className="truncate px-3 text-small font-semibold text-ink">
                  {profile?.display_name}
                </p>
                <p className="truncate px-3 text-small text-muted">{user?.email}</p>

                <div className="mt-2">
                  <Link
                    to="/me"
                    tabIndex={menu ? undefined : -1}
                    className="block rounded-inner px-3 py-2.5 text-small text-ink no-underline transition-colors hover:bg-ink/[0.06]"
                  >
                    {t('me.profile_settings')}
                  </Link>
                  <button
                    onClick={signOut}
                    className="block w-full rounded-inner px-3 py-2.5 text-left text-small text-ink transition-colors hover:bg-ink/[0.06]"
                  >
                    {t('me.sign_out')}
                  </button>
                </div>
              </fieldset>
            </div>
          </div>
        </div>
      </nav>
    </header>
  )
}

function TabBar({ tabs }) {
  const { t } = useT()
  const { pathname } = useLocation()

  /* Which tab is current, worked out here rather than read back from
     NavLink's isActive, the slider needs to know before the children render
     so it can be measured in the same layout pass. Same rule NavLink uses:
     exact match for an `end` tab, prefix match otherwise. */
  const activeIdx = tabs.findIndex((tab) =>
    tab.end ? pathname === tab.to : pathname === tab.to || pathname.startsWith(`${tab.to}/`),
  )
  const { ref, box } = useSlider(tabs[activeIdx]?.to ?? null)

  return (
    <nav
      className="lg lg-chrome fixed inset-x-4 bottom-4 z-30 mx-auto max-w-content"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div ref={ref} className="relative flex gap-1 p-1.5">
        {/* The active tab used to be a second sheet stuck to whichever link
            was current. It is one sheet now, and it travels. */}
        <Slider box={box} className="lg-pill" />

        {tabs.map((tab, i) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            data-active={i === activeIdx}
            // Inactive labels are dimmed ink rather than the muted token:
            // muted over glass drops to 2.5:1 when the accent button passes
            // underneath. ink/70 holds above 4.5:1 in the worst case.
            className={({ isActive }) =>
              `press relative z-10 flex-1 truncate rounded-pill px-1 py-3 text-center text-small transition-colors duration-200 ease-settle ${
                isActive ? 'text-ink' : 'text-ink/70'
              }`
            }
          >
            {t(tab.key)}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export default function AppShell() {
  const { activeId } = useGroup()
  const { pathname } = useLocation()

  // The reader is full-bleed by design and brings its own chrome.
  const bare = /^\/library\/[^/]+$/.test(pathname)
  if (bare) return <Outlet />

  return (
    /* The same coloured ground as the public site. A dashboard of white rows
       on white is a filing cabinet; the theme carries the page and the
       content sits on it in glass. */
    <div className="ground relative min-h-dvh">
      {/* Sparser than the public set, this is a tool, not a poster. */}
      <Stickers set="app" />

      <TopNav />
      <div className="relative z-10">
        <SyncBadge />
        {/* The chrome above and below stays put; only the page moves. */}
        <PageTransition>
          <Outlet />
        </PageTransition>
      </div>
      <TabBar tabs={activeId ? IN_GROUP(activeId) : MINE} />
    </div>
  )
}
