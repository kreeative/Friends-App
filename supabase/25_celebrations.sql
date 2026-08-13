-- ============================================================================
-- Celebrating somebody else.
--
-- Run after 24. Safe to re-run.
--
-- Every social row in this app so far is written by the machine. tick() files
-- a missed goal when a day closes, record_birthdays files a birthday. That is
-- deliberate and it stays: nobody reports anybody, the app noticed, which is a
-- different social act from a person filing a complaint about their friend.
--
-- This is the first row a person writes about another person, and it is the
-- one direction worth opening. "Fatim passed the first stage of her driving
-- test" is not something the app can ever know, it is not about a goal anybody
-- entered, and it is the kind of thing a group of friends actually exists for.
-- A feed that can only ever report what went wrong is one people learn to
-- dread; this is the counterweight.
--
-- It stays its own table rather than a new `kind` on group_feed. group_feed is
-- readable by the group and writable by nobody, which is a property worth
-- keeping exactly as it is, and a celebration has two people in it where a
-- feed row has one.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The table.
--
-- seen_at is not in the original sketch and is the difference between a banner
-- and a nuisance. Without it, "somebody celebrated you" reappears on every
-- load forever, and the only way to make it stop is to stop reading it.
--
-- The message is required and bounded. A celebration with nothing in it is a
-- notification for its own sake, and 280 characters is comfortably more than
-- anybody types with a thumb while a form is open.
-- ---------------------------------------------------------------------------
create table if not exists celebrations (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references groups(id)   on delete cascade,
  sender_id   uuid not null references profiles(id) on delete cascade,
  receiver_id uuid not null references profiles(id) on delete cascade,
  message     text not null check (length(trim(message)) between 1 and 280),
  created_at  timestamptz not null default now(),
  seen_at     timestamptz,
  -- Celebrating yourself is not a thing this feature is for, and it is the
  -- first thing somebody will try through a console.
  constraint celebrations_not_self check (sender_id <> receiver_id)
);

create index if not exists celebrations_group_idx
  on celebrations (group_id, created_at desc);

-- The banner's own query: everything addressed to me that I have not seen.
-- Partial, so the index stays the size of the unread set rather than of the
-- whole history.
create index if not exists celebrations_unseen_idx
  on celebrations (receiver_id) where seen_at is null;

alter table celebrations enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Is that person in this group?
--
-- is_member() answers this for the caller. The insert policy has to answer it
-- for somebody else, the receiver, and it has to do so without tripping over
-- the RLS on group_members, which is why this is the same security definer
-- shape as is_member itself and pinned to the same search_path.
--
-- Without it a crafted insert could address a celebration to any profile id at
-- all, and it would then be readable by everybody in the sender's group.
-- ---------------------------------------------------------------------------
create or replace function is_member_of(p_group uuid, p_user uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from group_members
    where group_id = p_group and user_id = p_user
  );
$$;

grant execute on function is_member_of(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Who may do what.
--
-- Read: anybody in the group. A celebration is a public thing by design, said
-- in front of the people it means something in front of.
--
-- Write: as yourself, into a group you are in, about somebody else who is also
-- in it. All three halves matter. The first stops a celebration being
-- attributed to somebody who did not send it, the second stops one being
-- posted into a group the sender is not in, the third stops one being
-- addressed to a stranger.
--
-- Update: the receiver only. The single legitimate update is marking it seen,
-- and narrowing that to specific columns is not something a policy can express,
-- so the client only ever writes seen_at and the blast radius is one row you
-- were already allowed to read.
--
-- Delete: the sender only, and only within the hour. Taking back something you
-- just sent to the wrong person is a real need; quietly deleting something
-- somebody has already read is not, and a celebration is not a message anybody
-- should be able to un-say a week later.
-- ---------------------------------------------------------------------------
drop policy if exists celebrations_select on celebrations;
create policy celebrations_select on celebrations for select to authenticated
  using (is_member(group_id));

drop policy if exists celebrations_insert on celebrations;
create policy celebrations_insert on celebrations for insert to authenticated
  with check (
    sender_id = auth.uid()
    and is_member(group_id)
    and is_member_of(group_id, receiver_id)
  );

drop policy if exists celebrations_update on celebrations;
create policy celebrations_update on celebrations for update to authenticated
  using (receiver_id = auth.uid())
  with check (receiver_id = auth.uid());

drop policy if exists celebrations_delete on celebrations;
create policy celebrations_delete on celebrations for delete to authenticated
  using (sender_id = auth.uid() and created_at > now() - interval '1 hour');

-- ---------------------------------------------------------------------------
-- 4. Both people, and the group, in one read.
--
-- The feed card names the sender, the banner names the sender and the group,
-- and the check-in picker needs neither. Two joins to profiles rather than one
-- because a celebration is the only row in this schema with two people in it.
--
-- security_invoker keeps the caller's own policy in force, so this returns
-- exactly the rows the reader is allowed to see and nothing else.
-- ---------------------------------------------------------------------------
create or replace view celebrations_detail
with (security_invoker = on)
as
select
  c.id,
  c.group_id,
  c.sender_id,
  c.receiver_id,
  c.message,
  c.created_at,
  c.seen_at,
  g.name          as group_name,
  s.display_name  as sender_name,
  s.avatar_url    as sender_avatar,
  r.display_name  as receiver_name,
  r.avatar_url    as receiver_avatar
from celebrations c
join groups   g on g.id = c.group_id
join profiles s on s.id = c.sender_id
join profiles r on r.id = c.receiver_id;

-- PostgREST caches the schema, so a new table is invisible to the API until it
-- is told. Without this the app gets "relation does not exist" against a table
-- that is plainly there in the editor.
notify pgrst, 'reload schema';

-- Check:
--   select sender_name, receiver_name, message from celebrations_detail
--    order by created_at desc limit 20;
