import { ianaOffset, wallToUtc } from './ics.js'
import { bookingTitle } from './bookings.js'

/**
 * Ecrire le calendrier Rich & Friends en iCalendar, pour Google et Outlook.
 *
 *   "add an option into the app to link google calendar or outlook"
 *
 * L'autre sens du lien: Google Agenda et Outlook savent tous les deux
 * s'abonner a une adresse .ics ("From URL", "Subscribe from web"). Ce fichier
 * fabrique ce qu'ils lisent. Il est servi par /api/ics, qui ne fait que
 * trouver a qui est le token et appeler buildIcs.
 *
 * CE QUI SORT: les evenements du calendrier, les reservations Cal.com, et les
 * echeances d'objectifs. Rien d'autre. Pas les anniversaires des autres,
 * parce que ce sont leurs dates et pas les siennes, et une adresse .ics finit
 * dans un Google qui n'est pas Rich & Friends. Et JAMAIS le cycle: sa policy
 * est `user_id = auth.uid()` sans aucun chemin de sortie, et ce fichier n'en
 * est pas un.
 *
 * L'HEURE. calendar_event porte une date et des minutes murales, sans fuseau,
 * parce qu'un cours de 9h est a 9h. Le fichier les ecrit avec TZID=<le fuseau
 * du profil>, et un VTIMEZONE qui decrit ce fuseau, parce que le RFC l'exige
 * et qu'Outlook le lit. En UTC, un cours hebdomadaire glisserait d'une heure
 * a chaque changement d'heure. Le VTIMEZONE est calcule avec Intl plutot que
 * copie d'une table: Intl connait toutes les zones, la table en connaitrait
 * cinquante.
 */

const DAY = 86400000
const pad = (n) => String(n).padStart(2, '0')

