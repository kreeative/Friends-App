import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { Avatar } from '../components/ui'
import { Mark } from '../components/Wordmark'
import Stickers from '../components/Stickers'
import { Slider, useSlider } from '../components/Segmented'
import { BBLogo } from './kit'

/**
 * The Beauty & Brain app around every signed-in page: its own navigation,
 * its own logo, the Rich & Friends ground and glass (section 11).
 *
 * The same two shapes as the Rich & Friends shell, because the same person
 * uses both: a floating tab bar on a phone, a rail on the left from md, so
 * an iPad and a laptop get the width. Five places, not six: Practice lives
 * inside Today and each course, where the session button already is, and a
 * sixth tab truncates its label at 390px (see MINE in AppShell.jsx).
 *
 * The switcher to Rich & Friends is the R&F mark itself, in the top bar and
 * at the foot of the rail: one tap, same account, no second sign-in.
 *
 * The tab bar is icons ("au lieu de gros boutons avec les noms, juste des
 * icones"), each named in aria-label, and the page you are on opens into a
 * lilac pill with its name beside the icon, as the reference does with
 * "Home": the one word the bar still shows is the answer to "where am I".
 *
 * data-hook="app-shell" so the width sweep measures these pages too.
 */
const TABS = [
  { to: '/bb/app', key: 'bb.nav.today', icon: 'today' },
  { to: '/bb/cours', key: 'bb.nav.courses', icon: 'courses' },
  { to: '/bb/coach', key: 'bb.nav.coach', icon: 'coach' },
  { to: '/bb/plan', key: 'bb.nav.plan', icon: 'plan' },
  { to: '/bb/profil', key: 'bb.nav.profile', icon: 'profile' },
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

function TopBar() {
  const { profile } = useAuth()
  const { t } = useT()
  return (
    <header className="sticky top-0 z-40 px-4 pt-4 md:hidden">
      <nav className="lg lg-chrome mx-auto w-full max-w-content" aria-label={t('bb.nav.primary')}>
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <Link to="/bb/app" aria-label={t('bb.nav.home')} className="press flex shrink-0 items-center gap-2" data-hook="bb-home">
            <BBLogo layout="mono" className="h-9 w-auto" pad={0.2} />
            <span className="text-small font-bold tracking-tight text-ink">Beauty &amp; Brain</span>
          </Link>
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <Link to="/" className="press flex h-10 w-10 items-center justify-center rounded-pill" aria-label={t('bb.nav.switch')} title={t('bb.nav.switch')} data-hook="bb-switch">
              <Mark size={30} />
            </Link>
            <Link to="/bb/profil" aria-label={t('bb.nav.profile')} className="press block shrink-0 rounded-pill">
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
      <Link to="/bb/app" aria-label={t('bb.nav.home')} className="press block shrink-0 self-center rounded-inner">
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
        <Link to="/" className={`${RAIL_ROW} text-ink/70 hover:bg-ink/[0.06]`} aria-label={t('bb.nav.switch')} title={t('bb.nav.switch')} data-hook="bb-switch-rail">
          <Mark size={26} />
        </Link>
        <NavLink
          to="/bb/profil"
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
  const { profile } = useAuth()
  const { pathname } = useLocation()
  const active = activeIndex(pathname)
  const { ref, box } = useSlider(TABS[active]?.to ?? null)
  return (
    <nav className="fixed inset-x-4 bottom-4 z-30 mx-auto max-w-content md:hidden" data-hook="tab-bar" aria-label={t('bb.nav.primary')} style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="lg lg-chrome">
        <div ref={ref} className="relative flex gap-0.5 p-1.5">
          <Slider box={box} className="lg-pill" />
          {TABS.map((tab, i) => {
            const Icon = ICONS[tab.icon]
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                aria-label={t(tab.key)}
                data-active={i === active}
                className={() => `press relative z-10 flex min-w-0 items-center justify-center gap-1.5 rounded-pill px-2 py-3 transition-[flex-grow,color] duration-300 ease-settle ${i === active ? 'flex-none px-3.5 text-ink' : 'flex-1 text-ink/70'}`}
              >
                {Icon ? <Icon className="h-5 w-5 shrink-0" /> : <span className="block h-5 w-5 shrink-0 overflow-hidden rounded-pill [&_div]:text-ink"><Avatar profile={profile} size={20} /></span>}
                {i === active && <span className="whitespace-nowrap text-[0.8125rem] leading-none">{t(tab.key)}</span>}
              </NavLink>
            )
          })}
        </div>
      </div>
    </nav>
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

/** A page of the app: one column, bounded and centred, like .column-page. */
export function Page({ children, wide = false, className = '' }) {
  return (
    <div className={`${wide ? '' : 'column-page'} min-h-dvh pb-36 md:pb-16 ${className}`}>
      <div className={`shell animate-rise ${wide ? 'md:max-w-[72rem]' : ''}`}>{children}</div>
    </div>
  )
}

/** The title of a page, with the line under it. */
export function PageHead({ eyebrow, title, sub, right }) {
  return (
    <header className="flex items-start justify-between gap-4 pb-2 pt-8 md:pt-12">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-1 text-h1 text-ink">{title}</h1>
        {sub && <p className="lede mt-2 max-w-[56ch]">{sub}</p>}
      </div>
      {right && <div className="shrink-0 pt-1">{right}</div>}
    </header>
  )
}
