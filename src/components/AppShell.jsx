import { NavLink, Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { onPendingChange, pendingCount, startAutoFlush } from '../lib/queue'
import { useGroup } from '../context/GroupContext'

const TABS = [
  { to: '/', label: 'Board', end: true },
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
    <div className="hair-b bg-white px-4 py-1.5 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-black">
      {pending > 0
        ? `${pending} check-in${pending > 1 ? 's' : ''} waiting to sync`
        : 'Offline — your check-in will send itself'}
    </div>
  )
}

export default function AppShell() {
  return (
    <div className="min-h-dvh bg-black">
      <SyncBadge />
      <Outlet />

      <nav className="hair-t fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 bg-black/95 backdrop-blur">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `py-4 text-center font-mono text-[10px] uppercase tracking-[0.16em] transition-colors ${
                isActive ? 'text-white' : 'text-white/30'
              }`
            }
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
