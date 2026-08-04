import { NavLink, Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { onPendingChange, pendingCount, startAutoFlush } from '../lib/queue'
import { useGroup } from '../context/GroupContext'

const TABS = [
  { to: '/', label: 'Home', end: true },
  { to: '/goals', label: 'Goals' },
  { to: '/me', label: 'You' },
  { to: '/settings', label: 'Group' },
]

function SyncBadge() {
  const [pending, setPending] = useState(pendingCount())
  const [online, setOnline] = useState(navigator.onLine)
  const { reloadGroup } = useGroup()

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
      {pending > 0
        ? `Saved. ${pending === 1 ? 'It' : 'They'} will send as soon as you're back online.`
        : "You're offline — anything you write will send itself later."}
    </div>
  )
}

export default function AppShell() {
  return (
    <div className="relative min-h-dvh bg-bg">
      <div className="ambient" aria-hidden="true" />

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
        className="glass-strong fixed inset-x-4 bottom-4 z-30 mx-auto max-w-content rounded-card"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              // Inactive labels are dimmed ink rather than the muted token:
              // muted over glass drops to 2.5:1 when the accent button passes
              // underneath. ink/70 holds above 4.5:1 in the worst case.
              className={({ isActive }) =>
                `press flex-1 rounded-card py-4 text-center text-small transition-colors duration-200 ease-settle ${
                  isActive ? 'text-ink' : 'text-ink/70'
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
