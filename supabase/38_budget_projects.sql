-- ============================================================================
-- Shared, ephemeral budgets. "Vacances Grece", "Chalet janvier", "Le char".
--
-- Run after 37. Safe to re-run.
--
-- WHY THIS IS A SEPARATE TABLE AND NOT A FLAG ON budget_plan
--
-- 19_budget.sql says this, and it was not decoration:
--
--   "This is the most sensitive data in the product by a distance. The rest
--    of the app is built to be seen by four other people; this is built to be
--    seen by nobody. Every policy below is user_id = auth.uid() with no group
--    path, no shared view, and no reporting function. That is not a default
--    to be relaxed later, it is the feature."
--
-- Adding people to a budget is exactly the relaxation that warning is about.
-- So nothing here touches budget_plan, budget_entry, budget_fixed or
-- budget_allocation. There is no join between the two halves, no view that
-- spans them, and no function that reads one while writing the other. Your
-- salary, your rent and your groceries stay invisible to everybody, and what
-- a friend can see is only what was put into a project they were invited to.
--
-- The practical test: if somebody joins your Greece project, the only rows
-- they gain the right to read are rows in THAT project. Run the policies
-- below against that sentence and they should all obviously satisfy it.
--
-- WHY EPHEMERAL
--
-- A holiday ends. A personal budget is a standing arrangement that resets
-- every payday, which is why 19 models it as a plan plus a period; a project
-- is a thing with a beginning, an end and a total, and then it is over. So
-- these carry starts_on/ends_on and an archived flag rather than a period,
-- and none of the period arithmetic in src/lib/budget.js applies to them.
--
-- WHO PAID WHAT
--
-- The request was "Tino paye la maison, Leo paye la voiture". That is not a
-- category, it is a payer, so every entry carries paid_by. What each person
-- OWES is a separate question, answered by their share weight, and the gap
-- between paid and owed is the settle-up. All of that arithmetic is in
-- src/lib/project.js where it can be tested; this file only stores the facts
-- it is computed from.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The project.
-- ---------------------------------------------------------------------------
create table if not exists budget_project (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references profiles(id) on delete cascade,

  name         text not null check (length(trim(name)) between 1 and 60),

  -- Its own currency. A trip is very often not in the currency you are paid
  -- in, and forcing the personal budget's currency onto it would mean typing
  -- euros into a field labelled dollars.
  currency     text not null default 'CAD',

  -- What the whole thing is meant to cost. Zero means "no target set", which
  -- is different from a target of zero and is why this is not null.
  target_cents bigint not null default 0 check (target_cents >= 0),

  starts_on    date,
  ends_on      date,

  -- Same shape as groups.invite_code. Sharing a project is the same gesture
  -- as joining a group, so it is the same mechanism rather than a second one.
  invite_code  text not null unique,

  -- Ephemeral means it ends, not that it is deleted. The numbers are worth
  -- keeping: "what did Greece actually cost" is the question you ask next
  -- time you plan a trip.
  archived     boolean not null default false,

  created_at   timestamptz not null default now()
);

create index if not exists budget_project_owner_idx on budget_project(owner_id);

