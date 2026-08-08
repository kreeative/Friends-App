import { supabase } from './supabase'

/**
 * All library reads go through here.
 *
 * Two rules the UI must not be able to break:
 *   nothing ever fetches a whole book — one chapter per request, always;
 *   nothing decides what you may read. RLS does that, server-side, per query.
 * If a body comes back, you were entitled to it; if you were not, the row is
 * simply absent. There is no client-side filtering anywhere in this file.
 */

export async function listBooks() {
  const [{ data: books, error }, { data: owned }, { data: progress }] = await Promise.all([
    supabase.from('books').select('*').eq('published', true).order('created_at'),
    supabase.from('entitlements').select('book_id'),
    supabase.from('reading_progress').select('book_id, chapter_id, scroll_pct'),
  ])

  /* The catalogue read is the one that has to be believed. Swallowing this
     turned a missing table into an empty array, and the page then said "no
     books yet" — a sentence that is both false and unactionable, because the
     books do exist and the fix is to run supabase/07_books_all_in_one.sql.
     The other two are left soft on purpose: with no entitlements table you
     should still see the catalogue and the prices, just nothing marked as
     owned. */
  if (error) throw error

  const ownedIds = new Set((owned ?? []).map((e) => e.book_id))
  const progressBy = Object.fromEntries((progress ?? []).map((p) => [p.book_id, p]))

  return (books ?? []).map((b) => ({
    ...b,
    owned: ownedIds.has(b.id),
    progress: progressBy[b.id] ?? null,
  }))
}

/**
 * Titles and preview flags only, never bodies. Safe for the drawer.
 *
 * Throws rather than returning []. An empty list and a failed request are
 * completely different situations that used to be indistinguishable here, and
 * the reader downstream turned both into the same blank page.
 */
export async function listChapters(bookId) {
  /* chapter_index, not chapters. The table's policy hides the whole row of
     anything unbought, so reading the table returned one chapter for a
     nine-chapter book: no contents, no next chapter, and no sign of what
     buying would get you. The view carries the titles and does not have a
     `body` column at all. */
  const { data, error } = await supabase
    .from('chapter_index')
    .select('id, idx, title, is_preview, word_count')
    .eq('book_id', bookId)
    .order('idx')
  if (error) throw error
  return data ?? []
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

export async function startCheckout(bookId) {
  const { data: sess } = await supabase.auth.getSession()
  const token = sess?.session?.access_token
  if (!token) return { error: 'Not signed in' }

  let res
  try {
    res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ book_id: bookId }),
    })
  } catch (e) {
    return { error: `Could not reach the checkout endpoint. ${e?.message ?? e}` }
  }

  /* /api/checkout is a serverless function, so it only exists on the deployed
     site. Anywhere else — `vite dev`, a plain static host — the request falls
     through to index.html and a page of HTML comes back with a 200. Parsing
     that and reporting "no URL in the response" is true and useless; say what
     actually happened. */
  if (!(res.headers.get('content-type') ?? '').includes('application/json')) {
    return {
      error: `/api/checkout did not answer as an API (HTTP ${res.status}). Buying works on the deployed site — not on a local dev server.`,
    }
  }

  const payload = await res.json().catch(() => ({}))
  if (!res.ok) return { error: payload.error || `Checkout failed (${res.status})` }
  if (!payload.url) return { error: 'Checkout returned no URL' }

  window.location.href = payload.url
  return {}
}
