import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { localTimezone } from '../lib/time'
import { detectCurrency } from '../lib/currency'

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
      if (s) {
        setAuthError(null)
        /**
         * Collect anything bought before this account existed.
         *
         * Checkout no longer requires an account, so a book can be paid for by
         * an address with no user attached to it. The webhook parks that
         * purchase; this is the other half. It runs on every sign-in rather
         * than only the first, because the address somebody signs up with is
         * not always the one they paid with and they may fix that later. It is
         * cheap: with nothing queued it deletes nothing and returns zero.
         *
         * Failure is silent on purpose. Somebody signing in should not meet an
         * error about a migration they have never heard of, and the next
         * sign-in tries again.
         */
        /* Promise.resolve first. supabase.rpc() hands back a PostgrestBuilder,
           which is a thenable rather than a Promise: it implements then and
           nothing else. Calling .catch on it directly threw TypeError inside
           this listener on every single sign-in, before the request was ever
           sent, so the silent-failure path above was not silent and the claim
           never actually ran. Promise.resolve adopts the thenable and gives a
           real Promise with a real .catch. */
        Promise.resolve(supabase.rpc('claim_entitlements')).catch(() => {})
      }
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

        // Keep the timezone fresh, it decides when their digest arrives.
        const tz = localTimezone()
        if (data && data.timezone !== tz) {
          await supabase.from('profiles').update({ timezone: tz }).eq('id', session.user.id)
        }

        /**
         * A currency, once, and then never again.
         *
         * Deliberately not kept fresh the way the timezone above is. A
         * timezone is a fact about where the phone is right now and should
         * follow it; a currency is a decision, and re-detecting it on every
         * sign-in would silently overwrite the setting of anybody who travels
         * or whose browser reports a language they do not budget in.
         *
         * So it is written exactly when the column is still null, which is
         * what migration 22 leaves it as and what the picker can never set it
         * back to. Failure is silent: the app reads null as the fallback, and
         * the next sign-in tries again.
         */
        if (data && !data.currency) {
          const guess = detectCurrency(
            navigator.languages ?? [navigator.language].filter(Boolean),
          )
          const { data: updated } = await supabase
            .from('profiles')
            .update({ currency: guess })
            .eq('id', session.user.id)
            .select()
            .maybeSingle()
          if (updated && !cancelled) setProfile(updated)
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
     * OAuth is the primary path deliberately. The email fallback used to be a
     * magic link, which opens in whatever the OS considers the default
     * browser, frequently not the one the person started in, so the session
     * landed somewhere they could not see it. For an app meant to be used in
     * under a minute while standing up, that failure is fatal.
     *
     * It is now a six-digit code instead. A code is read in the mail app and
     * typed into the tab that is already open, so the browser never changes
     * and the failure mode is gone.
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
    /**
     * Sign in with Apple, which is not optional once Google is offered.
     *
     * Guideline 4.8: an app that offers any third-party sign-in must offer
     * Apple's alongside it. Not a nicety, a condition of being on the store,
     * and a rejection that costs a review cycle to discover.
     *
     * It is also the better option for a good number of people regardless of
     * any store, because Hide My Email means signing up without handing over
     * an address, which for an app holding a private budget is the kind of
     * thing somebody might reasonably want.
     *
     * Identical shape to Google's above, deliberately: same redirect, same
     * error handling, same return. The provider name is the only difference,
     * so there is no second code path to keep in step.
     *
     * NOTHING CALLS THIS RIGHT NOW, ON PURPOSE. The button was taken off the
     * sign-in screen because the provider cannot be configured without a paid
     * Apple Developer account, and a button that answers every tap with
     * provider-not-enabled is a worse first screen than one option fewer.
     *
     * TO TURN IT BACK ON: Supabase dashboard, Authentication, Providers,
     * Apple, which wants a Services ID, a Team ID, a Key ID and the .p8 key,
     * all from an enrolled Apple Developer account. Then put the button back
     * in SignIn.jsx, where the comment marking its place says the same.
     *
     * Kept rather than deleted because guideline 4.8 makes it mandatory the
     * day this app goes to the App Store: offering Google obliges offering
     * Apple. This is fifteen working lines against having to rediscover the
     * shape of it later.
     */
    signInWithApple: async () => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: { redirectTo: window.location.origin },
      })
      if (error) setAuthError({ code: error.code ?? 'oauth', description: error.message })
      return { error }
    },
    /**
     * Close the account, for good.
     *
     * One RPC. Everything it does is in supabase/31_delete_account.sql: the
     * groups this person created are handed to somebody else or wound up, the
     * avatar is removed from storage, and the auth.users row goes, taking
     * forty-seven cascading tables with it.
     *
     * The sign-out afterwards is not tidiness. The session's token is still in
     * this tab and still looks valid to the client until it expires; without
     * this the app would sit there holding a session for a user that no longer
     * exists, and every request would start failing in a way that reads as a
     * bug rather than as "your account is gone".
     */
    deleteAccount: async () => {
      const { error } = await supabase.rpc('delete_account')
      if (error) return { error }
      await supabase.auth.signOut()
      return { error: null }
    },
    /**
     * Sends a six-digit code, not a link.
     *
     * Supabase mints both for every request; which one arrives is decided
     * entirely by the email template. With `{{ .Token }}` in the template and
     * no `{{ .ConfirmationURL }}`, this is a code.
     *
     * `emailRedirectTo` is deliberately gone. It only ever configured where
     * the link lands, and there is no link now. Leaving it set would imply a
     * redirect that never happens.
     */
    signInWithEmail: async (email) => {
      const { error } = await supabase.auth.signInWithOtp({ email })
      if (error) setAuthError({ code: error.code ?? 'otp', description: error.message })
      return { error }
    },

    /**
     * Second half of the code flow. On success the client writes the session
     * itself, so the existing onAuthStateChange listener picks it up and the
     * app swaps to the signed-in tree with no navigation and no reload. That
     * is the entire reason a code beats a link here: the session is created
     * in the browser the person is already looking at.
     *
     * `type: 'email'` covers both a brand new address and a returning one.
     */
    verifyEmailCode: async (email, token) => {
      const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
      if (error) setAuthError({ code: error.code ?? 'otp_verify', description: error.message })
      return { error }
    },
    signOut: () => supabase.auth.signOut(),
    /**
     * Returns the failure rather than swallowing it.
     *
     * Most callers do not care: setting a flag that has already been set is
     * not worth an error message. The profile screen does, because a column
     * that is not there yet is an unrun migration, and "nothing happened when
     * I typed my birthday" is the one outcome that reads as a broken app.
     */
    updateProfile: async (patch) => {
      if (!session?.user) return { error: null }
      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', session.user.id)
        .select()
        .maybeSingle()
      if (data) setProfile(data)
      return { error: error ?? null }
    },
  }

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}
