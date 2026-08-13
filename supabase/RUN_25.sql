-- Rich & Friends: migration 25, celebrations. Run after 24. Safe to re-run.
-- Paste the whole thing into the Supabase SQL editor and run it once.

create table if not exists celebrations (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references groups(id)   on delete cascade,
  sender_id   uuid not null references profiles(id) on delete cascade,
  receiver_id uuid not null references profiles(id) on delete cascade,
  message     text not null check (length(trim(message)) between 1 and 280),
  created_at  timestamptz not null default now(),
  seen_at     timestamptz,
  constraint celebrations_not_self check (sender_id <> receiver_id)
);

create index if not exists celebrations_group_idx
  on celebrations (group_id, created_at desc);

create index if not exists celebrations_unseen_idx
  on celebrations (receiver_id) where seen_at is null;

alter table celebrations enable row level security;

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

notify pgrst, 'reload schema';
