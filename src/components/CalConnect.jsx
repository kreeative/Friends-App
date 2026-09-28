import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'

/**
 * Brancher ses pages de reservation Cal.com sur son calendrier.
 *
 *   "So when people book me on my Kreeative cal booking pages it shows on my
 *    Rich and Friends calendar can you do that?"
 *
 * CE QUE CE PANNEAU FABRIQUE: deux chaines, et rien d'autre. Une URL qui
 * contient un token, et un secret. Elle les colle dans Cal.com une fois, et
 * chaque reservation arrive ensuite toute seule.
 *
 * POURQUOI DEUX ET PAS UNE. Le token dit DE QUI est la reservation: le paiload
 * de Cal ne porte aucun identifiant Rich & Friends, donc sans lui l'API ne
 * saurait sur quel calendrier ecrire. Le secret dit QUE C'EST BIEN CAL: une
 * URL seule traine dans un tableau de bord tiers et dans un presse-papiers, et
 * si elle suffisait a ecrire, n'importe qui pourrait poser des rendez-vous sur
 * le calendrier de quelqu'un.
 *
 * LES DEUX SONT TIRES DANS LE NAVIGATEUR, avec crypto.getRandomValues, et pas
 * avec Math.random. Math.random n'est pas un generateur cryptographique: ses
 * sorties sont predictibles a partir de quelques tirages, et un secret de
 * signature devinable ne signe rien.
 *
 * LE SECRET EST AFFICHE EN CLAIR, ET IL DOIT L'ETRE. Il faut le coller dans
 * Cal, donc il n'est pas hache en base: un hachage rendrait impossible la
 * seule chose qu'on en fait. Il est lisible par sa proprietaire et par
 * personne d'autre, ce que porte la policy `user_id = auth.uid()`.
 *
 * CE QUI S'AFFICHE, ET C'EST TOUT. "The icon to connect to your cal calendar
 * contained so many informations its confusing": le panneau ne dit plus ce
 * qu'est un webhook. Pas branche, c'est un bouton. Branche, c'est les deux
 * chaines a copier, UNE phrase qui dit ou les coller, et l'etat. La ligne
 * de la liste (CalendarHub) porte le nom et la date, ce panneau ne les
 * repete pas.
 */

