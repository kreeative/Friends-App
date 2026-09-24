import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { env } from './_env.js'
import { rawBody } from './_rawbody.js'

/**
 * Cal.com pousse une reservation ici, et elle apparait sur le calendrier.
 *
 *   "So when people book me on my Kreeative cal booking pages it shows on my
 *    Rich and Friends calendar can you do that?"
 *
 * QUI, PUISQUE LE PAILOAD NE LE DIT PAS.
 *
 * Cal ne sait rien de Rich & Friends: son paiload parle de l'organisateur avec
 * un courriel et un identifiant Cal, pas avec un user_id d'ici. Le lien se fait
 * donc par l'URL. Chaque personne branche Cal sur
 *
 *   https://richandfriends.xyz/api/cal-webhook?t=<token>
 *
 * et ce token est la ligne cal_link qui nomme le compte.
 *
 * L'URL SEULE N'AUTORISE RIEN. Un token qui suffirait a ecrire serait une URL
 * qui traine dans un tableau de bord tiers, dans un historique de presse-
 * papiers et dans le journal de qui l'a vue passer, et n'importe qui pourrait
 * poser des rendez-vous sur le calendrier de quelqu'un. Le token dit DE QUI,
 * la signature dit QUE C'EST BIEN CAL, et les deux sont exiges.
 *
 * CE QUI EST GARDE. Le titre, le nom de qui reserve, les heures, les deux
 * liens. Ni le courriel, ni le fuseau, ni les reponses au formulaire, qui
 * arrivent dans le paiload et sont laisses tomber ici, une fois, au seul
 * endroit ou ils passent. Voir l'en-tete de supabase/72_cal_bookings.sql.
 */
export const config = { api: { bodyParser: false } }

const admin = createClient(
  env('supabaseUrl') ?? '',
  env('serviceRole') ?? '',
  { auth: { persistSession: false } },
)

/**
 * Est-ce que ce corps a bien ete signe avec ce secret?
 *
 * Cal signe le corps BRUT en HMAC-SHA256 et met le resultat en hexadecimal
 * dans `x-cal-signature-256`. D'ou rawBody depuis ./_rawbody.js plutot qu'une
 * deuxieme lecture du flux: c'est exactement le probleme que le webhook Stripe
 * a deja paye d'une matinee et d'un achat qui n'a rien livre, et le
 * commentaire qui l'explique vaut d'etre lu une fois pour les deux.
 *
 * timingSafeEqual, et la comparaison des longueurs AVANT, parce que
 * timingSafeEqual leve sur deux tampons de tailles differentes au lieu de
 * rendre false. Une comparaison avec === ici rendrait le bon resultat en
 * fuyant le secret octet par octet sur le temps de reponse.
 */
