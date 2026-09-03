-- ============================================================================
-- Seven categories, and a way to skip one day of a recurring rule.
--
-- Run after 51. Safe to re-run.
--
-- TWO CHANGES, ONE MIGRATION, BECAUSE THEY ARE THE SAME FEATURE.
--
-- The calendar was a timetable with a personal category bolted on the end. The
-- request is that it stop being that: a shift, a party and an appointment are
-- as much "what is on Thursday" as a lecture is. Widening the categories is
-- half of that, and being able to delete one occurrence without losing the
-- term is the other half, because a calendar people actually put their life
-- into is one where a mistake has to be recoverable.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Four more categories.
--
-- The constraint is dropped and rebuilt rather than widened in place, because
-- Postgres has no "alter check constraint". `if exists` on the drop is what
-- makes the whole file re-runnable.
--
-- WHY THESE FOUR AND NOT A FREE-TEXT FIELD.
--
-- A category drives a colour and a filter layer, and both of those are lookup
-- tables in the client. Free text would mean an event whose colour is undefined
-- and whose layer is a guess, which is exactly the failure the note on `colour`
-- below this describes: a value the client cannot render is a value the
-- constraint should never have accepted.
--
-- 'sante' is deliberately a calendar category and has NOTHING to do with
-- cycle_log. It is a dentist at 14:00. The cycle stays in its own tables with
-- its own policies, for the reason 51 gives at length: one events table holding
-- both would put one set of policies over data with two sensitivities, and the
-- looser requirement wins that argument eventually.
-- ---------------------------------------------------------------------------
alter table calendar_event drop constraint if exists calendar_event_category_check;

alter table calendar_event
  add constraint calendar_event_category_check
  check (category in ('cours', 'examen', 'etude', 'travail', 'evenement', 'perso', 'sante'));

-- ---------------------------------------------------------------------------
-- 2. The days a rule does not land on.
--
-- WHY A LIST OF EXCEPTIONS AND NOT A DELETE, A SPLIT, OR AN END DATE.
--
-- "Delete only this one" on a weekly class has no other honest implementation,
-- and the three obvious alternatives each lose something:
--
--   * deleting the row removes the whole term
--   * setting until_on to the day before removes the rest of the term as well
--   * splitting the rule in two turns one class into two rows, which then drift
--     apart the first time somebody edits the room on one of them
--
-- So the rule stays whole and records the days it skips. This is what an
-- iCalendar EXDATE is, and every calendar that has solved this problem
-- settled on the same shape.
--
-- date[] rather than a side table. The expected size is a handful of cancelled
-- classes per term, the client already reads the whole row, and a join for
-- three dates is a join nobody wants to maintain. If somebody one day skips
-- hundreds of days of one rule, that is a rule they should have ended instead.
--
-- No constraint tying these to actual occurrences. An exception for a day the
-- rule never lands on is harmless: occurrencesOf builds a Set and asks it, so
-- a date that never comes up is never asked about. Checking would mean running
-- the expander inside the database, which is exactly what section 1 of
-- migration 51 refused to do and for the same reason.
-- ---------------------------------------------------------------------------
alter table calendar_event
  add column if not exists excluded_on date[] not null default '{}';

-- ---------------------------------------------------------------------------
-- 3. Nothing about the policies changes.
--
-- Stated rather than assumed: both changes are on a table whose four policies
-- are already `user_id = auth.uid()`, and neither adds a column that anybody
-- else can read. There is no new grant here and there should never be one.
-- ---------------------------------------------------------------------------

notify pgrst, 'reload schema';

-- Check:
--   -- the new categories are accepted:
--   insert into calendar_event (user_id, title, category, starts_on)
--   values (auth.uid(), 'Shift', 'travail', current_date);
--
--   -- and an old invented one still is not:
--   insert into calendar_event (user_id, title, category, starts_on)
--   values (auth.uid(), 'x', 'quidditch', current_date);
--   -- must fail on calendar_event_category_check
--
--   -- the exceptions column exists and defaults to empty:
--   select title, weekdays, excluded_on from calendar_event limit 5;
