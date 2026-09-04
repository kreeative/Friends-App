/**
 * node src/lib/apiSyntax.test.mjs
 *
 * Every file under api/ must parse.
 *
 * WHY THIS IS A TEST AND NOT AN ASSUMPTION.
 *
 * api/checkout.js went to production with a missing brace inside a template
 * literal:
 *
 *   `No book in the catalogue with ${bookId ? `id ${bookId}` : `slug "${slug}"`.`
 *                                                                            ^
 *
 * Nothing caught it. These files are serverless functions: Vite never touches
 * them, so `npm run build` passes, there is no type checking, and the test
 * suite had never once looked at the api directory. The failure only appears
 * when the function is invoked, as a module that will not load, which Vercel
 * reports as its own error page. From the outside the Buy button simply stops
 * working, with nothing in the browser that says why.
 *
 * A parse is the cheapest possible check and it is the one that was missing.
 * It would have caught that break in under a second.
 *
 * WHY THE FILES ARE COPIED TO .mjs FIRST, WHICH LOOKS LIKE A DETAIL AND IS NOT.
 *
 * These are ES modules by virtue of the "type": "module" in the project's
 * package.json. Checking a copy at a path outside the project, with a .js
 * extension, means node no longer has that package.json to consult and may
 * parse it under different rules, and a check that quietly changes what it is
 * checking is worse than no check.
 *
 * This is not hypothetical. While diagnosing the break above, exactly that
 * mistake reported all five commits under test as clean, including the one
 * that was broken, and sent the investigation in the wrong direction. Copying
 * to .mjs forces module parsing regardless of where the file sits.
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const API = join(root, 'api')

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ''}`)
  }
}

console.log('\napi syntax')

const files = readdirSync(API)
  .filter((f) => f.endsWith('.js'))
  .sort()

/* If this directory is ever emptied or moved, the loop below would pass
   vacuously and this file would go on reporting success while checking
   nothing. */
ok(`there are api files to check (${files.length})`, files.length > 0)

const scratch = mkdtempSync(join(tmpdir(), 'apisyntax-'))
try {
  for (const file of files) {
    const copy = join(scratch, `${file.replace(/\.js$/, '')}.mjs`)
    copyFileSync(join(API, file), copy)
    try {
      execFileSync(process.execPath, ['--check', copy], { stdio: 'pipe' })
      ok(`api/${file} parses`, true)
    } catch (err) {
      const detail = String(err.stderr ?? err.message)
        .split('\n')
        .filter((l) => l.trim() && !l.startsWith('    at ') && !l.startsWith('Node.js v'))
        .slice(0, 4)
        .join('\n        ')
      ok(`api/${file} parses`, false, detail)
    }
  }
} finally {
  rmSync(scratch, { recursive: true, force: true })
}

/* --- the diagnostic must never become a way to read a secret ------------- */

/* This file parses copies rather than reading sources, so it has no `read` of
   its own. Declared at module scope rather than inside the first block that
   wanted it: a const in a block is invisible to every block after it, which
   cost a run when the recovery assertions were added below. */
const src = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8')
/* The same file with its comments gone. An assertion of the form "this word is
   absent" matches the note explaining why it is absent, and fails against a
   file that is correct. That has now happened three times in this repo, so it
   gets a helper rather than a fix each time. */
