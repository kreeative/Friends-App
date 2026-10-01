/* Extension explicite: charge par node dans syllabus.test.mjs et par
   api/syllabus.js, qui ne resolvent pas les imports sans extension. */
import { addDays, dayKey, daysBetween, fromKey } from './cycle.js'
import { CATEGORY_COLOUR, minutesOf, occurrencesOf } from './agenda.js'
import { goalRow } from './goalRow.js'

/**
 * Le plan de cours, lu par un modele, et ce qu'on en fait.
 *
 *   "est-ce que tu peux ajouter une option intelligente ou tu peux ajouter
 *    ton PDF de ton syllabus et ca va analyser pour te donner des events,
 *    des rappels de goals et des to-dos a propos de ton calendrier, et te
 *    demander une question de quand tu es disponible, comme ca ca peut
 *    planifier intelligemment comment tu vas etudier"
 *
 *   "comme certaines personnes auront deja ajoute des events, faire
 *    attention de ne pas les repeter"
 *
 * Le modele lit le PDF cote serveur (api/syllabus.js) et rend un JSON. Rien
 * ici ne le croit sur parole: normalisePlan() reprend chaque champ, jette ce
 * qui n'est pas une date, une heure ou un jour, et rend une forme que le
 * reste du fichier peut traiter les yeux fermes. Le modele peut se tromper;
 * la base ne doit pas recevoir une ligne qu'elle refuserait avec un nom de
 * contrainte a la place d'une phrase.
 *
 * CE QUE CA DEVIENT, ET POURQUOI CETTE REPARTITION.
 *
 *   cours hebdomadaires   -> calendar_event, regle par jours de semaine,
 *                            comme le fait deja l'assistant d'horaire
 *   examens, quiz         -> calendar_event 'examen', une fois, a la date:
 *                            on s'y presente a une heure, c'est de la grille
 *   tout ce qui est date  -> UNE liste a cocher (un objectif avec des
 *                            etapes) au nom du cours, une etape par date.
 *                            Dix devoirs ne font pas dix objectifs; ils
 *                            font une liste qui se remplit, avec son
 *                            pourcentage, et le rappel d'objectif existe
 *                            deja dessus
 *   le temps d'etude      -> calendar_event 'etude', pose dans les fenetres
 *                            que la personne a dites, autour de ce qui est
 *                            deja la
 *
 * NE PAS REPETER CE QUI EST DEJA LA.
 *
 * Avant d'afficher quoi que ce soit, chaque proposition est comparee a ce
 * que le calendrier a deja: un cours au meme jour et a la meme heure qu'une
 * regle existante, ou de meme nom sur un jour commun, est marque "deja sur
 * ton calendrier" et arrive decoche. Une date qui a deja son evenement, son
 * etape ou son objectif le meme jour, pareil. La personne peut recocher,
 * mais par defaut on n'ajoute pas deux fois.
 */

export const MAX_PDF_BYTES = 3 * 1024 * 1024
export const SESSION_KINDS = ['lecture', 'lab', 'tutorial', 'other']
export const DEADLINE_KINDS = ['exam', 'quiz', 'assignment', 'project', 'presentation', 'reading', 'other']
/* Ce qui va sur la grille comme un examen: on s'y presente. */
const ON_GRID = new Set(['exam', 'quiz'])
export const SESSION_LENGTHS = [30, 45, 60, 90, 120]
export const DEFAULT_AVAILABILITY = { weekdays: [1, 2, 3, 4, 5], start: '18:00', end: '21:00', minutes: 60, perWeek: 3 }

/**
 * Le schema que le modele doit respecter. Partage avec l'API pour que la
 * consigne et le normaliseur parlent de la meme chose.
 *
 * Les valeurs permises (kind, jours) sont dans les descriptions et pas en
 * enum: la sortie structuree ne garde que les types, les proprietes et le
 * requis, et de toute facon normalisePlan() reverifie tout.
 */
const nullable = (type, description) => ({
  anyOf: [{ type }, { type: 'null' }],
  ...(description ? { description } : {}),
})

