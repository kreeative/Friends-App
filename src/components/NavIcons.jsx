/**
 * The rail's icons. Ten of them, drawn here rather than installed.
 *
 * WHY NOT AN ICON LIBRARY, AND WHY NOT EMOJI.
 *
 * A library is 300 glyphs to ship ten, in somebody else's drawing style, and
 * this app has exactly one place that needs icons. Emoji were the other option
 * offered and they lose on three counts that matter here: they render as a
 * different picture on every operating system, they cannot take the theme's
 * colour because they carry their own, and at 20px the detailed ones turn to
 * mud. The rail's whole job is to be legible at 20px.
 *
 * THE HOUSE STYLE, WHICH IS ALREADY SET.
 *
 * NotificationBell drew a bell before any of this existed: 24 viewBox, no
 * fill, currentColor stroke at 1.7, round caps and joins. Everything here
 * matches it exactly, because the bell is one of the ten and an icon set with
 * one member drawn differently reads as a mistake rather than as a set.
 *
 * currentColor is the load-bearing part. The rail's active row is ink and its
 * inactive rows are ink at 70%, and both themes have a different ink. One
 * attribute means these are correct in sun, in sea, active, inactive and on
 * hover, with nothing here knowing that any of those exist.
 *
 * NOTHING HERE IS A LABEL. Every icon is aria-hidden and the accessible name
 * comes from the link that holds it. An icon-only rail with no names is a
 * puzzle for a screen reader, and it is the specific risk of the shape that
 * was asked for.
 */

/** Shared attributes, so a drawing cannot quietly diverge from the set. */
const S = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
}

/* A roof and a door. The door is what stops it reading as a generic pentagon
   at 20px, which the first version did. */
export const IconHome = (p) => (
  <svg {...S} {...p}>
    <path d="M3.6 10.4 12 3.8l8.4 6.6" />
    <path d="M5.6 9.2V19a1 1 0 001 1h10.8a1 1 0 001-1V9.2" />
    <path d="M9.8 20v-5.4h4.4V20" />
  </svg>
)

/* A target, not a flag. A flag is a bookmark in most other icon sets and this
   rail also has a book in it; two glyphs that both mean "saved" is worse than
   a target that means "the thing you are aiming at". */
export const IconGoals = (p) => (
  <svg {...S} {...p}>
    <circle cx="12" cy="12" r="8.2" />
    <circle cx="12" cy="12" r="4.4" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
  </svg>
)

/* A wallet with a clasp. A banknote was the alternative and it is a currency
   symbol at this size, which is wrong for an app used in two countries. */
export const IconBudget = (p) => (
  <svg {...S} {...p}>
    <path d="M4 8.4A2.4 2.4 0 016.4 6h10.2A1.4 1.4 0 0118 7.4v1" />
    <path d="M4 8.4v8.2A2.4 2.4 0 006.4 19h11.2a2.4 2.4 0 002.4-2.4v-6.2a1 1 0 00-1-1H6.4" />
    <circle cx="16.2" cy="13.5" r="1.15" fill="currentColor" stroke="none" />
  </svg>
)

/* An open book. The spine down the middle is what separates it from a folded
   card; without it this was unreadable next to the wallet. */
export const IconLibrary = (p) => (
  <svg {...S} {...p}>
    <path d="M12 6.6C10.4 5.5 8.3 5 5.6 5A1.6 1.6 0 004 6.6v9.6a1.6 1.6 0 001.6 1.6c2.7 0 4.8.5 6.4 1.6" />
    <path d="M12 6.6C13.6 5.5 15.7 5 18.4 5A1.6 1.6 0 0120 6.6v9.6a1.6 1.6 0 01-1.6 1.6c-2.7 0-4.8.5-6.4 1.6" />
    <path d="M12 6.6v13.2" />
  </svg>
)

/* A month grid, with the binding rings. The two dots are the day marks that
   make it a calendar rather than a window. */
export const IconCalendar = (p) => (
  <svg {...S} {...p}>
    <rect x="3.6" y="5.4" width="16.8" height="14.4" rx="2.4" />
    <path d="M3.6 10.2h16.8M8.4 3.6v3.4M15.6 3.6v3.4" />
    <circle cx="8.6" cy="14" r="1.05" fill="currentColor" stroke="none" />
    <circle cx="12" cy="14" r="1.05" fill="currentColor" stroke="none" />
  </svg>
)

/* The bell, copied from NotificationBell rather than redrawn, so the rail and
   the panel's own trigger are the same object seen twice. */
export const IconBell = (p) => (
  <svg {...S} {...p}>
    <path d="M6 9a6 6 0 1112 0c0 3.6.9 5.4 1.8 6.3.4.4.1 1.2-.5 1.2H4.7c-.6 0-.9-.8-.5-1.2C5.1 14.4 6 12.6 6 9z" />
    <path d="M9.5 19a2.5 2.5 0 005 0" />
  </svg>
)

/* There is no person glyph here on purpose. The account's icon is the
   account's own face: TopNav's note records that the avatar became the way in
   to the profile when the dropdown was deleted, and drawing a generic head
   next to it would be the second way in. Avatar already handles somebody with
   no photo, so nothing here has to. */

/* The group's board: panels, not a bulleted list, because the board is a
   layout of cards and the list glyph already means something else here. */
export const IconBoard = (p) => (
  <svg {...S} {...p}>
    <rect x="3.8" y="4.6" width="6.6" height="6.6" rx="1.6" />
    <rect x="13.6" y="4.6" width="6.6" height="6.6" rx="1.6" />
    <rect x="3.8" y="12.8" width="6.6" height="6.6" rx="1.6" />
    <rect x="13.6" y="12.8" width="6.6" height="6.6" rx="1.6" />
  </svg>
)

/* Checking in. A tick inside a ring rather than a bare tick, which reads as
   "done" and belongs to a completed goal instead. */
export const IconCheckin = (p) => (
  <svg {...S} {...p}>
    <circle cx="12" cy="12" r="8.2" />
    <path d="M8.4 12.3l2.5 2.5 4.7-5" />
  </svg>
)

/* Two people, for the group itself. */
export const IconGroup = (p) => (
  <svg {...S} {...p}>
    <circle cx="9.4" cy="8.6" r="3.2" />
    <path d="M3.6 19a5.8 5.8 0 0111.6 0" />
    <path d="M16.2 6.1a3.2 3.2 0 010 5.9" />
    <path d="M17.4 14.2A5.8 5.8 0 0120.4 19" />
  </svg>
)

/**
 * Name to drawing, so the nav tables stay data and never import ten symbols.
 * A missing key renders nothing rather than throwing, because a rail that
 * loses one icon is a smaller failure than a rail that does not render.
 */
export const NAV_ICON = {
  home: IconHome,
  goals: IconGoals,
  budget: IconBudget,
  library: IconLibrary,
  calendar: IconCalendar,
  bell: IconBell,
  board: IconBoard,
  checkin: IconCheckin,
  group: IconGroup,
}
