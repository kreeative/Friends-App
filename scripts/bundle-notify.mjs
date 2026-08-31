/**
 * node scripts/bundle-notify.mjs
 *
 * Flattens supabase/functions/notify into ONE file that can be pasted into the
 * Supabase dashboard's Edge Function editor.
 *
 * WHY THIS EXISTS.
 *
 * The function is two modules, index.ts and template.ts, and that split is
 * right: one is the sending logic, the other is email layout, and they change
 * for different reasons. Deploying it that way needs the Supabase CLI, which
 * needs a terminal.
 *
 * The dashboard can deploy an Edge Function from the browser, which is the
 * only route available from an iPad. Pasting one file is reliable there; two
 * files is a per-file dance in a web editor that is easy to get half-right.
 * So the two are concatenated into bundled.ts, and that is what gets pasted.
 *
 * WHY IT IS GENERATED AND NOT MAINTAINED.
 *
 * A hand-kept copy of two files is three files that drift, and the first
 * symptom is an email that renders correctly in the repo and wrongly in the
 * inbox. bundled.ts carries a header saying it is generated, and
 * notifyCopy.test.mjs regenerates it in memory and fails if what is on disk
 * differs. So the copy cannot silently fall behind its source.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const DIR = join(here, '..', 'supabase', 'functions', 'notify')

export function bundle() {
  const template = readFileSync(join(DIR, 'template.ts'), 'utf8')
  const push = readFileSync(join(DIR, 'push.ts'), 'utf8')
  const index = readFileSync(join(DIR, 'index.ts'), 'utf8')

  /* template.ts declares its own SITE from the same env var index.ts does.
     Two `const SITE` in one file is a redeclaration error, so the template's
     copy is dropped and index.ts's is the one that survives. They read the
     same variable with the same fallback, so nothing changes but the name
     binding. */
  const templateBody = template
    .replace(
      /^const SITE = Deno\.env\.get\('SITE_URL'\).*$/m,
      '/* SITE comes from the sending half below, which declares it once. */',
    )
    /* Exports mean nothing inside a single module and `export type` at the top
       level of a bundled file is still legal, but dropping the keyword keeps
       the file honest about being one unit rather than two glued together. */
    .replace(/^export (type|function|const) /gm, '$1 ')

  /* push.ts, the same way. It arrived later than template.ts and the first
     version of this script did not know about it, so the bundle kept a live
     `import ... from './push.ts'` that resolves to nothing in a single-file
     editor: the function would have deployed and thrown on its first run.
     Hence the assertion at the bottom, which fails on ANY surviving relative
     import rather than on the two this script happens to know. */
  const pushBody = push
    .replace(/^export (type|function|const|async function) /gm, '$1 ')

  /* The imports of the modules we just inlined, and nothing else: the supabase
     client import has to stay. */
  let indexBody = index
    .replace(/^import \{[^}]*\} from '\.\/template\.ts'\n/m, '')
    .replace(/^import \{[^}]*\} from '\.\/push\.ts'\n/m, '')

  /* Imports HOISTED to the top of the bundle.
     Concatenating template first leaves index's import of supabase-js a
     couple of hundred lines down. ES modules hoist imports so Deno runs it
     either way, but a file whose only import sits in the middle reads as a
     mistake and is the kind of thing a future linter or bundler rejects for
     no useful reason. */
  const imports = []
  indexBody = indexBody.replace(/^import .*?from '[^']+'\n/gm, (line) => {
    imports.push(line)
    return ''
  })

  const out = `/**
 * GENERATED FILE. DO NOT EDIT.
 *
 * node scripts/bundle-notify.mjs
 *
 * template.ts and index.ts, concatenated, so the whole function can be pasted
 * into the Supabase dashboard's Edge Function editor in one go. Editing this
 * file is editing a copy: the change would be overwritten the next time the
 * script runs, and notifyCopy.test.mjs fails when the two disagree.
 *
 * Edit supabase/functions/notify/index.ts or template.ts, then re-run the
 * script above.
 */

${imports.join('').trim()}

${templateBody.trim()}

${pushBody.trim()}

${indexBody.trim()}
`

  /**
   * NOTHING RELATIVE MAY SURVIVE.
   *
   * The whole point of this file is that it is ONE file pasted into a web
   * editor. A relative import that reached the output would resolve to nothing
   * there, and the function would deploy cleanly and throw on its first run,
   * which is the failure mode this project has already paid for twice.
   *
   * Checked as a rule rather than as a list, so a third module inlined by
   * somebody who forgets to strip its import fails here instead of in
   * production.
   */
  const leftover = out.match(/^import .*from '\.\/.*'$/m)
  if (leftover) {
    throw new Error(`bundle-notify: a relative import survived: ${leftover[0]}`)
  }

  return out
}

const OUT = join(DIR, 'bundled.ts')

/* Guarded so the test can import bundle() without writing anything. */
if (process.argv[1] && process.argv[1].endsWith('bundle-notify.mjs')) {
  writeFileSync(OUT, bundle())
  console.log(`wrote ${OUT}`)
}
