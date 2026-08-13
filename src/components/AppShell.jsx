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
 * "YOU" IS STILL NOT IN THE BAR, AND THE JOURNAL NOW IS.
 *
 * "You" was the only tab that was a settings screen rather than a place, and
 * it competed for width with the things people actually move between. There is
 * already a way in that says the same thing more directly: your own face, in
 * the top corner of every screen, which opens the account panel with Profile &
 * Settings in it. The /me route is untouched.
 *
 * The journal is the opposite case and that is why it took the width instead.
 * It is a place, it is meant to be opened daily, and it was reachable only
 * through the account list, which is where settings live. Something you are
 * supposed to do every day cannot be two taps down a menu.
 *
 * Five did cost something, and the cost was paid in the label size rather
 * than by dropping a tab: see the measurements in TabBar below.
 */
const MINE = [
  { to: '/', key: 'nav.home', end: true },
  // Your own goals, which no longer require a group to exist in.
  { to: '/goals', key: 'nav.goals' },
  /* Between the doing and the money, because it is the other half of the
     doing. It was reachable only through the account list, which is where
     settings live, and a journal is not a setting: something you are meant to
     open daily cannot be two taps down a menu. */
  { to: '/journal', key: 'nav.journal' },
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
 * Home, who you are, and the way out. Present on every screen.
 *
 * The account menu opens **inside the bar** rather than as a sheet floating
 * under it. The floating version was a second white card laid over the page,
 * with its own rim and its own shadow, hanging off the corner of a bar that
 * already had both. Two stacked sheets for four lines of text reads as a
 * dialog, and on a narrow phone the 240px panel came within a few pixels of
 * the opposite edge of the screen it was supposed to be a corner of.
 *
 * Expanding the bar keeps one sheet on screen. The name, the address and the
 * two things you can do sit inside the border and the padding the bar already
 * has, so nothing new is drawn, the chrome simply gets taller.
 *
 * The animation is the same CSS grid trick MoodToday uses: grid-template-rows
 * from 0fr to 1fr resolves to the content's real height with nothing measured
 * and no dependency. See that file for the longer argument.
 */
function TopNav() {
  const { user, profile, signOut } = useAuth()
  const { activeId, group } = useGroup()
  const { t } = useT()
  const { pathname } = useLocation()
  const [menu, setMenu] = useState(false)

  // A menu that survives navigation is a menu covering the page you asked for.
  useEffect(() => setMenu(false), [pathname])

  useEffect(() => {
    if (!menu) return
    const onKey = (e) => e.key === 'Escape' && setMenu(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menu])

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

            <button
              onClick={() => setMenu((v) => !v)}
              aria-expanded={menu}
              aria-controls="account-panel"
              aria-label={t('nav.you')}
              className="press ml-auto block shrink-0 rounded-pill"
            >
              <Avatar profile={profile} size={32} />
            </button>
          </div>

          <div
            id="account-panel"
            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-settle motion-reduce:transition-none ${
              menu ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
            aria-hidden={!menu}
          >
            {/* The clip is what makes the closed state actually zero-height
                rather than squashed, and it takes the spacing with it, so a
                shut panel adds nothing at all to the bar. */}
            <div className="overflow-hidden">
              {/* inert while collapsed, so a closed panel is not a tab stop */}
              <fieldset disabled={!menu} className="mt-2.5 border-0 border-t border-hairline p-0 pt-2.5">
                <p className="truncate px-3 text-small font-semibold text-ink">
                  {profile?.display_name}
                </p>
                <p className="truncate px-3 text-small text-muted">{user?.email}</p>

                <div className="mt-2">
                  <Link
                    to="/me"
                    tabIndex={menu ? undefined : -1}
                    className="block rounded-inner px-3 py-2.5 text-small text-ink no-underline transition-colors hover:bg-ink/[0.06]"
                  >
                    {t('me.profile_settings')}
                  </Link>
                  <button
                    onClick={signOut}
                    className="block w-full rounded-inner px-3 py-2.5 text-left text-small text-ink transition-colors hover:bg-ink/[0.06]"
                  >
                    {t('me.sign_out')}
                  </button>
                </div>
              </fieldset>
            </div>
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
       * WHY THIS CHANGED WHEN THE JOURNAL ARRIVED.
       *
       * Every tab was flex-1, so all of them took the same width whatever
       * their label. That is fine at four and breaks at five: measured in a
       * browser, French "Objectifs" wants 70px and an equal fifth of a 390px
       * phone gives it 66, so the tab people press most read "Objectif…" while
       * "Budget" sat in 66px it did not need. Equal columns are only fair when
       * the words are the same length.
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
