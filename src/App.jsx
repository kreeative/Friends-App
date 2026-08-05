import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { GroupProvider, useGroup } from './context/GroupContext'
import { I18nProvider, useT } from './lib/i18n'
import { configured } from './lib/supabase'
import ErrorNote from './components/ErrorNote'
import AppShell from './components/AppShell'
import SignIn from './pages/SignIn'
import Start from './pages/Start'
import Board from './pages/Board'
import Checkin from './pages/Checkin'
import Goals from './pages/Goals'
import Me from './pages/Me'
import Settings from './pages/Settings'
import Legal from './pages/Legal'
import Library from './pages/Library'
import Reader from './pages/Reader'

function Splash({ children }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-8">
      <p className="max-w-sm text-center text-body text-muted">{children}</p>
    </main>
  )
}

/** A dead end with a way out, rather than a splash that never resolves. */
function Stuck({ error, onRetry }) {
  const { signOut } = useAuth()
  const { t } = useT()
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-6">
      <div className="w-full max-w-content space-y-3">
        <ErrorNote error={error} onRetry={onRetry} />
        <button onClick={signOut} className="btn-ghost press">
          {t('me.sign_out')}
        </button>
      </div>
    </main>
  )
}

function Gate() {
  const { user, loading, authError } = useAuth()
  const { loading: groupsLoading, memberships, error: groupError, reload } = useGroup()
  const { t } = useT()

  if (loading) return <Splash>{t('err.loading')}</Splash>
  if (!user) return <SignIn />
  if (groupsLoading) return <Splash>{t('err.loading')}</Splash>

  // Signed in, but the group query failed. Previously this rendered Start,
  // which made a network failure look like "you have no groups" and invited
  // the user to create a duplicate one.
  if (groupError) return <Stuck error={groupError} onRetry={reload} />
  if (authError && !user) return <SignIn />

  if (memberships.length === 0) return <Start />

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Board />} />
        <Route path="checkin" element={<Checkin />} />
        <Route path="goals" element={<Goals />} />
        <Route path="me" element={<Me />} />
        <Route path="settings" element={<Settings />} />
        <Route path="library" element={<Library />} />
      </Route>
      <Route path="library/:slug" element={<Reader />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  if (!configured) {
    return (
      <Splash>
        Supabase is not configured. Set VITE_SUPABASE_URL and
        VITE_SUPABASE_ANON_KEY in your host's environment variables, then redeploy.
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
