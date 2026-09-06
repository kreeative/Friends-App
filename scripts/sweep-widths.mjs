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
const WIDTHS = (process.env.SWEEP_WIDTHS ?? '390,820,1180,1440').split(',').map(Number)
const ROUTES = (
  process.env.SWEEP_ROUTES ??
  '/,/goals,/goals/new,/money,/library,/library?shelf=articles,/calendar,/settings,/profile,/notifications,/cours,/cours/investir-101,/cours/carte-de-credit/c2.2'
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
  await page.route('**/rest/v1/**', (route) => {
    const req = route.request()
    if (req.method() !== 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    const url = req.url()
    const one = (req.headers().accept ?? '').includes('object')
    const rows = url.includes('/rpc/') ? []
      : url.includes('profiles') ? [PROFILE]
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
