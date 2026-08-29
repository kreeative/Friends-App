/**
 * node src/lib/notifyCopy.test.mjs
 *
 * The two reminder emails, checked without Deno.
 *
 * supabase/functions/notify runs on Deno and cannot be imported here, so this
 * reads it as text. That is a weaker tool than importing it, and it is worth
 * having anyway: the failure it guards against is a translator adding a line
 * to one language and not the other, which produces `undefined` in a subject
 * line for half the users and is invisible until somebody receives it.
 *
 * These messages are the only thing this app sends to a person who has stopped
 * opening it. There is exactly one nudge per cycle, enforced by a unique
 * constraint, so there is no second chance to get it right.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const SRC = join(here, '..', '..', 'supabase', 'functions', 'notify', 'index.ts')
const src = readFileSync(SRC, 'utf8')

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}

/** The body of one language block inside COPY. */
function block(lang) {
  const start = src.indexOf(`  ${lang}: {`)
  if (start < 0) return ''
  return src.slice(start, src.indexOf('\n  },', start))
}
const keysOf = (lang) => [...block(lang).matchAll(/^ {4}(\w+):/gm)].map((m) => m[1]).sort()

/* --- both languages, same shape ------------------------------------------ */

{
  const fr = keysOf('fr')
  const en = keysOf('en')

  ok('the copy table has a French block', fr.length > 0)
  ok('and an English one', en.length > 0)
  ok('with the same keys in both',
     fr.join(',') === en.join(','),
     `only fr: ${fr.filter((k) => !en.includes(k))} | only en: ${en.filter((k) => !fr.includes(k))}`)

  /* Every piece each message needs. Named rather than counted, because "13
     keys" stays true when one is renamed and the send then reads undefined. */
  for (const key of [
    'digestSubject', 'digestTitle', 'digestPre', 'digestLead', 'digestCta', 'digestTail',
    'nudgeSubject', 'nudgeTitle', 'nudgePre', 'nudgeLead', 'nudgeBody', 'nudgeCta', 'nudgeFoot',
  ]) {
    ok(`both languages define ${key}`, fr.includes(key) && en.includes(key))
  }
}

/* --- the fallback is French, on purpose ---------------------------------- */

{
  /* profiles.locale is nullable, so a profile the client has never touched
     falls through to the default. That default is French because most of the
     people this app is for read French; an English default would quietly
     write in the wrong language to exactly the accounts nobody has seen. */
  ok('an unknown locale falls back to French, not English',
     /raw === 'en' \? 'en' : 'fr'/.test(src),
     src.match(/const localeOf[^\n]*\n[^\n]*/)?.[0] ?? 'localeOf not found')
}

/* --- the language is actually looked up ---------------------------------- */

{
  ok('the recipient lookup reads profiles.locale',
     /from\('profiles'\)[\s\S]{0,80}select\('locale'\)/.test(src))
  ok('and both senders use the copy table rather than literals',
     (src.match(/COPY\[who\.loc\]/g) ?? []).length === 2,
     String((src.match(/COPY\[who\.loc\]/g) ?? []).length))

  /* The English strings that used to be inline. If any of these comes back as
     a literal in a send(), one language has been hard-coded again. */
  for (const gone of [
    "title: 'Check-in opens tonight'",
    "title: 'No rush'",
    "label: 'Check in'",
    "label: 'Pick one thing'",
  ]) {
    ok(`no hard-coded English left: ${gone.slice(0, 30)}`, !src.includes(gone))
  }
}

/* --- the ceiling, and where the link points ------------------------------ */

{
  /* One claim per person per cycle, and the claim is what makes the ceiling
     real. If a send ever happens before its claim, the unique constraint stops
     protecting anything. */
  ok('nothing sends without claiming a row first',
     src.indexOf('async function claim') < src.indexOf('await send('))
  ok('the nudge is claimed before its recipient is even looked up',
     src.indexOf("claim(n.subject_id, n.cycle_id, 'nudge')") < src.indexOf('recipient(n.subject_id)'))

  /* The nudge points at the page carrying the "still in" control. It used to
     say /me, which still works, but /profile is the canonical address and a
     link in an email outlives the deploy that renamed it. */
  ok('the nudge links to /profile', src.includes('${SITE}/profile'))
  ok('and the digest links to the check-in', src.includes('/checkin'))
}

console.log(`\nnotifyCopy\n\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
