-- ============================================================================
-- Friends v2 — functions, triggers, views
-- Run after 01_schema.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- is_member(): the keystone of every RLS policy in 03_policies.sql.
--
-- It MUST be SECURITY DEFINER. A policy on group_members that itself selects
-- from group_members recurses infinitely; running the lookup as the definer
-- bypasses RLS for that one narrow question ("is this user in this group?")
-- and breaks the cycle. search_path is pinned so the function can't be
-- hijacked by a caller-controlled schema.
-- ---------------------------------------------------------------------------
create or replace function is_member(gid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

create or replace function is_group_admin(gid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from group_members
    where group_id = gid and user_id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Profile bootstrap: every auth user gets a profile row automatically.
-- ---------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(coalesce(new.email, 'friend'), '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- The trigger above only fires for people who sign up AFTER this file has
-- been run. Anyone who signed up while the database was still empty has an
-- auth user and no profile row — and every other table keys off profiles, so
-- for them the app fails at the first write with a foreign key violation:
--
--   insert or update on table "groups" violates foreign key constraint
--   "groups_created_by_fkey"
--
-- which is what "I cannot create a group" looks like from the outside. Goals
-- and check-ins would fail the same way for the same reason.
--
-- ensure_profile() closes the hole at call time; the backfill below closes it
-- for accounts that already exist. Both are idempotent, so re-running this
-- file is the repair.
-- ---------------------------------------------------------------------------
create or replace function ensure_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, display_name, avatar_url)
  select
    u.id,
    coalesce(
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'name',
      split_part(coalesce(u.email, 'friend'), '@', 1)
    ),
    u.raw_user_meta_data->>'avatar_url'
  from auth.users u
  where u.id = auth.uid()
  on conflict (id) do nothing;
end;
$$;

insert into profiles (id, display_name, avatar_url)
select
  u.id,
  coalesce(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    split_part(coalesce(u.email, 'friend'), '@', 1)
  ),
  u.raw_user_meta_data->>'avatar_url'
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Cycle generation.
--
-- The anchor is the first check-in slot at/after the group was created,
-- expressed in the group's local timezone. Later cycles are derived by adding
-- whole days to the LOCAL timestamp before converting back, so a group does
-- not drift by an hour when daylight saving changes.
-- ---------------------------------------------------------------------------
create or replace function ensure_cycles(gid uuid, ahead int default 4)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  g            groups%rowtype;
  anchor_local timestamp;
  base_date    date;
  dow_offset   int;
  next_seq     int;
  opens_local  timestamp;
  future_count int;
begin
  select * into g from groups where id = gid;
  if not found then return; end if;

  base_date  := (g.created_at at time zone g.timezone)::date;
  dow_offset := (g.checkin_dow - extract(dow from base_date)::int + 7) % 7;
  anchor_local := (base_date + dow_offset)::timestamp + make_interval(hours => g.opens_hour);

  select coalesce(max(seq) + 1, 0) into next_seq from cycles where group_id = gid;

  select count(*) into future_count
  from cycles where group_id = gid and closes_at > now();

  -- Top up until there are `ahead` cycles still in the future.
  while future_count < ahead loop
    opens_local := anchor_local + make_interval(days => g.cadence_days * next_seq);

    insert into cycles (group_id, seq, opens_at, closes_at, state)
    values (
      gid,
      next_seq,
      opens_local at time zone g.timezone,
      (opens_local + make_interval(hours => g.window_hours)) at time zone g.timezone,
      'upcoming'
    )
    on conflict (group_id, seq) do nothing;

    if (opens_local + make_interval(hours => g.window_hours)) at time zone g.timezone > now() then
      future_count := future_count + 1;
    end if;
    next_seq := next_seq + 1;

    -- Safety valve for a group created long ago: never loop forever.
    if next_seq > 5000 then exit; end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- missed_cycle(): a cycle counts as missed only if the person neither
-- submitted nor declared themselves away.
-- ---------------------------------------------------------------------------
create or replace function missed_cycle(uid uuid, cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (select 1 from checkins     where cycle_id = cid and user_id = uid)
     and not exists (select 1 from away_periods where cycle_id = cid and user_id = uid);
$$;

-- ---------------------------------------------------------------------------
-- tick(): the scheduled heartbeat. Idempotent, so it is safe to run from
-- pg_cron every 10 minutes AND to call opportunistically from the client on
-- app open (which keeps a group ticking even if cron is not set up yet).
--
--   1. top up future cycles for every group
--   2. move cycles upcoming -> open -> closed
--   3. on close, create a nudge for anyone now at two consecutive misses
--   4. hand unclaimed nudges to the rotation after 24h
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
    perform ensure_cycles(g_id, 4);
  end loop;

  update cycles set state = 'open'
  where state = 'upcoming' and opens_at <= now() and closes_at > now();

  -- Close each newly-finished cycle and evaluate silence for it.
  for c in
    select * from cycles
    where state in ('open', 'upcoming') and closes_at <= now()
  loop
    update cycles set state = 'closed' where id = c.id;

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

  -- Fallback rotation: only after nobody volunteered for a full day.
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
-- create_group() / join_group(): membership bootstrap.
--
-- Both are SECURITY DEFINER for the same reason: at the moment of the call
-- the user is not yet a member, so no RLS policy could let them insert the
-- row or look the group up by code. Confining that to two narrow functions is
-- what lets the groups table stay closed to non-members.
-- ---------------------------------------------------------------------------
create or replace function create_group(
  p_name text,
  p_timezone text default 'UTC',
  p_cadence_days int default 7,
  p_checkin_dow int default 0,
  p_opens_hour int default 18,
  p_window_hours int default 30
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
  -- Belt as well as braces: the backfill in this file repairs accounts that
  -- already exist, this covers anyone whose profile went missing since.
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
  values (g.id, auth.uid(), 'admin', 0);

  perform ensure_cycles(g.id, 4);
  return g;
end;
$$;

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
  if n >= 6 then
    raise exception 'this group is full (6 people max)';
  end if;

  insert into group_members (group_id, user_id, nudge_order)
  values (g.id, auth.uid(), n)
  on conflict do nothing;

  perform ensure_cycles(g.id, 4);
  return g;
end;
$$;

-- ---------------------------------------------------------------------------
-- submit_checkin(): one atomic write for a whole check-in.
--
-- Upsert semantics on (cycle_id, user_id) mean the offline queue can replay a
-- submission as many times as it likes without creating duplicates — the
-- client never has to reason about whether the first attempt got through.
-- SECURITY INVOKER (the default) so the RLS policies still apply.
-- ---------------------------------------------------------------------------
create or replace function submit_checkin(
  p_cycle_id uuid,
  p_next_commitment text,
  p_note text,
  p_items jsonb
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  cid  uuid;
  item jsonb;
begin
  insert into checkins (cycle_id, user_id, next_commitment, note)
  values (p_cycle_id, auth.uid(), p_next_commitment, p_note)
  on conflict (cycle_id, user_id) do update
    set next_commitment = excluded.next_commitment,
        note            = excluded.note,
        submitted_at    = now()
  returning id into cid;

  for item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    insert into checkin_items (checkin_id, goal_id, outcome, count_done, evidence)
    values (
      cid,
      (item->>'goal_id')::uuid,
      item->>'outcome',
      coalesce((item->>'count_done')::int, 0),
      item->>'evidence'
    )
    on conflict (checkin_id, goal_id) do update
      set outcome    = excluded.outcome,
          count_done = excluded.count_done,
          evidence   = excluded.evidence;
  end loop;

  return cid;
end;
$$;

-- ---------------------------------------------------------------------------
-- claim_nudge(): reaching out is volunteered, not assigned.
-- ---------------------------------------------------------------------------
create or replace function claim_nudge(p_nudge_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  n nudges%rowtype;
begin
  select * into n from nudges where id = p_nudge_id;
  if not found then raise exception 'no such nudge'; end if;
  if not is_member(n.group_id) then raise exception 'not a member'; end if;
  if n.subject_id = auth.uid() then raise exception 'cannot claim your own'; end if;

  update nudges
  set claimed_by = auth.uid(), claimed_at = now(), state = 'claimed'
  where id = p_nudge_id and state = 'pending';
end;
$$;

-- ---------------------------------------------------------------------------
-- member_cycle_status: the one view the UI reads for history, the live board
-- and the completion rate. security_invoker keeps the caller's RLS in force —
-- without it the view would leak every group's data to every user.
-- ---------------------------------------------------------------------------
create or replace view member_cycle_status
with (security_invoker = on)
as
select
  c.group_id,
  gm.user_id,
  c.id   as cycle_id,
  c.seq,
  c.opens_at,
  c.closes_at,
  c.state,
  case
    when ci.id is not null then 'submitted'
    when ap.id is not null then 'away'
    when c.state = 'closed' then 'missed'
    else 'pending'
  end as status
from cycles c
join group_members gm  on gm.group_id = c.group_id
left join checkins ci  on ci.cycle_id = c.id and ci.user_id = gm.user_id
left join away_periods ap on ap.cycle_id = c.id and ap.user_id = gm.user_id;

-- ---------------------------------------------------------------------------
-- Scheduled heartbeat. Requires the pg_cron extension (Database > Extensions).
-- Without this, nothing happens while the group is not looking — which is
-- exactly when someone goes quiet.
-- ---------------------------------------------------------------------------
-- create extension if not exists pg_cron;
-- select cron.schedule('friends-tick', '*/10 * * * *', $$select tick()$$);
