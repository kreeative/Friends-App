import { useCallback, useEffect, useRef, useState } from 'react'
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

const SIZES = [
  { key: 's', px: 16, lh: 1.65 },
  { key: 'm', px: 18, lh: 1.7 },
  { key: 'l', px: 21, lh: 1.72 },
]

/** Minimal markdown: paragraphs, ## headings, > quotes, *emphasis*. */
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
        <blockquote key={i} className="my-8 border-l-2 border-yellow pl-5 text-ink/80">
          {b.replace(/^> ?/gm, '')}
        </blockquote>
      )
    }
    return (
      <p key={i} className="mt-6">
        {b}
      </p>
    )
  })
}

export default function Reader() {
  const { slug } = useParams()
  const { user, profile } = useAuth()
  const { group } = useGroup()
  const { t } = useT()

  const [book, setBook] = useState(null)
  const [chapters, setChapters] = useState([])
  const [current, setCurrent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
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
      setLoading(true)
      try {
        const { data: b } = await supabase
          .from('books')
          .select('*')
          .eq('slug', slug)
          .maybeSingle()
        if (cancelled) return
        if (!b) throw new Error('Book not found')
        setBook(b)

        const [chs, { data: ent }, hl] = await Promise.all([
          listChapters(b.id),
          supabase.from('entitlements').select('id').eq('book_id', b.id).maybeSingle(),
          listHighlights(b.id),
        ])
        if (cancelled) return
        setChapters(chs)
        setNotes(hl)
        b.owned = Boolean(ent)

        const { data: prog } = await supabase
          .from('reading_progress')
          .select('chapter_id')
          .eq('book_id', b.id)
          .maybeSingle()

        const resume = chs.find((c) => c.id === prog?.chapter_id)
        await open(resume?.id ?? chs[0]?.id)
        setError(null)
      } catch (e) {
        if (!cancelled) setError({ code: 'load', description: e?.message ?? String(e) })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug])

  /**
   * One chapter per request, always. Nothing here decides whether it may be
   * read — a locked chapter simply comes back null, because the policy filtered
   * it server-side. That is also why the whole book is never fetched at once.
   */
  const open = useCallback(async (chapterId) => {
    if (!chapterId) return
    const ch = await getChapter(chapterId)
    setCurrent(ch ?? { locked: true, id: chapterId })
    setDrawer(false)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

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
    <div className="relative min-h-dvh bg-bg pb-36">
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
            <button onClick={() => setDrawer(true)} className="chip-pink press">
              {t('reader.chapters')}
            </button>
          </div>
        </header>

        {current?.locked ? (
          <div className="card mt-16">
            <h2 className="text-h2 text-ink">{t('reader.locked_title')}</h2>
            <p className="mt-2 text-body text-muted">{t('reader.locked_body')}</p>
            <button onClick={() => startCheckout(book.id)} className="btn-primary press mt-6">
              {t('reader.unlock')}
            </button>
          </div>
        ) : (
          <article className="relative mt-12">
            {/* Traceable, not preventive — see the note in Watermark.jsx. */}
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

              <div
                ref={bodyRef}
                onMouseUp={captureSelection}
                onTouchEnd={captureSelection}
                className="mt-10 text-ink/85"
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
              <button onClick={saveHighlight} className="chip-pink press">
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
        <div className="list">
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
                  <button onClick={() => shareHighlight(h)} className="chip-pink press">
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
