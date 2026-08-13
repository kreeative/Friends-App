-- Rich & Friends: migrations 21 to 24, in order. Safe to re-run.
-- Paste the whole thing into the Supabase SQL editor and run it once.

-- ========================================================================
-- 21 - avatars bucket + a real name constraint
-- ========================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  1048576,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists avatars_own_insert on storage.objects;
create policy avatars_own_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_own_update on storage.objects;
create policy avatars_own_update on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_own_delete on storage.objects;
create policy avatars_own_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

update profiles set display_name = 'Friend'
where display_name is null or length(trim(display_name)) = 0;

alter table profiles drop constraint if exists profiles_display_name_check;
alter table profiles add constraint profiles_display_name_check
  check (length(trim(display_name)) between 1 and 60);

-- ========================================================================
-- 22 - profiles.currency
-- ========================================================================
alter table profiles add column if not exists currency text;

alter table profiles drop constraint if exists profiles_currency_check;
alter table profiles add constraint profiles_currency_check
  check (currency is null or currency ~ '^[A-Z]{3}$');

update profiles p
   set currency = b.currency
  from budget_plan b
 where b.user_id = p.id
   and p.currency is null
   and b.currency is not null
   and b.currency <> 'CAD';

-- ========================================================================
-- 23 - proof photos, reactions, gallery view, submit_checkin
-- ========================================================================
alter table checkin_items add column if not exists photo_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'checkin-proofs',
  'checkin-proofs',
  true,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists proofs_public_read on storage.objects;
create policy proofs_public_read on storage.objects for select
  using (bucket_id = 'checkin-proofs');

drop policy if exists proofs_own_insert on storage.objects;
create policy proofs_own_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'checkin-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists proofs_own_update on storage.objects;
create policy proofs_own_update on storage.objects for update to authenticated
  using (
    bucket_id = 'checkin-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'checkin-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists proofs_own_delete on storage.objects;
create policy proofs_own_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'checkin-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create table if not exists proof_reactions (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references checkin_items(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  emoji      text not null check (emoji in ('heart', 'fire', 'clap', 'muscle')),
  created_at timestamptz not null default now(),
  unique (item_id, user_id, emoji)
);

create index if not exists proof_reactions_item_idx on proof_reactions(item_id);

alter table proof_reactions enable row level security;

create or replace function proof_group(p_item uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select cy.group_id
    from checkin_items ci
    join checkins c  on c.id = ci.checkin_id
    join cycles   cy on cy.id = c.cycle_id
   where ci.id = p_item
$$;

grant execute on function proof_group(uuid) to authenticated;

drop policy if exists proof_reactions_select on proof_reactions;
create policy proof_reactions_select on proof_reactions for select to authenticated
  using (is_member(proof_group(item_id)));

drop policy if exists proof_reactions_insert on proof_reactions;
create policy proof_reactions_insert on proof_reactions for insert to authenticated
  with check (user_id = auth.uid() and is_member(proof_group(item_id)));

drop policy if exists proof_reactions_delete on proof_reactions;
create policy proof_reactions_delete on proof_reactions for delete to authenticated
  using (user_id = auth.uid());

create or replace view group_proofs
with (security_invoker = on)
as
select
  ci.id            as item_id,
  cy.group_id,
  c.user_id,
  ci.photo_url,
  ci.outcome,
  ci.evidence,
  c.submitted_at,
  cy.opens_at      as day_at,
  g.commitment     as goal_title,
  p.display_name,
  p.avatar_url,
  coalesce(r.total, 0)  as reaction_count,
  coalesce(r.counts, '{}'::jsonb) as reaction_counts,
  coalesce(m.mine, '[]'::jsonb)   as my_reactions
from checkin_items ci
join checkins c   on c.id = ci.checkin_id
join cycles   cy  on cy.id = c.cycle_id
join profiles p   on p.id = c.user_id
left join goals g on g.id = ci.goal_id
left join lateral (
  select count(*) as total,
         jsonb_object_agg(x.emoji, x.n) as counts
  from (
    select emoji, count(*) as n
    from proof_reactions pr
    where pr.item_id = ci.id
    group by emoji
  ) x
) r on true
left join lateral (
  select jsonb_agg(pr.emoji) as mine
  from proof_reactions pr
  where pr.item_id = ci.id and pr.user_id = auth.uid()
) m on true
where ci.photo_url is not null;

create or replace function submit_checkin(
  p_cycle_id uuid,
  p_next_commitment text,
  p_note text,
  p_items jsonb,
  p_mood text default null
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  cid  uuid;
  item jsonb;
  gid  uuid;
begin
  select group_id into gid from cycles where id = p_cycle_id;
  if gid is null then raise exception 'no such cycle'; end if;
  if not is_member(gid) then raise exception 'not a member'; end if;

  insert into checkins (cycle_id, user_id, next_commitment, note, mood)
  values (p_cycle_id, auth.uid(), p_next_commitment, p_note, p_mood)
  on conflict (cycle_id, user_id) do update
    set next_commitment = excluded.next_commitment,
        note            = excluded.note,
        mood            = excluded.mood,
        submitted_at    = now()
  returning id into cid;

  for item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    insert into checkin_items (checkin_id, goal_id, outcome, count_done, evidence, photo_url)
    values (
      cid,
      (item->>'goal_id')::uuid,
      item->>'outcome',
      coalesce((item->>'count_done')::int, 0),
      item->>'evidence',
      item->>'photo_url'
    )
    on conflict (checkin_id, goal_id) do update
      set outcome    = excluded.outcome,
          count_done = excluded.count_done,
          evidence   = excluded.evidence,
          photo_url  = coalesce(excluded.photo_url, checkin_items.photo_url);
  end loop;

  return cid;
end;
$$;

-- ========================================================================
-- 24 - goals.active_days
-- ========================================================================
alter table goals add column if not exists active_days int[];

alter table goals drop constraint if exists goals_active_days_check;
alter table goals add constraint goals_active_days_check
  check (
    active_days is null
    or (
      array_length(active_days, 1) between 1 and 7
      and active_days <@ array[0, 1, 2, 3, 4, 5, 6]
    )
  );

