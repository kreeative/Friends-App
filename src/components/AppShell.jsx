import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { onPendingChange, startAutoFlush } from '../lib/queue'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { useT } from '../lib/i18n'
import { Avatar } from './ui'
import { LockupInline } from './Wordmark'
import { NAV_ICON } from './NavIcons'
import NotificationBell from './NotificationBell'
import Stickers from './Stickers'
import PageTransition from './PageTransition'
import { Slider, useSlider } from './Segmented'

/**
 * Two levels of navigation, because there are two levels of place.
 *
 * The top bar is the same on every screen: it is what stops the app feeling
 * like a room you were shut into. Wherever you are, the logo goes home and
 * your face is one tap from sign-out.
 *
 * The bottom bar is contextual. Outside a group it is the things that belong
 * to you; inside one it is the four that belong to the group. A single flat
 * tab bar could not do both without either hiding the dashboard behind a
 * group or listing check-in when there is no group to check into.
 *
 * "YOU" IS NOT IN THE BAR.
 *
 * "You" was the only tab that was a settings screen rather than a place, and
 * it competed for width with the things people actually move between. There is
 * already a way in that says the same thing more directly: your own face, in
 * the top corner of every screen, which opens the account panel with Profile &
 * Settings in it. The /me route is untouched.
 *
 * This was five tabs for a while, with the journal taking the width that "You"
 * had given up. The journal is gone from the app, so the bar is back to four
 * and the label size it needed at five is no longer load-bearing: see the
 * measurements in TabBar below.
 */
const MINE = [
  { to: '/', key: 'nav.home', end: true, icon: 'home' },
  // Your own goals, which no longer require a group to exist in.
  { to: '/goals', key: 'nav.goals', icon: 'goals' },
  { to: '/money', key: 'nav.budget', icon: 'budget' },
  { to: '/library', key: 'nav.library', icon: 'library' },
]

/**
 * The calendar, which is in the rail and NOT in the bottom bar.
 *
 * It is personal rather than contextual, so it belongs in both lists and is
 * appended to whichever one is showing rather than being written into each.
 *
 * The bottom bar does not get it, and that asymmetry is deliberate. TabBar's
 * own note records what a fifth tab did to a 390px phone: French "Objectifs"
 * wants 70px and an equal fifth of that screen gives it 66, so the tab people
 * press most read "Objectif...". The rail is a vertical list and has no such
 * ceiling. On a phone the calendar is reached from the dashboard's own card,
 * which links straight into it, so it is one tap from home either way.
 */
const CALENDAR = { to: '/calendar', key: 'nav.calendar', icon: 'calendar' }

/**
 * Four tabs, and Proof is not one of them.
 *
 * It was a fifth, and a fifth is where a bar of this width starts truncating:
 * "Faire le p…", "Object…". It also described a place rather than a thing you
 * do, which is the odd one out here, and it split a single act in two. A photo
 * is proof OF a check-in. Attaching one belongs in the same screen as the
 * thing it is evidence for, and the gallery belongs directly under the form
 * that fills it.
 *
 * The route stays. Anybody with the page open or a link to it still gets it,
 * and the check-in links straight through for the full grid.
 */
const IN_GROUP = (id) => [
  { to: `/g/${id}`, key: 'nav.board', end: true, icon: 'board' },
  /* Its own key rather than the chip's. "Faire le point" is the right words
     on a button and two characters too many in a tab, where it truncated to
     "Faire le p…" at 390px. */
  { to: `/g/${id}/checkin`, key: 'nav.checkin', icon: 'checkin' },
  { to: `/g/${id}/goals`, key: 'nav.goals', icon: 'goals' },
  { to: `/g/${id}/settings`, key: 'nav.group', icon: 'group' },
]

