-- ============================================================================
-- Giving every dollar that arrived a job.
--
-- Run after 36. Safe to re-run.
--
-- The money screen has answered one question since migration 19: how much can
-- I spend today. That is an allowance, and an allowance is about pace. It
-- cannot say which of the things you meant to pay for you have already paid
-- and which you have not, because nothing anywhere recorded what each part of
-- the month was FOR.
--
-- This table records that. Income that has actually been logged is handed out
-- across the six spend categories until nothing is left unassigned, and every
-- spend is then measured against the envelope it came out of.
--
-- WHY THE ENVELOPES ARE THE SIX CATEGORIES AND NOT budget_fixed.
--
-- Because a transaction carries a category and carries no link to a named
-- fixed charge. Spent-against-allocated is arithmetic on the first and is
-- impossible on the second: an envelope called "Phone" could be given
-- money and could never be shown as spent, so its bar would be decoration.
-- Envelopes have to be the thing the ledger already files against.
--
-- WHY period_start IS PART OF THE KEY.
--
-- An envelope is a statement about one month. Without the date in the key
-- there would be one row per category forever, August's rent allocation would
-- still be funding September, and money that arrived once would be handed out
-- twice. With it, a new period simply has no rows yet, which is the correct
-- starting state and needs no job to produce it.
--
-- It is the period's first day rather than a month, because this app's period
-- is payday to payday: budget_plan.period_start_day is configurable and a
-- month column would disagree with every other date on the screen.
-- ============================================================================

create table if not exists budget_allocation (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,

  -- The first day of the period this allocation belongs to, as the client
  -- computes it from budget_plan.period_start_day.
  period_start date not null,

  category     text not null check (category in ('food','transport','home','fun','health','other')),

  -- Zero is allowed and is not the same as no row: it is somebody having
  -- deliberately emptied an envelope, which the screen should keep showing.
  amount_cents bigint not null default 0 check (amount_cents >= 0),

  updated_at   timestamptz not null default now(),

  -- One envelope per category per period. Load-bearing: the client upserts on
  -- this, so dragging a number about from two tabs converges instead of
  -- producing two allocations for one category.
  unique (user_id, period_start, category)
);

-- The only query this table has: my envelopes for one period.
create index if not exists budget_allocation_mine_idx
  on budget_allocation (user_id, period_start);

alter table budget_allocation enable row level security;

-- ---------------------------------------------------------------------------
-- Four policies, all the same shape, written out per command rather than as
-- `for all` so that a later change to one verb cannot silently widen the other
-- three. This matches every other budget table; see the note in 19_budget.sql.
--
-- No group path anywhere. What somebody has decided their month is for is not
-- something their accountability group needs.
-- ---------------------------------------------------------------------------
drop policy if exists budget_allocation_select on budget_allocation;
create policy budget_allocation_select on budget_allocation for select to authenticated
  using (user_id = auth.uid());

drop policy if exists budget_allocation_insert on budget_allocation;
create policy budget_allocation_insert on budget_allocation for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists budget_allocation_update on budget_allocation;
create policy budget_allocation_update on budget_allocation for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists budget_allocation_delete on budget_allocation;
create policy budget_allocation_delete on budget_allocation for delete to authenticated
  using (user_id = auth.uid());

notify pgrst, 'reload schema';

-- Check:
--   select period_start, category, amount_cents from budget_allocation
--    order by period_start desc, category;