-- ---------------------------------------------------------------------------
-- 2. Who is in it.
-- ---------------------------------------------------------------------------
create table if not exists budget_project_member (
  project_id uuid not null references budget_project(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,

  -- Weight for the fair split, in shares. Everybody defaults to 1.
  --
  -- An integer weight rather than a percentage, because percentages have to
  -- add to a hundred and therefore all change whenever one person joins or
  -- leaves. Weights do not: adding a fifth person to four ones just makes the
  -- denominator five. It also expresses the case that actually comes up,
  -- which is "Tino brought his family so he counts for three", without
  -- inventing a second concept for it.
  --
  -- Zero is allowed on purpose: somebody can be in the project, able to see
  -- it and log what they paid, while owing none of it.
  share      int not null default 1 check (share between 0 and 100),

  joined_at  timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists budget_project_member_user_idx
  on budget_project_member(user_id);

-- ---------------------------------------------------------------------------
-- 3. What was spent, and by whom.
-- ---------------------------------------------------------------------------
create table if not exists budget_project_entry (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references budget_project(id) on delete cascade,

  -- on delete restrict, not cascade. Deleting a person must not silently
  -- rewrite what a trip cost and leave four other people with balances that
  -- no longer add up.
  paid_by      uuid not null references profiles(id) on delete restrict,

  amount_cents bigint not null check (amount_cents > 0),
  label        text check (label is null or length(label) <= 120),

  -- Free text, deliberately not the personal budget's six categories. Those
  -- are the categories of a life; a trip's are "logement", "vols", "resto",
  -- and constraining them to the other set would produce six wrong answers.
  category     text check (category is null or length(category) <= 40),

  happened_on  date not null default current_date,
  created_at   timestamptz not null default now()
);

create index if not exists budget_project_entry_project_idx
  on budget_project_entry(project_id, happened_on desc);

-- ---------------------------------------------------------------------------
-- 4. The membership lookup, SECURITY DEFINER for the reason 02_functions.sql
--    records: a policy on budget_project_member that itself selects from
--    budget_project_member recurses forever. Running this one narrow question
--    as the definer breaks the cycle. search_path is pinned so the function
--    cannot be hijacked by a caller-controlled schema.
-- ---------------------------------------------------------------------------
create or replace function is_project_member(pid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from budget_project_member
    where project_id = pid and user_id = auth.uid()
  );
$$;

create or replace function is_project_owner(pid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from budget_project
    where id = pid and owner_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- 5. Joining by code.
--
-- A function rather than an INSERT policy on the member table. To join by
-- code you must be able to find the project by its code, and any policy that
-- lets you SELECT a project you are not yet in also lets you enumerate other
-- people's projects. The function looks the code up as the definer, inserts
-- exactly one row, and returns the project id; the caller never gets a read
-- of anything they did not already have.
-- ---------------------------------------------------------------------------
create or replace function join_budget_project(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  select id into pid
    from budget_project
   where invite_code = code and archived = false;

  if pid is null then
    raise exception 'no such project';
  end if;

  insert into budget_project_member (project_id, user_id)
  values (pid, auth.uid())
  on conflict (project_id, user_id) do nothing;

  return pid;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Policies.
--
-- Read the whole section against one sentence: joining a project must grant
-- the right to read rows in THAT project and nothing else.
-- ---------------------------------------------------------------------------
alter table budget_project        enable row level security;
alter table budget_project_member enable row level security;
alter table budget_project_entry  enable row level security;

-- The project itself. Members read it; only the owner changes or deletes it.
drop policy if exists budget_project_read on budget_project;
create policy budget_project_read on budget_project
  for select using (is_project_member(id) or owner_id = auth.uid());

drop policy if exists budget_project_insert on budget_project;
create policy budget_project_insert on budget_project
  for insert with check (owner_id = auth.uid());

drop policy if exists budget_project_update on budget_project;
create policy budget_project_update on budget_project
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists budget_project_delete on budget_project;
create policy budget_project_delete on budget_project
  for delete using (owner_id = auth.uid());

-- Membership. Everybody in a project can see who else is in it, which is not
-- optional: a split you cannot see the participants of is not a split.
drop policy if exists budget_project_member_read on budget_project_member;
create policy budget_project_member_read on budget_project_member
  for select using (is_project_member(project_id) or is_project_owner(project_id));

-- Joining goes through join_budget_project(). The only INSERT allowed
-- directly is the owner adding themselves, which is what happens on the
-- round trip that creates a project.
drop policy if exists budget_project_member_insert on budget_project_member;
create policy budget_project_member_insert on budget_project_member
  for insert with check (
    is_project_owner(project_id) and user_id = auth.uid()
  );

-- The owner sets share weights. Nobody gets to quietly reduce their own.
drop policy if exists budget_project_member_update on budget_project_member;
create policy budget_project_member_update on budget_project_member
  for update using (is_project_owner(project_id))
  with check (is_project_owner(project_id));

-- You can always leave. The owner can remove anybody.
drop policy if exists budget_project_member_delete on budget_project_member;
create policy budget_project_member_delete on budget_project_member
  for delete using (user_id = auth.uid() or is_project_owner(project_id));

-- Entries. Any member reads them all, because the total is the point.
drop policy if exists budget_project_entry_read on budget_project_entry;
create policy budget_project_entry_read on budget_project_entry
  for select using (is_project_member(project_id));

-- You may only log something as paid by YOU. Recording that somebody else
-- paid for something is how a shared ledger becomes an argument.
drop policy if exists budget_project_entry_insert on budget_project_entry;
create policy budget_project_entry_insert on budget_project_entry
  for insert with check (
    is_project_member(project_id) and paid_by = auth.uid()
  );

drop policy if exists budget_project_entry_update on budget_project_entry;
create policy budget_project_entry_update on budget_project_entry
  for update using (is_project_member(project_id) and paid_by = auth.uid())
  with check (is_project_member(project_id) and paid_by = auth.uid());

-- The owner can delete anything in their own project, so a project can be
-- tidied up by the person responsible for it. Everybody else, only their own.
drop policy if exists budget_project_entry_delete on budget_project_entry;
create policy budget_project_entry_delete on budget_project_entry
  for delete using (
    (is_project_member(project_id) and paid_by = auth.uid())
    or is_project_owner(project_id)
  );

notify pgrst, 'reload schema';

-- Check:
--   select name, currency, target_cents, archived from budget_project;
--   select project_id, user_id, share from budget_project_member;
