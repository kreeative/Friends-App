import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { listBooks, shareToGroup, startCheckout } from '../lib/library'
import { useT } from '../lib/i18n'
import { Empty, Screen, Section, Sheet, TopBar } from '../components/ui'
import ErrorNote from '../components/ErrorNote'

function money(cents, currency, locale) {
  try {
    return new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
      style: 'currency',
      currency: currency || 'EUR',
    }).format((cents ?? 0) / 100)
  } catch {
    return `${((cents ?? 0) / 100).toFixed(2)} ${currency ?? 'EUR'}`
  }
}

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

  async function load() {
    setLoading(true)
    try {
      setBooks(await listBooks())
      setError(null)
    } catch (e) {
      setError({ code: 'network', description: e?.message ?? String(e) })
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
   * assuming — and it never writes an entitlement itself.
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
      const fresh = await listBooks()
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

  return (
    <Screen>
      <TopBar title={t('nav.library')} sub={t('library.sub')} />

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
                    <Link to={`/library/${b.slug}`} className="chip-accent press">
                      {b.owned ? t('library.read') : t('library.read_free')}
                    </Link>
                    {!b.owned && (
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
