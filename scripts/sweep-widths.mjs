#!/usr/bin/env node
/**
 * npm run build && npm run sweep
 *
 * Every signed-in page at a phone, an iPad held both ways and a laptop:
 * screenshotted, measured, and FAILED when it is a phone layout stretched.
 *
 * WHY THIS EXISTS.
 *
 * "Est-ce qu'on pourrait travailler sur l'adaptation pour la version iPad et
 * ordinateur sans avoir besoin de demander." Every page here was verified on
 * a 390px screen because that is what the person building it was looking at,
 * and iPad and laptop were found by the person using it. The failure mode of
 * a wide screen is not an error: it is a card 1030px wide that still works,
 * so nothing reports it. This does.
 *
 * WHAT COUNTS AS A FAILURE, and every one is a measurement, not a class read:
 *
 *   sideways     the document scrolls horizontally at any width
 *   prose        a paragraph that WRAPS is wider than 800px (about 75ch)
 *   input        a text input is wider than 40rem
 *   stack        above md, three or more sibling cards each wider than 720px
 *                stacked in one column: a phone list with the width released
 *   spread       above md, four or more cards on the page and every one of
 *                them spans the page: one column where there is room for two
 *   errors       an uncaught exception on the page
 *
 * Screenshots go to .sweep/<route>-<width>.png. LOOK AT THEM. The numbers say
 * where to look; they do not say the page is good.
 *
 * Needs the playwright devDependency and a Chromium: `npx playwright install
 * chromium` once per machine (PLAYWRIGHT_BROWSERS_PATH is honoured). Data is
 * stubbed at the network edge, so nothing here touches Supabase.
 *
 * Env:
 *   SWEEP_BASE    reuse a running preview instead of starting one
 *   SWEEP_ROUTES  comma-separated routes
 *   SWEEP_WIDTHS  comma-separated widths, default 390,820,1180,1440
 *   SWEEP_OUT     screenshot folder, default .sweep
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const OUT = process.env.SWEEP_OUT ?? '.sweep'
/**
 * 320 EST ENTRE AVEC LE RETRAIT DE `overflow-x: clip` SUR `.ground`.
 *
 * C'est la largeur ou le defaut d'origine s'etait vu: un sticker qui
 * s'echappait ajoutait sept pixels de defilement lateral sur un ecran de
 * 320px, et personne ne balayait cette largeur, donc la seule parade avait ete
 * une coupe sur toute la page. La coupe est partie; l'instrument arrive.
 *
 * 320 est aussi le plus petit ecran qu'on rencontre encore (un iPhone SE de
 * premiere generation), donc ce n'est pas une largeur inventee pour le test.
 */
const WIDTHS = (process.env.SWEEP_WIDTHS ?? '320,390,820,1180,1440').split(',').map(Number)
const ROUTES = (
  process.env.SWEEP_ROUTES ??
  '/,/goals,/goals/new,/money,/library,/library?shelf=articles,/calendar,/settings,/profile,/notifications,/cours,/cours/investir-101,/cours/carte-de-credit/c2.2' +
    /* Hakkilo: its public page and pricing, then the app. */
    ',/hakkilo,/hakkilo/tarifs,/hakkilo/app,/hakkilo/cours,/hakkilo/cours/nouveau,/hakkilo/cours/bbc00001-0000-4000-8000-000000000000,/hakkilo/cours/bbc00001-0000-4000-8000-000000000000/fiches,/hakkilo/cours/bbc00001-0000-4000-8000-000000000000/banque,/hakkilo/session/bbc00001-0000-4000-8000-000000000000,/hakkilo/coach/bbc00001-0000-4000-8000-000000000000,/hakkilo/plan,/hakkilo/profil' +
    /* Phase 2: the mock exam, the case lab, the visuals, and the TikTok page. */
    ',/hakkilo/examen/bbc00001-0000-4000-8000-000000000000,/hakkilo/cours/bbc00001-0000-4000-8000-000000000000/examen,/hakkilo/cours/bbc00001-0000-4000-8000-000000000000/cas,/hakkilo/cours/bbc00001-0000-4000-8000-000000000000/schemas,/hakkilo/go'
).split(',')
const PORT = 4187

