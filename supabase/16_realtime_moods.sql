-- ============================================================================
-- Push a mood change to the group as it happens.
--
-- Run after 12. Safe to re-run.
--
-- Supabase only broadcasts changes for tables that have been added to the
-- `supabase_realtime` publication. Without this the group board still updates,
-- because GroupMoods also refetches whenever the tab comes back to the front,
-- but somebody sitting with the page open watching for a friend's face would
-- wait until they touched something.
--
-- Realtime respects row level security, so adding the table here does not
-- widen who can see what: a subscriber is sent a change only if the policy in
-- 12_daily_mood.sql would have let them select that row. Somebody who has not
-- turned sharing on is not broadcast to anybody.
-- ============================================================================

do $$
begin
  -- The publication is created by Supabase. On a plain Postgres, or a project
  -- where realtime was never enabled, it does not exist, and this file should
  -- say so rather than abort a script somebody is pasting.
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'supabase_realtime does not exist; skipping. Enable Realtime for this project, then re-run.';
    return;
  end if;

  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'daily_mood'
  ) then
    raise notice 'daily_mood is already published.';
    return;
  end if;

  alter publication supabase_realtime add table daily_mood;
  raise notice 'daily_mood added to supabase_realtime.';
end $$;

-- ---------------------------------------------------------------------------
-- The old row, for updates.
--
-- A change to an existing row is broadcast with only the columns that changed
-- unless the table has a replica identity that covers the rest. daily_mood is
-- keyed on (user_id, day), and user_id is what a subscriber matches against,
-- so without this an update to somebody's mood arrives with no way to tell
-- whose it was.
-- ---------------------------------------------------------------------------
alter table daily_mood replica identity full;

-- Check:
--   select tablename from pg_publication_tables where pubname = 'supabase_realtime';
