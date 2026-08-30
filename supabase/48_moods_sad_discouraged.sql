-- ============================================================================
-- Two more feelings: triste and decourage.
--
-- Run after 47. Safe to re-run.
--
-- WHY THIS IS NOT OPTIONAL, AND WHY IT FAILS IN THE WORST WAY WITHOUT IT.
--
-- 36_daily_moods_array.sql put a check constraint on daily_mood.moods naming
-- the fifteen the app shipped that day, and an upper bound of fifteen entries.
-- The client now offers seventeen. Without this file, tapping the new faces
-- looks completely normal, the upsert is refused by the constraint, and
-- MoodToday has nothing to show for it: the moods the app knows about and the
-- moods the database accepts disagree, and the person who tapped is the last
-- to find out.
--
-- The count matters as much as the list. `<= 15` would refuse somebody who
-- picked all seventeen even though every one of them is in the list, which is
-- the same failure arriving one tap later.
--
-- WHY `mood` IS STILL NOT CONSTRAINED.
--
-- Same reason 36 gives. The single column has never had a check on it, a year
-- of rows has gone through it, and adding one now would fail this migration for
-- anybody holding a value the list forgot. It carries the one that stands for
-- the rest, and cleanMoods in src/lib/moods.js drops anything it does not
-- recognise on the way to the screen.
--
-- NOTHING IS BACKFILLED AND NOTHING IS MIGRATED.
--
-- No existing row can hold either of these, because until this deploy no
-- client could write them. This is one constraint being widened, which is why
-- it is three statements rather than the careful dance 36 needed.
-- ============================================================================

alter table daily_mood drop constraint if exists daily_mood_moods_check;
alter table daily_mood add constraint daily_mood_moods_check check (
  moods <@ array[
    'joyful', 'grateful', 'energized', 'serene',
    'excited', 'sensitive', 'neutral', 'nostalgic',
    'confused', 'bored', 'sad', 'discouraged',
    'stressed', 'angry', 'insecure', 'hurt', 'guilty'
  ]::text[]
  and coalesce(array_length(moods, 1), 0) <= 17
);

notify pgrst, 'reload schema';

-- Check:
--   -- must succeed
--   select array['sad', 'discouraged']::text[]
--       <@ array['joyful','grateful','energized','serene','excited','sensitive',
--                'neutral','nostalgic','confused','bored','sad','discouraged',
--                'stressed','angry','insecure','hurt','guilty']::text[];
--
--   -- and the constraint itself, as the database now holds it:
--   select pg_get_constraintdef(oid)
--     from pg_constraint
--    where conname = 'daily_mood_moods_check';
