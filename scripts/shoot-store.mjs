/**
 * node scripts/shoot-store.mjs
 *
 * Les cinq ecrans de l'App Store, en francais puis en anglais, en 390x844 a 2x,
 * avec des donnees propres. Les images sortent dans .shots/fr/ et .shots/en/.
 *
 * CE QUE CE SCRIPT AJOUTE A `npm run sweep`
 *
 * Le balayage de largeurs tourne en MODE SOLO et ne visite que /goals: les deux
 * ecrans de groupe, ceux qui portent la promesse du produit, n'y sont jamais.
 * Ce script pose une fixture de groupe, avec cinq personnes, des objectifs, des
 * cycles et des check-ins, pour que le classement et le rail de check-in aient
 * quelque chose a montrer.
 *
 * POURQUOI DES DONNEES ECRITES A LA MAIN
 *
 * Une capture d'App Store faite sur un compte reel montre soit un compte vide,
 * soit les vraies donnees de quelqu'un. Les deux sont mauvais. Ici chaque
 * chiffre est choisi pour etre credible et lisible: personne n'est a 100 %,
 * personne n'est a zero, et les montants sont ceux d'une vraie semaine.
 *
 * L'HEURE EST FIGEE
 *
 * page.clock.install a une date fixe, sinon la bande du calendrier, le "prochain
 * rappel" et les pourcentages changent a chaque execution et deux captures
 * prises a deux moments ne racontent pas la meme journee.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const OUT = process.env.SHOT_OUT ?? '.shots'
const PORT = 4188
const WIDTH = 390
const HEIGHT = 844

let chromium
try {
  ;({ chromium } = await import('playwright'))
} catch {
  console.error('playwright is not installed: npm install, then npx playwright install chromium')
  process.exit(2)
}

/* --- la fixture ----------------------------------------------------------- */

const ME = 'u1'
const GID = '11111111-2222-4333-8444-555555555555'
const NOW = '2026-09-08T10:15:00'
const TODAY = '2026-09-08'

const GROUP = {
  id: GID, name: 'YOUNG AND BEAUTIFUL', cadence: 'daily', cadence_days: 1,
  timezone: 'America/Toronto', created_at: '2026-06-01', created_by: ME,
}

const PEOPLE = [
  [ME, 'Anne-Kelly'], ['u2', 'Harrisso'], ['u3', 'Kristynne'], ['u4', 'Meliane'], ['u5', 'Milly'],
]
const ROSTER = PEOPLE.map(([id, name], i) => ({
  user_id: id, group_id: GID, role: i === 0 ? 'creator' : 'member', nudge_order: i,
  groups: GROUP, profiles: { id, display_name: name, avatar_url: null, birthday: null },
}))

const PROFILE = {
  id: ME, display_name: 'Anne-Kelly', locale: 'fr', currency: 'CAD',
  timezone: 'America/Toronto', setup_done_at: '2026-06-01T00:00:00Z',
  terms_accepted_at: '2026-06-01T00:00:00Z', terms_version: '2026-08-04',
  gender: 'woman', cycle_on: false,
  /* Sinon l'ecran du budget montre son deck d'introduction et pas les
     enveloppes. Trouve en regardant la capture, pas en lisant le code. */
  has_seen_budget_intro: true,
}

/* Sept jours de cycles, un par jour, celui d'aujourd'hui ouvert. */
const DAYS = ['09-02', '09-03', '09-04', '09-05', '09-06', '09-07', '09-08'].map((d) => `2026-${d}`)
const CYCLES = DAYS.map((d, n) => ({
  id: `cy${n}`, group_id: GID, seq: n,
  opens_at: `${d}T04:00:00Z`, closes_at: `${d}T23:59:00Z`, reveal_at: `${d}T23:59:00Z`,
}))

const goal = (id, owner, commitment, extra = {}) => ({
  id, group_id: GID, owner_id: owner, created_by: owner, kind: 'personal', status: 'active',
  commitment, cadence: 'recurring', target_per_cycle: 1, active_days: null,
  starts_on: '2026-06-01', created_at: '2026-06-01T00:00:00Z', proof_type: 'none',
  ...extra,
})

