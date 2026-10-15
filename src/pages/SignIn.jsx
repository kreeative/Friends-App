import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Field } from '../components/ui'
import ErrorNote from '../components/ErrorNote'
import { LegalLinks } from './Legal'
import { stickerSrc } from '../lib/art'
import { useT } from '../lib/i18n'
import { Sparkle, Spot, Tape, cast } from '../components/StickerKit'
import { headline, useLineEnd } from '../components/Headline'
import { readJoin } from '../lib/pendingJoin'

/**
 * EN COLLAGE, COMME L'ACCUEIL.
 *
 *   "Pareil pour la page que les gens trouvent quand ils s'inscrivent, on
 *    peut rendre ça plus amusant"
 *
 * C'etait une carte blanche avec une rangee de six petits stickers serres au
 * dessus du titre. C'est maintenant la grammaire de la page d'accueil: des
 * stickers accroches aux mots du titre (headline(), le meme code et le meme
 * plafond d'encre), le surligneur jaune derriere la fin de la phrase, du
 * scotch sur la carte, des stickers colles a ses coins, et sur un grand ecran
 * d'autres poses dans le vide autour d'elle. Sur un telephone, des amis qui
 * depassent du bas de l'ecran, comme sous le panneau jaune de l'accueil.
 *
 * Que de vrais stickers, et rien qui se fasse passer pour un: pas de badge,
 * pas de bord blanc dessine en code (CLAUDE.md). Rien ne couvre un mot hors du
 * titre, et rien ne bouge seul apres son arrivee.
 *
 * Chaque liste passe par cast(), pour qu'un sticker renomme soit remplace au
 * lieu de laisser un trou.
 */
/* Sur le titre: BRO sur le premier mot, l'oiseau qui dit "sup" au bout de la
   premiere ligne, l'esquimau au bout de la phrase. */
const TITLE_ART = cast(['bro', 'bird', 'popsicle'])
/* Colles aux coins de la carte, a partir de sm. */
const CARD_ART = cast(['cat', 'eyelips'])
/* Dans le vide autour de la carte, a partir de lg. */
const FIELD_ART = cast(['unicorn', 'deer', 'burger', 'hot'])
/* Ceux qui depassent du bas de l'ecran, sur un telephone. */
const PEEK_ART = cast(['homie', 'cat', 'eyelips'])

/**
 * Six boxes, one input.
 *
 * The tempting build is six separate inputs with focus-hopping between them.
 * It looks the same and behaves badly: paste puts all six digits in the first
 * box, iOS will not offer the code from the notification because there is no
 * single field to fill, backspace at the start of a box does nothing, and
 * every browser autofill path has to be re-implemented by hand.
 *
 * So there is exactly one real input, stretched invisibly across the whole
 * row, and the boxes underneath are decoration that reads its value. Paste,
 * autofill, the one-time-code keyboard hint and backspace all keep working
 * because they are talking to an ordinary text input. The caret is hidden and
 * drawn instead as a pulsing box outline, so the row still shows where you
 * are without a text cursor sitting in the middle of a rectangle.
 */
/**
 * Supabase's OTP length is a server setting, between 6 and 10 digits, and the
 * browser has no way to ask what it is. This row was built assuming 6 and
 * capped the input at 6, so a project configured for 9 produced an email full
 * of digits that could not physically be typed in: the field refused the last
 * three and the button stayed disabled. Being unable to sign in at all is a
 * bad way to express a config mismatch.
 *
 * So six is the shape it draws, not a limit it enforces. The row grows to fit
 * whatever arrives, up to the ten Supabase allows, and submitting only needs
 * the minimum. Setting the project back to 6 makes this invisible again.
 */
const OTP_MIN = 6
const OTP_MAX = 10

