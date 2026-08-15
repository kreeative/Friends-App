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
-- Backfill, and it must be idempotent.
--
-- Guarded on the array being empty rather than run blind: a re-run after
-- somebody has deselected everything but the primary would otherwise be a
-- no-op, but a re-run after somebody has ADDED moods would silently throw the
-- extras away and put the row back to one. `where moods = '{}'` means the
-- backfill only ever touches rows the array has never been written to.
-- ---------------------------------------------------------------------------
update daily_mood
   set moods = array[mood]
 where moods = '{}'
   and mood is not null
   and mood <> '';

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
