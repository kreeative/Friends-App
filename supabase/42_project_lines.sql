-- ============================================================================
-- What a shared project still has to pay, and a Payer button anybody can press.
--
-- Run after 41. Safe to re-run.
--
-- WHAT WAS MISSING.
--
-- 38 modelled a project as a list of things that HAVE been paid. Every
-- budget_project_entry carries paid_by and an amount, and it is a fact about
-- the past: Tino paid the house, Leo paid the car. That answers "what did
-- Greece cost" and it cannot answer "what do we still owe on it", because
-- nothing in the schema knows about a cost until somebody has already covered
-- it.
--
-- "Ajouter d'abord un budget et ensuite pouvoir marquer paye et ensuite
-- pouvoir designer qui paye et avoir un bouton payer qui s'affiche dessus
-- comme ca n'importe qui peut cliquer qu'il a paye."
--
-- So a project gets a second list: the things it has to pay. A line is a plan.
-- An entry is a fact. The Payer button turns some of a plan into a fact.
--
-- WHY A NEW TABLE AND NOT A `planned` FLAG ON budget_project_entry.
--
-- Because paid_by is NOT NULL and every piece of arithmetic in
-- src/lib/project.js depends on that. Making it nullable to express "nobody
-- has paid this yet" would put rows with no payer into paidByPerson(),
-- balances() and settleUp(), which are what tell four people who owes whom.
-- Those are 49 tested assertions and the failure mode is not a crash, it is a
-- settle-up that is quietly wrong about somebody's money.
--
-- Two tables keeps that boundary exact. Entries stay what they always were, so
-- none of that arithmetic changes at all, and the split is computed from what
-- was actually paid rather than from what somebody typed into a plan.
--
-- WHY A LINE CAN BE EDITED BY ANY MEMBER, AND WHY THAT IS SAFE.
--
-- A trip budget is a shared document. Locking edits to whoever typed the line
-- means the one person who typed 800 instead of 80 is the only person who can
-- fix it, which is how a shared list becomes somebody's chore.
--
-- It is safe because a line moves nobody's money. Who owes whom is computed
-- from entries and only from entries; a line is a to-do. The worst a member
-- can do by editing one is change what the list says is left to pay, which is
-- exactly the thing the list is for.
--
-- Deleting is narrower, because a delete cannot be argued with after the fact:
-- whoever added it, or the project owner.
--
-- WHY line_id ON AN ENTRY IS `on delete set null`.
--
-- Same reason paid_by is `on delete restrict`. Removing a line from the plan
-- must never erase the fact that somebody put money down. The payment survives
-- with its payer and its amount and simply stops being attached to anything,
-- which keeps every balance in the project correct.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. A thing that has to be paid.
-- ---------------------------------------------------------------------------
create table if not exists budget_project_line (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references budget_project(id) on delete cascade,

  -- Who added it. on delete set null: somebody closing their account must not
  -- take the trip's list of costs with them.
  created_by   uuid references profiles(id) on delete set null,

  label        text not null check (length(trim(label)) between 1 and 120),

  -- Free text, deliberately not the personal budget's six categories, for the
  -- reason 38 records: a trip's categories are "logement", "vols", "resto".
  category     text check (category is null or length(category) <= 40),

  amount_cents bigint not null check (amount_cents > 0),

  -- "Designer qui paye". A SUGGESTION, never a lock: the Payer button stays
  -- available to everybody, because the whole request was that anybody can say
  -- they covered something. Somebody being down as the payer and somebody else
  -- actually reaching for their card is the normal case, not an error.
  assigned_to  uuid references profiles(id) on delete set null,

  due_on       date,
  created_at   timestamptz not null default now()
);

create index if not exists budget_project_line_project_idx
  on budget_project_line(project_id, created_at);

-- ---------------------------------------------------------------------------
-- 2. Which line a payment was against, when it was against one.
--
-- Nullable, and it stays nullable forever. "Ajouter une depense" without
-- planning it first is still the fastest way to log the dinner you just paid
-- for, and an entry with no line is that.
-- ---------------------------------------------------------------------------
alter table budget_project_entry
  add column if not exists line_id uuid references budget_project_line(id) on delete set null;

create index if not exists budget_project_entry_line_idx
  on budget_project_entry(line_id);

-- ---------------------------------------------------------------------------
-- 3. Policies.
--
-- Read them against 38's sentence, which has not moved: joining a project
-- grants the right to read rows in THAT project and nothing else. Every clause
-- below is is_project_member(project_id) with no group path and no other door.
-- ---------------------------------------------------------------------------
alter table budget_project_line enable row level security;

drop policy if exists budget_project_line_read on budget_project_line;
create policy budget_project_line_read on budget_project_line
  for select to authenticated
  using (is_project_member(project_id));

-- Anybody in the project can add one. A trip where only the organiser may say
-- "we still owe the deposit" is a trip where nobody says it.
drop policy if exists budget_project_line_insert on budget_project_line;
create policy budget_project_line_insert on budget_project_line
  for insert to authenticated
  with check (is_project_member(project_id) and created_by = auth.uid());

-- See the note at the top: a line moves nobody's money, so any member may fix
-- one. project_id is pinned in the check as well as the using clause, so an
-- update cannot walk a line into a project the caller is not in.
drop policy if exists budget_project_line_update on budget_project_line;
create policy budget_project_line_update on budget_project_line
  for update to authenticated
  using (is_project_member(project_id))
  with check (is_project_member(project_id));

drop policy if exists budget_project_line_delete on budget_project_line;
create policy budget_project_line_delete on budget_project_line
  for delete to authenticated
  using (
    (is_project_member(project_id) and created_by = auth.uid())
    or is_project_owner(project_id)
  );

grant select, insert, update, delete on budget_project_line to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Paying one needs no new function.
--
-- Pressing Payer inserts an ordinary budget_project_entry with line_id set,
-- and 38's insert policy already says the only thing that matters about it:
--
--   is_project_member(project_id) and paid_by = auth.uid()
--
-- You may only ever record a payment as made by YOU. That is what makes the
-- button safe to hand to everybody at once, and it is why there is no
-- pay_line() here: a function would have to re-state the rule, and a rule
-- stated twice is a rule that can disagree with itself.
-- ---------------------------------------------------------------------------

notify pgrst, 'reload schema';

-- Check:
--   select l.label, l.amount_cents,
--          coalesce(sum(e.amount_cents), 0) as paid
--     from budget_project_line l
--     left join budget_project_entry e on e.line_id = l.id
--    group by l.id, l.label, l.amount_cents;
