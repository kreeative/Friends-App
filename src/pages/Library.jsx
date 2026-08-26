import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { listBooks, shareToGroup, startCheckout } from '../lib/library'
import { useT } from '../lib/i18n'
import { money } from '../lib/money'
import { Empty, Screen, Section, Sheet, TopBar } from '../components/ui'
import ErrorNote from '../components/ErrorNote'
import Formation from '../components/Formation'
import { BookIcon } from '../components/ActionBar'
import { localBooks } from '../content/previews'

export default function Library() {
  const { user } = useAuth()
  const { group } = useGroup()
  const { t, locale } = useT()
  const [params, setParams] = useSearchParams()

  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)
  const [sharePrompt, setSharePrompt] = useState(null)
  /* The course took over the page, the way the transaction history takes over
     the budget: reading six modules under a shop is reading in a corridor. */
  const [course, setCourse] = useState(false)
  /* Which stage the course is at, so this page can get out of its way. Inside
     the player and inside a module the course has its own back button, and two
     stacked back buttons is a reader wondering which one undoes what. */
  const [stage, setStage] = useState('intro')

  async function load() {
    setLoading(true)
    try {
      const rows = await listBooks()
      /* An empty catalogue means the SQL has not run. The three books exist
         either way and their free chapters are in the bundle, so show them
         rather than an empty shop: a visitor who came to read a sample should
         get the sample, not a note about a migration. */
      setBooks(rows.length > 0 ? rows : localBooks())
      setError(null)
    } catch (e) {
      setBooks(localBooks())
      /* Keep PostgREST's own code. `explain` reads it to tell "the library SQL
         was never run" apart from a genuine network failure, and hard-coding
         'network' here made every cause look like the same one. */
      setError({ code: e?.code ?? 'network', description: e?.message ?? String(e) })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  /**
   * Coming back from Stripe. The entitlement is written by the webhook, which
   * may land a moment after the redirect, so this refreshes rather than
   * assuming, and it never writes an entitlement itself.
   *
   * The share prompt appears here and defaults to NOT sharing. Announcing what
   * someone bought without asking is the kind of thing that makes people stop
   * trusting an app, and a book about confidence is exactly the purchase
   * somebody might not want broadcast.
   */
  useEffect(() => {
    if (params.get('purchase') !== 'success') return
    const slug = params.get('book')
    let tries = 0
    const tick = async () => {
      // listBooks throws now, and this one runs on a timer rather than from a
      // render, an unhandled rejection here would surface as a console error
      // on the success screen and nothing else.
      const fresh = await listBooks().catch(() => null)
      if (!fresh) return setParams({}, { replace: true })
      setBooks(fresh)
      const bought = fresh.find((b) => b.slug === slug)
      if (bought?.owned) {
        setSharePrompt(bought)
        setParams({}, { replace: true })
      } else if (++tries < 6) {
        setTimeout(tick, 1500)
      } else {
        setParams({}, { replace: true })
      }
    }
    tick()
  }, [params])

  async function buy(book) {
    setBusy(book.id)
    const { error: err } = await startCheckout(book.id)
    if (err) {
      setError({ code: 'checkout', description: err })
      setBusy(null)
    }
    // On success the browser navigates to Stripe, so nothing else runs.
  }

  async function share(book) {
    if (!group) return setSharePrompt(null)
    await shareToGroup({
      userId: user.id,
      groupId: group.id,
      bookId: book.id,
      kind: 'started',
    })
    setSharePrompt(null)
  }

  /**
   * The formation, which used to be a tab inside the budget.
   *
   * It is reading, and this is where the reading lives. A course sitting in a
   * budget's tab strip is competing with the four things a budget is for, and
   * losing: nobody opens a lesson while working out whether they can afford
   * groceries.
   */
  if (course) {
    return (
      <Screen>
        <TopBar title={t('form.title')} sub={t('form.sub')} />
        {stage === 'intro' && (
          <div className="pt-2">
            <button type="button" className="goal-action press" onClick={() => setCourse(false)}>
              {t('form.back_library')}
            </button>
          </div>
        )}
        <Formation userId={user?.id} locale={locale} onStageChange={setStage} />
      </Screen>
    )
  }

  return (
    <Screen>
      <TopBar title={t('nav.library')} sub={t('library.sub')} />

      {/* Above the catalogue, because it is free, it is short, and it is the
          only thing on this page that does not cost anything to start. */}
      <Section>
        <button
          type="button"
          data-hook="formation-entry"
          onClick={() => setCourse(true)}
          className="press glass-card flex w-full items-center gap-4 rounded-3xl p-5 text-left"
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cat-1-soft text-ink [&>svg]:h-7 [&>svg]:w-7">
            <BookIcon />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-body font-bold leading-tight text-ink">{t('form.title')}</span>
            <span className="mt-1.5 block text-small leading-snug text-muted">{t('form.sub')}</span>
          </span>
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-accent/[0.18] text-ink">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h13M13 6l6 6-6 6" />
            </svg>
          </span>
        </button>
      </Section>

      {error && (
        <div className="pt-8">
          <ErrorNote error={error} onRetry={load} />
        </div>
      )}

      <Section>
        {loading ? (
          <Empty>{t('err.loading')}</Empty>
        ) : books.length === 0 ? (
          <Empty>{t('library.empty')}</Empty>
        ) : (
          <div className="space-y-4">
            {books.map((b) => {
              const pct = b.progress?.scroll_pct ?? 0
              return (
                <article key={b.id} className="card">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-h2 text-ink">{b.title}</h3>
                      {b.subtitle && (
                        <p className="mt-1.5 text-small text-muted">{b.subtitle}</p>
                      )}
                    </div>
                    {b.owned ? (
                      <span className="chip-green shrink-0">{t('library.owned')}</span>
                    ) : (
                      <span className="chip-quiet shrink-0">
                        {money(b.price_cents, b.currency, locale)}
                      </span>
                    )}
                  </div>

                  {b.description && (
                    <p className="mt-4 text-body text-muted">{b.description}</p>
                  )}

                  {b.owned && pct > 0 && (
                    <div className="mt-6">
                      <div className="h-1.5 w-full overflow-hidden rounded-pill bg-ink/[0.07]">
                        <div className="h-full rounded-pill bg-accent" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-2.5 text-small text-muted">
                        {t('library.progress', { pct: Math.round(pct) })}
                      </p>
                    </div>
                  )}

                  <div className="mt-6 flex flex-wrap gap-2">
                    {/**
                     * Two destinations, because they are two different jobs.
                     *
                     * Owned: the real reader, which has your progress, your
                     * highlights and every chapter.
                     *
                     * Not owned: the free chapter, at the route that is served
                     * entirely from the bundle. It needs no row, no view and
                     * no session, so it cannot fail for a reason the reader
                     * has spent this long failing for.
                     */}
                    <Link
                      to={b.owned ? `/library/${b.slug}` : `/books/${b.slug}`}
                      className="chip-accent press"
                    >
                      {b.owned ? t('library.read') : t('library.read_free')}
                    </Link>
                    {/* No Buy on a bundled book: there is no row to record
                        the purchase against, so the money would be taken for
                        something the app could not then unlock. */}
                    {!b.owned && !b.local && (
                      <button
                        onClick={() => buy(b)}
                        disabled={busy === b.id}
                        className="chip-quiet press"
                      >
                        {busy === b.id
                          ? t('library.opening')
                          : t('library.buy', {
                              price: money(b.price_cents, b.currency, locale),
                            })}
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </Section>

      <Sheet
        open={Boolean(sharePrompt)}
        onClose={() => setSharePrompt(null)}
        title={t('library.share_title')}
      >
        <p className="text-body text-muted">{t('library.share_body')}</p>
        <div className="mt-8 space-y-3">
          <button onClick={() => share(sharePrompt)} className="btn-primary press">
            {t('library.share_yes')}
          </button>
          <button onClick={() => setSharePrompt(null)} className="btn-ghost press">
            {t('library.share_skip')}
          </button>
        </div>
      </Sheet>
    </Screen>
  )
}
