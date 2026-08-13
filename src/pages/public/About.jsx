import { Link } from 'react-router-dom'
import { ABOUT } from '../../content/about'
import { LANDING } from '../../content/landing'
import { useT } from '../../lib/i18n'
import { usePageMeta } from '../../lib/seo'
import { Mark } from '../../components/Wordmark'

/**
 * The founder's story, set as one column of prose.
 *
 * No cards, no pull quotes, no statistics. This is the one page on the site
 * whose whole job is that somebody reads it top to bottom and believes it,
 * and the fastest way to lose that is to decorate it into a landing page.
 *
 * It is also the page most likely to be found in a search for the founder's
 * name, which is why it carries its own title and description rather than
 * inheriting the site's.
 */
export default function About() {
  const { locale } = useT()
  const c = ABOUT[locale] ?? ABOUT.en
  const nav = (LANDING[locale] ?? LANDING.en).footer

  usePageMeta({
    title: `${c.title} · Rich & Friends`,
    description: c.lede,
  })

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

        {/* One measure, generous leading. Prose this personal is read, not
            scanned, so it gets the reader's line length rather than the
            marketing page's. */}
        <div style={{ '--i': 2 }} className="mt-12 max-w-[36em] space-y-6 text-body text-muted">
          {c.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        <div style={{ '--i': 3 }} className="mt-14 flex items-center gap-4 border-t border-hairline pt-8">
          <Mark size={56} />
          <div>
            <p className="text-body font-semibold text-ink">{c.signature}</p>
            <p className="text-small text-muted">{c.signatureNote}</p>
          </div>
        </div>

        <div style={{ '--i': 4 }} className="mt-12">
          <Link to="/signin" className="btn-primary press w-auto px-9">
            {nav.links.signin}
          </Link>
        </div>
      </div>
    </article>
  )
}
