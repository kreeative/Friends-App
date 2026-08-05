import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Field } from '../components/ui'
import Wordmark from '../components/Wordmark'
import ErrorNote from '../components/ErrorNote'
import { LegalLinks } from './Legal'
import { useT } from '../lib/i18n'

export default function SignIn() {
  const { signInWithGoogle, signInWithEmail, authError, clearAuthError } = useAuth()
  const { t } = useT()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [showEmail, setShowEmail] = useState(false)
  const [busy, setBusy] = useState(null) // 'google' | 'email' | null

  async function google() {
    clearAuthError()
    setBusy('google')
    const { error } = await signInWithGoogle()
    // On success the browser leaves the page, so only a failure lands here.
    if (error) setBusy(null)
  }

  async function sendLink(e) {
    e.preventDefault()
    clearAuthError()
    setBusy('email')
    const { error } = await signInWithEmail(email.trim())
    setBusy(null)
    if (!error) setSent(true)
  }

  return (
    <div className="relative min-h-dvh bg-bg">
      <div className="ambient" aria-hidden="true" />

      <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-content flex-col justify-between px-6 py-14">
        <div className="animate-rise">
          <Wordmark width={280} className="max-w-full" />
          <p className="lede mt-8 max-w-[34ch]">{t('signin.pitch')}</p>
        </div>

        <div className="animate-rise space-y-3">
          {/* Previously a failed sign-in showed nothing at all, so a disabled
              provider or an unlisted redirect URL looked like a dead button. */}
          <ErrorNote error={authError} />

          {sent ? (
            <p className="card text-body text-muted">{t('signin.link_sent', { email })}</p>
          ) : (
            <>
              <button className="btn-primary press" onClick={google} disabled={busy !== null}>
                {busy === 'google' ? t('signin.sending') : t('signin.google')}
              </button>

              {showEmail ? (
                <form onSubmit={sendLink} className="space-y-5 pt-4">
                  <Field label={t('signin.email')}>
                    <input
                      type="email"
                      required
                      className="field"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </Field>
                  <button className="btn-ghost press" disabled={busy !== null}>
                    {busy === 'email' ? t('signin.sending') : t('signin.send_link')}
                  </button>
                </form>
              ) : (
                <button className="btn-ghost press" onClick={() => setShowEmail(true)}>
                  {t('signin.use_email')}
                </button>
              )}
            </>
          )}

          {/* Reachable before signing up, not after — you cannot agree to terms
              you were not allowed to read. */}
          <div className="pt-6">
            <LegalLinks />
          </div>
        </div>
      </main>
    </div>
  )
}