export const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['course', 'term', 'sessions', 'deadlines'],
  properties: {
    course: nullable('string', 'Course code and short title, as printed. Null if none.'),
    term: {
      type: 'object',
      additionalProperties: false,
      required: ['from', 'until'],
      properties: {
        from: nullable('string', 'First day of classes, YYYY-MM-DD'),
        until: nullable('string', 'Last day of classes, YYYY-MM-DD'),
      },
    },
    sessions: {
      type: 'array',
      description: 'Every weekly meeting: lectures, labs, tutorials. One entry per distinct weekday and time.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'kind', 'weekdays', 'start', 'end', 'location', 'from', 'until'],
        properties: {
          title: { type: 'string', description: 'Short, under 60 characters' },
          kind: { type: 'string', description: 'One of: lecture, lab, tutorial, other' },
          weekdays: { type: 'array', items: { type: 'integer' }, description: '0 = Sunday, 1 = Monday, ... 6 = Saturday' },
          start: nullable('string', '24h HH:MM'),
          end: nullable('string', '24h HH:MM'),
          location: nullable('string', 'Room or building'),
          from: nullable('string', 'YYYY-MM-DD, only when it differs from the term'),
          until: nullable('string', 'YYYY-MM-DD, only when it differs from the term'),
        },
      },
    },
    deadlines: {
      type: 'array',
      description: 'Every dated thing to hand in or to sit: exams, quizzes, assignments, projects, presentations, required readings.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'kind', 'due_on', 'at', 'weight', 'location', 'steps'],
        properties: {
          title: { type: 'string', description: 'Short, under 60 characters' },
          kind: { type: 'string', description: 'One of: exam, quiz, assignment, project, presentation, reading, other' },
          due_on: { type: 'string', description: 'YYYY-MM-DD' },
          at: nullable('string', '24h HH:MM when a time is printed'),
          weight: nullable('number', 'Percent of the final grade, when printed'),
          location: nullable('string', 'Room, when printed'),
          steps: {
            type: 'array',
            items: { type: 'string' },
            description: 'Sub-parts the syllabus itself names for this item, in order, at most six. Empty when it names none.',
          },
        },
      },
    },
  },
}

/* --- lire ce que le modele a rendu ---------------------------------------- */

const arr = (v) => (Array.isArray(v) ? v : [])
const pad = (n) => String(n).padStart(2, '0')

function text(v, max) {
  const s = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : ''
  return s ? s.slice(0, max) : null
}

/** 'YYYY-MM-DD' si c'est une vraie date du calendrier, sinon null. */
export function isoDate(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v ?? '').trim())
  if (!m) return null
  const d = fromKey(m[0])
  /* Le 30 fevrier repasse par Date en 2 mars; l'aller-retour le trahit. */
  return d && dayKey(d) === m[0] ? m[0] : null
}

/**
 * 'HH:MM' depuis ce qu'un plan de cours ecrit: 9h, 9h30, 09:30, 9:30 am,
 * 1pm. Null pour tout le reste, y compris "midi" et une annee prise pour
 * une heure.
 */
export function readClock(v) {
  if (v == null) return null
  const s = String(v).trim().toLowerCase().replace(/\s+/g, '')
  const m = /^(\d{1,2})(?:[:h.](\d{2})?)?(am|pm)?$/.exec(s)
  if (!m) return null
  let h = Number(m[1])
  const min = Number(m[2] ?? 0)
  if (m[3] === 'pm' && h < 12) h += 12
  if (m[3] === 'am' && h === 12) h = 0
  if (h > 23 || min > 59) return null
  return `${pad(h)}:${pad(min)}`
}

/* Deux lettres suffisent dans les deux langues: ma(rdi) et me(rcredi) se
   separent, sa(medi) et sa(turday) tombent au meme endroit. */
const DAY_WORDS = { su: 0, di: 0, mo: 1, lu: 1, tu: 2, ma: 2, we: 3, me: 3, th: 4, je: 4, fr: 5, ve: 5, sa: 6 }

/** 0..6 depuis un entier, un "7" ISO pour dimanche, ou un nom de jour. */
export function readWeekday(v) {
  if (v === 7) return 0
  if (Number.isInteger(v) && v >= 0 && v <= 6) return v
  if (typeof v === 'string' && /^\d$/.test(v.trim())) return readWeekday(Number(v))
  const w = normTitle(v).slice(0, 2)
  return DAY_WORDS[w] ?? null
}

const uniqueDays = (list) =>
  [...new Set(arr(list).map(readWeekday).filter((d) => d != null))].sort((a, b) => a - b)

