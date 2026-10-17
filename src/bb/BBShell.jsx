import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { Avatar } from '../components/ui'
import { Mark } from '../components/Wordmark'
import Stickers from '../components/Stickers'
import { Slider, useSlider } from '../components/Segmented'
import { BBLogo } from './kit'

/**
 * The Hakkilo app around every signed-in page: its own navigation,
 * its own logo, the Rich & Friends ground and glass (section 11).
 *
 * The same two shapes as the Rich & Friends shell, because the same person
 * uses both: a floating tab bar on a phone, a rail on the left from md, so
 * an iPad and a laptop get the width. Four places in the bar: Practice
 * lives inside Today and each course, where the session button already is,
 * and the profile is the avatar in the top bar and at the foot of the rail,
 * not a tab ("pas la peine que ton profil soit dans la barre en bas").
 *
 * Rich & Friends is named in a footer at the end of the pages, with its
 * mark and the way back ("enleve le logo RF dans la barre, ca peut etre
 * mentionne dans le footer plutot"): one tap, same account, no second
 * sign-in. The bars carry Hakkilo only.
 *
 * The tab bar is icons ("au lieu de gros boutons avec les noms, juste des
 * icones"), each named in aria-label, and the page you are on opens into a
 * lilac pill with its name beside the icon, as the reference does with
 * "Home": the one word the bar still shows is the answer to "where am I".
 *
 * data-hook="app-shell" so the width sweep measures these pages too.
 */
const TABS = [
  { to: '/hakkilo/app', key: 'bb.nav.today', icon: 'today' },
  { to: '/hakkilo/cours', key: 'bb.nav.courses', icon: 'courses' },
  { to: '/hakkilo/coach', key: 'bb.nav.coach', icon: 'coach' },
  { to: '/hakkilo/plan', key: 'bb.nav.plan', icon: 'plan' },
  { to: '/hakkilo/profil', key: 'bb.nav.profile', icon: 'profile' },
]

const S = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' }

/* A sun over a line: the day. */
const IconToday = (p) => (
  <svg {...S} {...p}>
    <circle cx="12" cy="11" r="4" />
    <path d="M12 2.8v1.8M12 17.4v1.2M4.6 11H3M21 11h-1.6M6.6 5.6 5.5 4.5M18.5 4.5l-1.1 1.1M3.5 21h17" />
  </svg>
)
/* Two stacked books. */
const IconCourses = (p) => (
  <svg {...S} {...p}>
    <path d="M4.5 4.5h6.2a1.8 1.8 0 011.8 1.8v13.2a1.4 1.4 0 00-1.4-1.4H4.5z" />
    <path d="M19.5 4.5h-6.2a1.8 1.8 0 00-1.8 1.8v13.2a1.4 1.4 0 011.4-1.4h6.6z" />
  </svg>
)
/* A speech bubble with a spark: the coach. */
const IconCoach = (p) => (
  <svg {...S} {...p}>
    <path d="M4 5.5A1.5 1.5 0 015.5 4h13A1.5 1.5 0 0120 5.5v9a1.5 1.5 0 01-1.5 1.5H10l-4.5 4v-4H5.5A1.5 1.5 0 014 14.5z" />
    <path d="M12 7.2c.3 1.8 1.2 2.7 3 3-1.8.3-2.7 1.2-3 3-.3-1.8-1.2-2.7-3-3 1.8-.3 2.7-1.2 3-3z" fill="currentColor" stroke="none" />
  </svg>
)
/* A path with stops: the plan. */
const IconPlan = (p) => (
  <svg {...S} {...p}>
    <circle cx="6" cy="6" r="2" />
    <circle cx="18" cy="18" r="2" />
    <path d="M8 6h7.5a3 3 0 010 6h-7a3 3 0 000 6H16" />
  </svg>
)
const ICONS = { today: IconToday, courses: IconCourses, coach: IconCoach, plan: IconPlan }

