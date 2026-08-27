-- ============================================================================
-- One open nudge per person, and a way to put one away.
--
-- Run after 39. Safe to re-run.
--
-- WHY THERE WERE TWO CARDS FOR ONE PERSON.
--
-- nudges has carried `unique (cycle_id, subject_id)` since 01_schema. That
-- makes a nudge unique per CYCLE, not per person, and tick() raises one for
-- anybody who has missed two cycles running. So somebody quiet for a fortnight
-- collects one card per week, three weeks collects three, and the screen fills
-- with the same name saying the same thing.
--
-- The constraint was not wrong for what it was written for: it stops one cycle
-- raising the same nudge twice. It just never said the thing that actually
-- matters, which is that one person who has gone quiet is ONE situation, and
-- it stays one situation until somebody deals with it.
--
-- So a second index says that, and it is partial on purpose. Only pending and
-- claimed rows are constrained: `done` and `expired` are history, and a person
-- who goes quiet again in March must be able to have a new nudge without the
-- one somebody closed in January standing in the way.
--
-- WHY THE CROSS HIDES RATHER THAN CLOSES.
--
-- "Peut-etre que tu veux pas notifier ton ami parce que tu sais qu'il peut
-- pas." That is a fact one person holds, not a fact about the group, and
-- closing the nudge on everybody's screen would use private knowledge to make
-- a decision for four other people. It could also silently strand somebody:
-- the one person who knew there was a good reason is also the one who makes
-- the card vanish for whoever might otherwise have written.
--
-- So the cross is per viewer. The nudge stays open, everybody else still sees
-- it, and the person who dismissed it stops being asked.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Collapse what is already there, oldest kept.
--
-- The index below cannot be created while duplicates exist, and the honest
-- choice of which to keep is the oldest: it carries the date the silence
-- actually started, which is the only fact in the row worth anything. Any
-- claim on a newer duplicate is carried over rather than dropped, so nobody
-- loses the fact that they volunteered.
-- ---------------------------------------------------------------------------
with ranked as (
  select id, group_id, subject_id, claimed_by, claimed_at, state,
         row_number() over (
           partition by group_id, subject_id
           order by created_at, id
         ) as rn
    from nudges
   where state in ('pending', 'claimed')
),
keeper as (
  select group_id, subject_id, id from ranked where rn = 1
),
volunteered as (
  select r.group_id, r.subject_id, r.claimed_by, r.claimed_at
    from ranked r
   where r.rn > 1 and r.claimed_by is not null
),
carried as (
  update nudges n
     set claimed_by = v.claimed_by,
         claimed_at = v.claimed_at,
         state      = 'claimed'
    from keeper k
    join volunteered v
      on v.group_id = k.group_id and v.subject_id = k.subject_id
   where n.id = k.id and n.claimed_by is null
  returning n.id
)
update nudges
   set state = 'expired', closed_at = now()
 where id in (select id from ranked where rn > 1);

-- ---------------------------------------------------------------------------
-- 2. And stop it happening again.
--
-- Partial, so history is untouched and a later silence can raise a new one.
-- The old per-cycle constraint stays: it still does its own smaller job, and
-- dropping a unique constraint that nothing is complaining about buys nothing.
-- ---------------------------------------------------------------------------
create unique index if not exists nudges_one_open_per_person
  on nudges (group_id, subject_id)
  where state in ('pending', 'claimed');

