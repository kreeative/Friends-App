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
import { copyFileSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
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

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