/**
 * Le plan, propre. Chaque cours a au moins un jour; chaque date est une
 * vraie date; une heure sans sa fin, ou une fin avant le debut, tombe et le
 * cours reste (sans heure, comme le permet la base). Les dates sortent
 * triees. `past` marque ce qui est deja passe, pour arriver decoche.
 */
export function normalisePlan(raw, { today = dayKey(new Date()) } = {}) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const term = { from: isoDate(src.term?.from), until: isoDate(src.term?.until) }
  if (term.from && term.until && term.until < term.from) term.until = null

  const sessions = []
  for (const s of arr(src.sessions)) {
    const title = text(s?.title, 120)
    if (!title) continue
    const weekdays = uniqueDays(s?.weekdays)
    if (!weekdays.length) continue
    const start = readClock(s?.start)
    const end = readClock(s?.end)
    const timed = start != null && end != null && minutesOf(end) > minutesOf(start)
    let from = isoDate(s?.from)
    let until = isoDate(s?.until)
    if (from && until && until < from) until = null
    sessions.push({
      id: `s${sessions.length + 1}`,
      title,
      kind: SESSION_KINDS.includes(s?.kind) ? s.kind : 'lecture',
      weekdays,
      start: timed ? start : null,
      end: timed ? end : null,
      location: text(s?.location, 160),
      from,
      until,
    })
  }

  const deadlines = []
  for (const d of arr(src.deadlines)) {
    const title = text(d?.title, 200)
    const due_on = isoDate(d?.due_on)
    if (!title || !due_on) continue
    const w = Number(d?.weight)
    deadlines.push({
      id: `d${deadlines.length + 1}`,
      title,
      kind: DEADLINE_KINDS.includes(d?.kind) ? d.kind : 'other',
      due_on,
      at: readClock(d?.at),
      weight: Number.isFinite(w) && w > 0 ? Math.min(100, Math.round(w)) : null,
      location: text(d?.location, 160),
      steps: arr(d?.steps).map((x) => text(x, 200)).filter(Boolean).slice(0, 6),
      past: due_on < today,
    })
  }
  deadlines.sort((a, b) => a.due_on.localeCompare(b.due_on))

  return { course: text(src.course, 120), term, sessions, deadlines }
}

/* --- ne pas repeter ------------------------------------------------------- */