/**
 * The offline queue, running with nothing on screen.
 *
 * There used to be a strip under the header announcing "saved, it will send as
 * soon as you are back online", and it was the wrong shape of message twice
 * over. It reported plumbing rather than anything the reader could act on, and
 * because a queued entry only clears on a successful send, one entry the
 * server keeps refusing pins the strip to the top of every screen forever.
 * That is what turns an occasional reassurance into a permanent banner about a
 * problem nobody can fix from the app.
 *
 * The flushing is the part that mattered, and it lives here now rather than
 * inside the thing that drew the strip. Deleting the component without moving
 * this would have stopped queued check-ins sending at all.
 */
function useAutoFlush() {
  const { reloadGroup } = useGroup()

  useEffect(() => {
    const stop = startAutoFlush()
    // Once the queue drains, the group is out of date by exactly the entries
    // that just went out.
    const off = onPendingChange((n) => n === 0 && reloadGroup())
    return () => {
      stop()
      off()
    }
  }, [])
}

/**
 * Home, which group you are in, and you. Present on every screen.
 *
 * There used to be an account panel that expanded inside the bar, holding the
 * name, the email, a link to the profile and a sign-out. It is gone: it was a
 * table of contents for a page one tap away that opens with the same name and
 * the same email. The avatar is that link now.
 */
/**
 * THE TOP BAR IS A PHONE COMPONENT NOW.
 *
 * It used to run at every width, and once the rail took the bell and the
 * avatar there was nothing left in it above md except the group's name: an
 * empty 76px strip across the top of every screen, on the layout whose whole
 * complaint was that the app wasted the space it had. The group name moved
 * into the rail, which is where the rest of the navigation already is.
 *
 * Below md it is unchanged and still carries everything.
 */
function TopNav() {
  const { profile } = useAuth()
  const { activeId, group } = useGroup()
  const { t } = useT()
  const { pathname } = useLocation()
  return (
    <header className="sticky top-0 z-40 px-4 pt-4 md:hidden">
      <nav className="lg lg-chrome mx-auto w-full max-w-content">
        {/* One padded box for both halves. The row used to carry the padding
            itself, which left the panel below it no way to line up with the
            logo without repeating the same numbers. */}
        <div className="px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <Link to="/" aria-label={t('nav.home')} className="press shrink-0">
              <LockupInline size={36} />
            </Link>

            {/* Inside a group the bar says which one, and the name is the way
                back out. Without it every group looks identical from the
                chrome down. */}
            {activeId && group && (
              <>
                <span aria-hidden="true" className="shrink-0 text-muted/40">
                  /
                </span>
                <span className="truncate text-small font-semibold tracking-tight text-ink">
                  {group.name}
                </span>
              </>
            )}

            {/**
             * THE AVATAR IS A LINK NOW, NOT A MENU.
             *
             * It used to expand the bar into a panel holding a name, an email,
             * "Profil et reglages" and "Se deconnecter". Four lines and two
             * taps to reach a page that shows the same name and email at the
             * top, plus everything else. The panel was a table of contents for
             * a screen one tap away.
             *
             * So the avatar goes straight there. Signing out moved to
             * /settings, behind the gear on that page, which is one tap
             * further than before and is the correct distance for the control
             * that ends the session.
             */}
            {/* Pushed to the far end together, bell then avatar. The bell is
                the thing with news on it, so it sits where the eye already
                goes on the way to the avatar rather than on the other side of
                the bar where the group name lives. */}
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <NotificationBell />

              <Link
                to="/profile"
                aria-label={t('nav.you')}
                data-hook="to-profile"
                className="press block shrink-0 rounded-pill"
              >
                <Avatar profile={profile} size={32} />
              </Link>
            </div>
          </div>

        </div>
      </nav>
    </header>
  )
}

/**
 * Which tab is current. Shared by both bars, because they are two shapes of
 * the same navigation and the answer must not be worked out twice.
 *
 * Same rule NavLink uses: exact match for an `end` tab, prefix otherwise.
 */
