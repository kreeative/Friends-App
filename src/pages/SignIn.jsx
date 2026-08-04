import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Field } from '../components/ui'
import Wordmark from '../components/Wordmark'
import { LegalLinks } from './Legal'
import { useT } from '../lib/i18n'

export default function SignIn() {
  const { signInWithGoogle, signInWithEmail } = useAuth()
  const { t } = useT()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [showEmail, setShowEmail] = useState(false)
  const [busy, setBusy] = useState(false)

  async function sendLink(e) {
    e.preventDefault()
    setBusy(true)
    const { error } = await signInWithEmail(email.trim())
    setBusy(false)
    if (!error) setSent(true)
  }

  return (
    <div className="relative min-h-dvh bg-bg">
      <div className="ambient" aria-hidden="true" />

      <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-content flex-col justify-between px-6 py-14">
        <div className="animate-rise">
          {/* The wordmark is the hero here — the one place it appears at size. */}
          <Wordmark width={280} className="max-w-full" />
          <p className="lede mt-8 max-w-[34ch]">{t('signin.pitch')}</p>
        </div>

        <div className="animate-rise space-y-3">
          {sent ? (
            <p className="card text-body text-muted">{t('signin.link_sent', { email })}</p>
          ) : (
            <>
              <button className="btn-primary press" onClick={() => signInWithGoogle()}>
                {t('signin.google')}
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
                  <button className="btn-ghost press" disabled={busy}>
                    {busy ? t('signin.sending') : t('signin.send_link')}
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
