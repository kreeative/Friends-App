-- ============================================================================
-- Telling the group that somebody added a shared goal.
--
-- Run after 49. Safe to re-run.
--
-- THE SCHEMA DID NOT KNOW WHO ADDED IT.
--
-- A group goal has owner_id null, by a check constraint, because it belongs to
-- everybody rather than to one person. That is right, and it means the row has
-- never recorded who created it. The message this is for says "[name] a ajoute
-- un nouvel objectif commun", so the name has to come from somewhere, and
-- there was nowhere. Hence created_by.
--
-- It is deliberately NOT owner_id under another name. owner_id means "this is
-- whose goal it is" and drives the check constraint and the digest query;
-- created_by means "this is who typed it" and drives nothing except the
-- sentence in the email. Reusing the first for the second would quietly turn
-- every shared goal into somebody's personal one.
--
-- WHY A TRIGGER RATHER THAN THE CLIENT INSERTING THE ROWS.
--
-- The notification has to reach every member, and a client can only write rows
-- it is allowed to write. Letting the browser insert into another person's
-- inbox is the same shape of hole as letting it grant its own entitlement, and
-- 05_library.sql already refused that. A trigger runs inside the same
-- transaction as the goal: if the goal exists, the notifications exist, and if
-- the insert rolls back so do they.
--
-- WHY THE INBOX IS NOT notifications_log.
--
-- notifications_log is not a log and not an inbox, it is the ceiling: one row
-- per person per cycle per kind, claimed before anything is sent, which is
-- what makes a duplicate physically impossible. It has no title, no body and
-- no read state, and it must not grow any, because everything in it is load
-- bearing on that unique constraint.
--
-- So `notification` is a separate table, and the two do different jobs: this
-- one is what a person reads, that one is what stops the sender running twice.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Who typed it.
--
-- Nullable, and every reader has to cope with null. Every group goal created
-- before this migration has no creator recorded and there is no way to find
-- one, so the copy falls back to a version with no name rather than inventing
-- one. That is the same rule the nudge email already follows for claimed_by.
--
-- The default fires for inserts that do not name it, which is all of them:
-- nothing in the client sends this column and nothing needs to.
-- ---------------------------------------------------------------------------
alter table goals add column if not exists created_by uuid references profiles(id) on delete set null;

do $$
begin
  -- Separate from the add, because `add column if not exists` skips the whole
  -- statement including its default when the column is already there, so a
  -- re-run on a half-applied database would leave the default unset.
  alter table goals alter column created_by set default auth.uid();
exception
  -- A database with no auth schema, which is any local Postgres used for
  -- testing. The column still works, it just records nothing by itself.
  when undefined_function or invalid_schema_name then
    raise notice 'auth.uid() not available, created_by has no default here';
end $$;

