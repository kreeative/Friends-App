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
    <div className="ground relative min-h-dvh">
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

            {open && (
              <div id="public-menu" className="mt-3 border-t border-hairline pt-3 sm:hidden">
                <ul className="space-y-1">
                  {PUBLIC_LINKS.map((l) => (
                    <li key={l.to}>
                      <NavLink
                        to={l.to}
                        className={({ isActive }) =>
                          `block py-2.5 text-body font-semibold ${isActive ? 'text-ink' : 'text-muted'}`
                        }
                      >
                        {c.links[l.key]}
                      </NavLink>
                    </li>
                  ))}
                  <li className="pt-2">
                    <Link to="/signin" className="btn-primary press">
                      {c.links.signin}
                    </Link>
                  </li>
                </ul>
              </div>
            )}
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
