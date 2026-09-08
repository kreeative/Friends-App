# Rich & Friends, marketing content

Everything below is read from the codebase, not written for this document. Where
a source contradicts the shipped app, that is said out loud rather than smoothed
over.

Companion files in this repo: `app-store-features.json` (five App Store slides),
`claude-design-brief.json` (the same slides plus the brand tokens),
`content.json` (all course text).

---

## 1. Core mission

**In one line:** Change your life. Build your financial freedom.

**The paragraph under it, from the landing hero** (`src/content/landing.js`):

> Freedom is not a matter of luck, it is a matter of discipline. Rich & Friends
> walks you through it step by step: master your money, build your habits, reach
> what you are aiming for.

**In plain terms, three parts**, also from the landing page:

1. *A small group of friends, and what each of you commits to.* You write down
   what you are going to do and how often. Your friends see it. They write theirs
   too.
2. *One check-in a day, in about a minute.* You tick off what you did, with proof
   if your goal asks for it. Nobody sees anyone else's answers until the day is
   over.
3. *A personal budget nobody can see.* How much you can spend today without
   breaking your month. No one in your group can read it, and that is not a
   setting: it is written into the database.

**What the product is arguing against**, and this is the sharpest marketing
angle available: accountability apps die for known reasons, and each one has a
countermeasure in the product.

| The usual failure | What this app does instead |
| --- | --- |
| Vague goals | A goal needs a trigger and a proof to be verifiable |
| No response to silence | Someone is asked to check on you when you go quiet |
| No ritual | One check-in a day, at the same time, for everybody |
| Punitive streaks | A rate, never a streak. Away is not a miss |
| Guilt-shaped UI | No red bars, no shouting at a number you can already read |

**A note on the README.** `README.md` is the oldest description in the repo and
it is now wrong in three places: it says *2 to 6 people* and *one shared weekly
check-in* (the check-in is daily), and it says the app deploys to *Netlify*
(it is Vercel). Do not quote it in marketing copy. The landing page content in
`src/content/landing.js` is current and is what the site actually serves.

---

## 2. Colour palette

Two full themes ship, plus a third palette for the public marketing pages. All
tokens live in `src/index.css` as `--c-<name>`, stored as RGB triplets;
`tailwind.config.js` turns each into `var(--c-<name>)`. **Use the sun theme for
marketing assets: it is the default.**

### Sun, the default theme

| Token | Hex | Role and the rule attached to it |
| --- | --- | --- |
| `--c-accent` | `#FF007A` | **THE pink.** The brand hue. 3.80:1 with white |
| `--c-accent-pressed` | `#D6006B` | Pressed state only. See the warning below |
| `--c-on-accent` | `#FFFFFF` | White on the pink. **Large text only, 24px and up** |
| `--c-loud` | `#DE3578` | 4.30:1. The pink when white-on-pink will not do |
| `--c-ink` | `#1E181B` | Body and headings. 16.7:1 on white |
| `--c-muted` | `#5E5057` | Secondary text. Still clears 4.5:1 |
| `--c-bg` | `#FFF5F7` | Blush. The page ground, and the manifest theme colour |
| `--c-surface` | `#FFFFFF` | Cards |
| `--c-raised` | `#FFECEF` | Warm rose. The soft well inside a card |
| `--c-hairline` | `#F0E2E7` | Rules and card edges |
| `--c-field` | `#FFD60A` | Golden yellow. Ink on it is `#111111` |
| `--c-field-deep` | `#D6B000` | The yellow where a fill needs to be darker |
| `--c-green` | `#0F6932` | Done |
| `--c-negative` | `#BE1E2D` | Destructive only |
| `--c-mark` | `#FF007A` | First place, and nothing else |
| `--c-spark` | `#F8CB02` | Confetti and celebration |

**Category ramp** (calendar layers, envelopes), pink into yellow:

`#FF007A` · `#FF2D6B` · `#FF5C4D` · `#FF8A2B` · `#FFB014` · `#FFD600`

Each has a `-soft` partner at about 92% lightness for the unspent or empty part
of a gauge: `#FFE0EC` · `#FFE2E8` · `#FFE5E2` · `#FFEADB` · `#FFF1D6` ·
`#FFF7D1`.

### Two warnings that have already cost something here

