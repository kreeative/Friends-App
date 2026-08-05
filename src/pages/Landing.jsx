import { Link } from 'react-router-dom'
import { LANDING } from '../content/landing'
import { useT } from '../lib/i18n'
import { Lockup, Mark, Monogram } from '../components/Wordmark'
import ThemePicker from '../components/ThemePicker'
import Footer from '../components/Footer'

/**
 * The public front door.
 *
 * One accent, whichever the visitor chose, and nothing else coloured. Every
 * band, rule, numeral and progress bar on this page draws from the same
 * token, so switching the theme repaints the page rather than rearranging a
 * mixture. Green is not used here at all — it means "checked in this week",
 * which is not a thing a landing page can say.
 *
 * The surfaces are glass: blur, saturate, a lit top edge in the accent and a
 * dark under-edge for thickness, over a single-hue ambient that gives the
 * blur something to work on.
 *
 * Playfair carries the headlines at 400 and appears nowhere else. At 600, and
 * running through the navigation as well, it stopped being a voice and became
 * the loudest thing on the page.
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
          <nav className="glass-strong mx-auto flex w-full max-w-5xl items-center justify-between gap-4 rounded-pill px-4 py-2.5">
            <Lockup width={112} />
            <div className="flex items-center gap-6">
              <a href="#how" className="nav-link hidden sm:inline">
                {c.footer.links.how}
              </a>
              <a href="#books" className="nav-link hidden sm:inline">
                {c.footer.links.library}
              </a>
              <Link to="/signin" className="chip-accent press">
                {c.footer.links.signin}
              </Link>
            </div>
          </nav>
        </header>

        {/* ---------------------------------------------------------- hero */}
        <section className="mx-auto grid w-full max-w-5xl animate-rise gap-14 px-6 pb-20 pt-16 md:grid-cols-[1.05fr_1fr] md:items-center md:pt-24">
          <div>
            <p className="eyebrow">{c.hero.eyebrow}</p>
            <h1 className="display mt-6 max-w-[15ch] text-[clamp(2.75rem,7.5vw,4.75rem)]">
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

          {/* A sheet of glass with the mark on it, and no second colour behind
              it — the blue ampersand under the yellow wordmark is exactly what
              made the old plate read as three brands at once. The ampersand is
              now the same accent, dropped to a whisper so it reads as texture
              rather than as a second mark. */}
          <div className="panel relative isolate flex aspect-[5/4] items-center justify-center overflow-hidden p-8">
            <Monogram
              size={400}
              className="pointer-events-none absolute -bottom-20 -right-14 opacity-[0.09]"
            />
            <div className="relative flex flex-col items-center gap-6 text-center">
              <Lockup width={280} className="max-w-full" />
              <p className="text-small text-muted">{c.hero.plate}</p>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- rule */}
        <div className="mx-auto w-full max-w-5xl px-6" aria-hidden="true">
          <span className="block h-1.5 w-full rounded-pill bg-accent/90" />
        </div>

        {/* ------------------------------------------------------- problem */}
        <section className="mx-auto w-full max-w-5xl px-6 py-20">
          <div className="panel grid gap-10 p-8 md:grid-cols-[1fr_1.5fr] md:p-12">
            <div>
              <p className="eyebrow">{c.problem.eyebrow}</p>
              <Mark size={104} className="mt-8" />
            </div>
            <div>
              <h2 className="display max-w-[20ch] text-[clamp(1.75rem,4vw,2.5rem)]">
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
                {/* Sans, and quiet. As a large Playfair numeral in the accent
                    this was the first thing the eye landed on — ahead of the
                    words it was there to number. */}
                <p className="text-small font-bold tracking-[0.12em] text-muted">{s.n}</p>
                <span className="mt-4 block h-1 w-8 rounded-pill bg-accent" aria-hidden="true" />
                <h3 className="mt-6 text-h2 font-bold text-ink">{s.title}</h3>
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
                  <h3 className="text-h2 font-bold text-ink">{d.title}</h3>
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
                <div className="h-full w-[62%] rounded-pill bg-accent" />
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
              <h2 className="display mt-6 max-w-[18ch] text-[clamp(1.75rem,4vw,2.5rem)]">
                {c.library.title}
              </h2>
            </div>
            <p className="lede max-w-[46ch]">{c.library.body}</p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {c.library.books.map((b) => (
              <article key={b.title} className="panel flex flex-col p-8">
                <span className="h-1.5 w-12 rounded-pill bg-accent" aria-hidden="true" />
                <h3 className="mt-6 text-h2 font-bold text-ink">{b.title}</h3>
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

        {/* --------------------------------------------------------- theme */}
        <section className="mx-auto w-full max-w-5xl px-6 py-12">
          <div className="panel-quiet p-8 md:p-10">
            <h2 className="display text-[clamp(1.5rem,3vw,2rem)]">{c.theme.title}</h2>
            <p className="lede mt-3 max-w-[52ch]">{c.theme.body}</p>
            <ThemePicker className="mt-9" />
          </div>
        </section>

        {/* --------------------------------------------------------- close */}
        <section className="mx-auto w-full max-w-5xl px-6 py-20">
          <div className="panel relative isolate overflow-hidden px-6 py-20 text-center">
            <Monogram
              size={340}
              className="pointer-events-none absolute -left-16 -top-20 opacity-[0.07]"
            />
            <div className="relative">
              <Mark size={64} className="mx-auto" />
              <h2 className="display mx-auto mt-9 max-w-[18ch] text-[clamp(2rem,5.5vw,3rem)]">
                {c.close.title}
              </h2>
              <p className="lede mx-auto mt-5 max-w-[40ch]">{c.close.body}</p>
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
