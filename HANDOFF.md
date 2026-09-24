# Handoff

Written at the end of a long session, for whoever picks this up next.
Current main: everything below is committed and deployed.

## What this is

Rich & Friends (richandfriends.xyz). A small-group accountability app with a
paid book library. Vite + React 18 + react-router v6 + Tailwind + Supabase,
deployed on Vercel. Bilingual, English and French, one flat dictionary in
`src/lib/i18n.jsx`.

## State of play

Migrations are applied against production as they land. Many have been added
since `20_quiet_and_birthdays.sql`; check `supabase/` rather than trusting a
number written here.
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

## Not done

The seven items that used to be listed here were all built in the weeks after
this file was written, and nobody rewrote the list, so it sat here claiming
finished work was outstanding. Checked against the code on 2026-09-24: the
calendar strip shipped as WeekStrip and the Calendar page, the profile popup
was replaced by the avatar linking straight to Account, the birthday field is
in Me.jsx, re-watch intro is in Account.jsx. Do not trust a stale list here;
check the code.

The one thing still genuinely open is the logo. The user has twice called the
mark in the top bar "the old logo". It is public/brand/mark-pink.png, which is
what the code is configured to use, so nothing is stale in the repo. ASK which
they want. Do not guess.

## Known security findings

From the Supabase advisors, checked 2026-09-24. None of these is an active
breach, and two things that would have been serious were verified safe:

- **Paid chapter text is properly protected.** chapters has one policy, for
  authenticated only, requiring is_preview or owns_book. anon has no policy at
  all, so it reads nothing.
- **Bank tokens are locked.** plaid_item and pending_entitlements have RLS on
  with no policies and no anon grant.

Open, in rough order of how much they matter:

- **books has three overlapping SELECT policies**, and permissive policies are
  OR'd, so "Allow public read access on books" with qual true defeats
  books_select's published = true. Harmless today because all three books are
  published. The day a draft is added it is world readable. Drop the redundant
  two and keep the published check.
- **anon can call 31 SECURITY DEFINER functions** over /rest/v1/rpc. Most
  guard themselves by raising when auth.uid() is null, and those are fine.
  The ones that do not are worth a look: tick() runs the whole scheduler for
  anyone who posts to it, and days_silent, is_member_of, shares_group,
  owns_book, proof_group and missed_cycle each answer a question about an
  arbitrary uuid without asking who is calling. Trigger functions are exposed
  too (handle_new_user, sync_profile_email, notify_group_goal,
  notify_book_share), which should simply not be reachable by RPC.
- **chapter_index is a SECURITY DEFINER view** (advisor level ERROR). It
  carries id, book_id, idx, title, is_preview, word_count and no body, so it
  is a table of contents rather than content. Probably intentional, worth
  confirming.
- **Four functions have a mutable search_path**: gen_random_bytes,
  email_check, budget_touch, touch_journal_entry.
- pg_net is installed in the public schema.
- Leaked password protection is off, which is moot while sign-in is OTP and
  Google only.

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
