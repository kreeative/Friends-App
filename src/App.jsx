import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { GroupProvider, useGroup } from './context/GroupContext'
import { I18nProvider, useT } from './lib/i18n'
import { ThemeProvider } from './lib/theme'
import { configured } from './lib/supabase'
import ErrorNote from './components/ErrorNote'
import AppShell from './components/AppShell'
import SignIn from './pages/SignIn'
import Start from './pages/Start'
import Dashboard from './pages/Dashboard'
import Seo from './components/Seo'
import Board from './pages/Board'
import Checkin from './pages/Checkin'
import Proofs from './pages/Proofs'
import Goals from './pages/Goals'
import GoalEditor from './pages/GoalEditor'
import Me from './pages/Me'
import Journal from './pages/Journal'
import Money from './pages/Money'
import Settings from './pages/Settings'
import Legal from './pages/Legal'
import PublicLayout from './pages/public/PublicLayout'
import Home from './pages/public/Home'
import How from './pages/public/How'
import About from './pages/public/About'
import Books from './pages/public/Books'
import Preview from './pages/public/Preview'
import Library from './pages/Library'
import Reader from './pages/Reader'

/** /lectures/:slug is the same page as /library/:slug, spelled in French. */
function LecturesRedirect() {
  const { slug } = useParams()
  return <Navigate to={`/library/${slug}`} replace />
}

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

/**
 * The public site is three pages behind one shared layout, not one long
 * scroll with a navigation bar pointing at fragments of itself. Declared once
 * as a fragment because both the unconfigured and the signed-out branch below
 * need exactly the same set.
 */
const PUBLIC_ROUTES = (
  <Route element={<PublicLayout />}>
    <Route index element={<Home />} />
    <Route path="how-it-works" element={<How />} />
    <Route path="about" element={<About />} />
    <Route path="books" element={<Books />} />
    {/**
     * The free chapter, readable with no account and no database.
     *
     * Three paths reach it, because three exist in the wild. /books/:slug is
     * the canonical one. /library/:slug is what the signed-in app links to,
     * and a signed-out visitor following that link -- from a shared message,
     * a bookmark, a search result -- was being bounced to the home page
     * instead of getting the chapter they were sent to read. /lectures is the
     * French word in the navigation, which people type.
     */}
    <Route path="books/:slug" element={<Preview />} />
    <Route path="library/:slug" element={<Preview />} />
    <Route path="lectures/:slug" element={<Preview />} />
    <Route path="lectures" element={<Books />} />
    <Route path="library" element={<Books />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Route>
)

function Gate() {
  const { user, loading, authError } = useAuth()
  const { loading: groupsLoading, memberships, error: groupError, reload } = useGroup()
  const { t } = useT()

  // Marketing and legal pages are public in every sense, including when the
  // backend is misconfigured or down. Only the signed-in app needs Supabase.
  if (!configured) {
    return (
      <Routes>
        <Route
          path="/signin"
          element={
            <Splash>
              Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your
              host's environment variables, then redeploy.
            </Splash>
          }
        />
        {PUBLIC_ROUTES}
      </Routes>
    )
  }

  if (loading) return <Splash>{t('err.loading')}</Splash>

  if (!user) {
    return (
      <Routes>
        <Route path="/signin" element={<SignIn />} />
        {PUBLIC_ROUTES}
      </Routes>
    )
  }

  if (groupsLoading) return <Splash>{t('err.loading')}</Splash>

  // Signed in, but the group query failed. Previously this rendered Start,
  // which made a network failure look like "you have no groups" and invited
  // the user to create a duplicate one.
  if (groupError) return <Stuck error={groupError} onRetry={reload} />
  if (authError && !user) return <SignIn />

  /**
   * Signing in lands on the dashboard, never inside a group.
   *
   * Which group is open is carried by /g/:id rather than by state seeded
   * from the first membership, so a group has an address, back works, and
   * the way out of one is a link rather than signing out. /start is still
   * the only screen someone with no groups can reach.
   */
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={memberships.length === 0 ? <Start /> : <Dashboard />} />
        <Route path="start" element={<Start />} />
        <Route path="me" element={<Me />} />
        {/* Personal, and deliberately not under /g/:groupId. A journal that
            lived inside a group would be one URL away from looking like it
            belonged to the group. */}
        <Route path="journal" element={<Journal />} />
        <Route path="money" element={<Money />} />
        <Route path="library" element={<Library />} />
        <Route path="library/:slug" element={<Reader />} />

        {/**
         * The free chapter, signed in as well as signed out.
         *
         * This route existed only on the public side, so a signed-in reader
         * following it fell through to the catch-all and was bounced to the
         * dashboard -- which is precisely what "Read chapter one" did from
         * inside the app. Same component either way: it reads from the
         * bundle, so it cannot fail on a missing row, view or session.
         */}
        <Route path="books/:slug" element={<Preview />} />
        <Route path="books" element={<Navigate to="/library" replace />} />
        {/* The navigation calls this "Lectures" in French, so people type it.
            Aliased rather than duplicated: one Library, two spellings. */}
        <Route path="lectures" element={<Navigate to="/library" replace />} />
        <Route path="lectures/:slug" element={<LecturesRedirect />} />

        {/**
         * Goals with no group at all. The app assumed a group was the only
         * place a goal could live, so keeping one of your own meant finding
         * people first, the wrong order, and the reason someone could sign
         * up and immediately have nothing they were able to do.
         */}
        <Route path="goals" element={<Goals />} />
        <Route path="goals/new" element={<GoalEditor />} />
        <Route path="goals/:goalId/edit" element={<GoalEditor />} />

        <Route path="g/:groupId">
          <Route index element={<Board />} />
          <Route path="checkin" element={<Checkin />} />
        <Route path="proofs" element={<Proofs />} />
          <Route path="goals" element={<Goals />} />
          <Route path="goals/new" element={<GoalEditor />} />
          <Route path="goals/:goalId/edit" element={<GoalEditor />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <I18nProvider>
        {/* Outermost of the app providers, because the logo colourway and
            every surface below it read from the theme, including the splash
            screens that render before auth has resolved. */}
        <ThemeProvider>
          <AuthProvider>
            <GroupProvider>
              {/**
               * Above every route and inside the router, so it sees each one.
               *
               * index.html carries a single canonical link and vercel.json
               * rewrites every path to that one file, so /about and /books
               * were both served HTML declaring the HOME PAGE as their
               * canonical. That is not a missing tag, it is an instruction to
               * Google not to index them. See src/lib/seo.js.
               */}
              <Seo />
              {/**
               * The legal routes sit above the auth gate: nobody can be asked
               * to accept terms they are not allowed to read until after
               * signing up.
               */}
              <Routes>
                <Route path="/legal/:slug" element={<Legal />} />
                <Route path="*" element={<Gate />} />
              </Routes>
            </GroupProvider>
          </AuthProvider>
        </ThemeProvider>
      </I18nProvider>
    </BrowserRouter>
  )
}
