import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { supabase } from '../lib/supabase'
import { useT } from '../lib/i18n'
import { errorText } from '../lib/dberr'
import { usePageMeta } from '../lib/pageMeta'
import { CHALLENGE_DAYS, challengeCopy } from '../content/challenge'
import { cleanCode, rememberJoin, signinPath } from '../lib/pendingJoin'
import { currentInAppBrowser } from '../lib/inAppBrowser'
import { stickerSrc } from '../lib/art'
import { LockupInline } from '../components/Wordmark'
import { Tick } from '../components/ui'
import { Sparkle, Spot, Tape, cast } from '../components/StickerKit'

/**
 * LA PAGE D'UN LIEN D'INVITATION: /join/CODE.
 *
 *   "Why every time when you click on this kind of link, it's always sending
 *    you to the normal home page of the app? It doesn't send you to a page
 *    saying, hey, join this group with the link you clicked."
 *
 * Le lien du defi ouvrait la page de presentation du defi: le style de
 * l'accueil, le menu du site, un titre general, et "Rejoindre le defi" meme
 * pour quelqu'un qui en faisait deja partie. Rien ne disait quel groupe.
 *
 * Ici, une seule chose: le groupe, et un bouton.
 *
 *   pas connecte          le nom (pour un defi), le nombre de personnes, ce
 *                         qu'on demande chaque matin, et "Rejoindre le
 *                         groupe": le code est retenu et la connexion s'ouvre
 *                         en disant quel groupe attend (src/lib/pendingJoin.js)
 *   connecte              "Rejoindre le groupe" rejoint tout de suite et ouvre
 *                         le tableau, ou la question du partage attend
 *   deja dedans           "Tu fais deja partie de ce groupe" et "Ouvrir"
 *   code inconnu          le dire, et un lien vers l'accueil
 *
 * Ce que la page montre avant la connexion vient de invite_preview() et
 * invite_goals() (migration 77): le nom d'un groupe ordinaire n'apparait
 * qu'une fois connecte, pour que personne ne puisse essayer des codes au
 * hasard et lire des noms de groupes prives. Sans la 77, la page dit "un
 * groupe" et le bouton marche quand meme.
 *
 * Pas le menu du site ni son pied de page: une invitation est un ecran a une
 * seule action, comme la connexion, dont elle reprend la composition.
 */
const FIELD_ART = cast(['daisy', 'baller', 'koi', 'thumb'])
const CARD_ART = cast(['homie', 'bird'])
const PEEK_ART = cast(['cat', 'fox', 'pickle'])