const code = (rel) => src(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

/**
 * /api/stripe-health reports which integrations are configured. That is a
 * useful thing and a dangerous shape: a diagnostic endpoint is exactly where
 * somebody helpfully adds "and here are the first four characters of the key,
 * to check it is the right one".
 *
 * So the rule is absolute and asserted rather than remembered: the value of a
 * secret is never read in that file. Only its presence, via Boolean(env(...)).
 * The gate is asserted too, because "anyone who guesses the path" is not the
 * audience for a list of what is misconfigured.
 */
{
  const health = src('api/stripe-health.js')
  ok('the health endpoint exists', health.length > 0)
  ok(
    'it never puts a secret value in a response',
    !/env\('stripeSecret'\)\s*\.|slice\(0,\s*\d+\)|substring|\.slice\(-/.test(health),
    'presence is Boolean(env(...)), and that is all a diagnostic may say',
  )
  ok(
    'the env report is booleans, not values',
    /Boolean\(env\(k\)\)/.test(health),
  )
  ok(
    'and it requires a signed-in caller',
    /admin\.auth\.getUser\(token\)/.test(health) && /return res\.status\(401\)/.test(health),
  )
  ok(
    'the browser side sends the live token rather than a stored one',
    /supabase\.auth\.getSession\(\)/.test(src('src/components/PurchaseCheck.jsx')),
    'a token read at mount may have rotated by the time the button is pressed',
  )
}

/**
 * /api/stripe-recover GRANTS BOOKS, WHICH MAKES IT THE MOST DANGEROUS ENDPOINT
 * IN THE PROJECT.
 *
 * It exists because the webhook was never registered in Stripe: three paid
 * purchases sat there carrying a book_id and a user_id against zero rows in
 * entitlements, and registering the endpoint would only have fixed the next
 * one. So this asks Stripe what the caller actually paid for and hands it
 * over.
 *
 * The rule that makes that safe is that the recipient is the BEARER TOKEN and
 * never anything in the request. A session counts only when its
 * metadata.user_id equals the verified id.
 *
 * NO EMAIL FALLBACK, and that is the assertion most worth keeping. The webhook
 * has one, correctly: a guest checkout has no user_id and the address Stripe
 * collected is the only thing identifying the buyer. Copying that here would
 * turn "I know an address" into "give me that person's books" on an endpoint
 * anybody can call. A guest purchase stays parked in pending_entitlements for
 * the sign-in flow to claim.
 */
{
  const rec = src('api/stripe-recover.js')

  ok('it requires a signed-in caller',
     /admin\.auth\.getUser\(token\)/.test(rec) && /return res\.status\(401\)/.test(rec))
  ok(
    'it grants only to the verified caller',
    /s\.metadata\?\.user_id !== user\.id/.test(rec) && /user_id: user\.id/.test(rec),
    'the recipient is the token, never the request body',
  )
  ok(
    'and never falls back to an email',
    !/email/i.test(code('api/stripe-recover.js')),
    'that would make knowing an address enough to take somebody\u2019s books',
  )
  ok(
    'only a paid session counts',
    /payment_status !== 'paid'/.test(rec),
  )
  ok(
    'the write is the same upsert the webhook uses',
    /onConflict: 'user_id,book_id', ignoreDuplicates: true/.test(rec),
    'two paths granting entitlements must not disagree about what one is',
  )
  ok(
    'it reads no secret into a response',
    !/env\('stripeSecret'\)\s*[,)}]?\s*(\+|\.slice|\.substring)/.test(rec) &&
      !/detail: secret|key: secret/.test(rec),
  )
  ok(
    'and it is a POST, because it writes',
    /req\.method !== 'POST'/.test(rec),
    'a GET that grants entitlements can be triggered by a link',
  )
}