/**
 * CE QUE LA PERSONNE A ECRIT, DANS SA LANGUE.
 *
 * L'interface se traduit toute seule, mais un objectif, une note de depense ou
 * un cours sont du texte TAPE: ils restent tels quels quelle que soit la
 * langue de l'ecran. Une capture pour une fiche anglophone qui montre "Me
 * laver 2 fois par jour" est une capture a moitie traduite, et c'est celle
 * qu'un examinateur remarque.
 *
 * Donc chaque chaine ecrite par une personne existe deux fois, et le reste
 * (les chiffres, les dates, les identifiants) ne bouge pas: les deux series
 * racontent la meme journee, dans deux langues.
 */
const TEXT = {
  fr: {
    goals: [
      ['Me laver 2 fois par jour', 'Matin et soir'],
      ['Manger 3x par jour', 'Aux repas'],
      ['Reviser la biochimie', 'Avant de dormir', 'Une photo des notes'],
      ['Courir trois fois par semaine'], ['Lire vingt pages'],
      ['Appeler ma mere le dimanche'], ['Ranger ma chambre'],
      ['Preparer mes repas le dimanche'], ['Marcher 30 minutes'],
      ['Ecrire trois lignes de journal'], ['Boire deux litres d eau'],
    ],
    events: ['Biochimie', 'Statistiques', 'Sport'],
    spend: ['Epicerie', 'Transport', 'Cafe', 'Livres', 'Telephone', 'Sorties'],
    fixed: ['Loyer', 'Telephone', 'Transport'],
    pay: 'Paie',
  },
  en: {
    goals: [
      ['Shower twice a day', 'Morning and night'],
      /* "3 meals", pas "three meals": le francais ecrit "3x", et la version
         longue faisait tomber les points de suspension sur la carte
         Aujourd'hui, ou le libelle partage la rangee avec une pastille
         d'etat. Vu sur l'image anglaise, la francaise tenait. */
      ['Eat 3 meals a day', 'At mealtimes'],
      ['Revise biochemistry', 'Before bed', 'A photo of my notes'],
      ['Run three times a week'], ['Read twenty pages'],
      ['Call my mum on Sunday'], ['Tidy my room'],
      ['Prep my meals on Sunday'], ['Walk for 30 minutes'],
      ['Write three lines of journal'], ['Drink two litres of water'],
    ],
    events: ['Biochemistry', 'Statistics', 'Workout'],
    spend: ['Groceries', 'Transport', 'Coffee', 'Books', 'Phone', 'Going out'],
    fixed: ['Rent', 'Phone', 'Transport'],
    pay: 'Payday',
  },
}

const OWNERS = [ME, ME, ME, 'u2', 'u3', 'u4', 'u5', 'u2', 'u3', 'u4', 'u5']
const EXTRA = [{}, { target_per_cycle: 3 }, { proof_type: 'photo' }]

const goalsFor = (loc) =>
  TEXT[loc].goals.map(([commitment, when, proof], i) =>
    goal(`g${i + 1}`, OWNERS[i], commitment, {
      ...(EXTRA[i] ?? {}),
      ...(when ? { trigger_when: when } : {}),
      ...(proof ? { evidence_def: proof } : {}),
    }),
  )

/* Qui possede quoi. Les identifiants ne dependent pas de la langue, donc les
   check-ins, les cycles et le classement se construisent UNE fois: les deux
   series racontent la meme journee et un ecart entre elles serait un ecart de
   fixture, pas de traduction. */
const goalIdsOf = (id) => OWNERS.map((o, i) => (o === id ? `g${i + 1}` : null)).filter(Boolean)

/* Combien de jours chacun a coches sur les sept: une seule en tete, deux a
   egalite, personne a zero et personne au maximum. */
const DONE = { u1: 5, u2: 4, u3: 4, u4: 3, u5: 2 }
/**
 * Et AUJOURD'HUI est deja commence, pour moi et pour deux autres.
 *
 * La premiere serie de captures montrait "il en reste 7 sur 7" et "0/5 ont fait
 * le point": un produit que personne n'a encore touche. Une capture d'App Store
 * doit montrer une journee en cours, pas une journee vide, sinon elle vend un
 * formulaire.
 */
