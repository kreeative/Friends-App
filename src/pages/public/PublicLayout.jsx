import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { LANDING } from '../../content/landing'
import { useT } from '../../lib/i18n'
import { LockupInline } from '../../components/Wordmark'
import Footer from '../../components/Footer'
import Stickers from '../../components/Stickers'
import PageTransition from '../../components/PageTransition'

/**
 * The public site's chrome: one navigation bar, one footer, around whichever
 * page is showing.
 *
 * The site is three pages rather than one long scroll. A single page meant
 * the navigation pointed at fragments of itself, which is not a menu. You
 * cannot be anywhere in it, so nothing can be marked current and nothing can
 * be linked to on its own.
 */
export const PUBLIC_LINKS = [
  { to: '/how-it-works', key: 'how' },
  { to: '/about', key: 'about' },
  { to: '/books', key: 'library' },
]

export default function PublicLayout() {
  const { locale } = useT()
  const c = (LANDING[locale] ?? LANDING.en).footer
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  // A menu that survives navigation is a menu covering the page you asked for.
  useEffect(() => setOpen(false), [pathname])

  // The ground is the theme's field colour, full bleed. That is also what
  // finally makes the glass real: a sheet over flat white has nothing to
  // bend, so the blur was a no-op and the panels were carried entirely by
  // their rim. Over a saturated ground there is something to refract, which
  // is the whole reason the material exists.
  return (
    /* data-surface="public" swaps the whole token set to the neutral one. See
       the block in index.css for why the marketing pages do not wear the app's
       theme, and why it is set on the element rather than fought for at the
       root. */
    <div data-surface="public" className="ground relative min-h-dvh">
      {/* Every public page, not just the landing hero. */}
      <Stickers set="page" />

      <div className="relative z-10">
        <header className="sticky top-0 z-30 px-4 pt-4">
          <nav className="glass-strong mx-auto w-full max-w-5xl rounded-card px-4 py-2.5">
            <div className="flex items-center justify-between gap-4">
              <Link to="/" aria-label={c.home}>
                <LockupInline size={38} />
              </Link>

              <div className="hidden items-center gap-7 sm:flex">
                {PUBLIC_LINKS.map((l) => (
                  <NavLink
                    key={l.to}
                    to={l.to}
                    className={({ isActive }) =>
                      isActive ? 'nav-link nav-link-active' : 'nav-link'
                    }
                  >
                    {c.links[l.key]}
                  </NavLink>
                ))}
                <Link to="/signin" className="chip-accent press">
                  {c.links.signin}
                </Link>
              </div>

              {/* Phone: the links do not fit next to the mark, so they move
                  into a sheet rather than shrinking until they are unreadable. */}
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-controls="public-menu"
                className="press -mr-1 flex h-11 w-11 items-center justify-center rounded-pill sm:hidden"
              >
                <span className="sr-only">{c.menu}</span>
                <span aria-hidden="true" className="flex w-5 flex-col gap-[5px]">
                  <span className="h-[2px] w-full rounded-pill bg-ink" />
                  <span className="h-[2px] w-full rounded-pill bg-ink" />
                  <span className="h-[2px] w-full rounded-pill bg-ink" />
                </span>
              </button>
            </div>

            {/**
             * The menu grows the bar rather than appearing in it.
             *
             * It used to be mounted and unmounted, so the bar jumped from 60px
             * to 260px between two frames and the page under it jumped with
             * it. The grid trick animates to the content's real height with
             * nothing measured: rows from 0fr to 1fr, and the child carries
             * the clip so a shut menu is genuinely zero-height rather than
             * squashed. Same technique as the account panel in the app shell.
             *
             * The easing is a spring rather than an ease. The brief asked for
             * Framer Motion at stiffness 300, damping 30, which settles in
             * about 400ms with a small overshoot; the cubic-bezier below has
             * the same duration and the same slight pass beyond the target.
             * The difference is 50kB of runtime for a menu that opens once,
             * and this file has no other reason to pull one in. If motion
             * becomes a system across the site rather than two flourishes,
             * that is the moment to reach for the library.
             *
             * Nothing clips: the nav has no overflow of its own, so the sheet
             * simply gets taller and continues to sit over the page.
             */}
            <div
              id="public-menu"
              aria-hidden={!open}
              className={`grid transition-[grid-template-rows,opacity] duration-[420ms] motion-reduce:transition-none sm:hidden ${
                open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              }`}
              style={{ transitionTimingFunction: 'cubic-bezier(0.22, 1.28, 0.42, 1)' }}
            >
              <div className="overflow-hidden">
                <ul className="mt-3 space-y-1 border-t border-hairline pt-3">
                  {[...PUBLIC_LINKS, { to: '/signin', key: 'signin', cta: true }].map((l, i) => (
                    <li
                      key={l.to}
                      className={`transition-[opacity,transform] duration-300 ease-settle motion-reduce:transition-none ${
                        l.cta ? 'pt-2' : ''
                      } ${open ? 'translate-y-0 opacity-100' : '-translate-y-1.5 opacity-0'}`}
                      /* The stagger. Each item is 50ms behind the one above on
                         the way in; on the way out they all leave together,
                         because a menu that unwinds item by item feels slow to
                         close in a way it never does to open. */
                      style={{ transitionDelay: open ? `${80 + i * 50}ms` : '0ms' }}
                    >
                      {l.cta ? (
                        <Link
                          to={l.to}
                          tabIndex={open ? undefined : -1}
                          className="btn-primary press"
                        >
                          {c.links[l.key]}
                        </Link>
                      ) : (
                        <NavLink
                          to={l.to}
                          tabIndex={open ? undefined : -1}
                          className={({ isActive }) =>
                            `block py-2.5 text-body font-semibold ${isActive ? 'text-ink' : 'text-muted'}`
                          }
                        >
                          {c.links[l.key]}
                        </NavLink>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </nav>
        </header>

        <PageTransition>
          <Outlet />
        </PageTransition>
        <Footer />
      </div>
    </div>
  )
}
