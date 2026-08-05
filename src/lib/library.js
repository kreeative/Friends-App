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
  const [{ data: books }, { data: owned }, { data: progress }] = await Promise.all([
    supabase.from('books').select('*').eq('published', true).order('created_at'),
    supabase.from('entitlements').select('book_id'),
    supabase.from('reading_progress').select('book_id, chapter_id, scroll_pct'),
  ])

  const ownedIds = new Set((owned ?? []).map((e) => e.book_id))
  const progressBy = Object.fromEntries((progress ?? []).map((p) => [p.book_id, p]))

  return (books ?? []).map((b) => ({
    ...b,
    owned: ownedIds.has(b.id),
    progress: progressBy[b.id] ?? null,
  }))
}

/** Titles and preview flags only — never bodies. Safe for the drawer. */
export async function listChapters(bookId) {
  const { data } = await supabase
    .from('chapters')
    .select('id, idx, title, is_preview, word_count')
    .eq('book_id', bookId)
    .order('idx')
  return data ?? []
}

/** One chapter, with its body. Returns null when not entitled — by policy. */
export async function getChapter(chapterId) {
  const { data } = await supabase
    .from('chapters')
    .select('id, book_id, idx, title, body, is_preview')
    .eq('id', chapterId)
    .maybeSingle()
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

  const res = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ book_id: bookId }),
  })

  const payload = await res.json().catch(() => ({}))
  if (!res.ok) return { error: payload.error || `Checkout failed (${res.status})` }
  if (!payload.url) return { error: 'Checkout returned no URL' }

  window.location.href = payload.url
  return {}
}
