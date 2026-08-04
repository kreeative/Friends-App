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
    <div className="animate-rise bg-accent/[0.1] px-6 py-2.5 text-center text-small text-ink">
      {pending > 0
        ? `Saved. ${pending === 1 ? 'It' : 'They'} will send as soon as you're back online.`
        : "You're offline — anything you write will send itself later."}
    </div>
  )
}

export default function AppShell() {
  return (
    <div className="min-h-dvh bg-bg">
      <SyncBadge />
      <Outlet />

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-content">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `flex-1 py-4 text-center text-small transition-colors duration-200 ease-settle ${
                  isActive ? 'text-ink' : 'text-muted'
                }`
              }
              style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
            >
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
