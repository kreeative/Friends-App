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
 * The calendar, which is in BOTH navigations now.
 *
 * It is personal rather than contextual, so it belongs in both lists and is
 * appended to whichever one is showing rather than being written into each.
 *
 * IT USED TO BE MISSING FROM THE PHONE, AND THE REASON WAS OUT OF DATE.
 *
 * The note here said a fifth tab truncates: French "Objectifs" wants 70px and
 * an equal fifth of a 390px phone gives it 66, so the tab people press most
 * read "Objectif...". That measurement was taken when every tab was flex-1.
 * They have been flex-auto since, which shares the leftover space out from
 * each label's own width, and the arithmetic is no longer the same one.
 *
 * The fallback was "it is one tap from the dashboard card", which is a
 * reasonable thing to say about a page and a bad thing to say about a
 * destination somebody is looking for in the menu. It was reported as missing,
 * which is what a thing that is not in the menu is.
 *
 * Remeasured in Chromium with the calendar added, and TabBar's own note now
 * carries what came back at 360, 390 and 430.
 */
const CALENDAR = { to: '/calendar', key: 'nav.calendar', icon: 'calendar' }

/**
 * THREE TABS. BRAVO IS GONE AND THIS IS THE SECOND HALF OF ONE MOVE.
 *
 * That tab was the check-in. The check-in moved onto the goals page, where the
 * goals already are, and what was left behind was a destination whose entire
 * content was two buttons and an empty state: "Proof" and "Celebrate", both of
 * which only led somewhere else. A tab that exists to offer two links is a
 * menu with a page around it.
 *
 * So the two jobs went to the page they were always about. Proof is evidence
 * OF a goal, so the gallery sits under the goal cards; a compliment is the
 * thing you think of while looking at how the week went, so it sits under
 * them too. One screen answers "what did I commit to, what did I do about it,
 * and who else did well", which was three screens and is one act.
 *
 * The route stays and redirects. Every link anybody has, and the three places
 * inside the app that pointed at it, now land on the goals page.
 */
