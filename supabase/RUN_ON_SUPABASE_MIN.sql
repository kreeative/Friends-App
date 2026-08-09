alter table groups alter column cadence_days set default 1;
alter table groups alter column opens_hour   set default 0;

alter table groups alter column window_hours set default 24;

update groups
set cadence_days = 1,
    opens_hour   = 0,
    window_hours = 24
where cadence_days is distinct from 1 or opens_hour is distinct from 0;

delete from cycles c
where c.opens_at > now()
  and not exists (select 1 from checkins     k where k.cycle_id = c.id)
  and not exists (select 1 from away_periods a where a.cycle_id = c.id)
  and not exists (select 1 from nudges       n where n.cycle_id = c.id);

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

update cycles c
set closes_at = (((c.opens_at at time zone g.timezone)::date + 1)::timestamp)
                at time zone g.timezone
from groups g
where g.id = c.group_id
  and c.opens_at <= now()
  and c.closes_at > now();

delete from cycles c
where c.opens_at > now()
  and not exists (select 1 from checkins     k where k.cycle_id = c.id)
  and not exists (select 1 from away_periods a where a.cycle_id = c.id)
  and not exists (select 1 from nudges       n where n.cycle_id = c.id);

alter table group_members drop constraint if exists group_members_role_check;
alter table group_members add constraint group_members_role_check
  check (role in ('member', 'admin', 'creator'));

update group_members gm
set role = 'creator'
from groups g
where g.id = gm.group_id
  and g.created_by = gm.user_id
  and gm.role <> 'creator';

create unique index if not exists group_members_one_creator_idx
  on group_members (group_id) where role = 'creator';

alter table groups add column if not exists admins_can_delete boolean not null default false;

comment on column groups.admins_can_delete is
  'When false, only the creator can delete the group. When true, admins can too.';

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

drop policy if exists group_feed_select on group_feed;
create policy group_feed_select on group_feed for select to authenticated
  using (is_member(group_id));

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

create table if not exists budget_plan (
  user_id              uuid primary key references profiles(id) on delete cascade,

  currency             text    not null default 'CAD',
  monthly_income_cents bigint  not null default 0 check (monthly_income_cents >= 0),

  savings_target_cents bigint  not null default 0 check (savings_target_cents >= 0),

  period_start_day     int     not null default 1  check (period_start_day between 1 and 28),

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists budget_fixed (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  label        text not null check (length(btrim(label)) between 1 and 60),
  amount_cents bigint not null check (amount_cents > 0),

  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create index if not exists budget_fixed_user_idx on budget_fixed (user_id, active);

create table if not exists budget_entry (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  kind         text not null check (kind in ('expense', 'income')),
  amount_cents bigint not null check (amount_cents > 0),
  category     text check (category in ('food','transport','home','fun','health','other')),
  note         text check (note is null or length(note) <= 140),

  happened_on  date not null default current_date,
  created_at   timestamptz not null default now()
);

create index if not exists budget_entry_user_date_idx on budget_entry (user_id, happened_on desc);

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

grant select, insert, update, delete on budget_plan, budget_fixed, budget_entry to authenticated;

create or replace function budget_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists budget_plan_touch on budget_plan;
create trigger budget_plan_touch before update on budget_plan
  for each row execute function budget_touch();

delete from nudges where state in ('pending', 'claimed');

delete from group_feed gf
using cycles c
where gf.cycle_id = c.id
  and c.closes_at < gf.created_at - interval '1 day';

alter table profiles add column if not exists birthday date;

alter table profiles add column if not exists has_seen_budget_intro boolean not null default false;

alter table group_feed drop constraint if exists group_feed_kind_check;
alter table group_feed add constraint group_feed_kind_check
  check (kind in ('missed_goal', 'birthday'));

alter table group_feed add column if not exists day date;

create unique index if not exists group_feed_birthday_uniq
  on group_feed (group_id, user_id, kind, day)
  where kind = 'birthday';

create or replace function days_silent(p_user uuid, p_group uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  with last_act as (
    select max(x.at) as at from (
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
    if m.account_created > now() - interval '14 days' then continue; end if;
    if m.joined_at      > now() - interval '14 days' then continue; end if;

    if days_silent(m.user_id, p_group) < 14 then continue; end if;

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
