import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { listBooks, recoverPurchases, shareToGroup, startCheckout } from '../lib/library'
import { useT } from '../lib/i18n'
import { money } from '../lib/money'
import { Empty, Screen, Section, Sheet, TopBar } from '../components/ui'
import ErrorNote from '../components/ErrorNote'
import Formation from '../components/Formation'
import { BookIcon } from '../components/ActionBar'
import { localBooks } from '../content/previews'
import { STUDY_SLUGS } from '../lib/seo'
import { LESSONS } from '../lib/lessons'

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
  /* Coming back from Stripe: null, {state:'waiting'} or {state:'slow'}. See
     the effect below for why this exists at all. */
  const [purchase, setPurchase] = useState(null)
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
  /**
   * IT SAYS SOMETHING NOW, AND THAT IS THE ACTUAL FIX HERE.
   *
   * "It brings me back to the site and nothing happens" was two bugs stacked,
   * and only one of them was the webhook. This loop polled silently for nine
   * seconds, and then, whether the book had arrived or not, wiped the query
   * string and rendered nothing at all. Somebody who had just paid saw the
   * library exactly as they left it, with no message, no spinner and no error.
   *
   * A payment that has been taken is the last thing in an app that should
   * report by saying nothing. So there are three visible states now: waiting,
   * arrived, and did not arrive with something to do about it.
   *
   * The window goes to about thirty seconds. Stripe delivers in a second or
   * two normally, but a retry after a cold start is well past nine, and the
   * old ceiling turned a slow success into a silent failure.
   *
   * The timer is cleaned up. It never was, so leaving the page mid-poll left a
   * chain of timeouts calling setState on an unmounted component, and every
   * remount started another chain beside it.
   */
  useEffect(() => {
    if (params.get('purchase') !== 'success') return undefined
    const slug = params.get('book')
    let tries = 0
    let timer = null
    let live = true

    setPurchase({ state: 'waiting', slug })

    const tick = async () => {
      /* listBooks throws, and this runs on a timer rather than from a render,
         so an unhandled rejection here would surface as a console error on the
         success screen and nothing else. */
      const fresh = await listBooks().catch(() => null)
      if (!live) return
      if (fresh) {
        setBooks(fresh)
        const bought = fresh.find((b) => b.slug === slug)
        if (bought?.owned) {
          setPurchase(null)
          setSharePrompt(bought)
          return setParams({}, { replace: true })
        }
      }

      /**
       * THE POLL FIXES IT ITSELF NOW, INSTEAD OF WAITING TO GIVE UP.
       *
       * Three tries is about six seconds. A working webhook has delivered long
       * before that, so reaching here means the entitlement is not coming: the
       * endpoint is unregistered, or misconfigured, or Stripe dropped the
       * event. Every one of those was previously resolved by waiting another
       * twenty-four seconds and then telling somebody who had just paid to go
       * and read a diagnostic on the settings screen.
       *
       * So it asks Stripe directly instead. This is the same recovery the
       * settings button runs, and it is safe to call here: it grants only to
       * the signed-in caller, only for sessions Stripe marks paid, and it
       * upserts, so it cannot double-grant or grant to the wrong person.
       *
       * Once, not on every tick. Repeating it would put a Stripe API call on a
       * two-second timer for the rest of the window, and if the first one did
       * not find a paid session the fifteenth will not either.
       */
      if (tries === 3) {
        const out = await recoverPurchases()
        if (!live) return
        /* Straight back round rather than waiting out the interval: if that
           granted something, the next listBooks sees it immediately. */
        if (out?.granted?.length) {
          tries += 1
          timer = setTimeout(tick, 200)
          return
        }
      }

      if (++tries < 15) {
        timer = setTimeout(tick, 2000)
      } else {
        /* The query string is cleared either way, so a refresh does not start
           the poll again, but the notice stays until it is dismissed. */
        setPurchase({ state: 'slow', slug })
        setParams({}, { replace: true })
      }
    }
    tick()

    return () => {
      live = false
      clearTimeout(timer)
    }
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
        <TopBar title={t('form.title')} sub={t('form.sub', { n: LESSONS.length })} />
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

      {/**
       * Back from Stripe, at the top of the page, before anything else.
       *
       * The card is what the payment bought a moment of certainty about, so it
       * goes above the catalogue rather than beside the book: somebody
       * returning from a payment screen is looking for confirmation, not for a
       * shop.
       *
       * role="status" and not "alert" while waiting, because nothing is wrong
       * yet. It becomes an alert when the wait runs out, which is the point at
       * which it is worth interrupting for.
       */}
      {purchase && (
        <Section>
          <div
            data-hook="purchase-note"
            data-state={purchase.state}
            role={purchase.state === 'slow' ? 'alert' : 'status'}
            /* `lg`, like every other card in the app, rather than a hairline
               rectangle. See the note on the studies banners below. */
            className="lg overflow-hidden px-5 py-4"
          >
            <p className="text-body font-semibold text-ink">
              {t(purchase.state === 'slow' ? 'library.buy_slow_title' : 'library.buy_wait_title')}
            </p>
            <p className="mt-1 text-small text-muted">
              {t(purchase.state === 'slow' ? 'library.buy_slow_body' : 'library.buy_wait_body')}
            </p>
            {purchase.state === 'slow' && (
              <div className="mt-3 flex flex-wrap gap-2">
                {/* Recover, then refresh. This used to reload only, which
                    fixed the case where the entitlement landed while somebody
                    read the notice and did nothing at all for the case where
                    it was never coming. The automatic attempt inside the poll
                    has already run by now; this is the second press for a
                    transient failure, and it costs one request. */}
                <button
                  type="button"
                  data-hook="purchase-retry"
                  onClick={async () => {
                    await recoverPurchases()
                    await load()
                    setPurchase(null)
                  }}
                  className="goal-action press"
                >
                  {t('library.buy_recheck')}
                </button>
                <button
                  type="button"
                  onClick={() => setPurchase(null)}
                  className="press rounded-pill px-4 py-2 text-small font-semibold text-muted hover:bg-ink/[0.06]"
                >
                  {t('wiz.close')}
                </button>
              </div>
            )}
          </div>
        </Section>
      )}

      {/**
       * THE COURSE, UNDER ITS OWN HEADING AND ON A TINTED CARD.
       *
       * It is above the catalogue because it is free, it is short, and it is
       * the only thing on this page that does not cost anything to start. It
       * was a white card with no heading over it, which put it in the same
       * visual class as the shelf below and left it to the reader to work out
       * that this one is not a book. A heading says which of the two it is,
       * and the tint says it before the heading is read.
       *
       * WHY THE THEME TOKEN AND NOT A PINK.
       *
       * `cat-1-soft` is pink on sun and pale blue on sea, so this follows the
       * theme instead of stamping one hue on both. The alternative is a fixed
       * #FF007A wash, which would be a pink card in the middle of a blue app
       * for anybody on sea.
       *
       * The icon tile and the arrow chip invert with it: they were the tinted
       * things on a white card, and on a tinted card they would be the same
       * colour as their ground. White on pink, rather than pink on pink.
       */}
      <Section title={t('library.sec_course')}>
        <button
          type="button"
          data-hook="formation-entry"
          className="press flex w-full items-center gap-4 rounded-3xl border border-hairline bg-cat-1-soft p-5 text-left shadow-raised"
          onClick={() => setCourse(true)}
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-surface text-ink [&>svg]:h-7 [&>svg]:w-7">
            <BookIcon />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-body font-bold leading-tight text-ink">{t('form.title')}</span>
            <span className="mt-1.5 block text-small leading-snug text-muted">{t('form.sub', { n: LESSONS.length })}</span>
          </span>
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-surface text-ink">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h13M13 6l6 6-6 6" />
            </svg>
          </span>
        </button>
      </Section>

      {/**
       * LES ETUDES, EN BANNIERE PLUTOT QU'EN ONGLET.
       *
       * "Une section newsletter qui va peut-etre siter a l'interieur de
       * Lectures comme un banner."
       *
       * Elle vit ici parce que c'est la meme envie que le reste de la page :
       * lire quelque chose. Un cinquieme onglet en bas pour un texte par mois
       * serait une destination vide onze mois sur douze, alors qu'une banniere
       * sous la formation est trouvee par les gens deja venus lire.
       *
       * Plus discrete que la formation au-dessus : bord seul, pas de carte
       * pleine. Les deux se ressembleraient trop et la page dirait deux fois
       * "commence par ici".
       */}
      {/* A list rather than one hand-written banner, because there are two
          now and a third should not need more JSX. The keys are the i18n
          prefix so the copy for each lives with the rest of the strings. */}
      <Section>
        <div className="space-y-3">
          {[
            { slug: STUDY_SLUGS[0], k: 'studies.banner' },
            { slug: STUDY_SLUGS[1], k: 'studies.cycle' },
          ].map(({ slug, k }) => (
            <Link
              key={slug}
              to={`/etudes/${slug}`}
              data-hook="studies-banner"
              /**
               * A RAISED CARD, NOT AN OUTLINED RECTANGLE.
               *
               * These were `border border-hairline` with no ground and no
               * shadow: a thin box drawn on the page. Every other surface in
               * this app is a sheet that sits ON the page, and the two do not
               * belong in one column. Next to a `lg` card an outlined one
               * reads as a placeholder, or as something disabled.
               *
               * The note that put them here said "more discreet than the
               * course above: an edge, not a full card, or the two would look
               * alike and the page would say start here twice". The distinction
               * was worth keeping and an outline was the wrong way to make it.
               * These are the same sheet with less inside them, which separates
               * them by weight rather than by being a different kind of thing.
               */
              className="lg press flex w-full items-center gap-4 overflow-hidden px-5 py-4 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-label font-semibold uppercase tracking-wider text-muted">
                  {t(`${k}_eyebrow`)}
                </span>
                <span className="text-safe mt-1 block text-body font-semibold leading-tight text-ink">
                  {t(`${k}_title`)}
                </span>
                <span className="text-safe mt-1 block text-small leading-snug text-muted">
                  {t(`${k}_sub`)}
                </span>
              </span>
              <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-ink/[0.06] text-ink">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h13M13 6l6 6-6 6" />
                </svg>
              </span>
            </Link>
          ))}
        </div>
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
          <div className="card-grid">
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