/** Minuscules, sans accents ni ponctuation: "Éxamen  intra!" -> "examen intra". */
export function normTitle(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Deux titres qui parlent de la meme chose.
 *
 * Par mots, et les nombres comptent comme des mots: "Devoir 1" et
 * "Devoir 2" partagent "devoir" et rien d'autre, donc la moitie, donc non.
 * "Devoir 1" et "Devoir 1 (10 %)" partagent tout ce que le plus court a,
 * donc oui. Une inclusion de chaine aurait dit que "devoir 1" est dans
 * "devoir 10".
 */
export function sameTitle(a, b) {
  const x = normTitle(a)
  const y = normTitle(b)
  if (!x || !y) return false
  if (x === y) return true
  const words = (s) => new Set(s.split(' ').filter((w) => w.length >= 3 || /^\d+$/.test(w)))
  const wx = words(x)
  const wy = words(y)
  if (!wx.size || !wy.size) return false
  let common = 0
  for (const w of wx) if (wy.has(w)) common += 1
  return common / Math.min(wx.size, wy.size) >= 0.6
}

const dayOf = (v) => (typeof v === 'string' ? v.slice(0, 10) : v instanceof Date ? dayKey(v) : null)

/**
 * Le plan, avec `dup` sur ce que le calendrier a deja.
 *
 * Un cours est deja la si une regle hebdomadaire partage un de ses jours
 * ET (la meme heure de debut et de fin, OU le meme nom). Deux cours
 * differents a la meme heure le meme jour, une seule personne ne peut pas
 * y etre: l'heure suffit, meme si le nom a ete tape autrement.
 *
 * Une date est deja la si, le meme jour, il y a un evenement de meme nom
 * (ou un examen a la meme heure quand c'est un examen), une etape de meme
 * nom, ou un objectif de meme nom.
 */
export function dedupPlan(plan, { events = [], goals = [], steps = [] } = {}) {
  const weekly = (events ?? []).filter((e) => Array.isArray(e?.weekdays) && e.weekdays.length > 0)
  const single = (events ?? []).filter((e) => e && !(Array.isArray(e.weekdays) && e.weekdays.length > 0))

  const sessions = (plan?.sessions ?? []).map((s) => {
    const sm = minutesOf(s.start)
    const em = minutesOf(s.end)
    const hit = weekly.find((e) => {
      if (!e.weekdays.some((d) => s.weekdays.includes(d))) return false
      const sameTime = sm != null && e.start_min === sm && e.end_min === em
      return sameTime || sameTitle(e.title, s.title)
    })
    return { ...s, dup: hit ? { kind: 'event', id: hit.id, title: hit.title } : null }
  })

  const deadlines = (plan?.deadlines ?? []).map((d) => {
    const at = minutesOf(d.at)
    const ev = single.find((e) => {
      if (dayOf(e.starts_on) !== d.due_on) return false
      if (sameTitle(e.title, d.title)) return true
      return ON_GRID.has(d.kind) && e.category === 'examen' && at != null && e.start_min === at
    })
    const st = (steps ?? []).find((x) => dayOf(x?.due_on) === d.due_on && sameTitle(x.title, d.title))
    const g = (goals ?? []).find((x) => dayOf(x?.due_on) === d.due_on && sameTitle(x.commitment, d.title))
    const dup = ev
      ? { kind: 'event', id: ev.id, title: ev.title }
      : st
        ? { kind: 'step', id: st.id, title: st.title }
        : g
          ? { kind: 'goal', id: g.id, title: g.commitment }
          : null
    return { ...d, dup }
  })

  return { ...plan, sessions, deadlines }
}

/* --- planifier l'etude ---------------------------------------------------- */

const later = (a, b) => (daysBetween(a, b) > 0 ? b : a)
/* La semaine commence le lundi, pour compter "par semaine". */
const weekKey = (d) => dayKey(addDays(d, -((d.getDay() + 6) % 7)))

/** Les creneaux pris ce jour-la, en minutes. Une entree sans heure ne prend rien. */
export function busyOn(busy, day) {
  const out = []
  for (const e of busy ?? []) {
    if (e?.start_min == null || e?.end_min == null) continue
    if (occurrencesOf(e, day, day).length) out.push({ start: e.start_min, end: e.end_min })
  }
  return out
}

/* Le premier depart libre, au quart d'heure, dans la fenetre. */
function freeSlot(taken, from, to, minutes) {
  for (let s = from; s + minutes <= to; s += 15) {
    const e = s + minutes
    if (!taken.some((b) => s < b.end && e > b.start)) return s
  }
  return null
}

/**
 * Combien de seances pour une date. Un examen ou un projet en vaut quatre,
 * un devoir deux, une lecture une; le poids dans la note en ajoute jusqu'a
 * deux. Six au plus: au-dela, ce n'est plus un plan, c'est un mur.
 */
export function sessionsWanted(d) {
  const base = { exam: 4, project: 4, presentation: 2, assignment: 2, quiz: 1, reading: 1, other: 1 }[d?.kind] ?? 1
  const extra = d?.weight == null ? 0 : d.weight >= 30 ? 2 : d.weight >= 15 ? 1 : 0
  return Math.min(6, base + extra)
}

/* Combien de jours avant la date on commence. */
const LEAD_DAYS = { exam: 21, project: 21, presentation: 14, assignment: 14, quiz: 7, reading: 7, other: 10 }

/**
 * Les rangs a essayer d'abord parmi n candidats pour en prendre k: repartis
 * sur toute la fenetre, le plus proche de la date en premier, puis tous les
 * autres du plus proche au plus loin, au cas ou un plafond hebdomadaire en
 * refuse un.
 */
function spread(n, k) {
  if (n <= 0) return []
  const first = new Set()
  if (n <= k) for (let i = n - 1; i >= 0; i -= 1) first.add(i)
  else if (k === 1) first.add(n - 1)
  else for (let i = 0; i < k; i += 1) first.add(Math.round(((n - 1) * (k - 1 - i)) / (k - 1)))
  const rest = []
  for (let i = n - 1; i >= 0; i -= 1) if (!first.has(i)) rest.push(i)
  return [...first, ...rest]
}

/**
 * Des blocs d'etude dans les fenetres dites, autour de ce qui est deja la.
 *
 *   "te demander une question de quand tu es disponible, comme ca ca peut
 *    planifier intelligemment comment tu vas etudier"
 *
 * `availability` est la reponse a cette question: les jours, une plage
 * horaire, la duree d'une seance et le nombre par semaine. `busy` est tout
 * ce qui a une heure sur le calendrier, y compris les cours qu'on est en
 * train d'ajouter; un bloc ne se pose jamais dessus, ni sur un autre bloc.
 *
 * Les dates sont servies dans l'ordre; chaque bloc prend un jour libre dans
 * les trois semaines avant un examen, les deux avant un devoir. Un jour ne
 * porte qu'un bloc, et une semaine n'en porte pas plus que demande. Ce qui
 * n'a pas trouve de place est rendu dans `unplaced`, avec le compte, pour
 * que l'ecran le dise au lieu de le taire.
 */
export function planStudy(deadlines, availability, { today = dayKey(new Date()), busy = [] } = {}) {
  const av = { ...DEFAULT_AVAILABILITY, ...(availability ?? {}) }
  const from = minutesOf(av.start)
  const to = minutesOf(av.end)
  const minutes = Number(av.minutes) || 60
  const perWeek = Math.max(1, Number(av.perWeek) || 1)
  const days = uniqueDays(av.weekdays)
  const t0 = fromKey(today)
  const blocks = []
  const unplaced = []
  const list = [...(deadlines ?? [])].filter((d) => d?.due_on).sort((a, b) => a.due_on.localeCompare(b.due_on))

  if (from == null || to == null || to - from < minutes || !days.length || !t0) {
    return { blocks, unplaced: list.map((d) => ({ deadlineId: d.id, title: d.title, wanted: sessionsWanted(d), placed: 0 })) }
  }

  const usedDay = new Set()
  const perWeekUsed = new Map()
  const taken = [...(busy ?? [])]

  for (const d of list) {
    const due = fromKey(d.due_on)
    if (!due) continue
    const wanted = sessionsWanted(d)
    const first = later(t0, addDays(due, -(LEAD_DAYS[d.kind] ?? 10)))
    const last = addDays(due, -1)

    const candidates = []
    const span = daysBetween(first, last)
    for (let i = 0; i <= span; i += 1) {
      const day = addDays(first, i)
      const k = dayKey(day)
      if (!days.includes(day.getDay()) || usedDay.has(k)) continue
      const slot = freeSlot(busyOn(taken, day), from, to, minutes)
      if (slot != null) candidates.push({ day, k, slot })
    }

    let got = 0
    for (const idx of spread(candidates.length, wanted)) {
      if (got >= wanted) break
      const c = candidates[idx]
      const wk = weekKey(c.day)
      if (usedDay.has(c.k) || (perWeekUsed.get(wk) ?? 0) >= perWeek) continue
      const block = {
        id: `b${blocks.length + 1}`,
        deadlineId: d.id,
        title: d.title,
        starts_on: c.k,
        start_min: c.slot,
        end_min: c.slot + minutes,
        weekdays: [],
        until_on: null,
      }
      blocks.push(block)
      taken.push(block)
      usedDay.add(c.k)
      perWeekUsed.set(wk, (perWeekUsed.get(wk) ?? 0) + 1)
      got += 1
    }
    if (got < wanted) unplaced.push({ deadlineId: d.id, title: d.title, wanted, placed: got })
  }

  blocks.sort((a, b) => a.starts_on.localeCompare(b.starts_on) || a.start_min - b.start_min)
  return { blocks, unplaced }
}

/* --- ce qui s'ecrit ------------------------------------------------------- */

/** Les cours, en regles hebdomadaires, comme l'assistant d'horaire les ecrit. */
export function sessionRows(sessions, { userId, term = {}, today = dayKey(new Date()) } = {}) {
  return (sessions ?? []).map((s) => {
    const starts_on = s.from || term.from || today
    let until_on = s.until || term.until || null
    if (until_on && until_on < starts_on) until_on = null
    return {
      user_id: userId,
      title: s.title.slice(0, 120),
      category: 'cours',
      location: s.location ?? null,
      starts_on,
      until_on,
      start_min: minutesOf(s.start),
      end_min: minutesOf(s.end),
      weekdays: [...s.weekdays].sort((a, b) => a - b),
      colour: CATEGORY_COLOUR.cours,
    }
  })
}

/** Les examens et quiz, une fois, sur leur date. Deux heures pour un examen, une pour un quiz. */
export function examRows(deadlines, { userId } = {}) {
  return (deadlines ?? [])
    .filter((d) => ON_GRID.has(d.kind))
    .map((d) => {
      const at = minutesOf(d.at)
      const length = d.kind === 'exam' ? 120 : 60
      return {
        user_id: userId,
        title: d.title.slice(0, 120),
        category: 'examen',
        location: d.location ?? null,
        starts_on: d.due_on,
        until_on: null,
        start_min: at,
        end_min: at == null ? null : Math.min(1440, at + length),
        weekdays: [],
        colour: CATEGORY_COLOUR.examen,
      }
    })
}

/** Les blocs d'etude. `label` met la phrase de la langue devant le titre. */
export function studyRows(blocks, { userId, label = (s) => s } = {}) {
  return (blocks ?? []).map((b) => ({
    user_id: userId,
    title: String(label(b.title)).slice(0, 120),
    category: 'etude',
    location: null,
    starts_on: b.starts_on,
    until_on: null,
    start_min: b.start_min,
    end_min: b.end_min,
    weekdays: [],
    colour: CATEGORY_COLOUR.etude,
  }))
}

/**
 * La liste a cocher du cours: un objectif personnel, une fois, dont la date
 * est la derniere des dates, avec le rappel. Par goalRow(), pour que la
 * ligne soit la meme que celle du formulaire.
 */
export function goalPayload({ userId, title, deadlines = [], today = dayKey(new Date()) } = {}) {
  const last = deadlines.map((d) => d.due_on).filter(Boolean).sort().at(-1) ?? null
  return goalRow(
    {
      groupId: null,
      kind: 'personal',
      userId,
      commitment: String(title ?? '').slice(0, 200),
      goalType: 'process',
      proofType: 'none',
      cadence: 'once',
      target: 1,
      days: [],
      dueOn: last,
      endsOn: '',
      startsOn: today,
      stake: '',
      remind: true,
      remindAt: '',
      remindEvery: '',
      when: '',
      where: '',
      evidence: '',
    },
    today,
  )
}

/**
 * Le plan d'etude comme OBJECTIF, pas seulement comme des blocs de couleur.
 *
 *   "when you upload your syllabus the study plan should also assign you a
 *    goal and/or a to-do list"
 *
 * Des blocs sur la grille, personne ne les voit et rien ne demande le soir
 * si on y est alle. Un objectif recurrent, si: "Etudier : CCT112, trois
 * fois par semaine, lundi mercredi vendredi", avec le rappel a l'heure de
 * la fenetre dite, et le point du jour que les amis voient. Tout vient de
 * la reponse a "quand peux-tu etudier ?", qui est deja la: les jours, la
 * cadence, l'heure du rappel. Fin a la derniere date du plan.
 */
export function studyGoalPayload({ userId, title, availability, blocks = [], deadlines = [], today = dayKey(new Date()) } = {}) {
  const av = { ...DEFAULT_AVAILABILITY, ...(availability ?? {}) }
  const days = uniqueDays(av.weekdays)
  const lastBlock = blocks.map((b) => b.starts_on).filter(Boolean).sort().at(-1) ?? null
  const lastDue = deadlines.map((d) => d.due_on).filter(Boolean).sort().at(-1) ?? null
  const ends = [lastBlock, lastDue].filter(Boolean).sort().at(-1) ?? ''
  return goalRow(
    {
      groupId: null,
      kind: 'personal',
      userId,
      commitment: String(title ?? '').slice(0, 200),
      goalType: 'process',
      proofType: 'none',
      cadence: 'recurring',
      target: Math.max(1, Math.min(7, Number(av.perWeek) || 1)),
      days,
      dueOn: '',
      endsOn: ends,
      startsOn: today,
      stake: '',
      remind: true,
      remindAt: readClock(av.start) ?? '',
      remindEvery: '',
      when: '',
      where: '',
      evidence: '',
    },
    today,
  )
}

/**
 * Les seances d'etude en etapes de la liste a cocher, datees et a l'heure
 * du bloc, pour que cocher une seance fasse monter l'anneau. `label` met la
 * phrase de la langue devant ("Etude : Intra").
 */
export function studyStepRows(blocks, { goalId, offset = 0, label = (s) => s } = {}) {
  return [...(blocks ?? [])]
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on) || a.start_min - b.start_min)
    .map((b, i) => ({ goal_id: goalId, title: String(label(b.title)).slice(0, 200), due_on: b.starts_on, at_min: b.start_min, position: offset + i }))
}

