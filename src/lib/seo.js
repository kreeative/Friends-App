/**
 * What each URL should tell a crawler about itself.
 *
 * Pure and importless, like budget.js and calendar.js, so `npm test` runs it
 * under plain node.
 *
 * WHY THIS HAD TO EXIST BEFORE THE SITE WAS SUBMITTED ANYWHERE.
 *
 * index.html carries `<link rel="canonical" href="https://richandfriends.xyz/">`,
 * and vercel.json rewrites every path that is not /api to that same file. So
 * /about, /books and /how-it-works were each served HTML declaring that the
 * canonical version of the page was the HOME PAGE.
 *
 * That is not a missing optimisation, it is an instruction. A canonical tag
 * pointing somewhere else tells Google "do not index this, index that", and
 * Google obeys it. Submitting the sitemap in that state would have listed
 * seven URLs, six of which asked to be dropped, and Search Console would have
 * reported every one of them back as "Alternate page with proper canonical
 * tag" — a report that looks like a crawling problem and is actually the site
 * doing exactly what it was told.
 *
 * og:url had the same fault, so every page shared on a phone previewed as the
 * home page whatever it actually was.
 *
 * A single-page app cannot fix this in static HTML: there is one file. It has
 * to be set per route once React knows the route, which Google's renderer
 * does process. That is weaker than serving it correctly per URL and it is
 * what this architecture allows.
 *
 * THREE PATHS REACH THE SAME CHAPTER.
 *
 * /books/:slug is the real one. /library/:slug is what the signed-in app
 * links to and /lectures/:slug is the French word people type. All three
 * render the same words, which without a canonical is three copies of one
 * page competing with each other. They now all name /books/:slug.
 */

/** Where the site actually lives. One place, so a move is one line. */
export const ORIGIN = 'https://richandfriends.xyz'

/**
 * Pages behind the sign-in.
 *
 * Listed as prefixes rather than exact paths because most of them have
 * children: /goals/new, /g/<id>, /legal is not one of these but /goals/x/edit
 * is. They are noindex rather than merely absent from the sitemap, because a
 * URL can be found without a sitemap — a shared link, a browser's history sync,
 * a referrer header — and "not advertised" is not "not indexed".
 *
 * The app requires a session anyway, so a crawler that follows one gets the
 * sign-in screen. What it must not do is file that screen under six different
 * URLs as six thin duplicate pages.
 */
export const PRIVATE_PREFIXES = [
  '/signin',
  '/start',
  '/me',
  '/settings',
  '/money',
  '/goals',
  '/checkin',
  '/proofs',
  '/g/',
]

/** Aliases, and the one URL they should all point at. */
const ALIAS = {
  '/library': '/books',
  '/lectures': '/books',
  /* Same shape as the library's two spellings: /etudes is canonical because
     the readers of these pages are francophone, and /studies renders the same
     thing for an English link so a shared address opens rather than bouncing. */
  '/studies': '/etudes',
}

/**
 * TITLES AND DESCRIPTIONS ARE NOT HERE.
 *
 * They were, briefly, as a table of English strings. They belong to the pages,
 * because they come from the page's own content in the reader's own language:
 * About takes them from the essay it is showing, a chapter from the book, and
 * the marketing pages from src/content/landing.js, which has a French half.
 * A table here would be a second copy in one language, drifting from the first
 * the day anybody edited the copy.
 *
 * usePageMeta in src/lib/pageMeta.js is where that lives. This module answers
 * only what is true of the URL rather than of the words on it.
 */

/**
 * Strip the noise a URL picks up on its way to a crawler.
 *
 * A trailing slash, a utm tag from a shared link, a #section from a table of
 * contents. All three make the same page look like a different one, and the
 * canonical exists precisely to say that they are not.
 *
 * The root is the one path that keeps its slash: "" is not a URL.
 */
export function normalisePath(pathname) {
  let path = String(pathname ?? '/')

  const cut = Math.min(
    ...[path.indexOf('?'), path.indexOf('#')].filter((i) => i >= 0).concat([path.length]),
  )
  path = path.slice(0, cut)

  if (!path.startsWith('/')) path = `/${path}`
  path = path.replace(/\/{2,}/g, '/')
  if (path.length > 1) path = path.replace(/\/+$/, '')

  return path || '/'
}

/** Is this one of the signed-in screens? */
export function isPrivate(pathname) {
  const path = normalisePath(pathname)
  return PRIVATE_PREFIXES.some((p) =>
    p.endsWith('/') ? path.startsWith(p) : path === p || path.startsWith(`${p}/`),
  )
}

/**
 * The one URL that should represent this page.
 *
 * Aliases fold onto /books, both bare and with a slug. Everything else is
 * itself, normalised.
 */
export function canonicalPath(pathname) {
  const path = normalisePath(pathname)

  for (const [alias, real] of Object.entries(ALIAS)) {
    if (path === alias) return real
    if (path.startsWith(`${alias}/`)) return `${real}${path.slice(alias.length)}`
  }

  return path
}

/** The two facts about this URL that the head has to carry. */
export function seoFor(pathname) {
  const path = canonicalPath(pathname)

  return {
    path,
    canonical: `${ORIGIN}${path}`,
    noindex: isPrivate(path),
  }
}

/**
 * Every URL worth putting in a sitemap.
 *
 * Built here rather than typed into the XML by hand, so the file and the
 * router cannot drift: the last sitemap listed seven URLs and missed the
 * legal pages entirely, which are public, linked from every footer, and the
 * only pages on the site anybody is ever required to read.
 *
 * @param slugs the chapter slugs, passed in because they live in
 *              src/content/previews.js and this module has no imports.
 */
/**
 * Les etudes publiees, par slug.
 *
 * Ecrit ici plutot qu'importe de content/studies.js, parce que ce fichier est
 * pur et sans import : c'est ce qui permet a scripts/sitemap.mjs de le lancer
 * sous node sans bundler. Le probe verifie que les deux listes concordent, donc
 * un ajout oublie ici se voit.
 */
export const STUDY_SLUGS = ['epargner-a-19-ans']

export function sitemapPaths(slugs = []) {
  return [
    '/',
    '/how-it-works',
    '/about',
    '/books',
    ...slugs.map((s) => `/books/${s}`),
    /* Les etudes. Publiques, sans compte, et c'est tout l'interet : une page
       qui publie des chiffres verifiables doit etre trouvable. /studies est
       l'alias anglais et n'est pas liste, pour la meme raison que /library et
       /lectures ne le sont pas : une seule adresse canonique par page. */
    '/etudes',
    ...STUDY_SLUGS.map((s) => `/etudes/${s}`),
    '/legal/terms',
    '/legal/privacy',
    '/legal/notice',
  ]
}
