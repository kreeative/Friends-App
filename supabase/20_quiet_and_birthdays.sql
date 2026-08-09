-- ============================================================================
-- Stop the nudge flood, and add birthdays.
--
-- Run after 19. Safe to re-run.
--
-- WHY THERE WERE TWENTY NOTIFICATIONS ON A GROUP THAT WAS DAYS OLD
--
-- tick() raised a nudge when a member missed two consecutive CLOSED cycles.
-- That threshold was written when a cycle was a week, so it meant a fortnight
-- of silence and the copy still says "quiet for a couple of weeks". Then 18
-- made a cycle a day, and the same line started meaning two days.
--
-- Worse, 18 converted the group's history to daily and backfilled it, so a
-- single tick() closed something like a fortnight of cycles in one pass and
-- ran the nudge check on every consecutive pair it found. One member, one
-- afternoon, a dozen notifications, all of them announcing that somebody had
-- been quiet during days the app had only just invented.
--
-- Counting cycles was the mistake. A cycle is a unit of the group's schedule,
-- not a unit of time, so any threshold expressed in cycles silently changes
-- meaning the moment the cadence changes. This counts days instead, straight
-- from the last thing the person actually did, which means the same thing at
-- every cadence forever.
--
-- The rules now, all of which must hold:
--
--   1. the account is older than 14 days      (nothing on a brand new app)
--   2. the member joined more than 14 days ago (nothing on a brand new group)
--   3. no check-in and no away period in 14 days
--   4. they have no nudge already open in this group
--
-- Rule 1 is the one that was asked for explicitly and the one that makes the
-- flood impossible: a fortnight of silence cannot be observed on an account
-- that has not existed for a fortnight.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Delete the ones already raised.
--
-- Everything still pending or claimed goes. On a product this young no nudge
-- can have been legitimate: raising one requires a fortnight of silence, and
-- no account has been silent that long because no account is that old. Rows
-- already marked done are history and are left alone.
-- ---------------------------------------------------------------------------
delete from nudges where state in ('pending', 'claimed');

-- Same story in the feed. record_missed_goals ran once per backfilled cycle,
-- so it reported missed goals for days that were retro-fitted underneath
-- people. Anything older than the group's own first real day is noise.
delete from group_feed gf
using cycles c
where gf.cycle_id = c.id
  and c.closes_at < gf.created_at - interval '1 day';

-- ---------------------------------------------------------------------------
-- 2. Birthdays.
--
-- A date with no year would be the tidy modelling choice, but Postgres has no
-- such type and the workarounds all cost more than they save. So a full date,
-- with the year simply never displayed.
-- ---------------------------------------------------------------------------
alter table profiles add column if not exists birthday date;

-- Also settings the app needs to remember per person.
alter table profiles add column if not exists has_seen_budget_intro boolean not null default false;

-- The feed learns two new kinds. The check constraint has to be replaced
-- rather than added to, since a check cannot be extended in place.
alter table group_feed drop constraint if exists group_feed_kind_check;
alter table group_feed add constraint group_feed_kind_check
  check (kind in ('missed_goal', 'birthday'));

-- goal_id and cycle_id are both null on a birthday row, and the unique index
-- from 18 treats nulls as distinct, so it would not stop a second one being
-- written the next time tick() ran.
--
-- The day is a stored column rather than an expression over created_at. Two
-- reasons, and the first is that the expression is simply not allowed:
-- casting timestamptz to date depends on the session TimeZone, which makes it
-- STABLE rather than IMMUTABLE, and Postgres refuses it in an index. The
-- second is that it is more correct anyway. created_at is an instant; the
-- question "is it their birthday" is about the GROUP's calendar day, the same
-- one cycles already turn over on, so the writer decides the day explicitly.
alter table group_feed add column if not exists day date;

create unique index if not exists group_feed_birthday_uniq
  on group_feed (group_id, user_id, kind, day)
  where kind = 'birthday';

