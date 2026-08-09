import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Field } from '../components/ui'
import ErrorNote from '../components/ErrorNote'
import { LegalLinks } from './Legal'
import { pickStickers, stickerSrc } from '../lib/art'
import { useT } from '../lib/i18n'

/**
 * Artwork, not the logo.
 *
 * A wordmark says who built the thing, which is the least interesting thing
 * to say on the one screen where somebody is deciding whether to bother. The
 * mark still exists, it lives in the app's top bar, where identification is
 * what is actually wanted.
 *
 * Overlapped and alternately tilted so the row reads as a handful of stickers
 * thrown down rather than as a toolbar of icons.
 */
// Filtered against what is actually in src/assets/stickers, so renaming
// or removing art degrades to a shorter row instead of broken images.
const HERO_ART = pickStickers(['cloudguy', 'skullfire', 'bass', 'burger', 'bird', 'popsicle'])

function ArtRow() {
  return (
    <div className="flex items-end pl-2" aria-hidden="true">
      {HERO_ART.map((name, i) => (
        <img
          key={name}
          src={stickerSrc(name)}
          alt=""
          // Negative margin overlaps them; the z-order runs left to right so
          // each one tucks behind the next.
          className="-ml-4 h-[4.5rem] w-[4.5rem] animate-rise object-contain first:ml-0 drop-shadow-[0_4px_10px_rgba(0,0,0,0.18)]"
          style={{
            zIndex: HERO_ART.length - i,
            transform: `rotate(${(i % 2 ? 1 : -1) * (4 + (i % 3) * 3)}deg) translateY(${i % 2 ? 5 : 0}px)`,
            animationDelay: `${i * 60}ms`,
          }}
        />
      ))}
    </div>
  )
}

export default function SignIn() {
  const { signInWithGoogle, signInWithEmail, verifyEmailCode, authError, clearAuthError } = useAuth()
  const { t } = useT()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [showEmail, setShowEmail] = useState(false)
  const [busy, setBusy] = useState(null) // 'google' | 'email' | 'code' | null

  async function google() {
    clearAuthError()
    setBusy('google')
    const { error } = await signInWithGoogle()
    // On success the browser leaves the page, so only a failure lands here.
    if (error) setBusy(null)
  }

  async function sendCode(e) {
    e.preventDefault()
    clearAuthError()
    setBusy('email')
    const { error } = await signInWithEmail(email.trim())
    setBusy(null)
    if (!error) setSent(true)
  }

  /**
   * On success nothing is navigated. Verifying writes the session, the auth
   * listener fires, and the router swaps this whole page out. Setting state
   * here would be setting state on a component about to unmount.
   */
  async function submitCode(e) {
    e.preventDefault()
    clearAuthError()
    setBusy('code')
    const { error } = await verifyEmailCode(email.trim(), code.trim())
    if (error) {
      setBusy(null)
      setCode('')
    }
  }

  // Wrong code, or waited too long. Either way the fix is a fresh one, so
  // this returns to the address step rather than leaving them stuck on a
  // code that can no longer work.
  function startOver() {
    clearAuthError()
    setSent(false)
    setCode('')
  }

  return (
    <div className="relative min-h-dvh bg-bg">
      <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-content flex-col justify-between gap-12 px-6 py-14">
        <div>
          <ArtRow />
          <h1 className="mt-10 text-hero text-ink">{t('signin.title')}</h1>
          <p className="lede mt-5 max-w-[34ch]">{t('signin.pitch')}</p>
        </div>

        <div className="animate-rise space-y-3">
          {/* Previously a failed sign-in showed nothing at all, so a disabled
              provider or an unlisted redirect URL looked like a dead button. */}
          <ErrorNote error={authError} />

          {sent ? (
            <form onSubmit={submitCode} className="space-y-5">
              <p className="text-body text-muted">{t('signin.code_sent', { email })}</p>

              <Field label={t('signin.code')}>
                {/*
                  inputMode numeric puts the digit pad up on a phone without
                  type="number", which would bring spinners and strip a
                  leading zero. autoComplete one-time-code is what lets iOS
                  offer the code straight from the notification, which is the
                  single biggest thing that makes this flow feel quick.

                  Deliberately no maxLength. The browser applies it to a paste
                  before React sees the value, so pasting "Code: 418205" out
                  of a mail app would clip to the first six characters and the
                  digit filter below would then leave nothing at all. Letting
                  the filter run on the whole pasted string and slicing after
                  means that paste yields 418205, which is what was meant.
                */}
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  autoFocus
                  className="field text-center text-hero tracking-[0.35em]"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  aria-label={t('signin.code')}
                />
              </Field>

              <button className="btn-primary press" disabled={busy !== null || code.length < 6}>
                {busy === 'code' ? t('signin.verifying') : t('signin.verify')}
              </button>

              <button type="button" className="btn-ghost press" onClick={startOver}>
                {t('signin.wrong_email')}
              </button>
            </form>
          ) : (
            <>
              <button className="btn-primary press" onClick={google} disabled={busy !== null}>
                {busy === 'google' ? t('signin.sending') : t('signin.google')}
              </button>

              {showEmail ? (
                <form onSubmit={sendCode} className="space-y-5 pt-4">
                  <Field label={t('signin.email')}>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      className="field"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </Field>
                  <button className="btn-ghost press" disabled={busy !== null}>
                    {busy === 'email' ? t('signin.sending') : t('signin.send_code')}
                  </button>
                </form>
              ) : (
                <button className="btn-ghost press" onClick={() => setShowEmail(true)}>
                  {t('signin.use_email')}
                </button>
              )}
            </>
          )}

          {/* Reachable before signing up, not after. You cannot agree to terms
              you were not allowed to read. */}
          <div className="pt-6">
            <LegalLinks />
          </div>
        </div>
      </main>
    </div>
  )
}
