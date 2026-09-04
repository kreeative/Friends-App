import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { GroupProvider, useGroup } from './context/GroupContext'
import { I18nProvider, useT } from './lib/i18n'
import { BRAND, ThemeProvider, useTheme } from './lib/theme'
import { configured } from './lib/supabase'
import { landing, soloKeyFor } from './lib/onboarding'
import ErrorNote from './components/ErrorNote'
import AppShell from './components/AppShell'
import SignIn from './pages/SignIn'
import Start from './pages/Start'
import Dashboard from './pages/Dashboard'
import Seo from './components/Seo'
import Wordmark from './components/Wordmark'
import Welcome from './pages/Welcome'
import Board from './pages/Board'
import Proofs from './pages/Proofs'
import Goals from './pages/Goals'
import GoalEditor from './pages/GoalEditor'
import Account from './pages/Account'
import Me from './pages/Me'
import Money from './pages/Money'
import Calendar from './pages/Calendar'
import Settings from './pages/Settings'
import Legal from './pages/Legal'
import PublicLayout from './pages/public/PublicLayout'
import Home from './pages/public/Home'
import How from './pages/public/How'
import About from './pages/public/About'
import Books from './pages/public/Books'
import Faq from './pages/public/Faq'
import Studies from './pages/public/Studies'
import Credits from './pages/public/Credits'
import Study from './pages/public/Study'
import Preview from './pages/public/Preview'
import Library from './pages/Library'
import Reader from './pages/Reader'
import VapidSetup from './pages/VapidSetup'

/** /lectures/:slug is the same page as /library/:slug, spelled in French. */
function LecturesRedirect() {
  const { slug } = useParams()
  return <Navigate to={`/library/${slug}`} replace />
}

/** The old check-in tab. See the note on its route below. */
function CheckinRedirect() {
  const { groupId } = useParams()
  return <Navigate to={`/g/${groupId}/goals`} replace />
}

/** A full screen with a sentence on it. Used for the one case that has
    something to say: a backend that is not configured. */
function Splash({ children }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-8">
      <p className="max-w-sm text-center text-body text-muted">{children}</p>
    </main>
  )
}

/**
 * The waiting screen: the brand tile on the brand's own ground.
 *
 * It used to be the word "Chargement" in muted type on the pale app ground,
 * which is the least interesting thing an app can put in front of somebody
 * during the one moment it has their whole attention and nothing else to show.
 *
 * The tile carries its own coloured ground, and the page is painted the SAME
 * colour, so the artwork dissolves into the screen and reads as one printed
 * surface rather than a logo sitting on a card. That is why BRAND exists: it
 * is sampled from the corner pixel of the artwork rather than guessed at, so
 * the two cannot drift apart. See the note in src/lib/theme.jsx.
 *
 * Sized off the viewport rather than fixed, because this is the only place in
 * the app where the mark is the entire composition.
 *
 * 36vw, and the number is measured rather than chosen. The lettering fills
 * 84.7% of its square tile, and the reference art puts the mark at 30.2% of
 * the screen width, so the tile has to be 30.2 / 0.847 = 35.7. The first pass
 * used 46vw, which rendered the mark at 38.7% -- the same artwork on the same
 * ground, a quarter too large, which is exactly the sort of difference that is
 * obvious side by side and invisible on its own.
 *
 * The word did not disappear, it moved. A splash with no text at all tells a
 * screen reader nothing is happening, so `err.loading` is still announced,
 * with role="status" so it is read when it appears rather than interrupting.
 */
