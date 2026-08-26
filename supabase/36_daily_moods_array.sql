-- ============================================================================
-- More than one feeling in a day.
--
-- Run after 35. Safe to re-run.
--
-- daily_mood.mood has been one text column since migration 12, so a Tuesday
-- could be joyful or it could be impatient and never both. People are not one
-- thing at a time, and a picker that makes you choose between two true answers
-- gets the arbitrary one, which is the answer nobody trusts three months later.
--
-- WHY `mood` DOES NOT GO AWAY.
--
-- It is `not null`, and two screens have read it as a single value since the
-- day it shipped: the week strip draws one face per day, and the group board
-- draws one face per person. Both are right to show one thing, because a row of
-- five people each wearing four faces is not a board anybody can read.
--
-- So the column stays and keeps meaning what it meant: the one that stands for
-- the rest. The client writes the first of the set in catalogue order, not tap
-- order, so the face somebody's group sees does not depend on which one they
-- happened to press first. `moods` beside it holds all of them, and the picker
-- and the day recap read that.
--
-- This is deliberately NOT a join table. The values are a closed set of fifteen
-- that the application ships, nothing is ever queried by mood across users, and
-- the only read is "the moods on this day", which an array answers without a
-- join. See the same argument in migration 33, which was reverted for other
-- reasons but was right about this.
-- ============================================================================

alter table daily_mood add column if not exists moods text[] not null default '{}';

-- ---------------------------------------------------------------------------
-- Backfill, and it must be idempotent AND it must not copy a value the
-- constraint below is about to refuse.
--
-- Guarded on the array being empty rather than run blind: a re-run after
-- somebody has deselected everything but the primary would otherwise be a
-- no-op, but a re-run after somebody has ADDED moods would silently throw the
-- extras away and put the row back to one. `where moods = '{}'` means the
-- backfill only ever touches rows the array has never been written to.
--
-- THE `= any` IS WHY THIS MIGRATION USED TO FAIL, AND IT FAILED SILENTLY.
--
-- `mood` has never had a check on it. The first version of this file copied it
-- into `moods` unconditionally and then constrained `moods` to the fifteen the
-- app ships, so one historical row holding anything else -- an id from before
-- the catalogue settled, a value written by hand -- made the last statement
-- raise "check constraint is violated by some row" and roll the WHOLE script
-- back. The column was never added, the app went on reading a `moods` that did
-- not exist, and the only symptom was a feature that quietly did nothing.
--
-- Reproduced on Postgres 16 with one row holding 'okay' and confirmed fixed
-- there. The note further down says adding a check to `mood` would fail for
-- anybody holding a value this list forgot; that was right, and the backfill
-- walked into the same wall from the other side.
-- ---------------------------------------------------------------------------
update daily_mood
   set moods = array[mood]
 where moods = '{}'
   and mood is not null
   and mood <> ''
   and mood = any (array[
     'joyful', 'grateful', 'energized', 'serene',
     'excited', 'sensitive', 'neutral', 'nostalgic',
     'confused', 'bored', 'stressed', 'angry', 'insecure', 'hurt', 'guilty'
   ]::text[]);

-- ---------------------------------------------------------------------------
-- And scrub anything already in the array that the constraint would refuse.
--
-- Needed for the database that got half of this file before it rolled back, and
-- for any row written while a value was on the catalogue and later taken off.
-- Only ever removes: array_agg over the values that ARE allowed, coalesced
-- because array_agg answers null rather than '{}' when nothing survives.
-- ---------------------------------------------------------------------------
update daily_mood
   set moods = coalesce((
     select array_agg(m order by m)
       from unnest(moods) as m
      where m = any (array[
        'joyful', 'grateful', 'energized', 'serene',
        'excited', 'sensitive', 'neutral', 'nostalgic',
        'confused', 'bored', 'stressed', 'angry', 'insecure', 'hurt', 'guilty'
      ]::text[])
   ), '{}'::text[])
 where not (moods <@ array[
   'joyful', 'grateful', 'energized', 'serene',
   'excited', 'sensitive', 'neutral', 'nostalgic',
   'confused', 'bored', 'stressed', 'angry', 'insecure', 'hurt', 'guilty'
 ]::text[]);

-- ---------------------------------------------------------------------------
-- The fifteen the app ships, and nothing else.
--
-- Without this the column is a text field that accepts anything, and
-- cleanMoods in src/lib/moods.js silently drops what it does not recognise, so
-- a typo would vanish from the screen rather than fail at the door.
--
-- `mood` itself is deliberately left unconstrained. It has never had a check on
-- it, twelve months of rows have gone through it, and adding one now would fail
-- the migration for anybody holding a value this list forgot.
-- ---------------------------------------------------------------------------
alter table daily_mood drop constraint if exists daily_mood_moods_check;
alter table daily_mood add constraint daily_mood_moods_check check (
  moods <@ array[
    'joyful', 'grateful', 'energized', 'serene',
    'excited', 'sensitive', 'neutral', 'nostalgic',
    'confused', 'bored', 'stressed', 'angry', 'insecure', 'hurt', 'guilty'
  ]::text[]
  and coalesce(array_length(moods, 1), 0) <= 15
);

notify pgrst, 'reload schema';

-- Check:
--   select day, mood, moods, shared from daily_mood order by day desc limit 10;
--   select count(*) from daily_mood where moods = '{}';   -- 0, after the backfill
