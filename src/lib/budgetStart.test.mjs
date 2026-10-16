/**
 * node src/lib/budgetStart.test.mjs
 *
 * La premiere visite du budget.
 *
 *   "When you go to the budget section and you never open the budget, you
 *    have the introduction. After the introduction, the first thing you
 *    should see is: 'Never done a budget before? Take these courses.' [...]
 *    The budget section should be actually funny and responsive."
 *
 * Ce qui est tenu ici: l'intro ne mene plus au formulaire du plan, l'ecran
 * qui suit ouvre sur les cours avec Budget 101 d'abord, chaque ecran de
 * l'intro a son titre, son mot surligne (present dans le titre, sinon le
 * surligneur disparait sans bruit) et sa phrase dans les deux langues, et le
 * sticker de la carte "Reste a depenser" suit l'etat du mois.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { HOT_PCT, spendMood } from './spendMood.js'
import { spendable } from './envelope.js'
import { COURSES } from '../content/courses.js'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}
const eq = (name, a, b) => ok(name, JSON.stringify(a) === JSON.stringify(b), `got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`)
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')

console.log('\nbudget start')

/* --- le sticker de la carte ---------------------------------------------- */
eq('no pay logged yet: the wallet', spendMood(spendable({ earned: 0, spent: 0 })), 'wallet')
eq('a coffee before the first pay is still the wallet, not an alarm', spendMood(spendable({ earned: 0, spent: 450 })), 'wallet')
eq('plenty left: CHACHING', spendMood(spendable({ earned: 320000, spent: 6700 })), 'chaching')
eq(`${HOT_PCT - 1} % spent is still fine`, spendMood(spendable({ earned: 10000, spent: (HOT_PCT - 1) * 100 })), 'chaching')
eq(`${HOT_PCT} % spent: the fire`, spendMood(spendable({ earned: 10000, spent: HOT_PCT * 100 })), 'fire')
eq('everything spent, not past it: still the fire', spendMood(spendable({ earned: 10000, spent: 10000 })), 'fire')
eq('past what came in: the skull on fire', spendMood(spendable({ earned: 10000, spent: 10001 })), 'skullfire')
eq('nothing at all is the wallet', spendMood(undefined), 'wallet')

const art = new Set(readdirSync(new URL('../assets/stickers/', import.meta.url)).filter((f) => f.endsWith('.png')).map((f) => f.replace(/\.png$/, '')))
for (const name of ['wallet', 'chaching', 'fire', 'skullfire']) ok(`the card's ${name} sticker exists`, art.has(name))

/* --- l'intro ne mene plus au formulaire ----------------------------------- */
const money = read('../pages/Money.jsx')
const finish = money.slice(money.indexOf('const finish ='), money.indexOf('<BudgetIntro'))
ok('the intro marks itself seen', /has_seen_budget_intro: true/.test(finish))
ok('and no longer opens the plan form', !/setEditing\(true\)/.test(finish), 'it landed on a form at 0.00 for somebody who had never made a budget')
ok('both ways out land in the same place', /<BudgetIntro onDone=\{finish\} onSkip=\{finish\} \/>/.test(money))