-- ---------------------------------------------------------------------------
-- 3. The cross. One row per person per nudge they have put away.
--
-- No reason column, deliberately. The reason is somebody's private knowledge
-- about a friend, the app has no use for it, and a free-text box asking for it
-- would be the app collecting something it does not need in order to look
-- thorough.
-- ---------------------------------------------------------------------------
create table if not exists nudge_hidden (
  nudge_id  uuid not null references nudges(id) on delete cascade,
  user_id   uuid not null references profiles(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (nudge_id, user_id)
);

create index if not exists nudge_hidden_mine_idx on nudge_hidden (user_id);

alter table nudge_hidden enable row level security;

-- Yours and only yours, in every direction. Who else chose not to write is
-- nobody's business, and a group member reading this table would learn
-- exactly that.
drop policy if exists nudge_hidden_select on nudge_hidden;
create policy nudge_hidden_select on nudge_hidden for select to authenticated
  using (user_id = auth.uid());

drop policy if exists nudge_hidden_insert on nudge_hidden;
create policy nudge_hidden_insert on nudge_hidden for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists nudge_hidden_delete on nudge_hidden;
create policy nudge_hidden_delete on nudge_hidden for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, delete on nudge_hidden to authenticated;

-- ---------------------------------------------------------------------------
-- 4. And the heartbeat that raises them, which MUST be reloaded with this.
--
-- tick() inserted with `on conflict (cycle_id, subject_id) do nothing`. Naming
-- a conflict target only excuses the target it names, so with the index above
-- in place and the old function still loaded, the second week of somebody's
-- silence would raise a unique violation and abort the whole heartbeat: no
-- cycles advanced, no windows opened, for everybody.
--
-- Identical to the copy in 02_functions.sql. It is repeated here so that
-- running this one file leaves the database consistent, rather than depending
-- on somebody remembering to re-run 02 afterwards.
-- ---------------------------------------------------------------------------
create or replace function tick()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  g_id uuid;
  c    record;
  prev record;
  m    record;
  fallback_uid uuid;
begin
  for g_id in select id from groups loop
    perform ensure_cycles(g_id, 2);
  end loop;

  update cycles set state = 'open'
  where state = 'upcoming' and opens_at <= now() and closes_at > now();

  -- Close each newly-finished cycle and evaluate silence for it.
  for c in
    select * from cycles
    where state in ('open', 'upcoming') and closes_at <= now()
  loop
    update cycles set state = 'closed' where id = c.id;

    select * into prev
    from cycles
    where group_id = c.group_id and seq = c.seq - 1 and state = 'closed';

    if found then
      for m in select user_id from group_members where group_id = c.group_id loop
        if missed_cycle(m.user_id, c.id) and missed_cycle(m.user_id, prev.id) then
          -- Unqualified, so it catches BOTH unique rules on this table: the
          -- per-cycle one from 01_schema, and nudges_one_open_per_person from
          -- migration 40. Naming a conflict target only excuses the target it
          -- names, so the moment 40 made "one open nudge per person" real,
          -- this insert would have started RAISING on the second week of
          -- somebody's silence and taken the whole heartbeat down with it.
          --
          -- Doing nothing is the right answer either way. One person who has
          -- gone quiet is one situation, and it stays one situation until
          -- somebody deals with it.
          insert into nudges (group_id, cycle_id, subject_id)
          values (c.group_id, c.id, m.user_id)
          on conflict do nothing;
        end if;
      end loop;
    end if;
  end loop;

  -- Fallback rotation: only after nobody volunteered for a full day.
  for c in
    select * from nudges
    where state = 'pending' and assigned_to is null and created_at < now() - interval '24 hours'
  loop
    select gm.user_id into fallback_uid
    from group_members gm
    where gm.group_id = c.group_id and gm.user_id <> c.subject_id
    order by gm.nudge_order, gm.joined_at
    offset (
      select count(*) from nudges n
      where n.group_id = c.group_id and n.assigned_to is not null and n.created_at < c.created_at
    ) % greatest(1, (select count(*) - 1 from group_members where group_id = c.group_id))
    limit 1;

    if fallback_uid is not null then
      update nudges set assigned_to = fallback_uid where id = c.id;
    end if;
  end loop;
end;
$$;


notify pgrst, 'reload schema';

-- Check:
--   select subject_id, count(*) from nudges
--    where state in ('pending','claimed') group by subject_id having count(*) > 1;
--   -- must return no rows
--   select * from nudge_hidden where user_id = auth.uid();
