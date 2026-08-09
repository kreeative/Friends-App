-- ============================================================================
-- The currency belongs to the person, not to the plan.
--
-- Run after 21. Safe to re-run.
--
-- budget_plan.currency has existed since 19 and has never been written. The
-- form does not ask, the client does not set it, so every row in every account
-- has sat at the column default of CAD. Somebody in Abidjan planning in francs
-- has been reading their own rent back in Canadian dollars, and the fix was
-- never a formatter, it was that nothing ever recorded the answer.
--
-- WHY IT MOVES TO THE PROFILE
--
-- It was on the plan because the plan is where the money lives. But a person
-- has one currency and may have several things denominated in it: the plan
-- today, and whatever the app grows next. Asking twice is how two answers come
-- to disagree, and the second one is always the one nobody updated.
--
-- The old column is deliberately left alone. Dropping it would break any
-- deploy still running the previous build against this database, and it costs
-- nothing to leave a column the client stops reading.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The column.
--
-- NULLABLE, AND THAT IS THE POINT.
--
-- `not null default 'CAD'` would be the obvious shape and it is wrong here,
-- because it makes "has not chosen yet" and "chose Canadian dollars"
-- indistinguishable the moment the row is created. The client detects a
-- sensible currency from the browser's own locale and writes it once, on first
-- sight, and it can only know to do that while the column is still null. With
-- a default, every French and Ivorian account would be pinned to dollars
-- forever and nobody would know why.
--
-- Null reads as the fallback everywhere in the app, so nothing is undefined
-- while it is unset.
-- ---------------------------------------------------------------------------
alter table profiles add column if not exists currency text;

-- Any three-letter code, rather than a list of the ten the picker offers.
-- The set of currencies an app supports is a client decision and changes with
-- a deploy; making it a database constraint means a migration every time
-- somebody moves. The shape is worth enforcing, the membership is not.
alter table profiles drop constraint if exists profiles_currency_check;
alter table profiles add constraint profiles_currency_check
  check (currency is null or currency ~ '^[A-Z]{3}$');

-- ---------------------------------------------------------------------------
-- 2. Carry over anything real.
--
-- Only where a plan says something other than the default it was never asked
-- about. A plan reading CAD carries no information: it is the column default,
-- not an answer, and copying it across would defeat the detection above by
-- filling in the value it exists to work out.
-- ---------------------------------------------------------------------------
update profiles p
   set currency = b.currency
  from budget_plan b
 where b.user_id = p.id
   and p.currency is null
   and b.currency is not null
   and b.currency <> 'CAD';

-- Check:
--   select id, display_name, currency from profiles order by created_at;
