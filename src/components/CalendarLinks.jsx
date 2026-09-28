import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { FEED_LIMIT, feedUrlProblem, providerOf, syncFeeds } from '../lib/feeds'

/**
 * Brancher Google Agenda ou Outlook, dans les deux sens.
 *
 *   "add an option into the app to link google calendar or outlook"
 *
 * DEUX MOITIES, PARCE QUE "LIER" VEUT DIRE DEUX CHOSES.
 *
 *   1. VOIR GOOGLE ICI. Elle colle l'adresse secrete iCal de son calendrier
 *      Google (ou l'adresse ICS publiee de son Outlook). L'API la relit, et
 *      les evenements arrivent sur le calendrier, en lecture seule, sur leur
 *      propre couche.
 *
 *   2. VOIR RICH & FRIENDS DANS GOOGLE. Elle cree une adresse a elle et
 *      l'ajoute dans Google ("From URL") ou Outlook ("Subscribe from web").
 *
 * POURQUOI DES ADRESSES ET PAS UN BOUTON "SE CONNECTER AVEC GOOGLE".
 *
 * L'OAuth de Google demande un ecran de consentement valide par Google, une
 * politique de confidentialite a leur format, un client_secret a garder cote
 * serveur et des jetons a rafraichir. L'adresse secrete fait la meme chose
 * pour un calendrier, sans rien de tout ca, et Outlook a exactement la meme
 * porte. Le prix est qu'il faut aller la chercher dans les reglages de
 * Google, et le petit mode d'emploi sous le champ est la pour ca.
 *
 * L'ADRESSE SECRETE N'EST JAMAIS RELUE. Elle est ecrite une fois a l'ajout et
 * le composant ne la redemande pas: la liste ne selectionne pas la colonne
 * `url`. Ce qui s'affiche est le fournisseur, l'etiquette, et une date.
 */

