import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import {
  addHighlight,
  getChapter,
  listChapters,
  listHighlights,
  removeHighlight,
  saveProgress,
  shareToGroup,
  startCheckout,
} from '../lib/library'
import { useT } from '../lib/i18n'
import { Screen, Sheet } from '../components/ui'
import Watermark, { WatermarkNote } from '../components/Watermark'
import ErrorNote from '../components/ErrorNote'
import { localBook, localChapterBody } from '../content/previews'

const SIZES = [
  { key: 's', px: 16, lh: 1.65 },
  { key: 'm', px: 18, lh: 1.7 },
  { key: 'l', px: 21, lh: 1.72 },
]

/**
 * Inline marks. The manuscripts use two, and both carry real weight in them:
 * **bold** for the sentence an argument turns on, *italic* for a word being
 * used precisely rather than loosely. Rendering either as literal asterisks
 * is worse than rendering neither, because it reads as a typo in a book that
 * is arguing for its own care.
 *
 * Bold is matched first so that the inner ** of a bold run is never mistaken
 * for a pair of italics.
 */
function inline(text, key) {
  const out = []
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g
  let last = 0
  let m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    out.push(
      m[1] !== undefined ? (
        <strong key={`${key}b${m.index}`} className="font-semibold text-ink">
          {m[1]}
        </strong>
      ) : (
        <em key={`${key}i${m.index}`} className="italic">
          {m[2]}
        </em>
      ),
    )
    last = re.lastIndex
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/** Minimal markdown: paragraphs, ## headings, > quotes, and inline marks. */
function render(md) {
  return md.split(/\n{2,}/).map((block, i) => {
    const b = block.trim()
    if (!b) return null
    if (b.startsWith('## ')) {
      return (
        <h2 key={i} className="mt-12 text-h2 text-ink">
          {b.slice(3)}
        </h2>
      )
    }
    if (b.startsWith('> ')) {
      return (
        /**
         * A pull quote, marked by size and space rather than by a rule down
         * its left edge.
         *
         * Dropping the rule and changing nothing else would have made a quote
         * indistinguishable from the paragraph above it, so the marking moved
         * into the type: larger, lighter in weight than the body around it,
         * set in muted rather than full ink, and given a lot more room above
         * and below. Four signals instead of one line, none of them colour on
         * its own.
         */
        <blockquote
          key={i}
          className="my-10 text-[1.14em] font-normal leading-relaxed text-muted"
        >
          {b.replace(/^> ?/gm, '')}
        </blockquote>
      )
    }
    return (
      <p key={i} className="mt-6">
        {inline(b, i)}
      </p>
    )
  })
}

export default function Reader() {
  const { slug } = useParams()
  const { user, profile } = useAuth()
  const { group } = useGroup()
  const { t } = useT()

  /**
   * Seeded from the bundle, then corrected by the database.
   *
   * Nothing waits on the network to paint the free chapter. The previous
   * version queried first and fell back on failure, which is fine when a
   * request fails and useless when it hangs -- an unreachable or very slow
   * host does not reject, it simply does not answer, and the page sat on
   * "Loading" for ten seconds before showing anything. Measured.
   *
   * Seeding also means "Book not found" can no longer appear for any of the
   * three books, in any auth state, with or without a row in the database.
   */
  const seed = useMemo(() => localBook(slug), [slug])

  const [book, setBook] = useState(seed?.book ?? null)
  const [chapters, setChapters] = useState(seed?.chapters ?? [])
  const [current, setCurrent] = useState(
    seed ? { ...seed.chapters[0], body: localChapterBody(slug, 1) ?? '' } : null,
  )
  const [loading, setLoading] = useState(!seed)
  const [error, setError] = useState(null)
  const [buying, setBuying] = useState(false)
  const [buyError, setBuyError] = useState(null)
  const [size, setSize] = useState(1)
  const [drawer, setDrawer] = useState(false)
  const [notes, setNotes] = useState([])
  const [notesOpen, setNotesOpen] = useState(false)
  const [selection, setSelection] = useState('')
  const bodyRef = useRef(null)

  // --- load the book and its chapter list ---------------------------------
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      /* Only when there is nothing to show yet. Setting it unconditionally
         put the spinner back over a chapter that was already rendered from
         the bundle, which is the whole thing this seeding exists to avoid. */
      if (!seed) setLoading(true)
      try {
        /**
         * The database first, the bundle second.
         *
         * Once the SQL has run this is the real catalogue, with entitlements
         * and reading progress attached. Until then, or if Supabase is
         * unreachable, the free chapter still has to open: it is the thing a
         * visitor reads before deciding whether to pay, and "Book not found"
         * is the worst possible answer to someone who came to sample a book.
         */
        const { data: b, error: bookErr } = await supabase
          .from('books')
          .select('*')
          .eq('slug', slug)
          .maybeSingle()
        if (cancelled) return

        /* No row. If this slug is one of the bundled three the seed is
           already on screen and there is nothing to do; if it is not, the
           book genuinely does not exist. */
        if (bookErr || !b) {
          if (seed) return
          /* An unknown slug: a stale link, a renamed book, or a catalogue
             that never had this one. Naming it beats "Book not found", which
             says nothing anybody can act on. */
          setError({ code: 'unknown_book', description: slug })
          return
        }

        setBook(b)

        /* Only the chapter list is allowed to fail loudly. Highlights and the
           entitlement lookup are additive: not knowing whether you own the
           book should cost you a badge in the drawer, not the book. */
        const [chs, { data: ent }, hl] = await Promise.all([
          listChapters(b.id),
          supabase.from('entitlements').select('id').eq('book_id', b.id).maybeSingle(),
          listHighlights(b.id).catch(() => []),
        ])
        if (cancelled) return

        /**
         * AN EMPTY LIST FROM THE DATABASE MUST NOT REPLACE A SEEDED ONE.
         *
         * This used to assign unconditionally, and the guard for "the book has
         * no chapters" sat fifteen lines below it. By the time that guard
         * decided to leave the bundled chapter alone, this line had already
         * thrown away the bundled table of contents.
         *
         * The result was reported from a real iPad: the reader shows chapter
         * one, and Chapitres opens a sheet containing a title, a Fermer
         * button, and nothing else. It also silently removed the previous and
         * next buttons, because those are derived from this same list, so the
         * book became a single unnavigable page.
         *
         * The state that causes it is a catalogue with a books row and no
         * chapter rows: 07 run without 08, or 11 never run. That is what
         * production looks like right now, which is why this reached a device.
         */
        if (chs.length > 0) setChapters(chs)
        setNotes(hl)
        /* Set on a copy, through state. Mutating the object already handed to
           setBook happened to work because it was the same reference, which
           is exactly the kind of thing that stops working the moment anything
           upstream starts cloning. */
        setBook({ ...b, owned: Boolean(ent) })

        /* The book exists but has no chapters, which is 07 run without 08,
           or 11 not run at all. The free chapter is in the bundle either way,
           so show it rather than an error page nobody can act on from here. */
        /* 07 run without 08, or 11 not run at all. The seeded chapter is
           already showing, so leave it there rather than replacing a readable
           page with an error nobody can act on from here. */
        if (chs.length === 0) {
          if (seed) return
          setError({ code: 'no_chapters', description: 'no_chapters' })
          return
        }

        const { data: prog } = await supabase
          .from('reading_progress')
          .select('chapter_id')
          .eq('book_id', b.id)
          .maybeSingle()

        const resume = chs.find((c) => c.id === prog?.chapter_id)
        await open(resume?.id ?? chs[0].id, chs)
        setError(null)
      } catch (e) {
        if (cancelled) return

        /**
         * A readable chapter beats a correct error message.
         *
         * If the bundle seeded this page, something is already on screen and
         * whatever the database just failed to do has not taken it away.
         * Replacing a chapter someone is reading with a note about an unrun
         * migration serves nobody: they came to read, they can read, and the
         * migration is not theirs to run from here.
         */
        if (seed) return

        /* Keep PostgREST's own code so `explain` can name the SQL file that
           has not been run. 'load' told nobody anything. */
        setError(
          e?.message === 'NO_CHAPTERS'
            ? { code: 'no_chapters', description: 'no_chapters' }
            : { code: e?.code ?? 'load', description: e?.message ?? String(e) },
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug, seed])

  /**
   * One chapter per request, always. Nothing here decides whether it may be
   * read: a locked chapter comes back null because the policy filtered it
   * server-side. That is also why the whole book is never fetched at once.
   *
   * @param list the chapter metadata to look this id up in. Passed explicitly
   *             because the first call happens inside the loading effect, in
   *             the same tick as setChapters, so the `chapters` state is
   *             still [] there, and a preview chapter would be misread as one
   *             that simply is not in the list.
   */
  const open = useCallback(
    async (chapterId, list) => {
      if (!chapterId) return
      const meta = (list ?? chapters).find((c) => c.id === chapterId)
      setDrawer(false)

      /* Bundled ids are answered from the bundle. Chapter one has its body
         here; everything else is deliberately absent, so a paid chapter falls
         through to the locked card exactly as it would from the database. */
      if (String(chapterId).startsWith('local:')) {
        const body = localChapterBody(meta?.book_id?.replace('local:', ''), meta?.idx)
        setCurrent(body ? { ...meta, body } : { locked: true, id: chapterId })
        window.scrollTo({ top: 0, behavior: 'instant' })
        return
      }

      try {
        const ch = await getChapter(chapterId)
        if (ch) {
          /**
           * 07 creates every chapter with generated filler and 08 replaces it
           * with the manuscript. A database with the first and not the second
           * returns a chapter whose body is the word PLACEHOLDER forty-eight
           * times, and rendering that is worse than not opening the book at
           * all -- it looks like the writing is nonsense rather than absent.
           * The bundle has the real chapter one, so it wins over filler.
           */
          const real = localChapterBody(slug, ch.idx)
          const filler = typeof ch.body === 'string' && ch.body.includes('PLACEHOLDER.')
          setCurrent(filler && real ? { ...ch, body: real } : ch)
          setError(null)
        } else {
          /**
           * Null means the policy filtered it. For a paid chapter that is the
           * paywall doing its job. For the free preview it cannot be: the
           * policy lets `is_preview` through unconditionally, so if chapter
           * one comes back empty the chapter row itself is missing and no
           * amount of buying will fix it. Saying "unlock for $12" there would
           * be selling something that is not the problem.
           */
          if (meta?.is_preview) {
            setError({ code: 'preview_missing', description: 'preview_missing' })
          } else {
            setCurrent({ locked: true, id: chapterId })
          }
        }
      } catch (e) {
        /* Chapter one is in the bundle either way, so a failed fetch for it
           falls back rather than blanking a page that can be read. */
        const body = localChapterBody(slug, meta?.idx)
        if (body) setCurrent({ ...meta, body })
        else setError({ code: e?.code ?? 'load', description: e?.message ?? String(e) })
      }
      window.scrollTo({ top: 0, behavior: 'instant' })
    },
    [chapters],
  )

  // --- save progress, throttled -------------------------------------------
  useEffect(() => {
    if (!user || !book || !current?.id || current.locked) return
    let timer = null
    const onScroll = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        const el = document.documentElement
        const max = el.scrollHeight - el.clientHeight
        const pct = max > 0 ? (el.scrollTop / max) * 100 : 0
        saveProgress(user.id, book.id, current.id, pct).catch(() => {})
      }, 1200)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      clearTimeout(timer)
      window.removeEventListener('scroll', onScroll)
    }
  }, [user?.id, book?.id, current?.id])

  // --- highlights ----------------------------------------------------------
  function captureSelection() {
    const text = String(window.getSelection() ?? '').trim()
    if (text.length > 3) setSelection(text)
  }

  async function saveHighlight() {
    const { error: err } = await addHighlight({
      userId: user.id,
      bookId: book.id,
      chapterId: current.id,
      quotedText: selection,
    })
    if (!err) setNotes(await listHighlights(book.id))
    setSelection('')
    window.getSelection()?.removeAllRanges()
  }

  async function shareHighlight(h) {
    if (!group) return
    await shareToGroup({
      userId: user.id,
      groupId: group.id,
      bookId: book.id,
      kind: 'highlight',
      highlightId: h.id,
      message: h.quoted_text.slice(0, 300),
    })
    setNotesOpen(false)
  }

  if (loading) return <Screen><p className="pt-20 text-body text-muted">{t('err.loading')}</p></Screen>
  if (error) return <Screen><div className="pt-20"><ErrorNote error={error} /></div></Screen>
  if (!book) return null

  const idx = chapters.findIndex((c) => c.id === current?.id)
  const prev = idx > 0 ? chapters[idx - 1] : null
  const next = idx >= 0 && idx < chapters.length - 1 ? chapters[idx + 1] : null
  const s = SIZES[size]

  return (
    <div className="relative min-h-dvh bg-bg pb-36" data-surface="reading" data-hook="reader">
      <div className="mx-auto w-full max-w-content px-6">
        <header className="flex items-center justify-between gap-4 pt-12">
          <Link to="/library" className="text-small text-muted hover:text-ink">
            ← {book.title}
          </Link>
          <div className="flex gap-2">
            <button onClick={() => setSize((v) => (v + 1) % SIZES.length)} className="chip-quiet press">
              {t('reader.text_size')}
            </button>
            <button onClick={() => setNotesOpen(true)} className="chip-quiet press">
              {t('reader.notes', { n: notes.length })}
            </button>
            <button onClick={() => setDrawer(true)} className="chip-accent press">
              {t('reader.chapters')}
            </button>
          </div>
        </header>

        {current?.locked ? (
          <div className="card mt-16" data-hook="chapter-locked">
            {/**
             * NEVER ASK SOMEBODY TO BUY A BOOK THEY HAVE ALREADY BOUGHT.
             *
             * A chapter comes back locked for two completely different
             * reasons, and this card used to say the same thing for both. The
             * ordinary one is the paywall doing its job. The other is that the
             * entitlement is there and the TEXT is not: a catalogue whose
             * chapter rows were never loaded, which is what the recovered
             * purchases are landing in right now.
             *
             * Reading `owned` first means the person who has just got their
             * book back is told their purchase is recorded, rather than being
             * shown a payment button for something they own. Getting this
             * order wrong would take money twice.
             */}
            <h2 className="text-h2 text-ink">
              {book.owned ? t('reader.owned_missing_title') : t('reader.locked_title')}
            </h2>
            <p className="mt-2 text-body text-muted">
              {book.owned ? t('reader.owned_missing') : t('reader.locked_body')}
            </p>
            {/* A bundled book has no row to record a purchase against, so
                offering to take money for it would be selling something the
                app could not then deliver. */}
            {book.owned ? null : book.local ? (
              <p className="mt-6 text-small text-muted">{t('reader.local_only')}</p>
            ) : (
              <>
                {/**
                 * The result is read now.
                 *
                 * startCheckout returns { error } and this button threw it
                 * away, so a checkout that failed did nothing at all: no
                 * redirect, no message, a button that looked broken. On
                 * success the browser has already left for Stripe, so there
                 * is nothing to clear.
                 */}
                <button
                  onClick={async () => {
                    setBuying(true)
                    setBuyError(null)
                    const { error: err } = await startCheckout(book.id)
                    if (err) setBuyError(err)
                    setBuying(false)
                  }}
                  disabled={buying}
                  className="btn-primary press mt-6 disabled:opacity-60"
                >
                  {buying ? t('library.opening') : t('reader.unlock')}
                </button>
                {buyError && <p className="mt-4 text-small text-negative">{buyError}</p>}
              </>
            )}
          </div>
        ) : (
          <article className="relative mt-12">
            {/* Traceable, not preventive. See the note in Watermark.jsx. */}
            <Watermark
              name={profile?.display_name}
              tag={user?.id?.slice(0, 8)}
            />

            <div className="relative z-10">
              <p className="eyebrow">
                {t('reader.chapter_n', { n: (current?.idx ?? 0) })}
                {current?.is_preview ? ` · ${t('reader.free_preview')}` : ''}
              </p>
              <h1 className="mt-3 text-h1 text-ink">{current?.title}</h1>

              {/* Full ink, not ink/85. See the reading-surface note in
                  index.css: the translucency was softening type against a
                  tinted ground, and on white it only makes the letters
                  grey. */}
              <div
                ref={bodyRef}
                onMouseUp={captureSelection}
                onTouchEnd={captureSelection}
                className="mt-10 text-ink"
                style={{
                  fontSize: `${s.px}px`,
                  lineHeight: s.lh,
                  maxWidth: '38em', // ~68 characters at this size
                }}
              >
                {render(current?.body ?? '')}
              </div>

              <WatermarkNote name={profile?.display_name} tag={user?.id?.slice(0, 8)} />
            </div>
          </article>
        )}

        <nav className="mt-16 flex gap-3">
          {prev && (
            <button onClick={() => open(prev.id)} className="btn-ghost press">
              ← {t('reader.previous')}
            </button>
          )}
          {next && (
            <button onClick={() => open(next.id)} className="btn-primary press">
              {t('reader.next')} →
            </button>
          )}
        </nav>
      </div>

      {/* selection → highlight */}
      {selection && (
        <div className="fixed inset-x-4 bottom-6 z-40 mx-auto max-w-content">
          <div className="glass-strong rounded-card p-5">
            <p className="line-clamp-3 text-small text-muted">“{selection}”</p>
            <div className="mt-4 flex gap-2">
              <button onClick={saveHighlight} className="chip-accent press">
                {t('reader.save_highlight')}
              </button>
              <button onClick={() => setSelection('')} className="chip-quiet press">
                {t('ui.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      <Sheet open={drawer} onClose={() => setDrawer(false)} title={t('reader.chapters')}>
        {/* Keyed to a data hook, not to `list`. A probe written against the
            class found zero rows and reported the drawer empty at a moment
            when it was empty for a different reason, which made a real bug and
            a broken selector look identical. */}
        <div className="list" data-hook="chapter-list">
          {chapters.map((c) => (
            <button
              key={c.id}
              onClick={() => open(c.id)}
              className="flex w-full items-center gap-4 py-4 text-left"
            >
              <span className="w-6 shrink-0 text-small text-muted">{c.idx}</span>
              <span className="flex-1 text-body text-ink">{c.title}</span>
              {c.is_preview && !book.owned && (
                <span className="chip-green shrink-0">{t('reader.free')}</span>
              )}
              {!c.is_preview && !book.owned && (
                <span className="chip-quiet shrink-0">{t('reader.locked')}</span>
              )}
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={notesOpen} onClose={() => setNotesOpen(false)} title={t('reader.your_notes')}>
        {notes.length === 0 ? (
          <p className="text-body text-muted">{t('reader.no_notes')}</p>
        ) : (
          <div className="list">
            {notes.map((h) => (
              <div key={h.id} className="py-5">
                <p className="text-body text-ink">“{h.quoted_text}”</p>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => shareHighlight(h)} className="chip-accent press">
                    {t('reader.share_highlight')}
                  </button>
                  <button
                    onClick={async () => {
                      await removeHighlight(h.id)
                      setNotes(await listHighlights(book.id))
                    }}
                    className="chip-quiet press"
                  >
                    {t('reader.delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Sheet>
    </div>
  )
}
