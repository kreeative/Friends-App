import { createClient } from '@supabase/supabase-js'
import { env } from './_env.js'

/**
 * Why a book will not open, answered one link at a time.
 *
 * WHY THIS IS AN ENDPOINT AND NOT A PAGE OF SQL.
 *
 * The reader says "you own this book, the chapter is not loaded", and that
 * sentence is true for four completely different reasons which look identical
 * from a phone:
 *
 *   the books row is missing or not published
 *   the chapter rows were never created          07 not run
 *   the chapter rows still hold placeholder text 08 not run
 *   the entitlement is missing                   the purchase never landed
 *
 * Telling them apart means comparing what the SERVICE ROLE can see against
 * what the CALLER can see, and the difference between those two is exactly
 * what row level security is doing. That is not something a person can work
 * out by reading a table in a dashboard, and it is not something the browser
 * can ask, because the browser only ever sees the filtered half.
 *
 * So this reads both sides and reports the difference.
 *
 * WHAT IT NEVER DOES.
 *
 * It never returns a chapter body. The whole point of the policy above is that
 * paid text does not leave the database for somebody who has not paid, and a
 * diagnostic that dumped a body to prove it exists would be a way to read the
 * book for free. Lengths and counts only.
 *
 * It never reports a secret, for the same reason /api/stripe-health does not:
 * presence is a boolean and that is all a diagnostic may say.
 *
 * And it requires a signed-in caller, because "anybody who guesses the path"
 * is not the audience for a description of what is misconfigured.
 */

const admin = createClient(
  env('supabaseUrl') ?? '',
  env('serviceRole') ?? '',
  { auth: { persistSession: false } },
)

/** Present, absent, or a count. Never a value. */
const PLACEHOLDER = 'PLACEHOLDER.'

