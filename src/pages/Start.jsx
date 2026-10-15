import { useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useGroup } from '../context/GroupContext'
import { DAYS, localTimezone } from '../lib/time'
import { Field } from '../components/ui'
import Wordmark from '../components/Wordmark'
import { useT } from '../lib/i18n'
import { errorText } from '../lib/dberr'
import { CHALLENGE_DAYS, CHALLENGE_ID, challengeCopy, challengeGoals } from '../content/challenge'
import { codeFromText, invitePath } from '../lib/pendingJoin'

export default function Start() {
  const { reload } = useGroup()
  const navigate = useNavigate()
  const { t, locale } = useT()
  /**
   * A link can carry the code, and then this screen is already filled in.
   *
   * /start?join=RF7K2Q is what the invite sheet shares. Reading it here is the
   * difference between "tap this and you are in" and "tap this, then find the
   * Join tab, then retype six characters somebody read out to you".
   *
   * Seeded from the URL once rather than watched: after the first render this
   * is a form somebody is typing in, and a value that kept reasserting itself
   * from the address bar would fight them.
   */
  const [params] = useSearchParams()
  const invited = (params.get('join') ?? '').trim()

  const [mode, setMode] = useState(invited ? 'join' : 'create')
  /**
   * Le defi 21 matins: un groupe quotidien avec ses objectifs du matin deja
   * dedans (create_challenge, migration 76). Coche d'office quand on arrive de
   * la page du defi (/start?challenge=morning21).
   */
  const [challenge, setChallenge] = useState(params.get('challenge') === CHALLENGE_ID)
  const [name, setName] = useState(challenge ? challengeCopy(locale).name : '')
  const [dow, setDow] = useState(0)
  const [hour, setHour] = useState(18)
  const [code, setCode] = useState(invited)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  /* Un lien d'invitation (/start?join=CODE) ouvre la page qui nomme le
     groupe, avec un seul bouton, plutot qu'un formulaire ou recopier un
     code. Le formulaire reste pour un code dicte ou recopie a la main. */
  const invitation = invitePath(invited)
  if (invitation) return <Navigate to={invitation} replace />

  const dayNames =
    locale === 'fr'
      ? ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
      : DAYS

  async function create(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    if (challenge) return createChallenge()
    const { data, error: err } = await supabase.rpc('create_group', {
      p_name: name.trim(),
      p_timezone: localTimezone(),
      p_cadence_days: 7,
      p_checkin_dow: Number(dow),
      p_opens_hour: Number(hour),
      p_window_hours: 30,
    })
    setBusy(false)
    if (err) return setError(err.message)
    const g = Array.isArray(data) ? data[0] : data
    await reload()
    // Straight into the group you just made, this is the one moment where
    // landing inside one is what you asked for.
    if (g?.id) navigate(`/g/${g.id}`)
  }

  /**
   * Le groupe et ses objectifs en un seul appel, donc en une transaction: pas
   * de groupe defi sans objectifs si le reseau coupe entre deux.
   *
   * Les objectifs partent dans la langue de l'ecran, qui est celle de la
   * personne qui cree le groupe: ils sont ecrits une fois pour tout le groupe.
   */
  async function createChallenge() {
    const { data, error: err } = await supabase.rpc('create_challenge', {
      p_name: name.trim(),
      p_timezone: localTimezone(),
      p_challenge: CHALLENGE_ID,
      p_goals: challengeGoals(locale),
    })
    setBusy(false)
    if (err) {
      /* La fonction n'existe que si la migration 76 est passee. Le dire
         plutot que montrer "Could not find the function". */
      const missing = err.code === 'PGRST202' || /could not find the function/i.test(err.message ?? '')
      return setError(missing ? t('start.challenge_missing') : errorText(err))
    }
    const g = Array.isArray(data) ? data[0] : data
    await reload()
    if (g?.id) navigate(`/g/${g.id}`)
  }

  async function join(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { data, error: err } = await supabase.rpc('join_group', { p_code: codeFromText(code) ?? code.trim() })
    setBusy(false)
    if (err) return setError(err.message)
    const g = Array.isArray(data) ? data[0] : data
    await reload()
    if (g?.id) navigate(`/g/${g.id}`)
  }

  return (
    <div className="relative min-h-dvh bg-bg">
      <main className="relative z-10 mx-auto w-full max-w-content animate-rise px-6 pb-20 pt-14">
        <Wordmark size={140} />

        <div className="mt-10 flex gap-2">
          {[
            ['create', t('start.new_group')],
            ['join', t('start.join_one')],
          ].map(([v, label]) => (
            <button
              key={v}
              onClick={() => setMode(v)}
              className={mode === v ? 'chip-accent press' : 'chip-quiet press'}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'create' ? (
          <form onSubmit={create} className="mt-10 space-y-8">
            <Field label={t('start.group_name')}>
              <input
                className="field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('start.group_name_ph')}
                maxLength={60}
              />
            </Field>

            {/* Le defi: une case, et ce qu'elle change dit en une phrase. */}
            <label
              data-hook="start-challenge"
              className="press flex cursor-pointer items-start gap-3 rounded-inner bg-ink/[0.035] p-4"
            >
              <input
                type="checkbox"
                checked={challenge}
                onChange={(e) => {
                  const on = e.target.checked
                  setChallenge(on)
                  /* Le nom suit la case tant que personne ne l'a ecrit. */
                  const preset = challengeCopy(locale).name
                  if (on && !name.trim()) setName(preset)
                  if (!on && name === preset) setName('')
                }}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[rgb(var(--c-accent))]"
              />
              <span className="min-w-0">
                <span className="block text-body text-ink">{t('start.challenge_title')}</span>
                <span className="mt-0.5 block text-small text-muted">
                  {t('start.challenge_body', { n: challengeCopy(locale).goals.length, days: CHALLENGE_DAYS })}
                </span>
              </span>
            </label>

            {/* Un defi est quotidien: une periode par jour, de minuit a
                minuit. Le jour et l'heure d'un groupe hebdomadaire n'ont rien
                a regler ici. */}
            {!challenge && (
              <Field label={t('start.checkin_opens')} hint={t('start.checkin_hint')}>
                <div className="grid grid-cols-2 gap-4">
                  <select className="field-soft" value={dow} onChange={(e) => setDow(e.target.value)}>
                    {dayNames.map((d, i) => (
                      <option key={d} value={i}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <select className="field-soft" value={hour} onChange={(e) => setHour(e.target.value)}>
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, '0')}:00
                      </option>
                    ))}
                  </select>
                </div>
              </Field>
            )}

            {!challenge && (
              <p className="text-small text-muted">
                {t('start.window_note', { tz: localTimezone() })}
              </p>
            )}

            {error && <p className="card text-small text-negative">{error}</p>}

            <button className="btn-primary press" disabled={busy || name.trim().length < 2}>
              {busy ? t('start.creating') : challenge ? t('start.create_challenge') : t('start.create')}
            </button>
          </form>
        ) : (
          <form onSubmit={join} className="mt-10 space-y-8">
            <Field label={t('start.invite_code')} hint={t('start.invite_hint')}>
              <input
                className="field text-center text-h2 uppercase tracking-[0.3em]"
                value={code}
                /* Un lien ou un message colle donne son code. Plus de
                   maxLength={6}: le navigateur coupait le lien colle avant
                   meme qu'on puisse le lire. */
                onChange={(e) => setCode(codeFromText(e.target.value) ?? e.target.value.toUpperCase().slice(0, 200))}
                placeholder="A1B2C3"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                data-hook="join-code"
              />
            </Field>

            {error && <p className="card text-small text-negative">{error}</p>}

            <button className="btn-primary press" disabled={busy || code.trim().length < 4}>
              {busy ? t('start.joining') : t('start.join')}
            </button>
          </form>
        )}
      </main>
    </div>
  )
}
