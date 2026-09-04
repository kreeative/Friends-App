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
import { transformSync } from '/home/user/Friends-App/node_modules/esbuild/lib/main.js'
import { bundle } from '../../scripts/bundle-notify.mjs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const SRC = join(here, '..', '..', 'supabase', 'functions', 'notify', 'index.ts')
const src = readFileSync(SRC, 'utf8')

/**
 * The same file with its comments removed.
 *
 * Four separate assertions in this suite have failed on the prose explaining
 * the very thing they forbid: the note saying "assigned_to is NOT used here",
 * the one quoting the feminine agreement that was removed, the one explaining
 * why List-Unsubscribe-Post is absent, and the one quoting the old MAIL_FROM
 * example. Each time the fix was to strip comments in that block, and each
 * time the next "X must not appear" check walked into it again.
 *
 * So it is derived once. Any check of the form "this must not be in the code"
 * reads CODE; anything about the words that get sent reads src, because the
 * copy lives in string literals and is not affected either way.
 */
const CODE = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

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
    'nudgeFromSubject', 'nudgeFromTitle', 'nudgeFromLead',
    'birthdaySubject', 'birthdayTitle', 'birthdayPre', 'birthdayLead', 'birthdayNote',
    'birthdayCta', 'birthdayFoot',
    'smallPrint',
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

/* --- which caller is which, run rather than read -------------------------- */

/**
 * THE LINE THAT KILLED EVERY SCHEDULED MESSAGE.
 *
 * The handler read `if (req.method === 'POST') return deliverNudge(req)`.
 * pg_cron calls this hourly through net.http_post, which is a POST carrying
 * `{}` and the service role key, so every scheduled run was handed to the
 * instant-push path, which tried to resolve that key as a user session and
 * answered 401 bad_session. Confirmed from net._http_response: 401, on the
 * hour, every hour. No digest, no scheduled nudge, no birthday, no group goal,
 * no cycle reminder, for as long as it was deployed.
 *
 * So the predicate is a real function now and this runs it, rather than
 * grepping for the shape of it. The case that matters is the empty body.
 */
{
  const start = src.indexOf('export function wantsInstant')
  const body = src.slice(start, src.indexOf('\n}', start) + 2)
  const js = transformSync(body.replace('export function', 'function'), { loader: 'ts' }).code
  // eslint-disable-next-line no-eval
  const wantsInstant = eval(`${js}; wantsInstant`)

  ok('an empty body is cron, and must reach the scheduled run',
     wantsInstant({}) === false,
     'this is the exact call that was answering 401 every hour')
  ok('so is no body at all', wantsInstant(null) === false)
  ok('and so is a body of unrelated keys', wantsInstant({ hello: 1 }) === false)

  ok('a nudge id is somebody in the app', wantsInstant({ nudge_id: 'abc' }) === true)
  ok('so is a self test', wantsInstant({ self_test: true }) === true)

  /* The shapes that used to slip through as "truthy enough". */
  ok('an empty nudge id is not a nudge', wantsInstant({ nudge_id: '' }) === false)
  ok('nor is a non-string one', wantsInstant({ nudge_id: 123 }) === false)
  ok('and self_test must be exactly true', wantsInstant({ self_test: 'yes' }) === false)
  ok('not merely present', wantsInstant({ self_test: false }) === false)
}

{
  /* And the handler has to consult it rather than the method. */
  ok('the POST branch asks what was requested, not how',
     /if \(wantsInstant\(body\)\)/.test(src),
     'method alone cannot tell cron from a person, they both POST')
  ok('and a POST it does not claim falls through to the scheduled run',
     src.indexOf('if (wantsInstant(body))') < src.indexOf('await sendDigests()'),
     'cron has to come out the other side of that branch')
  ok('the body is read once and handed down',
     /deliverNudge\(req, body\)/.test(src),
     'a request body cannot be read twice')
}

/* --- the language is actually looked up ---------------------------------- */