let chromium
try {
  ;({ chromium } = await import('playwright'))
} catch {
  console.error('playwright is not installed: npm install, then npx playwright install chromium')
  process.exit(2)
}

/* Enough data for the pages to lay themselves out. An empty page measures
   nothing: the goals page with no goals is a heading and a button. */
const ME = 'u1'
const GOALS = [
  { id: 'g1', commitment: 'Rendre le memoire de biochimie avant la fin du semestre', kind: 'personal', status: 'active', cadence: 'once', due_on: '2026-09-18', owner_id: ME, group_id: null, goal_type: 'outcome', starts_on: '2026-08-01', target_per_cycle: 1, remind: false },
  { id: 'g2', commitment: 'Courir trois fois par semaine', kind: 'personal', status: 'active', cadence: 'recurring', due_on: null, owner_id: ME, group_id: null, goal_type: 'process', starts_on: '2026-08-01', target_per_cycle: 1, active_days: [1, 3, 5], remind: true },
  { id: 'g3', commitment: 'Lire vingt pages', kind: 'personal', status: 'active', cadence: 'recurring', due_on: null, owner_id: ME, group_id: null, goal_type: 'process', starts_on: '2026-08-01', target_per_cycle: 1, active_days: null, remind: false },
]
const EVENTS = [
  { id: 'e1', user_id: ME, title: 'Biochimie', category: 'cours', location: 'B-204', starts_on: '2026-09-01', start_min: 600, end_min: 720, weekdays: [2, 4], until_on: null, colour: null, excluded_on: [], remind_min: null },
]
const PROFILE = { id: ME, display_name: 'Ann', locale: 'fr', email: 'ann@example.test', currency: 'CAD', timezone: 'UTC', setup_done_at: '2026-01-01T00:00:00Z', solo_mode: true }

/* Beauty & Brain: one course, two chapters, a few questions, enough for every
   page to lay itself out (the full fixture lives with the probes). */