/** Une chaine imprevisible, en base64url. Meme tirage que CalConnect. */
function tirage(octets = 24) {
  const buf = new Uint8Array(octets)
  crypto.getRandomValues(buf)
  return btoa(String.fromCharCode(...buf)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * L'adresse a coller dans Google ou Outlook. `/cal/<token>.ics` plutot que
 * `/api/ics?t=`: les deux marchent (vercel.json reecrit l'une vers l'autre),
 * mais certains lecteurs veulent voir `.ics` au bout pour accepter une URL.
 * Sur l'origine courante, pour la raison que webhookUrl donne.
 */
export function shareUrl(token, origin = '') {
  return `${origin || ''}/cal/${encodeURIComponent(token ?? '')}.ics`
}

const FEED_COLS = 'id, provider, label, last_sync_at, checked_at, last_error, event_count, created_at'

export default function CalendarLinks() {
  const { user } = useAuth()
  const { t } = useT()

  const [feeds, setFeeds] = useState(undefined)
  const [share, setShare] = useState(undefined)
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState('')
  const [failed, setFailed] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!user?.id) return undefined
    let alive = true
    ;(async () => {
      const [{ data: f, error: fe }, { data: s, error: se }] = await Promise.all([
        supabase.from('calendar_feed').select(FEED_COLS).order('created_at'),
        supabase.from('ics_share').select('token, last_read_at').maybeSingle(),
      ])
      if (!alive) return
      /* Une table absente, c'est la migration 73 pas encore passee. L'etat
         "rien de branche" est vrai, et l'erreur arrivera au premier ajout,
         avec le nom du fichier a executer. */
      setFeeds(fe ? [] : (f ?? []))
      setShare(se ? null : (s ?? null))
    })()
    return () => { alive = false }
  }, [user?.id])

  async function relire(feedId = null, force = false) {
    const rep = await syncFeeds(supabase, { feedId, force })
    const { data } = await supabase.from('calendar_feed').select(FEED_COLS).order('created_at')
    if (data) setFeeds(data)
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
    const row = { user_id: user.id, provider: providerOf(adresse), url: adresse, label: label.trim().slice(0, 80) || null }
    const { data, error } = await supabase.from('calendar_feed').insert(row).select(FEED_COLS).single()
    if (error) {
      setBusy('')
      /* La meme adresse deux fois, ou la sixieme: la base le dit avec un code,
         l'ecran le dit avec une phrase. */
      if (error.code === '23505') return setFailed('dup')
      if (/feed_limit/.test(error.message ?? '')) return setFailed('limit')
      return setFailed('save')
    }
    setFeeds((prev) => [...(prev ?? []), data])
    setUrl('')
    setLabel('')
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
    setFeeds((prev) => (prev ?? []).filter((f) => f.id !== id))
  }

  async function syncNow() {
    if (!user?.id || busy) return
    setBusy('sync')
    setFailed('')
    await relire(null, true)
    setBusy('')
  }

  async function startShare() {
    if (!user?.id || busy) return
    setBusy('share')
    setFailed('')
    const row = { user_id: user.id, token: tirage(24) }
    const { error } = await supabase.from('ics_share').upsert(row, { onConflict: 'user_id' })
    setBusy('')
    if (error) return setFailed('share')
    setShare({ token: row.token, last_read_at: null })
  }

  async function stopShare() {
    if (!user?.id || busy) return
    setBusy('stop')
    setFailed('')
    const { error, count } = await supabase.from('ics_share').delete({ count: 'exact' }).eq('user_id', user.id)
    setBusy('')
    if (error || !count) return setFailed('stop')
    setShare(null)
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

  if (feeds === undefined || share === undefined) return null

  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const lien = share ? shareUrl(share.token, origin) : ''

  const nom = (f) => f.label || t(`cal.links_provider_${f.provider}`)
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
    <div className="lg p-6" data-hook="cal-links" data-feeds={feeds.length} data-share={share ? 'yes' : 'no'}>
      {/* --- 1. Voir Google et Outlook ici --------------------------------- */}
      <p className="reading text-body text-muted">{t('cal.links_in_what')}</p>

      {feeds.length === 0 ? (
        <p className="mt-4 text-small text-muted" data-hook="cal-links-none">{t('cal.links_none')}</p>
      ) : (
        <ul className="mt-5 divide-y divide-hairline">
          {feeds.map((f) => (
            <li
              key={f.id}
              className="flex items-start gap-3 py-3"
              data-hook="cal-links-feed"
              data-provider={f.provider}
              data-state={f.last_error ? 'error' : f.last_sync_at ? 'ok' : 'waiting'}
            >
              <span className="min-w-0 flex-1">
                <span className="text-safe block text-body font-semibold text-ink">{nom(f)}</span>
                {f.label && (
                  <span className="block text-small text-muted">{t(`cal.links_provider_${f.provider}`)}</span>
                )}
                <span
                  className={`reading block text-small ${f.last_error ? 'font-semibold text-negative' : 'text-muted'}`}
                  data-hook="cal-links-state"
                >
                  {etat(f)}
                </span>
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

      {feeds.length > 0 && (
        <button
          type="button"
          onClick={syncNow}
          disabled={Boolean(busy)}
          className="goal-action press mt-3 disabled:opacity-60"
          data-hook="cal-links-sync"
        >
          {busy === 'sync' || busy === 'add' ? t('cal.links_syncing') : t('cal.links_sync')}
        </button>
      )}

      {feeds.length < FEED_LIMIT && (
        <form onSubmit={add} className="measure-form mt-6 space-y-4" data-hook="cal-links-form">
          <label className="block">
            <span className="field-label">{t('cal.links_url_label')}</span>
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
              placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              data-hook="cal-links-add-url"
            />
          </label>
          <label className="block">
            <span className="field-label">{t('cal.links_name_label')}</span>
            <input
              type="text"
              maxLength={80}
              className="field mt-1"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              data-hook="cal-links-add-label"
            />
          </label>
          <button
            type="submit"
            disabled={Boolean(busy) || !url.trim()}
            className="btn-primary press inline-flex disabled:opacity-60"
            data-hook="cal-links-add"
          >
            {busy === 'add' ? t('cal.links_adding') : t('cal.links_add')}
          </button>
        </form>
      )}

      {/* Le mode d'emploi, replie: c'est la moitie de la page une fois
          deplie, et on ne le lit qu'une fois par calendrier. */}
      <details className="mt-5" data-hook="cal-links-how-google">
        <summary className="cursor-pointer text-small font-semibold text-ink">{t('cal.links_how_google')}</summary>
        <p className="reading mt-2 text-small text-muted">{t('cal.links_how_google_steps')}</p>
      </details>
      <details className="mt-2" data-hook="cal-links-how-outlook">
        <summary className="cursor-pointer text-small font-semibold text-ink">{t('cal.links_how_outlook')}</summary>
        <p className="reading mt-2 text-small text-muted">{t('cal.links_how_outlook_steps')}</p>
      </details>

      {/* --- 2. Voir Rich & Friends dans Google et Outlook ----------------- */}
      <hr className="my-6 border-hairline" />
      <p className="reading text-body text-muted">{t('cal.links_out_what')}</p>

      {!share && (
        <button
          type="button"
          onClick={startShare}
          disabled={Boolean(busy)}
          className="btn-primary press mt-5 inline-flex disabled:opacity-60"
          data-hook="cal-links-share-start"
        >
          {t('cal.links_share_start')}
        </button>
      )}

      {share && (
        <>
          <p className="mt-5 text-small font-semibold text-ink">{t('cal.links_share_url')}</p>
          <code
            className="mt-2 block break-all rounded-inner bg-ink/[0.045] p-3 text-small text-ink"
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
          <p className="reading mt-4 text-small text-muted">{t('cal.links_share_google')}</p>
          <p className="reading mt-1 text-small text-muted">{t('cal.links_share_outlook')}</p>
          <p className="mt-4 text-small text-muted" data-hook="cal-links-share-state">
            {share.last_read_at
              ? t('cal.links_share_live', { when: new Date(share.last_read_at).toLocaleString() })
              : t('cal.links_share_waiting')}
          </p>
          <button
            type="button"
            onClick={stopShare}
            disabled={Boolean(busy)}
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
