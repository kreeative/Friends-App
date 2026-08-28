import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { onPendingChange, startAutoFlush } from '../lib/queue'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { useT } from '../lib/i18n'
import { Avatar } from './ui'
import { LockupInline } from './Wordmark'
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
            <Link
              to="/profile"
              aria-label={t('nav.you')}
              data-hook="to-profile"
              className="press ml-auto block shrink-0 rounded-pill"
            >
              <Avatar profile={profile} size={32} />
            </Link>
          </div>

        </div>
      </nav>
    </header>
  )
}

function TabBar({ tabs }) {
  const { t } = useT()
  const { pathname } = useLocation()

  /* Which tab is current, worked out here rather than read back from
     NavLink's isActive, the slider needs to know before the children render
     so it can be measured in the same layout pass. Same rule NavLink uses:
     exact match for an `end` tab, prefix match otherwise. */
  const activeIdx = tabs.findIndex((tab) =>
    tab.end ? pathname === tab.to : pathname === tab.to || pathname.startsWith(`${tab.to}/`),
  )
  const { ref, box } = useSlider(tabs[activeIdx]?.to ?? null)

  return (
    <nav
      className="lg lg-chrome fixed inset-x-4 bottom-4 z-30 mx-auto max-w-content"
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

      <TopNav />
      <div className="relative z-10">
        {/* The chrome above and below stays put; only the page moves. */}
        <PageTransition>
          <Outlet />
        </PageTransition>
      </div>
      <TabBar tabs={activeId ? IN_GROUP(activeId) : MINE} />
    </div>
  )
}