const activeIndex = (tabs, pathname) =>
  tabs.findIndex((tab) =>
    tab.end ? pathname === tab.to : pathname === tab.to || pathname.startsWith(`${tab.to}/`),
  )

/**
 * The same four places, down the side, on anything bigger than a phone.
 *
 * WHY A SECOND BAR RATHER THAN ONE THAT REFLOWS.
 *
 * The bottom bar is built around a horizontal slider measured from the DOM,
 * and the whole reason it reads the live box is that the labels are words of
 * different lengths in two languages. Turning that same element sideways with
 * a media query would mean one measurement serving two axes, and the pill
 * would be briefly the wrong shape on every resize. Two components, one
 * source of truth for which tab is active, and only one of them is ever
 * mounted: `md:hidden` on one and `hidden md:flex` on the other.
 *
 * ICONS, AND WHY THERE IS STILL A WORD UNDER EACH ONE.
 *
 * The rail started out as words alone, because this app had no icon set and
 * four invented glyphs are a bigger job than they look. It was then asked to
 * be thin and icon-led, so the glyphs got drawn: see NavIcons.jsx.
 *
 * The word stayed, at 11px. Icon-only is a hover tooltip for its names, and a
 * tablet has no hover, which is exactly the device this layout is for. That is
 * not a small gap: without the word, a first-time user on an iPad has no way
 * at all to find out what the target with a ring round it means, short of
 * pressing it. aria-label carries the name for a screen reader; the 11px line
 * carries it for everybody else. It costs 14px of a 5.5rem column.
 *
 * THE WIDTH IS SET BY FRENCH, AS USUAL. "Calendrier" and "Objectifs" are the
 * long ones. 5.5rem leaves 72px of text box, measured, with truncate as a
 * backstop rather than as the plan.
 *
 * ON THE LEFT, WHICH IS WHERE THE REFERENCE PUTS IT. Flipping it is one
 * class: `left-4` becomes `right-4` and the content padding swaps side.
 *
 * IT IS TRANSPARENT, AND THAT COST A SECOND ELEMENT.
 *
 * Measured before any of this was written: the rail's interior painted
 * #FFFEFF and the page beside it #FFFFFF. One channel apart. A white sheet on
 * a white page is not glass however low its alpha goes, and lowering the alpha
 * over a flat ground makes it less visible rather than more like a lens. That
 * is the trap CLAUDE.md names: backdrop-filter blurs what is behind an
 * element, and over one flat colour it returns that same flat colour.
 *
 * So the wash below comes first and the sheet second. It is the only thing in
 * the app allowed to put colour on the page ground, and it is confined to the
 * column the rail already reserves, where at md and up there is nothing else.
 */

/* One row, so the nav links, the bell and the avatar are the same object.
   Three call sites drifting apart is how a rail ends up with three different
   hover states. */
const RAIL_ROW =
  'press flex w-full flex-col items-center gap-1 rounded-inner px-1 py-2 transition-colors duration-200 ease-settle'

function RailLabel({ children }) {
  return (
    <span className="w-full truncate text-center text-[0.6875rem] font-semibold leading-tight">
      {children}
    </span>
  )
}

