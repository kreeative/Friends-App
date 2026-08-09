-- ============================================================================
-- RUN THIS IN SUPABASE  (SQL Editor -> New query -> paste -> Run)
--
-- Three migrations, in the order they have to run. Safe to re-run as a whole.
--
--   18  daily cycles, creator/admin roles, delete permission, group feed
--   19  the money plan (budget_plan, budget_fixed, budget_entry)
--   20  stops the nudge flood, adds birthdays and the budget intro flag
--
-- 20 DELETES the pending nudges, so the spurious "has been quiet" cards
-- disappear the moment this finishes.
-- ============================================================================


-- ###########################################################################
-- ## 18_daily_roles_and_feed.sql
-- ###########################################################################

-- ============================================================================
-- Daily check-ins, real roles, and a group feed.
--
-- Run after 13. Safe to re-run.
--
-- Three changes that arrived together and are easier to reason about together,
-- because all three touch group_members or cycles.
--
--   1. the cycle becomes a day rather than a week
--   2. group_members grows a 'creator' role, and groups a delete permission
--   3. a feed, so a missed day is visible to the group without an email
--
-- On "reset at midnight in the user's local timezone": a cycle belongs to the
-- group, not to a person. If every member reset at their own midnight they
-- would each be in a different cycle, and the board could not show a shared
-- "today" at all: two people in the same group would disagree about which day
-- it was and about who had checked in. So the boundary is the GROUP's
-- timezone, which is a column that already exists and is set when the group is
-- created. Everyone in one group crosses midnight together.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. A day is the cycle.
--
-- No new machinery. cadence_days already drives ensure_cycles and is already
-- constrained to 1..28, so daily is cadence_days = 1, and midnight is
-- opens_hour = 0. checkin_dow stops meaning anything once the cadence is a
-- day, and is left alone rather than dropped: it still matters to any group
-- that sets a longer cadence later.
-- ---------------------------------------------------------------------------
alter table groups alter column cadence_days set default 1;
alter table groups alter column opens_hour   set default 0;

-- window_hours described the old thirty-hour door. 13_group_rhythm.sql already
-- made the period run to the next one, so this is only the reminder span now.
alter table groups alter column window_hours set default 24;

update groups
set cadence_days = 1,
    opens_hour   = 0,
    window_hours = 24
where cadence_days is distinct from 1 or opens_hour is distinct from 0;

-- Existing weekly cycles are the wrong length now. Anything still in the
-- future is regenerated; anything already closed is history and stays exactly
-- as it was, because rewriting the length of a week somebody already checked
-- into would falsify their record.
delete from cycles c
where c.opens_at > now()
  and not exists (select 1 from checkins     k where k.cycle_id = c.id)
  and not exists (select 1 from away_periods a where a.cycle_id = c.id)
  and not exists (select 1 from nudges       n where n.cycle_id = c.id);

-- ---------------------------------------------------------------------------
-- 1b. Periods chain from the previous END, and the day is re-anchored to
--     midnight.
--
-- ensure_cycles took the last period's opens_at and added a cadence. That is
-- fine while the anchor never moves, and wrong the moment it does: switching a
-- group from weekly-at-18:00 to daily produced days running 18:00 to 18:00,
-- because each new period inherited the old evening anchor and simply stepped
-- one day at a time from it. Midnight never came into it.
--
-- Chaining from closes_at instead makes the boundary follow whatever the
-- previous period actually ended at, so re-anchoring is a matter of correcting
-- one period's end and letting the rest fall in behind it. It also states the
-- real invariant directly: periods meet, with no gap and no overlap.
-- ---------------------------------------------------------------------------
create or replace function ensure_cycles(gid uuid, ahead int default 2)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  g            groups%rowtype;
  base_date    date;
  dow_offset   int;
  next_seq     int;
  last_closes  timestamptz;
  opens_local  timestamp;
  ends_local   timestamp;
  first_end    timestamp;
  future_count int;
