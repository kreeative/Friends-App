import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { cycleOn } from '../lib/setup'
import { daysBetween, fromKey } from '../lib/cycle'
import { Avatar, Screen, Section, TopBar } from '../components/ui'
import CyclePanel from '../components/CyclePanel'
import WaterToday from '../components/WaterToday'
import { useWaterToday } from '../lib/useWater'

/**
 * Le profil, qui s'ouvre sur comment tu vas et pas sur des champs a remplir.
 *
 *   "So basically when you click on your profile now you will see your
 *    picture, your name etc, but instead of having the other feature where you
 *    can modify your name and etc, you will have to click on the rectangle
 *    where you see your picture and your name and that will open the page. And
 *    then just under this rectangle you will see the my cycle with a little
 *    preview. You will also have the setting for the water. So the first point
 *    of contact with your profile will be your personal well-being, and then
 *    the little setting icon stays on top for also more settings."
 *
 * CE QUE CA RENVERSE. Cette page etait un formulaire: photo, nom, date de
 * naissance, pronoms, genre, preferences. Des choses qu'on change une fois et
 * qu'on ne regarde plus, posees en premier, tous les jours, devant la personne
 * qui vient voir comment elle va.
 *
 * Maintenant l'identite est UN RECTANGLE. Il montre qui tu es, il s'ouvre
 * quand on a quelque chose a y changer, et il prend six lignes au lieu de six
 * ecrans. Tout ce qu'il contenait est intact derriere, sur /me/details.
 *
 * ET LE CYCLE EST ICI, PLUS SUR LE CALENDRIER.
 *
 *   "Since it can be confusing to see my cycle and my regles, remove my cycle
 *    from the calendar and move it to the personal."
 *
 * Deux boutons voisins qui commencent par le meme mot, l'un qui NOTE et
 * l'autre qui MONTRE. "+ Mes regles" reste sur le calendrier, parce que noter
 * une date est un geste de calendrier. "Mon cycle" vient ici, parce que le
 * relire est un geste de bien-etre, et parce que c'est la chose la plus intime
 * de l'application et que sa place est derriere son propre visage.
 */

/**
 * Combien de cycles complets les dates notees permettent de mesurer.
 *
 * Un cycle est un ECART entre deux dates, donc trois dates font deux cycles,
 * et c'est la source d'erreur evidente ici: compter les lignes et les appeler
 * des cycles annonce "3 cycles" a quelqu'un qui n'en a mesure que deux, et la
 * prediction qu'on lui montre est plus sure qu'elle ne l'est.
 */
export function cyclesMeasured(rows) {
  const n = (rows ?? []).length
  return n > 0 ? n - 1 : 0
}

