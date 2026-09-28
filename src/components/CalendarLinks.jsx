import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { FEED_LIMIT, feedUrlProblem, providerOf, syncFeeds } from '../lib/feeds'

/**
 * Les panneaux Google Agenda, Outlook et "Rich & Friends dans ton autre
 * calendrier", ouverts depuis la liste de CalendarHub.
 *
 *   "add an option into the app to link google calendar or outlook"
 *   "keep the ui explanation simple a simple connect your other calendar
 *    cal.  connect.  xyz.  connect etc"
 *
 * DEUX PANNEAUX, PARCE QUE "LIER" VEUT DIRE DEUX CHOSES.
 *
 *   FeedPanel  VOIR GOOGLE ICI. Elle colle l'adresse secrete iCal de son
 *              calendrier (ou l'adresse ICS publiee de son Outlook). L'API la
 *              relit, et les evenements arrivent sur le calendrier, en lecture
 *              seule, sur leur propre couche. Un panneau par fournisseur, qui
 *              ne montre que SES flux et SA phrase d'aide.
 *
 *   SharePanel VOIR RICH & FRIENDS DANS GOOGLE. Elle cree une adresse a elle
 *              et l'ajoute dans Google ("From URL") ou Outlook ("Subscribe
 *              from web").
 *
 * POURQUOI DES ADRESSES ET PAS UN BOUTON "SE CONNECTER AVEC GOOGLE".
 *
 * L'OAuth de Google demande un ecran de consentement valide par Google, une
 * politique de confidentialite a leur format, un client_secret a garder cote
 * serveur et des jetons a rafraichir. L'adresse secrete fait la meme chose
 * pour un calendrier, sans rien de tout ca, et Outlook a exactement la meme
 * porte. Le prix est qu'il faut aller la chercher dans les reglages de
 * Google, et la phrase repliee derriere "Ou la trouver ?" est la pour ca.
 *
 * L'ADRESSE SECRETE N'EST JAMAIS RELUE. Elle est ecrite une fois a l'ajout et
 * personne ne la redemande: FEED_COLS ne contient pas la colonne `url`. Ce
 * qui s'affiche est le fournisseur et une date.
 */