begin
  select * into g from groups where id = gid;
  if not found then return; end if;

  ahead := least(greatest(coalesce(ahead, 2), 1), 2);

  select max(seq) into next_seq from cycles where group_id = gid;
  select closes_at into last_closes
  from cycles where group_id = gid order by seq desc limit 1;

  if next_seq is null then
    base_date   := (g.created_at at time zone g.timezone)::date;
    dow_offset  := (extract(dow from base_date)::int - g.checkin_dow + 7) % 7;
    opens_local := (base_date - dow_offset)::timestamp + make_interval(hours => g.opens_hour);

    if opens_local at time zone g.timezone > g.created_at then
      first_end   := opens_local;
      opens_local := (g.created_at at time zone g.timezone);
    end if;

    next_seq := 0;
  else
    -- Where the last period ended is where the next one starts.
    opens_local := (last_closes at time zone g.timezone);
    next_seq    := next_seq + 1;
  end if;

  select count(*) into future_count
  from cycles where group_id = gid and closes_at > now();

  while future_count < ahead loop
    ends_local := coalesce(first_end, opens_local + make_interval(days => g.cadence_days));
    first_end  := null;

    insert into cycles (group_id, seq, opens_at, closes_at, state)
    values (
      gid,
      next_seq,
      opens_local at time zone g.timezone,
      ends_local  at time zone g.timezone,
      'upcoming'
    )
    on conflict (group_id, seq) do nothing;

    if ends_local at time zone g.timezone > now() then
      future_count := future_count + 1;
    end if;

    opens_local := ends_local;
    next_seq    := next_seq + 1;

    if next_seq > 5000 then exit; end if;
  end loop;
end;
$$;

-- With the chain rule in place, correcting the open period's end to the next
-- midnight is enough to put every period after it on midnight too.
update cycles c
set closes_at = (((c.opens_at at time zone g.timezone)::date + 1)::timestamp)
                at time zone g.timezone
from groups g
where g.id = c.group_id
  and c.opens_at <= now()
  and c.closes_at > now();

-- Anything still ahead of the open one was generated on the old anchor.
delete from cycles c
where c.opens_at > now()
  and not exists (select 1 from checkins     k where k.cycle_id = c.id)
  and not exists (select 1 from away_periods a where a.cycle_id = c.id)
  and not exists (select 1 from nudges       n where n.cycle_id = c.id);

-- ---------------------------------------------------------------------------
-- 2. Roles: creator, admin, member.
--
-- 'creator' is new and there is exactly one per group. It is not a label on
-- top of admin, it is the role that cannot be taken away by anybody else,
-- which is the whole point of having it: an admin you promoted should not be
-- able to promote themselves past you or delete the group out from under you.
-- ---------------------------------------------------------------------------
alter table group_members drop constraint if exists group_members_role_check;
alter table group_members add constraint group_members_role_check
  check (role in ('member', 'admin', 'creator'));

-- Backfill from groups.created_by. Every group has one; the person who ran
-- create_group was given 'admin' at the time.
update group_members gm
set role = 'creator'
from groups g
where g.id = gm.group_id
  and g.created_by = gm.user_id
  and gm.role <> 'creator';

-- One creator per group, enforced rather than assumed.
create unique index if not exists group_members_one_creator_idx
  on group_members (group_id) where role = 'creator';

-- ---------------------------------------------------------------------------
-- 3. Who may delete the group.
--
-- Off by default, and that is deliberate. Deleting a group destroys everyone's
-- history, and the person who made it is the one who should decide whether
-- that power is shared. Defaulting this on would hand it to every admin
-- retroactively, which is not a decision this migration gets to make on
-- somebody's behalf.
-- ---------------------------------------------------------------------------
alter table groups add column if not exists admins_can_delete boolean not null default false;

comment on column groups.admins_can_delete is
  'When false, only the creator can delete the group. When true, admins can too.';

-- ---------------------------------------------------------------------------
-- 4. is_group_admin() has to count the creator.
--
-- Every policy in 03_policies.sql calls this. Without the change, promoting
-- yourself to creator would silently remove your own admin rights everywhere,
-- which is the sort of thing that is only discovered from the outside.
-- ---------------------------------------------------------------------------
create or replace function is_group_admin(gid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from group_members
    where group_id = gid
      and user_id = auth.uid()
      and role in ('admin', 'creator')
  );
$$;

