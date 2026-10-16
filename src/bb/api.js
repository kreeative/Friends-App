import { supabase } from '../lib/supabase'

/**
 * The calls to /api/bb/*, with the session token.
 *
 * Every answer comes back as { ok, status, data } and never throws: a page
 * decides what to say from `data.error` (src/bb/errors.js), and a dropped
 * network is { ok: false, status: 0, data: { error: 'offline' } } rather than
 * an exception halfway through an upload loop.
 */
async function token() {
  const { data } = await supabase.auth.getSession()
  return data?.session?.access_token ?? ''
}

export async function call(action, body = {}) {
  try {
    const res = await fetch(`/api/bb/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
      body: JSON.stringify(body),
    })
    let data = null
    try {
      data = await res.json()
    } catch {
      data = { error: res.ok ? null : 'bad_answer' }
    }
    return { ok: res.ok, status: res.status, data: data ?? {} }
  } catch {
    return { ok: false, status: 0, data: { error: 'offline' } }
  }
}

/**
 * The coach, streamed: onText gets each piece as it is written. Resolves to
 * { ok, status, error, text }. An error marker at the end of the stream
 * ([[error:busy]]) is taken off the text and returned as `error`.
 */
export async function streamCoach(body, onText) {
  let res
  try {
    res = await fetch('/api/bb/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
      body: JSON.stringify(body),
    })
  } catch {
    return { ok: false, status: 0, error: 'offline', text: '' }
  }
  if (!res.ok || !res.body) {
    let data = {}
    try {
      data = await res.json()
    } catch {
      /* not JSON */
    }
    return { ok: false, status: res.status, error: data.error ?? 'bad_answer', data, text: '' }
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    text += decoder.decode(value, { stream: true })
    onText?.(text.replace(/\n*\[\[error:[a-z_]+\]\]\s*$/, ''))
  }
  text += decoder.decode()
  const marker = text.match(/\[\[error:([a-z_]+)\]\]\s*$/)
  const clean = text.replace(/\n*\[\[error:[a-z_]+\]\]\s*$/, '')
  return { ok: !marker, status: res.status, error: marker ? marker[1] : null, text: clean }
}
