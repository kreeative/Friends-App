import { Link } from 'react-router-dom'
import { LANDING } from '../content/landing'
import { useT } from '../lib/i18n'
import Wordmark, { Monogram } from '../components/Wordmark'
import Footer from '../components/Footer'

/**
 * The public front door.
 *
 * Three rules hold this page together:
 *
 *   1. The logo is an object, never a run of text. It always sits on its own
 *      black ground — a badge in the nav, a plate in the hero — which is both
 *      how the artwork was drawn and the only way the yellow colourway can
 *      appear on a white page at all (yellow on white is 1.4:1).
 *   2. Glass, not flat cards. Every surface here is translucent over a loud
 *      four-colour ambient, with a float shadow and a lit top edge.
 *   3. Playfair carries the voice — nav, headlines, numerals. The signed-in
 *      app is untouched; it keeps its own quieter type and surfaces.
 *
 * There is no stock photography. The graphic language is the brand's own:
 * the ampersand at size, blocks of the four colours, and a preview built out
 * of the real interface classes, which cannot drift from what people get.
 */
export default function Landing() {
  const { locale } = useT()
  const c = LANDING[locale] ?? LANDING.en

  return (
    <div className="relative min-h-dvh bg-bg">
      <div className="ambient-loud" aria-hidden="true" />

      <div className="relative z-10">
        {/* ----------------------------------------------------------- nav */}
        <header className="sticky top-0 z-30 px-4 pt-4">
          <nav className="glass-strong mx-auto flex w-full max-w-5xl items-center justify-between gap-4 rounded-pill py-2 pl-2 pr-3">
            {/* The badge is the logo's ground. It never inherits the page's. */}
            <span className="brand-badge">
              <Wordmark variant="yellow" width={118} />
            </span>

            <div className="flex items-center gap-6">
              <a href="#how" className="nav-link hidden sm:inline">
                {c.footer.links.how}
              </a>
              <a href="#books" className="nav-link hidden sm:inline">
                {c.footer.links.library}
              </a>
              <Link to="/signin" className="chip-pink press">
                {c.footer.links.signin}
              </Link>
            </div>
          </nav>
        </header>

        {/* ---------------------------------------------------------- hero */}
        <section className="mx-auto grid w-full max-w-5xl animate-rise gap-14 px-6 pb-20 pt-16 md:grid-cols-[1.05fr_1fr] md:items-center md:pt-24">
          <div>
            <p className="eyebrow">{c.hero.eyebrow}</p>
            <h1 className="mt-6 max-w-[15ch] font-title text-[clamp(2.75rem,7.5vw,4.75rem)] font-semibold leading-[1.02] tracking-[-0.02em] text-ink">
              {c.hero.title}
            </h1>
            <p className="lede mt-7 max-w-[44ch] text-[1.125rem]">{c.hero.body}</p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link to="/signin" className="btn-primary press w-auto px-8">
                {c.hero.cta}
              </Link>
              <a href="#books" className="btn-outline press w-auto px-8">
                {c.hero.secondary}
              </a>
            </div>
            <p className="mt-5 text-small text-muted">{c.hero.note}</p>
          </div>

          {/* The brand as a picture. Blue behind, yellow in front — the two
              colourways that were supplied together, used together. */}
          <div className="brand-plate flex aspect-[5/4] items-center justify-center p-8">
            <Monogram
              size={420}
              variant="blue"
              className="pointer-events-none absolute -bottom-24 -right-16 opacity-40"
            />
            <div className="relative flex flex-col items-center gap-6 text-center">
              <Wordmark variant="yellow" width={300} className="max-w-full" />
              <p className="font-title text-[0.9375rem] italic text-white/70">{c.hero.plate}</p>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ colour banding */}
        <div className="mx-auto flex w-full max-w-5xl gap-2 px-6" aria-hidden="true">
          <span className="h-2 flex-[3] rounded-pill bg-pink" />
          <span className="h-2 flex-[2] rounded-pill bg-green" />
          <span className="h-2 flex-1 rounded-pill bg-yellow" />
          <span className="h-2 flex-1 rounded-pill bg-blue" />
        </div>

        {/* ------------------------------------------------------- problem */}
        <section className="mx-auto w-full max-w-5xl px-6 py-20">
          <div className="panel grid gap-10 p-8 md:grid-cols-[1fr_1.5fr] md:p-12">
            <div>
              <p className="eyebrow">{c.problem.eyebrow}</p>
              {/* On its own plate, again. Yellow on a white page measures
                  1.4:1 — as a mark it simply disappears. */}
              <div className="brand-plate mt-8 flex aspect-square w-40 items-center justify-center">
                <Monogram size={104} variant="yellow" />
              </div>
            </div>
            <div>
              <h2 className="max-w-[20ch] font-title text-[clamp(1.75rem,4vw,2.625rem)] font-semibold leading-[1.1] tracking-[-0.015em] text-ink">
                {c.problem.title}
              </h2>
              <p className="lede mt-6 max-w-[52ch]">{c.problem.body}</p>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------- steps */}
        <section id="how" className="mx-auto w-full max-w-5xl scroll-mt-28 px-6 py-12">
          <p className="eyebrow">{c.steps.eyebrow}</p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {c.steps.items.map((s) => (
              <div key={s.n} className="panel p-8">
                {/* Numbered because this genuinely is a sequence. Pink at this
                    size counts as large text — 4.9:1 on black, 4.3:1 on white,
                    both past the 3:1 large-text threshold. */}
                <p className="font-title text-[2.75rem] font-semibold leading-none text-pink">
                  {s.n}
                </p>
                <h3 className="mt-6 font-title text-[1.375rem] font-semibold leading-tight text-ink">
                  {s.title}
                </h3>
                <p className="lede mt-3 text-small">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ----------------------------------------------- product preview */}
        <section className="mx-auto grid w-full max-w-5xl gap-12 px-6 py-20 md:grid-cols-2 md:items-center">
          <div>
            <p className="eyebrow">{c.different.eyebrow}</p>
            <div className="mt-10 space-y-8">
              {c.different.items.map((d) => (
                <div key={d.title}>
                  <h3 className="font-title text-[1.375rem] font-semibold leading-tight text-ink">
                    {d.title}
                  </h3>
                  <p className="lede mt-2 max-w-[44ch]">{d.body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* The interface itself, as the illustration — real classes, so it
              cannot drift away from what people actually get. */}
          <div className="panel p-7">
            <p className="eyebrow">{c.different.previewTitle}</p>
            <div className="list mt-4">
              {c.different.preview.map(([initials, name, chip, label]) => (
                <div key={name} className="flex items-center gap-4 py-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-ink/[0.06] text-small text-muted">
                    {initials}
                  </span>
                  <span className="flex-1 text-body text-ink">{name}</span>
                  <span className={chip}>{label}</span>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <div className="h-1.5 w-full overflow-hidden rounded-pill bg-ink/[0.07]">
                <div className="h-full w-[62%] rounded-pill bg-yellow" />
              </div>
              <p className="mt-2.5 text-small text-muted">{c.different.previewRate}</p>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------- books */}
        <section id="books" className="mx-auto w-full max-w-5xl scroll-mt-28 px-6 py-12">
          <div className="grid gap-10 md:grid-cols-[1.2fr_1fr] md:items-end">
            <div>
              <p className="eyebrow">{c.library.eyebrow}</p>
              <h2 className="mt-6 max-w-[18ch] font-title text-[clamp(1.75rem,4vw,2.625rem)] font-semibold leading-[1.1] tracking-[-0.015em] text-ink">
                {c.library.title}
              </h2>
            </div>
            <p className="lede max-w-[46ch]">{c.library.body}</p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {c.library.books.map((b, i) => (
              <article key={b.title} className="panel flex flex-col p-8">
                <span
                  className={`h-1.5 w-12 rounded-pill ${['bg-pink', 'bg-green', 'bg-yellow'][i]}`}
                />
                <h3 className="mt-6 font-title text-[1.375rem] font-semibold italic leading-tight text-ink">
                  {b.title}
                </h3>
                <p className="mt-2 text-small text-muted">{b.sub}</p>
                <p className="lede mt-5 flex-1 text-small">{b.line}</p>
              </article>
            ))}
          </div>

          <div className="mt-10">
            <Link to="/signin" className="btn-outline press w-auto px-8">
              {c.library.cta}
            </Link>
          </div>
        </section>

        {/* --------------------------------------------------------- close */}
        <section className="mx-auto w-full max-w-5xl px-6 py-20">
          {/* Ends on the logo's own ground, so the last thing seen is the
              brand rather than another white card. */}
          <div className="brand-plate px-6 py-20 text-center">
            <Monogram
              size={360}
              variant="blue"
              className="pointer-events-none absolute -left-20 -top-24 opacity-25"
            />
            <div className="relative">
              <Monogram size={72} variant="yellow" className="mx-auto" />
              <h2 className="mx-auto mt-9 max-w-[18ch] font-title text-[clamp(2rem,5.5vw,3.25rem)] font-semibold leading-[1.06] tracking-[-0.015em] text-white">
                {c.close.title}
              </h2>
              <p className="mx-auto mt-5 max-w-[40ch] text-body text-white/70">{c.close.body}</p>
              <div className="mt-10 flex justify-center">
                <Link to="/signin" className="btn-primary press w-auto px-10">
                  {c.close.cta}
                </Link>
              </div>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </div>
  )
}