1. **Do not darken the pink to pass a contrast check.** `#D6006B` is a wine pink
   and it once crept into the interface through exactly that reasoning. It was
   removed on sight, with the instruction: *the pop pink, and never that pink
   again.* It stays in the tokens as a pressed state and belongs nowhere else.
2. **White on the pink is 3.80:1.** That clears the 3:1 that large text needs and
   fails the 4.5:1 that normal text needs. So white on pink is allowed at 24px,
   or at 18.66px bold, and nowhere smaller. Everything below that size sits in a
   white pill with ink on it.

### Sea, the alternate theme

Same structure, blue: accent `#0B6FAD`, ink `#161C1E`, muted `#4E5A5E`, ground
`#F0F9FF`, mark `#08507D`. Logo variants exist in `public/brand/` as
`mark-blue.png` and `wordmark-blue.png`.

### Public surface, for the marketing site

`[data-surface='public']` in `src/index.css`. Neutral greys instead of blush, so
the pink CTA carries the whole page: ground `#FAFAFA`, ink `#111111` (18.09:1),
muted `#565656` (7.03:1), hairline `#E4E4E4`. **Same pink, same white.** This is
the palette a landing page or a web banner should use.

### Type and shape

- **One typeface everywhere: Poppins**, falling back to `system-ui`. There is no
  second voice on any screen.
- Poppins is geometric and wide, so display sizes are tracked **in**, not out:
  hero `3.5rem / -0.03em`, h1 `2rem / -0.024em`, h2 `1.375rem / -0.016em`, body
  `1rem / -0.006em`. Uppercase labels go the other way, `0.8125rem / +0.02em`,
  because caps have no descenders to separate them.
- **Layered radii:** card `1.375rem`, inner `0.8125rem`, pill `999px`. The outer
  container is always rounder than what nests inside it. Matching radii read as
  flat.
- Logo: `public/brand/mark-pink.png`, `public/brand/wordmark-pink.png`.

---

## 3. Feature list

Phone navigation is five tabs (`src/components/AppShell.jsx`): **Home, Board,
Goals, Budget, Library**, plus **Calendar**. Above md the same destinations sit
in a vertical icon rail.

### Accountability, the core

- **Goals with a trigger and a proof.** A goal is not "get fit": it names when
  and where, and what evidence closes it. Proof is a photo, a link, a note, or
  nothing, chosen per goal (`src/lib/proofKinds.js`).
- **Daily check-in rail.** A row of cards you swipe and answer in place, not a
  form on a separate screen. Answers stay hidden until the day closes.
- **Group goals.** Shared commitments that belong to the group rather than to one
  person. Everyone is notified when one is added, including the author.
- **Proof gallery.** What everybody actually produced, per group.
- **Nudges.** When someone goes quiet, one other person is asked to check on
  them. The person nudged answers in one tap: *I am fine*.
- **Celebrate a friend.** Optional, outside the check-in, for saying something
  out loud when somebody deserves it.
- **Group standing.** A completion rate over a window you choose, not a streak.
  Ties share a place. Anybody with nothing scheduled is unranked rather than
  last.

### Habit trackers

- **Water tracker.** A daily target from the EFSA adequate-intake figures,
  adjustable from 1 to 4 litres. Log **in millilitres or in ounces**, from your
  own bottle, with a one-tap button that says the amount and a free field for
  a few sips. The reminder interval is computed from what is left and how much
  day remains, so falling behind tightens the rhythm and a big drink spaces it
  out. Floor of 30 minutes, ceiling of 2 hours.
- **Mood board.** Several feelings per day, not one, recorded and read back in
  the day recap.
- **Streaks and history.** Per goal, with a day-by-day view.
- **Cycle tracking.** Optional and off by default, gated behind a setup answer.
  *Deliberately excluded from marketing assets: it should not read as a headline
  feature for everybody.*

### Money

- **Envelope budget.** Planned against actually spent, per category, with the
  unspent part drawn in the soft partner colour.
- **Projects.** Bigger plans with their own lines, and invitations to share one.
- **Savings pots** and **fixed charges**.
- **History and month-by-month**, with plan against actual.
- **Bank import** through Plaid (`api/plaid`), or type it in by hand.
- **Private by construction.** The row-level security policies are the privacy,
  not a toggle: nobody in your group can read your budget.

### Learning