const TODAY_DONE = { u1: ['g1'], u2: ['g4', 'g8'], u3: ['g5'] }
const CHECKINS = []
const ITEMS = []
for (const [id] of PEOPLE) {
  const mine = goalIdsOf(id)
  for (let n = 0; n < DONE[id]; n += 1) {
    const cid = `ck-${id}-${n}`
    CHECKINS.push({ id: cid, user_id: id, group_id: GID, cycle_id: `cy${n}`, submitted_at: `${DAYS[n]}T10:00:00Z` })
    for (const g of mine) ITEMS.push({ id: `it-${cid}-${g}`, checkin_id: cid, goal_id: g, outcome: 'done', count_done: 1 })
  }
  const today = TODAY_DONE[id]
  if (!today) continue
  const cid = `ck-${id}-today`
  CHECKINS.push({ id: cid, user_id: id, group_id: GID, cycle_id: 'cy6', submitted_at: `${TODAY}T09:10:00Z` })
  for (const gid of today) ITEMS.push({ id: `it-${cid}-${gid}`, checkin_id: cid, goal_id: gid, outcome: 'done', count_done: 1 })
}

/**
 * Les memes reponses, IMBRIQUEES dans leur check-in.
 *
 * WeekStrip demande `checkins(..., checkin_items(...))`, un embed, alors que
 * GroupAnalytics lit la table a plat avec un checkin_id. Deux lecteurs, deux
 * formes, et le bouchon ne rendait que la seconde: la carte Aujourd'hui
 * affichait donc neuf lignes "Non enregistre" sur une journee ou la moitie
 * etait faite.
 */
for (const c of CHECKINS) {
  c.checkin_items = ITEMS.filter((i) => i.checkin_id === c.id).map(({ goal_id, outcome, count_done }) => ({
    goal_id, outcome, count_done, evidence: null, link_url: null, photo_url: null,
  }))
}

/**
 * Et les coches solo du jour, parce que la carte Aujourd'hui lit les DEUX
 * tables: goal_days pour ce qu'on note seul, checkin_items pour ce qui passe
 * par le groupe. C'est la correction de dayOutcomes.js, et une fixture qui ne
 * remplit qu'une des deux reproduit exactement le bogue qu'elle a corrige.
 */
const GOAL_DAYS = [
  { goal_id: 'g1', user_id: ME, on_date: TODAY, count_done: 1 },
  { goal_id: 'g2', user_id: ME, on_date: TODAY, count_done: 2 },
]

const STATUS = PEOPLE.flatMap(([id]) =>
  CYCLES.map((c, n) => ({
    user_id: id, group_id: GID, cycle_id: c.id, seq: n,
    status: n < DONE[id] || (n === 6 && TODAY_DONE[id]) ? 'submitted' : 'open',
    opens_at: c.opens_at, closes_at: c.closes_at,
  })),
)

/* L'eau: une bouteille de 40 oz, un quart de la cible bue. */
const PREF = {
  user_id: ME, water_on: true, water_target_ml: 2000, water_glass_ml: 1183, water_unit: 'oz',
  wake_min: 420, sleep_min: 1380, water_next_at: null,
  push_on: true, email_on: true, events_on: true, events_lead_min: 30,
}
const WATER = [{ id: 'w1', user_id: ME, on_day: TODAY, ml: 250 }, { id: 'w2', user_id: ME, on_day: TODAY, ml: 250 }]

/* Le calendrier: des cours, pour que la bande ne soit pas vide. */
const EVENT_SHAPE = [
  { id: 'e1', category: 'cours', location: 'B-204', start_min: 600, end_min: 720, weekdays: [1, 3], remind_min: 30 },
  { id: 'e2', category: 'cours', location: 'A-110', start_min: 840, end_min: 960, weekdays: [2, 4], remind_min: null },
  { id: 'e3', category: 'sport', location: null, start_min: 1080, end_min: 1200, weekdays: [1, 2, 4, 5], remind_min: null },
]
const eventsFor = (loc) =>
  EVENT_SHAPE.map((e, i) => ({
    ...e, user_id: ME, title: TEXT[loc].events[i],
    starts_on: '2026-09-01', until_on: null, colour: null, excluded_on: [],
  }))

