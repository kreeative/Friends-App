import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { onPendingChange, startAutoFlush } from '../lib/queue'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { useT } from '../lib/i18n'
import { Avatar } from './ui'
import { LockupInline } from './Wordmark'
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
  { to: '/', key: 'nav.home', end: true },
  // Your own goals, which no longer require a group to exist in.
  { to: '/goals', key: 'nav.goals' },
  { to: '/money', key: 'nav.budget' },
  { to: '/library', key: 'nav.library' },
]

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
  { to: `/g/${id}`, key: 'nav.board', end: true },
  /* Its own key rather than the chip's. "Faire le point" is the right words
     on a button and two characters too many in a tab, where it truncated to
     "Faire le p…" at 390px. */
  { to: `/g/${id}/checkin`, key: 'nav.checkin' },
  { to: `/g/${id}/goals`, key: 'nav.goals' },
  { to: `/g/${id}/settings`, key: 'nav.group' },
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
function TopNav() {
  const { profile } = useAuth()
  const { activeId, group } = useGroup()
  const { t } = useT()
  const { pathname } = useLocation()
  return (
    <header className="sticky top-0 z-40 px-4 pt-4">
      {/* Matches the widest page rather than the narrowest. On a laptop the
          calendar is 68rem and a 40rem bar floating above it reads as two
          unrelated things; the bar is chrome and should frame whatever is
          under it. Pages that stay a 40rem column simply centre beneath it,
          which is what the reference layout does too. */}
      <nav className="lg lg-chrome mx-auto w-full max-w-content md:max-w-[68rem]">
        {/* One padded box for both halves. The row used to carry the padding
            itself, which left the panel below it no way to line up with the
            logo without repeating the same numbers. */}
        <div className="px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            {/* Hidden once the rail is showing, which carries the same mark
                at its top. Two lockups on one screen is a logo competing with
                itself. */}
            <Link to="/" aria-label={t('nav.home')} className="press shrink-0 md:hidden">
              <LockupInline size={36} />
            </Link>

            {/* Inside a group the bar says which one, and the name is the way
                back out. Without it every group looks identical from the
                chrome down. */}
            {activeId && group && (
              <>
                {/* The separator only makes sense after something. With the
                    lockup hidden at md+ it would open the bar with a slash. */}
                <span aria-hidden="true" className="shrink-0 text-muted/40 md:hidden">
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
 * WHY LABELS AND NOT ICONS.
 *
 * The reference for this is Wealthsimple's rail, which is icon-only. This app
 * has no icon set for Home, Goals, Budget and Library, and inventing four
 * glyphs that read unambiguously is a larger job than it looks: an icon that
 * has to be learned is worse than a word that does not. So the rail is wide
 * enough for the words, which is also what makes it work in French, where
 * "Objectifs" is the label that has already broken this bar once.
 *
 * ON THE LEFT, WHICH IS WHERE THE REFERENCE PUTS IT. Flipping it is one
 * class: `left-4` becomes `right-4` and the content padding swaps side.
 */
function SideRail({ tabs }) {
  const { t } = useT()
  const { pathname } = useLocation()
  const activeIdx = activeIndex(tabs, pathname)

  return (
    <nav
      className="lg lg-chrome fixed left-4 top-4 bottom-4 z-30 hidden w-[13rem] flex-col p-2 md:flex"
      data-hook="side-rail"
      aria-label={t('nav.home')}
    >
      <Link to="/" aria-label={t('nav.home')} className="press mb-2 block shrink-0 rounded-inner p-2">
        <LockupInline size={34} />
      </Link>

      <div className="flex flex-col gap-0.5">
        {tabs.map((tab, i) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            data-active={i === activeIdx}
            className={({ isActive }) =>
              /* The active row is a filled pill rather than a travelling one.
                 The slider exists because a horizontal bar has to show that
                 four things are alternatives sharing one strip; a vertical
                 list already reads as a list, and a pill sliding down it would
                 be motion carrying no information. */
              `press truncate rounded-pill px-3.5 py-2.5 text-small font-semibold transition-colors duration-200 ease-settle ${
                isActive ? 'bg-accent/[0.14] text-ink' : 'text-ink/70 hover:bg-ink/[0.05] hover:text-ink'
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
       * 13rem for the rail plus the 1rem it is inset by on each side. Padding
       * on a wrapper rather than a margin on each page, so a page that has
       * never heard of the rail is positioned correctly anyway, and so the
       * pages keep centring their own max-w-content inside whatever room is
       * left.
       *
       * Below md the padding is zero and the bottom bar is the navigation, so
       * the phone layout is untouched.
       */}
      <div className="md:pl-[15rem]">
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