- **Four courses, 13 modules, 52 lessons.** Budget 101, Rich slowly, Credit card,
  Investing 101, in that order because it is a progression: you cannot invest
  what is left before you know what is left.
- **Inline glossary.** 55 financial terms explained where you meet them in the
  sentence, not in a footnote or a separate page.
- **Regional variants.** Canada, France and Europe, the United States, and the
  franc zone (BRVM / CEMAC). Real account names, no invented ones.
- **Quizzes** at the end of a lesson, with the reasoning after the answer.
- **Three books** with a per-chapter reader and a free first chapter.

### Calendar and time

- **Week strip and month view** on the dashboard, with a dot per day for what was
  logged.
- **Recurring events**, categories with the colour ramp, exceptions.
- **Day recap**, the whole of one day in one panel: mood, goals, money, proof,
  classes.
- **Group cycles run on an instant**, so a check-in window opens at the same
  moment for everyone regardless of time zone, and is displayed in each reader's
  own zone.

### Notifications

- **Web push** through a scheduled Supabase Edge Function, signed with VAPID.
- Reminders for goals, water, calendar events, birthdays, group goals and
  nudges, plus an in-app inbox.
- **Two emails a month, maximum.** Stated on the landing page and kept.

### Cross-cutting

- **Bilingual, French and English**, one content tree so a lesson cannot exist in
  one language and not the other.
- **Two themes**, sun and sea.
- **Installable PWA**, works offline for reading, with a queue for writes.
- **Solo mode** for someone with no group yet.

---

## 4. Screenshot inventory

Every path is real. Capture at **390 x 844 at 2x**, which is the width the app is
designed and swept at, in the **sun** theme, in French unless the asset is for an
English store listing.

### The five that matter most, in priority order

| # | Component | Route | What has to be on screen |
| --- | --- | --- | --- |
| 1 | `src/pages/Goals.jsx` | `/g/:groupId/goals` | The check-in rail with two or three pink cards still to answer, and goal cards under it |
| 2 | `src/pages/Money.jsx` | `/money` | The envelope rings, planned against spent, one envelope close to its limit |
| 3 | `src/pages/Courses.jsx` | `/cours/riche-lentement/0.1` | A lesson open with one term underlined inline and its definition showing |
| 4 | `src/pages/Dashboard.jsx` | `/` | The week strip, and the water card reading a real amount with the bar part full |
| 5 | `src/pages/Board.jsx` | `/g/:groupId` | The standing, one person ahead in pink, the rest in grey |

### Worth capturing next

| Component | Route | Why |
| --- | --- | --- |
| `src/pages/Calendar.jsx` | `/calendar` | The month with coloured category layers |
| `src/pages/Library.jsx` | `/library` | The shelves: courses, books, articles, studies |
| `src/pages/Reader.jsx` | `/library/:slug` | A book chapter, for the reading experience |
| `src/pages/Notifications.jsx` | `/notifications` | A nudge with its one-tap answer |
| `src/pages/Proofs.jsx` | `/g/:groupId/proofs` | What the group actually produced |
| `src/pages/GoalEditor.jsx` | `/goals/new` | How specific a goal has to be |
| `src/pages/Welcome.jsx` | `/` signed out | The onboarding deck |

### Components inside those pages, if a slide wants a detail rather than a screen

| Component | What it is |
| --- | --- |
| `src/components/CheckinRail.jsx` | The swipeable daily question |
| `src/components/WaterToday.jsx` | The water card, in ml or oz |
| `src/components/WeekStrip.jsx` | The calendar card with the day marks |
| `src/components/GroupAnalytics.jsx` | The standing |
| `src/components/Envelopes.jsx` | The budget rings |
| `src/components/GoalCard.jsx` | One goal, with its pills |
| `src/components/DayRecap.jsx` | One whole day, expanded |
| `src/components/MoodBoard.jsx` | The mood picker |
| `src/components/NudgeBanner.jsx` | Someone has gone quiet |
| `src/components/CelebrateStep.jsx` | Say something about a friend |

### How to get clean screenshots

`npm run build && npm run sweep` renders every signed-in route at 390, 820, 1180
and 1440 and writes the images to `.sweep/`. It runs in solo mode with fixture
data, so the group screens (1 and 5 above) are not in it: those need a group
fixture. `scripts/sweep-widths.mjs` is the harness to copy for that.
