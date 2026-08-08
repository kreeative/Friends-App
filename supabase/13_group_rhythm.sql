-- ============================================================================
-- The week is the window.
--
-- Run after 02. Safe to re-run.
--
-- What was wrong
-- --------------
-- A group's defaults are cadence_days = 7 and window_hours = 30. ensure_cycles
-- read those as "open Sunday at six, shut Tuesday at midnight", so the group
-- accepted a check-in for thirty hours a week and refused one for the other
-- hundred and thirty-eight. Five days out of seven the app had nothing in it
-- you could do, which is not an accountability group, it is a countdown.
--
-- On top of that, four periods were kept materialised ahead. Any screen that
-- picked a future period without sorting got the fourth one, so a weekly group
-- could tell you the next check-in was twenty-three days out. Nothing was
-- locked for a month. It just said so.
--
-- What it is now
-- --------------
-- A period runs from when it opens until the next one opens. Writing is open
-- the whole time; what waits for the hour is the reading. The board stays
-- sealed until the period ends, so there is still a moment everybody arrives
-- for, and it is still an event, but missing the evening no longer means
-- missing the week.
--
-- window_hours is kept and is no longer the length of anything. It is the
-- span the reminder emails aim at, which is the only job it was ever good at.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Generate periods that meet end to end.
--
-- Two ahead rather than four: the one you are in and the one after it. There
-- is no use for a period four weeks out, and its existence is what let a
-- screen name it.
-- ---------------------------------------------------------------------------
create or replace function ensure_cycles(gid uuid, ahead int default 2)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  g            groups%rowtype;
  base_date    date;
  dow_offset   int;
  next_seq     int;
  last_opens   timestamptz;
  opens_local  timestamp;
  ends_local   timestamp;
  first_end    timestamp;
  future_count int;
begin
  select * into g from groups where id = gid;
  if not found then return; end if;

  /**
   * Clamped rather than merely defaulted.
   *
   * create_group, join_group and tick all ask for four, and they were written
   * before there was any reason not to. Capping here fixes all three at once
   * and, more usefully, cannot be undone by a caller that this file does not
   * know about. Two is the one you are in plus the one after it, which is
   * everything any screen has ever needed.
   */
  ahead := least(greatest(coalesce(ahead, 2), 1), 2);

  select max(seq), max(opens_at) into next_seq, last_opens
  from cycles where group_id = gid;

  if next_seq is null then
    /**
     * A group with no periods yet. The anchor is the meeting on or before the
     * group was made, not the one after it.
     *
     * It used to look forward, which meant a group created on a Monday with a
     * Sunday check-in had nothing open for six days. You would set the whole
     * thing up, invite people, and find a locked door. Anchoring backwards
     * puts the group inside its first week immediately, and that week still
     * reveals on the first real meeting evening.
     */
    base_date   := (g.created_at at time zone g.timezone)::date;
    dow_offset  := (extract(dow from base_date)::int - g.checkin_dow + 7) % 7;
    opens_local := (base_date - dow_offset)::timestamp + make_interval(hours => g.opens_hour);

    /**
     * Made on the check-in day but before the hour, so even the backwards
     * anchor is ahead of the group. Neither obvious answer is good: opening
     * at the anchor leaves the group shut for the rest of the day it was
     * created, and stepping back a whole cadence invents a week that ended
     * before the group existed, which the board would then show as everybody
     * having gone quiet.
     *
     * So the first week is a short one. It starts now and ends at the real
     * meeting hour, and every week after it is full length. That is also just
     * true: you did join partway through a week.
     */
    if opens_local at time zone g.timezone > g.created_at then
      first_end   := opens_local;
      opens_local := (g.created_at at time zone g.timezone);
    end if;

    next_seq := 0;
  else
    /**
     * A group that is already running continues from its own last period, not
     * from a recomputed anchor.
     *
     * Deriving every period from the anchor was fine while the anchor never
     * moved. It moved above, so a group with five weeks of history would have
     * had its next period computed on the new anchor and landed on top of a
     * week it already had. Following the last row keeps every existing group
     * on exactly the rhythm it has been on.
     */
    opens_local := (last_opens at time zone g.timezone) + make_interval(days => g.cadence_days);
    next_seq    := next_seq + 1;
  end if;

  select count(*) into future_count
  from cycles where group_id = gid and closes_at > now();

  while future_count < ahead loop
    -- The whole cadence, not window_hours. This is the change. first_end is
    -- set only for the short opening week above, and only for its one turn.
    ends_local := coalesce(first_end, opens_local + make_interval(days => g.cadence_days));
    first_end  := null;

    insert into cycles (group_id, seq, opens_at, closes_at, state)
    values (
      gid,
      next_seq,
      opens_local at time zone g.timezone,
      ends_local  at time zone g.timezone,
      'upcoming'
    )
    on conflict (group_id, seq) do nothing;

    if ends_local at time zone g.timezone > now() then
      future_count := future_count + 1;
    end if;

    opens_local := ends_local;
    next_seq    := next_seq + 1;

    if next_seq > 5000 then exit; end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Re-end the periods that already exist.
