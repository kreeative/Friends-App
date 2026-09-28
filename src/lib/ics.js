/**
 * Lire un calendrier iCalendar (RFC 5545), et en sortir des occurrences.
 *
 *   "add an option into the app to link google calendar or outlook"
 *
 * POURQUOI UN FLUX ICS ET PAS L'API DE GOOGLE OU DE MICROSOFT.
 *
 * Les deux offrent une "adresse secrete" qui sert le calendrier entier en
 * iCalendar: Google l'appelle "Secret address in iCal format", Outlook
 * "Publish a calendar, ICS". C'est une URL, sans OAuth, sans ecran de
 * consentement a faire valider par Google, sans jeton a rafraichir, sans
 * client_secret a garder. Et c'est la meme chose des deux cotes, donc un seul
 * lecteur sert aux deux. Le prix: c'est en lecture seule et ca se rafraichit
 * par relecture. Pour "voir mes cours Google sur Rich & Friends", c'est
 * exactement ce qu'il faut.
 *
 * POURQUOI PAS UNE BIBLIOTHEQUE.
 *
 * Ce qu'il faut lire est etroit: VEVENT, ses dates, sa regle de repetition et
 * ses exceptions, les fuseaux. node-ical tire 30 modules et un moment.js, pour
 * tourner dans une fonction Vercel qu'on veut petite et lisible. Ce fichier
 * est du JavaScript sans dependance, il tourne dans node et dans le navigateur,
 * et il est teste ligne a ligne dans ics.test.mjs.
 *
 * CE QUI EST GARDE D'UN EVENEMENT: le titre, le lieu, l'URL, les heures. Ni la
 * description, ni les invites, ni les alarmes. Meme raison que pour Cal.com:
 * une colonne qui n'existe pas ne peut pas se remplir toute seule.
 */

/* ------------------------------------------------------------------------ */
/* Les lignes                                                                */
/* ------------------------------------------------------------------------ */

/**
 * Deplier. Une ligne trop longue est coupee a 75 octets et continuee par une
 * ligne qui commence par un espace ou une tabulation. Le pliage est fait sur
 * les OCTETS, donc une coupe peut tomber au milieu d'un caractere UTF-8; en
 * JavaScript le texte est deja decode, donc recoller les morceaux suffit.
 */
export function unfold(text) {
  return String(text ?? '')
    .replace(/\r\n|\r|\n/g, '\n')
    .replace(/\n[ \t]/g, '')
    .split('\n')
    .filter((l) => l.length > 0)
}

/**
 * Une ligne de propriete: NOM;PARAM=VALEUR;AUTRE="a:b":valeur
 *
 * Le premier ':' hors guillemets separe le nom et ses parametres de la valeur.
 * Hors guillemets, parce qu'un TZID peut etre entre guillemets et qu'une
 * valeur de parametre entre guillemets peut contenir ':' (une URL, par
 * exemple), et couper au premier ':' venu casserait la moitie des fichiers
 * Outlook.
 */
export function parseLine(line) {
  let inQuotes = false
  let cut = -1
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"') inQuotes = !inQuotes
    else if (ch === ':' && !inQuotes) { cut = i; break }
  }
  if (cut < 0) return null
  const head = line.slice(0, cut)
  const value = line.slice(cut + 1)

  const parts = []
  let cur = ''
  inQuotes = false
  for (const ch of head) {
    if (ch === '"') inQuotes = !inQuotes
    if (ch === ';' && !inQuotes) { parts.push(cur); cur = '' } else cur += ch
  }
  parts.push(cur)

  const name = parts[0].trim().toUpperCase()
  if (!name) return null
  const params = {}
  for (const p of parts.slice(1)) {
    const eq = p.indexOf('=')
    if (eq < 0) continue
    const k = p.slice(0, eq).trim().toUpperCase()
    const v = p.slice(eq + 1).replace(/^"|"$/g, '')
    params[k] = v
  }
  return { name, params, value }
}

/** Le texte tel qu'ecrit: \n, \, \; et \\ sont des sequences d'echappement. */
export function unescapeText(v) {
  return String(v ?? '')
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}

/**
 * L'arbre des composants. BEGIN ouvre, END ferme, tout le reste est une
 * propriete du composant courant. Les VALARM sont lus et gardes en enfant,
 * et personne ne les regarde ensuite, ce qui est plus simple que de les
 * sauter en cours de route.
 */
