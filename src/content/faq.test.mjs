/**
 * node src/content/faq.test.mjs
 *
 * This page exists because two grey slabs above a button were too long to be
 * read. So the checks are as much about the SHAPE as the words: a help page
 * that drifts back into a wall has undone the thing it was built for, and one
 * language quietly losing a question is a different help page depending on who
 * is reading it.
 *
 * And nothing on it may address the person who deploys the app. "Set PLAID_ENV
 * in Vercel" was printed on every user's budget screen once; it must not
 * reappear on a page users are actually sent to.
 */
import { FAQ, faqItems } from './faq.js'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}

/* --- the two languages are the same page --------------------------------- */

{
  ok('both languages exist', Boolean(FAQ.fr) && Boolean(FAQ.en))
  ok('same number of groups', FAQ.fr.groups.length === FAQ.en.groups.length,
     `${FAQ.fr.groups.length} vs ${FAQ.en.groups.length}`)

  FAQ.fr.groups.forEach((g, i) => {
    const other = FAQ.en.groups[i]
    /* Ids are matched, not just counts. Two groups in the same order with
       swapped ids would pass a count check and send a French reader to the
       wrong section from a shared anchor. */
    ok(`group ${i + 1} has the same id in both`, g.id === other.id, `${g.id} vs ${other.id}`)
    ok(`group ${g.id} has the same number of questions`,
       g.items.length === other.items.length, `${g.items.length} vs ${other.items.length}`)

    g.items.forEach((item, j) => {
      const twin = other.items[j]
      /* Paragraph counts, because a translation that merges two paragraphs
         into one is where a sentence quietly goes missing. */
      ok(`${g.id} Q${j + 1} has the same number of paragraphs`,
         item.a.length === twin.a.length, `${item.a.length} vs ${twin.a.length}`)
    })
  })

  ok('the same number of questions overall',
     faqItems('fr').length === faqItems('en').length)
  ok('an unknown locale falls back rather than returning nothing',
     faqItems('de').length === faqItems('en').length)
}

/* --- every question is a question, every answer an answer ---------------- */

{
  for (const lang of ['fr', 'en']) {
    for (const item of faqItems(lang)) {
      ok(`${lang}: "${item.q.slice(0, 34)}" is phrased as a question`,
         /\?$/.test(item.q.trim()), item.q)
      ok(`${lang}: "${item.q.slice(0, 34)}" has an answer`,
         Array.isArray(item.a) && item.a.length > 0 && item.a.every((p) => p.length > 20))
    }
  }
}

/* --- it must not become the wall it replaced ----------------------------- */

{
  for (const lang of ['fr', 'en']) {
    for (const item of faqItems(lang)) {
      /* A single paragraph past this length is the slab coming back, one
         accordion at a time. The limit is generous; it is a tripwire, not a
         style rule. */
      const longest = Math.max(...item.a.map((p) => p.length))
      ok(`${lang}: no paragraph in "${item.q.slice(0, 28)}" is a wall`,
         longest < 400, `${longest} chars`)
      ok(`${lang}: "${item.q.slice(0, 28)}" stays under five paragraphs`,
         item.a.length <= 4, `${item.a.length} paragraphs`)
    }
  }
}

/* --- nothing here addresses the operator --------------------------------- */

{
  /* The whole reason the panel was cut down. These are instructions only the
     person who deploys the app can follow, and a help page is not where they
     go: the console is. */
  const FORBIDDEN = /PLAID_ENV|PLAID_SECRET|Vercel|Supabase|localhost|service.role|redeploy|red.ploie/i
  for (const lang of ['fr', 'en']) {
    const c = FAQ[lang]
    const all = [
      c.title, c.lede,
      ...c.groups.flatMap((g) => [g.title, ...g.items.flatMap((i) => [i.q, ...i.a])]),
    ].join(' ')
    ok(`${lang}: no deployment instruction on a page users read`,
       !FORBIDDEN.test(all), (all.match(FORBIDDEN) ?? []).join(' '))
    /* And no bare env var shape, in case a new one is invented later. */
    ok(`${lang}: no environment variable names either`,
       !/\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/.test(all),
       (all.match(/\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/g) ?? []).join(' '))
  }
}

/* --- the answers the bank panel now points at ---------------------------- */

{
  /* The panel says one line and links here. If these three answers ever left,
     the panel would be pointing at a page that no longer explains it. */
  const fr = faqItems('fr').map((i) => i.a.join(' ')).join(' ')
  ok('the coverage answer names mobile money by operator',
     /Orange/.test(fr) && /Wave/.test(fr) && /MTN/.test(fr) && /Moov/.test(fr))
  ok('the test-mode answer explains the refusal is not the user',
     /d.monstration/i.test(fr) && /refus/i.test(fr))
  ok('and something explains why transfers are skipped',
     /deux fois/.test(fr) && /virement/i.test(fr))
}

console.log(`\nfaq\n\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