/**
 * THE VITE_ PREFIX IS A PUBLISHING INSTRUCTION, NOT A NAMING CONVENTION.
 *
 * Vite does not inline only the VITE_ variables the code happens to read. It
 * builds `import.meta.env` as a static object holding EVERY VITE_-prefixed
 * variable in the environment and ships it in the bundle. So a variable nobody
 * imports still reaches the browser, and "we never read it" is not a defence.
 *
 * That makes one typo catastrophic in a way nothing else here is. Setting
 * STRIPE_SECRET_KEY on the hosting dashboard is correct. Setting
 * VITE_STRIPE_SECRET_KEY is a live payments key published to every visitor,
 * with no error, no warning, and a perfectly working site.
 *
 * The question came up honestly: the publishable key and the secret key were
 * both on Vercel and it was not obvious which of those was a problem. It is
 * worth being exact. A publishable key (pk_) is designed to be public and is
 * safe anywhere. A secret key (sk_) grants the account. The names are one
 * character apart in the middle of a dashboard field.
 *
 * Two checks, because they catch different mistakes:
 *
 *   1. Source. No VITE_ name in src/ may look like a server-side credential.
 *      This catches somebody wiring one up in code.
 *   2. Build output. Scan the actual bundle for live key shapes. This catches
 *      the case the source check cannot see, which is a dangerous name set
 *      only in a dashboard and never written down here.
 */
{
  const walk = (dir) => {
    const out = []
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name)
      if (e.isDirectory()) out.push(...walk(full))
      else out.push(full)
    }
    return out
  }

  const SRC = join(here, '..')
  const sources = walk(SRC).filter((f) => /\.(js|jsx|ts|tsx)$/.test(f) && !f.endsWith('.test.mjs'))
  ok(`there are sources to scan (${sources.length})`, sources.length > 0)

  /* VITE_VAPID_PUBLIC_KEY is read in src/ and belongs there: a push public key
     is meant to be in the browser, which is the whole point of a keypair. So
     the rule cannot be "no VITE_ name mentioning a key". It is a list of the
     words that mean server-side, with PUBLIC deliberately absent. */
  const DANGEROUS = /^VITE_.*(SECRET|SERVICE_ROLE|STRIPE|PLAID|WEBHOOK|RESEND|PRIVATE|SERVICE_KEY)/
  const offenders = []
  for (const file of sources) {
    for (const m of readFileSync(file, 'utf8').matchAll(/\bVITE_[A-Z0-9_]+/g)) {
      if (DANGEROUS.test(m[0])) offenders.push(`${file.slice(SRC.length + 1)}: ${m[0]}`)
    }
  }
  ok(
    'no VITE_ name in src/ reads a server-side credential',
    offenders.length === 0,
    offenders.join('; '),
  )

  /**
   * The built bundle, if one is lying around. Reported as an explicit skip
   * rather than a silent pass when it is not: a check that quietly does
   * nothing is the shape of every false green in this repo's history.
   *
   * Only ever reports THAT a pattern matched, never the text that matched it.
   * A test failure is written to a terminal and pasted into chat, and a check
   * for a leaked key that prints the leaked key has published it a second way.
   *
   * WHAT THIS CANNOT TELL YOU. dist/ is gitignored, so this reads whatever
   * build happens to be on the machine, which may be old and was certainly
   * made with local environment variables rather than the hosting dashboard's.
   * A green here means "the build I can see is clean", not "production is
   * clean". The only way to know that is to open the deployed bundle. This is a
   * tripwire on the way out, not an audit of what already shipped.
   */
  const dist = join(root, 'dist')
  if (!existsSync(dist)) {
    console.log('  skip  bundle scan: no dist/, run `npx vite build` to include it')
  } else {
    const bundles = walk(dist).filter((f) => /\.(js|css|html|map)$/.test(f))
    ok(`there is a build to scan (${bundles.length} files)`, bundles.length > 0)

    const SHAPES = [
      ['Stripe secret key', /\bsk_(live|test)_[A-Za-z0-9]{10}/],
      ['Stripe restricted key', /\brk_(live|test)_[A-Za-z0-9]{10}/],
      ['Stripe webhook signing secret', /\bwhsec_[A-Za-z0-9]{10}/],
      ['Plaid secret', /\bplaid[_-]?secret["'\s:=]+[A-Za-z0-9]{20}/i],
      ['Resend key', /\bre_[A-Za-z0-9]{16}/],
      /* The service role key is a JWT and its role is in the payload, which is
         base64 and therefore searchable as plain text in the bundle. */
      ['service_role JWT', /service_role/],
    ]
    for (const [what, re] of SHAPES) {
      const hits = bundles.filter((f) => re.test(readFileSync(f, 'utf8')))
      ok(
        `the bundle carries no ${what}`,
        hits.length === 0,
        hits.length ? `matched in: ${hits.map((f) => f.slice(dist.length + 1)).join(', ')}` : '',
      )
    }
  }
}

/**
 * /api/library-health SAYS WHY A BOOK WILL NOT OPEN.
 *
 * "You own this book, the chapter is not loaded" is true for four unrelated
 * reasons that look identical from a phone: no books row, no chapter rows, the
 * chapter rows still holding generated filler, or no entitlement. Telling them
 * apart means comparing what the service role can see against what the CALLER
 * can see, and that difference is exactly what row level security is doing.
 *
 * THE ASSERTION THAT MATTERS MOST IS THE ONE ABOUT THE ANON KEY.
 *
 * A Supabase client built with the service role ignores row level security
 * whatever Authorization header it carries. Using it for the "can this reader
 * see the chapter" half would report success unconditionally, which is not a
 * weaker check but one that always passes, and it would say the books were
 * fine while they were broken. The first draft of this file had exactly that
 * fallback.
 */
{
  const lib = src('api/library-health.js')

  ok('it requires a signed-in caller',
     /admin\.auth\.getUser\(token\)/.test(lib) && /return res\.status\(401\)/.test(lib))
  ok(
    'the reader-side check uses the anon key, never the service role',
    /const anon = env\('supabaseAnon'\)/.test(lib) &&
      !/env\('supabaseAnon'\) \?\? env\('serviceRole'\)/.test(lib),
    'the service role bypasses RLS, so that check would always pass',
  )
  ok(
    'and says so rather than guessing when the anon key is absent',
    /SUPABASE_ANON_KEY is not set/.test(lib),
  )
  ok(
    'it never returns a chapter body',
    !/body: c\.body|detail: c\.body|\.select\('body'\)/.test(code('api/library-health.js')),
    'a diagnostic that printed a body would be a way to read the book for free',
  )
  ok(
    'it reads no secret into a response',
    !/serviceRole'\)\s*[,)}]?\s*(\+|\.slice|\.substring)/.test(lib),
  )
  ok(
    'the anon key has a name to be found under',
    /supabaseAnon: \['SUPABASE_ANON_KEY'/.test(src('api/_env.js')),
  )
  ok(
    'the settings screen can run it',
    /library-health/.test(src('src/components/PurchaseCheck.jsx')) &&
      /data-hook="library-check"/.test(src('src/components/PurchaseCheck.jsx')),
  )
}

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
