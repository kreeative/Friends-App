-- ============================================================================
-- Inviting somebody to a shared budget from inside the app.
--
-- Run after 40. Safe to re-run.
--
-- WHAT WAS MISSING.
--
-- 38 gave a project an invite_code and join_budget_project(code). That works
-- and it assumes you leave the app to use it: copy the code, open a messaging
-- app, paste, and hope they come back. The code stays, because it is the only
-- way to reach somebody who is not in any of your groups yet.
--
-- This adds the other half: pick a person you already share a group with, and
-- they find the invitation waiting in their own budget.
--
-- WHY THE INVITE LIST IS RESTRICTED TO PEOPLE YOU SHARE A GROUP WITH.
--
-- Not a nicety. Without it, invite_to_project() takes an arbitrary user id and
-- becomes a way to put your name in front of any account in the database,
-- which is a spam vector and a way to confirm that a given id exists. The
-- check is the same group_members join that 03_policies already uses to decide
-- who may read a profile, so the set of people you can invite is exactly the
-- set of people the app already lets you see.
--
-- That restriction pays a second dividend. Because the inviter is always a
-- group-mate, the invitee can already read their profile under the existing
-- policy, so "Ann added you to Afro Nation" needs no new read of anything.
--
-- WHY NO POLICY IS RELAXED, NOT EVEN BY A HAIR.
--
-- 38 says: "if somebody joins your Greece project, the only rows they gain the
-- right to read are rows in THAT project." An invitation looks like it has to
-- bend that, because a person cannot decide whether to accept something they
-- cannot see the name of.
--
-- It does not. The first draft of this file widened budget_project_read with a
-- clause for pending invitees, and that clause would have handed them the
-- whole row: currency, target, dates, and invite_code. Somebody could be
-- invited, read the join code, decline, and still hold a working key to the
-- project forever.
--
-- So instead there is my_project_invites(), a SECURITY DEFINER function that
-- returns the four things needed to answer yes or no: who asked, what it is
-- called, its currency, and when. No id you did not already have, no code, no
-- policy touched. 38's sentence stands word for word.
--
-- The entries and the member list stay unreadable until you actually join,
-- which was true before this file and is still true after it.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The invitation.
-- ---------------------------------------------------------------------------
create table if not exists budget_project_invite (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references budget_project(id) on delete cascade,
  invited_user uuid not null references profiles(id) on delete cascade,

  -- Who asked. The invitation says a person's name rather than a project's,
  -- because "Ann added you to Afro Nation" is a different thing to receive
  -- from "you have been added to Afro Nation".
  --
  -- on delete set null rather than cascade: somebody closing their account must
  -- not silently withdraw invitations other people are still deciding on.
  invited_by   uuid references profiles(id) on delete set null,

  state        text not null default 'pending'
               check (state in ('pending', 'accepted', 'declined')),

  created_at   timestamptz not null default now(),
  answered_at  timestamptz,

  constraint budget_project_invite_answered
    check ((state = 'pending') = (answered_at is null))
);

-- One live invitation per person per project. Partial, so declining and being
-- invited again later is allowed: a no in January is not a no forever.
create unique index if not exists budget_project_invite_one_pending
  on budget_project_invite (project_id, invited_user)
  where state = 'pending';

-- The only read this table has: what is waiting for me.
create index if not exists budget_project_invite_mine
  on budget_project_invite (invited_user, state);

alter table budget_project_invite enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Who may see an invitation.
--
-- The person it names, and the owner of the project who sent it. Nobody else,
-- including the other members of the project: whether Leo turned you down is
-- between Leo and whoever asked.
--
-- The invitee's own read is what drives the badge; the actual card is drawn
-- from my_project_invites() below, because the row on its own is a project id
-- and a person id and neither of those is a sentence anybody can read.
-- ---------------------------------------------------------------------------
drop policy if exists budget_project_invite_read on budget_project_invite;
create policy budget_project_invite_read on budget_project_invite
  for select to authenticated
  using (invited_user = auth.uid() or is_project_owner(project_id));

-- No insert or update policy at all. Both go through the functions below, for
-- the reason 38 gives about joining by code: a direct insert policy would have
-- to be written in terms of a project the caller can already see, and getting
-- that wrong is how a table like this becomes a way to enumerate accounts.

