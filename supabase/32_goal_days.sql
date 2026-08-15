-- ============================================================================
-- Ticking off a goal on a day, with no group in the way.
--
-- Run after 31. Safe to re-run.
--
-- WHY THIS TABLE HAS TO EXIST.
--
-- Everything that records "I did the thing" runs through one chain:
--
--   cycles -> checkins -> checkin_items
--
-- and the first link is `cycles.group_id uuid not null`. So the entire idea of
-- progress in this app is the property of a group. Migration 09 made goals
-- solo, which was half the job: since then somebody with no group has been
-- able to write down what they intend to do and has had nowhere to record
-- having done it. The goal sits on the screen forever, unticked, because there
-- is no row anywhere that a person without a group is allowed to write.
--
-- That is what this fixes, and it is deliberately its own small table rather
-- than a loosening of the chain above. Making cycles.group_id nullable would
-- mean every query that joins a cycle to a group has to start asking whether
-- this one has a group, and there are a lot of them: the board, the digest,
-- the nudges, the analytics. One narrow table nothing else reads is cheaper
-- and cannot break anything that already works.
--
-- WHY IT IS NOT A BOOLEAN.
--
-- target_per_cycle already lets a goal be "3 times a day", and a goal you did
-- twice out of three times is the case the whole app is careful about
-- elsewhere: checkin_items carries count_done for exactly this reason, and
-- outcomeFor() in src/lib/schedule.js turns it into done/partial/missed. A
-- boolean here would be the one place that rounds two-out-of-three into a lie,
-- in whichever direction you picked.
--
-- WHY THERE IS NO ROW FOR "NOT DONE".
--
-- count_done starts at 1, not 0. A row saying zero and no row at all are the
-- same statement, and two ways to say one thing is how they come to disagree.
-- Unticking deletes the row. This also means the table only ever holds days
-- something happened, so it stays small and a date range scan is cheap.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The days.
--
-- `on_date` is a date, in the person's own calendar, written by the client.
-- Not a timestamptz and not now(): the server is in UTC, and a goal ticked at
-- ten in the evening in Montreal would be filed under tomorrow. That exact bug
-- was fixed once already in the budget (see localISO in src/lib/txn.js) and it
-- is the same bug here.
--
-- user_id is stored rather than derived from the goal, even though for a
-- personal goal it is always the owner. It is what every policy and every
-- index on this table wants, and reaching through to goals to find out whose
-- row this is would put a join in the hot path of the only query that runs.
-- ---------------------------------------------------------------------------
create table if not exists goal_days (
  id         uuid primary key default gen_random_uuid(),
  goal_id    uuid not null references goals(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  on_date    date not null,
  count_done int  not null default 1 check (count_done between 1 and 50),
  created_at timestamptz not null default now(),

  -- One row per goal per person per day. Load-bearing: the client upserts on
  -- this constraint, so tapping the same tick twice from two tabs converges
  -- instead of producing two half-truths.
  unique (goal_id, user_id, on_date)
);

-- The only query this table has: my ticks, over a window, newest first.
create index if not exists goal_days_mine_idx
  on goal_days (user_id, on_date desc);

alter table goal_days enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Yours, and only for goals that are yours.
--
-- Two conditions on the way in, not one. `user_id = auth.uid()` alone would
-- let somebody file a tick against another person's goal id under their own
-- name, which is not a data breach but is a row that should not exist and
-- would quietly inflate a number somewhere later.
--
-- The exists() clause names owner_id rather than going through is_member(),
-- and that is the whole scope of this feature: this table is for goals that
-- belong to a person. A group goal (owner_id is null) has the check-in for
-- this, and giving it a second, private way to be marked done would be two
-- sources of truth for one question.
-- ---------------------------------------------------------------------------
drop policy if exists goal_days_select on goal_days;
create policy goal_days_select on goal_days for select to authenticated
  using (user_id = auth.uid());

drop policy if exists goal_days_insert on goal_days;
create policy goal_days_insert on goal_days for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from goals g
       where g.id = goal_id
         and g.owner_id = auth.uid()
    )
  );

-- Both halves on update. `using` decides which rows you may touch and says
-- nothing about what you may turn them into: without `with check`, an update
-- could move a row onto somebody else's goal or reassign user_id.
drop policy if exists goal_days_update on goal_days;
create policy goal_days_update on goal_days for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from goals g
       where g.id = goal_id
         and g.owner_id = auth.uid()
    )
  );

-- Untick. No goal check here on purpose: if a goal stopped being yours, you
-- should still be able to remove the rows you wrote, and the cascade above
-- already takes them when the goal itself goes.
drop policy if exists goal_days_delete on goal_days;
create policy goal_days_delete on goal_days for delete to authenticated
  using (user_id = auth.uid());

notify pgrst, 'reload schema';

-- Check:
--   select on_date, count_done, goal_id from goal_days order by on_date desc limit 20;
--   select relrowsecurity from pg_class where relname = 'goal_days';   -- t
