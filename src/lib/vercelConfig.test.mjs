/**
 * node src/lib/vercelConfig.test.mjs
 *
 * WHY THIS FILE EXISTS.
 *
 * vercel.json was pushed with a "//" key holding an explanation, on the
 * assumption that a comment key is the harmless convention it is in some other
 * tools. It was checked with JSON.parse and with `require`, both of which
 * passed, because the file was perfectly valid JSON. Vercel then refused it:
 *
 *   headers[1] should NOT have additional property `//`
 *
 * The check had measured the wrong property. Syntactic validity is not schema
 * conformance, and the difference only shows up at deploy time, after the
 * merge, with production red. So the test below checks the thing that actually
 * broke: every key in the file is one Vercel knows about.
 *
 * WHAT IT DOES NOT DO.
 *
 * It is not a copy of Vercel's schema and should not grow into one. The lists
 * here cover the keys this repo uses plus the near neighbours somebody would
 * plausibly reach for next. Adding a genuinely new one means adding it here
 * first, which is a deliberate half-minute rather than a red deploy.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}
const eq = (name, a, b) => ok(name, a === b, `got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`)

console.log('\nvercel config')

const raw = readFileSync(join(root, 'vercel.json'), 'utf8')

/* --- it is still JSON, which was never the problem ---------------------- */

let config = null
try {
  config = JSON.parse(raw)
  ok('vercel.json parses', true)
} catch (e) {
  ok('vercel.json parses', false, e.message)
}

/* --- and now the thing that actually failed ----------------------------- */

/**
 * The keys Vercel accepts, per section.
 *
 * `has` and `missing` are in the route lists because they are the conditional
 * matchers, and a header rule that needs one is the most likely next edit
 * here. Everything absent from these lists fails loudly rather than at deploy.
 */
const TOP = new Set([
  '$schema',
  'buildCommand',
  'cleanUrls',
  'crons',
  'devCommand',
  'framework',
  'functions',
  'headers',
  'ignoreCommand',
  'installCommand',
  'outputDirectory',
  'redirects',
  'regions',
  'rewrites',
  'trailingSlash',
])
const HEADER_RULE = new Set(['source', 'headers', 'has', 'missing'])
const HEADER_PAIR = new Set(['key', 'value'])
const REWRITE_RULE = new Set(['source', 'destination', 'has', 'missing'])

const unknown = (obj, allowed) => Object.keys(obj).filter((k) => !allowed.has(k))

ok('no unknown key at the top level', unknown(config, TOP).length === 0, unknown(config, TOP).join(', '))

config.headers.forEach((rule, i) => {
  const bad = unknown(rule, HEADER_RULE)
  ok(`headers[${i}] has no unknown key`, bad.length === 0, bad.join(', '))
  rule.headers.forEach((pair, j) => {
    const badPair = unknown(pair, HEADER_PAIR)
    ok(`headers[${i}].headers[${j}] has no unknown key`, badPair.length === 0, badPair.join(', '))
    eq(`headers[${i}].headers[${j}].key is a string`, typeof pair.key, 'string')
    eq(`headers[${i}].headers[${j}].value is a string`, typeof pair.value, 'string')
  })
})

config.rewrites.forEach((rule, i) => {
  const bad = unknown(rule, REWRITE_RULE)
  ok(`rewrites[${i}] has no unknown key`, bad.length === 0, bad.join(', '))
})

/**
 * The specific mistake, named.
 *
 * The generic check above already covers this, but "//" is the one somebody
 * reaches for on purpose, believing it is ignored, and a failure that says the
 * word "comment" is a failure that explains itself.
 */
const commentish = (obj, path) => {
  const out = []
  for (const [k, v] of Object.entries(obj)) {
    if (k === '//' || k === '#' || k.startsWith('//')) out.push(`${path}.${k}`)
    if (v && typeof v === 'object') {
      for (const [k2, v2] of Object.entries(v)) {
        if (Array.isArray(v)) out.push(...commentish(v2, `${path}.${k}[${k2}]`))
        else if (v2 && typeof v2 === 'object') out.push(...commentish(v2, `${path}.${k}.${k2}`))
      }
      if (!Array.isArray(v)) out.push(...commentish(v, `${path}.${k}`))
    }
  }
  return out
}
const comments = commentish(config, 'vercel.json')
ok('there is no comment key anywhere, JSON has no comments', comments.length === 0, comments.join(', '))

/* --- and the rules themselves are the ones we meant --------------------- */

const ruleFor = (source) => config.headers.find((h) => h.source === source)
const valueOf = (source, key) => ruleFor(source)?.headers.find((h) => h.key === key)?.value

/**
 * The worker must not be cached and the hashed bundle must be. These are the
 * two opposite ends of the same decision, so they are asserted together: a
 * copy-paste that gave sw.js the immutable header would be silent for a day
 * and then inexplicable.
 */
ok('sw.js is revalidated every time', /max-age=0/.test(valueOf('/sw.js', 'Cache-Control') || ''))
ok('sw.js is not immutable', !/immutable/.test(valueOf('/sw.js', 'Cache-Control') || ''))
ok(
  'the hashed bundle is cached forever',
  /immutable/.test(valueOf('/assets/(.*)', 'Cache-Control') || ''),
)

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
