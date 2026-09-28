import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { localeTag, useT } from '../lib/i18n'
import CalConnect from './CalConnect'
import { FEED_COLS, FeedPanel, SharePanel } from './CalendarLinks'

/**
 * Brancher ses autres calendriers: une liste, un nom par ligne, "Brancher".
 *
 *   "the icon to connect to your cal calendar contained so many informations
 *    its confusing can you fix that and keep the ui explanation simple a
 *    simple connect your other calendar  cal.  connect.  xyz.  connect etc"
 *
 * AVANT: deux sections, cinq paragraphes, trois etapes numerotees, deux
 * modes d'emploi, avant meme d'avoir appuye sur quoi que ce soit. Tout etait
 * vrai et rien n'etait lisible.
 *
 * MAINTENANT: une liste. Cal.com, Google Agenda, Outlook, un autre
 * calendrier, et "Rich & Friends dans ton autre calendrier" pour l'autre
 * sens. Chaque ligne dit son nom et, a droite, "Brancher" (ou "Branche" avec
 * une date quand c'est fait). Toucher la ligne ouvre SON panneau, et
 * seulement le sien: le strict necessaire pour cette connexion-la, et la
 * phrase d'aide repliee derriere "Ou la trouver ?".
 *
 * LES DONNEES SONT CHARGEES ICI, UNE FOIS, et passees aux panneaux: c'est
 * la liste qui doit savoir si Cal.com est branche pour l'ecrire sur sa
 * ligne, avant que le panneau soit ouvert. Les panneaux gardent leurs
 * gestes (brancher, debrancher, ajouter, retirer) et remontent le resultat.
 */
export default function CalendarHub() {
  const { user } = useAuth()
  const { t, locale } = useT()

  const [cal, setCal] = useState(undefined)
  const [feeds, setFeeds] = useState(undefined)
  const [share, setShare] = useState(undefined)
  const [open, setOpen] = useState(null)

  useEffect(() => {
    if (!user?.id) return undefined
    let alive = true
    ;(async () => {
      const [c, f, s] = await Promise.all([
        supabase.from('cal_link').select('token, signing_secret, last_seen_at').maybeSingle(),
        supabase.from('calendar_feed').select(FEED_COLS).order('created_at'),
        supabase.from('ics_share').select('token, last_read_at').maybeSingle(),
      ])
      if (!alive) return
      /* Une table absente, c'est une migration pas encore passee (72 pour
         Cal, 73 pour le reste). "Pas branche" est vrai, et l'erreur arrivera
         au premier geste, avec le nom du fichier a executer. */
      setCal(c.error ? null : (c.data ?? null))
      setFeeds(f.error ? [] : (f.data ?? []))
      setShare(s.error ? null : (s.data ?? null))
    })()
    return () => { alive = false }
  }, [user?.id])

  if (cal === undefined || feeds === undefined || share === undefined) return null

  /* Dans la langue de l'application, pas celle du navigateur: "30 sept."
     sur un ecran en francais, et pas "Sep 30". */
  const quand = (iso) => new Date(iso).toLocaleDateString(localeTag(locale), { day: 'numeric', month: 'short' })
  const desFlux = (provider) => feeds.filter((f) => f.provider === provider)
  /* Ce que la ligne dit sous le nom quand c'est branche. Une date quand on
     en a une, parce qu'un voyant vert serait vert avant que ca marche. */
  const sousFlux = (provider) => {
    const list = desFlux(provider)
    if (!list.length) return null
    const bad = list.find((f) => f.last_error)
    if (bad && list.length === 1) return t('cal.hub_check')
    const n = list.reduce((s, f) => s + Number(f.event_count ?? 0), 0)
    const last = list.map((f) => f.last_sync_at).filter(Boolean).sort().pop()
    return last ? t('cal.hub_on_since', { n, when: quand(last) }) : t('cal.hub_on')
  }

  const rows = [
    {
      id: 'cal',
      name: 'Cal.com',
      on: Boolean(cal),
      sub: cal ? (cal.last_seen_at ? t('cal.hub_on_when', { when: quand(cal.last_seen_at) }) : t('cal.hub_on_waiting')) : null,
      panel: <CalConnect lien={cal} onChange={setCal} />,
    },
    {
      id: 'google',
      name: t('cal.links_provider_google'),
      on: desFlux('google').length > 0,
      sub: sousFlux('google'),
      panel: <FeedPanel provider="google" feeds={feeds} onChange={setFeeds} />,
    },
    {
      id: 'outlook',
      name: t('cal.links_provider_outlook'),
      on: desFlux('outlook').length > 0,
      sub: sousFlux('outlook'),
      panel: <FeedPanel provider="outlook" feeds={feeds} onChange={setFeeds} />,
    },
    {
      id: 'ics',
      name: t('cal.hub_other'),
      on: desFlux('ics').length > 0,
      sub: sousFlux('ics'),
      panel: <FeedPanel provider="ics" feeds={feeds} onChange={setFeeds} />,
    },
    {
      id: 'share',
      name: t('cal.hub_share'),
      on: Boolean(share),
      sub: share ? (share.last_read_at ? t('cal.hub_on_when', { when: quand(share.last_read_at) }) : t('cal.hub_on_waiting')) : null,
      panel: <SharePanel share={share} onChange={setShare} />,
    },
  ]

  return (
    <div className="lg px-5" data-hook="cal-hub">
      <div className="list">
        {rows.map((r) => {
          const ouvert = open === r.id
          return (
            <div key={r.id} data-hook="cal-hub-row" data-id={r.id} data-on={r.on ? 'yes' : 'no'}>
              <button
                type="button"
                onClick={() => setOpen(ouvert ? null : r.id)}
                aria-expanded={ouvert}
                className="press flex w-full items-center gap-4 py-5 text-left"
                data-hook={`cal-hub-open-${r.id}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="text-safe block text-body text-ink">{r.name}</span>
                  {r.sub && <span className="block text-small text-muted">{r.sub}</span>}
                </span>
                {/* "Brancher" en pastille pleine quand ce n'est pas fait, et
                    en gris quand c'est fait: la chose a faire est celle qui
                    ressort. Le mot change avec l'etat, donc la couleur n'est
                    pas seule a le dire (1.4.1). */}
                <span
                  className={`shrink-0 rounded-pill px-3 py-1.5 text-small font-semibold ${
                    r.on ? 'bg-ink/[0.06] text-ink' : 'bg-accent text-white'
                  }`}
                  aria-hidden="true"
                >
                  {ouvert ? t('cal.hub_close') : r.on ? t('cal.hub_manage') : t('cal.hub_connect')}
                </span>
              </button>
              {ouvert && (
                <div className="pb-5" data-hook={`cal-hub-panel-${r.id}`}>
                  {r.panel}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