-- ---------------------------------------------------------------------------
-- 2. The inbox.
--
-- One row is one thing a person should see, in their own language, already
-- rendered. The alternative is storing a kind plus a bag of ids and rendering
-- at read time, which means the app has to know how to phrase every message
-- that has ever existed, forever, including the ones it no longer sends.
--
-- emailed_at is what stops the same news going out twice by two routes. The
-- sender picks up rows where it is null; everything else is already gone.
-- ---------------------------------------------------------------------------
create table if not exists notification (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  kind       text not null check (kind in ('group_goal')),
  -- Where it points. A relative path, not a URL: the site has moved host once
  -- already and a stored absolute link outlives the deploy that renamed it.
  href       text,
  -- The subject, so a reader can be shown the thing rather than a sentence
  -- about it, and so a goal that is deleted takes its notifications with it.
  goal_id    uuid references goals(id) on delete cascade,
  actor_id   uuid references profiles(id) on delete set null,
  group_id   uuid references groups(id) on delete cascade,
  read_at    timestamptz,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notification_inbox_idx
  on notification (user_id, read_at, created_at desc);

-- The sender's query: everything not yet emailed, oldest first. Partial, so
-- the index holds only the handful of rows that are actually pending rather
-- than every notification the product has ever produced.
create index if not exists notification_unsent_idx
  on notification (user_id, created_at)
  where emailed_at is null;

alter table notification enable row level security;

-- ---------------------------------------------------------------------------
-- 3. Yours to read, yours to mark read, and nothing else.
--
-- No insert policy at all, deliberately. Rows arrive from the trigger below,
-- which is security definer, and from the service role. A browser that could
-- insert here could write into anybody's inbox and put words in their friend's
-- mouth, which is a more convincing lie than most things a client can forge.
--
-- No delete policy either. Dismissing is read_at, not removal: a notification
-- that can be deleted is one that can be made to have never existed, and the
-- cascade from goals already removes them when the subject goes.
-- ---------------------------------------------------------------------------
drop policy if exists notification_select on notification;
create policy notification_select on notification for select to authenticated
  using (user_id = auth.uid());

-- Update is how something gets marked read. Scoped both ways so a row cannot
-- be moved onto somebody else on the way through.
drop policy if exists notification_update on notification;
create policy notification_update on notification for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, update on notification to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Fan out on insert.
--
-- Security definer because it writes rows belonging to other people, which is
-- exactly what the policies above forbid the caller from doing. The search
-- path is pinned: a security definer function that resolves names through the
-- caller's search_path is the standard way this becomes a privilege
-- escalation.
--
-- Everyone in the group except the person who typed it. Being told about your
-- own action is noise, and it is the fastest way to teach somebody that this
-- notification means nothing.
--
-- Only 'group' goals, and only active ones. A paused or already-completed goal
-- arriving as news is a message about something that is not happening.
-- ---------------------------------------------------------------------------
create or replace function notify_group_goal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind <> 'group' or new.status <> 'active' then
    return new;
  end if;

  insert into notification (user_id, kind, href, goal_id, actor_id, group_id)
  select gm.user_id,
         'group_goal',
         '/g/' || new.group_id::text,
         new.id,
         new.created_by,
         new.group_id
    from group_members gm
   where gm.group_id = new.group_id
     -- coalesce, because created_by is null on a database where auth.uid()
     -- was unavailable. Without it the comparison is null, the row is not
     -- excluded, and nobody is notified at all rather than everybody being.
     and gm.user_id is distinct from coalesce(new.created_by, '00000000-0000-0000-0000-000000000000'::uuid);

  return new;
end $$;

drop trigger if exists goals_notify_group on goals;
create trigger goals_notify_group
  after insert on goals
  for each row execute function notify_group_goal();

-- ---------------------------------------------------------------------------
-- 5. A fourth kind of message, so the ceiling knows about this one.
--
-- 47_birthday_mail.sql explains why this line is the whole feature rather than
-- a formality: nothing sends without first claiming a row in
-- notifications_log, and a kind the check constraint does not know cannot
-- claim one. The insert raises, claim() returns false, and the sender skips it
-- forever with no error anywhere a person would look.
--
-- One per recipient per cycle, same as the other three. A group where four
-- people each add a shared goal on the same day produces ONE email listing
-- four, not four emails, for the same reason two birthdays in a window produce
-- one. The in-app rows are separate and are not rationed: a list in the app
-- costs nothing to scroll past, an email does not.
-- ---------------------------------------------------------------------------
alter table notifications_log drop constraint if exists notifications_log_kind_check;
alter table notifications_log add constraint notifications_log_kind_check
  check (kind in ('digest', 'nudge', 'birthday', 'group_goal'));

notify pgrst, 'reload schema';

-- Check:
--   select kind, count(*) filter (where read_at is null) as unread,
--          count(*) filter (where emailed_at is null) as unsent
--     from notification group by kind;
--
--   -- and that the trigger excludes the author: insert a group goal as
--   -- yourself, then
--   select user_id from notification order by created_at desc limit 10;
--   -- your own id must not be in that list
