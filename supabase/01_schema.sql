-- ============================================================================
-- Friends v2 — schema
-- Run this first, then 02_functions.sql, then 03_policies.sql.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user. Mirrors auth.users so we can join to it
-- without granting the client any access to the auth schema.
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url   text,
  timezone     text not null default 'UTC',
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- groups: the accountability circle. The check-in rhythm lives here, not on
-- the user, because the ritual only works if everyone shares one beat.
--   opens_hour / window_hours define the window in the group's timezone:
--   e.g. dow=0, opens_hour=18, window_hours=30 => Sun 18:00 -> Mon 23:59.
-- ---------------------------------------------------------------------------
create table if not exists groups (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(trim(name)) between 1 and 60),
  invite_code   text not null unique,
  timezone      text not null default 'UTC',
  cadence_days  int  not null default 7  check (cadence_days between 1 and 28),
  checkin_dow   int  not null default 0  check (checkin_dow between 0 and 6),
  opens_hour    int  not null default 18 check (opens_hour between 0 and 23),
  window_hours  int  not null default 30 check (window_hours between 1 and 168),
  freeze_grace  int  not null default 0,
  created_by    uuid not null references profiles(id) on delete restrict,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- group_members: membership + the fallback rotation order for nudges.
-- ---------------------------------------------------------------------------
create table if not exists group_members (
  group_id    uuid not null references groups(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  role        text not null default 'member' check (role in ('member','admin')),
  nudge_order int  not null default 0,
  joined_at   timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists group_members_user_idx on group_members(user_id);

-- ---------------------------------------------------------------------------
-- cycles: one row per group per check-in period, materialised in advance.
-- This table is the spine of the app. Because periods are rows rather than
-- date arithmetic, "missed two in a row", "11 of the last 14" and "who has
-- not checked in yet" are all ordinary SQL instead of client-side guesswork.
-- ---------------------------------------------------------------------------
create table if not exists cycles (
  id        uuid primary key default gen_random_uuid(),
  group_id  uuid not null references groups(id) on delete cascade,
  seq       int  not null,
  opens_at  timestamptz not null,
  closes_at timestamptz not null,
  state     text not null default 'upcoming' check (state in ('upcoming','open','closed')),
  unique (group_id, seq)
);

create index if not exists cycles_group_time_idx on cycles(group_id, opens_at desc);
create index if not exists cycles_open_idx on cycles(state, closes_at);

-- ---------------------------------------------------------------------------
-- goals: implementation-intention shaped. owner_id null => shared group goal.
--   status 'paused' is a first-class state, not a soft delete: life happens
--   and the app needs a word for it that isn't failure.
-- ---------------------------------------------------------------------------
create table if not exists goals (
  id               uuid primary key default gen_random_uuid(),
  group_id         uuid not null references groups(id) on delete cascade,
  owner_id         uuid references profiles(id) on delete cascade,
  kind             text not null default 'personal' check (kind in ('personal','group')),
  commitment       text not null check (length(trim(commitment)) between 1 and 200),
  goal_type        text not null default 'process' check (goal_type in ('process','outcome')),
  trigger_when     text,
  trigger_where    text,
  evidence_def     text,
  cadence          text not null default 'recurring' check (cadence in ('once','recurring')),
  target_per_cycle int  not null default 1 check (target_per_cycle between 1 and 50),
  due_on           date,
  starts_on        date not null default current_date,
  ends_on          date,
  status           text not null default 'active' check (status in ('active','paused','completed','abandoned')),
  stake_text       text,
  stake_settled_at timestamptz,
  created_at       timestamptz not null default now(),
  -- personal goals must have an owner; group goals must not.
  constraint goal_owner_matches_kind check (
    (kind = 'personal' and owner_id is not null) or
    (kind = 'group'    and owner_id is null)
  )
);

create index if not exists goals_group_status_idx on goals(group_id, status);
create index if not exists goals_owner_idx on goals(owner_id, status);

-- ---------------------------------------------------------------------------
-- checkins: one submission per person per cycle.
-- The unique constraint is load-bearing for offline sync: the client can
-- replay a queued submission blindly and upsert instead of duplicating.
-- ---------------------------------------------------------------------------
create table if not exists checkins (
  id              uuid primary key default gen_random_uuid(),
  cycle_id        uuid not null references cycles(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  next_commitment text check (length(next_commitment) <= 280),
  note            text check (length(note) <= 500),
  -- How the week felt, as distinct from how it went. Nullable because it is
  -- optional at the point of entry and must stay that way: a required mood
  -- is a mood you lie about.
  mood            text check (mood in (
                    'excited','joyful','grateful','energized',
                    'sensitive','confused','bored','stressed',
                    'angry','insecure','hurt','guilty')),
  submitted_at    timestamptz not null default now(),
  unique (cycle_id, user_id)
);

-- Added after the fact, so existing databases pick it up on re-run.
alter table checkins add column if not exists mood text;

do $$
begin
  alter table checkins add constraint checkins_mood_check check (mood in (
    'excited','joyful','grateful','energized',
    'sensitive','confused','bored','stressed',
    'angry','insecure','hurt','guilty'));
exception
  when duplicate_object then null;
end $$;

create index if not exists checkins_user_idx on checkins(user_id, submitted_at desc);

-- ---------------------------------------------------------------------------
-- checkin_items: per-goal outcome inside a check-in.
--   count_done carries the real answer for recurring goals ("2 of 3"), and
--   outcome is the derived three-state label used for display.
-- ---------------------------------------------------------------------------
create table if not exists checkin_items (
  id         uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references checkins(id) on delete cascade,
  goal_id    uuid not null references goals(id) on delete cascade,
  outcome    text not null check (outcome in ('done','partial','missed')),
  count_done int  not null default 0 check (count_done >= 0),
  evidence   text check (length(evidence) <= 500),
  unique (checkin_id, goal_id)
);

create index if not exists checkin_items_goal_idx on checkin_items(goal_id);

-- ---------------------------------------------------------------------------
-- away_periods: a declared absence. Excluded from the completion-rate
-- denominator and never triggers a nudge — declared absence is not silence.
-- ---------------------------------------------------------------------------
create table if not exists away_periods (
  id         uuid primary key default gen_random_uuid(),
  cycle_id   uuid not null references cycles(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  reason     text check (length(reason) <= 140),
  created_at timestamptz not null default now(),
  unique (cycle_id, user_id)
);

-- ---------------------------------------------------------------------------
-- nudges: the response to silence. Created when someone misses two
-- consecutive cycles. Claimable by anyone; assigned by rotation only as a
-- fallback once nobody has claimed it.
-- ---------------------------------------------------------------------------
create table if not exists nudges (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references groups(id) on delete cascade,
  cycle_id    uuid not null references cycles(id) on delete cascade,
  subject_id  uuid not null references profiles(id) on delete cascade,
  claimed_by  uuid references profiles(id) on delete set null,
  assigned_to uuid references profiles(id) on delete set null,
  state       text not null default 'pending' check (state in ('pending','claimed','done','expired')),
  created_at  timestamptz not null default now(),
  claimed_at  timestamptz,
  closed_at   timestamptz,
  unique (cycle_id, subject_id)
);

create index if not exists nudges_group_state_idx on nudges(group_id, state);

-- ---------------------------------------------------------------------------
-- notifications_log: enforces the hard ceiling of two emails per cycle
-- (one digest, one miss nudge). Nothing sends without claiming a row here.
-- ---------------------------------------------------------------------------
create table if not exists notifications_log (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references profiles(id) on delete cascade,
  cycle_id  uuid not null references cycles(id) on delete cascade,
  kind      text not null check (kind in ('digest','nudge')),
  sent_at   timestamptz not null default now(),
  unique (user_id, cycle_id, kind)
);