const BB = (() => {
  const id = (p, n) => `${p}${String(n).padStart(5, '0')}-0000-4000-8000-000000000000`
  const C = id('bbc', 1)
  const A = (n) => id('bba', n)
  const K = (n) => id('bbk', n)
  const CH = (n) => id('bbh', n)
  const M = id('bbm', 1)
  const anchors = ['diapo 6', 'diapo 9', '14:32', '22:40'].map((label, i) => ({ id: A(i + 1), user_id: ME, course_id: C, material_id: M, label, excerpt: `Extrait ${i + 1} du cours, mot pour mot, assez long pour passer a la ligne sur un telephone.`, created_at: '2026-09-01T00:00:00Z' }))
  const concepts = ['Membrane plasmique', 'Osmose', 'Diffusion facilitee', 'Transport actif'].map((name, i) => ({ id: K(i + 1), user_id: ME, course_id: C, chapter_id: CH(i < 1 ? 1 : 2), name, definition: `La definition de ${name} dans les mots de la prof.`, definition_anchor: A(i + 1), kind: 'definition', anchor_ids: [A(i + 1)], weight: i === 1 ? 3 : 1, position: i }))
  const flash = concepts.map((c, i) => ({ id: id('bbi', i + 1), user_id: ME, course_id: C, chapter_id: c.chapter_id, concept_id: c.id, type: 'flash', bloom: 1, stem: c.name, options: [], answer: { text: c.definition }, anchor_ids: [c.definition_anchor], outside: false, quality: 'pass', source: 'concept' }))
  const mcq = [1, 2].map((n) => ({ id: id('bbq', n), user_id: ME, course_id: C, chapter_id: CH(2), concept_id: K(4), type: 'mcq', bloom: 3, stem: 'Une cellule fait entrer du glucose contre son gradient, et tout s arrete quand on bloque la production d ATP. De quel mecanisme s agit-il?', options: ['Diffusion simple', 'Diffusion facilitee', 'Transport actif', 'Osmose'].map((text, i) => ({ text, why: i === 2 ? 'Contre le gradient, avec de l ATP.' : 'Ce mecanisme suit le gradient.', anchor: A(4), outside: false })), answer: { index: 2 }, explanation: 'Deux indices.', anchor_ids: [A(4)], outside: false, quality: n === 2 ? 'revised' : 'pass', revision_note: n === 2 ? 'Un distracteur corrige.' : null, source: 'ai' }))
  return {
    bb_profiles: [{ user_id: ME, first_name: 'Ann', school: 'Universite de Montreal', level: 'uni_2', program: 'Biologie', language: 'fr', weekly_hours: 8, goal: 'a', onboarded_at: '2026-08-01T00:00:00Z' }],
    bb_courses: [{ id: C, user_id: ME, name: 'Biologie cellulaire', code: 'BIO 1101', professor: 'Pr Tremblay', language: 'fr', exam_at: '2026-09-14T13:00:00Z', exam_format: {}, stats: {}, created_at: '2026-09-01T00:00:00Z' }],
    bb_chapters: [{ id: CH(1), user_id: ME, course_id: C, position: 0, title: 'La membrane plasmique', summary: 'Structure et proteines.', items_ready: true }, { id: CH(2), user_id: ME, course_id: C, position: 1, title: 'Le transport membranaire', summary: null, items_ready: false }],
    bb_materials: [{ id: M, user_id: ME, course_id: C, kind: 'slides', file_name: 'Cours 3 - La membrane.pdf', status: 'ready', pages: 42, created_at: '2026-09-01T00:00:00Z' }],
    bb_anchors: anchors,
    bb_concepts: concepts,
    bb_twins: [{ id: id('bbt', 1), user_id: ME, course_id: C, a_concept: K(3), b_concept: K(4), separator: 'La seule question: est-ce qu on va contre le gradient?', anchor_ids: [A(4)] }],
    bb_signals: [{ id: id('bbs', 1), user_id: ME, course_id: C, concept_id: K(2), quote: 'Ca, je le demande a chaque examen.', anchor_id: A(3), strength: 3 }],
    bb_items: [...flash, ...mcq],
    bb_schedule: [{ user_id: ME, item_id: flash[1].id, course_id: C, stability: 2, difficulty: 5, due: '2026-09-02T09:00:00Z', reps: 2, lapses: 0, state: 'review', last_review: '2026-08-30T09:00:00Z' }],
    bb_mistakes: [{ id: id('bbx', 1), user_id: ME, course_id: C, item_id: mcq[0].id, concept_id: K(4), misconception: 'Ce mecanisme suit le gradient.', confident: true, right_streak: 1, last_right_on: '2026-09-02', resolved_at: null, created_at: '2026-09-01T00:00:00Z' }],
    bb_reviews: [{ item_id: mcq[0].id, concept_id: K(4), rating: 1, confidence: 'sure', correct: false, bloom: 3, mode: 'due', created_at: '2026-09-01T10:00:00Z' }],
    bb_sessions: [{ id: id('bbz', 1), user_id: ME, course_id: C, minutes: 15, started_at: '2026-09-02T10:00:00Z', answered: 10, correct: 7 }],
    bb_coach_messages: [{ role: 'user', content: 'C est quoi la difference entre diffusion facilitee et transport actif?', created_at: '2026-09-02T10:00:00Z' }, { role: 'assistant', content: `A ton avis, lequel des deux va contre le gradient? Ta prof le dit [${A(4).replace(/-/g, '').slice(0, 8)}].`, created_at: '2026-09-02T10:01:00Z' }],
    bb_blueprints: [],
    bb_exams: [{ id: id('bbe', 1), user_id: ME, course_id: C, minutes: 30, item_ids: mcq.map((q) => q.id), answers: { [mcq[0].id]: 2, [mcq[1].id]: 0 }, score: 1, total: 2, by_chapter: [{ chapter_id: CH(2), title: 'Le transport membranaire', right: 1, total: 2, pct: 50 }], by_bloom: [{ bloom: 3, right: 1, total: 2, pct: 50 }], started_at: '2026-09-02T18:00:00Z', ended_at: '2026-09-02T18:24:00Z' }],
    bb_cases: [{ id: id('bbk', 90), user_id: ME, course_id: C, chapter_ids: [CH(1), CH(2)], title: 'Le laboratoire qui manque d ATP', body: 'Une biologiste observe des cellules dont la production d ATP chute apres un traitement. Le glucose continue d entrer pendant quelques minutes, puis tout s arrete.\n\nSon equipe hesite: certaines y voient une diffusion facilitee, d autres un transport actif. Le budget ne permet qu une seule experience de controle.', exhibits: [{ title: 'Entree du glucose', columns: ['Minute', 'Glucose entre (u)', 'ATP (%)'], rows: [['0', '120', '100'], ['5', '60', '40'], ['10', '0', '5']] }], questions: [{ prompt: 'Quel mecanisme explique les donnees, et quelle experience recommandes-tu?', points: 10 }], rubric: [{ criterion: 'Notions nommees', points: 3, looks_for: 'Transport actif et gradient', anchor_ids: [A(4)] }, { criterion: 'Preuves tirees du cas', points: 3, looks_for: 'Les chiffres du tableau', anchor_ids: [A(3)] }, { criterion: 'Recommandation justifiee', points: 4, looks_for: 'Une experience qui tranche', anchor_ids: [A(4)] }], model_answer: `Le glucose cesse d entrer quand l ATP tombe [${A(4).replace(/-/g, '').slice(0, 8)}], donc transport actif.`, anchor_ids: [A(3), A(4)], outside_note: 'Le laboratoire est invente.', created_at: '2026-09-02T12:00:00Z' }],
    bb_case_attempts: [],
    bb_visuals: [
      { id: id('bbv', 1), user_id: ME, course_id: C, chapter_id: CH(2), kind: 'steps', title: 'Le transport actif, pas a pas', data: { columns: [], nodes: [{ label: 'La proteine fixe le glucose', detail: 'Du cote pauvre en glucose', anchor: A(4) }, { label: 'L ATP change sa forme', detail: '', anchor: A(4) }, { label: 'Le glucose passe de l autre cote', detail: 'Contre le gradient', anchor: A(3) }] }, anchor_ids: [A(3), A(4)], created_at: '2026-09-02T12:00:00Z' },
      { id: id('bbv', 2), user_id: ME, course_id: C, chapter_id: CH(2), kind: 'table', title: 'Diffusion facilitee ou transport actif', data: { columns: ['', 'Gradient', 'Energie'], nodes: [{ label: 'Diffusion facilitee', detail: '', cells: ['Le suit', 'Aucune'], anchor: A(3) }, { label: 'Transport actif', detail: '', cells: ['Le remonte', 'ATP'], anchor: A(4) }] }, anchor_ids: [A(3), A(4)], created_at: '2026-09-02T12:00:00Z' },
      { id: id('bbv', 3), user_id: ME, course_id: C, chapter_id: CH(1), kind: 'matrix', title: 'Ce qui traverse la membrane', data: { columns: ['Petit', 'Gros', 'Apolaire', 'Polaire'], nodes: [{ label: 'O2', detail: 'Passe seul', x: 0, y: 0, anchor: A(1) }, { label: 'Glucose', detail: 'Il lui faut une proteine', x: 1, y: 1, anchor: A(2) }] }, anchor_ids: [A(1), A(2)], created_at: '2026-09-02T12:00:00Z' },
      { id: id('bbv', 4), user_id: ME, course_id: C, chapter_id: CH(1), kind: 'tree', title: 'Les proteines membranaires', data: { columns: [], nodes: [{ label: 'Proteines membranaires', detail: '', parent: null, anchor: A(1) }, { label: 'Integrees', detail: 'Traversent la bicouche', parent: 0, anchor: A(1) }, { label: 'Peripheriques', detail: 'Posees a la surface', parent: 0, anchor: A(2) }] }, anchor_ids: [A(1), A(2)], created_at: '2026-09-02T12:00:00Z' },
    ],
    bb_plan_days: [{ id: id('bbp', 1), user_id: ME, course_id: C, on_date: '2026-09-01', kind: 'study', minutes: 40, event_id: null, done_at: null }],
    bb_squad_share: [{ group_id: 'grp1', user_id: ME, shared: true }],
  }
})()
const BB_SQUAD = [
  { user_id: 'u2', name: 'Maya', minutes_week: 140, sessions_week: 9, streak: 5, me: false },
  { user_id: ME, name: 'Ann', minutes_week: 95, sessions_week: 6, streak: 3, me: true },
]
const BB_STATUS = { tier: 'free', plan: 'free', status: null, current_period_end: null, cancel_at_period_end: false, limits: { courses: 1, chapters: 3, ingest: 6, generate: 6, coach: 10, grade: 15 }, used: { ingest: 1, generate: 2, coach: 3, grade: 0 }, resetsAt: '2026-09-04T00:00:00Z', courses: 1, prepared: 1, ready: { model: true, billing: true }, cost: null }

