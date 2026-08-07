import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { onPendingChange, pendingCount, startAutoFlush } from '../lib/queue'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { useT } from '../lib/i18n'
import { Avatar } from './ui'
import { Mark } from './Wordmark'
import Stickers from './Stickers'
import PageTransition from './PageTransition'

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

/** Home, who you are, and the way out — present on every screen. */
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
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <Link to="/" aria-label={t('nav.home')} className="press shrink-0">
            <Mark size={32} />
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

          <div className="relative ml-auto shrink-0">
            <button
              onClick={() => setMenu((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menu}
              aria-label={t('nav.you')}
              className="press block rounded-pill"
            >
              <Avatar profile={profile} size={32} />
            </button>

            {menu && (
              <>
                {/* Catches the click that closes it, at a z-index below the
                    menu but above everything else. */}
                <button
                  className="fixed inset-0 z-40 cursor-default"
                  aria-hidden="true"
                  tabIndex={-1}
                  onClick={() => setMenu(false)}
                />
                <div
                  role="menu"
                  className="lg absolute right-0 z-50 mt-2 w-60 animate-rise overflow-hidden p-1.5"
                >
                  <div className="px-3 py-2.5">
                    <p className="truncate text-small font-semibold text-ink">
                      {profile?.display_name}
                    </p>
                    <p className="truncate text-small text-muted">{user?.email}</p>
                  </div>
                  <div className="my-1 h-px bg-hairline" />
                  <Link
                    to="/me"
                    role="menuitem"
                    className="block rounded-inner px-3 py-2.5 text-small text-ink transition-colors hover:bg-ink/[0.06]"
                  >
                    {t('nav.you')}
                  </Link>
                  <button
                    role="menuitem"
                    onClick={signOut}
                    className="block w-full rounded-inner px-3 py-2.5 text-left text-small text-ink transition-colors hover:bg-ink/[0.06]"
                  >
                    {t('me.sign_out')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>
    </header>
  )
}

function TabBar({ tabs }) {
  const { t } = useT()
  return (
    <nav
      className="lg lg-chrome fixed inset-x-4 bottom-4 z-30 mx-auto max-w-content"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex gap-1 p-1.5">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            // Inactive labels are dimmed ink rather than the muted token:
            // muted over glass drops to 2.5:1 when the accent button passes
            // underneath. ink/70 holds above 4.5:1 in the worst case.
            //
            // The active tab is a second sheet laid over the first, so it
            // reads as a lens over the bar rather than a swatch stuck to it.
            className={({ isActive }) =>
              `press flex-1 truncate rounded-pill px-1 py-3 text-center text-small transition-colors duration-200 ease-settle ${
                isActive ? 'lg-pill text-ink' : 'text-ink/70'
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
      {/* Sparser than the public set — this is a tool, not a poster. */}
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
