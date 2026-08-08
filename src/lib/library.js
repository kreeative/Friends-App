import { supabase } from './supabase'

/**
 * All library reads go through here.
 *
 * Two rules the UI must not be able to break:
 *   nothing ever fetches a whole book, one chapter per request, always;
 *   nothing decides what you may read. RLS does that, server-side, per query.
 * If a body comes back, you were entitled to it; if you were not, the row is
 * simply absent. There is no client-side filtering anywhere in this file.
 */

/**
 * The live price list, from Stripe.
 *
 * Fetched once and remembered, because it is the same for everybody and does
 * not change while somebody is looking at the page. Any failure is silent and
 * yields an empty map: the shop then shows books.price_cents, which is what it
 * always used to show.
 */
let priceList = null

/** Exported for the public preview, which has no catalogue row to read from. */
export async function livePrice(ref) {
  const list = await livePrices()
  return list?.[ref] ?? null
}

async function livePrices() {
  if (priceList) return priceList
  try {
    const res = await fetch('/api/prices')
    if (!(res.headers.get('content-type') ?? '').includes('application/json')) {
      // Not deployed, or a dev server answering with index.html. Not an error.
      priceList = {}
      return priceList
    }
    const body = await res.json()
    priceList = body?.prices ?? {}
  } catch {
    priceList = {}
  }
  return priceList
}

export async function listBooks() {
  const [{ data: books, error }, { data: owned }, { data: progress }, prices] = await Promise.all([
    supabase.from('books').select('*').eq('published', true).order('created_at'),
    supabase.from('entitlements').select('book_id'),
    supabase.from('reading_progress').select('book_id, chapter_id, scroll_pct'),
    livePrices(),
  ])

  /* The catalogue read is the one that has to be believed. Swallowing this
     turned a missing table into an empty array, and the page then said "no
     books yet", a sentence that is both false and unactionable, because the
     books do exist and the fix is to run supabase/07_books_all_in_one.sql.
     The other two are left soft on purpose: with no entitlements table you
     should still see the catalogue and the prices, just nothing marked as
     owned. */
  if (error) throw error

  const ownedIds = new Set((owned ?? []).map((e) => e.book_id))
  const progressBy = Object.fromEntries((progress ?? []).map((p) => [p.book_id, p]))

  const priced = (books ?? []).map((b) => {
    /* Stripe first, the column second. The two disagreed on the live site,
       which is the worst way for a price to fail: the shelf edge said one
       number and the till was going to take another. */
    const live = prices?.[b.id]
    return {
      ...b,
      price_cents: live?.cents ?? b.price_cents,
      currency: live?.currency ?? b.currency,
      owned: ownedIds.has(b.id),
      progress: progressBy[b.id] ?? null,
    }
  })

  return dedupe(priced)
}

/**
 * One card per book, and only books somebody could buy.
 *
 * The live catalogue picked up a second set of rows: the same three books
 * under different slugs, priced at zero, left over from before
 * 07_books_all_in_one.sql created the real ones. Six cards, three of them
 * unbuyable, which is what the shop was showing.
 *
 * 15_dedupe_books.sql retires them properly. This is the belt to that braces,
 * because a storefront should not be capable of listing the same title twice
 * whatever state the table is in, and because a fix that needs somebody to
 * paste SQL before the page looks right is not finished.
 *
 * Two filters, in the order that matters.
 *
 * The first is the one that actually catches these. Matching on the title does
 * not: the leftovers are titled "Story You Tell" and the real book is "The
 * Story You Tell About Ability". What every leftover has in common is that it
 * costs nothing and names no Stripe object, so Checkout has nothing to charge
 * for. That is not a free book, this app has no such thing; it is a row that
 * cannot be sold. Owned books survive whatever their price, because a book
 * vanishing off your own shelf is worse than a duplicate card.
 *
 * The second catches a genuine duplicate that is priced. The survivor is the
 * one somebody can act on: wired to Stripe, then priced, then already owned.
 */
function dedupe(books) {
  const sellable = books.filter(
    (b) => b.owned || b.price_cents > 0 || (b.stripe_ref ?? '').trim() !== '',
  )

  const key = (b) =>
    (b.title ?? '')
      .toLowerCase()
      .replace(/^(the|a|an)\s+/, '')
      .replace(/[^a-z0-9]/g, '')

  const rank = (b) => (b.stripe_ref ? 4 : 0) + (b.price_cents > 0 ? 2 : 0) + (b.owned ? 1 : 0)

  const best = new Map()
  for (const b of sellable) {
    const k = key(b)
    if (!k) continue
    const held = best.get(k)
    if (!held || rank(b) > rank(held)) best.set(k, b)
  }
  return [...best.values()]
}

/**
 * Titles and preview flags only, never bodies. Safe for the drawer.
 *
 * Throws rather than returning []. An empty list and a failed request are
 * completely different situations that used to be indistinguishable here, and
 * the reader downstream turned both into the same blank page.
 */
