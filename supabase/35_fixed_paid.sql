-- ============================================================================
-- When a fixed charge was actually paid.
--
-- Run after 34. Safe to re-run.
--
-- THE BUG THIS EXISTS TO FIX.
--
-- budget_fixed has held what you owe every month since migration 19, and the
-- money screen has been subtracting all of it from the moment it was typed in.
-- So somebody who set the app up saying "I earn 2000 and my rent is 500" was
-- immediately told they had 1500 available, as though the salary had landed
-- and the rent had gone out, on a day when neither had happened.
--
-- That is the difference between a plan and a bank balance, and the table had
-- no way to express it: a row said what a charge costs and nothing said whether
-- this month's instance of it had been paid.
--
-- WHY A DATE AND NOT A BOOLEAN.
--
-- A boolean would have to be reset at the top of every period, by something.
-- There is no cron in this project's Supabase, the client cannot be trusted to
-- run a migration-shaped job on login, and a flag that is only cleared when
-- somebody happens to open the app is a flag that reads "paid" for a charge
-- three months stale.
--
-- A date needs no resetting. "Paid this period" is `last_paid_on >= the day
-- the period started`, which is arithmetic the client already does for every
-- other number on the screen, and it answers a question a boolean cannot:
-- when. Rolling into a new month makes every charge unpaid again, by itself,
-- because the period start moved and the stored date did not.
--
-- WHY NOT A ROW PER CHARGE PER MONTH.
--
-- That is the fuller model and it buys history: which months the rent was late.
-- Nothing in this app asks that, and it would be a second table, four policies
-- and a join on the one screen whose entire promise is that it stays simple.
-- One column answers the question that is actually being asked.
-- ============================================================================

alter table budget_fixed add column if not exists last_paid_on date;

-- A charge cannot have been paid in the future. The client writes today's date
-- in the person's own calendar, so this is a guard against a bad write rather
-- than something a form can produce.
alter table budget_fixed drop constraint if exists budget_fixed_last_paid_on_check;
alter table budget_fixed add constraint budget_fixed_last_paid_on_check
  check (last_paid_on is null or last_paid_on <= (current_date + 1));

notify pgrst, 'reload schema';

-- Check:
--   select label, amount_cents, active, last_paid_on from budget_fixed;
