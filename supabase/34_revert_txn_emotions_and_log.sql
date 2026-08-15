-- ============================================================================
-- Undoing 33: the emotion tags and the transaction audit log come back out.
--
-- Run after 33. Safe to re-run. Safe to run even if 33 was never run.
--
-- The budget module goes back to what it was: an amount, a direction, a
-- category, a note, a date, and whether it counts. That is what budget_entry
-- has held since migration 19 and it is what the screen shows again.
--
-- WHY 33 IS STILL IN THIS FOLDER.
--
-- Because it may already have run against the live database, and these files
-- are a ledger of what was done rather than a description of what is wanted.
-- Deleting 33 would leave a database carrying a column and a table that
-- nothing in the repository explains, which is a worse thing to hand the next
-- person than two files that tell the whole story.
--
-- THIS IS DESTRUCTIVE, AND ONE PART OF IT IS MORE DESTRUCTIVE THAN THE OTHER.
--
-- Section 1 is pure cleanup and loses nothing anybody typed: the trigger is
-- the only reason budget_entry_log grows, and with the drawer gone it would
-- otherwise keep writing a row on every save forever for a feature nobody can
-- see. Section 2 drops data. If there is any chance of wanting the tagging
-- back, run section 1 alone: an unused column costs nothing and keeps the
-- answers people already gave.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The audit trail. The trigger first, then what it wrote.
--
-- Order matters here. Dropping the table while the trigger still exists leaves
-- a trigger whose insert target is gone, and the next write to budget_entry
-- fails with a missing-relation error on a table nobody has heard of. The
-- trigger goes first, so at no point is there a window where saving a
-- transaction is broken.
-- ---------------------------------------------------------------------------
drop trigger if exists budget_entry_log_trg on budget_entry;
drop function if exists log_budget_entry();
drop table if exists budget_entry_log;

-- ---------------------------------------------------------------------------
-- 2. The tags.
--
-- The constraint before the column, for the same reason as above: a constraint
-- naming a column that no longer exists is not a state Postgres will leave you
-- in, but dropping them in this order means neither statement depends on the
-- other having succeeded, so a partial run is re-runnable.
--
-- Comment these two lines out to keep what people have already tagged.
-- ---------------------------------------------------------------------------
alter table budget_entry drop constraint if exists budget_entry_emotions_check;
alter table budget_entry drop column if exists emotions;

notify pgrst, 'reload schema';

-- Check (both should return no rows):
--   select column_name from information_schema.columns
--    where table_name = 'budget_entry' and column_name = 'emotions';
--   select tablename from pg_tables where tablename = 'budget_entry_log';