const activeIndex = (pathname) => TABS.findIndex((tab) => pathname === tab.to || pathname.startsWith(`${tab.to}/`))

/**
 * THE GROUND AROUND THE FLOATING BARS.
 *
 * "Quelques problemes d'agencement" (Kee, two screenshots of the plan on an
 * iPhone): the bars float, and what scrolled past them showed in the gaps.
 * Above the top bar the list ran under the clock ("9:24" over "Thu 29 Oct"),
 * and under the tab bar the next card showed between the bar and Safari's
 * buttons. Measured at 390px: 305 and 514 pixels of text above the bar,
 * 239 under the tab bar. The page draws under the status bar and the
 * browser's controls (viewport-fit=cover), so the gaps reach the screen's
 * edges.
 *
 * So the gaps are the page's own ground, white, out to and past the edge:
 * the top bar's strip continues upward, the tab bar's down past the
 * viewport, where iOS still draws the page. The bars still float, and what
 * scrolls goes behind them and nowhere else.
 */
function TopBar() {
  const { profile } = useAuth()
  const { t } = useT()
  return (
    <header
      className="sticky top-0 z-40 bg-bg px-4 pt-[max(1rem,env(safe-area-inset-top))] before:pointer-events-none before:absolute before:inset-x-0 before:bottom-full before:h-[50vh] before:bg-bg md:hidden"
      data-hook="bb-topbar"
    >
      <nav className="lg lg-chrome mx-auto w-full max-w-content" aria-label={t('bb.nav.primary')}>
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <Link to="/hakkilo/app" aria-label={t('bb.nav.home')} className="press flex shrink-0 items-center gap-2" data-hook="bb-home">
            <BBLogo layout="line" className="h-9 w-auto" pad={0.2} />
          </Link>
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <Link to="/hakkilo/profil" aria-label={t('bb.nav.profile')} className="press block shrink-0 rounded-pill">
              <Avatar profile={profile} size={32} />
            </Link>
          </div>
        </div>
      </nav>
    </header>
  )
}

const RAIL_ROW = 'press flex h-11 w-full items-center justify-center rounded-inner transition-colors duration-200 ease-settle'

function Rail() {
  const { profile } = useAuth()
  const { t } = useT()
  const { pathname } = useLocation()
  const active = activeIndex(pathname)
  return (
    <nav className="lg lg-rail fixed bottom-4 left-4 top-4 z-30 hidden w-[3.5rem] flex-col p-1.5 md:flex" aria-label={t('bb.nav.primary')} data-hook="bb-rail">
      <Link to="/hakkilo/app" aria-label={t('bb.nav.home')} className="press block shrink-0 self-center rounded-inner">
        <BBLogo layout="mono" className="h-auto w-11" pad={0.2} />
      </Link>
      <span aria-hidden="true" className="mx-1 mb-8 mt-4 h-px shrink-0 bg-hairline/60" />
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        {TABS.slice(0, 4).map((tab, i) => {
          const Icon = ICONS[tab.icon]
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              aria-label={t(tab.key)}
              title={t(tab.key)}
              data-active={i === active}
              className={({ isActive }) => `${RAIL_ROW} ${isActive || i === active ? 'lg-pill text-ink' : 'text-ink/70 hover:bg-ink/[0.06] hover:text-ink'}`}
            >
              <Icon className="h-5 w-5 shrink-0" />
            </NavLink>
          )
        })}
      </div>
      <div className="mt-6 flex shrink-0 flex-col gap-3 border-t border-hairline/60 pt-6">
        <NavLink
          to="/hakkilo/profil"
          aria-label={t('bb.nav.profile')}
          title={t('bb.nav.profile')}
          className={({ isActive }) => `${RAIL_ROW} ${isActive ? 'lg-pill text-ink' : 'text-ink/70 hover:bg-ink/[0.06] hover:text-ink'}`}
        >
          {/* Initials in ink: the muted grey measured 4.18:1 on the lilac
              of the page you are on. */}
          <span className="[&_div]:text-ink">
            <Avatar profile={profile} size={26} />
          </span>
        </NavLink>
      </div>
    </nav>
  )
}