function browserStore() {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** Le premier rang d'une fonction qui rend une table, ou null. */
const first = (data) => (Array.isArray(data) ? data[0] ?? null : data ?? null)

export default function Invite() {
  const { code: raw } = useParams()
  const code = cleanCode(raw)
  const { user } = useAuth()
  const { reload } = useGroup()
  const { t, locale } = useT()
  const navigate = useNavigate()

  /* loading | ready | missing | failed */
  const [state, setState] = useState(code ? 'loading' : 'missing')
  const [group, setGroup] = useState(null)
  const [goals, setGoals] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const inApp = currentInAppBrowser()

  useEffect(() => {
    if (!code) return
    let dead = false
    ;(async () => {
      setState('loading')
      const { data, error: err } = await supabase.rpc('invite_preview', { p_code: code })
      if (dead) return
      if (err) {
        /* La 77 pas encore passee: une invitation sans details, qui marche. */
        if (err.code === 'PGRST202' || /could not find the function/i.test(err.message ?? '')) {
          setGroup({ name: null, members: null, challenge: null, is_member: false, group_id: null })
          setState('ready')
          return
        }
        setError(errorText(err))
        setState('failed')
        return
      }
      const row = first(data)
      if (!row) {
        setState('missing')
        return
      }
      setGroup(row)
      setState('ready')
      if (row.challenge) {
        const { data: list } = await supabase.rpc('invite_goals', { p_code: code })
        if (!dead && Array.isArray(list)) setGoals(list.map((r) => r.title).filter(Boolean))
      }
    })()
    return () => {
      dead = true
    }
  }, [code, user?.id, attempt])

  const name = group?.name ?? null
  usePageMeta({
    title: `${name ?? t('invite.private_title')} · Rich & Friends`,
    description: t('invite.note'),
  })

  async function join() {
    setError(null)
    if (!user) {
      rememberJoin(code, browserStore(), Date.now(), name)
      /* Le code part aussi dans l'adresse: depuis TikTok ou Instagram, on
         rouvre souvent la page dans Safari ou Chrome pour se connecter, et le
         stockage du navigateur, lui, ne suit pas. */
      navigate(signinPath(code))
      return
    }
    setBusy(true)
    const { data, error: err } = await supabase.rpc('join_group', { p_code: code })
    if (err) {
      setBusy(false)
      if (/no group with that code/i.test(err.message ?? '')) setState('missing')
      else setError(errorText(err))
      return
    }
    const g = first(data)
    await reload()
    navigate(g?.id ? `/g/${g.id}` : '/')
  }

  /* Les objectifs du defi: ceux de la base, sinon ceux de l'app dans la
     langue de la personne (avant la migration 77). */
  const list = group?.challenge
    ? goals.length > 0
      ? goals
      : challengeCopy(locale).goals.map((g) => g.title)
    : []

  return (
    <div className="relative min-h-dvh overflow-hidden bg-bg" data-hook="invite">
      {/* Dans le vide autour de la carte, sur un grand ecran seulement. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden lg:block">
        <Spot name={FIELD_ART[0]} tilt={-10} delay={300} className="absolute left-[10%] top-[14%] w-32" />
        <Spot name={FIELD_ART[1]} tilt={8} delay={420} className="absolute bottom-[12%] left-[13%] w-28" />
        <Spot name={FIELD_ART[2]} tilt={9} delay={540} className="absolute right-[10%] top-[18%] w-32" />
        <Spot name={FIELD_ART[3]} tilt={-7} delay={660} className="absolute bottom-[16%] right-[15%] w-20" />
        <Sparkle className="absolute left-[24%] top-[36%] w-6 text-[#FF007A]" />
        <Sparkle className="absolute bottom-[32%] right-[24%] w-5 text-[#009DB9]" />
      </div>

      <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-content flex-col justify-center px-6 pb-36 pt-10 sm:max-w-[30rem] sm:pb-14">
        <Link to="/" aria-label={t('invite.home')} className="self-start">
          <LockupInline size={38} />
        </Link>

        <div className="relative mt-8">
          <div className="sm:lg sm:lg-frost sm:p-8" data-hook="invite-card">
            {state === 'loading' && (
              <div role="status" aria-live="polite" data-hook="invite-loading">
                <p className="text-label font-semibold uppercase tracking-[0.14em] text-muted">{t('invite.eyebrow')}</p>
                <div className="mt-4 h-12 w-4/5 animate-pulse rounded-inner bg-ink/[0.06]" />
                <div className="mt-4 h-5 w-1/2 animate-pulse rounded-inner bg-ink/[0.05]" />
                <span className="sr-only">{t('err.loading')}</span>
              </div>
            )}

            {state === 'missing' && (
              <div data-hook="invite-missing">
                <h1 className="text-[clamp(1.875rem,8vw,2.5rem)] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">
                  {t('invite.missing_title')}
                </h1>
                <p className="mt-4 max-w-[38ch] text-body text-muted">{t('invite.missing_body')}</p>
                <Link to="/" className="btn-primary press mt-8 text-[1.1875rem] font-bold">
                  {t('invite.home')}
                </Link>
              </div>
            )}

            {state === 'failed' && (
              <div data-hook="invite-failed">
                <p className="text-body text-ink" role="alert">
                  {error}
                </p>
                <button type="button" className="btn-ghost press mt-6" onClick={() => setAttempt((n) => n + 1)}>
                  {t('invite.retry')}
                </button>
              </div>
            )}

            {state === 'ready' && group && (
              <div data-hook="invite-ready">
                <p className="text-label font-semibold uppercase tracking-[0.14em] text-muted">
                  {name ? t('invite.eyebrow') : t('invite.eyebrow_private')}
                </p>
                <h1
                  data-hook="invite-title"
                  className="mt-3 text-[clamp(2.25rem,10vw,3rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-ink [overflow-wrap:break-word]"
                >
                  {name ? <span className="marker">{name}</span> : t('invite.private_title')}
                </h1>

                <p className="mt-4 text-body text-muted" data-hook="invite-facts">
                  {group.members != null &&
                    (group.members === 1 ? t('invite.members_one') : t('invite.members', { n: group.members }))}
                  {group.members != null && group.challenge ? ' · ' : ''}
                  {group.challenge ? t('invite.challenge_facts', { days: CHALLENGE_DAYS }) : ''}
                </p>
                {!name && !user && <p className="mt-2 text-small text-muted">{t('invite.private_note')}</p>}

                <div className="mt-7">
                  {group.is_member ? (
                    <>
                      <p className="text-body font-semibold text-ink" data-hook="invite-member">
                        {t('invite.member')}
                      </p>
                      <Link
                        to={group.group_id ? `/g/${group.group_id}` : '/'}
                        data-hook="invite-open"
                        className="btn-primary press mt-4 text-[1.1875rem] font-bold"
                      >
                        {t('invite.open')}
                      </Link>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={join}
                        disabled={busy}
                        data-hook="invite-join"
                        className="btn-primary press text-[1.1875rem] font-bold"
                      >
                        {busy ? t('invite.joining') : t('invite.join')}
                      </button>
                      {!user && <p className="mt-4 text-small text-muted">{t('invite.note')}</p>}
                      {!user && inApp && (
                        <p className="mt-3 text-small text-ink" data-hook="invite-in-app">
                          {t('invite.in_app')}
                        </p>
                      )}
                    </>
                  )}
                  {error && (
                    <p className="mt-4 text-small font-semibold text-negative" role="alert" data-hook="invite-error">
                      {error}
                    </p>
                  )}
                </div>

                {/* Le bouton d'abord, les objectifs ensuite: dans le navigateur de
                    TikTok, sous sa barre, huit lignes poussaient le bouton hors
                    du premier ecran. */}
                {list.length > 0 && (
                  <div className="mt-9">
                    <p className="text-small font-semibold text-ink">{t('invite.goals_title')}</p>
                    <ul className="mt-3 space-y-2" data-hook="invite-goals">
                      {list.map((g) => (
                        <li key={g} className="flex items-start gap-2.5 text-body text-ink">
                          <span className="mt-[0.3em] flex h-5 w-5 shrink-0 items-center justify-center rounded-pill bg-[#FF007A] text-white">
                            <Tick className="h-3 w-3" strokeWidth={3.4} />
                          </span>
                          <span className="min-w-0">{g}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {group.challenge && (
                  <Link to="/defi" className="mt-6 inline-block text-small text-ink underline underline-offset-4">
                    {t('invite.what')}
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Le scotch et les stickers de la carte, apres elle et pas dedans:
              .lg met `position: relative` a ses enfants directs (voir la page
              de connexion). A partir de sm, la ou la carte existe. */}
          <div aria-hidden="true" className="pointer-events-none hidden sm:block">
            <Tape className="-top-3 left-10" tilt={-7} />
            <Tape className="-top-3 right-12" tilt={6} tone="255 0 122" />
            {/* En bas a droite, la ou la carte n'a pas de texte: en bas a
                gauche, le personnage couvrait 4 px de "C'est quoi, le defi ?"
                a 820, 1180 et 1440 (sonde de recouvrement). L'oiseau tient le
                bord gauche, dans les 32 px de marge avant le texte. */}
            <Spot name={CARD_ART[0]} tilt={10} delay={520} className="absolute -bottom-12 -right-11 w-24" />
            <Spot name={CARD_ART[1]} tilt={-10} delay={640} className="absolute -left-12 top-[30%] w-[4.5rem]" />
          </div>
        </div>
      </main>

      {/* Des amis qui depassent du bas de l'ecran, sur un telephone. */}
      <div
        aria-hidden="true"
        data-hook="peekers"
        className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-center gap-[7%] sm:hidden"
      >
        {PEEK_ART.map((n, i) =>
          stickerSrc(n) ? (
            <img
              key={n}
              src={stickerSrc(n)}
              alt=""
              draggable="false"
              data-sticker={n}
              className="peek w-[24%] max-w-[7rem] drop-shadow-[0_-4px_10px_rgb(0_0_0/0.12)]"
              style={{ '--tilt': `${[-7, 4, 8][i]}deg`, '--sink': `${[34, 26, 36][i]}%` }}
            />
          ) : null,
        )}
      </div>
    </div>
  )
}