/* A preview server, unless one is offered. */
let server = null
let base = process.env.SWEEP_BASE
if (!base) {
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--host', '127.0.0.1', '--strictPort'], { stdio: 'ignore' })
  base = `http://127.0.0.1:${PORT}`
  const deadline = Date.now() + 20000
  for (;;) {
    try {
      const res = await fetch(base)
      if (res.ok) break
    } catch { /* not up yet */ }
    if (Date.now() > deadline) {
      console.error(`no preview on ${base} after 20s: did you run npm run build?`)
      server.kill()
      process.exit(2)
    }
    await new Promise((r) => setTimeout(r, 250))
  }
}
const stop = () => { if (server) server.kill() }
process.on('exit', stop)

mkdirSync(OUT, { recursive: true })

/**
 * Which Chromium.
 *
 * Playwright wants the exact build it was released with, and a machine that
 * ships its own Chromium (the remote container does, under /opt/pw-browsers)
 * will not have that build. So: playwright's own first; failing that,
 * SWEEP_CHROME, then the machine's binaries in the order they are likely to
 * exist. A missing browser used to kill the sweep before it measured
 * anything, with a banner telling you to download a second Chromium.
 */
async function launch() {
  const args = ['--no-sandbox']
  const own = await chromium.launch({ args }).catch(() => null)
  if (own) return own
  const candidates = [
    process.env.SWEEP_CHROME,
    '/opt/pw-browsers/chromium',
    ...(existsSync('/opt/pw-browsers') ? readdirSync('/opt/pw-browsers', { withFileTypes: true }) : [])
      .filter((d) => d.isDirectory() && d.name.startsWith('chromium-'))
      .map((d) => `/opt/pw-browsers/${d.name}/chrome-linux/chrome`),
  ].filter((p) => p && existsSync(p) && statSync(p).isFile())
  for (const executablePath of candidates) {
    const b = await chromium.launch({ args, executablePath }).catch(() => null)
    if (b) return b
  }
  console.error('no Chromium: npx playwright install chromium, or SWEEP_CHROME=/path/to/chrome')
  process.exit(2)
}
const browser = await launch()