{
  ok('the recipient lookup reads profiles.locale',
     /from\('profiles'\)[\s\S]{0,80}select\('locale[^']*'\)/.test(src),
     'it now asks for pronouns in the same select, see below')

  /**
   * AND THE ONE OTHER THING IT IS ALLOWED TO KNOW ABOUT A PERSON.
   *
   * The nudge title is "X se demande ou tu es passe", and the participle
   * agrees with the person reading it. The only admissible source for that is
   * what somebody typed in the pronouns box.
   *
   * The assertions that matter are the negative ones. isFeminine must be true
   * for a stated she/her and false for everything else, and nothing anywhere
   * may reach for a display name to decide it: guessing gender from a name is
   * how an app misgenders a real person in a way a default never does.
   */
  ok('and reads pronouns, for the participle',
     /select\('locale, pronouns'\)/.test(src))
  ok('the agreement is decided in one place',
     /function isFeminine/.test(src))
  {
    const fn = src.slice(src.indexOf('function isFeminine'))
    const body = fn.slice(0, fn.indexOf('\n}') + 2)
    ok('and it never looks at a name',
       !/display_name|name/.test(body), body)
    ok('it is true only for a set somebody chose',
       /'she\/her'/.test(body) && /'elle'/.test(body))
    ok('and it lower-cases first, because the box is free text',
       /toLowerCase\(\)/.test(body))
  }
  ok('the English title ignores the flag, having no agreement to make',
     /nudgeFromTitle: \(who: string, _fem\?: boolean\)/.test(src))
  /* One per sender: digest, nudge, birthday, group_goal, cycle. Counted rather
     than named so that adding a sixth and hard-coding its words trips this. */
  ok('and every sender uses the copy table rather than literals',
     (src.match(/COPY\[who\.loc\]/g) ?? []).length === 5,
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

/* --- the nudge opens on the gesture, not on the absence ------------------ */

{
  /** The words of one key, whether it is a plain string or an arrow returning
      a template. Reading only `'...'` silently returned '' the moment a key
      grew a parameter, which passed a "does not say X" check by looking at an
      empty string. */
  const line = (lang, key) => {
    const b = block(lang)
    const at = b.search(new RegExp(`^ {4}${key}:`, 'm'))
    if (at < 0) return ''
    /* To the next key, which is the next line starting at exactly four spaces
       and then something. Not `\n    `, which also matches the first four
       spaces of a six-space continuation line and cuts a wrapped value in
       half, returning only the part before the wrap. */
    const rest = b.slice(at + 1)
    const next = rest.search(/^ {4}\S/m)
    const upto = next < 0 ? rest : rest.slice(0, next)
    return [...upto.matchAll(/'([^']*)'|`([^`]*)`/g)].map((m) => m[1] ?? m[2]).join(' ')
  }

  /* WHAT THIS MESSAGE IS ALLOWED TO SAY.
     It goes to somebody who has been silent a fortnight, there is exactly one
     per cycle, and it is the only thing the app ever sends them. It SHOULD say
     that nobody has seen them for two weeks: that is the reason it exists, and
     leaving it out makes an email that arrives for no stated reason.

     What it must not do is keep score. "Tu as manque quelques points" / "You
     have missed a couple of check-ins" is a tally handed to somebody who is
     probably not having a good fortnight, and it spends the one message on
     telling them something they already know about themselves. The line below
     matches verbs of failure, not the fact of the two weeks. */
  for (const lang of ['fr', 'en']) {
    for (const key of ['nudgeLead', 'nudgeFromLead']) {
      const lead = line(lang, key)
      ok(`the ${lang} ${key} has words`, lead.length > 0)
      ok(`and it does not keep score`, !/manqu|missed|oubli|forgot|rattrap\w* ton retard/i.test(lead), lead)
    }
    /* And it does say why it arrived. */
    ok(`the ${lang} nudge says how long it has been`,
       /deux semaines|two weeks|couple of weeks/i.test(line(lang, 'nudgeLead')),
       line(lang, 'nudgeLead'))
  }

  /* The named version is only reachable from a real claim, and the code is
     where that is enforced, so this checks the code rather than the words. */
  ok('the named nudge is built from claimed_by, which is somebody pressing a button',
     /if \(n\.claimed_by\)/.test(src))
  /* Comments stripped, for the same reason as the gender check below: the note
     inside sendNudges names assigned_to in order to say why it is not used. */
  const nudgeCode = CODE.slice(CODE.indexOf('async function sendNudges'))
  ok('and never from assigned_to, which is the app choosing for them',
     !/assigned_to/.test(nudgeCode),
     'assigned_to must not decide who the email is from')

  /* WHY A GENDER CHECK AT ALL.
     The French said "Quand tu es prete", a feminine agreement in a message
     sent to every member of every group, so it was wrong for about half of
     them. Nothing in the schema records anyone's gender and nothing should, so
     the only correct French here is French that does not agree. The trap is
     specific to the second person, which is why the pattern is anchored to
     `tu es` rather than hunting for adjectives anywhere. */
  {
    /* Comments stripped first. The note next to the French copy quotes the
       exact phrase this looks for, in order to explain why it was removed, and
       without this the check fails on the explanation rather than on the
       string that gets sent. Removing the quote from the comment would pass
       the test by making the file worse. */
    const fr = block('fr').replace(/\/\*[\s\S]*?\*\//g, '')
    /* \p{L} rather than \w, which matches neither ê nor é, so the accented
       spelling of the exact word this was written for would have walked past
       it. */
    const gendered = fr.match(
      /tu es \p{L}*ée|tu es (prête|prete|sûre|sure|seule|contente|désolée|desolee)\b/iu,
    )
    ok('the French carries no feminine-only agreement', !gendered, gendered?.[0] ?? '')

    /* AND IT IS ACTUALLY WRITTEN IN FRENCH.
       This block was ASCII, which in an inbox reads as "C est une question",
       "Ouvre l application", "Envoye une fois". The apostrophe is ASCII, so
       nothing technical was forcing that: the strings were single-quoted and
       dropping the apostrophe was cheaper than escaping it. What arrived
       looked like a bad machine translation, in the one message this app
       sends to somebody who has stopped opening it. */
    ok('the French uses real apostrophes', /’/.test(fr))
    ok('and real accents', /[àâçéèêîôùû]/i.test(fr))
    for (const broken of ['C est', 'l application', 'n y a', 'Envoye', 'deuxieme', 'Ca fait']) {
      ok(`no dropped elision or accent: "${broken}"`, !fr.includes(broken))
    }
  }
}

/* --- birthdays, and the shell that wraps every message ------------------- */

{
  const tpl = readFileSync(
    join(here, '..', '..', 'supabase', 'functions', 'notify', 'template.ts'),
    'utf8',
  )

  /* The layout carried its own sentence of English, three hundred lines away
     from the copy table, so every French message ended in an English line
     about a ceiling. Nothing caught it because the copy table only knows about
     words the senders hand it, and this one was never handed anywhere. */
  ok('the shell takes its small print from the caller',
     /smallPrint/.test(tpl) && /\$\{esc\(smallPrint\)\}/.test(tpl))
  ok('and no longer says it in English in the markup',
     !tpl.includes('You get at most two of these'))
  ok('so every send passes a language to the shell',
     (src.match(/loc: who\.loc/g) ?? []).length === 5,
     String((src.match(/loc: who\.loc/g) ?? []).length))

  /* Three days is the whole argument for the message existing: on the day
     itself the only thing left is a text, which is what BirthdayBanner says on
     screen. A constant so the number is in one place and reviewable. */
  ok('the birthday lead time is a named constant', /const BIRTHDAY_LEAD_DAYS = \d+/.test(src))
  ok('and it is three days, not the day itself',
     src.match(/const BIRTHDAY_LEAD_DAYS = (\d+)/)?.[1] === '3',
     src.match(/const BIRTHDAY_LEAD_DAYS = (\d+)/)?.[1] ?? 'missing')

  /* Being told your own birthday is coming is the app reminding you of the one
     date you did not need reminding of, and it also tells you everybody else
     just got a mail about you. */
  ok('nobody is sent their own birthday',
     /c\.user_id !== m\.user_id/.test(src))

  /* Two friends sharing a date must both appear. The ceiling is one row per
     recipient per cycle per kind, so a message per birthday would mean the
     second one silently never sends. A list block is the fix and the better
     message, and it is what the digest already does with goals. */
  ok('several birthdays on one day go in one message, as a list',
     /kind: 'list', items: names\.map/.test(src))

  /* Dates without a timezone are the bug that produces one wrong email in
     March and nothing reproducible in June. */
  ok('the birthday date is resolved in the group timezone',
     /timeZone: tz/.test(src) && /monthDayAhead\(\(g as any\)\.timezone/.test(src))
  ok('and profiles.birthday is read as text, not parsed into a Date',
     /iso\.slice\(5, 7\)/.test(src) && !/new Date\(b\)/.test(src))
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

/* --- the single-file copy has not fallen behind ------------------------- */

{
  /* bundled.ts is what gets pasted into the Supabase dashboard editor, which
     is the only way to deploy this function without a terminal. A stale copy
     is the worst kind: the repo is correct, the deployed function is not, and
     nothing on either side says so. Regenerated in memory and compared. */
  const onDisk = readFileSync(
    join(here, '..', '..', 'supabase', 'functions', 'notify', 'bundled.ts'),
    'utf8',
  )
  ok('bundled.ts matches what the script would write now',
     onDisk === bundle(),
     'run: node scripts/bundle-notify.mjs')

  ok('and it says it is generated, at the top',
     onDisk.slice(0, 200).includes('GENERATED FILE'))

  /* The two hazards of concatenating these particular files. */
  ok('only one SITE is declared',
     (onDisk.match(/^const SITE = /gm) ?? []).length === 1,
     String((onDisk.match(/^const SITE = /gm) ?? []).length))
  ok('the inlined module is not still imported',
     !onDisk.includes("from './template.ts'"))
  ok('and the import that must survive did',
     onDisk.includes("from 'https://esm.sh/@supabase/supabase-js@2'"))

  /* Pasted into a dashboard editor, an import buried three hundred lines down
     reads as a mistake even though ES modules hoist it. */
  const firstImport = onDisk.indexOf('import ')
  const firstCode = onDisk.indexOf('const INK')
  ok('imports sit above the code', firstImport > 0 && firstImport < firstCode,
     `${firstImport} vs ${firstCode}`)

  /* The whole point of the bundle: both halves are actually in it. */
  ok('the bundle contains the layout', onDisk.includes('function layout('))
  ok('and the sender', onDisk.includes('Deno.serve('))
  ok('and both languages of copy', onDisk.includes('nudgeFoot') && onDisk.includes("fr: {"))
}


/* --- the ceiling gives the claim back ------------------------------------ */

{
  /**
   * THE BUG THIS SECTION EXISTS FOR.
   *
   * Every send claims a row in notifications_log first, and the unique
   * constraint on it is what makes a duplicate impossible. Nothing gave the
   * row back when the send did not happen, so a refused send, an unverified
   * sending domain or one bad minute at Resend cost somebody their only
   * message of that cycle, permanently, with nothing written down anywhere.
   *
   * Worse: with RESEND_API_KEY unset, send() returned true. Rows claimed,
   * {"ok":true} returned, not one message sent, and every person it touched
   * left unmailable. One missing secret, silently, forever.
   */
  ok('a claim can be given back', /async function release\(/.test(src))
  ok('and releasing is what happens when nothing was sent',
     /if \(result === 'sent'\)[\s\S]{0,120}return[\s\S]{0,200}await release\(/.test(src))

  /* All three senders have to settle, or the one that does not is the one that
     silently keeps its claim. Counted rather than named so a fourth kind
     cannot be added without one. */
  /**
   * Four, not five, and the fifth is deliberate.
   *
   * The cycle reminder does not claim a row in notifications_log and so has
   * nothing to settle. That table keys on (user_id, cycle_id, kind) with
   * cycle_id not null, where a cycle is a GROUP's check-in period; the cycle
   * reminder has to work for somebody with no group at all, so anchoring it
   * there would mean it silently never fired for exactly the people using the
   * app alone. Its ceiling is notification_preference.cycle_reminded_for,
   * asserted separately below.
   */
  const settles = (src.match(/await settle\(/g) ?? []).length
  ok('every sender that claims also settles', settles === 4, String(settles))

  ok('the cycle reminder has a ceiling of its own instead',
     /cycle_reminded_for/.test(src),
     'without it the reminder repeats every hour on the day it is due')
  ok('and it is stamped before the send, not after',
     src.indexOf('cycle_reminded_for: forDate') < src.indexOf('const outcome = await send(who.to, c.cycleSubject'),
     'stamping afterwards lets two overlapping runs both send it')

  ok('a missing key is no longer reported as a send',
     /return 'dry-run' as const/.test(src) && !/console\.log\('\[dry-run\]'[\s\S]{0,80}return true/.test(src))

  /* The run says what it did. net._http_response is the only window into this
     function from the SQL editor, and {"ok":true} looked the same whether it
     sent four messages or none. */
  ok('the response reports whether Resend is configured',
     /resend: Boolean\(RESEND_KEY\)/.test(src))
  ok('and how many of each kind went out', /sent: tally/.test(src))

  /**
   * EVERY KIND PASSED TO claim() IS IN THE TYPE.
   *
   * claim was typed 'digest' | 'nudge' while sendBirthdays passed 'birthday'.
   * That is a type error, and Supabase type-checks an Edge Function when it
   * deploys, so every deploy after birthdays were added had something to
   * complain about. A function that will not deploy is indistinguishable, from
   * the outside, from one that deploys and sends nothing.
   *
   * Checked textually rather than with tsc, which is not a dependency of this
   * project and would make the suite need a toolchain to run.
   */
  const union = src.match(/type Kind = ([^\n]+)/)?.[1] ?? ''
  const declared = [...union.matchAll(/'(\w+)'/g)].map((m) => m[1])
  const used = [...src.matchAll(/claim\([^,]+,[^,]+,\s*'(\w+)'\)/g)].map((m) => m[1])

  ok('claim has a named union of kinds', declared.length >= 3, union)
  ok('and it is the same set the database allows',
     declared.slice().sort().join() === ['birthday', 'digest', 'group_goal', 'nudge'].sort().join(),
     declared.join())
  for (const kind of [...new Set(used)]) {
    ok(`claim('${kind}') is a kind claim accepts`, declared.includes(kind), union)
  }
  ok('all four kinds are actually claimed somewhere',
     new Set(used).size === 4, [...new Set(used)].join())
}


/* --- delivered is not the same as received ------------------------------- */

{
  /**
   * Resend reported Delivered for a screenful of messages and not one person
   * had received anything. Delivered means the receiving server ACCEPTED the
   * message; what Gmail does with it after that is a separate decision, and a
   * bulk sender with no unsubscribe header and no reply address is one it
   * files under Promotions or Spam without telling anybody.
   *
   * These are the cheapest signals available and the message carried none.
   */
  ok('every message offers a way to unsubscribe',
     /'List-Unsubscribe': UNSUB/.test(src))
  ok('and it is a mailto, which needs no endpoint',
     /const UNSUB = `<mailto:\$\{SUPPORT\}/.test(src))

  /* One-click unsubscribe means a provider POSTs to a URL and expects the
     person to be unsubscribed by the time it answers. Nothing in this app
     answers such a POST, so declaring it would promise something that does not
     exist: the provider tries, fails, and trusts the sender less than before. */
  ok('and one-click is NOT claimed, because nothing here could honour it',
     !/List-Unsubscribe-Post/.test(CODE))

  ok('a reply goes somewhere a person reads', /reply_to: SUPPORT/.test(src))

  /* Resend's shared sandbox domain is accepted by everyone and trusted by
     nobody: thousands of unrelated senders, none of them authenticated. If
     MAIL_FROM still points at it, deliverability is the whole problem and no
     amount of reading this function will show it, so the run says so. */
  ok('the run reports whether it is sending from the sandbox domain',
     /sandboxDomain: MAIL_FROM\.includes\('resend\.dev'\)/.test(src))

  /**
   * ONE SENDING ADDRESS FOR THE WHOLE PRODUCT.
   *
   * The default was Resend's sandbox, and the deploy note suggested copying
   * MAIL_FROM="Friends <hi@yourdomain>". The sign-in codes go out as hello@,
   * because that is what Supabase's mail settings use, so following that
   * example split the product across two senders on one domain.
   *
   * Providers build reputation per address, not only per domain. A verified
   * domain gets a message accepted; it does not decide which folder it lands
   * in. hello@ had weeks of sign-in mail behind it; hi@ had sent nothing until
   * nine near-identical messages went out at once.
   */
  const from = src.match(/const MAIL_FROM = [^\n]*\?\? '([^']+)'/)?.[1] ?? ''
  ok('the default sender is not the sandbox domain', !from.includes('resend.dev'), from)
  ok('and it is the address the sign-in codes already come from',
     from.includes('hello@'), from)
  ok('the deploy note no longer suggests a second address',
     !/MAIL_FROM="Friends <hi@/.test(CODE))
}

console.log(`\nnotifyCopy\n\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