-- ---------------------------------------------------------------------------
-- 3. Has this person actually gone quiet?
--
-- Days since the last thing they did, or null when they have never done
-- anything, in which case the fallback is how long they have been a member.
-- ---------------------------------------------------------------------------
create or replace function days_silent(p_user uuid, p_group uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  with last_act as (
    select max(x.at) as at from (
      -- submitted_at, not created_at. checkins records when the person
      -- actually filed it, which is the moment that counts as activity.
      select c.submitted_at as at
        from checkins c
        join cycles cy on cy.id = c.cycle_id
       where c.user_id = p_user and cy.group_id = p_group
      union all
      select a.created_at
        from away_periods a
       where a.user_id = p_user
    ) x
  ),
  joined as (
    select joined_at from group_members
     where user_id = p_user and group_id = p_group
  )
  select greatest(0, extract(day from now() - coalesce(
    (select at from last_act),
    (select joined_at from joined)
  ))::int)
$$;

-- ---------------------------------------------------------------------------
-- 4. Raise a nudge only when all four rules hold.
--
-- Replaces the per-cycle check entirely. Called once per group per tick,
-- rather than once per closed cycle, so replaying a backfill cannot multiply
-- the output.
-- ---------------------------------------------------------------------------
create or replace function raise_quiet_nudges(p_group uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
  n int := 0;
  latest uuid;
begin
  -- Nudges hang off a cycle, so the newest one stands in as the anchor.
  select id into latest
  from cycles where group_id = p_group
  order by opens_at desc limit 1;

  if latest is null then
    return 0;
  end if;

  for m in
    select gm.user_id, gm.joined_at, p.created_at as account_created
    from group_members gm
    join profiles p on p.id = gm.user_id
    where gm.group_id = p_group
  loop
    -- Rules 1 and 2: neither the account nor the membership is new enough for
    -- a fortnight of silence to be a thing that could have happened.
    if m.account_created > now() - interval '14 days' then continue; end if;
    if m.joined_at      > now() - interval '14 days' then continue; end if;

    -- Rule 3.
    if days_silent(m.user_id, p_group) < 14 then continue; end if;

    -- Rule 4: one open nudge per person per group, ever, until it is closed.
    if exists (
      select 1 from nudges
      where group_id = p_group and subject_id = m.user_id
        and state in ('pending', 'claimed')
    ) then continue; end if;

    insert into nudges (group_id, cycle_id, subject_id)
    values (p_group, latest, m.user_id)
    on conflict (cycle_id, subject_id) do nothing;

    n := n + 1;
  end loop;

  return n;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Birthday rows in the feed.
-- ---------------------------------------------------------------------------
create or replace function record_birthdays(p_group uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int := 0;
  tz text;
begin
  -- The group's own timezone, for the same reason cycles use it: everyone in
  -- one group should agree about what day it is.
  select coalesce(timezone, 'UTC') into tz from groups where id = p_group;

  insert into group_feed (group_id, user_id, kind, day)
  select p_group, gm.user_id, 'birthday', (now() at time zone tz)::date
  from group_members gm
  join profiles p on p.id = gm.user_id
  where p.birthday is not null
    and extract(month from p.birthday) = extract(month from (now() at time zone tz))
    and extract(day   from p.birthday) = extract(day   from (now() at time zone tz))
  on conflict do nothing;

  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Rewire tick().
--
-- Only the nudge block changes. Cycles still open and close exactly as 18
-- left them, and record_missed_goals still runs per closed cycle, because a
-- missed goal genuinely is a per-cycle fact. What moves out of the loop is
-- the nudge decision, which is a per-person fact and was never per cycle.
-- ---------------------------------------------------------------------------
create or replace function tick() returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  g_id uuid;
  c record;
  fallback_uid uuid;
begin
  for g_id in select id from groups loop
    perform ensure_cycles(g_id, 2);
  end loop;

  update cycles set state = 'open'
  where state = 'upcoming' and opens_at <= now() and closes_at > now();

  for c in
    select * from cycles
    where state in ('open', 'upcoming') and closes_at <= now()
  loop
    update cycles set state = 'closed' where id = c.id;
    perform record_missed_goals(c.id);
  end loop;

  -- Once per group, not once per closed cycle.
  for g_id in select id from groups loop
    perform raise_quiet_nudges(g_id);
    perform record_birthdays(g_id);
  end loop;

  for c in
    select * from nudges
    where state = 'pending' and assigned_to is null and created_at < now() - interval '24 hours'
  loop
    select gm.user_id into fallback_uid
    from group_members gm
    where gm.group_id = c.group_id and gm.user_id <> c.subject_id
    order by gm.nudge_order, gm.joined_at
    offset (
      select count(*) from nudges n
      where n.group_id = c.group_id and n.assigned_to is not null and n.created_at < c.created_at
    ) % greatest(1, (select count(*) - 1 from group_members where group_id = c.group_id))
    limit 1;

    if fallback_uid is not null then
      update nudges set assigned_to = fallback_uid where id = c.id;
    end if;
  end loop;
end $$;

grant execute on function days_silent(uuid, uuid)   to authenticated;
grant execute on function raise_quiet_nudges(uuid)  to authenticated;
grant execute on function record_birthdays(uuid)    to authenticated;