export default async function handler(req, res) {
  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Sign in first.' })
  const { data: who } = await admin.auth.getUser(token)
  const user = who?.user
  if (!user) return res.status(401).json({ error: 'That session is not valid.' })

  if (!env('supabaseUrl') || !env('serviceRole')) {
    return res.status(500).json({ error: 'Supabase is not configured on this deployment.' })
  }

  const out = { checks: [], advice: [] }
  const say = (name, status, detail) => out.checks.push({ name, status, detail })

  try {
    /* ---- 1. the catalogue -------------------------------------------- */
    const { data: books, error: bookErr } = await admin
      .from('books')
      .select('id, slug, title, published')
      .order('created_at')

    if (bookErr) {
      say('books', 'missing', bookErr.message)
      out.advice.push('The books table is not there. Run supabase/07_books_all_in_one.sql.')
      return res.status(200).json(out)
    }

    say('books', books.length ? 'ok' : 'empty', `${books.length} row(s)`)
    if (!books.length) {
      out.advice.push('No books at all. Run supabase/07_books_all_in_one.sql.')
      return res.status(200).json(out)
    }

    const unpublished = books.filter((b) => !b.published).map((b) => b.slug)
    if (unpublished.length) {
      say('published', 'problem', unpublished.join(', '))
      out.advice.push(
        `These books are not published, so the policy hides every chapter in them: ${unpublished.join(', ')}.`,
      )
    } else {
      say('published', 'ok', 'all published')
    }

    /* ---- 2. the chapters, per book ----------------------------------- */
    const { data: chapters, error: chErr } = await admin
      .from('chapters')
      .select('id, book_id, idx, is_preview, body')

    if (chErr) {
      say('chapters', 'missing', chErr.message)
      out.advice.push('The chapters table is not there. Run supabase/07_books_all_in_one.sql.')
      return res.status(200).json(out)
    }

    const byBook = {}
    for (const c of chapters ?? []) {
      const b = (byBook[c.book_id] ??= { total: 0, real: 0, placeholder: 0, empty: 0, preview: 0 })
      b.total += 1
      if (c.is_preview) b.preview += 1
      if (!c.body || !c.body.trim()) b.empty += 1
      else if (c.body.includes(PLACEHOLDER)) b.placeholder += 1
      else b.real += 1
    }

    let anyPlaceholder = false
    let anyMissing = false
    for (const b of books) {
      const s = byBook[b.id] ?? { total: 0, real: 0, placeholder: 0, empty: 0, preview: 0 }
      if (s.total === 0) anyMissing = true
      if (s.placeholder > 0 || s.empty > 0) anyPlaceholder = true
      say(
        `chapters: ${b.slug}`,
        s.total === 0 ? 'missing' : s.real === s.total ? 'ok' : 'problem',
        `${s.total} chapter(s), ${s.real} with real text, ${s.placeholder} placeholder, ${s.empty} empty, ${s.preview} free`,
      )
    }
    if (anyMissing) {
      out.advice.push('Some books have no chapter rows at all. Run supabase/07_books_all_in_one.sql.')
    }
    if (anyPlaceholder) {
      out.advice.push(
        'Chapters exist but still hold the generated filler. Run the three files in supabase/chapters/ (08_evidence_of_yourself.sql, 08_story_you_tell.sql, 08_design_beats_discipline.sql). They only UPDATE, so they are safe to re-run.',
      )
    }

    /* ---- 3. the view the drawer reads -------------------------------- */
    const { error: viewErr } = await admin.from('chapter_index').select('id').limit(1)
    if (viewErr) {
      say('chapter_index', 'missing', viewErr.message)
      out.advice.push('The chapter_index view is missing. Run supabase/11_chapter_index.sql.')
    } else {
      say('chapter_index', 'ok', 'the view answers')
    }

    /* ---- 4. what THIS caller owns ------------------------------------ */
    const { data: ents, error: entErr } = await admin
      .from('entitlements')
      .select('book_id')
      .eq('user_id', user.id)

    if (entErr) {
      say('your_entitlements', 'missing', entErr.message)
    } else {
      const owned = new Set((ents ?? []).map((e) => e.book_id))
      say(
        'your_entitlements',
        owned.size ? 'ok' : 'empty',
        owned.size
          ? books.filter((b) => owned.has(b.id)).map((b) => b.slug).join(', ')
          : 'you own none of them',
      )

      /**
       * The question the reader is actually asking, per owned book: with the
       * entitlement you have, does the policy let a paid chapter through?
       *
       * Asked by counting rows the caller's own token can see, which runs the
       * policy for real rather than reasoning about it. A mismatch between
       * this and the service-role count above IS the bug, and it is the one
       * thing no amount of looking at tables would show.
       */
      const anon = env('supabaseAnon')
      /**
       * No fallback to the service role, deliberately.
       *
       * A client built with the service role ignores row level security
       * whatever Authorization header it carries, so it would report that
       * every chapter is readable no matter what the policy does. That is not
       * a weaker check, it is a check that always passes, which is worse than
       * no check because it would say the books are fine while they are not.
       */
      if (!anon) {
        say('readable', 'unknown', 'SUPABASE_ANON_KEY is not set on this deployment')
        out.advice.push(
          'Set VITE_SUPABASE_ANON_KEY on Vercel so this check can ask what a reader can actually see. Without it the policy half of the answer is missing.',
        )
      }

      const asCaller = anon && createClient(env('supabaseUrl'), anon, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      })

      for (const b of anon ? books.filter((x) => owned.has(x.id)) : []) {
        const { data: seen, error: seeErr } = await asCaller
          .from('chapters')
          .select('id, is_preview')
          .eq('book_id', b.id)
        const total = byBook[b.id]?.total ?? 0
        if (seeErr) {
          say(`readable: ${b.slug}`, 'problem', seeErr.message)
        } else {
          const n = seen?.length ?? 0
          say(
            `readable: ${b.slug}`,
            n >= total && total > 0 ? 'ok' : 'problem',
            `you can read ${n} of ${total}`,
          )
          if (total > 0 && n < total) {
            out.advice.push(
              `You own ${b.slug} but the policy only returns ${n} of its ${total} chapters. The entitlement is there and something else is filtering: check that owns_book() exists and that ${b.slug} is published.`,
            )
          }
        }
      }
    }

    if (out.advice.length === 0) {
      out.advice.push('Everything the database needs is in place. If a chapter still will not open, sign out and back in: the policy reads the token, and a session from before the entitlement was granted still carries the old one.')
    }
  } catch (e) {
    return res.status(500).json({ error: 'The check itself failed.', detail: String(e?.message ?? e) })
  }

  return res.status(200).json(out)
}
