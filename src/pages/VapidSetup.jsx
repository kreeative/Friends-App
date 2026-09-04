import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CONTACT_EMAIL } from '../legal/content'
import { useT } from '../lib/i18n'
import { Screen, Section, TopBar } from '../components/ui'

/**
 * The VAPID key pair, generated on the device that is reading this page.
 *
 * WHY THIS EXISTS AS A PAGE AND NOT AS A COMMAND.
 *
 * Everything else in this project is set up by running something in a
 * terminal, and scripts/vapid.mjs is the terminal version of exactly this. It
 * assumes a computer. Anne-Kelly does not have one: this app was built, tested
 * and deployed from an iPad and a phone, so "run node scripts/vapid.mjs" is
 * not an instruction she can follow, and the feature was going to stay off
 * forever because of a shell command.
 *
 * So the same twelve lines of arithmetic run here instead. Web Crypto has
 * generateKey on every browser that can install this app, and the maths is not
 * the hard part of a VAPID pair. Having somewhere safe to do it is.
 *
 * THE KEY NEVER LEAVES THIS DEVICE, AND THAT IS THE ENTIRE POINT.
 *
 * It is generated in the browser, held in a component's state, and shown on
 * screen. It is never sent to Supabase, never sent to Vercel by this page,
 * never written to localStorage, and never logged. Closing the tab destroys
 * it. That is what makes this safer than the alternatives actually available
 * to somebody without a computer, which are pasting a private key into a chat
 * window or handing it to one of the "free VAPID generator" sites, every one
 * of which is a stranger's server being told a key that can send a
 * notification to every person who ever turns this on.
 *
 * NOT LINKED FROM ANYWHERE, ON PURPOSE.
 *
 * The settings screen keeps its ordinary message. A tester who reads "not set
 * up on this build yet" does not need a key generator underneath it, and
 * gating one by account would mean putting an owner's email address in a
 * public repository. An unlisted address is enough here because the page
 * discloses nothing: it generates fresh random numbers and reads no
 * configuration. Somebody who finds it learns that this app uses web push.
 */

/** base64url, no padding. The form every VAPID field wants. */
function b64url(bytes) {
  let bin = ''
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * One P-256 pair, in the two shapes the two halves of the system want.
 *
 * The public key goes out as the uncompressed point: 0x04 then x then y, 65
 * bytes, which is what applicationServerKey takes in the browser and what a
 * push service expects in `k=`. Web Crypto's 'raw' export is already that
 * form. The private half is the JWK's `d`.
 *
 * ECDSA rather than ECDH, because this key signs the VAPID token. Same curve,
 * same bytes; the algorithm name is what the browser will let you sign with.
 */
async function generate() {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  )
  const raw = await crypto.subtle.exportKey('raw', pair.publicKey)
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)

  const bytes = new Uint8Array(raw)
  /* Checked before anything is shown. A key of the wrong shape pastes in
     cleanly and then fails at send time with a 403, which from a phone looks
     exactly like the feature not existing. */
  if (bytes.length !== 65 || bytes[0] !== 4) {
    throw new Error(`the browser produced a ${bytes.length}-byte key, expected 65`)
  }
  return { publicKey: b64url(raw), privateKey: jwk.d }
}

/** One value, with a way to get it into the clipboard on a touch screen. */
function KeyRow({ name, value, secret = false }) {
  const { t } = useT()
  const [copied, setCopied] = useState(false)

  return (
    <div className="mt-5" data-hook="key-row" data-name={name}>
      <p className="text-small font-semibold text-ink">
        {name}
        {secret && <span className="ml-2 text-small font-normal text-negative">{t('vapid.secret')}</span>}
      </p>
      {/**
       * A readonly input rather than a <p>.
       *
       * The clipboard API needs a user gesture and can still be refused, and a
       * refusal here would leave somebody staring at a key they cannot move.
       * An input can be tapped, selected and copied by hand on every phone,
       * which is the fallback that always works. `readOnly`, not `disabled`:
       * a disabled field cannot be selected either.
       */}
      <input
        readOnly
        value={value}
        onFocus={(e) => e.target.select()}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        className="mt-1.5 w-full rounded-inner bg-ink/[0.05] px-3 py-2.5 font-mono text-small text-ink"
      />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          } catch {
            /* Refused, which is why the field above is selectable. */
            setCopied(false)
          }
        }}
        className="goal-action press mt-2"
      >
        {copied ? t('vapid.copied') : t('vapid.copy')}
      </button>
    </div>
  )
}

export default function VapidSetup() {
  const { t } = useT()
  const [keys, setKeys] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  return (
    <Screen>
      <TopBar title={t('vapid.title')} back="/settings" backLabel={t('nav.settings')} />

      <Section>
        <div className="card" data-hook="vapid-setup">
          <p className="text-body text-muted">{t('vapid.intro')}</p>

          {!keys && (
            <>
              <button
                type="button"
                data-hook="vapid-generate"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  setError(null)
                  try {
                    setKeys(await generate())
                  } catch (e) {
                    setError(String(e?.message ?? e))
                  }
                  setBusy(false)
                }}
                className="btn-primary press mt-6"
              >
                {busy ? t('vapid.working') : t('vapid.generate')}
              </button>
              {/* The warning belongs BEFORE the button, in effect, because
                  after it is pressed the damage of pressing it again is
                  already possible. It reads as a caption to the button. */}
              <p className="mt-3 text-small text-muted">{t('vapid.once')}</p>
            </>
          )}

          {error && (
            <p className="mt-4 text-small text-negative" role="alert">
              {error}
            </p>
          )}

          {keys && (
            <div data-hook="vapid-keys">
              <p className="mt-8 text-body font-semibold text-ink">{t('vapid.step_supabase')}</p>
              <p className="mt-1 text-small text-muted">{t('vapid.where_supabase')}</p>
              <KeyRow name="VAPID_PUBLIC_KEY" value={keys.publicKey} />
              <KeyRow name="VAPID_PRIVATE_KEY" value={keys.privateKey} secret />
              <KeyRow name="VAPID_SUBJECT" value={`mailto:${CONTACT_EMAIL}`} />

              <p className="mt-10 text-body font-semibold text-ink">{t('vapid.step_vercel')}</p>
              <p className="mt-1 text-small text-muted">{t('vapid.where_vercel')}</p>
              <KeyRow name="VITE_VAPID_PUBLIC_KEY" value={keys.publicKey} />

              <p className="mt-8 rounded-inner bg-ink/[0.05] px-4 py-3 text-small text-ink">
                {t('vapid.then_redeploy')}
              </p>
              <p className="mt-4 text-small text-negative">{t('vapid.close_tab')}</p>

              <Link to="/settings" className="btn-primary press mt-6 inline-flex w-auto px-9">
                {t('vapid.done')}
              </Link>
            </div>
          )}
        </div>
      </Section>
    </Screen>
  )
}