const MOODS = [{ id: 'm1', user_id: ME, on_day: TODAY, moods: ['energized', 'neutral'] }]

/* Le budget: un mois credible, ni vide ni catastrophique. */
/* Les colonnes sont celles de 19_budget.sql: monthly_income_cents,
   savings_target_cents, period_start_day. La premiere version de cette fixture
   inventait income_cents et payday_day, donc le plan arrivait vide et l'ecran
   proposait de le configurer. */
const PLAN = {
  id: 'p1', user_id: ME, currency: 'CAD',
  monthly_income_cents: 240000, savings_target_cents: 30000, period_start_day: 1,
  created_at: '2026-06-01T00:00:00Z', updated_at: '2026-06-01T00:00:00Z',
}
const SPEND = [['groceries', 8450], ['transport', 3200], ['eating_out', 1875], ['other', 4200], ['bills', 4500], ['fun', 6300]]
const entriesFor = (loc) => {
  const out = SPEND.map(([category, cents], i) => ({
    id: `en${i}`, user_id: ME, kind: 'expense', amount_cents: cents, category, note: TEXT[loc].spend[i],
    happened_on: DAYS[i % DAYS.length], created_at: `${DAYS[i % DAYS.length]}T12:00:00Z`, excluded: false,
  }))
  /* Une paie au debut de la periode. Le plan porte deja le revenu mensuel, mais
     l'historique lit les entrees, et une page d'historique sans une seule
     rentree raconte un mois ou personne n'a ete paye. */
  out.push({
    id: 'en-pay', user_id: ME, kind: 'income', amount_cents: 240000, category: 'other',
    note: TEXT[loc].pay, happened_on: '2026-09-01', created_at: '2026-09-01T09:00:00Z', excluded: false,
  })
  return out
}
const CHARGES = [[95000, 1], [4500, 5], [9700, 5]]
const fixedFor = (loc) =>
  CHARGES.map(([amount_cents, due_day], i) => ({
    id: `f${i + 1}`, user_id: ME, label: TEXT[loc].fixed[i], amount_cents, due_day, paid_on: null,
  }))

/* --- ce qu'on tire ---------------------------------------------------------- */

/**
 * `into` amene un element a l'ecran avant la capture.
 *
 * Sans lui, la capture montre le HAUT de la page, et sur le tableau de groupe
 * le classement, qui est toute la promesse de cette diapo, est sous la ligne de
 * flottaison. Mesure sur la premiere serie: on voyait "0/5 ont fait le point"
 * et rien du classement.
 */
/**
 * Des mots d'INTERFACE, jamais des mots tapes par la personne.
 *
 * Un objectif ou une note de depense est traduit a la main dans TEXT, donc s'en
 * servir de temoin ne prouverait que la fixture. Ceux-ci viennent de i18n.jsx:
 * les voir sur un ecran veut dire que l'application a bien change de langue.
 * Ils sont compares en minuscules parce que innerText rend le texte deja mis en
 * capitales par la CSS.
 */
const WITNESS = {
  fr: ['aujourd', 'semaine', 'objectif', 'enregistr'],
  en: ['today', 'week', 'goal', 'recorded'],
}

const SHOTS = [
  { n: 1, name: 'goals', url: `/g/${GID}/goals`, title: 'Goals Dashboard' },
  { n: 2, name: 'budget', url: '/money', title: 'Budget Plan' },
  { n: 3, name: 'course', url: '/cours/riche-lentement/0.1', title: 'Course Reader' },
  { n: 4, name: 'home', url: '/', title: 'Home Dashboard', into: '[data-hook="week-strip"]' },
  { n: 5, name: 'board', url: `/g/${GID}`, title: 'Group Board', into: '[data-hook="analytics"]' },
]

/* --- le serveur ------------------------------------------------------------- */

let server = null
let base = process.env.SHOT_BASE
if (!base) {
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--host', '127.0.0.1', '--strictPort'], { stdio: 'ignore' })
  base = `http://127.0.0.1:${PORT}`
  const deadline = Date.now() + 20000
  for (;;) {
    try {
      const r = await fetch(base)
      if (r.ok) break
    } catch { /* pas encore la */ }
    if (Date.now() > deadline) {
      console.error('the preview server did not start. npm run build first?')
      server.kill()
      process.exit(2)
    }
    await new Promise((r) => setTimeout(r, 300))
  }
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
})

