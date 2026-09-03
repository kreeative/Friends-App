import { Link } from 'react-router-dom'
import { CREDITS, TESTERS } from '../../content/credits'
import { LANDING } from '../../content/landing'
import { CONTACT_EMAIL } from '../../legal/content'
import { useT } from '../../lib/i18n'
import { usePageMeta } from '../../lib/pageMeta'
import { Mark } from '../../components/Wordmark'

/**
 * Thank you, to the people who tested this before it was worth testing.
 *
 * Built on About's shape rather than the marketing pages': one column, one
 * measure, no cards. This page and that one have the same job, which is that
 * somebody reads it and believes it, and the fastest way to lose that is to
 * decorate it.
 *
 * THE ROLL RENDERS ONLY WHEN THERE IS A ROLL.
 *
 * TESTERS ships empty on purpose, so the page had to read correctly with
 * nothing in it: a heading over a blank space is worse than no heading. The
 * prose stands alone, and the list appears the moment names exist. See the
 * note at the top of content/credits.js for why nobody is added by guessing.
 */
export default function Credits() {
  const { locale } = useT()
  const c = CREDITS[locale] ?? CREDITS.en
  const nav = (LANDING[locale] ?? LANDING.en).footer

  usePageMeta({ title: `${c.title} · Rich & Friends`, description: c.lede })

  return (
    <article className="mx-auto w-full max-w-5xl px-6 pb-24 pt-16 md:pt-24">
      <div className="stagger max-w-[42rem]">
        <h1
          style={{ '--i': 0 }}
          className="max-w-[16ch] text-[clamp(2.25rem,7vw,4rem)] font-semibold leading-[0.98] tracking-[-0.03em] text-ink"
        >
          {c.title}
        </h1>

        <p
          style={{ '--i': 1 }}
          className="mt-7 max-w-[38ch] text-[clamp(1.125rem,2vw,1.5rem)] font-semibold leading-[1.4] text-loud"
        >
          {c.lede}
        </p>

        <div style={{ '--i': 2 }} className="mt-12 max-w-[36em] space-y-6 text-body text-muted">
          {c.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        {TESTERS.length > 0 && (
          <section style={{ '--i': 3 }} className="mt-14" data-hook="credits-roll">
            <h2 className="eyebrow">{c.rollTitle}</h2>
            {/* A list, not a grid of avatar cards. These are people who did a
                favour, and dressing that up as a team page would make it look
                like a company they work for. */}
            <ul className="mt-5 max-w-[36em] divide-y divide-hairline border-t border-hairline">
              {TESTERS.map((p) => (
                <li key={p.name} className="py-3.5">
                  <p className="text-safe text-body font-semibold text-ink">{p.name}</p>
                  {p.note && <p className="text-safe mt-0.5 text-small text-muted">{p.note}</p>}
                </li>
              ))}
            </ul>

            {/**
             * How to come off the page, printed on the page.
             *
             * Publishing somebody's name should carry the way to stop
             * publishing it, in the place they would be reading it, rather
             * than in a policy two clicks away. The address is the one in
             * legal/content, so there is one contact address in the project
             * and this cannot drift from it.
             */}
            <p className="mt-6 max-w-[36em] text-small text-muted">
              {c.removal}{' '}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-semibold text-ink underline decoration-1 underline-offset-2"
              >
                {CONTACT_EMAIL}
              </a>
            </p>
          </section>
        )}

        <div style={{ '--i': 4 }} className="mt-14 flex items-center gap-4 border-t border-hairline pt-8">
          <Mark size={56} />
          <div>
            <p className="text-body font-semibold text-ink">{c.signature}</p>
            <p className="text-small text-muted">{c.signatureNote}</p>
          </div>
        </div>

        <div style={{ '--i': 5 }} className="mt-12">
          <Link to="/signin" className="btn-primary press w-auto px-9">
            {nav.links.signin}
          </Link>
        </div>
      </div>
    </article>
  )
}
