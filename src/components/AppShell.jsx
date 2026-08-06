import { NavLink, Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { onPendingChange, pendingCount, startAutoFlush } from '../lib/queue'
import { useGroup } from '../context/GroupContext'
import { useT } from '../lib/i18n'

const TABS = [
  { to: '/', key: 'nav.home', end: true },
  { to: '/goals', key: 'nav.goals' },
  { to: '/library', key: 'nav.library' },
  { to: '/me', key: 'nav.you' },
  { to: '/settings', key: 'nav.group' },
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

export default function AppShell() {
  const { t } = useT()

  return (
    <div className="relative min-h-dvh bg-bg">
      <div className="relative z-10">
        <SyncBadge />
        <Outlet />
      </div>

      {/**
       * Floating rather than edge-to-edge, so the page visibly runs underneath
       * it. That gap is what makes the blur legible as glass instead of just
       * reading as a lighter strip.
       */}
      <nav
        className="lg lg-chrome fixed inset-x-4 bottom-4 z-30 mx-auto max-w-content"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex gap-1 p-1.5">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              // Inactive labels are dimmed ink rather than the muted token:
              // muted over glass drops to 2.5:1 when the accent button passes
              // underneath. ink/70 holds above 4.5:1 in the worst case.
              //
              // The active tab is a second sheet of glass laid on the first,
              // not a filled button — that is what makes it read as a lens
              // over the bar rather than a swatch stuck to it.
              className={({ isActive }) =>
                `press flex-1 rounded-pill py-3 text-center text-small transition-colors duration-200 ease-settle ${
                  isActive ? 'lg-pill text-ink' : 'text-ink/70'
                }`
              }
            >
              {t(tab.key)}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