/** Une chaine imprevisible, en base64url, sans caractere a echapper dans une URL. */
function tirage(octets = 24) {
  const buf = new Uint8Array(octets)
  crypto.getRandomValues(buf)
  return btoa(String.fromCharCode(...buf)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * L'URL a coller dans Cal.
 *
 * `window.location.origin` plutot qu'une constante: l'application tourne sur
 * richandfriends.xyz, sur une preview Vercel et sur localhost, et une URL en
 * dur ferait pointer le webhook d'une preview vers la production. Le token est
 * encode, bien qu'il soit deja en base64url, parce qu'une fonction qui compose
 * une URL et qui fait confiance a son entree est celle qui casse le jour ou
 * l'alphabet change.
 */
export function webhookUrl(token, origin = '') {
  return `${origin || ''}/api/cal-webhook?t=${encodeURIComponent(token ?? '')}`
}

/**
 * `lien` est la ligne cal_link (ou null), chargee par CalendarHub avec le
 * reste; `onChange` remonte ce que brancher et debrancher en font.
 */
export default function CalConnect({ lien, onChange }) {
  const { user } = useAuth()
  const { t } = useT()

  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState('')
  const [copied, setCopied] = useState('')

  async function connect() {
    if (!user?.id || busy) return
    setBusy(true)
    setFailed('')
    const row = { user_id: user.id, token: tirage(24), signing_secret: tirage(32) }
    /* upsert et pas insert: la cle primaire est user_id, donc rebrancher apres
       avoir debranche dans un autre onglet retomberait sinon sur un conflit de
       cle que personne ne saurait lire. */
    const { error } = await supabase.from('cal_link').upsert(row, { onConflict: 'user_id' })
    setBusy(false)
    if (error) return setFailed('connect')
    onChange?.({ token: row.token, signing_secret: row.signing_secret, last_seen_at: null })
  }

  async function disconnect() {
    if (!user?.id || busy) return
    setBusy(true)
    setFailed('')
    /* `count: 'exact'`, parce que RLS refuse un DELETE EN SILENCE: zero ligne,
       aucune erreur. Sans le compte, une suppression refusee repeindrait
       l'ecran comme si elle avait marche et Cal continuerait d'ecrire. */
    const { error, count } = await supabase
      .from('cal_link')
      .delete({ count: 'exact' })
      .eq('user_id', user.id)
    setBusy(false)
    if (error || !count) return setFailed('disconnect')
    onChange?.(null)
  }

  async function copier(quoi, texte) {
    try {
      await navigator.clipboard.writeText(texte)
      setCopied(quoi)
      setTimeout(() => setCopied(''), 2000)
    } catch {
      /* Un navigateur qui refuse le presse-papiers n'est pas une panne: le
         texte est a l'ecran, selectionnable, et c'etait deja le plan B. */
      setFailed('copy')
    }
  }

  const url = webhookUrl(lien?.token, typeof window === 'undefined' ? '' : window.location.origin)

  return (
    <div data-hook="cal-connect" data-on={lien ? 'yes' : 'no'}>
      {!lien && (
        <button
          type="button"
          onClick={connect}
          disabled={busy}
          className="btn-primary press inline-flex disabled:opacity-60"
          data-hook="cal-connect-start"
        >
          {t('cal.connect_start')}
        </button>
      )}

      {lien && (
        <>
          {/* Les deux chaines, chacune avec son bouton. `break-all` parce
              qu'une URL est UN SEUL MOT pour le navigateur: elle n'a nulle part
              ou se couper et deborde de cote plutot que de passer a la ligne. */}
          <p className="text-small font-semibold text-ink">{t('cal.connect_step_url')}</p>
          <code
            className="mt-1 block break-all rounded-inner bg-ink/[0.045] p-3 text-small text-ink"
            data-hook="cal-connect-url"
          >
            {url}
          </code>
          <button
            type="button"
            onClick={() => copier('url', url)}
            className="goal-action press mt-2"
            data-hook="cal-connect-copy-url"
          >
            {copied === 'url' ? t('cal.connect_copied') : t('cal.connect_copy')}
          </button>

          <p className="mt-4 text-small font-semibold text-ink">{t('cal.connect_step_secret')}</p>
          <code
            className="mt-1 block break-all rounded-inner bg-ink/[0.045] p-3 text-small text-ink"
            data-hook="cal-connect-secret"
          >
            {lien.signing_secret}
          </code>
          <button
            type="button"
            onClick={() => copier('secret', lien.signing_secret)}
            className="goal-action press mt-2"
            data-hook="cal-connect-copy-secret"
          >
            {copied === 'secret' ? t('cal.connect_copied') : t('cal.connect_copy')}
          </button>

          {/* UNE phrase, repliee: ou coller les deux, et quoi cocher. */}
          <details className="mt-4" data-hook="cal-connect-how">
            <summary className="cursor-pointer text-small font-semibold text-ink">{t('cal.hub_where_cal')}</summary>
            <p className="reading mt-2 text-small text-muted">{t('cal.connect_steps')}</p>
          </details>

          {/* L'ETAT EST UNE DATE, PAS UN VOYANT. Un point vert des que la ligne
              existe serait vert avant meme que Cal ait ete configure, ce qui
              est exactement le moment ou on a besoin de savoir que ca ne
              marche pas encore. */}
          <p className="mt-4 text-small text-muted" data-hook="cal-connect-state">
            {lien.last_seen_at
              ? t('cal.connect_live', { when: new Date(lien.last_seen_at).toLocaleString() })
              : t('cal.connect_waiting')}
          </p>

          <button
            type="button"
            onClick={disconnect}
            disabled={busy}
            className="goal-action press mt-3 text-negative disabled:opacity-60"
            data-hook="cal-connect-stop"
          >
            {t('cal.connect_stop')}
          </button>
        </>
      )}

      {failed && (
        <p className="mt-4 text-small font-semibold text-negative" role="alert" data-hook="cal-connect-failed">
          {t(`cal.connect_failed_${failed}`)}
        </p>
      )}
    </div>
  )
}