/**
 * UN BALAYAGE QUI N'EST PAS CONNECTE MESURE LE SITE PUBLIC, ET PASSE.
 *
 * La session est posee sous sb-localhost-auth-token, la cle que supabase-js
 * lit quand l'app parle a localhost. Un build fait sans les variables du stub
 * (un simple `npm run build`) donne une app "non configuree" qui ne sert que
 * les pages publiques, meme avec une session; un build qui pointe vers la
 * vraie base ne lit pas cette cle. Dans les deux cas chaque route s'ouvrait
 * sur la page d'accueil publique, les mesures etaient celles de cette page,
 * et le balayage annoncait "0 failed" sur 65 captures de la mauvaise page.
 * Vu le 15 octobre.
 *
 * Les pages connectees sont dans AppShell, qui porte data-hook="app-shell".
 * Une route qui s'ouvre sans lui n'a pas ete mesuree: on s'arrete et on dit
 * quoi faire, plutot que de compter des pages qui n'ont pas ete vues. Seul le
 * lecteur (/library/<livre>) vit hors de la coquille, par choix.
 */
const UNSIGNED =
  'not signed in, so this would measure the public site. Build against the stub first:\n' +
  '    VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=stub-anon npm run build'
const READER = /^\/library\/[^/?]+/
/* The public pages of Hakkilo: measured like the rest, but outside any app shell. */
const BB_PUBLIC = /^\/hakkilo(\/tarifs|\/pricing|\/go)?$/