export function signatureOk(body, header, secret) {
  if (!header || !secret) return false
  const attendu = crypto.createHmac('sha256', secret).update(body).digest('hex')
  const a = Buffer.from(attendu, 'utf8')
  const b = Buffer.from(String(header).trim().toLowerCase(), 'utf8')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

/**
 * La ligne a ecrire, a partir de ce que Cal a envoye.
 *
 * Sortie d'un handler pour etre testable sans reseau: c'est ici que vivent les
 * trois choix qui comptent, et ils sont tous du genre a se tromper en silence.
 *
 *   LE NOM. Cal met l'organisateur ET les invites dans `attendees`, selon la
 *   version et le type de rendez-vous. L'organisateur, c'est elle, et "Kee a
 *   reserve avec Kee" ne dit rien. On prend donc le premier invite dont le
 *   courriel n'est pas celui de l'organisateur.
 *
 *   LE LIEN. `metadata.videoCallUrl` est le lien de l'appel quand Cal en a
 *   fabrique un. `location` porte parfois une URL et parfois le mot
 *   "attendeeInPerson", donc il n'est pris que s'il ressemble a un lien.
 *
 *   L'HEURE. startTime et endTime sont ISO avec fuseau. On ne les reformate
 *   pas: l'instant est ce qui est vrai, et le jour affiche en est deduit a
 *   l'ecran, dans le fuseau de qui regarde.
 */
export function bookingFrom(payload, userId) {
  const p = payload ?? {}
  const organiserMail = String(p.organizer?.email ?? '').trim().toLowerCase()
  const invite = (p.attendees ?? []).find(
    (a) => String(a?.email ?? '').trim().toLowerCase() !== organiserMail,
  )

  const lien = (v) => (/^https?:\/\//i.test(String(v ?? '')) ? String(v) : null)
  const uid = String(p.uid ?? '').trim()
  const titre = String(p.title ?? p.eventTitle ?? '').trim()

  if (!uid || !titre || !p.startTime || !p.endTime) return null

  return {
    user_id: userId,
    source: 'cal',
    uid,
    title: titre.slice(0, 200),
    guest_name: invite?.name ? String(invite.name).trim().slice(0, 120) || null : null,
    starts_at: new Date(p.startTime).toISOString(),
    ends_at: new Date(p.endTime).toISOString(),
    /* Cal n'envoie pas l'URL de la page de reservation, mais elle est
       deterministe a partir de l'uid, et c'est elle qui permet d'ouvrir le
       rendez-vous d'un geste depuis le calendrier. */
    web_url: `https://app.cal.com/booking/${encodeURIComponent(uid)}`,
    join_url: lien(p.metadata?.videoCallUrl) ?? lien(p.location) ?? null,
    cancelled_at: null,
    updated_at: new Date().toISOString(),
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }

  /* Un deploiement pas fini et une requete qui ne vient pas de Cal sont deux
     pannes differentes, reparees a deux endroits. Meme separation que le
     webhook Stripe, pour la meme raison: le journal ne disait ni l'un ni
     l'autre avant qu'elle soit faite la-bas. */
  if (!env('supabaseUrl') || !env('serviceRole')) {
    console.error('cal-webhook: SUPABASE_URL or the service role key is not set')
    return res.status(500).json({ error: 'Not configured' })
  }

  const token = String(req.query?.t ?? '').trim()
  const { body, from } = await rawBody(req)

  /**
   * TOUT CE QUI RATE REND LE MEME 401.
   *
   * Token inconnu, signature fausse, token absent: trois causes, une seule
   * reponse, sans rien dire de laquelle. Repondre 404 sur un token inconnu et
   * 401 sur une signature fausse ferait de cette URL un oracle qui confirme
   * quels tokens existent, un essai a la fois. Le detail va dans le journal
   * Vercel, qu'elle seule lit.
   *
   * Et le secret n'apparait dans aucune branche: ni dans la reponse, ni dans
   * le journal. Un message d'erreur ne porte jamais un identifiant.
   */
  const refus = (raison) => {
    console.error(`cal-webhook refused: ${raison} (body from: ${from}, ${body.length} bytes)`)
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!token) return refus('no token in the URL')

  const { data: lien, error: lienErr } = await admin
    .from('cal_link')
    .select('user_id, signing_secret')
    .eq('token', token)
    .maybeSingle()

  if (lienErr) {
    console.error('cal-webhook: could not read cal_link', lienErr.message)
    return res.status(500).json({ error: 'Lookup failed' })
  }
  if (!lien) return refus('unknown token')
  if (!signatureOk(body, req.headers['x-cal-signature-256'], lien.signing_secret)) {
    return refus('bad signature')
  }

  let event
  try {
    event = JSON.parse(body.toString('utf8'))
  } catch {
    return refus('body is not JSON')
  }

  const type = String(event?.triggerEvent ?? '')
  const p = event?.payload ?? {}
  const uid = String(p.uid ?? '').trim()

  /* La livraison est authentique quoi qu'on en fasse ensuite, donc la date est
     posee ici plutot que dans les branches: "branche et vivant" est vrai des
     qu'une signature tombe juste, meme pour un evenement qu'on ignore. */
  await admin.from('cal_link').update({ last_seen_at: new Date().toISOString() })
    .eq('user_id', lien.user_id)

  try {
    if (type === 'BOOKING_CANCELLED' || type === 'BOOKING_REJECTED') {
      if (!uid) return res.status(200).json({ received: true, skipped: 'no uid' })
      /* Marquee, pas supprimee, et `count` demande parce qu'un UPDATE qui ne
         touche rien ne dit rien de lui-meme. Zero ligne ici veut dire une
         annulation arrivee avant la reservation, ce qui est une vraie
         sequence quand une livraison a ete reessayee dans le desordre. */
      const { count, error } = await admin
        .from('booking')
        .update({ cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { count: 'exact' })
        .eq('user_id', lien.user_id)
        .eq('source', 'cal')
        .eq('uid', uid)
      if (error) {
        console.error('cal-webhook: cancel failed', error.message)
        return res.status(500).json({ error: 'Could not record the cancellation' })
      }
      return res.status(200).json({ received: true, cancelled: count ?? 0 })
    }

    if (type === 'BOOKING_CREATED' || type === 'BOOKING_RESCHEDULED' || type === 'BOOKING_PAID') {
      const row = bookingFrom(p, lien.user_id)
      if (!row) {
        console.error(`cal-webhook: ${type} without uid, title or times`)
        return res.status(200).json({ received: true, skipped: 'incomplete' })
      }
      /* onConflict sur (user_id, source, uid): Cal reessaye une livraison qui
         n'a pas repondu, et un report reutilise l'uid. Les deux doivent
         laisser une ligne et une seule.

         cancelled_at repart a null dans la ligne construite, ce qui est voulu:
         reserver de nouveau le meme creneau apres une annulation doit le faire
         revenir sur le calendrier. */
      const { error } = await admin
        .from('booking')
        .upsert(row, { onConflict: 'user_id,source,uid' })
      if (error) {
        console.error('cal-webhook: upsert failed', error.message)
        return res.status(500).json({ error: 'Could not record the booking' })
      }
      return res.status(200).json({ received: true, uid: row.uid })
    }

    /* BOOKING_REQUESTED, MEETING_ENDED, FORM_SUBMITTED et le reste. 200, parce
       qu'un 4xx ferait reessayer Cal en boucle sur un evenement dont on n'a
       rien a faire, et qu'une file de livraisons en echec finit par masquer
       une vraie panne. */
    return res.status(200).json({ received: true, ignored: type || 'unknown' })
  } catch (err) {
    console.error('cal-webhook: unhandled', err?.message ?? err)
    return res.status(500).json({ error: 'Could not record the booking' })
  }
}