export async function listChapters(bookId) {
  const cols = 'id, idx, title, is_preview, word_count'

  /* chapter_index, not chapters. The table's policy hides the whole row of
     anything unbought, so reading the table returned one chapter for a
     nine-chapter book: no contents, no next chapter, and no sign of what
     buying would get you. The view carries the titles and has no `body`
     column at all. */
  const { data, error } = await supabase
    .from('chapter_index')
    .select(cols)
    .eq('book_id', bookId)
    .order('idx')

  if (!error) return data ?? []

  /**
   * The view is newer than the table it reads, and a catalogue set up before
   * 11_chapter_index.sql existed has the one without the other. Falling back
   * to the table means that database still opens its books -- with a shorter
   * contents list, because the policy hides what you have not bought, which
   * is the exact limitation the view was created to remove.
   *
   * Only for a missing relation. A policy error or a dropped connection is
   * not something to paper over with a second query.
   */
  const raw = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase()
  const noView =
    raw.includes('pgrst205') ||
    raw.includes('42p01') ||
    raw.includes('schema cache') ||
    (raw.includes('does not exist') && raw.includes('relation'))

  if (!noView) throw error

  const fallback = await supabase.from('chapters').select(cols).eq('book_id', bookId).order('idx')
  if (fallback.error) throw fallback.error
  return fallback.data ?? []
}

/**
 * One chapter, with its body.
 *
 * Three outcomes, and they must not be conflated:
 *
 *   { chapter }        you may read it
 *   null               the policy filtered it out. You have not bought this
 *                      book and the chapter is not the free preview. This is
 *                      the paywall working, not a failure.
 *   throws             the request itself failed.
 *
 * The old version returned null for the last two alike, so a missing table or
 * a broken connection rendered as "buy this to unlock" on a chapter that is
 * free to everyone.
 */
export async function getChapter(chapterId) {
  const { data, error } = await supabase
    .from('chapters')
    .select('id, book_id, idx, title, body, is_preview')
    .eq('id', chapterId)
    .maybeSingle()
  if (error) throw error
  return data ?? null
}

export async function saveProgress(userId, bookId, chapterId, scrollPct) {
  await supabase.from('reading_progress').upsert(
    {
      user_id: userId,
      book_id: bookId,
      chapter_id: chapterId,
      scroll_pct: Math.max(0, Math.min(100, Math.round(scrollPct * 100) / 100)),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,book_id' },
  )
}

export async function listHighlights(bookId) {
  const { data } = await supabase
    .from('highlights')
    .select('*')
    .eq('book_id', bookId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function addHighlight({ userId, bookId, chapterId, quotedText, note }) {
  const { data, error } = await supabase
    .from('highlights')
    .insert({
      user_id: userId,
      book_id: bookId,
      chapter_id: chapterId,
      quoted_text: quotedText.slice(0, 1200),
      note: note || null,
    })
    .select()
    .maybeSingle()
  return { data, error }
}

export async function removeHighlight(id) {
  await supabase.from('highlights').delete().eq('id', id)
}

/**
 * Sharing is always an explicit act. Nothing in the purchase path calls this;
 * it only ever runs because someone pressed a button.
 */
export async function shareToGroup({ userId, groupId, bookId, kind, highlightId, message }) {
  const { error } = await supabase.from('reading_shares').insert({
    user_id: userId,
    group_id: groupId,
    book_id: bookId,
    kind,
    highlight_id: highlightId ?? null,
    message: message || null,
  })
  return { error }
}

/**
 * Send somebody to Stripe.
 *
 * Takes an id or a slug, because the two storefronts have different things in
 * hand: the signed-in library holds catalogue rows, the public preview renders
 * from the bundle and has only a slug.
 *
 * No longer refuses a signed-out buyer. It used to answer "Not signed in",
 * which meant somebody who had just read the free chapter and wanted the rest
 * was asked to make an account before the shop would take their money. Stripe
 * collects an email during payment; the webhook matches it to an account, or
 * parks the purchase until that account exists. The token is still sent when
 * there is one, because a purchase that can be written straight against a user
 * id beats one that has to be matched afterwards.
 */
export async function startCheckout(ref) {
  const { data: sess } = await supabase.auth.getSession()
  const token = sess?.session?.access_token

  const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref ?? '')
  const request = isId ? { book_id: ref } : { slug: ref }

  let res
  try {
    res = await fetch('/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(request),
    })
  } catch (e) {
    return { error: `Could not reach the checkout endpoint. ${e?.message ?? e}` }
  }

  /* /api/checkout is a serverless function, so it only exists on the deployed
     site. Anywhere else (`vite dev`, a plain static host) the request falls
     through to index.html and a page of HTML comes back with a 200. Parsing
     that and reporting "no URL in the response" is true and useless; say what
     actually happened. */
  if (!(res.headers.get('content-type') ?? '').includes('application/json')) {
    return {
      error: `/api/checkout did not answer as an API (HTTP ${res.status}). Buying works on the deployed site, not on a local dev server.`,
    }
  }

  const payload = await res.json().catch(() => ({}))
  if (!res.ok) return { error: payload.error || `Checkout failed (${res.status})` }
  if (!payload.url) return { error: 'Checkout returned no URL' }

  window.location.href = payload.url
  return {}
}
