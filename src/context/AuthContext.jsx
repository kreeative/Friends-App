import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { localTimezone } from '../lib/time'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user) {
      setProfile(null)
      return
    }
    let cancelled = false
    ;(async () => {
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
    /**
     * OAuth is the primary path deliberately. A magic link opens in whatever
     * the OS considers the default browser, which is frequently not the one
     * the person started in — so the session lands somewhere they cannot see
     * it. For an app meant to be used in under a minute while standing up,
     * that failure is fatal. The link remains as a fallback for anyone who
     * would rather not use a Google account.
     */
    signInWithGoogle: () =>
      supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      }),
    signInWithEmail: (email) =>
      supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      }),
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
