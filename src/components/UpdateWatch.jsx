import { useEffect, useRef, useState } from 'react'
import { useT } from '../lib/i18n'

/**
 * L'application se met a jour toute seule quand on y revient.
 *
 *   "Where is the period thing, I don't see it, did you publish it?" (quatre
 *   fois) puis "Okay now update the website app."
 *
 * A chaque fois le deploiement etait passe depuis longtemps. Ce qui n'avait
 * pas bouge, c'est le TELEPHONE: une application installee sur l'ecran
 * d'accueil est reveillee la ou on l'a laissee, pas rechargee, et elle peut
 * tourner sur le paquet d'il y a trois jours sans rien en dire. Le profil
 * avait deja eu ce probleme (AuthContext relit le profil au retour); le
 * paquet lui-meme l'avait encore.
 *
 * CE QUE CA FAIT
 *
 * Le paquet connait son numero de construction (`__BUILD_ID__`, grave par
 * vite.config.js) et le serveur publie le sien dans `version.json`, jamais mis
 * en cache. Quand on REVIENT sur l'application (visibilitychange ou focus),
 * elle compare les deux. S'ils different, elle se recharge: c'est le moment ou
 * personne n'est au milieu d'un geste, puisqu'on vient d'arriver.
 *
 * CE QUE CA NE FAIT PAS
 *
 *   - Recharger sous les doigts de quelqu'un qui ecrit. Si un champ a le
 *     focus, une pastille "Passer a la nouvelle version" apparait a la place,
 *     et c'est la personne qui decide.
 *   - Recharger au milieu d'une session. La verification periodique (toutes
 *     les 15 minutes, pour l'iPad qui reste ouvert sur un support) ne fait que
 *     poser la pastille. Un rechargement automatique ne part que d'un retour.
 *   - Interroger le serveur deux fois pour un aller-retour: visibilitychange
 *     et focus arrivent souvent ensemble, donc une minute de garde.
 *   - Quoi que ce soit en developpement, ou il n'y a pas de numero.
 *
 * Le numero courant est aussi pose sur <html data-build>, pour qu'un rapport
 * de bug puisse dire sur quelle version il a ete pris.
 */

/* Le numero de la construction qui tourne. `dev` quand rien ne l'a grave. */
export const BUILD = typeof __BUILD_ID__ === 'string' && __BUILD_ID__ ? __BUILD_ID__ : 'dev'

const GUARD_MS = 60000
const PERIOD_MS = 15 * 60000

/** Vrai si quelqu'un est en train d'ecrire: on ne recharge pas sous ses doigts. */
export function typing(doc = document) {
  const el = doc.activeElement
  if (!el) return false
  if (el.isContentEditable) return true
  const tag = el.tagName
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag !== 'INPUT') return false
  const type = (el.getAttribute('type') || 'text').toLowerCase()
  return !['button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'file', 'color'].includes(type)
}

/** Le numero publie par le serveur, ou null si on ne peut pas le lire. */
export async function latestBuild(fetcher = fetch) {
  try {
    const res = await fetcher('/version.json', { cache: 'no-store', headers: { accept: 'application/json' } })
    if (!res.ok) return null
    const json = await res.json()
    return typeof json?.build === 'string' && json.build ? json.build : null
  } catch {
    /* Hors ligne, ou un proxy qui repond du HTML: on reessaiera au prochain
       retour. Ne rien recharger sur un doute. */
    return null
  }
}

export default function UpdateWatch() {
  const { t } = useT()
  const [ready, setReady] = useState(false)
  const lastCheck = useRef(0)

  useEffect(() => {
    if (BUILD === 'dev') return undefined
    document.documentElement.dataset.build = BUILD
    let alive = true

    /* `auto`: vrai au retour sur l'application (on peut recharger), faux sur
       la minuterie (on ne fait que prevenir). */
    const verifier = async (auto) => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastCheck.current < GUARD_MS) return
      lastCheck.current = Date.now()
      const latest = await latestBuild()
      if (!alive || !latest || latest === BUILD) return
      if (!auto || typing()) {
        setReady(true)
        return
      }
      window.location.reload()
    }

    const retour = () => verifier(true)
    const minuterie = () => verifier(false)
    document.addEventListener('visibilitychange', retour)
    window.addEventListener('focus', retour)
    const timer = setInterval(minuterie, PERIOD_MS)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', retour)
      window.removeEventListener('focus', retour)
      clearInterval(timer)
    }
  }, [])

  if (!ready) return null

  return (
    <div
      role="status"
      data-hook="update-ready"
      className="pointer-events-none fixed inset-x-4 bottom-24 z-50 flex justify-center md:bottom-6"
    >
      <button
        type="button"
        onClick={() => window.location.reload()}
        data-hook="update-now"
        className="goal-action-done press pointer-events-auto shadow-float"
      >
        {t('update.now')}
      </button>
    </div>
  )
}