const IN_GROUP = (id) => [
  { to: `/g/${id}`, key: 'nav.board', end: true, icon: 'board' },
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
 * ICONS ALONE. THE WORDS ARE GONE, ASKED FOR TWICE.
 *
 * This rail was words, then icons with an 11px word under each, and is now the
 * icons on their own. The argument for keeping the word is written here rather
 * than deleted, because it is still true and it is the cost being accepted: an
 * icon-only rail puts its names in a hover tooltip, and a tablet has no hover.
 * A first-time user on an iPad has no way to learn what the target with a ring
 * round it means except by pressing it.
 *
 * WHAT IS DONE ABOUT THAT, SINCE "NOTHING" WAS NOT AN OPTION.
 *
 * Every item carries `aria-label`, so a screen reader announces the name it
 * always did and nothing is lost there. Every item also carries `title`, which
 * is the browser's own tooltip: it costs nothing, it works with a mouse and a
 * trackpad, and on the platforms that support it a long press surfaces it on
 * touch too. It is a weaker affordance than a printed word and it is the
 * strongest one available without one.
 *
 * The active item is still marked by the lg-pill and by full-strength ink
 * rather than by colour alone, so 1.4.1 holds with no text on screen at all.
 *
 * THE WIDTH CAME DOWN WITH THE WORDS. 3.5rem is 56px, which leaves exactly
 * 44px of tap target inside the 6px of padding: the smallest square a thumb
 * should be asked to hit, and the number the rest of this app already uses.
 * Content gains the 2rem the labels were taking.
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
   hover states.

   h-11 rather than padding: with the label gone the row has nothing to give it
   height, and an icon in a box that shrinks to fit is a 20px tap target. 44px
   is the floor everything else in this app uses. */
const RAIL_ROW =
  'press flex h-11 w-full items-center justify-center rounded-inner transition-colors duration-200 ease-settle'

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
        className="rail-ground pointer-events-none fixed inset-y-0 left-0 z-0 hidden w-[10rem] md:block"
        data-hook="rail-ground"
        aria-hidden="true"
      />

      <nav
        className="lg lg-rail fixed bottom-4 left-4 top-4 z-30 hidden w-[3.5rem] flex-col p-1.5 md:flex"
        data-hook="side-rail"
        aria-label={t('nav.primary')}
      >
        {/**
         * The lockup, and the gap under it, which is now a real gap.
         *
         * mb-1 put 4px between the mark and the first destination, so the logo
         * read as the top item of the list rather than as the thing the list
         * belongs to. It is the one element in the rail that is not a place you
         * can go, and nothing said so.
         *
         * A hairline under it, and then a lot of air. The rule carries the
         * boundary without spending height; the gap is what "laisse le logo
         * seul en haut" asks for, and it has been asked for twice.
         *
         * 4px, then 24, now 40. The first two were arithmetic about the
         * smallest gap that would read as a separation, which was answering a
         * different question: the ask is not "separate these" but "leave the
         * mark alone up there", and alone means the next thing is far enough
         * down that the eye does not group them. 40px is roughly one row
         * height, so the space where an item would be is visibly empty.
         *
         * The height budget is what bounds this and it is not close. Five rows
         * at h-11 plus a group chip, at gap-3, is 320px; the logo block and
         * this gap are 88; the bell and the avatar at the bottom are 128. That
         * is 536 inside a rail that is the window height less 32, so the
         * scroller does not appear until about 570px of viewport, which is
         * shorter than any tablet this layout is for.
         *
         * The tile is 32 rather than 28. It is alone up there now, so it is
         * the one thing in the rail that is looked at rather than scanned, and
         * the artwork has internal margin of its own since brand-icons.py
         * started insetting the lettering: at 28 the words had gone soft.
         */}
        <Link
          to="/"
          aria-label={t('nav.home')}
          className="press block shrink-0 self-center rounded-inner p-1"
        >
          <LockupInline size={32} />
        </Link>
        <span aria-hidden="true" className="mx-1 mb-10 mt-4 h-px shrink-0 bg-hairline/60" />

        {/**
         * Which group you are in, now that the top bar is not saying it above
         * md. An initial, because the column is 44px wide and always was going
         * to be: the full name is the accessible name and the tooltip, and the
         * board it links to opens with the name as its heading.
         */}
        {activeId && group?.name && (
          <Link
            to={`/g/${activeId}`}
            aria-label={group.name}
            title={group.name}
            data-hook="rail-group"
            className="press mb-4 flex h-8 w-8 shrink-0 items-center justify-center self-center rounded-pill bg-accent/[0.16] text-small font-bold text-ink"
          >
            {[...group.name.trim()][0]?.toUpperCase() ?? '?'}
          </Link>
        )}

        {/* Scrolls rather than squashing. Five rows plus a group chip is
            comfortable at 700px; a short laptop window in landscape is not,
            and rows silently losing height is worse than a scrollbar nobody
            usually sees.

            gap-3 rather than gap-0.5. At 2px the rows were one column of icons
            with no rhythm and the active pill touched its neighbours, so "you
            are here" read as a band rather than as one item. It went to 6, then
            8, and now 12, because it kept being asked to open up and the
            constraint that would have stopped it is nowhere near: see the
            height budget in the note above the lockup.

            The row is h-11 throughout and does not change. The space between
            targets grew; the targets did not shrink, which is the part that
            would have cost something. */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          {rows.map((tab, i) => {
            const Icon = NAV_ICON[tab.icon]
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                data-active={i === activeIdx}
                /* The whole accessible name, since there is no text left inside
                   the link to be one. title is the tooltip; without both, this
                   is an unlabelled link and a puzzle. */
                aria-label={t(tab.key)}
                title={t(tab.key)}
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
        <div className="mt-6 flex shrink-0 flex-col gap-3 border-t border-hairline/60 pt-6">
          <NotificationBell placement="rail" />

          <NavLink
            to="/profile"
            data-hook="to-profile"
            aria-label={t('nav.you')}
            title={t('nav.you')}
            className={({ isActive }) =>
              `${RAIL_ROW} ${
                isActive ? 'lg-pill text-ink' : 'text-ink/70 hover:bg-ink/[0.06] hover:text-ink'
              }`
            }
          >
            {/* 26 rather than 20, since it no longer shares the row with a
                word. A face is the one item here that is recognised rather
                than read, so it is the one that most wants the pixels. */}
            <Avatar profile={profile} size={26} />
          </NavLink>
        </div>
      </nav>
    </>
  )
}

function TabBar({ tabs }) {
  const { t } = useT()
  const { pathname } = useLocation()

  /* Same list as the rail, built the same way, so the two navigations cannot
     disagree about what the destinations are. That they did is what put the
     calendar on the tablet and not on the phone. */
  const rows = [...tabs, CALENDAR]
  const activeIdx = activeIndex(rows, pathname)
  const { ref, box } = useSlider(rows[activeIdx]?.to ?? null)

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

        {rows.map((tab, i) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            data-active={i === activeIdx}
            // Inactive labels are dimmed ink rather than the muted token:
            // muted over glass drops to 2.5:1 when the accent button passes
            // underneath. ink/70 holds above 4.5:1 in the worst case.
            className={({ isActive }) =>
              /**
               * AN ICON OVER AN 11PX WORD, WHICH IS WHAT THE FIFTH TAB COST.
               *
               * Measured, five 13px labels in one row: at 390px and 430px
               * nothing clips, at 360px three of the five do (Objectifs,
               * Budget, Calendrier) and at 320px all five do. 360 is a Galaxy
               * S-series width, so "it fits on the phones I checked" was not
               * good enough.
               *
               * Two pixels of type buys the room back and the icon replaces
               * what those two pixels were doing. Below about 12px a word is
               * being recognised by shape rather than read, which is the same
               * job the icon does and does better, so the pairing is not two
               * ways of saying one thing: the glyph is the signpost and the
               * word is what confirms it, which is the arrangement every
               * platform bottom bar has converged on.
               *
               * Same icon set as the rail. The two navigations are the same
               * five places, and a person who learns the calendar glyph on an
               * iPad should not have to learn a different one on their phone.
               *
               * The bar gets taller: 45px to about 56. That is the standard
               * height for this control on both platforms and it is under the
               * bottom inset, which is padding the phone was giving away.
               */
              `press relative z-10 flex-auto rounded-pill px-1 py-2 text-center transition-colors duration-200 ease-settle ${
                isActive ? 'text-ink' : 'text-ink/70'
              }`
            }
          >
            {(() => {
              const Icon = NAV_ICON[tab.icon]
              return Icon ? <Icon className="mx-auto h-5 w-5 shrink-0" /> : null
            })()}
            {/* leading-[1.4] so the block has a predictable height whatever the
                word, and truncate so a locale with a longer one degrades to an
                ellipsis rather than pushing the bar sideways. */}
            <span className="mt-0.5 block truncate text-[0.6875rem] leading-[1.4]">{t(tab.key)}</span>
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
       * 3.5rem for the rail plus the 1rem it is inset by on each side. It was
       * 15rem when the rail carried full words and 7.5rem when it carried
       * small ones; icons alone hand another 2rem back to the page.
       *
       * Padding on a wrapper rather than a margin on each page, so a page that
       * has never heard of the rail is positioned correctly anyway, and so the
       * pages keep centring their own width inside whatever room is left.
       *
       * Below md the padding is zero and the bottom bar is the navigation, so
       * the phone layout is untouched.
       */}
      <div className="md:pl-[5.5rem]">
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