function SideRail({ tabs }) {
  const { t } = useT()
  const { profile } = useAuth()
  const { activeId, group } = useGroup()
  const { pathname } = useLocation()
  const rows = [...tabs, CALENDAR]
  const activeIdx = activeIndex(rows, pathname)

  return (
    <>
      {/**
       * Painted before the nav, which is what makes it the nav's backdrop.
       * Inside the nav it would be a child, painted after, and the sheet would
       * be blurring the page again rather than this.
       *
       * md:block, matched to the rail. On a phone the ground stays flat.
       */}
      <div
        className="rail-ground pointer-events-none fixed inset-y-0 left-0 z-0 hidden w-[12rem] md:block"
        data-hook="rail-ground"
        aria-hidden="true"
      />

      <nav
        className="lg lg-rail fixed bottom-4 left-4 top-4 z-30 hidden w-[5.5rem] flex-col p-1.5 md:flex"
        data-hook="side-rail"
        aria-label={t('nav.primary')}
      >
        <Link
          to="/"
          aria-label={t('nav.home')}
          className="press mb-1 block shrink-0 self-center rounded-inner p-1.5"
        >
          <LockupInline size={34} />
        </Link>

        {/**
         * Which group you are in, now that the top bar is not saying it above
         * md. An initial rather than the name: 72px of text box holds about
         * eleven characters and group names are not written to that limit.
         * The full name is the accessible name and the tooltip, and the board
         * it links to opens with the name as its heading.
         */}
        {activeId && group?.name && (
          <Link
            to={`/g/${activeId}`}
            aria-label={group.name}
            title={group.name}
            data-hook="rail-group"
            className="press mb-1 flex h-8 w-8 shrink-0 items-center justify-center self-center rounded-pill bg-accent/[0.16] text-small font-bold text-ink"
          >
            {[...group.name.trim()][0]?.toUpperCase() ?? '?'}
          </Link>
        )}

        {/* Scrolls rather than squashing. Five rows plus a group chip is
            comfortable at 700px; a short laptop window in landscape is not,
            and rows silently losing height is worse than a scrollbar nobody
            usually sees. */}
        <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
          {rows.map((tab, i) => {
            const Icon = NAV_ICON[tab.icon]
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                data-active={i === activeIdx}
                className={({ isActive }) =>
                  /* The active row is a filled pill rather than a travelling
                     one. The slider exists because a horizontal bar has to show
                     that four things are alternatives sharing one strip; a
                     vertical list already reads as a list, and a pill sliding
                     down it would be motion carrying no information.

                     lg-pill rather than a flat accent tint, which is what it
                     was. It is the same mark the bottom bar puts on the same
                     places, so the two navigations say "you are here" in one
                     language rather than two, and on a transparent rail a
                     brighter piece of the same glass is the thing that reads as
                     selected. The tint would have gone muddy over the wash.

                     Weight is the second signal, per 1.4.1: the active label is
                     ink at full strength and the rest are dimmed, so the
                     current place is not carried by the pill's colour alone. */
                  `${RAIL_ROW} ${
                    isActive ? 'lg-pill text-ink' : 'text-ink/70 hover:bg-ink/[0.06] hover:text-ink'
                  }`
                }
              >
                {Icon && <Icon className="h-5 w-5 shrink-0" />}
                <RailLabel>{t(tab.key)}</RailLabel>
              </NavLink>
            )
          })}
        </div>

        {/**
         * You, at the bottom, which is where every rail of this shape puts it.
         *
         * The bell and the avatar came out of the top bar to get here. Both
         * were already the way in to their thing, so this is a move rather than
         * a new control: TopNav's note records that the avatar became the link
         * to the profile when the dropdown was deleted, and it still is.
         */}
        <div className="mt-1 flex shrink-0 flex-col gap-0.5 border-t border-hairline/60 pt-1">
          <NotificationBell placement="rail" />

          <NavLink
            to="/profile"
            data-hook="to-profile"
            className={({ isActive }) =>
              `${RAIL_ROW} ${
                isActive ? 'lg-pill text-ink' : 'text-ink/70 hover:bg-ink/[0.06] hover:text-ink'
              }`
            }
          >
            <Avatar profile={profile} size={20} />
            <RailLabel>{t('nav.you')}</RailLabel>
          </NavLink>
        </div>
      </nav>
    </>
  )
}