const problems = []

/**
 * LE FRANCAIS D'ABORD.
 *
 * C'est la langue du produit et celle de la personne qui le construit; l'anglais
 * est la traduction. L'ordre des dossiers dit laquelle des deux series fait
 * autorite quand elles ne racontent pas la meme chose.
 */
const LOCALES = ['fr', 'en']

for (const loc of LOCALES) {
  const dir = join(OUT, loc)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  const GOALS = goalsFor(loc)
  const EVENTS = eventsFor(loc)
  const ENTRIES = entriesFor(loc)
  const FIXED = fixedFor(loc)
  const ME_PROFILE = { ...PROFILE, locale: loc }

  console.log(`\n${loc}`)

  for (const shot of SHOTS) {
    const page = await browser.newPage({
      viewport: { width: WIDTH, height: HEIGHT },
      deviceScaleFactor: 2,
      hasTouch: true,
      isMobile: true,
    })
    await page.clock.install({ time: new Date(NOW) })
    await page.addInitScript(([me, lang]) => {
      const s = { access_token: 'stub', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'stub', user: { id: me, aud: 'authenticated', role: 'authenticated', email: 'hello@richandfriends.xyz', app_metadata: {}, user_metadata: {}, created_at: '2026-06-01T00:00:00Z' } }
      for (const k of ['sb-localhost-auth-token', 'sb-localhost-auth-token-code-verifier']) {
        try { localStorage.setItem(k, JSON.stringify(s)) } catch { /* ignore */ }
      }
      /* detectLocale() lit cette cle avant de regarder navigator.language. Sans
         elle, la serie anglaise sortirait dans la langue du conteneur. */
      try { localStorage.setItem('friends.locale', lang) } catch { /* ignore */ }
    }, [ME, loc])

    await page.route('**/auth/v1/**', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'x', user: { id: ME, email: 'hello@richandfriends.xyz' } }) }))
    await page.route('**/functions/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))

    await page.route('**/rest/v1/**', (route) => {
      const req = route.request()
      const url = req.url()
      const table = url.split('/rest/v1/')[1]?.split('?')[0]
      if (req.method() !== 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      }
      /**
       * LES TABLES LUES A UNE SEULE LIGNE RENDENT UN OBJET, TOUJOURS.
       *
       * La premiere version regardait l'en-tete Accept pour savoir s'il fallait
       * un objet ou un tableau. Mesure: `maybeSingle()` envoie `accept: * / *`,
       * pas l'en-tete objet de PostgREST. Le bouchon rendait donc `[PLAN]` la ou
       * le code attend une ligne, `plan.monthly_income_cents` valait undefined,
       * et l'ecran du budget annoncait "aucun revenu enregistre cette periode"
       * avec un reste a depenser NEGATIF, en rouge. Une capture d'App Store qui
       * dit a la personne qu'elle est dans le rouge.
       *
       * Trouve en regardant la capture, pas en lisant le code.
       */
      const SINGLE = { groups: GROUP, profiles: ME_PROFILE, notify_pref: PREF, budget_plan: PLAN }
      if (table in SINGLE) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SINGLE[table]) })
      }
      /* Le filtre owner_id=eq. est applique ici parce que la vraie requete
         l'applique cote serveur. Sans lui, la carte Aujourd'hui de l'accueil
         listait les objectifs des cinq personnes du groupe, ce qui n'arrive
         jamais dans l'application. Trouve en regardant la capture. */
      const owner = url.match(/owner_id=eq\.([^&]+)/)?.[1]
      const body = table === 'goals' ? (owner ? GOALS.filter((g) => g.owner_id === owner) : GOALS)
        : table === 'goal_days' ? GOAL_DAYS
        : table === 'cycles' ? CYCLES
        : table === 'checkins' ? CHECKINS
        : table === 'checkin_items' ? ITEMS
        : table === 'member_cycle_status' ? STATUS
        : table === 'group_members' ? (url.includes('user_id=eq.') ? ROSTER.filter((r) => r.user_id === ME) : ROSTER)
        : table === 'water_log' ? WATER
        : table === 'calendar_event' ? EVENTS
        : table === 'daily_mood' ? MOODS
        : table === 'budget_entry' ? ENTRIES
        : table === 'budget_fixed' ? FIXED
        : []
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    })

    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))

    await page.goto(`${base}${shot.url}`, { waitUntil: 'networkidle' })
    /* Le temps que les animations d'entree finissent: une capture prise a
       mi-transition montre une carte a 99 % d'opacite et decalee de dix pixels. */
    await page.waitForTimeout(1800)

    if (shot.into) {
      const found = await page.evaluate((sel) => {
        const el = document.querySelector(sel)
        if (!el) return false
        /**
         * La carte se pose JUSTE SOUS l'en-tete, et l'en-tete est mesure.
         *
         * Le recul etait un 132 ecrit a la main. Il laissait 60 px de trop, et
         * ces 60 px etaient occupes par le titre de la page, coupe en deux par
         * le verre de l'en-tete: "Bonjour, Anne-Kelly." tranche a l'horizontale
         * sur l'accueil, "CE QUI A ETE FAIT" illisible sur le tableau. Vu sur
         * les images, pas dans le code.
         *
         * `center` ne marche pas ici: centrer une carte courte la met sous
         * l'en-tete, et la barre d'onglets flottante mange le bas.
         */
        const head = document.querySelector('header')
        const under = (head ? head.getBoundingClientRect().bottom : 70) + 12
        const y = el.getBoundingClientRect().top + window.scrollY - under
        window.scrollTo({ top: Math.max(0, y), behavior: 'instant' })
        return true
      }, shot.into)
      if (!found) problems.push(`${loc}/${shot.name}: ${shot.into} introuvable, la capture montre le haut de la page`)
      await page.waitForTimeout(500)
    }

    const path = join(dir, `${shot.n}-${shot.name}.png`)
    await page.screenshot({ path })

    /* Une capture vide est pire qu'une capture manquante: elle passe inapercue
       jusqu'a ce qu'elle soit dans une fiche de store. */
    const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').trim()
    const empty = text.length < 120
    if (empty) problems.push(`${loc}/${shot.name}: l ecran est presque vide (${text.length} caracteres)`)
    if (errors.length) problems.push(`${loc}/${shot.name}: ${errors[0].slice(0, 120)}`)

    /**
     * ET LA LANGUE EST VERIFIEE, PAS SUPPOSEE.
     *
     * Une serie anglaise qui sort en francais est une serie qu'on ne remarque
     * qu'au moment de la deposer, parce que les cinq images sont belles. Le
     * temoin est un mot d'interface, pas un mot tape par la personne.
     */
    const hay = text.toLowerCase()
    const wrong = WITNESS[loc === 'fr' ? 'en' : 'fr'].filter((w) => hay.includes(w))
    if (wrong.length) problems.push(`${loc}/${shot.name}: du texte de l autre langue a l ecran (${wrong.join(', ')})`)
    /* I18nProvider ecrit la langue sur <html>. C'est la reponse de
       l'application elle-meme, la ou les temoins ne sont qu'un echantillon. */
    const lang = await page.evaluate(() => document.documentElement.lang)
    if (lang !== loc) problems.push(`${loc}/${shot.name}: <html lang="${lang}">, l application n a pas change de langue`)

    const bad = empty || errors.length || wrong.length || lang !== loc
    console.log(`  ${bad ? 'FAIL' : 'ok  '} ${String(shot.n)}. ${shot.title.padEnd(17)} ${path}`)
    await page.close()
  }
}

await browser.close()
if (server) server.kill()

console.log()
if (problems.length) {
  for (const p of problems) console.log(`  ${p}`)
  console.log(`\n${problems.length} probleme(s). Les images sont dans ${OUT}/, regarde-les.`)
  process.exit(1)
}
console.log(
  `${LOCALES.length * SHOTS.length} captures en ${WIDTH}x${HEIGHT} a 2x, ` +
  `${LOCALES.map((l) => `${OUT}/${l}/`).join(' puis ')}. Regarde-les avant de les utiliser.`,
)
