import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { GroupProvider, useGroup } from './context/GroupContext'
import { I18nProvider } from './lib/i18n'
import { configured } from './lib/supabase'
import AppShell from './components/AppShell'
import SignIn from './pages/SignIn'
import Start from './pages/Start'
import Board from './pages/Board'
import Checkin from './pages/Checkin'
import Goals from './pages/Goals'
import Me from './pages/Me'
import Settings from './pages/Settings'
import Legal from './pages/Legal'

function Splash({ children }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-black px-8">
      <p className="max-w-sm text-center font-mono text-[11px] uppercase leading-relaxed tracking-[0.16em] text-white/40">
        {children}
      </p>
    </main>
  )
}

function Gate() {
  const { user, loading } = useAuth()
  const { loading: groupsLoading, memberships } = useGroup()

  if (loading) return <Splash>Loading</Splash>
  if (!user) return <SignIn />
  if (groupsLoading) return <Splash>Loading</Splash>
  if (memberships.length === 0) return <Start />

  return (
    <Routes>
      <Route path="legal/:slug" element={<Legal />} />
      <Route element={<AppShell />}>
        <Route index element={<Board />} />
        <Route path="checkin" element={<Checkin />} />
        <Route path="goals" element={<Goals />} />
        <Route path="me" element={<Me />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  if (!configured) {
    return (
      <Splash>
        Supabase is not configured. Copy .env.example to .env and add your project URL and anon key.
      </Splash>
    )
  }

  return (
    <BrowserRouter>
      <I18nProvider>
        <AuthProvider>
          <GroupProvider>
            {/**
             * The legal routes sit above the auth gate: nobody can be asked to
             * accept terms they are not allowed to read until after signing up.
             */}
            <Routes>
              <Route path="/legal/:slug" element={<Legal />} />
              <Route path="*" element={<Gate />} />
            </Routes>
          </GroupProvider>
        </AuthProvider>
      </I18nProvider>
    </BrowserRouter>
  )
}
