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
import { LESSONS } from '../lib/lessons'
import { COURSES } from '../content/courses'
import { firstLessonOf, progressOf, say } from '../lib/courses'
import { SHELVES, safeShelf, shelfCount, studiesOfKind } from '../lib/shelves'
import ShelfTabs from '../components/ShelfTabs'

/**
 * How long to wait before looking again, in milliseconds.
 *
 * This was a flat two seconds, fifteen times. That is fine as a ceiling and
 * wrong at the start: a working webhook delivers in about a second, so the
 * common case was the book being ready and the page waiting out a full two
 * seconds anyway before noticing. Reported as the purchase taking a moment to
 * load.
 *
 * The first three are short because that is where the answer almost always
 * is. The tail is long because by then it is not coming and the only thing
 * more polling achieves is more requests.
 *
 * The total is still about half a minute, which is deliberate: Stripe normally
 * delivers in a second or two, but a retry after a cold start is well past
 * ten, and an earlier ceiling of nine seconds turned a slow success into a
 * silent failure.
 */
const BACKOFF = [0, 600, 600, 800, 1000, 1200, 1500, 2000, 2000, 2500, 2500, 3000, 3000, 3000, 3000]

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

  /**
   * L'etagere ouverte, dans l'URL et pas dans un useState.
   *
   * Trois choses en dependent, et les trois ont deja coute quelque chose
   * ailleurs dans ce depot: le bouton retour du telephone revient a l'onglet
   * precedent au lieu de quitter la page, /library?shelf=books est un lien
   * qu'on peut envoyer, et revenir d'un livre ouvert ne rejette pas sur
   * l'onglet des cours.
   *
   * safeShelf() parce que la valeur vient de l'URL, donc de n'importe ou. Un
   * ?shelf=nimportequoi ouvre les cours au lieu de rendre une page vide.
   *
   * LE RETOUR DE STRIPE OUVRE LES LIVRES, PAS LES COURS.
   *
   * Sans ca, quelqu'un qui vient de payer revient sur l'onglet par defaut et
   * la confirmation de son achat s'affiche au-dessus d'une liste de cours
   * gratuits, avec le livre paye sur une autre etagere. `??` et pas un
   * forcage: c'est le defaut de cette arrivee-la, et un onglet touche ensuite
   * gagne.
   */
  const shelf = safeShelf(
    params.get('shelf') ?? (params.get('purchase') === 'success' ? 'books' : null),
  )

  const pickShelf = (id) => {
    const next = new URLSearchParams(params)
    next.set('shelf', id)
    /* replace: l'historique doit garder une entree par etagere visitee, pas
       une par pression, sinon quatre allers-retours entre deux onglets
       demandent huit retours pour sortir de la page. */
    setParams(next, { replace: shelf === id })
  }

  const counts = Object.fromEntries(
    SHELVES.map((id) => [id, shelfCount(id, { books, formation: 1 })]),
  )

  const articles = studiesOfKind('article')
  const studies = studiesOfKind('study')

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
          return setParams({ shelf: 'books' }, { replace: true })
        }
      }

      /**
       * THE POLL FIXES IT ITSELF NOW, INSTEAD OF WAITING TO GIVE UP.
       *
       * Three tries is about a second and a half on the schedule above. A
       * working webhook has delivered by then, so reaching here means the
       * entitlement is not coming: the
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
       * Once, not on every tick. Repeating it would put a Stripe API call
       * behind every entry in the backoff, and if the first one did not find
       * a paid session the fifteenth will not either.
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

      if (++tries < BACKOFF.length) {
        timer = setTimeout(tick, BACKOFF[tries])
      } else {
        /* The query string is cleared either way, so a refresh does not start
           the poll again, but the notice stays until it is dismissed. */
        setPurchase({ state: 'slow', slug })
        setParams({ shelf: 'books' }, { replace: true })
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
       * LES QUATRE ETAGERES, JUSTE SOUS LE TITRE.
       *
       * La page empilait quatre sortes de contenu dans une seule colonne: une
       * carte vers les cours, la formation, deux bannieres d'etudes, puis le
       * catalogue. Rien ne separait les quatre, et le catalogue, qui est ce
       * qu'on vient chercher le plus souvent, etait a quatre ecrans du titre.
       *
       * Les onglets les mettent au meme niveau et remontent chacune en haut.
       */}
      <div className="pt-6">
        <ShelfTabs value={shelf} onPick={pickShelf} counts={counts} />
      </div>

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
       * LES COURS, LISTES ICI ET PLUS DERRIERE UNE PORTE.
       *
       * "Supprimer la carte intermediaire / le bouton d'atterrissage (Open the
       * courses); la page doit directement lister toutes les cartes de cours."
       *
       * La carte d'avant ne menait pas a un cours, elle menait a une page qui
       * listait les cours. Une porte devant une porte, et un clic pour arriver
       * a une liste qui pouvait etre la.
       *
       * Chaque carte va au sommaire du cours, ou le bouton "commencer" ouvre
       * la premiere lecon. Deux etapes, pas trois, et celle qui reste est un
       * choix reel: quel cours.
       */}
      {shelf === 'courses' && (
        <Section>
          {/* Une grille, pas une pile: a 1180 px trois cartes empilees sur
              toute la largeur sont trois horizons. .card-grid passe a deux
              colonnes a partir de lg et reste une pile sur un telephone. */}
          <div className="card-grid">
            {COURSES.map((c) => {
              const p = progressOf(c)
              const first = firstLessonOf(c)
              return (
                <Link
                  key={c.slug}
                  to={`/cours/${c.slug}`}
                  data-hook="course-card"
                  data-slug={c.slug}
                  className="lg press block overflow-hidden px-5 py-4"
                >
                  {/* Pas de sur-titre "COURS" ici. Trois cartes qui le
                      repetent sous un onglet deja intitule Cours ne disent
                      rien que l'onglet n'ait dit. Les vignettes d'articles et
                      d'etudes en gardent un, parce que la leur distingue deux
                      choses qui se ressemblent. */}
                  <span className="text-safe block text-body font-semibold leading-tight text-ink">
                    {say(c.title, locale)}
                  </span>
                  <span className="text-safe mt-1 block text-small leading-snug text-muted">
                    {say(c.tagline, locale)}
                  </span>
                  <span className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                    {/**
                     * Une puce, pas un bouton: un lien dans un lien ne
                     * s'imbrique pas, et la carte entiere mene deja au bon
                     * endroit. Elle dit par ou ca commence.
                     *
                     * .chip-accent, la puce de l'application: blanc sur le
                     * rose pop, la meme paire que .btn-primary et que les
                     * onglets au-dessus. Elle a ete accent-pressed une
                     * version, pour passer 4,5:1 a 14 px, et c'est le rose
                     * vin qui a ete vu: "plus jamais ce rose". Le ratio de
                     * la paire est 3,80:1 et il est ecrit avec sa decision a
                     * cote de --c-accent dans index.css.
                     */}
                    {first && (
                      <span className="chip-accent" data-hook="course-start-chip">
                        {t('courses.start')}
                      </span>
                    )}
                    <span className="text-small text-muted">
                      {t('courses.progress', { written: p.written, total: p.total })}
                    </span>
                  </span>
                </Link>
              )
            })}

            {/**
             * LA FORMATION, DANS LES COURS PLUTOT QU'A COTE.
             *
             * C'en est un. Elle est simplement plus ancienne que les autres et
             * elle vit dans un autre fichier, ce qui est une raison de
             * structure interne et pas une raison de la ranger ailleurs. Elle
             * avait sa propre section, son propre titre et sa propre couleur,
             * et la page disait donc deux fois "voici un cours" a deux
             * endroits differents.
             *
             * Elle reste un bouton et pas un lien, parce qu'elle s'ouvre dans
             * cette page: c'est le seul cours qui n'a pas d'adresse a lui.
             */}
            <button
              type="button"
              data-hook="formation-entry"
              className="lg press flex w-full items-center gap-4 overflow-hidden px-5 py-4 text-left"
              onClick={() => setCourse(true)}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/[0.10] text-ink [&>svg]:h-6 [&>svg]:w-6">
                <BookIcon />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-safe block text-body font-semibold leading-tight text-ink">
                  {t('form.title')}
                </span>
                <span className="text-safe mt-1 block text-small leading-snug text-muted">
                  {t('form.sub', { n: LESSONS.length })}
                </span>
              </span>
              <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-ink/[0.06] text-ink">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h13M13 6l6 6-6 6" />
                </svg>
              </span>
            </button>
          </div>
        </Section>
      )}

      {/**
       * LES ARTICLES ET LES ETUDES, SUR DEUX ETAGERES.
       *
       * Ce sont deux choses et l'application le disait deja: "Nos etudes" d'un
       * cote, "Article" de l'autre, dans les bandeaux, depuis le debut. Une
       * etude est un sondage qu'on a mene, publie avec sa methode et ses
       * limites. Un article est un texte informatif bati sur les travaux
       * d'autres gens, avec ses sources. Le champ `kind` sort cette difference
       * des chaines de traduction pour que le tri soit du code.
       *
       * Un seul bloc pour les deux onglets, parce que c'est la meme vignette:
       * deux copies du meme JSX diverge le jour ou l'une est retouchee.
       */}
      {(shelf === 'articles' || shelf === 'studies') && (
        <Section>
          <div className="card-grid">
            {(shelf === 'articles' ? articles : studies).map((s) => (
              <Link
                key={s.slug}
                to={`/etudes/${s.slug}`}
                data-hook="studies-banner"
                data-kind={s.kind ?? 'study'}
                /**
                 * A RAISED CARD, NOT AN OUTLINED RECTANGLE.
                 *
                 * These were `border border-hairline` with no ground and no
                 * shadow: a thin box drawn on the page. Every other surface in
                 * this app is a sheet that sits ON the page, and the two do not
                 * belong in one column. Next to a `lg` card an outlined one
                 * reads as a placeholder, or as something disabled.
                 */
                className="lg press flex w-full items-center gap-4 overflow-hidden px-5 py-4 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-label font-semibold uppercase tracking-wider text-muted">
                    {t(`${s.banner}_eyebrow`)}
                  </span>
                  <span className="text-safe mt-1 block text-body font-semibold leading-tight text-ink">
                    {t(`${s.banner}_title`)}
                  </span>
                  <span className="text-safe mt-1 block text-small leading-snug text-muted">
                    {t(`${s.banner}_sub`)}
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
      )}

      {/* L'erreur de chargement appartient au catalogue: c'est lui qui vient du
          reseau. La montrer sur l'onglet des cours, qui est dans le bundle,
          annoncerait une panne a quelqu'un qui ne regarde rien de casse. */}
      {shelf === 'books' && error && (
        <div className="pt-8">
          <ErrorNote error={error} onRetry={load} />
        </div>
      )}

      {shelf === 'books' && (
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
      )}

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