export function parseComponents(text) {
  const root = { name: 'ROOT', props: [], children: [] }
  const stack = [root]
  for (const raw of unfold(text)) {
    const p = parseLine(raw)
    if (!p) continue
    if (p.name === 'BEGIN') {
      const node = { name: p.value.trim().toUpperCase(), props: [], children: [] }
      stack[stack.length - 1].children.push(node)
      stack.push(node)
    } else if (p.name === 'END') {
      if (stack.length > 1) stack.pop()
    } else {
      stack[stack.length - 1].props.push(p)
    }
  }
  return root
}

const prop = (node, name) => node.props.find((p) => p.name === name)
const props = (node, name) => node.props.filter((p) => p.name === name)
const find = (node, name) => node.children.filter((c) => c.name === name)
const deep = (node, name, out = []) => {
  for (const c of node.children) {
    if (c.name === name) out.push(c)
    deep(c, name, out)
  }
  return out
}

/* ------------------------------------------------------------------------ */
/* Les dates                                                                 */
/* ------------------------------------------------------------------------ */

/**
 * Une valeur de date, sans encore de fuseau applique.
 *
 *   20261002            une date, toute la journee
 *   20261002T140000     une heure murale, dans le fuseau du parametre TZID,
 *                       ou flottante s'il n'y en a pas
 *   20261002T180000Z    un instant UTC
 *
 * `wall` est un nombre de millisecondes construit avec Date.UTC sur les
 * composants MURAUX: ce n'est pas un instant, c'est une facon commode de
 * faire de l'arithmetique de calendrier (ajouter des jours, des semaines) sur
 * une heure du mur sans que le fuseau de la machine s'en mele.
 */
export function parseDateValue(value, params = {}) {
  const v = String(value ?? '').trim()
  let m = /^(\d{4})(\d{2})(\d{2})$/.exec(v)
  if (m || String(params.VALUE ?? '').toUpperCase() === 'DATE') {
    m = m ?? /^(\d{4})(\d{2})(\d{2})/.exec(v)
    if (!m) return null
    return {
      allDay: true,
      wall: Date.UTC(+m[1], +m[2] - 1, +m[3]),
      tzid: null,
      utc: false,
    }
  }
  m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(v)
  if (!m) return null
  return {
    allDay: false,
    wall: Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0)),
    tzid: m[7] ? null : (params.TZID ?? null),
    utc: Boolean(m[7]),
  }
}

/** PT1H30M, P1D, P2W, -PT15M: en millisecondes. Null si ce n'en est pas une. */
export function parseDuration(value) {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(String(value ?? '').trim())
  if (!m) return null
  const sign = m[1] === '-' ? -1 : 1
  const ms = ((+(m[2] ?? 0) * 7 + +(m[3] ?? 0)) * 86400 + +(m[4] ?? 0) * 3600 + +(m[5] ?? 0) * 60 + +(m[6] ?? 0)) * 1000
  return sign * ms
}

/* ------------------------------------------------------------------------ */
/* Les fuseaux                                                               */
/* ------------------------------------------------------------------------ */

/**
 * Les noms Windows qu'Outlook met dans TZID, vers les noms IANA qu'Intl
 * connait. La liste n'est pas complete, et n'a pas a l'etre: un fichier
 * Outlook porte AUSSI un VTIMEZONE qui decrit le fuseau par ses regles, et
 * c'est le plan B juste dessous. Ceux-ci sont la parce qu'Intl connait
 * l'histoire complete d'un fuseau IANA, regles passees comprises, alors qu'un
 * VTIMEZONE n'en decrit que l'etat courant.
 */