-- ---------------------------------------------------------------------------
-- 5. Promotion and demotion.
--
-- Rules, in the order they are checked:
--   the caller must be an admin or the creator of that group
--   the creator's own row can never be changed by anybody, including them
--   only the creator may hand out or take back 'admin'
--
-- That last one is narrower than it could be. An admin promoting other admins
-- is how a group quietly ends up with six people who can all delete it, and
-- the creator is the only one with a reason to care.
-- ---------------------------------------------------------------------------
create or replace function set_member_role(p_group uuid, p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  target_role text;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  if p_role not in ('member', 'admin') then
    raise exception 'role must be member or admin' using errcode = '22023';
  end if;

  select role into caller_role
  from group_members where group_id = p_group and user_id = auth.uid();

  if caller_role is null then
    raise exception 'not a member of this group' using errcode = '42501';
  end if;

  if caller_role <> 'creator' then
    raise exception 'only the group creator can change roles' using errcode = '42501';
  end if;

  select role into target_role
  from group_members where group_id = p_group and user_id = p_user;

  if target_role is null then
    raise exception 'that person is not in this group' using errcode = '42501';
  end if;

  if target_role = 'creator' then
    raise exception 'the creator role cannot be changed' using errcode = '42501';
  end if;

  update group_members
  set role = p_role
  where group_id = p_group and user_id = p_user;
end;
$$;

revoke all on function set_member_role(uuid, uuid, text) from public;
grant execute on function set_member_role(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. delete_group() respects the toggle.
-- ---------------------------------------------------------------------------
create or replace function delete_group(p_group uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  shared      boolean;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  select role into caller_role
  from group_members where group_id = p_group and user_id = auth.uid();

  select admins_can_delete into shared from groups where id = p_group;

  if caller_role = 'creator' then
    null; -- always allowed
  elsif caller_role = 'admin' and coalesce(shared, false) then
    null; -- allowed because the creator turned it on
  else
    raise exception
      'only the group creator can delete this group. An admin can be allowed to as well, from group settings.'
      using errcode = '42501';
  end if;

  update goals
     set group_id = null
   where group_id = p_group
     and kind = 'personal'
     and owner_id is not null;

  delete from groups where id = p_group;
end;
$$;

revoke all on function delete_group(uuid) from public;
grant execute on function delete_group(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. No member limit.
--
-- join_group refused a seventh person. The cap was a design opinion rather
-- than a constraint the system needed, and it is being lifted. create_group is
-- reproduced below only because create-or-replace needs the whole body; the
-- one change is that the creator is now inserted as 'creator'.
-- ---------------------------------------------------------------------------
create or replace function join_group(p_code text)
returns groups
language plpgsql
security definer
set search_path = public
as $$
declare
  g groups%rowtype;
  n int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  perform ensure_profile();

  select * into g from groups where invite_code = upper(trim(p_code));
  if not found then
    raise exception 'no group with that code';
  end if;

  select count(*) into n from group_members where group_id = g.id;

  insert into group_members (group_id, user_id, nudge_order)
  values (g.id, auth.uid(), n)
  on conflict do nothing;

  perform ensure_cycles(g.id, 2);
  return g;
end;
$$;

create or replace function create_group(
  p_name text,
  p_timezone text default 'UTC',
  p_cadence_days int default 1,
  p_checkin_dow int default 0,
  p_opens_hour int default 0,
  p_window_hours int default 24
)
returns groups
language plpgsql
security definer
set search_path = public
as $$
declare
  code text;
  g    groups%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  perform ensure_profile();

  loop
    code := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6));
    exit when not exists (select 1 from groups where invite_code = code);
  end loop;

  insert into groups (name, invite_code, timezone, cadence_days, checkin_dow,
                      opens_hour, window_hours, created_by)
  values (p_name, code, p_timezone, p_cadence_days, p_checkin_dow,
          p_opens_hour, p_window_hours, auth.uid())
  returning * into g;

  insert into group_members (group_id, user_id, role, nudge_order)
  values (g.id, auth.uid(), 'creator', 0);

  perform ensure_cycles(g.id, 2);
  return g;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. The feed.
--
-- One row per thing worth telling the group about. Only missed goals are
-- written today; the shape is general because a feed with one event type is a
-- log, and the next two entries anybody wants (somebody joined, somebody
-- finished a goal) should not need another table.
--
-- The unique constraint is what makes generation safe to repeat. tick() runs
-- every ten minutes and is expected to; without this, a cycle that closed
-- would produce a fresh "missed" row on every single run.
-- ---------------------------------------------------------------------------
create table if not exists group_feed (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references groups(id)   on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  kind       text not null check (kind in ('missed_goal')),
  goal_id    uuid references goals(id)  on delete cascade,
  cycle_id   uuid references cycles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (group_id, user_id, cycle_id, goal_id, kind)
);

create index if not exists group_feed_group_idx on group_feed (group_id, created_at desc);

alter table group_feed enable row level security;

-- Readable by the group, written by nobody. Every row here is generated by
-- tick(), which is SECURITY DEFINER; there is no legitimate reason for a
-- client to be able to post that somebody missed something.
drop policy if exists group_feed_select on group_feed;
create policy group_feed_select on group_feed for select to authenticated
  using (is_member(group_id));

-- ---------------------------------------------------------------------------
-- 9. Generating the misses.
--
-- Called from tick() as each cycle closes. A goal counts as missed when the
-- day ended and there is no checkin_item recording an outcome for it, unless
-- the person declared themselves away.
--
-- Away is checked first and deliberately: somebody who said in advance that
-- they would not be there has not missed anything, and putting them in the
-- feed for it is the fastest way to make a group feel like surveillance.
-- ---------------------------------------------------------------------------
create or replace function record_missed_goals(c_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c cycles%rowtype;
begin
  select * into c from cycles where id = c_id;
  if not found then return; end if;

  insert into group_feed (group_id, user_id, kind, goal_id, cycle_id)
  select c.group_id, gm.user_id, 'missed_goal', gl.id, c.id
  from group_members gm
  join goals gl
    on gl.group_id = c.group_id
   and gl.status = 'active'
   and (gl.kind = 'group' or gl.owner_id = gm.user_id)
  where not exists (
          select 1 from away_periods ap
          where ap.cycle_id = c.id and ap.user_id = gm.user_id
        )
    and not exists (
          select 1
          from checkins ci
          join checkin_items it on it.checkin_id = ci.id
          where ci.cycle_id = c.id
            and ci.user_id = gm.user_id
            and it.goal_id = gl.id
            and it.outcome in ('done', 'partial')
        )
  on conflict do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. tick() writes the feed as it closes each cycle.
--
-- Reproduced whole because create-or-replace needs the whole body. The only
-- addition is the record_missed_goals call.
-- ---------------------------------------------------------------------------
create or replace function tick()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  g_id uuid;
  c    record;
  prev record;
  m    record;
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

    -- The day ended. Say what did not happen, once.
    perform record_missed_goals(c.id);

    select * into prev
    from cycles
    where group_id = c.group_id and seq = c.seq - 1 and state = 'closed';

    if found then
      for m in select user_id from group_members where group_id = c.group_id loop
        if missed_cycle(m.user_id, c.id) and missed_cycle(m.user_id, prev.id) then
          insert into nudges (group_id, cycle_id, subject_id)
          values (c.group_id, c.id, m.user_id)
          on conflict (cycle_id, subject_id) do nothing;
        end if;
      end loop;
    end if;
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
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. A view the feed can be read from in one request.
--
-- The client needs the person's name and the goal's text, and joining three
-- tables from the browser means three round trips or an embed that RLS has to
-- be trusted to filter correctly on each. security_invoker keeps the caller's
-- policies in force, so this shows exactly the rows group_feed_select allows.
-- ---------------------------------------------------------------------------
create or replace view group_feed_detail
with (security_invoker = on)
as
select
  f.id,
  f.group_id,
  f.user_id,
  f.kind,
  f.goal_id,
  f.cycle_id,
  f.created_at,
  p.display_name,
  p.avatar_url,
  gl.commitment as goal_title
from group_feed f
join profiles p on p.id = f.user_id
left join goals gl on gl.id = f.goal_id;

select tick();

-- Check:
--   select display_name, goal_title, created_at from group_feed_detail
--   order by created_at desc limit 20;

-- ###########################################################################
-- ## 19_budget.sql
-- ###########################################################################

-- ============================================================================
-- The money plan.
--
-- Run after 18. Safe to re-run.
--
-- WHY THIS IS NOT A BUDGETING APP
--
-- The obvious build is envelopes: twelve categories, log every coffee, watch
-- the bars fill. Everyone has tried one. Almost nobody is still using it in
-- March, because it asks for work every single day and pays you back with a
-- pie chart. This app's entire promise is sixty seconds, so a feature that
-- quietly demands five minutes a day would be the thing that makes people
-- stop opening it.
--
-- So the model here is the other one: work out what is genuinely spendable,
-- and say it as a single number. Money in, minus what is already promised to
-- somebody else, minus what you are keeping, divided by the days left in the
-- period. Everything below exists to produce that one number.
--
--   budget_plan   what you earn, what is already spoken for, what you keep
--   budget_fixed  the named commitments, because "bills: 1400" is not a plan
--   budget_entry  what actually happened
--
-- THE PERIOD IS NOT A CALENDAR MONTH
--
-- People are paid on the 1st, or the 15th, or the 28th, and their rent leaves
-- the day after. A budget that resets on the 1st tells someone paid on the
-- 28th that they have four days of money left when they were paid yesterday.
-- So period_start_day is a setting, and the period runs payday to payday.
--
-- It is capped at 28 deliberately. There is no 30th of February, and a period
-- that silently moves depending on the month is a bug that surfaces once a
-- year in the one month people are least able to absorb a wrong number.
--
-- PRIVACY
--
-- This is the most sensitive data in the product by a distance. The rest of
-- the app is built to be seen by four other people; this is built to be seen
-- by nobody. Every policy below is user_id = auth.uid() with no group path,
-- no shared view, and no reporting function. A group member cannot read a row
-- here, and neither can a group creator. That is not a default to be relaxed
-- later, it is the feature.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The plan. One row per person, created on first save.
-- ---------------------------------------------------------------------------
create table if not exists budget_plan (
  user_id              uuid primary key references profiles(id) on delete cascade,

  -- Stored in cents, like every other amount in this codebase, because binary
  -- floating point cannot hold 0.10 and money that drifts is money nobody
  -- trusts. src/lib/money.js already formats from cents.
  currency             text    not null default 'CAD',
  monthly_income_cents bigint  not null default 0 check (monthly_income_cents >= 0),

  -- Pay yourself first. Kept as an amount rather than a percentage: a
  -- percentage re-opens the question every time income changes, and the
  -- answer people actually act on is a number of dollars.
  savings_target_cents bigint  not null default 0 check (savings_target_cents >= 0),

  period_start_day     int     not null default 1  check (period_start_day between 1 and 28),

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Fixed commitments.
--
-- Separate rows rather than one total, because the total is not the useful
-- part. Seeing "streaming 68" written down next to "rent 1400" is the moment
-- the feature does its job.
-- ---------------------------------------------------------------------------
create table if not exists budget_fixed (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  label        text not null check (length(btrim(label)) between 1 and 60),
  amount_cents bigint not null check (amount_cents > 0),

  -- Kept rather than deleted when switched off, so pausing a subscription for
  -- two months does not lose what it was called or what it cost.
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create index if not exists budget_fixed_user_idx on budget_fixed (user_id, active);

-- ---------------------------------------------------------------------------
-- 3. What actually happened.
--
-- Income as well as expense, because the month a bonus or a refund lands is
-- exactly the month the plan is wrong, and a tracker that can only subtract
-- forces people to lie to it.
--
-- Category is nullable and drawn from a short list. A long list is how you
-- get a form nobody fills in; these six cover almost everything and the
-- seventh option is leaving it blank.
-- ---------------------------------------------------------------------------
create table if not exists budget_entry (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  kind         text not null check (kind in ('expense', 'income')),
  amount_cents bigint not null check (amount_cents > 0),
  category     text check (category in ('food','transport','home','fun','health','other')),
  note         text check (note is null or length(note) <= 140),

  -- A date, not a timestamp. Which period a spend belongs to is a question
  -- about the person's own calendar, and storing an instant would push that
  -- into whatever timezone the server happens to be in.
  happened_on  date not null default current_date,
  created_at   timestamptz not null default now()
);

create index if not exists budget_entry_user_date_idx on budget_entry (user_id, happened_on desc);

-- ---------------------------------------------------------------------------
-- 4. Row level security.
--
-- Four policies per table, all the same shape. Written out per command rather
-- than as `for all` so that a later change to one verb cannot silently widen
-- the other three.
-- ---------------------------------------------------------------------------
alter table budget_plan  enable row level security;
alter table budget_fixed enable row level security;
alter table budget_entry enable row level security;

do $$
declare
  t text;
  c text;
begin
  foreach t in array array['budget_plan', 'budget_fixed', 'budget_entry'] loop
    foreach c in array array['select', 'insert', 'update', 'delete'] loop
      execute format('drop policy if exists %I on %I', t || '_' || c, t);

      if c = 'insert' then
        execute format(
          'create policy %I on %I for insert to authenticated with check (user_id = auth.uid())',
          t || '_insert', t);
      elsif c = 'update' then
        execute format(
          'create policy %I on %I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
          t || '_update', t);
      else
        execute format(
          'create policy %I on %I for %s to authenticated using (user_id = auth.uid())',
          t || '_' || c, t, c);
      end if;
    end loop;
  end loop;
end $$;

-- The tables are reachable only through the policies above. Without this the
-- anon and authenticated roles have no privilege at all and every query fails
-- with "permission denied" long before RLS is consulted.
grant select, insert, update, delete on budget_plan, budget_fixed, budget_entry to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Keep updated_at honest.
-- ---------------------------------------------------------------------------
create or replace function budget_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists budget_plan_touch on budget_plan;
create trigger budget_plan_touch before update on budget_plan
  for each row execute function budget_touch();

-- ###########################################################################
-- ## 20_quiet_and_birthdays.sql
-- ###########################################################################

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
