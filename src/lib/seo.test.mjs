/**
 * node src/lib/seo.test.mjs
 *
 * The assertion that matters most is the first one in the canonical block: a
 * page other than the home page must not name the home page. That was the
 * live state of every URL on the site, and it is an instruction to Google to
 * drop the page.
 */
import {
  ORIGIN,
  PRIVATE_PREFIXES,
  canonicalPath,
  isPrivate,
  normalisePath,
  seoFor,
  sitemapPaths,
} from './seo.js'

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

console.log('\nseo')

/* --- normalising ------------------------------------------------------- */
eq('root', normalisePath('/'), '/')
eq('a page', normalisePath('/about'), '/about')
eq('a trailing slash is the same page', normalisePath('/about/'), '/about')
eq('so is a doubled one', normalisePath('/about//'), '/about')
eq('doubled separators collapse', normalisePath('/books//story'), '/books/story')
eq('a query string is not part of the page', normalisePath('/about?utm_source=x'), '/about')
eq('nor is a fragment', normalisePath('/about#team'), '/about')
eq('nor both', normalisePath('/about?a=1#b'), '/about')
eq('a missing leading slash is added', normalisePath('about'), '/about')
eq('nothing is the root', normalisePath(''), '/')
eq('undefined is the root', normalisePath(undefined), '/')
eq('the root keeps its slash', normalisePath('//'), '/')
eq('a query on the root', normalisePath('/?ref=twitter'), '/')

/* --- private ----------------------------------------------------------- */
ok('there are private prefixes to check', PRIVATE_PREFIXES.length > 5)
for (const p of ['/journal', '/money', '/goals', '/settings', '/me', '/checkin', '/proofs', '/start', '/signin']) {
  eq(`${p} is private`, isPrivate(p), true)
}
eq('a child of a private route is private', isPrivate('/goals/new'), true)
eq('and a deep one', isPrivate('/goals/abc-123/edit'), true)
eq('a group is private', isPrivate('/g/aaaa-bbbb'), true)
eq('with a trailing slash too', isPrivate('/journal/'), true)
eq('and with a query', isPrivate('/money?x=1'), true)

eq('the home page is not private', isPrivate('/'), false)
eq('nor about', isPrivate('/about'), false)
eq('nor the books index', isPrivate('/books'), false)
eq('nor a chapter', isPrivate('/books/story-you-tell'), false)
eq('nor the legal pages', isPrivate('/legal/terms'), false)
/* The trap: a public path that merely starts with the same letters as a
   private one. /goals is private; /goals-guide would not be. */
eq('a longer name is not the private route', isPrivate('/moneyball'), false)
eq('nor is a prefix collision', isPrivate('/settings-guide'), false)

/* --- canonical --------------------------------------------------------- */
{
  /* THE ONE THAT WAS BROKEN IN PRODUCTION. */
  const about = seoFor('/about')
  ok('a page does not claim to be the home page', about.canonical !== `${ORIGIN}/`, about.canonical)
  eq('it claims to be itself', about.canonical, `${ORIGIN}/about`)

  for (const p of ['/how-it-works', '/books', '/books/story-you-tell', '/legal/privacy']) {
    const s = seoFor(p)
    eq(`${p} is its own canonical`, s.canonical, `${ORIGIN}${p}`)
  }

  eq('the home page still is the home page', seoFor('/').canonical, `${ORIGIN}/`)
}

/* Three URLs, one chapter. Without this they compete with each other. */
eq('library folds onto books', canonicalPath('/library'), '/books')
eq('lectures folds onto books', canonicalPath('/lectures'), '/books')
eq('a library chapter folds onto the books one', canonicalPath('/library/story-you-tell'), '/books/story-you-tell')
eq('a lectures chapter too', canonicalPath('/lectures/evidence-of-yourself'), '/books/evidence-of-yourself')
eq('with a trailing slash', canonicalPath('/lectures/design-beats-discipline/'), '/books/design-beats-discipline')
eq('and with a utm tag from a shared link', canonicalPath('/lectures/story-you-tell?utm_source=whatsapp'), '/books/story-you-tell')
eq('books is already canonical', canonicalPath('/books/story-you-tell'), '/books/story-you-tell')
/* Not a greedy prefix match: /librarian is not /library. */
eq('a similar name is left alone', canonicalPath('/librarything'), '/librarything')

/* --- what the head gets ------------------------------------------------ */
{
  eq('the home page is indexable', seoFor('/').noindex, false)
  eq('so is a chapter', seoFor('/books/story-you-tell').noindex, false)
  eq('so are the legal pages', seoFor('/legal/terms').noindex, false)

  const priv = seoFor('/journal')
  eq('a private page is noindex', priv.noindex, true)
  eq('and still has a canonical', priv.canonical, `${ORIGIN}/journal`)

  /* Titles and descriptions belong to the pages, in the reader's own
     language. This module must not have opinions about them, or two writers
     fight over the same two tags and the winner depends on effect order. */
  ok('no title comes from here', seoFor('/about').title === undefined)
  ok('and no description', seoFor('/about').description === undefined)
}


/* --- the sitemap ------------------------------------------------------- */
{
  const slugs = ['story-you-tell', 'evidence-of-yourself', 'design-beats-discipline']
  const paths = sitemapPaths(slugs)

  ok('the home page is in it', paths.includes('/'))
  ok('the marketing pages are in it', ['/how-it-works', '/about', '/books'].every((p) => paths.includes(p)))
  ok('every chapter is in it', slugs.every((s) => paths.includes(`/books/${s}`)))
  /* The gap in the hand-written sitemap: public, linked from every footer,
     and the only pages anybody is required to read. */
  ok('the legal pages are in it', ['/legal/terms', '/legal/privacy', '/legal/notice'].every((p) => paths.includes(p)))

  eq('no duplicates', new Set(paths).size, paths.length)
  ok('nothing private is in it', !paths.some((p) => isPrivate(p)))
  ok('nothing aliased is in it', !paths.some((p) => canonicalPath(p) !== p))
  ok('every entry is its own canonical', paths.every((p) => seoFor(p).canonical === `${ORIGIN}${p}`))
  ok('called with nothing it still lists the fixed pages', sitemapPaths().includes('/about'))
}

/* --- the origin -------------------------------------------------------- */
ok('the origin is absolute', ORIGIN.startsWith('https://'))
ok('and has no trailing slash to double up', !ORIGIN.endsWith('/'))
ok('so a canonical never doubles its slash', !seoFor('/about').canonical.includes('//about'))

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
