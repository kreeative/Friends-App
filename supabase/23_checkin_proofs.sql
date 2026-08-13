-- ============================================================================
-- Proof photos, and reactions to them.
--
-- Run after 22. Safe to re-run.
--
-- checkin_items.evidence has always been a line of text: "links to the posted
-- videos", "photo on my phone". A description of a photograph is not a
-- photograph, and the one thing a group of friends actually wants from a
-- check-in is to see the thing. So the column stays, and a picture can sit
-- beside it.
--
-- The photo hangs off checkin_items rather than checkins because a proof is
-- proof OF something. One check-in can cover three goals, and a picture of a
-- gym floor filed against "read 20 pages" would be worse than no picture. It
-- also means the gallery can label every tile with the goal it belongs to
-- without guessing.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The column.
-- ---------------------------------------------------------------------------
alter table checkin_items add column if not exists photo_url text;

-- ---------------------------------------------------------------------------
-- 2. The bucket.
--
-- Public, on the same reasoning as avatars in 21: the picture is shown to a
-- group the viewer is already authorised to read, so the file carries nothing
-- the reader could not already see. The alternative is a signed URL per tile
-- per render, which for a grid of ninety photographs is ninety round trips and
-- a cache that cannot work.
--
-- The cost is real and worth saying plainly: an URL, once known, is readable
-- without a session. This is fine for a face somebody chose as their avatar.
-- It is a bigger deal for a photograph of somebody's living room, so the
-- filenames are random rather than guessable, and the app says what "the group
-- can see this" means at the point of upload.
--
-- Larger than the avatar limit because these are photographs rather than
-- thumbnails, but still small: the client downscales the long edge to 1280
-- before upload, which lands well under this.
-- ---------------------------------------------------------------------------
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

-- Same folder rule as avatars: you may write inside the folder named after
-- your own id and nowhere else.
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

-- ---------------------------------------------------------------------------
-- 3. Reactions.
--
-- One row per person per emoji per photo, which is what the unique constraint
-- says: tapping the same heart twice is not two hearts, it is a toggle, and
-- the client deletes rather than inserting again.
--
-- The emoji set is fixed by a check rather than left open. An open column
-- means the picker and the database disagree the first time somebody sends
-- something through a console, and a reaction row nothing can render is a
-- count that is wrong with no way to see why.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 4. Who may see and react.
--
-- A proof belongs to a check-in, which belongs to a cycle, which belongs to a
-- group. Reachable from a reaction in three joins, and is_member() at the end
-- of them is the whole rule: you can see and react to photographs from groups
-- you are in, and nothing else.
-- ---------------------------------------------------------------------------
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

-- Insert is yours alone, and only into a group you belong to. Both halves
-- matter: the first stops a reaction being attributed to somebody else, the
-- second stops one being left on a stranger's photograph.
drop policy if exists proof_reactions_insert on proof_reactions;
create policy proof_reactions_insert on proof_reactions for insert to authenticated
  with check (user_id = auth.uid() and is_member(proof_group(item_id)));

drop policy if exists proof_reactions_delete on proof_reactions;
create policy proof_reactions_delete on proof_reactions for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 5. The gallery, in one read.
--
-- The grid needs the photo, who took it, which goal it was for, when, and how
-- many of each reaction. That is five tables, and doing it from the browser is
-- five round trips or an embed whose filtering has to be trusted at every
-- level. security_invoker keeps the caller's own policies in force, so this
-- returns exactly the rows the reader is allowed to see.
--
-- Reaction counts are aggregated here rather than counted client-side, so a
-- month of photographs is one response rather than one per tile.
-- ---------------------------------------------------------------------------
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

-- Check:
--   select id, public, file_size_limit from storage.buckets where id = 'checkin-proofs';
--   select goal_title, display_name, reaction_count from group_proofs
--    order by submitted_at desc limit 20;

-- ---------------------------------------------------------------------------
-- 6. Let the check-in carry a photo through.
--
-- submit_checkin is the only way an item is ever written: the offline queue
-- replays through it, the one-tap card goes through it, and the full form goes
-- through it. Adding the column without teaching this function about it would
-- mean photo_url could only ever be set by a second write racing the first.
--
-- Replaced whole rather than patched, because a plpgsql body cannot be
-- amended in place. Everything else about it is unchanged: same signature, so
-- no client needs to know, and the upsert still overwrites an item that is
-- filed twice in a day.
--
-- coalesce on the update, not excluded.photo_url. Re-filing a check-in without
-- a photo must not delete the photograph attached to it an hour ago; a picture
-- is removed by removing it, not by saving the form again.
-- ---------------------------------------------------------------------------
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