async function open(width) {
  const ctx = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  await page.clock.install({ time: new Date('2026-09-03T09:00:00') })
  await page.addInitScript((me) => {
    const session = {
      access_token: 'stub', token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'stub',
      user: { id: me, aud: 'authenticated', role: 'authenticated', email: 'ann@example.test',
              app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
    }
    for (const k of ['sb-localhost-auth-token', 'sb-localhost-auth-token-code-verifier']) {
      try { localStorage.setItem(k, JSON.stringify(session)) } catch { /* ignore */ }
    }
    try {
      localStorage.setItem('friends.locale', 'fr')
      localStorage.setItem(`friends.solo.${me}`, '1')
    } catch { /* ignore */ }
  }, ME)
  await page.route('**/auth/v1/**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'x', user: { id: ME, email: 'ann@example.test' } }) }))
  await page.route('**/functions/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.route('**/api/bb/**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('/api/bb/status') ? BB_STATUS : { done: true, added: 0, rejected: 0 }) }))
  await page.route('**/rest/v1/**', (route) => {
    const req = route.request()
    /* supabase.rpc() posts. */
    if (req.url().includes('/rpc/bb_squad_effort')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BB_SQUAD) })
    if (req.method() !== 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    const url = req.url()
    const one = (req.headers().accept ?? '').includes('object')
    const table = url.split('/rest/v1/')[1]?.split('?')[0] ?? ''
    const rows = url.includes('/rpc/') ? []
      /* Before `profiles`: bb_profiles contains the word. */
      : table.startsWith('bb_') ? BB[table] ?? []
      : url.includes('profiles') ? [PROFILE]
      : table === 'group_members' ? [{ group_id: 'grp1', role: 'member', groups: { id: 'grp1', name: 'Les etudes du jeudi' } }]
      : url.includes('goals') ? GOALS
      : url.includes('calendar_event') ? EVENTS
      : []
    return route.fulfill({
      status: 200, contentType: 'application/json',
      headers: { 'access-control-expose-headers': 'Content-Range' },
      body: JSON.stringify(one ? (rows[0] ?? null) : rows),
    })
  })
  return page
}

