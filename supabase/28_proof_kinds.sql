-- ============================================================================
-- Proof: what kind, and where it goes.
--
-- Run after 27. Safe to re-run.
--
-- Two problems, and the second one is the bug people actually saw.
--
-- ONE. Every goal offered the same evidence: a photograph. "Read twenty pages"
-- photographs badly, "ship the landing page" is a URL, and "sat with it for
-- ten minutes" is a sentence and cannot be anything else. So goals now say
-- what proof they want, and the check-in renders that one control on the
-- goal's own card instead of a photo picker on a separate tab.
--
-- TWO. group_proofs ended in `where ci.photo_url is not null`. That was
-- correct when a photograph was the only proof there was, and it is the reason
-- the gallery could sit on "no proof yet" while somebody was looking at a
-- check-in they had definitely filled in: a note in the evidence box was
-- stored, was readable, and was excluded from the only view that displays it.
-- Widening that predicate is most of this migration's value.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. What proof does this goal want?
--
-- The default is 'photo' and that is a deliberate refusal to be clever. Every
-- goal already in this database offered a photograph, because that is all the
-- app had; defaulting to anything else would silently rewrite what thousands
-- of existing goals ask of the people who set them. 'none' exists because some
-- goals genuinely do not need proving to anybody, and pretending otherwise is
-- worse than asking for nothing.
--
-- This is separate from evidence_def, which stays exactly as it was.
-- evidence_def is the sentence you wrote to your future self about what would
-- count ("a photo of the whiteboard"); proof_type is the control the app draws.
-- One is a prompt, the other is a widget, and collapsing them would mean
-- parsing English to decide which input to render.
-- ---------------------------------------------------------------------------
alter table goals add column if not exists proof_type text not null default 'photo';

alter table goals drop constraint if exists goals_proof_type_check;
alter table goals add constraint goals_proof_type_check
  check (proof_type in ('photo', 'link', 'text', 'none'));

-- ---------------------------------------------------------------------------
-- 2. Somewhere to put a link.
--
-- Its own column rather than reusing evidence. evidence is prose and is shown
-- as prose; a link has to be rendered as an anchor, and a gallery that had to
-- guess which of the two it was holding would guess wrong on "I posted it at
-- example.com/x" in both directions.
--
-- The check is a floor, not a validator: the client normalises and rejects
-- anything that is not http(s) before it gets here (see normaliseLink in
-- src/lib/proofKinds.js, and the tests for why javascript: is the case that
-- matters). This stops the obvious thing arriving through a console, and
-- deliberately does not try to be a URL parser in a check constraint.
-- ---------------------------------------------------------------------------
alter table checkin_items add column if not exists link_url text;

alter table checkin_items drop constraint if exists checkin_items_link_url_check;
alter table checkin_items add constraint checkin_items_link_url_check
  check (link_url is null or link_url ~* '^https?://[^\s/$.?#].[^\s]*$');

-- ---------------------------------------------------------------------------
-- 3. Carry it through the one door items are written by.
--
-- submit_checkin is the only way a checkin_item is ever created: the offline
-- queue replays through it, the one-tap card on the board goes through it, and
-- the full form goes through it. Adding the column without teaching this
-- function about it would mean link_url could only ever be set by a second
-- write racing the first, which is precisely the shape of "I attached it and
-- it did not save".
--
-- Replaced whole rather than patched, because a plpgsql body cannot be amended
-- in place. Same signature, so nothing else needs to know.
--
-- WHY photo_url COALESCES AND link_url DOES NOT.
--
-- The existing coalesce on photo_url is there so that re-filing a check-in
-- without a photo does not delete the photograph attached an hour ago. That is
-- right for a file that was uploaded on pick and cannot be re-attached by
-- retyping. A link is different: it lives in a text box, clearing the box is
-- how somebody removes a wrong link, and coalescing would make that
-- impossible. The offline queue always replays the full item, so an omitted
-- link genuinely means "there is no link", not "I did not mention it".
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
-- 4. The gallery, showing all three kinds.
--
-- The `where` is the fix. It was `ci.photo_url is not null`, so a link or a
-- note was stored, was readable by the group, and was invisible in the only
-- place that displays proof. Now anything with something in it shows up.
--
-- One consequence worth being explicit about: evidence has existed since the
-- first migration and people have been typing into it for months, so widening
-- this brings historical notes into the gallery that were never shown there
-- before. That is the right outcome (they are proof, and they were always
-- visible to the group on the board) but it is not a no-op, and a gallery that
-- was empty yesterday may not be empty today.
--
-- goal_proof_type comes along so the gallery can tell an entry that is a note
-- because the goal asks for notes from one that is a caption somebody added to
-- a photograph that failed to upload.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 5. Editing a proof you already sent.
--
-- No new policy. checkin_items_write in 03_policies is `for all` and is scoped
-- to check-ins you own, so the update path the gallery needs already exists
-- and already refuses to touch anybody else's row. Recorded here because the
-- absence of a policy in a migration that adds an edit feature looks like an
-- omission, and it is not one.
-- ---------------------------------------------------------------------------

notify pgrst, 'reload schema';

-- Check:
--   select goal_title, goal_proof_type, photo_url is not null as has_photo,
--          link_url, left(evidence, 30) as note
--     from group_proofs order by submitted_at desc limit 20;
--   select commitment, proof_type from goals order by created_at desc limit 10;
