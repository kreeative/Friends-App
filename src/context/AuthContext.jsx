import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { localTimezone } from '../lib/time'

/* Exported so a test or a preview can supply a value without a live session.
   Application code should use the hook. */
export const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

/**
 * Supabase reports OAuth failures by redirecting back with error parameters,
 * in the query string or the hash depending on the flow. Reading them is the
 * difference between "the sign-in page reappeared for no reason" and a
 * message that says what to fix.
 */
function readRedirectError() {
  try {
    const search = new URLSearchParams(window.location.search)
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const code = search.get('error') || hash.get('error')
    if (!code) return null
    const description =
      search.get('error_description') || hash.get('error_description') || ''

    // Clear them so a reload doesn't keep showing a stale failure.
    window.history.replaceState({}, '', window.location.pathname)
    return { code, description: description.replace(/\+/g, ' ') }
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(readRedirectError)

  useEffect(() => {
    let cancelled = false
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setAuthError({ code: 'session', description: error.message })
        setSession(data?.session ?? null)
      })
      // A network failure here used to leave `loading` true forever, which
      // renders as an eternal splash with no way out.
      .catch((e) => !cancelled && setAuthError({ code: 'network', description: String(e) }))
      .finally(() => !cancelled && setLoading(false))

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s ?? null)
      if (s) setAuthError(null)
    })
    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session?.user) {
      setProfile(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle()
        if (cancelled) return
        setProfile(data ?? null)

        // Keep the timezone fresh — it decides when their digest arrives.
        const tz = localTimezone()
        if (data && data.timezone !== tz) {
          await supabase.from('profiles').update({ timezone: tz }).eq('id', session.user.id)
        }
      } catch {
        /* the profile is cosmetic here; the session is what gates the app */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [session?.user?.id])

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    authError,
    clearAuthError: () => setAuthError(null),

    /**
     * OAuth is the primary path deliberately. A magic link opens in whatever
     * the OS considers the default browser, which is frequently not the one
     * the person started in — so the session lands somewhere they cannot see
     * it. For an app meant to be used in under a minute while standing up,
     * that failure is fatal. The link remains as a fallback for anyone who
     * would rather not use a Google account.
     *
     * Both of these now RETURN their error. Swallowing it was what made a
     * disabled provider look like a dead button.
     */
    signInWithGoogle: async () => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (error) setAuthError({ code: error.code ?? 'oauth', description: error.message })
      return { error }
    },
    signInWithEmail: async (email) => {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      })
      if (error) setAuthError({ code: error.code ?? 'otp', description: error.message })
      return { error }
    },
    signOut: () => supabase.auth.signOut(),
    updateProfile: async (patch) => {
      if (!session?.user) return
      const { data } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', session.user.id)
        .select()
        .maybeSingle()
      if (data) setProfile(data)
    },
  }

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}
