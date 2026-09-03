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
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const API = join(here, '..', '..', 'api')

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
  /* This file parses copies rather than reading sources, so it has no `read`
     of its own; the two assertions below are about CONTENT, not syntax. */
  const src = (rel) =>
    readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8')
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

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
