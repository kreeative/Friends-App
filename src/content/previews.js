/**
 * The catalogue and the free chapters, bundled into the app.
 *
 * The free preview is marketing. It is meant to be read by people who have
 * not signed in, have not paid, and have no reason to wait on a database
 * round trip to find out whether the book is any good. Serving it from the
 * bundle rather than from Supabase means:
 *
 *   it works before any SQL has been run, which is the state the live site
 *   is in right now and the reason "Book not found" was showing;
 *   it works when Supabase is down, slow, or unreachable;
 *   it is in the HTML payload, so a crawler reads the actual writing rather
 *   than an empty div, which is worth more for search than any meta tag.
 *
 * The paid chapters are NOT here and must never be. They stay in the database
 * behind the row-level policy, which is the only thing standing between a
 * paywall and a copy-paste. Anything in this file is published to every
 * visitor the moment they load the page, and that is the correct treatment
 * for exactly the free preview and nothing else.
 *
 * The prose is imported from the manuscripts rather than pasted, so there is
 * one copy of chapter one in this repository and editing content/books/ is
 * still the only way to change it.
 */
const RAW = import.meta.glob('../../content/books/*/01-*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
})

/** '../../content/books/design-beats-discipline/01-x.md' -> the slug. */
function slugOf(path) {
  return path.split('/').slice(-2)[0]
}

const BODY = Object.fromEntries(Object.entries(RAW).map(([p, text]) => [slugOf(p), text]))

/**
 * Everything the storefront and the reader need in order to render without a
 * database. Kept in the same order and with the same values as
 * 07_books_all_in_one.sql, which remains the source of truth once it has run.
 *
 * The chapter titles for the paid chapters are here on purpose: titles are
 * not the product and listing them is how someone decides the other eight are
 * worth twelve dollars. Only the bodies are withheld.
 */
export const PREVIEW_BOOKS = [
  {
    slug: 'story-you-tell',
    title: 'The Story You Tell About Ability',
    subtitle: 'Mindset, honestly',
    description:
      'What you believe about ability changes what you do after failure, which is the only moment that matters. Growth mindset has been oversold; this is where it actually works.',
    price_cents: 1200,
    currency: 'CAD',
    chapters: [
      'The moment after failure',
      'Fixed and growth, and what the replications actually showed',
      'False growth mindset',
      'Why you think you failed',
      'Learned helplessness and its reverse',
      'Stress as a signal, not a threat',
      'Reappraisal as a trainable skill',
      'Practice, and the ceiling on practice',
      'What to do Monday',
    ],
  },
  {
    slug: 'evidence-of-yourself',
    title: 'Evidence of Yourself',
    subtitle: 'Confidence as a byproduct, not a feeling',
    description:
      'Confidence is not manufactured internally and then acted on. It is the residue of accumulated evidence that you can handle things. Most advice inverts this and fails.',
    price_cents: 1200,
    currency: 'CAD',
    chapters: [
      'Confidence follows action',
      'Bandura’s four sources',
      'What doesn’t work, and why it’s still everywhere',
      'Self-esteem is a trap; self-compassion isn’t',
      'Nobody is watching as closely as you think',
      'Acting before feeling ready',
      'The impostor experience',
      'Building an evidence file',
      'Confidence under actual pressure',
    ],
  },
  {
    slug: 'design-beats-discipline',
    title: 'Design Beats Discipline',
    subtitle: 'Why willpower is not the variable',
    description:
      'People who look disciplined are mostly not resisting more. They have arranged their lives so there is less to resist.',
    price_cents: 1200,
    currency: 'CAD',
    chapters: [
      'The fuel tank that wasn’t',
      'What the disciplined actually do',
      'Habits are context, not character',
      'If-then',
      'Friction is the lever',
      'Bundling and precommitment',
      'Sixty-six days, give or take a lot',
      'The lapse is not the problem',
      'Identity and consistency',
      'Building your own system',
    ],
  },
]

/**
 * The catalogue, shaped exactly like a row from `books` so the Library can
 * render it without knowing where it came from. `local: true` is the one
 * extra field, and the UI uses it to avoid offering a Buy button for a
 * catalogue that has no database behind it to record the purchase in.
 */
export function localBooks() {
  return PREVIEW_BOOKS.map((b) => ({
    id: `local:${b.slug}`,
    slug: b.slug,
    title: b.title,
    subtitle: b.subtitle,
    description: b.description,
    price_cents: b.price_cents,
    currency: b.currency,
    published: true,
    owned: false,
    progress: null,
    local: true,
  }))
}

/** One book, with its chapter list, from the bundle. Null if the slug is unknown. */
export function localBook(slug) {
  const b = PREVIEW_BOOKS.find((x) => x.slug === slug)
  if (!b) return null

  const chapters = b.chapters.map((title, i) => ({
    id: `local:${b.slug}:${i + 1}`,
    book_id: `local:${b.slug}`,
    idx: i + 1,
    title,
    is_preview: i === 0,
    word_count: i === 0 ? (BODY[b.slug] ?? '').trim().split(/\s+/).length : null,
  }))

  return { book: { ...localBooks().find((x) => x.slug === slug) }, chapters }
}

/**
 * The body of chapter one, or null.
 *
 * Null for every other chapter, deliberately and permanently. This function is
 * the entire public surface of the free text, and it can only ever return the
 * preview, so no amount of calling it differently produces a paid chapter.
 */
export function localChapterBody(slug, idx) {
  if (idx !== 1) return null
  return BODY[slug] ?? null
}
