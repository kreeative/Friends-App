import { createClient } from '@supabase/supabase-js'
import { env } from './_env.js'
import { buildIcs } from '../src/lib/icsExport.js'

/**
 * Le calendrier Rich & Friends, en iCalendar, pour Google Agenda et Outlook.
 *
 *   "add an option into the app to link google calendar or outlook"
 *
 * Google ("Other calendars, From URL") et Outlook ("Add calendar, Subscribe
 * from web") viennent lire cette adresse tout seuls, toutes les quelques
 * heures. Elle est de la forme
 *
 *   https://richandfriends.xyz/cal/<token>.ics   (reecrit vers /api/ics?t=)
 *
 * et le token est la ligne ics_share qui nomme le compte. C'est une adresse
 * secrete au meme titre que celle de Google: qui la connait lit le calendrier.
 * Elle se revoque en supprimant la ligne, depuis les reglages.
 *
 * TOUT CE QUI RATE REND LE MEME 404. Token absent, token inconnu, token
 * mal forme: une seule reponse, sans dire laquelle. Un 401 sur un token
 * inconnu et un 404 sur un token absent feraient de cette URL un oracle. Le
 * token n'est ecrit nulle part, ni dans la reponse ni dans le journal.
 *
 * CE QUI SORT, ET CE QUI NE SORT PAS: voir l'en-tete de icsExport.js. Jamais
 * le cycle, jamais les anniversaires des autres.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD')
    return res.status(405).end()
  }
  if (!env('supabaseUrl') || !env('serviceRole')) {
    console.error('ics: SUPABASE_URL or the service role key is not set')
    return res.status(500).end('Not configured')
  }

  const refus = (raison) => {
    console.error(`ics refused: ${raison}`)
    res.setHeader('Cache-Control', 'no-store')
    return res.status(404).end('Not found')
  }

  const token = String(req.query?.t ?? '').trim()
  if (!token || token.length < 20 || token.length > 80 || !/^[A-Za-z0-9_-]+$/.test(token)) return refus('no usable token')

  const admin = createClient(env('supabaseUrl'), env('serviceRole'), { auth: { persistSession: false } })
  const { data: share, error: shareErr } = await admin
    .from('ics_share')
    .select('user_id')
    .eq('token', token)
    .maybeSingle()
  if (shareErr) {
    console.error('ics: could not read ics_share', shareErr.message)
    return res.status(500).end('Lookup failed')
  }
  if (!share) return refus('unknown token')

  const uid = share.user_id
  const now = Date.now()
  const since = new Date(now - 90 * 86400000).toISOString().slice(0, 10)

  const [{ data: profile }, { data: events }, { data: bookings }, { data: goals }] = await Promise.all([
    admin.from('profiles').select('timezone').eq('id', uid).maybeSingle(),
    /* Les regles sans fin et tout ce qui finit ou commence dans les 90
       derniers jours. Un cours d'il y a deux ans n'a rien a faire dans un
       Google d'aujourd'hui, et le fichier reste petit. */
    admin.from('calendar_event')
      .select('id, title, location, starts_on, start_min, end_min, weekdays, until_on, excluded_on')
      .eq('user_id', uid)
      .or(`until_on.is.null,until_on.gte.${since}`)
      .order('starts_on')
      .limit(2000),
    admin.from('booking')
      .select('id, title, guest_name, starts_at, ends_at, web_url, join_url, cancelled_at')
      .eq('user_id', uid)
      .is('cancelled_at', null)
      .gte('starts_at', new Date(now - 90 * 86400000).toISOString())
      .order('starts_at')
      .limit(1000),
    admin.from('goals')
      .select('id, commitment, due_on')
      .eq('owner_id', uid)
      .eq('status', 'active')
      .not('due_on', 'is', null)
      .limit(500),
  ])

  /* Un evenement ponctuel d'il y a plus de 90 jours: le filtre ci-dessus le
     garde (until_on nul), donc il est ecarte ici. Une regle hebdomadaire sans
     fin est gardee quelle que soit sa date de debut. */
  const kept = (events ?? []).filter((e) => (Array.isArray(e.weekdays) && e.weekdays.length > 0) || String(e.starts_on) >= since)

  const zone = profile?.timezone || 'UTC'
  const ics = buildIcs({ zone, events: kept, bookings: bookings ?? [], goals: goals ?? [], now })

  /* La date de derniere lecture est ce que l'ecran montre pour dire "c'est
     branche". Une ecriture qui rate ne fait pas rater la lecture. */
  const { error: readErr } = await admin.from('ics_share')
    .update({ last_read_at: new Date(now).toISOString() })
    .eq('user_id', uid)
  if (readErr) console.error('ics: could not stamp last_read_at', readErr.message)

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
  res.setHeader('Content-Disposition', 'inline; filename="rich-and-friends.ics"')
  res.setHeader('Cache-Control', 'private, no-store')
  if (req.method === 'HEAD') return res.status(200).end()
  return res.status(200).send(ics)
}