/** "Devoir 1 (15 %)": le poids dans le titre, parce que c'est ce qui fait choisir par quoi commencer. */
export const stepTitle = (d) => (d.weight ? `${d.title} (${d.weight} %)` : d.title).slice(0, 200)

/**
 * Une etape par date, dans l'ordre des dates, et sous chacune les
 * sous-parties que le plan de cours nomme lui-meme, sans date. `offset`
 * continue la numerotation d'une liste qui existe deja.
 */
export function stepRows(deadlines, { goalId, offset = 0 } = {}) {
  const out = []
  for (const d of [...(deadlines ?? [])].sort((a, b) => a.due_on.localeCompare(b.due_on))) {
    out.push({ goal_id: goalId, title: stepTitle(d), due_on: d.due_on, at_min: minutesOf(d.at), position: offset + out.length })
    for (const s of d.steps ?? []) {
      out.push({ goal_id: goalId, title: `${d.title}: ${s}`.slice(0, 200), due_on: null, at_min: null, position: offset + out.length })
    }
  }
  return out
}

/**
 * La liste qui existe deja pour ce cours, s'il y en a une, pour y ajouter
 * plutot que doubler. Jamais un objectif recurrent: "Etude : PSY1001" et
 * "PSY1001 : a faire" partagent assez de mots pour que sameTitle les
 * confonde, et des echeances ajoutees en etapes d'une routine seraient une
 * liste au mauvais endroit.
 */