function TabBar({ tabs }) {
  const { t } = useT()
  const { pathname } = useLocation()

  const activeIdx = activeIndex(tabs, pathname)
  const { ref, box } = useSlider(tabs[activeIdx]?.to ?? null)

  return (
    <nav
      className="lg lg-chrome fixed inset-x-4 bottom-4 z-30 mx-auto max-w-content md:hidden"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/**
       * gap-0.5 rather than gap-1, and the tabs size to their labels.
       *
       * WHY THIS CHANGED, AND WHY IT STAYED AFTER THE JOURNAL LEFT.
       *
       * Every tab was flex-1, so all of them took the same width whatever
       * their label. That is fine at four and broke at five, which is what the
       * bar was while it carried the journal: measured in a browser, French
       * "Objectifs" wants 70px and an equal fifth of a 390px phone gives it 66,
       * so the tab people press most read "Objectif…" while "Budget" sat in
       * 66px it did not need. Equal columns are only fair when the words are
       * the same length, and they still are not at four.
       *
       * flex-auto shares the leftover space out from each label's own width
       * instead, so "Objectifs" keeps the room it needs and "Budget" gives up
       * the room it does not. Under real pressure they shrink in proportion
       * rather than all at once, which is the correct way round: the longest
       * word should be the last to lose a letter, not the first.
       */}
      <div ref={ref} className="relative flex gap-0.5 p-1.5">
        {/* The active tab used to be a second sheet stuck to whichever link
            was current. It is one sheet now, and it travels. Slider measures
            the live box, so a pill that is now a different width per tab
            follows without anything else changing. */}
        <Slider box={box} className="lg-pill" />

        {tabs.map((tab, i) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            data-active={i === activeIdx}
            // Inactive labels are dimmed ink rather than the muted token:
            // muted over glass drops to 2.5:1 when the accent button passes
            // underneath. ink/70 holds above 4.5:1 in the worst case.
            className={({ isActive }) =>
              /* 13px rather than the 14px of text-small, with the line height
                 kept so the bar does not change height. The last four pixels
                 had to come from somewhere and the type is where they cost
                 least: a tab label is a signpost read at a glance, not copy,
                 and 13px is still above what iOS and Android set theirs at.
                 Written as an arbitrary size rather than text-label because
                 that token carries +0.02em tracking for uppercase, which would
                 have given back most of what the smaller size just bought. */
              `press relative z-10 flex-auto truncate rounded-pill px-1 py-3 text-center text-[0.8125rem] leading-[1.58] transition-colors duration-200 ease-settle ${
                isActive ? 'text-ink' : 'text-ink/70'
              }`
            }
          >
            {t(tab.key)}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export default function AppShell() {
  const { activeId } = useGroup()
  const { pathname } = useLocation()

  useAutoFlush()

  // The reader is full-bleed by design and brings its own chrome.
  const bare = /^\/library\/[^/]+$/.test(pathname)
  if (bare) return <Outlet />

  return (
    /* The same coloured ground as the public site. A dashboard of white rows
       on white is a filing cabinet; the theme carries the page and the
       content sits on it in glass. */
    <div className="ground relative min-h-dvh">
      {/* Sparser than the public set, this is a tool, not a poster. */}
      <Stickers set="app" />

      <SideRail tabs={activeId ? IN_GROUP(activeId) : MINE} />

      {/**
       * Everything to the right of the rail.
       *
       * 5.5rem for the rail plus the 1rem it is inset by on each side. It was
       * 15rem when the rail carried words; narrowing it hands 7.5rem back to
       * the page, which is most of what "the UI is constrained inside a small
       * central container" was asking for.
       *
       * Padding on a wrapper rather than a margin on each page, so a page that
       * has never heard of the rail is positioned correctly anyway, and so the
       * pages keep centring their own width inside whatever room is left.
       *
       * Below md the padding is zero and the bottom bar is the navigation, so
       * the phone layout is untouched.
       */}
      <div className="md:pl-[7.5rem]">
        <TopNav />
        <div className="relative z-10">
          {/* The chrome above and below stays put; only the page moves. */}
          <PageTransition>
            <Outlet />
          </PageTransition>
        </div>
      </div>

      <TabBar tabs={activeId ? IN_GROUP(activeId) : MINE} />
    </div>
  )
}