const bad = []
console.log(`\nsweep of ${ROUTES.length} routes at ${WIDTHS.join(', ')}px\n`)
for (const W of WIDTHS) {
  console.log(`  ${W}px`)
  console.log('    route                          input   prose   sideways  stack  spread  errors')
  const page = await open(W)
  for (const route of ROUTES) {
    const errors = []
    const onErr = (e) => errors.push(String(e))
    page.on('pageerror', onErr)
    await page.goto(`${base}${route}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(600)
    if (!READER.test(route) && !BB_PUBLIC.test(route) && (await page.locator('[data-hook="app-shell"]').count()) === 0) {
      console.log(`\n  ${W}px ${route}: ${UNSIGNED}\n`)
      await browser.close()
      stop()
      process.exit(1)
    }

    const r = await page.evaluate((w) => {
      const vis = (el) => {
        const b = el.getBoundingClientRect()
        return b.width > 0 && b.height > 0 && el.offsetParent !== null
      }
      const label = (el) => (el.textContent || el.getAttribute('placeholder') || el.tagName).trim().slice(0, 40)
      const widest = (sel, only = () => true) => {
        let max = 0
        let what = ''
        for (const el of document.querySelectorAll(sel)) {
          if (!vis(el) || !only(el)) continue
          const b = el.getBoundingClientRect()
          if (b.width > max) { max = b.width; what = label(el) }
        }
        return { w: Math.round(max), what }
      }
      /* A paragraph that wraps. One short line inside a wide card is not a
         reading problem, however wide its box is. */
      const wraps = (el) => {
        const cs = getComputedStyle(el)
        const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4
        return el.getBoundingClientRect().height > lh * 1.6
      }
      const CARD = '.lg, .card, [data-card]'
      const cards = [...document.querySelectorAll(CARD)].filter(vis)
      const shell = document.querySelector('.shell')
      const room = shell ? shell.getBoundingClientRect().width : w
      const stacks = []
      let spread = ''
      if (w >= 768) {
        const parents = new Set(cards.map((c) => c.parentElement))
        for (const p of parents) {
          const kids = [...p.children].filter((k) => k.matches(CARD) && vis(k))
          if (kids.length < 3) continue
          const boxes = kids.map((k) => k.getBoundingClientRect())
          const wide = boxes.every((b) => b.width > 720)
          const stacked = boxes.every((b, i) => i === 0 || b.top >= boxes[i - 1].bottom - 1)
          if (wide && stacked) stacks.push(`${kids.length} cards x ${Math.round(boxes[0].width)}px`)
        }
        if (cards.length >= 4 && room > 900) {
          const span = cards.filter((c) => c.getBoundingClientRect().width > room * 0.85).length
          if (span === cards.length) spread = `${cards.length} cards, all ${Math.round(room)}px wide`
        }
      }
      return {
        input: widest('input:not([type="checkbox"]):not([type="radio"]), textarea, select'),
        prose: widest('p, li', wraps),
        sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        stacks,
        spread,
      }
    }, W)
    page.off('pageerror', onErr)

    const name = route.replace(/[/?=]+/g, '-').replace(/^-|-$/g, '') || 'home'
    await page.screenshot({ path: join(OUT, `${name}-${W}.png`), fullPage: true })

    const fails = []
    if (r.sideways) fails.push('sideways')
    if (r.prose.w > 800) fails.push(`prose ${r.prose.w}px "${r.prose.what}"`)
    if (r.input.w > 640) fails.push(`input ${r.input.w}px "${r.input.what}"`)
    for (const s of r.stacks) fails.push(`stack ${s}`)
    if (r.spread) fails.push(`spread ${r.spread}`)
    if (errors.length) fails.push(`error ${errors[0].slice(0, 100)}`)
    for (const f of fails) bad.push(`${W}px ${route}: ${f}`)

    console.log(
      `    ${route.padEnd(30)} ${String(r.input.w).padStart(5)}px ${String(r.prose.w).padStart(5)}px` +
        `   ${r.sideways ? 'YES' : 'no '}      ${String(r.stacks.length).padStart(3)}    ${r.spread ? 'YES' : 'no '}     ${errors.length || ''}` +
        (fails.length ? `   <- ${fails.join('; ')}` : ''),
    )
  }
  await page.context().close()
  console.log('')
}

await browser.close()
stop()

if (bad.length) {
  console.log(`  ${bad.length} failed:\n`)
  for (const b of bad) console.log(`    ${b}`)
  console.log(`\n  screenshots in ${OUT}/\n`)
  process.exit(1)
}
console.log(`  0 failed. Screenshots in ${OUT}/, look at them.\n`)
