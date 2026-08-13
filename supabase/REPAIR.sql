-- ============================================================================
-- Bring a drifted database back to what the files describe.
--
-- Safe to run at any time, on any state, as many times as you like. Every
-- statement is `if not exists`, `or replace`, or wrapped so that "it is already
-- there" is not an error. It adds nothing that is already present and deletes
-- nothing at all.
--
-- WHY A DATABASE DRIFTS FROM ITS MIGRATIONS.
--
-- Two ways, and this project has hit both.
--
-- One: a script that fails halfway still commits everything before the
-- failure. The Supabase SQL editor runs statement by statement rather than in
-- a single transaction, so when migration 28 was refused on its last statement
-- (42P16, a view column cannot be renamed in place) the three statements
-- before it had already landed. The database ended up in a state no migration
-- file describes.
--
-- Two, and this is the one that broke check-ins: a column added later to a
-- file that has already been run is never picked up, because nobody re-runs
-- 01_schema.sql. `checkins.mood` was added to the bottom of that file after
-- this database was created from it. submit_checkin has written to that column
-- since migration 12. Every check-in on this project was failing with
--
--   [42703] column "mood" of relation "checkins" does not exist
--
-- and the app said "saved on this device, it will send when you are back
-- online", which was true about the queue and false about everything else.
--
-- Run supabase/CHECK_SCHEMA.sql afterwards. An empty result means done.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Columns added to files after those files had already been run.
--
-- These are the drift candidates, and they are exactly the `add column if not
-- exists` lines scattered across the migrations. Gathered here so that one
-- script repairs a database of any vintage instead of somebody having to work
-- out which of twenty-eight files to replay.
--
-- The mood column is first because it is the one that stopped check-ins.
-- ---------------------------------------------------------------------------
alter table checkins       add column if not exists mood text;

alter table goals          add column if not exists remind boolean not null default true;
alter table goals          add column if not exists active_days int[];
alter table goals          add column if not exists proof_type text not null default 'photo';

alter table checkin_items  add column if not exists photo_url text;
alter table checkin_items  add column if not exists link_url text;

alter table profiles       add column if not exists email_lower text;
alter table profiles       add column if not exists birthday date;
alter table profiles       add column if not exists has_seen_budget_intro boolean not null default false;
alter table profiles       add column if not exists currency text;
alter table profiles       add column if not exists pronouns text;
alter table profiles       add column if not exists has_seen_journal_intro boolean not null default false;

alter table groups         add column if not exists admins_can_delete boolean not null default false;
alter table group_feed     add column if not exists day date;
alter table books          add column if not exists stripe_ref text;

-- ---------------------------------------------------------------------------
-- 2. The constraints that belong to those columns.
--
-- A column added without its check accepts values the app will later choke on,
-- and a check added twice is an error rather than a no-op, which is why each
-- one is dropped first. `drop constraint if exists` is the only form that is
-- safe on a database where the column has just appeared and on one where it
-- has been there for a year.
-- ---------------------------------------------------------------------------
alter table checkins drop constraint if exists checkins_mood_check;
alter table checkins add constraint checkins_mood_check check (mood in (
  'excited','joyful','grateful','energized',
  'sensitive','confused','bored','stressed',
  'angry','insecure','hurt','guilty'));

alter table goals drop constraint if exists goals_proof_type_check;
alter table goals add constraint goals_proof_type_check
  check (proof_type in ('photo', 'link', 'text', 'none'));

alter table checkin_items drop constraint if exists checkin_items_link_url_check;
alter table checkin_items add constraint checkin_items_link_url_check
  check (link_url is null or link_url ~* '^https?://[^\s/$.?#].[^\s]*$');

alter table profiles drop constraint if exists profiles_pronouns_check;
alter table profiles add constraint profiles_pronouns_check
  check (pronouns is null or length(trim(pronouns)) between 1 and 40);

