import { Link, useSearchParams } from 'react-router-dom'
import { LANDING } from '../../content/landing'
import { PREVIEW_BOOKS } from '../../content/previews'
import { useT } from '../../lib/i18n'
import { usePageMeta } from '../../lib/pageMeta'

export default function Books() {
  const { locale, t } = useT()
  const c = (LANDING[locale] ?? LANDING.en).library
  const [params] = useSearchParams()

  usePageMeta({ title: `${c.eyebrow} · Rich & Friends`, description: c.body })

  /* The landing copy and the catalogue are two lists written at different
     times, so they are matched by position rather than by title. Three books
     either way; if that ever stops being true the link simply does not
     render rather than pointing at the wrong book. */
  const slugAt = (i) => PREVIEW_BOOKS[i]?.slug

  return (
    <section className="mx-auto w-full max-w-5xl animate-rise px-6 pb-20 pt-10 md:pt-14">
      {/**
       * QUELQU'UN QUI VIENT DE PAYER, ET QUI N'A PAS DE COMPTE.
       *
       * Acheter ne demande pas de compte: la page d'extrait a son bouton, et
       * /api/checkout accepte une session sans utilisateur. C'est voulu.
       *
       * Mais success_url renvoie sur /library?purchase=success, et /library
       * pour une personne deconnectee EST CETTE PAGE. Elle ne lisait pas le
       * parametre, donc le parcours complet d'un invite etait: il paye, Stripe
       * le debite, il revient, et il tombe sur le catalogue. Pas de
       * confirmation, pas de livre, pas un mot sur ce qu'il faut faire
       * ensuite. Il a paye et l'application ne dit rien.
       *
       * Le webhook, lui, fait son travail: il gare l'achat dans
       * pending_entitlements sur l'adresse de la carte, et claim_entitlements
       * le reprend a la premiere connexion. Tout le mecanisme etait la. Ce qui
       * manquait, c'etait de LE DIRE.
       *
       * L'ADRESSE EST LA CONDITION, donc elle est nommee. "Cree ton compte"
       * sans preciser avec quelle adresse est l'instruction qui fabrique le
       * deuxieme compte, celui qui ne trouvera jamais le livre, et c'est
       * exactement le genre de compte en double que ce projet a deja.
       */}
      {params.get('purchase') === 'success' && (
        <div
          className="panel mb-10 border-l-4 border-accent p-7"
          role="status"
          data-hook="guest-purchase"
        >
          <p className="text-h2 font-semibold text-ink">{t('library.guest_paid_title')}</p>
          <p className="reading mt-2 text-body text-muted">{t('library.guest_paid_body')}</p>
          <Link to="/signin" className="btn-primary press mt-6 inline-flex w-auto px-8">
            {t('library.guest_paid_cta')}
          </Link>
        </div>
      )}

      <div className="panel p-8 md:p-11">
        <p className="eyebrow">{c.eyebrow}</p>
        <div className="mt-4 grid gap-6 md:grid-cols-[1.1fr_1fr] md:items-end">
          <h1 className="display max-w-[18ch] text-[clamp(2.25rem,5.5vw,3.25rem)]">{c.title}</h1>
          <p className="lede max-w-[46ch]">{c.body}</p>
        </div>
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {c.books.map((b, i) => (
          <article key={b.title} className="panel flex flex-col p-7">
            <span className="h-1.5 w-12 rounded-pill bg-accent" aria-hidden="true" />
            <h2 className="mt-5 text-h2 font-semibold text-ink">{b.title}</h2>
            <p className="mt-2 text-small text-muted">{b.sub}</p>
            <p className="lede mt-4 flex-1 text-small">{b.line}</p>
            {/* Straight into the writing, with no account. The whole argument
                for these books is that they are careful about the evidence,
                and that is not a claim anyone should be asked to take on
                trust when three thousand words of it are right there. */}
            {slugAt(i) && (
              <Link to={`/books/${slugAt(i)}`} className="chip-accent press mt-6 self-start">
                {t('library.read_free')}
              </Link>
            )}
          </article>
        ))}
      </div>

      <div className="mt-10">
        <Link to="/signin" className="btn-primary press w-auto px-8">
          {c.cta}
        </Link>
      </div>
    </section>
  )
}