--
-- ensure_cycles inserts with `on conflict do nothing`, so it will never touch
-- a row that is already there. Every period created before today still ends
-- thirty hours in, and a group that has been running for a while is entirely
-- made of those. Without this statement the fix applies to nobody who already
-- has a group, which is everybody.
--
-- Derived from the group's own cadence rather than from the neighbouring row,
-- so a gap in seq cannot produce a period that never ends.
-- ---------------------------------------------------------------------------
update cycles c
set closes_at = c.opens_at + make_interval(days => g.cadence_days)
from groups g
where g.id = c.group_id
  and c.closes_at is distinct from c.opens_at + make_interval(days => g.cadence_days);

-- ---------------------------------------------------------------------------
-- 3. Drop the periods nobody needed.
--
-- Only ones that have not started, and only for a group where nothing has
-- been written against any of them. A period with a check-in or an away note
-- on it is somebody's record, and this is a tidy-up, not a delete.
--
-- The protection is per group rather than per period on purpose. Removing
-- some rows and keeping others would leave a hole in the timeline, and a
-- period now ends where the next one starts, so a hole is a fortnight-long
-- week. All or nothing keeps the run contiguous. They regenerate from
-- ensure_cycles the moment they are wanted, two at a time.
-- ---------------------------------------------------------------------------
delete from cycles c
where c.opens_at > now()
  and c.seq > (
    select min(c2.seq) from cycles c2
    where c2.group_id = c.group_id and c2.opens_at > now()
  )
  and not exists (
    select 1 from cycles f
    where f.group_id = c.group_id
      and f.opens_at > now()
      and (
        exists (select 1 from checkins     k where k.cycle_id = f.id)
        or exists (select 1 from away_periods a where a.cycle_id = f.id)
        or exists (select 1 from nudges     n where n.cycle_id = f.id)
      )
  );

-- ---------------------------------------------------------------------------
-- 4. Put the state column back in step.
--
-- state is what missed_cycle and the nudge logic read. Rows closed early
-- under the old thirty hour rule are open again under this one, and a period
-- that ended while nobody was looking has to be marked closed so that going
-- quiet two weeks running still gets noticed. tick() does all of this on its
-- next run; doing it here means the repair does not wait for one.
-- ---------------------------------------------------------------------------
update cycles set state = 'upcoming' where opens_at >  now();
update cycles set state = 'open'     where opens_at <= now() and closes_at >  now();
update cycles set state = 'closed'   where closes_at <= now();

-- Top every group up under the new rule straight away.
select tick();

-- Check: every group should show exactly one open period and one upcoming.
--   select group_id, state, count(*)
--   from cycles group by group_id, state order by group_id, state;
