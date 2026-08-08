-- ============================================================================
-- How you are today, kept apart from the check-in.
--
-- Run after 01/02/03. Safe to re-run.
--
-- Mood was a column on `checkins`, which tied it to a cycle: you could only
-- say how you were during the hours your group's window happened to be open,
-- and only in a group. But how you are is a fact about you on a Tuesday, not
-- about a group's schedule, and the person most worth asking is the one who
-- has not opened a check-in in three weeks.
--
-- So it moves to its own table, one row per person per day, and to the
-- dashboard. The old column stays where it is: it is history, and rewriting
-- what somebody recorded during a past check-in is not this migration's job.
-- ============================================================================

create table if not exists daily_mood (
  user_id    uuid not null references profiles(id) on delete cascade,
  day        date not null default current_date,
  mood       text not null,
  /**
   * Off by default, and that is the important line in this file.
   *
   * Sharing how you feel with four people who know you is a real thing to
   * offer and a worse thing to assume. Anyone who wants it can turn it on in
   * one tap; nobody has to discover after the fact that their bad Tuesday was
   * broadcast. Defaults are the only privacy setting most people ever use.
   */
  shared     boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

create index if not exists daily_mood_day_idx on daily_mood(day);

alter table daily_mood enable row level security;

-- ---------------------------------------------------------------------------
-- Reading: always your own. Someone else's only when they have shared it,
-- only for today, and only if you actually share a group with them.
--
-- All three conditions matter. Without `shared` it is not consented to;
-- without the date bound a group-mate could read back a history of your moods,
-- which is a different and much more invasive thing than knowing how someone
-- is this morning; without shares_group it would be public.
-- ---------------------------------------------------------------------------
drop policy if exists daily_mood_select on daily_mood;
create policy daily_mood_select on daily_mood for select to authenticated
  using (
    user_id = auth.uid()
    or (shared and day = current_date and shares_group(user_id))
  );

drop policy if exists daily_mood_write on daily_mood;
create policy daily_mood_write on daily_mood for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists daily_mood_update on daily_mood;
create policy daily_mood_update on daily_mood for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists daily_mood_delete on daily_mood;
create policy daily_mood_delete on daily_mood for delete to authenticated
  using (user_id = auth.uid());

-- Check:
--   select * from daily_mood where user_id = auth.uid();
