import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { configured } from '../lib/supabase'
import { needsTerms } from '../lib/setup'
import { useT } from '../lib/i18n'
import { call } from './api'
import { flushAnswers, loadCourses, loadProfile } from './data'
import { Splash } from './boot'
import BBShell from './BBShell'
import Landing from './pages/Landing'
import Pricing from './pages/Pricing'
import Go from './pages/Go'
import SignInPage from './pages/SignIn'
import Onboarding from './pages/Onboarding'
import Today from './pages/Today'
import Courses from './pages/Courses'
import NewCourse from './pages/NewCourse'
import Course from './pages/Course'
import Session from './pages/Session'
import Exam from './pages/Exam'
import Coach from './pages/Coach'
import Plan from './pages/Plan'
import Profile from './pages/Profile'

/**
 * Beauty & Brain, at /bb (section 1.1): its own landing page, pricing,
 * sign-in, onboarding and app, on the Rich & Friends account.
 *
 * Mounted ABOVE the Rich & Friends gate in App.jsx, so a student never
 * meets the five Rich & Friends questions or its welcome deck on the way in:
 * she answers the study-profile questions instead (src/bb/pages/Onboarding).
 * The terms are the same document and the same acceptance (profiles
 * .terms_accepted_at); a Rich & Friends user who accepted them is not asked
 * twice, and a new student accepts them in the first onboarding step.
 *
 * The OAuth return lands on the site root (redirectTo is the origin, the
 * one address the provider is sure to accept), so SignIn remembers where to
 * come back to in `bb.return`, and BBReturn in App.jsx sends the student
 * there.
 */
const Ctx = createContext(null)
export const useBB = () => useContext(Ctx)

function Provider({ children }) {
  const { user } = useAuth()
  const [bb, setBB] = useState(undefined)
  const [status, setStatus] = useState(null)
  const [courses, setCourses] = useState(null)

  const reloadProfile = useCallback(async () => {
    if (!user?.id) return setBB(null)
    try {
      setBB(await loadProfile(user.id))
    } catch {
      setBB(null)
    }
  }, [user?.id])

  const reloadStatus = useCallback(async () => {
    if (!user?.id) return setStatus(null)
    const r = await call('status')
    setStatus(r.ok ? r.data : { error: r.data?.error ?? 'offline', tier: 'free' })
  }, [user?.id])

  const reloadCourses = useCallback(async () => {
    if (!user?.id) return setCourses(null)
    try {
      setCourses(await loadCourses())
    } catch {
      setCourses([])
    }
  }, [user?.id])

  useEffect(() => {
    setBB(undefined)
    reloadProfile()
    reloadStatus()
    reloadCourses()
    if (user?.id) flushAnswers(user.id).catch(() => {})
  }, [user?.id, reloadProfile, reloadStatus, reloadCourses])

  /* Answers queued offline go as soon as the network is back. */
  useEffect(() => {
    if (!user?.id) return undefined
    const on = () => flushAnswers(user.id).catch(() => {})
    window.addEventListener('online', on)
    return () => window.removeEventListener('online', on)
  }, [user?.id])

  const value = useMemo(
    () => ({ bb, setBB, reloadProfile, status, reloadStatus, courses, setCourses, reloadCourses }),
    [bb, status, courses, reloadProfile, reloadStatus, reloadCourses],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** Signed in, or off to the sign-in page with the way back remembered. */
function RequireUser({ children }) {
  const { user, loading } = useAuth()
  const { pathname, search } = useLocation()
  if (loading) return <Splash />
  if (!user) return <Navigate to={`/bb/connexion?next=${encodeURIComponent(pathname + search)}`} replace />
  return children
}

/**
 * Has the Rich & Friends profile arrived? It decides whether the terms are
 * asked, so deciding before it lands would ask them of someone who accepted
 * them, or skip them for someone who did not. AuthContext has no flag for
 * it, so: the profile, or four seconds (a read that failed must not leave a
 * student on the splash forever; the terms step then shows when it lands).
 */
export function useProfileSettled() {
  const { profile } = useAuth()
  const [late, setLate] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setLate(true), 4000)
    return () => clearTimeout(timer)
  }, [])
  return profile != null || late
}

/** The study profile answered and the terms accepted, or the onboarding. */
function Ready({ children }) {
  const { profile } = useAuth()
  const { bb } = useBB()
  const settled = useProfileSettled()
  if (bb === undefined || !settled) return <Splash />
  if (!bb?.onboarded_at || needsTerms(profile)) return <Navigate to="/bb/start" replace />
  return children
}

/** The <link rel=manifest> and theme colour of Beauty & Brain while on /bb. */
function useInstallable() {
  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]')
    const theme = document.querySelector('meta[name="theme-color"]')
    const apple = document.querySelector('link[rel="apple-touch-icon"]')
    const before = { manifest: link?.getAttribute('href'), theme: theme?.getAttribute('content'), apple: apple?.getAttribute('href') }
    link?.setAttribute('href', '/bb.webmanifest')
    theme?.setAttribute('content', '#FF007A')
    apple?.setAttribute('href', '/brand/bb-apple-touch-180.png')
    return () => {
      if (before.manifest) link?.setAttribute('href', before.manifest)
      if (before.theme) theme?.setAttribute('content', before.theme)
      if (before.apple) apple?.setAttribute('href', before.apple)
    }
  }, [])
}

export default function BBApp() {
  useInstallable()
  const app = (el) => (
    <RequireUser>
      <Ready>{el}</Ready>
    </RequireUser>
  )
  if (!configured) {
    return (
      <Routes>
        <Route index element={<Landing />} />
        <Route path="tarifs" element={<Pricing />} />
        <Route path="pricing" element={<Pricing />} />
        <Route path="go" element={<Go />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    )
  }
  return (
    <Provider>
      <Routes>
        <Route index element={<Landing />} />
        <Route path="tarifs" element={<Pricing />} />
        <Route path="pricing" element={<Pricing />} />
        <Route path="connexion" element={<SignInPage />} />
        <Route path="signin" element={<SignInPage />} />
        <Route
          path="start"
          element={
            <RequireUser>
              <Onboarding />
            </RequireUser>
          }
        />
        <Route path="session/:id" element={app(<Session />)} />
        <Route path="examen/:id" element={app(<Exam />)} />
        <Route path="go" element={<Go />} />
        <Route element={app(<BBShell />)}>
          <Route path="app" element={<Today />} />
          <Route path="cours" element={<Courses />} />
          <Route path="cours/nouveau" element={<NewCourse />} />
          <Route path="cours/:id" element={<Course />} />
          <Route path="cours/:id/:tab" element={<Course />} />
          <Route path="coach" element={<Coach />} />
          <Route path="coach/:id" element={<Coach />} />
          <Route path="plan" element={<Plan />} />
          <Route path="profil" element={<Profile />} />
          <Route path="profile" element={<Navigate to="/bb/profil" replace />} />
          <Route path="courses" element={<Navigate to="/bb/cours" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/bb" replace />} />
      </Routes>
    </Provider>
  )
}