export default function Me() {
  const { user, profile } = useAuth()
  const { t } = useT()
  const navigate = useNavigate()

  const [drawer, setDrawer] = useState(false)
  const [logs, setLogs] = useState(null)

  /* WaterToday ne dessine RIEN quand le rappel est eteint, ce qui est juste
     sur le tableau de bord: un compteur d'eau que personne n'a demande n'a
     rien a y faire. Ici c'est faux, parce que c'est la page ou l'eau a ete
     demandee: quelqu'un qui vient la chercher et ne trouve rien ne conclut
     pas "c'est eteint", il conclut que ca n'existe pas. */
  const { loading: waterLoading, pref: waterPref } = useWaterToday()

  const periodTracking = cycleOn(profile)

  useEffect(() => {
    if (!user?.id || !periodTracking) return undefined
    let alive = true
    ;(async () => {
      /* Pas de filtre user_id: cycle_log_select EST user_id = auth.uid(), et
         le repeter ici ecrirait la meme regle a deux endroits qui peuvent
         diverger. Meme raison que sur le calendrier. */
      const { data, error } = await supabase
        .from('cycle_log')
        .select('id, started_on')
        .order('started_on', { ascending: false })
      if (!alive) return
      setLogs(error ? [] : data ?? [])
    })()
    return () => { alive = false }
  }, [user?.id, periodTracking])

  const mesures = cyclesMeasured(logs)
  const derniere = logs?.[0]?.started_on ?? null
  const depuis = derniere ? daysBetween(fromKey(derniere), new Date()) : null

  return (
    <Screen className="column-page">
      <TopBar
        title={t('nav.you')}
        back={() => navigate(-1)}
        backLabel={t('common.back')}
        right={
          <Link
            to="/settings"
            data-hook="to-settings"
            aria-label={t('account.title')}
            className="press flex h-11 w-11 items-center justify-center rounded-pill
                       border border-hairline bg-[rgb(var(--glass-tint))] text-ink shadow-raised"
          >
            <GearIcon />
          </Link>
        }
      />

      {/**
       * LE RECTANGLE. C'est un lien, pas une carte avec un bouton dedans.
       *
       * Toute la surface est la cible, parce que "clique sur le rectangle" est
       * ce qui a ete demande et parce qu'un lien de 64px de haut qu'on ne peut
       * ouvrir que par un chevron de 20px est un lien qu'on rate au pouce.
       *
       * Le chevron reste, mais comme un SIGNE et pas comme la cible: sans lui,
       * rien ne dit qu'un rectangle s'ouvre, et une surface cliquable qui ne
       * l'annonce pas est une surface que personne ne touche.
       */}
      <Link
        to="/me/details"
        data-hook="identity-card"
        className="press mt-2 flex w-full items-center gap-4 rounded-card border border-hairline
                   bg-[rgb(var(--glass-tint))] p-4 text-left shadow-raised"
      >
        <Avatar profile={profile} size={56} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-h2 font-semibold text-ink" data-hook="identity-name">
            {profile?.display_name ?? t('nav.you')}
          </span>
          <span className="block truncate text-small text-muted" data-hook="identity-email">
            {user?.email}
          </span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-muted">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </span>
      </Link>

      {/**
       * LE CYCLE, JUSTE SOUS LE RECTANGLE.
       *
       * Un APERCU, pas le tiroir entier: la question qu'on se pose en arrivant
       * est "j'en suis ou", et elle tient en une ligne. Le detail s'ouvre.
       *
       * ET L'INDICATEUR QUAND IL N'Y A PAS ASSEZ DE DATES.
       *
       *   "But there will be an indicator if you never registered your last
       *    three cycles, to go into that setting with a shortcut."
       *
       * Trois dates font DEUX cycles mesures, et c'est a peu pres le minimum
       * pour que la moyenne veuille dire quelque chose. En dessous, la carte
       * ne montre pas une prediction a laquelle elle ne croit pas: elle dit ce
       * qui manque et emmene le noter. Un chiffre confiant tire d'une seule
       * date serait la pire des deux reponses.
       */}
      {periodTracking && (
        <Section title={t('cycle.manage')}>
          <div className="lg p-6" data-hook="cycle-card" data-ready={mesures >= 2 ? 'yes' : 'no'}>
            {logs === null ? (
              /* Rien plutot qu'un "chargement": la carte fait quatre lignes,
                 la requete en prend deux cents millisecondes, et un mot qui
                 apparait pour disparaitre est un clignotement. */
              <p className="text-small text-muted">&nbsp;</p>
            ) : mesures >= 2 ? (
              <>
                <p className="text-body text-ink" data-hook="cycle-since">
                  {depuis === 0
                    ? t('cycle.started_today')
                    : t('cycle.since_days', { n: depuis })}
                </p>
                <p className="mt-1 text-small text-muted">
                  {t('cycle.measured_on', { n: mesures })}
                </p>
              </>
            ) : (
              <>
                <p className="text-body text-ink" data-hook="cycle-needs-more">
                  {t('cycle.need_three')}
                </p>
                <p className="reading mt-1 text-small text-muted">{t('cycle.need_three_why')}</p>
              </>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDrawer(true)}
                className="goal-action press"
                data-hook="cycle-open"
              >
                {t('cycle.manage')}
              </button>
              {/* LE RACCOURCI. Il n'apparait que quand il manque des dates,
                  parce qu'un raccourci permanent vers "ajoute des regles" sur
                  la page de quelqu'un qui en a note douze est du bruit. */}
              {mesures < 2 && (
                <Link to="/calendar" className="btn-primary press inline-flex" data-hook="cycle-shortcut">
                  {t('cycle.go_record')}
                </Link>
              )}
            </div>
          </div>
        </Section>
      )}

      {/* L'eau, parce qu'elle a ete demandee ici et qu'elle est du meme ordre
          que le reste de cette page: une chose du corps, pas un reglage de
          compte. Le MEME composant que sur le tableau de bord, pas une copie:
          deux compteurs du meme verre finiraient par etre en desaccord, et
          celui qui a tort serait invisible. */}
      {waterPref?.water_on ? (
        <WaterToday />
      ) : (
        !waterLoading && (
          <Section title={t('remind.water')}>
            <div className="lg p-6" data-hook="water-off">
              <p className="reading text-body text-muted">{t('me.water_off')}</p>
              <Link to="/notifications" className="goal-action press mt-5 inline-flex" data-hook="water-turn-on">
                {t('me.water_turn_on')}
              </Link>
            </div>
          </Section>
        )
      )}

      {periodTracking && drawer && <CyclePanel open onClose={() => setDrawer(false)} />}
    </Screen>
  )
}

/**
 * The settings gear.
 *
 * Drawn rather than imported: this project has one icon file per family and a
 * single-use glyph in a shared file is how that file becomes a sprite sheet.
 * Stroked at 1.9 because the teeth close up into a blob when filled at 20px.
 */
function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}