export function findGoal(goals, title) {
  return (goals ?? []).find((g) => g && g.status !== 'done' && (g.cadence ?? 'once') !== 'recurring' && sameTitle(g.commitment, title)) ?? null
}

/* --- parler au serveur ---------------------------------------------------- */

/** Base64 d'octets, dans le navigateur comme dans node. */
export function toBase64(bytes) {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64')
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  }
  return btoa(s)
}

/** 'not_pdf' | 'too_big' | null, avant d'envoyer quoi que ce soit. */
export function pdfProblem(file) {
  if (!file) return 'not_pdf'
  const name = String(file.name ?? '').toLowerCase()
  if (!(file.type === 'application/pdf' || name.endsWith('.pdf'))) return 'not_pdf'
  if (file.size > MAX_PDF_BYTES) return 'too_big'
  return null
}

/**
 * POST /api/syllabus avec le jeton de session, le PDF en base64, la langue
 * et la date du jour. Rend { plan } normalise ou { error: <mot-code> }. Le
 * serveur ne renvoie que des mots-codes, et l'ecran les traduit.
 */
export async function analyseSyllabus(
  supabase,
  file,
  { locale = 'fr', today = dayKey(new Date()), origin = '', fetchImpl = fetch } = {},
) {
  const problem = pdfProblem(file)
  if (problem) return { error: problem }
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  if (!token) return { error: 'unauthorized' }
  const pdf = toBase64(new Uint8Array(await file.arrayBuffer()))
  let res
  try {
    res = await fetchImpl(`${origin}/api/syllabus`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ pdf, name: file.name, locale, today }),
    })
  } catch {
    return { error: 'network' }
  }
  let body = {}
  try {
    body = await res.json()
  } catch {
    body = {}
  }
  if (!res.ok) {
    const byStatus = { 401: 'unauthorized', 413: 'too_big', 429: 'busy', 504: 'timeout' }
    /* `detail` est la phrase de l'API, deja nettoyee par le serveur: elle
       nomme le parametre refuse ou le modele absent, et c'est ce qu'il faut
       lire quand "la lecture a echoue". */
    return { error: body?.error || byStatus[res.status] || 'model_failed', detail: typeof body?.detail === 'string' ? body.detail.slice(0, 300) : null }
  }
  return { plan: normalisePlan(body.plan, { today }), model: body.model ?? null, strict: body.strict !== false }
}