const WINDOWS_ZONES = {
  'Eastern Standard Time': 'America/New_York',
  'US Eastern Standard Time': 'America/Indianapolis',
  'Central Standard Time': 'America/Chicago',
  'Mountain Standard Time': 'America/Denver',
  'US Mountain Standard Time': 'America/Phoenix',
  'Pacific Standard Time': 'America/Los_Angeles',
  'Atlantic Standard Time': 'America/Halifax',
  'Newfoundland Standard Time': 'America/St_Johns',
  'Alaskan Standard Time': 'America/Anchorage',
  'Hawaiian Standard Time': 'Pacific/Honolulu',
  'Canada Central Standard Time': 'America/Regina',
  'Central America Standard Time': 'America/Guatemala',
  'Haiti Standard Time': 'America/Port-au-Prince',
  'SA Pacific Standard Time': 'America/Bogota',
  'SA Western Standard Time': 'America/La_Paz',
  'SA Eastern Standard Time': 'America/Cayenne',
  'Argentina Standard Time': 'America/Buenos_Aires',
  'E. South America Standard Time': 'America/Sao_Paulo',
  'GMT Standard Time': 'Europe/London',
  'Greenwich Standard Time': 'Atlantic/Reykjavik',
  'Romance Standard Time': 'Europe/Paris',
  'W. Europe Standard Time': 'Europe/Berlin',
  'Central Europe Standard Time': 'Europe/Budapest',
  'Central European Standard Time': 'Europe/Warsaw',
  'E. Europe Standard Time': 'Europe/Chisinau',
  'FLE Standard Time': 'Europe/Kiev',
  'GTB Standard Time': 'Europe/Bucharest',
  'Russian Standard Time': 'Europe/Moscow',
  'Turkey Standard Time': 'Europe/Istanbul',
  'Israel Standard Time': 'Asia/Jerusalem',
  'Arabian Standard Time': 'Asia/Dubai',
  'Arab Standard Time': 'Asia/Riyadh',
  'India Standard Time': 'Asia/Kolkata',
  'China Standard Time': 'Asia/Shanghai',
  'Singapore Standard Time': 'Asia/Singapore',
  'Tokyo Standard Time': 'Asia/Tokyo',
  'Korea Standard Time': 'Asia/Seoul',
  'AUS Eastern Standard Time': 'Australia/Sydney',
  'New Zealand Standard Time': 'Pacific/Auckland',
  'W. Central Africa Standard Time': 'Africa/Lagos',
  'South Africa Standard Time': 'Africa/Johannesburg',
  'Morocco Standard Time': 'Africa/Casablanca',
  'E. Africa Standard Time': 'Africa/Nairobi',
  'Egypt Standard Time': 'Africa/Cairo',
  UTC: 'UTC',
  'Coordinated Universal Time': 'UTC',
}

const fmtCache = new Map()
function formatter(zone) {
  let f = fmtCache.get(zone)
  if (f === undefined) {
    try {
      f = new Intl.DateTimeFormat('en-US', {
        timeZone: zone, hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      })
    } catch {
      f = null
    }
    fmtCache.set(zone, f)
  }
  return f
}

/** Le decalage d'un fuseau IANA a un instant, en minutes a l'est d'UTC. */
export function ianaOffset(zone, utcMs) {
  const f = formatter(zone)
  if (!f) return null
  const parts = {}
  for (const p of f.formatToParts(new Date(utcMs))) parts[p.type] = p.value
  const wall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second)
  return Math.round((wall - utcMs) / 60000)
}