-- The owner may withdraw one they sent while it is still unanswered. Not after:
-- an answered invitation is the record of somebody's decision, and the person
-- who asked does not get to delete the no.
drop policy if exists budget_project_invite_delete on budget_project_invite;
create policy budget_project_invite_delete on budget_project_invite
  for delete to authenticated
  using (is_project_owner(project_id) and state = 'pending');

grant select, delete on budget_project_invite to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Sending one.
--
-- SECURITY DEFINER because it has to look at group_members for two different
-- people, and a caller cannot be given that read directly without also being
-- given the ability to walk the graph.
-- ---------------------------------------------------------------------------
create or replace function invite_to_project(p_project uuid, p_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  if not is_project_owner(p_project) then
    raise exception 'only the owner can invite';
  end if;

  if p_user = auth.uid() then
    raise exception 'you are already in this project';
  end if;

  -- The whole point of the restriction. See the note at the top.
  if not exists (
    select 1
      from group_members mine
      join group_members theirs on theirs.group_id = mine.group_id
     where mine.user_id = auth.uid()
       and theirs.user_id = p_user
  ) then
    raise exception 'you do not share a group with that person';
  end if;

  if exists (
    select 1 from budget_project_member
     where project_id = p_project and user_id = p_user
  ) then
    raise exception 'they are already in this project';
  end if;

  if exists (select 1 from budget_project where id = p_project and archived) then
    raise exception 'that project is archived';
  end if;

  insert into budget_project_invite (project_id, invited_user, invited_by)
  values (p_project, p_user, auth.uid())
  on conflict do nothing
  returning id into inv;

  -- Already pending. Not an error: pressing invite twice is an ordinary thing
  -- to do and should be quiet rather than shouting about a duplicate.
  if inv is null then
    select id into inv
      from budget_project_invite
     where project_id = p_project and invited_user = p_user and state = 'pending';
  end if;

  return inv;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Reading what is waiting for you.
--
-- Four columns and an id, and that is the entire widening of anybody's read.
-- Not invite_code, which is the one field on budget_project that would survive
-- a decline as a working key. Not target_cents or the dates either, because
-- what a trip is budgeted at is a fact about the people already in it.
--
-- STABLE, so it can sit in a select list without being re-planned per row.
-- ---------------------------------------------------------------------------
create or replace function my_project_invites()
returns table (
  invite_id       uuid,
  project_id      uuid,
  project_name    text,
  project_currency text,
  invited_by      uuid,
  created_at      timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select i.id, p.id, p.name, p.currency, i.invited_by, i.created_at
    from budget_project_invite i
    join budget_project p on p.id = i.project_id
   where i.invited_user = auth.uid()
     and i.state = 'pending'
     and p.archived = false
   order by i.created_at desc;
$$;

-- ---------------------------------------------------------------------------
-- 5. Answering one.
--
-- Accepting inserts the membership here rather than leaving it to the client,
-- so "I accepted and nothing happened" cannot be two round trips with a
-- failure between them.
-- ---------------------------------------------------------------------------
create or replace function respond_to_project_invite(p_invite uuid, p_accept boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv budget_project_invite%rowtype;
begin
  select * into inv from budget_project_invite where id = p_invite;
  if not found then
    raise exception 'no such invitation';
  end if;
  if inv.invited_user <> auth.uid() then
    raise exception 'that invitation is not yours';
  end if;
  if inv.state <> 'pending' then
    raise exception 'that invitation has already been answered';
  end if;

  -- Archived between the ask and the answer. Declining stays open, because
  -- clearing a card you no longer want must always work; joining does not,
  -- for the same reason join_budget_project refuses an archived code.
  if p_accept and exists (
    select 1 from budget_project where id = inv.project_id and archived
  ) then
    raise exception 'that project is archived';
  end if;

  update budget_project_invite
     set state = case when p_accept then 'accepted' else 'declined' end,
         answered_at = now()
   where id = p_invite;

  if p_accept then
    insert into budget_project_member (project_id, user_id)
    values (inv.project_id, auth.uid())
    on conflict (project_id, user_id) do nothing;
  end if;

  return inv.project_id;
end;
$$;

notify pgrst, 'reload schema';

-- Check:
--   select * from my_project_invites();
--   select project_id, invited_user, state from budget_project_invite;
