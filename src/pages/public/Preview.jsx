import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { LANDING } from '../../content/landing'
import { PREVIEW_BOOKS, localChapterBody } from '../../content/previews'
import { livePrice, startCheckout } from '../../lib/library'
import { useT } from '../../lib/i18n'
import { money } from '../../lib/money'
import { usePageMeta } from '../../lib/seo'

/**
 * Chapter one, in public.
 *
 * The free chapter used to live at /library/:slug, which is behind the sign-in
 * gate. That made "read chapter one free" a promise the site could not keep
 * without an account, and it meant the one piece of writing intended to be
 * given away was the one piece a search engine could never see.
 *
 * This route needs no session and no database. The text is in the bundle, so
 * it renders on the first paint, and everything a crawler needs is in the
 * markup rather than behind a fetch.
 *
 * The signed-in reader at /library/:slug still exists and is still the real
 * one: progress, highlights, and the paid chapters. This is the shop window.
 */
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
        <strong key={`${key}b${m.index}`} className="font-bold text-ink">
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

function render(md) {
  return md.split(/\n{2,}/).map((block, i) => {
    const b = block.trim()
    if (!b) return null
    if (b.startsWith('## ')) {
      return (
        <h2 key={i} className="mt-14 text-h2 text-ink">
          {b.slice(3)}
        </h2>
      )
    }
    if (b.startsWith('> ')) {
      return (
        <blockquote key={i} className="my-8 border-l-2 border-accent pl-5 text-ink/80">
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

export default function Preview() {
  const { slug } = useParams()
  const { t, locale } = useT()
  const nav = (LANDING[locale] ?? LANDING.en).footer

  const book = PREVIEW_BOOKS.find((b) => b.slug === slug)
  const body = book ? localChapterBody(slug, 1) : null

  /**
   * The price Stripe will actually charge.
   *
   * The bundled catalogue carries a number so the button is never blank, but
   * it is a copy, and the copy on the live site had drifted from the Price
   * object by the time anybody looked. Asked for on mount and swapped in when
   * it arrives, so nothing is waiting on a network call in order to render.
   */
  const [price, setPrice] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    livePrice(slug)
      .then((p) => !cancelled && p && setPrice(p))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [slug])

  async function buy() {
    if (busy) return
    setBusy(true)
    setErr(null)
    const { error } = await startCheckout(slug)
    if (error) {
      setErr(error)
      setBusy(false)
    }
    // On success the browser has already left for Stripe, so nothing to undo.
  }

  usePageMeta({
    title: book ? `${book.chapters[0]} · ${book.title}` : 'Rich & Friends',
    description: book?.description,
  })

  if (!book || !body) return <Navigate to="/books" replace />

  return (
    <article className="mx-auto w-full max-w-5xl px-6 pb-24 pt-14">
      <div className="max-w-[42rem]">
        <Link to="/books" className="text-small text-muted hover:text-ink">
          ← {nav.links.library}
        </Link>

        <p className="eyebrow mt-10">
          {book.title} · {t('reader.free_preview')}
        </p>
        <h1 className="mt-3 text-[clamp(2rem,5vw,3rem)] font-bold leading-[1.04] tracking-[-0.03em] text-ink">
          {book.chapters[0]}
        </h1>

        <div className="mt-12 max-w-[36em] text-body text-muted">{render(body)}</div>

        {/**
         * The ask comes after the chapter, not before it. Someone who has read
         * three thousand words has already decided whether they want the next
         * eight, and interrupting them to say so would only have cost the
         * reading.
         */}
        <div className="mt-16 rounded-card bg-field p-8 text-on-field">
          <h2 className="max-w-[20ch] text-h1 font-bold leading-[1.1] tracking-[-0.024em]">
            {t('preview.rest_title', { n: book.chapters.length - 1 })}
          </h2>
          <ol className="mt-6 space-y-1.5 text-small text-on-field/80">
            {book.chapters.slice(1).map((title, i) => (
              <li key={title}>
                {i + 2}. {title}
              </li>
            ))}
          </ol>
          {/**
           * Buy, not sign in.
           *
           * This button used to go to /signin, which asked somebody who had
           * read three thousand words and decided they wanted the rest to
           * stop and make an account first. That is a wall in the one place
           * where there should be a door. Checkout takes guests now, Stripe
           * collects the address during payment, and the book is waiting on
           * that address whenever they do sign in.
           *
           * The amount is on the button. A price you have to click to find
           * out is a reason to hesitate.
           */}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              onClick={buy}
              disabled={busy}
              className="btn press w-auto bg-on-field px-9 text-field hover:opacity-90 disabled:opacity-60"
            >
              {busy
                ? t('preview.opening')
                : t('preview.buy', {
                    price: money(
                      price?.cents ?? book.price_cents,
                      price?.currency ?? book.currency,
                      locale,
                    ),
                  })}
            </button>
            <Link to="/signin" className="text-small text-on-field/70 underline-offset-4 hover:underline">
              {t('preview.already_bought')}
            </Link>
          </div>

          {err && <p className="mt-4 text-small text-on-field/80">{err}</p>}
        </div>
      </div>
    </article>
  )
}