/** Le nom IANA sous lequel Intl connait ce TZID, ou null. */
export function ianaName(tzid) {
  if (!tzid) return null
  const raw = String(tzid).replace(/^\//, '')
  if (formatter(raw)) return raw
  const win = WINDOWS_ZONES[raw]
  if (win && formatter(win)) return win
  /* Google ecrit parfois "(UTC-05:00) Eastern Time" dans X-WR-TIMEZONE; on
     ne s'en sert pas, mais un TZID de cette forme ne doit pas faire planter
     la lecture. */
  return null
}

/**
 * Les observances d'un VTIMEZONE: STANDARD et DAYLIGHT, chacune avec l'heure
 * murale a laquelle elle commence, les deux decalages, et sa regle annuelle.
 *
 * On ne garde que ce qu'Outlook et Google ecrivent vraiment: une regle
 * YEARLY avec BYMONTH et BYDAY (le deuxieme dimanche de mars), ou pas de
 * regle du tout pour un fuseau sans heure d'ete.
 */
export function parseVTimezone(node) {
  const id = prop(node, 'TZID')?.value?.trim()
  if (!id) return null
  const rules = []
  for (const kind of ['STANDARD', 'DAYLIGHT']) {
    for (const obs of find(node, kind)) {
      const from = parseOffset(prop(obs, 'TZOFFSETFROM')?.value)
      const to = parseOffset(prop(obs, 'TZOFFSETTO')?.value)
      const start = parseDateValue(prop(obs, 'DTSTART')?.value ?? '')
      if (from == null || to == null || !start) continue
      const rr = parseRRule(prop(obs, 'RRULE')?.value)
      rules.push({ kind, from, to, startWall: start.wall, rrule: rr })
    }
  }
  return rules.length ? { id, rules } : null
}

/** -0500 -> -300, +0530 -> 330. */
export function parseOffset(v) {
  const m = /^([+-])(\d{2})(\d{2})(\d{2})?$/.exec(String(v ?? '').trim())
  if (!m) return null
  const min = +m[2] * 60 + +m[3]
  return m[1] === '-' ? -min : min
}

/**
 * L'heure murale a laquelle une observance commence, une annee donnee.
 * Null si la regle est d'une forme qu'on ne lit pas, ou si l'annee est avant
 * le debut de la regle.
 */
function observanceWall(rule, year) {
  const first = new Date(rule.startWall)
  if (year < first.getUTCFullYear()) return null
  if (!rule.rrule) return year === first.getUTCFullYear() ? rule.startWall : null
  const r = rule.rrule
  if (r.FREQ !== 'YEARLY') return null
  const month = (r.BYMONTH?.[0] ?? first.getUTCMonth() + 1) - 1
  const hh = first.getUTCHours(); const mm = first.getUTCMinutes()
  if (r.BYDAY?.length) {
    const { n, day } = r.BYDAY[0]
    const d = nthWeekday(year, month, day, n || 1)
    if (!d) return null
    return Date.UTC(year, month, d, hh, mm)
  }
  if (r.BYMONTHDAY?.length) return Date.UTC(year, month, r.BYMONTHDAY[0], hh, mm)
  return Date.UTC(year, month, first.getUTCDate(), hh, mm)
}

/** Le decalage en vigueur a une heure murale, d'apres un VTIMEZONE. */
export function vtzOffset(tz, wall) {
  const year = new Date(wall).getUTCFullYear()
  const single = tz.rules.length === 1 ? tz.rules[0] : null
  if (single && !single.rrule) return single.to
  /* Les transitions de l'annee et de la precedente, dans l'ordre. La
     derniere qui precede l'heure demandee est celle qui vaut. */
  const trans = []
  for (const y of [year - 1, year]) {
    for (const rule of tz.rules) {
      const at = observanceWall(rule, y)
      if (at != null) trans.push({ at, to: rule.to, from: rule.from })
    }
  }
  trans.sort((a, b) => a.at - b.at)
  let off = null
  for (const t of trans) {
    if (t.at <= wall) off = t.to
    else if (off == null) off = t.from
  }
  return off ?? tz.rules[0]?.to ?? 0
}

/**
 * De l'heure murale a l'instant.
 *
 * `zones` est la table des VTIMEZONE du fichier, par TZID. L'ordre: un nom
 * qu'Intl connait (IANA, ou Windows traduit) d'abord, parce qu'Intl porte
 * l'histoire complete; le VTIMEZONE du fichier ensuite; UTC en dernier
 * recours plutot que rien, parce qu'un evenement a la mauvaise heure se
 * corrige et qu'un evenement disparu ne se voit pas.
 *
 * `fallbackZone` est le fuseau de qui lit, pour les heures flottantes: une
 * heure sans fuseau veut dire "9h la ou tu es".
 */
export function toInstant(dv, zones, fallbackZone) {
  if (!dv) return null
  if (dv.allDay || dv.utc) return dv.wall
  const zone = dv.tzid ?? fallbackZone ?? 'UTC'
  const iana = ianaName(zone)
  if (iana) return wallToUtc(dv.wall, iana)
  const vtz = zones?.get?.(String(zone).replace(/^\//, ''))
  if (vtz) return dv.wall - vtzOffset(vtz, dv.wall) * 60000
  const fb = ianaName(fallbackZone)
  if (fb) return wallToUtc(dv.wall, fb)
  return dv.wall
}

/** L'inverse: d'un instant a l'heure murale d'un fuseau (IANA, Windows ou VTIMEZONE). */
export function utcToWall(utcMs, zone, zones) {
  const iana = ianaName(zone)
  if (iana) return utcMs + (ianaOffset(iana, utcMs) ?? 0) * 60000
  const vtz = zones?.get?.(String(zone ?? '').replace(/^\//, ''))
  if (vtz) return utcMs + vtzOffset(vtz, utcMs) * 60000
  return utcMs
}

/**
 * L'heure murale d'un fuseau IANA, en instant. Deux passes: on devine avec le
 * decalage au moment "mur lu comme UTC", puis on recalcule avec le decalage
 * a l'instant devine. C'est ce qui rend juste les heures de part et d'autre
 * d'un changement d'heure, sauf dans l'heure qui n'existe pas, ou n'importe
 * quelle reponse est une convention.
 */
export function wallToUtc(wall, zone) {
  const o1 = ianaOffset(zone, wall)
  if (o1 == null) return wall
  const guess = wall - o1 * 60000
  const o2 = ianaOffset(zone, guess)
  return o2 === o1 ? guess : wall - o2 * 60000
}

/* ------------------------------------------------------------------------ */
/* Les regles de repetition                                                  */
/* ------------------------------------------------------------------------ */

const DAYS = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 }

/** FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261220T045959Z -> un objet. */
export function parseRRule(value) {
  if (!value) return null
  const out = {}
  for (const part of String(value).split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    const k = part.slice(0, eq).trim().toUpperCase()
    const v = part.slice(eq + 1).trim()
    if (k === 'FREQ') out.FREQ = v.toUpperCase()
    else if (k === 'INTERVAL') out.INTERVAL = Math.max(1, parseInt(v, 10) || 1)
    else if (k === 'COUNT') out.COUNT = Math.max(0, parseInt(v, 10) || 0)
    else if (k === 'UNTIL') out.UNTIL = parseDateValue(v)
    else if (k === 'BYDAY') {
      out.BYDAY = v.split(',').map((s) => {
        const m = /^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/i.exec(s.trim())
        return m ? { n: m[1] ? parseInt(m[1], 10) : 0, day: DAYS[m[2].toUpperCase()] } : null
      }).filter(Boolean)
    } else if (k === 'BYMONTHDAY') out.BYMONTHDAY = v.split(',').map((s) => parseInt(s, 10)).filter((n) => !Number.isNaN(n))
    else if (k === 'BYMONTH') out.BYMONTH = v.split(',').map((s) => parseInt(s, 10)).filter((n) => n >= 1 && n <= 12)
    else if (k === 'WKST') out.WKST = DAYS[v.toUpperCase()] ?? 1
  }
  return out.FREQ ? out : null
}

/** Le jour du mois du n-ieme `weekday` (n<0 compte depuis la fin). Null s'il n'existe pas. */
export function nthWeekday(year, month, weekday, n) {
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  if (n > 0) {
    const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay()
    const d = 1 + ((weekday - firstDow + 7) % 7) + (n - 1) * 7
    return d <= last ? d : null
  }
  const lastDow = new Date(Date.UTC(year, month, last)).getUTCDay()
  const d = last - ((lastDow - weekday + 7) % 7) + (n + 1) * 7
  return d >= 1 ? d : null
}

const DAY = 86400000
const addWallDays = (wall, n) => wall + n * DAY

/**
 * Toutes les heures murales de depart d'une regle, dans la fenetre.
 *
 * L'iteration se fait sur l'HEURE MURALE et pas sur l'instant: un cours de
 * 9h le lundi reste a 9h apres le changement d'heure. Chaque heure murale est
 * convertie en instant ensuite, une par une, par toInstant.
 *
 * Les bornes: `wallFrom` et `wallTo` sont des heures murales elles aussi,
 * legerement elargies par l'appelant pour couvrir le decalage. COUNT oblige a
 * compter depuis le debut meme quand le debut est avant la fenetre; la boucle
 * est bornee en nombre de pas pour qu'un fichier malveillant ("toutes les
 * minutes depuis 1970") coute un plafond et pas une fonction qui expire.
 */
export function expandRRule(startWall, rule, wallFrom, wallTo, cap = 2000) {
  if (!rule) return [startWall]
  const out = []
  const interval = rule.INTERVAL ?? 1
  const untilWall = rule.UNTIL ? rule.UNTIL.wall + (rule.UNTIL.allDay ? DAY - 1 : 0) : null
  const stop = untilWall != null && untilWall < wallTo ? untilWall : wallTo
  let count = 0
  let steps = 0
  const MAX_STEPS = 100000
  const take = (wall) => {
    if (wall < startWall) return true
    if (wall > stop) return false
    count += 1
    if (rule.COUNT && count > rule.COUNT) return false
    if (wall >= wallFrom) out.push(wall)
    return out.length < cap
  }

  const s = new Date(startWall)
  const hh = s.getUTCHours(); const mm = s.getUTCMinutes(); const ss = s.getUTCSeconds()

  if (rule.FREQ === 'DAILY') {
    for (let wall = startWall; steps < MAX_STEPS; wall = addWallDays(wall, interval), steps += 1) {
      if (!take(wall)) break
    }
    return out
  }

  if (rule.FREQ === 'WEEKLY') {
    const days = rule.BYDAY?.length ? [...new Set(rule.BYDAY.map((b) => b.day))] : [s.getUTCDay()]
    const wkst = rule.WKST ?? 1
    /* Le debut de la semaine du DTSTART, puis chaque semaine a INTERVAL. Dans
       chaque semaine, les jours demandes, dans l'ordre, a partir de wkst. */
    const back = (s.getUTCDay() - wkst + 7) % 7
    const weekStart = addWallDays(startWall, -back)
    for (let w = weekStart; steps < MAX_STEPS; w = addWallDays(w, 7 * interval), steps += 1) {
      let go = true
      for (let i = 0; i < 7 && go; i += 1) {
        const wall = addWallDays(w, i)
        const dow = (wkst + i) % 7
        if (!days.includes(dow)) continue
        go = take(wall)
      }
      if (!go) break
      if (w > stop) break
    }
    return out
  }

  if (rule.FREQ === 'MONTHLY') {
    const y0 = s.getUTCFullYear(); const m0 = s.getUTCMonth()
    for (let k = 0; steps < MAX_STEPS; k += interval, steps += 1) {
      const y = y0 + Math.floor((m0 + k) / 12)
      const m = (m0 + k) % 12
      const monthStart = Date.UTC(y, m, 1)
      if (monthStart > stop) break
      let dates = []
      if (rule.BYDAY?.length) {
        for (const b of rule.BYDAY) {
          if (b.n) { const d = nthWeekday(y, m, b.day, b.n); if (d) dates.push(d) } else {
            for (let n = 1; n <= 5; n += 1) { const d = nthWeekday(y, m, b.day, n); if (d) dates.push(d) }
          }
        }
      } else if (rule.BYMONTHDAY?.length) {
        const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
        dates = rule.BYMONTHDAY.map((d) => (d < 0 ? last + d + 1 : d)).filter((d) => d >= 1 && d <= last)
      } else {
        const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
        if (s.getUTCDate() <= last) dates = [s.getUTCDate()]
      }
      dates = [...new Set(dates)].sort((a, b) => a - b)
      let go = true
      for (const d of dates) {
        go = take(Date.UTC(y, m, d, hh, mm, ss))
        if (!go) break
      }
      if (!go) break
    }
    return out
  }

  if (rule.FREQ === 'YEARLY') {
    const y0 = s.getUTCFullYear()
    for (let y = y0; steps < MAX_STEPS; y += interval, steps += 1) {
      if (Date.UTC(y, 0, 1) > stop) break
      const months = rule.BYMONTH?.length ? rule.BYMONTH.map((n) => n - 1) : [s.getUTCMonth()]
      let go = true
      for (const m of months) {
        let dates = []
        if (rule.BYDAY?.length && rule.BYDAY[0].n) {
          const d = nthWeekday(y, m, rule.BYDAY[0].day, rule.BYDAY[0].n)
          if (d) dates = [d]
        } else if (rule.BYMONTHDAY?.length) {
          dates = rule.BYMONTHDAY.filter((d) => d >= 1 && d <= 31)
        } else dates = [s.getUTCDate()]
        const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
        for (const d of dates) {
          if (d > last) continue
          go = take(Date.UTC(y, m, d, hh, mm, ss))
          if (!go) break
        }
        if (!go) break
      }
      if (!go) break
    }
    return out
  }

  /* SECONDLY, MINUTELY, HOURLY: personne ne met ca dans un agenda, et les
     lire serait le plafond de pas atteint a chaque fois. Le premier seul. */
  return startWall >= wallFrom && startWall <= wallTo ? [startWall] : []
}

/* ------------------------------------------------------------------------ */
/* Les evenements                                                            */
/* ------------------------------------------------------------------------ */

/**
 * Un VEVENT, lu mais pas encore deplie.
 */
export function readEvent(node) {
  const uid = prop(node, 'UID')?.value?.trim() || null
  const start = prop(node, 'DTSTART')
  const dtstart = start ? parseDateValue(start.value, start.params) : null
  if (!uid || !dtstart) return null
  const end = prop(node, 'DTEND')
  const dtend = end ? parseDateValue(end.value, end.params) : null
  const duration = parseDuration(prop(node, 'DURATION')?.value)
  const recId = prop(node, 'RECURRENCE-ID')
  const status = String(prop(node, 'STATUS')?.value ?? '').trim().toUpperCase()

  const exdates = []
  for (const p of props(node, 'EXDATE')) {
    for (const v of p.value.split(',')) {
      const dv = parseDateValue(v, p.params)
      if (dv) exdates.push(dv)
    }
  }
  const rdates = []
  for (const p of props(node, 'RDATE')) {
    if (String(p.params.VALUE ?? '').toUpperCase() === 'PERIOD') continue
    for (const v of p.value.split(',')) {
      const dv = parseDateValue(v, p.params)
      if (dv) rdates.push(dv)
    }
  }

  return {
    uid,
    summary: unescapeText(prop(node, 'SUMMARY')?.value ?? '').trim(),
    location: unescapeText(prop(node, 'LOCATION')?.value ?? '').trim() || null,
    url: urlOf(prop(node, 'URL')?.value),
    dtstart,
    dtend,
    duration,
    rrule: parseRRule(prop(node, 'RRULE')?.value),
    exdates,
    rdates,
    recurrenceId: recId ? parseDateValue(recId.value, recId.params) : null,
    cancelled: status === 'CANCELLED',
  }
}

const urlOf = (v) => (/^https?:\/\/\S+$/i.test(String(v ?? '').trim()) ? String(v).trim().slice(0, 500) : null)

const pad = (n) => String(n).padStart(2, '0')
/** 'YYYY-MM-DD' des composants muraux. */
export function wallDate(wall) {
  const d = new Date(wall)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/**
 * Toutes les occurrences de tous les evenements d'un fichier, entre deux
 * instants.
 *
 * Chaque occurrence rendue:
 *   uid        l'UID du VEVENT
 *   key        uid + l'heure murale de depart, ce qui identifie UNE occurrence
 *   title      le titre, ou "(sans titre)" est laisse a l'appelant
 *   location, url
 *   allDay     vrai pour une date sans heure
 *   startsAt   ISO UTC de l'instant de debut (pour une journee entiere:
 *              minuit UTC de la date, ce qui sert au tri et a rien d'autre)
 *   endsAt     ISO UTC de la fin
 *   startsOn   'YYYY-MM-DD' pour une journee entiere, sinon null
 *   endsOn     la date de fin EXCLUSIVE d'une journee entiere, sinon null
 *
 * Les exceptions: une occurrence dont l'heure murale est dans EXDATE saute;
 * un VEVENT avec RECURRENCE-ID remplace l'occurrence de son maitre a cette
 * heure-la (et la supprime s'il est annule); un maitre annule ne rend rien.
 */
export function expandCalendar(text, from, to, { fallbackZone = 'UTC', cap = 3000 } = {}) {
  const root = parseComponents(text)
  const zones = new Map()
  for (const vt of deep(root, 'VTIMEZONE')) {
    const tz = parseVTimezone(vt)
    if (tz) zones.set(tz.id, tz)
  }

  const fromMs = from instanceof Date ? from.getTime() : Number(from)
  const toMs = to instanceof Date ? to.getTime() : Number(to)

  const events = deep(root, 'VEVENT').map(readEvent).filter(Boolean)
  const masters = events.filter((e) => !e.recurrenceId)
  const overrides = new Map()
  for (const e of events) {
    if (!e.recurrenceId) continue
    if (!overrides.has(e.uid)) overrides.set(e.uid, new Map())
    /* Outlook ecrit parfois le RECURRENCE-ID en UTC alors que le DTSTART du
       maitre est en heure murale d'un fuseau. La clef de l'exception est
       l'heure MURALE du maitre, donc l'instant est ramene dans son fuseau. */
    let wall = e.recurrenceId.wall
    const master = masters.find((m) => m.uid === e.uid)
    if (e.recurrenceId.utc && master && !master.dtstart.utc && !master.dtstart.allDay) {
      wall = utcToWall(wall, master.dtstart.tzid ?? fallbackZone, zones)
    }
    overrides.get(e.uid).set(wall, e)
  }
  /* Un fichier peut porter une exception dont le maitre n'est pas dedans
     (Google le fait pour une occurrence deplacee d'une serie qui n'est plus
     partagee). Elle vaut comme un evenement simple. */
  for (const [uid, byWall] of overrides) {
    if (masters.some((m) => m.uid === uid)) continue
    for (const e of byWall.values()) masters.push({ ...e, recurrenceId: null })
  }

  const out = []
  const seen = new Set()
  /* La fenetre murale, elargie d'un jour de chaque cote: une heure murale
     peut etre jusqu'a 14 heures loin de son instant. Le filtrage exact se fait
     sur les instants, plus bas. */
  const wallFrom = fromMs - DAY
  const wallTo = toMs + DAY

  for (const ev of masters) {
    if (ev.cancelled) continue
    const durMs = durationOf(ev, zones, fallbackZone)
    const ex = new Set(ev.exdates.map((d) => d.wall))
    const ovr = overrides.get(ev.uid) ?? new Map()

    const walls = expandRRule(ev.dtstart.wall, ev.rrule, wallFrom, wallTo, cap)
    for (const r of ev.rdates) walls.push(r.wall)

    for (const wall of walls) {
      if (ex.has(wall)) continue
      let src = ev
      let startWall = wall
      const o = ovr.get(wall)
      if (o) {
        if (o.cancelled) continue
        src = o
        startWall = o.dtstart.wall
      }
      const dv = { ...src.dtstart, wall: startWall }
      const startMs = toInstant(dv, zones, fallbackZone)
      const d = o ? durationOf(o, zones, fallbackZone) : durMs
      const endMs = startMs + d
      if (endMs < fromMs || startMs > toMs) continue
      const key = `${ev.uid}#${wall}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({
        uid: ev.uid,
        key,
        title: src.summary.slice(0, 200),
        location: src.location ? src.location.slice(0, 200) : null,
        url: src.url ?? ev.url ?? null,
        allDay: dv.allDay,
        startsAt: new Date(startMs).toISOString(),
        endsAt: new Date(endMs).toISOString(),
        startsOn: dv.allDay ? wallDate(startWall) : null,
        endsOn: dv.allDay ? wallDate(startWall + Math.max(DAY, d)) : null,
      })
      if (out.length >= cap) return out
    }
  }
  /* Les occurrences deplacees par un RECURRENCE-ID dont l'heure d'origine
     est hors fenetre mais la nouvelle dedans: le maitre ne les a pas
     enumerees. Une passe de plus, sur les exceptions seules. */
  for (const [uid, byWall] of overrides) {
    const master = masters.find((m) => m.uid === uid)
    if (!master) continue
    for (const [origWall, o] of byWall) {
      const key = `${uid}#${origWall}`
      if (seen.has(key) || o.cancelled) continue
      const startMs = toInstant(o.dtstart, zones, fallbackZone)
      const endMs = startMs + durationOf(o, zones, fallbackZone)
      if (endMs < fromMs || startMs > toMs) continue
      seen.add(key)
      out.push({
        uid, key,
        title: o.summary.slice(0, 200),
        location: o.location ? o.location.slice(0, 200) : null,
        url: o.url ?? master.url ?? null,
        allDay: o.dtstart.allDay,
        startsAt: new Date(startMs).toISOString(),
        endsAt: new Date(endMs).toISOString(),
        startsOn: o.dtstart.allDay ? wallDate(o.dtstart.wall) : null,
        endsOn: o.dtstart.allDay ? wallDate(o.dtstart.wall + Math.max(DAY, endMs - startMs)) : null,
      })
      if (out.length >= cap) return out
    }
  }
  out.sort((a, b) => (a.startsAt < b.startsAt ? -1 : a.startsAt > b.startsAt ? 1 : 0))
  return out
}

/** La duree d'un evenement en ms: DTEND - DTSTART, sinon DURATION, sinon un jour ou zero. */
export function durationOf(ev, zones, fallbackZone) {
  if (ev.dtend) {
    const a = toInstant(ev.dtstart, zones, fallbackZone)
    const b = toInstant(ev.dtend, zones, fallbackZone)
    if (b > a) return b - a
  }
  if (ev.duration != null && ev.duration > 0) return ev.duration
  return ev.dtstart.allDay ? DAY : 0
}

/** Est-ce que ce texte ressemble a un calendrier? Le minimum honnete. */
export function looksLikeIcs(text) {
  const head = String(text ?? '').slice(0, 2000)
  return /BEGIN:VCALENDAR/i.test(head)
}