/** \ ; , et les sauts de ligne, echappes comme le RFC le demande. */
export function escapeText(v) {
  return String(v ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

const enc = typeof TextEncoder === 'undefined' ? null : new TextEncoder()
const octets = (s) => (enc ? enc.encode(s).length : Buffer.byteLength(s, 'utf8'))

/**
 * Plier a 75 octets. Sur les OCTETS et pas sur les caracteres: un titre en
 * emoji fait quatre octets par caractere, et un lecteur strict rejette une
 * ligne de 76. La coupe tombe entre deux caracteres, jamais dedans, ce qui
 * est la seule chose qui rende le depliage sans perte.
 */
export function foldLine(line) {
  const out = []
  let cur = ''
  let len = 0
  for (const ch of line) {
    const n = octets(ch)
    const limit = out.length === 0 ? 75 : 74
    if (len + n > limit) {
      out.push(cur)
      cur = ch
      len = n
    } else {
      cur += ch
      len += n
    }
  }
  out.push(cur)
  return out.map((s, i) => (i === 0 ? s : ` ${s}`)).join('\r\n')
}

/** YYYYMMDDTHHMMSS des composants muraux d'un `wall` (voir ics.js). */
export function fmtWall(wall) {
  const d = new Date(wall)
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`
}
export const fmtUtc = (ms) => `${fmtWall(ms)}Z`
export const fmtDate = (wall) => fmtWall(wall).slice(0, 8)

/** -300 -> -0500 */
export function fmtOffset(min) {
  const s = min < 0 ? '-' : '+'
  const a = Math.abs(min)
  return `${s}${pad(Math.floor(a / 60))}${pad(a % 60)}`
}

/**
 * Les changements de decalage d'un fuseau entre deux annees, trouves en
 * regardant le decalage au debut de chaque jour et en cherchant la minute
 * exacte quand il change. Une trentaine d'appels a Intl par transition.
 */
export function transitionsOf(zone, y0, y1) {
  const out = []
  let t = Date.UTC(y0, 0, 1)
  const end = Date.UTC(y1 + 1, 0, 1)
  let prev = ianaOffset(zone, t)
  if (prev == null) return null
  while (t < end) {
    const next = t + DAY
    const off = ianaOffset(zone, next)
    if (off !== prev) {
      let lo = t
      let hi = next
      while (hi - lo > 60000) {
        const mid = lo + Math.floor((hi - lo) / 120000) * 60000
        if (ianaOffset(zone, mid) === prev) lo = mid
        else hi = mid
      }
      out.push({ at: hi, from: prev, to: off })
      prev = off
    }
    t = next
  }
  return out
}

/**
 * Le VTIMEZONE d'un fuseau IANA, ecrit avec des RDATE plutot qu'une RRULE:
 * une liste de dates est vraie par construction, une regle "deuxieme
 * dimanche de mars" serait a deduire et se tromperait sur un fuseau qui a
 * change de regle entre-temps. Couvre l'annee derniere et les deux
 * prochaines, ce qui est la fenetre ou un agenda regarde.
 */
export function vtimezone(zone, year) {
  const trans = transitionsOf(zone, year - 1, year + 2)
  if (trans == null) return []
  const lines = ['BEGIN:VTIMEZONE', `TZID:${zone}`]
  if (trans.length === 0) {
    const off = ianaOffset(zone, Date.UTC(year, 0, 1)) ?? 0
    lines.push('BEGIN:STANDARD', 'DTSTART:19700101T000000',
      `TZOFFSETFROM:${fmtOffset(off)}`, `TZOFFSETTO:${fmtOffset(off)}`, 'END:STANDARD')
  } else {
    const groups = new Map()
    for (const tr of trans) {
      const k = `${tr.from}>${tr.to}`
      if (!groups.has(k)) groups.set(k, { from: tr.from, to: tr.to, walls: [] })
      /* L'heure murale de la transition, dans l'ANCIEN decalage: c'est ainsi
         que le RFC definit le DTSTART d'une observance. */
      groups.get(k).walls.push(tr.at + tr.from * 60000)
    }
    for (const g of groups.values()) {
      const kind = g.to > g.from ? 'DAYLIGHT' : 'STANDARD'
      lines.push(`BEGIN:${kind}`, `DTSTART:${fmtWall(g.walls[0])}`,
        `TZOFFSETFROM:${fmtOffset(g.from)}`, `TZOFFSETTO:${fmtOffset(g.to)}`)
      for (const w of g.walls.slice(1)) lines.push(`RDATE:${fmtWall(w)}`)
      lines.push(`END:${kind}`)
    }
  }
  lines.push('END:VTIMEZONE')
  return lines
}

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
const wallOfDay = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''))
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null
}

/**
 * Un evenement du calendrier, en VEVENT.
 *
 * Une regle hebdomadaire part du PREMIER jour qui tombe sur un des jours
 * coches, pas de starts_on: le RFC dit que DTSTART est toujours la premiere
 * occurrence, meme s'il ne colle pas a la regle, et un cours du lundi qui
 * commencerait un samedi aurait une seance de plus.
 */
export function eventLines(ev, zone, now) {
  const first = wallOfDay(ev.starts_on)
  if (!first || !ev.title) return []
  const allDay = ev.start_min == null
  const days = Array.isArray(ev.weekdays) ? ev.weekdays.filter((d) => d >= 0 && d <= 6) : []
  let startDay = first
  if (days.length) {
    for (let i = 0; i < 7; i += 1) {
      if (days.includes(new Date(startDay).getUTCDay())) break
      startDay += DAY
    }
    /* Une regle dont le premier jour utile est deja apres la fin: rien a
       ecrire, et un lecteur strict refuserait la paire. */
    if (ev.until_on && startDay > wallOfDay(ev.until_on)) return []
  }

  const lines = ['BEGIN:VEVENT', `UID:rf-ev-${ev.id}@richandfriends.xyz`, `DTSTAMP:${fmtUtc(now)}`]
  if (allDay) {
    lines.push(`DTSTART;VALUE=DATE:${fmtDate(startDay)}`, `DTEND;VALUE=DATE:${fmtDate(startDay + DAY)}`)
  } else {
    const startMin = Math.max(0, Math.min(1439, Number(ev.start_min) || 0))
    let endMin = ev.end_min == null ? startMin + 60 : Number(ev.end_min)
    if (!(endMin > startMin)) endMin = startMin + 30
    const s = startDay + startMin * 60000
    const e = startDay + endMin * 60000
    lines.push(`DTSTART;TZID=${zone}:${fmtWall(s)}`, `DTEND;TZID=${zone}:${fmtWall(e)}`)
  }
  if (days.length) {
    const by = [...new Set(days)].sort((a, b) => a - b).map((d) => BYDAY[d]).join(',')
    let rule = `FREQ=WEEKLY;BYDAY=${by}`
    if (ev.until_on) {
      const u = wallOfDay(ev.until_on)
      if (u != null) {
        /* UNTIL doit etre en UTC quand DTSTART porte un fuseau: la fin de la
           journee murale, convertie. En DATE quand l'evenement en est une. */
        rule += allDay ? `;UNTIL=${fmtDate(u)}` : `;UNTIL=${fmtUtc(wallToUtc(u + DAY - 1000, zone))}`
      }
    }
    lines.push(`RRULE:${rule}`)
    const skipped = Array.isArray(ev.excluded_on) ? ev.excluded_on : []
    for (const d of skipped) {
      const w = wallOfDay(d)
      if (w == null) continue
      if (allDay) lines.push(`EXDATE;VALUE=DATE:${fmtDate(w)}`)
      else lines.push(`EXDATE;TZID=${zone}:${fmtWall(w + (Number(ev.start_min) || 0) * 60000)}`)
    }
  }
  lines.push(`SUMMARY:${escapeText(ev.title)}`)
  if (ev.location) lines.push(`LOCATION:${escapeText(ev.location)}`)
  lines.push('END:VEVENT')
  return lines
}

/** Une reservation Cal.com: des instants UTC, et le lien de l'appel. */
export function bookingLines(b, now) {
  if (!b?.id || b.cancelled_at) return []
  const s = Date.parse(b.starts_at)
  const e = Date.parse(b.ends_at)
  if (Number.isNaN(s) || Number.isNaN(e)) return []
  const titre = bookingTitle(b)
  if (!titre) return []
  const href = b.join_url || b.web_url || null
  const lines = ['BEGIN:VEVENT', `UID:rf-bk-${b.id}@richandfriends.xyz`, `DTSTAMP:${fmtUtc(now)}`,
    `DTSTART:${fmtUtc(s)}`, `DTEND:${fmtUtc(Math.max(e, s + 60000))}`, `SUMMARY:${escapeText(titre)}`]
  if (href) lines.push(`URL:${href}`, `DESCRIPTION:${escapeText(href)}`)
  lines.push('END:VEVENT')
  return lines
}

/** Une echeance d'objectif: une journee, le jour du due_on. */
export function goalLines(g, now) {
  const w = wallOfDay(g?.due_on)
  if (!g?.id || w == null || !g.commitment) return []
  return ['BEGIN:VEVENT', `UID:rf-goal-${g.id}@richandfriends.xyz`, `DTSTAMP:${fmtUtc(now)}`,
    `DTSTART;VALUE=DATE:${fmtDate(w)}`, `DTEND;VALUE=DATE:${fmtDate(w + DAY)}`,
    `SUMMARY:${escapeText(g.commitment)}`, 'END:VEVENT']
}

/**
 * Le fichier entier. CRLF entre les lignes, et une a la fin, parce que c'est
 * ce que le RFC ecrit et qu'Outlook est celui des deux qui le verifie.
 */
export function buildIcs({ zone = 'UTC', events = [], bookings = [], goals = [], now = Date.now(), name = 'Rich & Friends' } = {}) {
  const year = new Date(now).getUTCFullYear()
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Rich & Friends//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(name)}`,
    `X-WR-TIMEZONE:${zone}`,
    /* Toutes les heures. Google et Outlook relisent quand ils veulent, mais
       ceux qui lisent cette ligne relisent au moins aussi souvent. */
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
    ...vtimezone(zone, year),
  ]
  for (const ev of events) lines.push(...eventLines(ev, zone, now))
  for (const b of bookings) lines.push(...bookingLines(b, now))
  for (const g of goals) lines.push(...goalLines(g, now))
  lines.push('END:VCALENDAR')
  return `${lines.map(foldLine).join('\r\n')}\r\n`
}