/* --- l'ecran qui suit: les cours d'abord --------------------------------- */
const start = money.slice(money.indexOf('function BudgetStart'), money.indexOf('export default function Money'))
ok('with no plan the page is BudgetStart', /if \(!s\.ready\)[\s\S]{0,200}<BudgetStart onStart=/.test(money))
ok('it opens on the question', /headline\(t\('bstart\.title'\), t\('bstart\.mark'\)/.test(start))
ok('the courses come before the setup card', start.indexOf('<BudgetCourses') > 0 && start.indexOf('<BudgetCourses') < start.indexOf('budget-setup'))
ok('and the setup is still one tap away', /data-hook="budget-setup-go"/.test(start) && /onClick=\{onStart\}/.test(start))
ok('it is a column page, capped above md', /<Screen className="column-page">\s*<BudgetStart/.test(money))

const courses = read('../components/BudgetCourses.jsx')
ok('Budget 101 leads', /COURSES\.find\(\(c\) => c\.slug === 'budget-101'\)/.test(courses))
ok('Budget 101 exists in the catalogue', COURSES.some((c) => c.slug === 'budget-101'))
ok('and it is first there too', COURSES[0]?.slug === 'budget-101')
ok('every course gets a card that goes to its summary', /to=\{`\/cours\/\$\{lead\.slug\}`\}/.test(courses) && /to=\{`\/cours\/\$\{c\.slug\}`\}/.test(courses))
ok('the cards carry their slug, not a position', (courses.match(/data-slug=/g) ?? []).length === 2)
const courseArt = [...courses.matchAll(/'([a-z0-9-]+)': '([a-z]+)'/g)]
for (const c of COURSES) ok(`${c.slug} has a sticker that exists`, courseArt.some(([, slug, name]) => slug === c.slug && art.has(name)))
ok('the three small tiles sit side by side from sm, never a full-width stack', /grid gap-3 sm:grid-cols-3/.test(courses))
ok('a tile sticker is held in a fixed frame', /relative block h-14 w-14 shrink-0 sm:h-20 sm:w-20/.test(courses), 'the cactus came down over "Rich, slowly" at 1180')

/* --- "Suivre la formation" ouvre le cours -------------------------------- */
ok('the course card on the dashboard opens Budget 101', /id === 'formation' \? navigate\('\/cours\/budget-101'\)/.test(money))

/* --- les ecrans de l'intro, dans les deux langues ------------------------ */
const intro = read('../components/BudgetIntro.jsx')
const keys = [...intro.matchAll(/\{ key: '([a-z]+)', ground: '([a-z]+)', art: '([a-z]+)'/g)].map(([, key, ground, a]) => ({ key, ground, art: a }))
eq('six screens, the six ideas of the first intro', keys.map((k) => k.key), ['mindset', 'plan', 'track', 'amplify', 'habits', 'freedom'])
for (const k of keys) ok(`${k.key}: its sticker exists`, art.has(k.art))
ok('the screens are brand grounds only', keys.every((k) => ['pink', 'sea', 'yellow', 'blush'].includes(k.ground)))
ok('the pink is the logo pink and the blue the logo turquoise', /pink: \{ bg: '#FF007A'/.test(intro) && /sea: \{ bg: '#009DB9'/.test(intro))
ok('no black text on the pink or the turquoise: their titles are white', /sg\.dark \? 'text-white' : 'text-ink'/.test(intro))
ok('the marked word is ink, on its band', /<span className="marker text-ink">/.test(intro))
ok('on the yellow screen the band is white, not yellow on yellow', /yellow: \{ bg: '#FFD60A', dark: false, tape: '[0-9 ]+', mark: '#FFFFFF' \}/.test(intro))
ok('tapping the last screen does not finish it', /else if \(n < SLIDES\.length - 1\) go\(n \+ 1\)/.test(intro))
ok('the arrows and Escape work', /ArrowRight/.test(intro) && /ArrowLeft/.test(intro) && /Escape/.test(intro))
ok('it is a dialog with a name', /role="dialog"/.test(intro) && /aria-modal="true"/.test(intro) && /aria-label=\{t\('intro\.label'\)\}/.test(intro))
ok('reduced motion: no smooth scroll', /prefers-reduced-motion: reduce/.test(intro))

const dict = read('./i18n.jsx')
const split = dict.indexOf('\n  fr: {')
const langs = { en: dict.slice(0, split), fr: dict.slice(split) }
const value = (src, k) => {
  const m = src.match(new RegExp(`'${k.replace(/\./g, '\\.')}':\\s*'([^']*)'`))
  return m ? m[1] : null
}
for (const [lang, src] of Object.entries(langs)) {
  for (const k of keys) {
    const title = value(src, `intro.${k.key}_title`)
    const mark = value(src, `intro.${k.key}_mark`)
    const body = value(src, `intro.${k.key}_body`)
    ok(`${lang} ${k.key}: title, mark and line`, Boolean(title && mark && body))
    ok(`${lang} ${k.key}: the marked words are in the title`, Boolean(title && mark && title.includes(mark)), `"${mark}" not in "${title}"`)
  }
  for (const k of ['intro.label', 'intro.back', 'intro.start', 'bstart.title', 'bstart.mark', 'bstart.lede', 'bstart.first', 'bstart.meta', 'bstart.go', 'bstart.then', 'bstart.setup_title', 'bstart.setup']) {
    ok(`${lang} ${k}`, value(src, k) !== null)
  }
  ok(`${lang}: the question is marked`, (value(src, 'bstart.title') ?? '').includes(value(src, 'bstart.mark') ?? '\u0000'))
  ok(`${lang}: the course card names the course`, /\{title\}/.test(value(src, 'bstart.go') ?? ''))
  ok(`${lang}: modules and lessons are counted`, /\{modules\}/.test(value(src, 'bstart.meta') ?? '') && /\{lessons\}/.test(value(src, 'bstart.meta') ?? ''))
}
const added = [...dict.matchAll(/'(?:intro|bstart)\.[a-z_]+':\s*'([^']*)'/g)].map((m) => m[1]).join('\n')
ok('no em dash in any of it', !/—/.test(added))
ok('French punctuation keeps its thin space', /budget \?/.test(value(langs.fr, 'bstart.title') ?? ''))

console.log(`  ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