-- ---------------------------------------------------------------------------
-- 3. submit_checkin, whole.
--
-- Replaced rather than trusted, because a function body cannot be inspected
-- for correctness from the outside and this is the one door every check-in
-- goes through: the offline queue replays through it, the board's one-tap
-- button calls it, and the full form calls it. If a database is missing a
-- column, the odds are good it is also running an older version of this.
--
-- This is the migration 28 version, carrying a link through. photo_url
-- coalesces so that re-filing a day without a photo does not delete one
-- attached an hour ago; link_url does not, because clearing the box is how
-- somebody removes a wrong link.
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
    insert into checkin_items (checkin_id, goal_id, outcome, count_done, evidence, photo_url, link_url)
    values (
      cid,
      (item->>'goal_id')::uuid,
      item->>'outcome',
      coalesce((item->>'count_done')::int, 0),
      item->>'evidence',
      item->>'photo_url',
      item->>'link_url'
    )
    on conflict (checkin_id, goal_id) do update
      set outcome    = excluded.outcome,
          count_done = excluded.count_done,
          evidence   = excluded.evidence,
          photo_url  = coalesce(excluded.photo_url, checkin_items.photo_url),
          link_url   = excluded.link_url;
  end loop;

  return cid;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. member_cycle_status, whole.
--
-- A view cannot select a column that does not exist, so a database that never
-- had `checkins.mood` is necessarily also carrying a version of this view from
-- before mood was appended to it. Adding the column back does not update the
-- view, and this is the one view the board, the history strip and the
-- completion rate all read.
--
-- Found by the schema check rather than by thinking about it: after the column
-- was restored, CHECK_SCHEMA still reported `member_cycle_status.mood` as
-- missing, which is exactly the sort of second-order breakage a checklist
-- catches and a person does not.
--
-- Dropped first for the same reason group_proofs is below: `create or replace
-- view` cannot reorder columns, and a view that has drifted may have them in
-- another order.
-- ---------------------------------------------------------------------------
drop view if exists member_cycle_status;

create or replace view member_cycle_status
with (security_invoker = on)
as
select
  c.group_id,
  gm.user_id,
  c.id   as cycle_id,
  c.seq,
  c.opens_at,
  c.closes_at,
  c.state,
  case
    when ci.id is not null then 'submitted'
    when ap.id is not null then 'away'
    when c.state = 'closed' then 'missed'
    else 'pending'
  end as status,
  ci.mood
from cycles c
join group_members gm  on gm.group_id = c.group_id
left join checkins ci  on ci.cycle_id = c.id and ci.user_id = gm.user_id
left join away_periods ap on ap.cycle_id = c.id and ap.user_id = gm.user_id;

-- ---------------------------------------------------------------------------
-- 5. group_proofs, whole.
--
-- Dropped first, because `create or replace view` may only append columns to
-- the end of an existing view. Adding link_url next to photo_url, where it
-- belongs, lands on the position `outcome` used to hold, and that is the
-- 42P16 that stopped migration 28 halfway.
--
-- Nothing else in this schema reads this view; only the client does, through
-- PostgREST. Dropping without CASCADE means that if that ever stops being
-- true, this fails loudly rather than quietly taking a dependent with it.
-- ---------------------------------------------------------------------------
drop view if exists group_proofs;

create or replace view group_proofs
with (security_invoker = on)
as
select
  ci.id            as item_id,
  cy.group_id,
  c.user_id,
  ci.photo_url,
  ci.link_url,
  ci.outcome,
  ci.evidence,
  c.submitted_at,
  cy.opens_at      as day_at,
  g.commitment     as goal_title,
  coalesce(g.proof_type, 'photo') as goal_proof_type,
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
where ci.photo_url is not null
   or ci.link_url is not null
   or nullif(trim(ci.evidence), '') is not null;

-- PostgREST caches the schema. Without this it keeps answering from the shape
-- it learned at boot, so a column added a second ago is still "not found".
notify pgrst, 'reload schema';

-- Then run supabase/CHECK_SCHEMA.sql. An empty result means done.