function TabBar() {
  const { t } = useT()
  const { pathname } = useLocation()
  const active = activeIndex(pathname)
  const { ref, box } = useSlider(TABS[active]?.to ?? null)
  return (
    <>
      {/* The ground under the bar, from its middle to past the bottom of the
          screen (see TopBar): the bar is 56px tall and sits 16px up. */}
      <div
        aria-hidden="true"
        data-hook="bb-tab-ground"
        className="pointer-events-none fixed inset-x-0 z-20 bg-bg md:hidden"
        style={{ bottom: '-6rem', height: 'calc(6rem + 2.75rem + env(safe-area-inset-bottom))' }}
      />
      <nav className="fixed inset-x-4 bottom-4 z-30 mx-auto max-w-content md:hidden" data-hook="tab-bar" aria-label={t('bb.nav.primary')} style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="lg lg-chrome">
          <div ref={ref} className="relative flex gap-0.5 p-1.5">
            <Slider box={box} className="lg-pill" />
            {TABS.slice(0, 4).map((tab, i) => {
              const Icon = ICONS[tab.icon]
              return (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  aria-label={t(tab.key)}
                  data-active={i === active}
                  className={() => `press relative z-10 flex min-w-0 items-center justify-center gap-1.5 rounded-pill px-2 py-3 transition-[flex-grow,color] duration-300 ease-settle ${i === active ? 'flex-none px-3.5 text-ink' : 'flex-1 text-ink/70'}`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {i === active && <span className="whitespace-nowrap text-[0.8125rem] leading-none">{t(tab.key)}</span>}
                </NavLink>
              )
            })}
          </div>
        </div>
      </nav>
    </>
  )
}

export default function BBShell() {
  return (
    <>
      <div className="ground relative min-h-dvh" data-hook="app-shell" data-product="bb">
        <Stickers set="bb" />
        <Rail />
        <div className="md:pl-[5.5rem]">
          <TopBar />
          <div className="relative z-10">
            <Outlet />
          </div>
        </div>
      </div>
      <TabBar />
    </>
  )
}

/**
 * A page of the app: one column, bounded and centred, like .column-page,
 * ending on the line that says who made it and goes back to Rich & Friends.
 * `footer={false}` for the coach, whose box sits at the end of the page.
 *
 * `wide` gives it 72rem from md. `wide="lg"` keeps the column until lg and
 * gives it 72rem from there, for a page that is one column on an iPad held
 * upright and two from lg (Today, .today-grid in index.css).
 */
export function Page({ children, wide = false, footer = true, className = '' }) {
  const shell = wide === 'lg' ? 'md:max-w-[46rem] lg:max-w-[72rem]' : wide ? 'md:max-w-[72rem]' : ''
  return (
    <div className={`${wide ? '' : 'column-page'} min-h-dvh pb-36 md:pb-16 ${className}`}>
      <div className={`shell animate-rise ${shell}`}>
        {children}
        {footer && <AppFooter />}
      </div>
    </div>
  )
}

function AppFooter() {
  const { t } = useT()
  return (
    <footer className="mt-16 border-t border-hairline pt-5" data-hook="bb-footer">
      <Link to="/" className="press inline-flex items-center gap-2 text-small text-muted hover:text-ink" data-hook="bb-to-rf">
        <Mark size={20} />
        {t('bb.by')}
      </Link>
    </footer>
  )
}

/**
 * The title of a page, with the line under it. What sits on its right goes
 * under it when both do not fit: beside "+ New course" at 390px, "Your
 * courses" broke into two lines of title.
 */
export function PageHead({ eyebrow, title, sub, right }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 pb-2 pt-8 md:pt-12">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-1 text-h1 text-ink">{title}</h1>
        {sub && <p className="lede mt-2 max-w-[56ch]">{sub}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </header>
  )
}
