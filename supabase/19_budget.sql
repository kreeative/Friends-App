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
