import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Field } from '../components/ui'

export default function SignIn() {
  const { signInWithGoogle, signInWithEmail } = useAuth()
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
    <main className="flex min-h-dvh flex-col justify-between bg-black px-5 py-12">
      <div>
        <p className="label">Accountability, for four people who mean it</p>
        <h1 className="mt-6 font-display text-[44px] font-extrabold uppercase leading-[0.92] tracking-tight">
          Friends
        </h1>
        <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-white/50">
          One check-in a week, at the same time, with the same people. Sixty seconds. That's the
          whole thing.
        </p>
      </div>

      <div className="space-y-3">
        {sent ? (
          <p className="hair p-4 text-[14px] leading-snug text-white/70">
            Link sent to {email}. Open it on this device — if it opens in a different browser you'll
            need to sign in again there.
          </p>
        ) : (
          <>
            <button className="btn-solid" onClick={() => signInWithGoogle()}>
              Continue with Google
            </button>

            {showEmail ? (
              <form onSubmit={sendLink} className="space-y-3 pt-2">
                <Field label="Email">
                  <input
                    type="email"
                    required
                    className="field"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </Field>
                <button className="btn" disabled={busy}>
                  {busy ? 'Sending' : 'Send me a link'}
                </button>
              </form>
            ) : (
              <button className="btn" onClick={() => setShowEmail(true)}>
                Use email instead
              </button>
            )}
          </>
        )}
      </div>
    </main>
  )
}