/** Une chaine imprevisible, en base64url. Meme tirage que CalConnect. */
function tirage(octets = 24) {
  const buf = new Uint8Array(octets)
  crypto.getRandomValues(buf)
  return btoa(String.fromCharCode(...buf)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * L'adresse a coller dans Google ou Outlook. `/cal/<token>.ics` plutot que
 * `/api/calendar?t=`: les deux marchent (vercel.json reecrit l'une vers
 * l'autre), mais certains lecteurs veulent voir `.ics` au bout pour accepter
 * une URL. Sur l'origine courante, pour la raison que webhookUrl donne.
 */
export function shareUrl(token, origin = '') {
  return `${origin || ''}/cal/${encodeURIComponent(token ?? '')}.ics`
}

/** Les colonnes que le navigateur lit. Jamais `url`: c'est elle qui est secrete. */
export const FEED_COLS = 'id, provider, label, last_sync_at, checked_at, last_error, event_count, created_at'

/**
 * Le panneau d'un fournisseur: ses flux, et un champ pour en ajouter un.
 *
 * `provider` est 'google', 'outlook' ou 'ics'. L'adresse collee est
 * classee par son hote (providerOf), pas par le panneau ou elle a ete
 * collee: une adresse Google collee dans le panneau Outlook est un flux
 * Google, et il apparaitra sur la ligne Google. C'est ce qui est vrai.
 */
export function FeedPanel({ provider, feeds, onChange }) {
  const { user } = useAuth()
  const { t } = useT()

  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState('')
  const [failed, setFailed] = useState('')

  const miens = (feeds ?? []).filter((f) => f.provider === provider)

  async function relire(feedId = null, force = false) {
    const rep = await syncFeeds(supabase, { feedId, force })
    const { data } = await supabase.from('calendar_feed').select(FEED_COLS).order('created_at')
    if (data) onChange?.(data)
    return rep
  }

  async function add(e) {
    e.preventDefault()
    if (!user?.id || busy) return
    setFailed('')
    const adresse = url.trim()
    if (feedUrlProblem(adresse)) return setFailed('url')
    if ((feeds?.length ?? 0) >= FEED_LIMIT) return setFailed('limit')
    setBusy('add')
    const row = { user_id: user.id, provider: providerOf(adresse), url: adresse, label: null }
    const { data, error } = await supabase.from('calendar_feed').insert(row).select(FEED_COLS).single()
    if (error) {
      setBusy('')
      /* La meme adresse deux fois, ou la sixieme: la base le dit avec un code,
         l'ecran le dit avec une phrase. */
      if (error.code === '23505') return setFailed('dup')
      if (/feed_limit/.test(error.message ?? '')) return setFailed('limit')
      return setFailed('save')
    }
    onChange?.([...(feeds ?? []), data])
    setUrl('')
    /* Tout de suite, pour qu'elle voie "12 evenements" ou "adresse refusee"
       avant d'avoir quitte l'ecran, plutot qu'un calendrier vide sans
       explication. */
    await relire(data.id, true)
    setBusy('')
  }

  async function remove(id) {
    if (!user?.id || busy) return
    setBusy(`remove:${id}`)
    setFailed('')
    /* `count: 'exact'`, parce que RLS refuse un DELETE EN SILENCE. */
    const { error, count } = await supabase.from('calendar_feed').delete({ count: 'exact' }).eq('id', id)
    setBusy('')
    if (error || !count) return setFailed('remove')
    onChange?.((feeds ?? []).filter((f) => f.id !== id))
  }

  async function syncNow() {
    if (!user?.id || busy) return
    setBusy('sync')
    setFailed('')
    await relire(null, true)
    setBusy('')
  }

  const etat = (f) => {
    if (f.last_error) {
      const cle = `cal.links_err_${f.last_error}`
      const txt = t(cle)
      return txt === cle ? t('cal.links_err_other') : txt
    }
    if (f.last_sync_at) {
      const n = Number(f.event_count ?? 0)
      return t(n === 1 ? 'cal.links_synced_one' : 'cal.links_synced', { n, when: new Date(f.last_sync_at).toLocaleString() })
    }
    return t('cal.links_waiting')
  }

  return (
    <div data-hook="cal-links" data-provider={provider} data-feeds={miens.length}>
      {miens.length > 0 && (
        <ul className="divide-y divide-hairline">
          {miens.map((f) => (
            <li
              key={f.id}
              className="flex items-start gap-3 py-3"
              data-hook="cal-links-feed"
              data-provider={f.provider}
              data-state={f.last_error ? 'error' : f.last_sync_at ? 'ok' : 'waiting'}
            >
              <span
                className={`reading min-w-0 flex-1 text-small ${f.last_error ? 'font-semibold text-negative' : 'text-muted'}`}
                data-hook="cal-links-state"
              >
                {etat(f)}
              </span>
              <button
                type="button"
                onClick={() => remove(f.id)}
                disabled={Boolean(busy)}
                className="goal-action press shrink-0 text-negative disabled:opacity-60"
                data-hook="cal-links-remove"
              >
                {t('cal.links_remove')}
              </button>
            </li>
          ))}
        </ul>
      )}

      {miens.length > 0 && (
        <button
          type="button"
          onClick={syncNow}
          disabled={Boolean(busy)}
          className="goal-action press mt-2 disabled:opacity-60"
          data-hook="cal-links-sync"
        >
          {busy === 'sync' || busy === 'add' ? t('cal.links_syncing') : t('cal.links_sync')}
        </button>
      )}

      {(feeds?.length ?? 0) < FEED_LIMIT && (
        <form onSubmit={add} className={`measure-form ${miens.length ? 'mt-4' : ''}`} data-hook="cal-links-form">
          <label className="block">
            <span className="field-label">{t('cal.hub_paste')}</span>
            {/* type="url" pour le clavier et la validation du navigateur,
                spellCheck a false parce qu'une adresse soulignee de rouge a
                l'air fausse quand elle ne l'est pas. */}
            <input
              type="url"
              inputMode="url"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              className="field mt-1"
              placeholder="https://"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              data-hook="cal-links-add-url"
            />
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="submit"
              disabled={Boolean(busy) || !url.trim()}
              className="btn-primary press inline-flex disabled:opacity-60"
              data-hook="cal-links-add"
            >
              {busy === 'add' ? t('cal.links_adding') : t('cal.hub_connect')}
            </button>
            {/* La phrase d'aide, repliee: on ne la lit qu'une fois. */}
            <details data-hook={`cal-links-how-${provider}`}>
              <summary className="cursor-pointer text-small font-semibold text-ink">{t('cal.hub_where')}</summary>
              <p className="reading mt-2 text-small text-muted">{t(`cal.links_how_${provider}_steps`)}</p>
            </details>
          </div>
        </form>
      )}

      {failed && (
        <p className="mt-4 text-small font-semibold text-negative" role="alert" data-hook="cal-links-failed">
          {t(`cal.links_failed_${failed}`)}
        </p>
      )}
    </div>
  )
}

/**
 * L'autre sens: une adresse a elle, a coller dans Google ou Outlook.
 *
 * `share` est la ligne ics_share (ou null), chargee par CalendarHub.
 */
export function SharePanel({ share, onChange }) {
  const { user } = useAuth()
  const { t } = useT()

  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState('')
  const [copied, setCopied] = useState(false)

  async function startShare() {
    if (!user?.id || busy) return
    setBusy(true)
    setFailed('')
    const row = { user_id: user.id, token: tirage(24) }
    const { error } = await supabase.from('ics_share').upsert(row, { onConflict: 'user_id' })
    setBusy(false)
    if (error) return setFailed('share')
    onChange?.({ token: row.token, last_read_at: null })
  }

  async function stopShare() {
    if (!user?.id || busy) return
    setBusy(true)
    setFailed('')
    const { error, count } = await supabase.from('ics_share').delete({ count: 'exact' }).eq('user_id', user.id)
    setBusy(false)
    if (error || !count) return setFailed('stop')
    onChange?.(null)
  }

  async function copier(texte) {
    try {
      await navigator.clipboard.writeText(texte)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setFailed('copy')
    }
  }

  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const lien = share ? shareUrl(share.token, origin) : ''

  return (
    <div data-hook="cal-share" data-share={share ? 'yes' : 'no'}>
      {!share && (
        <button
          type="button"
          onClick={startShare}
          disabled={busy}
          className="btn-primary press inline-flex disabled:opacity-60"
          data-hook="cal-links-share-start"
        >
          {t('cal.links_share_start')}
        </button>
      )}

      {share && (
        <>
          <code
            className="block break-all rounded-inner bg-ink/[0.045] p-3 text-small text-ink"
            data-hook="cal-links-share-url"
          >
            {lien}
          </code>
          <button
            type="button"
            onClick={() => copier(lien)}
            className="goal-action press mt-2"
            data-hook="cal-links-share-copy"
          >
            {copied ? t('cal.connect_copied') : t('cal.connect_copy')}
          </button>
          <details className="mt-4" data-hook="cal-links-how-share">
            <summary className="cursor-pointer text-small font-semibold text-ink">{t('cal.hub_where_share')}</summary>
            <p className="reading mt-2 text-small text-muted">{t('cal.links_share_steps')}</p>
          </details>
          <p className="mt-4 text-small text-muted" data-hook="cal-links-share-state">
            {share.last_read_at
              ? t('cal.links_share_live', { when: new Date(share.last_read_at).toLocaleString() })
              : t('cal.links_share_waiting')}
          </p>
          <button
            type="button"
            onClick={stopShare}
            disabled={busy}
            className="goal-action press mt-3 text-negative disabled:opacity-60"
            data-hook="cal-links-share-stop"
          >
            {t('cal.links_share_stop')}
          </button>
        </>
      )}

      {failed && (
        <p className="mt-4 text-small font-semibold text-negative" role="alert" data-hook="cal-links-failed">
          {t(`cal.links_failed_${failed}`)}
        </p>
      )}
    </div>
  )
}
