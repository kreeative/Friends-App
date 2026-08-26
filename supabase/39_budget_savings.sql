-- ============================================================================
-- The savings ledger. Where the surplus goes.
--
-- Run after 38. Safe to re-run.
--
-- WHY A LEDGER AND NOT A BALANCE COLUMN
--
-- A single savings_balance on budget_plan would answer "how much" and nothing
-- else. It could not answer when, from which month, or whether a given month
-- has already been swept, and without that last one the app cannot offer to
-- sweep a month without risking doing it twice. A ledger answers all four and
-- the balance falls out of it as a sum.
--
-- It also means a deposit can be undone by deleting one row, rather than by
-- somebody arithmetically reversing a running total by hand.
--
-- THE PRIVACY STANCE IS THE ONE FROM 19, UNCHANGED
--
-- 19_budget.sql says this, and it still governs:
--
--   "This is the most sensitive data in the product by a distance. The rest
--    of the app is built to be seen by four other people; this is built to be
--    seen by nobody. Every policy below is user_id = auth.uid() with no group
--    path, no shared view, and no reporting function. That is not a default
--    to be relaxed later, it is the feature."
--
-- How much somebody has managed to put aside is, if anything, more sensitive
-- than what they spent on groceries. So every policy below is user_id =
-- auth.uid() and there is no group path, no shared view and no reporting
-- function. Nothing in 38's project tables can reach this table, and nothing
-- here can reach theirs.
--
-- The benchmark comparison in the app does NOT read anybody else's rows. It
-- compares against published national statistics that ship inside the client
-- bundle (src/lib/benchmarks.js). There is deliberately no aggregate query
-- here: "how do I compare to other users of this app" would require reading
-- other people's savings, and that is exactly what the paragraph above
-- forbids.
--
-- WHAT source MEANS
--
--   plan     the monthly amount somebody set for themselves, moved by hand
--   surplus  what a CLOSED period had left in it, swept in one go
--   manual   anything else, a bonus, a gift, a transfer
--
-- Only 'surplus' rows carry a meaningful period_start, and only those are
-- constrained to one per period. A person may make as many manual deposits in
-- a month as they like; a month can only be swept once, which is what the
-- partial unique index below enforces at the database rather than in a
-- component that can be double-tapped.
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public.budget_saving (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,

  -- The day the money moved. Defaults to today, editable, because somebody
  -- catching up on Sunday is recording Friday's transfer.
  happened_on   date not null default current_date,

  -- Cents, integer, two implied decimals in every currency. Same convention as
  -- budget_entry: see src/lib/currency.js for why the scale never changes.
  -- Non-zero rather than positive: a withdrawal from savings is a real event
  -- and refusing to record it would push people into deleting history instead.
  amount_cents  bigint not null check (amount_cents <> 0),

  source        text not null default 'manual'
                check (source in ('plan', 'surplus', 'manual')),

  -- Which period a surplus came out of. Null for everything else.
  period_start  date,

  note          text check (note is null or char_length(note) <= 140),
  created_at    timestamptz not null default now()
);

-- A surplus row without a period cannot be checked for double-sweeping, and a
-- period on a manual row would claim a month was swept when it was not.
alter table public.budget_saving
  drop constraint if exists budget_saving_period_matches_source;
alter table public.budget_saving
  add constraint budget_saving_period_matches_source
  check (
    (source = 'surplus' and period_start is not null)
    or (source <> 'surplus' and period_start is null)
  );

-- One sweep per period, per person, enforced here rather than in the client.
-- A partial index, so manual deposits are not caught by it.
create unique index if not exists budget_saving_one_sweep_per_period
  on public.budget_saving (user_id, period_start)
  where source = 'surplus';

-- The list is read newest first, always.
create index if not exists budget_saving_user_day
  on public.budget_saving (user_id, happened_on desc);

alter table public.budget_saving enable row level security;

-- Four policies, one shape: it is yours or it does not exist.
drop policy if exists "saving: read own" on public.budget_saving;
create policy "saving: read own"
  on public.budget_saving for select
  using (user_id = auth.uid());

drop policy if exists "saving: insert own" on public.budget_saving;
create policy "saving: insert own"
  on public.budget_saving for insert
  with check (user_id = auth.uid());

drop policy if exists "saving: update own" on public.budget_saving;
create policy "saving: update own"
  on public.budget_saving for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "saving: delete own" on public.budget_saving;
create policy "saving: delete own"
  on public.budget_saving for delete
  using (user_id = auth.uid());

-- No grant to anon. The whole point.
grant select, insert, update, delete on public.budget_saving to authenticated;
