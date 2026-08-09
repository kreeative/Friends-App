# Handoff

Written at the end of a long session, for whoever picks this up next.
Current main: everything below is committed and deployed.

## What this is

Rich & Friends (richandfriends.xyz). A small-group accountability app with a
paid book library. Vite + React 18 + react-router v6 + Tailwind + Supabase,
deployed on Vercel. Bilingual, English and French, one flat dictionary in
`src/lib/i18n.jsx`.

## State of play

All Supabase migrations through `20_quiet_and_birthdays.sql` have been run
against production. There is nothing outstanding to paste into the SQL editor.
`supabase/RUN_ON_SUPABASE.sql` and its comment-stripped twin are the combined
scripts that were used, kept for reference.

Auth email is live: Resend over SMTP, sending from hello@richandfriends.xyz,
six-digit code rather than a magic link.

## Done in the last session

- **Sign-in by six-digit code.** `signInWithOtp` then `verifyEmailCode` in
  `src/context/AuthContext.jsx`. The row of boxes in `src/pages/SignIn.jsx` is
  ONE real input drawn under six presentational boxes, not six inputs, so
  paste, iOS autofill and backspace all keep working. It grows to fit up to 10
  digits because Supabase's OTP length is a server setting the client cannot
  read.
- **OTP failure handling.** Supabase's raw "Token has expired or is invalid"
  is suppressed in favour of one message of ours, boxes self-clear, and there
  is a resend with a 30 second cooldown matching Supabase's own per-user
  minimum interval.
- **The nudge flood, fixed.** The old rule counted consecutive missed cycles,
  which meant a fortnight when a cycle was a week and two days once cycles
  became daily. It now counts days of real silence and requires the account
  and the membership to be older than 14 days. See `20_quiet_and_birthdays.sql`.
- **The money feature.** `19_budget.sql`, `src/lib/budget.js` (pure, 37 tests
  under `npm test`), `src/lib/budgetData.js`, `src/pages/Money.jsx`,
  `src/components/BudgetTiles.jsx`, `src/components/BudgetIntro.jsx`,
  `src/components/BudgetToday.jsx`, `src/components/BudgetBanner.jsx`.
- **Budget onboarding carousel**, six slides, scroll-snap, shown once via
  `profiles.has_seen_budget_intro`.
- **Feature banner** at the top of the home feed, dismissible via
  localStorage key `has_dismissed_budget_banner`.
- **Form cleanup.** Fields are filled boxes rather than underlines, hints are
  neutral grey rather than the theme's pink, the plan form is a page rather
  than a Sheet, and the French copy was rewritten.

## Not done, in the order it was asked for

1. **Header profile dropdown**, `src/components/AppShell.jsx`. Remove the
   floating white popup that appears on tapping the avatar, and the redundant
   "You" link inside it since "You" is already in the bottom bar. The header
   bar itself should expand downwards inline. Use the `grid-template-rows:
   0fr -> 1fr` technique already used by `MoodToday`, so no new dependency.
   Show full name, email, "Profile & Settings", "Sign out". Keep it inside the
   header's existing border and padding. Test at 420, 768 and 1024 px.
2. **Flo-style calendar strip** at the top of the personal dashboard.
   Horizontal scrolling week, circular date badges, today in the accent,
   tapping a date shows that day's goals and budget entries.
3. **Group analytics rework.** Replace "check-in rate 0/0" with a goal success
   rate and a consistency leaderboard ranked by consecutive daily check-ins.
   Rename "Check-in" to "Daily Goal Complete" throughout.
4. **Birthdays, front end.** A date of birth field in profile settings, and
   rendering `group_feed` rows of `kind = 'birthday'`. The column and the
   writer function already exist from migration 20; only the UI is missing.
5. **"Re-watch intro"** in settings, setting `has_seen_budget_intro` back to
   false.
6. **Stale copy.** The landing page and the sign-in pitch still say "one
   check-in a week". Cycles are daily now.
7. **The logo.** The user says the mark in the top bar is "the old logo". It
   is `public/brand/mark-pink.png`, which is what the code is configured to
   use, so nothing is stale in the repo. ASK which they want: a different
   existing file, a new image they will supply, or the same mark resized.
   Do not guess.

## Conventions worth keeping

- **No em dashes or en dashes anywhere.** Not in code, comments, copy or
  commit messages. This was an explicit request and it has been swept twice.
- **Verify, do not assume.** UI changes get rendered in headless Chromium at
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` and measured. Several
  real bugs in this session were found that way and would not have been caught
  by reading the code: a `position: fixed` overlay collapsing to 0px because
  an ancestor had a `backdrop-filter`, a CSS reset out-specifying a component
  rule, and currency amounts colliding in a three-column grid.
- **SQL is verified against a real PostgreSQL 16** before being handed over,
  including a re-run to prove idempotence. The database caught two genuine
  bugs this way.
- `npm test` runs `node src/lib/budget.test.mjs`, 37 assertions, no test
  runner dependency. Keep it green.
- English and French strings must stay in parity. A quick counter over
  `i18n.jsx` catches a missing one.
- Money is stored in cents as `bigint`, formatted by `src/lib/money.js`.
- Budget data is private by design: every policy is `user_id = auth.uid()`
  with no group path. That is the feature, not a default to relax.

## Environment notes

- Vercel builds from `main` and needs `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY` at build time. The service role key is stored under
  the name `service_role`.
- The user is working from an iPad. Long files are easier delivered as text in
  chat than as attachments, and Safari caches aggressively, so "I am not
  seeing the change" is usually cache rather than a failed deploy. A Private
  tab is the fastest way to check.
