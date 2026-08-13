-- ============================================================================
-- Which days a goal actually runs on.
--
-- Run after 23. Safe to re-run.
--
-- A cycle has been a day since 18, and a goal has had exactly one number:
-- target_per_cycle, how many times per day. That is right for "wash twice a
-- day" and has nowhere to put "twice a week". People entered those as daily
-- goals, then missed them five days out of seven, and the completion rate said
-- they were failing at something they were in fact doing exactly as planned.
--
-- WHY NOT A target_per_day COLUMN
--
-- Because target_per_cycle already is one. A cycle is a day; adding a second
-- column holding the same number under a clearer name means two numbers that
-- can disagree, and a migration to decide which of them wins. The name is
-- worse than it should be and the value is correct, so the value stays.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- The days, as weekday numbers, 0 = Sunday.
--
-- Matching JavaScript's getDay() and the checkin_dow column groups already
-- use, so nothing anywhere has to add or subtract one. An array rather than
-- seven booleans: the question is "which days", and seven columns is that
-- question written out longhand and then joined back together at every
-- reader.
--
-- NULL, NOT AN EMPTY ARRAY, IS THE DEFAULT.
--
-- Both are read by the app as "every day", but null is what an existing row
-- has without being touched, so there is no backfill and no window in which
-- half the goals mean one thing and half the other. An empty array can only
-- arrive by somebody clearing every day in the form, which the client refuses
-- for exactly this reason.
-- ---------------------------------------------------------------------------
alter table goals add column if not exists active_days int[];

-- Nothing outside a week, and no duplicates worth storing. A bad array here
-- would silently make a goal due on no day at all, which looks like the goal
-- having quietly disappeared.
alter table goals drop constraint if exists goals_active_days_check;
alter table goals add constraint goals_active_days_check
  check (
    active_days is null
    or (
      array_length(active_days, 1) between 1 and 7
      and active_days <@ array[0, 1, 2, 3, 4, 5, 6]
    )
  );

-- Check:
--   select commitment, cadence, target_per_cycle, active_days
--     from goals order by created_at desc limit 20;