function CodeBoxes({ value, onChange, label, length = OTP_MIN }) {
  const [focused, setFocused] = useState(false)
  const cells = Array.from({ length: Math.min(Math.max(length, value.length), OTP_MAX) })
  // The cell the next digit lands in, clamped so a full code keeps the last
  // box lit rather than pointing past the end of the row.
  const active = Math.min(value.length, cells.length - 1)

  return (
    <div className="relative">
      <div className="flex gap-2" aria-hidden="true">
        {cells.map((_, i) => {
          const filled = i < value.length
          const here = focused && i === active
          return (
            <div
              key={i}
              className={`flex h-16 min-w-0 flex-1 items-center justify-center rounded-inner border-2 bg-surface font-display leading-none text-ink transition-colors duration-150 [font-variant-numeric:tabular-nums] ${cells.length > 6 ? 'text-h2' : 'text-h1'} ${
                here ? 'border-accent' : filled ? 'border-ink/25' : 'border-ink/10'
              }`}
            >
              {value[i] ?? ''}
            </div>
          )
        })}
      </div>

      <input
        type="text"
        required
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        autoFocus
        aria-label={label}
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        /* No maxLength. The browser applies it to a paste before React sees
           the value, so pasting "Code: 418205" out of a mail app clipped to
           six characters and the digit filter then left nothing at all.
           Filtering the whole pasted string and slicing after makes it work. */
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, OTP_MAX))}
        className="absolute inset-0 h-full w-full cursor-pointer rounded-inner border-0 bg-transparent p-0 text-transparent caret-transparent outline-none focus:ring-0"
      />
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
  const [codeError, setCodeError] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  /**
   * The resend cooldown.
   *
   * Thirty seconds, counted down in state rather than by comparing timestamps
   * on render, because the button has to relabel itself every second anyway.
   * Cleared on unmount so a signed-in user does not leave an interval running.
   *
   * It is not only politeness: Supabase rate-limits the send endpoint, and a
   * button somebody can hit five times in five seconds spends that budget and
   * then starts failing for reasons nobody can see.
   */
  useEffect(() => {
    if (cooldown <= 0) return
    const id = setInterval(() => setCooldown((n) => (n <= 1 ? 0 : n - 1)), 1000)
    return () => clearInterval(id)
  }, [cooldown])

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
    if (!error) {
      setSent(true)
      setCooldown(30)
    }
  }

  /**
   * A second code for the same address.
   *
   * Sending a new one invalidates the old, so the boxes are emptied at the
   * same time: leaving the previous digits sitting there invites somebody to
   * submit a code that is already dead and read the resulting error as the
   * app being broken.
   */
  async function resend() {
    if (cooldown > 0 || busy) return
    clearAuthError()
    setCodeError(false)
    setCode('')
    setBusy('email')
    const { error } = await signInWithEmail(email.trim())
    setBusy(null)
    if (!error) setCooldown(30)
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
      /* One message, ours, rather than the provider's. Supabase says "Token
         has expired or is invalid", which names an implementation detail and
         reads as a fault. The reply that matters is the same either way: that
         code will not work, get another. clearAuthError so the generic
         ErrorNote does not also print the raw string underneath. */
      clearAuthError()
      setCodeError(true)
    }
  }

  // Wrong code, or waited too long. Either way the fix is a fresh one, so
  // this returns to the address step rather than leaving them stuck on a
  // code that can no longer work.
  function startOver() {
    clearAuthError()
    setCodeError(false)
    setSent(false)
    setCode('')
    setCooldown(0)
  }

  /* Un lien d'invitation ou la page du defi a laisse quelque chose en
     attente: le dire, pour que la personne sache que se connecter la mene au
     groupe et pas a un accueil vide. */
  const [pending] = useState(() => {
    try {
      return readJoin(window.localStorage)
    } catch {
      return null
    }
  })

  const title = useRef(null)
  const heading = t('signin.title')
  useLineEnd(title, heading)

  return (
    <div className="relative min-h-dvh overflow-hidden bg-bg" data-hook="signin">
      {/* Dans le vide autour de la carte, sur un grand ecran seulement: a
          1024 px il reste 288 px de chaque cote, assez pour un sticker sans
          toucher la carte. */}
      <div aria-hidden="true" data-hook="signin-field" className="pointer-events-none absolute inset-0 hidden lg:block">
        <Spot name={FIELD_ART[0]} tilt={-10} delay={300} className="absolute left-[9%] top-[13%] w-36" />
        <Spot name={FIELD_ART[1]} tilt={8} delay={420} className="absolute bottom-[11%] left-[14%] w-28" />
        <Spot name={FIELD_ART[2]} tilt={9} delay={540} className="absolute right-[11%] top-[17%] w-28" />
        <Spot name={FIELD_ART[3]} tilt={-7} delay={660} className="absolute bottom-[15%] right-[15%] w-16" />
        <Sparkle className="absolute left-[25%] top-[34%] w-6 text-[#FF007A]" />
        <Sparkle className="absolute bottom-[34%] right-[25%] w-5 text-[#009DB9]" />
      </div>
      {/**
       * A card, centred, rather than a column pinned to the top and bottom of
       * the window.
       *
       * `justify-between` on a full-height column is right on a phone, where
       * it puts the pitch under the thumb and the button above it. On a laptop
       * it stretched the same two blocks 900px apart with nothing between
       * them, which is the "floats loosely in wide empty space" in the report.
       *
       * So: still a column on a phone, a centred card from sm up. min-h-dvh
       * and not min-h-screen, because on iOS Safari the latter is the window
       * INCLUDING the toolbars that overlap it, which puts the bottom of a
       * centred card under the address bar.
       */}
      {/* pb-36 sur un telephone: la place des amis qui depassent du bas. */}
      <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-content flex-col justify-center px-6 pb-36 pt-16 sm:max-w-[28rem] sm:pb-14 sm:pt-14">
        {/* The whole thing is one sheet at sm and up, and nothing at all below
            it: a card inside a 390px screen is a border drawn 16px from
            another border. */}
        {/* Le scotch et les stickers de la carte sont poses sur une enveloppe
            de la meme taille, APRES la carte, et pas dedans: .lg met
            `position: relative` a tous ses enfants directs, hors couche, et
            ca l'emporte sur `absolute`. Dedans, ils tombaient dans le flux en
            haut de la carte. Apres elle, ils sont peints par-dessus son bord. */}
        <div className="relative">
        <div className="sm:lg sm:lg-frost sm:p-8" data-hook="signin-card">
        <div>
          {/* Le titre de l'accueil, en plus petit: memes stickers accroches
              aux mots, meme plafond d'encre. 44 px a 320, 56 px des 431. */}
          <h1
            ref={title}
            data-hook="signin-title"
            className="relative mt-6 text-[clamp(2.75rem,13vw,3.5rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-ink sm:mt-8"
          >
            {headline(heading, t('signin.mark'), {
              first: (
                <Spot
                  name={TITLE_ART[0]}
                  tilt={-12}
                  delay={240}
                  eager
                  style={{ left: '-0.25em', top: '-0.66em', width: '1.45em' }}
                />
              ),
              last: (
                <Spot
                  name={TITLE_ART[2]}
                  tilt={12}
                  delay={480}
                  eager
                  style={{ left: 'calc(100% - 0.12em)', top: '0.1em', width: '0.78em' }}
                />
              ),
            })}
            <Spot
              name={TITLE_ART[1]}
              tilt={8}
              delay={360}
              eager
              className="absolute"
              style={{ left: 'calc(var(--line-end, 100%) - 0.32em)', top: '-0.98em', width: '1.1em' }}
            />
          </h1>
          <p className="lede mt-5 max-w-[34ch]">{t('signin.pitch')}</p>
          {pending && (
            <p data-hook="signin-pending" className="mt-4 max-w-[34ch] text-body font-semibold text-ink">
              {pending.code ? t('signin.joining') : t('signin.challenge')}
            </p>
          )}
        </div>

        <div className="animate-rise mt-8 space-y-3">
          {/* Previously a failed sign-in showed nothing at all, so a disabled
              provider or an unlisted redirect URL looked like a dead button. */}
          <ErrorNote error={authError} />

          {sent ? (
            <form onSubmit={submitCode} className="space-y-5">
              <p className="text-body text-muted">{t('signin.code_sent', { email })}</p>

              <Field label={t('signin.code')}>
                <CodeBoxes
                  value={code}
                  onChange={(v) => {
                    if (codeError) setCodeError(false)
                    setCode(v)
                  }}
                  label={t('signin.code')}
                />
              </Field>

              {codeError && (
                <p className="field-note !text-negative" role="alert">
                  {t('signin.code_invalid')}
                </p>
              )}

              <button className="btn-primary press" disabled={busy !== null || code.length < OTP_MIN}>
                {busy === 'code' ? t('signin.verifying') : t('signin.verify')}
              </button>

              <button
                type="button"
                className="btn-ghost press"
                onClick={resend}
                disabled={cooldown > 0 || busy !== null}
              >
                {cooldown > 0 ? t('signin.resend_in', { s: cooldown }) : t('signin.resend')}
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

              {/**
                * Sign in with Apple sat here and has been taken out.
                *
                * Guideline 4.8 obliges an app offering any third-party
                * sign-in to offer Apple's beside it, so it goes back the day
                * this app goes to the App Store. It is out for now because
                * the provider needs a paid Apple Developer account to
                * configure, and an unconfigured provider is worse than no
                * button: it looks like a way in, and it answers with an
                * error nobody signing up can do anything about.
                *
                * signInWithApple is still in AuthContext, working and
                * unused, so restoring this is putting a button back rather
                * than writing the thing again.
                */}

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
        </div>
        {/* Avec la carte seulement, donc a partir de sm. */}
        <div aria-hidden="true" data-hook="signin-card-art" className="pointer-events-none hidden sm:block">
          <Tape className="-top-3 left-10" tilt={-7} />
          <Tape className="-top-3 right-12" tilt={6} tone="255 0 122" />
          <Spot name={CARD_ART[0]} tilt={-12} delay={520} className="absolute -bottom-14 -left-12 w-24" />
          <Spot name={CARD_ART[1]} tilt={10} delay={640} className="absolute -right-11 top-[42%] w-[4.5rem]" />
        </div>
        </div>
      </main>

      {/* Des amis qui depassent du bas de l'ecran, sur un telephone, comme
          sous le panneau jaune de l'accueil. Sous le pb-36 de la colonne,
          donc sous aucun mot. */}
      <div
        aria-hidden="true"
        data-hook="peekers"
        className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-center gap-[7%] sm:hidden"
      >
        {PEEK_ART.map((name, i) =>
          stickerSrc(name) ? (
            <img
              key={name}
              src={stickerSrc(name)}
              alt=""
              draggable="false"
              data-sticker={name}
              className="peek w-[24%] max-w-[7rem] drop-shadow-[0_-4px_10px_rgb(0_0_0/0.12)]"
              style={{ '--tilt': `${[-7, 4, 8][i]}deg`, '--sink': `${[34, 26, 36][i]}%` }}
            />
          ) : null,
        )}
      </div>
    </div>
  )
}