function BrandSplash() {
  const { theme } = useTheme()
  const { t } = useT()
  return (
    <main
      className="flex min-h-dvh items-center justify-center"
      style={{ backgroundColor: BRAND[theme] ?? BRAND.sun }}
    >
      <Wordmark size="min(36vw, 220px)" flat />
      <p className="sr-only" role="status">
        {t('err.loading')}
      </p>
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
    {/**
     * Les etudes, lisibles sans compte.
     *
     * /etudes est l'adresse canonique parce que le public de ces textes est
     * francophone et que c'est le mot qui sera tape et partage. /studies
     * existe pour l'anglais et pointe sur les memes pages plutot que de
     * rediriger : une adresse partagee en anglais doit ouvrir l'etude, pas
     * faire un aller-retour.
     */}
    <Route path="etudes" element={<Studies />} />
    <Route path="etudes/:slug" element={<Study />} />
    <Route path="studies" element={<Studies />} />
    <Route path="studies/:slug" element={<Study />} />
    {/* Both spellings, like the studies above: the app is bilingual and a
        shared link should not stop working because it was copied from the
        other language. */}
    {/* Merci et credits. Deux adresses, une page, pour la meme raison que
        /etudes et /studies : une adresse partagee dans l'autre langue doit
        ouvrir la page plutot que de rebondir. /merci est canonique. */}
    <Route path="merci" element={<Credits />} />
    <Route path="credits" element={<Credits />} />
    <Route path="aide" element={<Faq />} />
    <Route path="faq" element={<Faq />} />
    <Route path="help" element={<Faq />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Route>
)

function Gate() {
  const { user, profile, loading, authError } = useAuth()
  const { loading: groupsLoading, memberships, error: groupError, reload } = useGroup()

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

  if (loading) return <BrandSplash />

  if (!user) {
    return (
      <Routes>
        <Route path="/signin" element={<SignIn />} />
        {PUBLIC_ROUTES}
      </Routes>
    )
  }

  if (groupsLoading) return <BrandSplash />

  // Signed in, but the group query failed. Previously this rendered Start,
  // which made a network failure look like "you have no groups" and invited
  // the user to create a duplicate one.
  if (groupError) return <Stuck error={groupError} onRetry={reload} />
  if (authError && !user) return <SignIn />

  /**
   * The first screen, for somebody who belongs to no group.
   *
   * This used to be `memberships.length === 0 ? <Start /> : <Dashboard />`,
   * which put a form asking you to name a group in front of every new account
   * with no way past it. The budget and your own goals both work alone;
   * neither was reachable until you had invented a group.
   *
   * Three answers, not two, and the third is the important one: WAIT. The
   * decision needs the memberships and the profile, which arrive from two
   * independent fetches, and guessing before both land shows the welcome deck
   * to a solo user for a few hundred milliseconds on every single load. See
   * landing() in src/lib/onboarding.js, which has that case under test.
   */
  const local = (() => {
    try {
      const k = soloKeyFor(user?.id)
      return Boolean(k && localStorage.getItem(k) === '1')
    } catch {
      /* Private mode. The profile column is the real record. */
      return false
    }
  })()

  const where = landing({ loading: groupsLoading, memberships, profile, local })
  if (where === 'wait') return <BrandSplash />

  /**
   * Outside the AppShell on purpose. The deck is the whole screen: a tab bar
   * offering Goals, Budget and the library underneath it would be four ways
   * out of a screen whose entire job is to ask one question.
   */
  if (where === 'welcome') {
    return (
      <Routes>
        <Route path="/start" element={<Start />} />
        <Route path="*" element={<Welcome />} />
      </Routes>
    )
  }

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
        <Route index element={<Dashboard />} />
        <Route path="start" element={<Start />} />
        {/* /profile is the name the avatar in the bar points at; /me is the
            address it had for a year and stays served rather than breaking a
            link somebody bookmarked. */}
        <Route path="profile" element={<Me />} />
        <Route path="me" element={<Me />} />
        {/* Top level, and distinct from /g/:groupId/settings, which is the
            GROUP's settings and is unreachable to anybody without a group. */}
        <Route path="settings" element={<Account />} />
        {/**
         * The push key generator. Unlisted: nothing links here, and that is
         * deliberate rather than an oversight.
         *
         * It exists because every other way to make a VAPID pair assumes a
         * computer, and this app was built and deployed from a tablet. See the
         * note at the top of VapidSetup.jsx. A tester who lands on the
         * settings screen does not need a key generator under the notification
         * card, and gating it by account would mean an owner's email address
         * in a public repository. Unlisted is enough because the page
         * discloses nothing: it reads no configuration and generates fresh
         * random numbers.
         */}
        <Route path="settings/push-keys" element={<VapidSetup />} />
        <Route path="money" element={<Money />} />
        {/* The full timetable. The dashboard's WeekStrip links here; it is
            deliberately not a fifth tab, because the tab bar is capped at four
            and the comment above MINE records what happened at five: the
            labels truncated to "Faire le p..." at 390px. */}
        <Route path="calendar" element={<Calendar />} />
        <Route path="calendrier" element={<Calendar />} />
        {/**
         * The budget's sections are pages, and they are pages here rather than
         * five sibling routes with five components.
         *
         * Every one of them reads the same plan, the same transactions and the
         * same allocations. Splitting them would mean five copies of the load
         * and five chances for two of them to disagree about what this period
         * is, so one component answers all six paths and the param picks the
         * body. See the note on useParams in src/pages/Money.jsx.
         */}
        <Route path="money/:pane" element={<Money />} />
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
         * Les etudes, signe ou pas.
         *
         * Meme raison que books/:slug juste au-dessus : ces routes n'existaient
         * que du cote public, donc le lien "sur quoi on se base" pose sous le
         * rang d'epargne tombait dans le catch-all et renvoyait au tableau de
         * bord. Meme composant des deux cotes, il ne lit que le bundle.
         */}
        <Route path="etudes" element={<Studies />} />
        <Route path="etudes/:slug" element={<Study />} />
        <Route path="studies" element={<Navigate to="/etudes" replace />} />
        <Route path="aide" element={<Faq />} />
        <Route path="faq" element={<Faq />} />
        <Route path="help" element={<Faq />} />
        <Route path="studies/:slug" element={<Study />} />

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
          {/**
           * /checkin was a screen and is now a redirect.
           *
           * It held the check-in, then held only proof and praise once the
           * check-in moved onto the goal cards, and that leftover was a page
           * made of two links. Both jobs live on the goals page now.
           *
           * The path stays because links to it exist outside this app: in
           * push notifications already delivered, in browser history, and in
           * whatever anybody pasted into a chat. Deleting the route would
           * turn those into the catch-all, which is the dashboard, and
           * somebody following "you have not checked in" would arrive
           * somewhere that does not mention it.
           */}
          <Route path="checkin" element={<CheckinRedirect />} />
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
