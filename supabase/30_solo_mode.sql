-- ============================================================================
-- Using this on your own is a choice, not a failure to finish setting up.
--
-- Run after 29. Safe to re-run.
--
-- Signing up put you on a form asking you to name a group and pick a weekly
-- check-in hour, with no way past it. That is the right first screen for
-- somebody who arrived with three friends and the wrong one for everybody
-- else, and everybody else is most people: the journal, the budget and your
-- own goals all work alone and none of them were reachable until you had
-- invented a group to hold them.
--
-- So the answer is remembered rather than asked again. Without a column the
-- app can only tell "no groups", which is the same state for somebody who
-- chose to be alone and somebody who has not finished signing up, and it would
-- put the same form in front of both of them every morning.
--
-- On the profile rather than in localStorage, so the choice follows the person
-- to a second device instead of being re-asked on their laptop. Same shape and
-- same reasoning as has_seen_budget_intro in migration 20 and
-- has_seen_journal_intro in 27.
--
-- NOT a lock. Joining a group later clears nothing and needs nothing cleared:
-- the app checks for a real membership first and this column only decides what
-- to show somebody who has none. See landing() in src/lib/onboarding.js.
-- ============================================================================
alter table profiles add column if not exists solo_mode boolean not null default false;

notify pgrst, 'reload schema';

-- Check:
--   select id, display_name, solo_mode from profiles order by created_at desc limit 20;
