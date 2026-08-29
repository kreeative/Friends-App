-- ============================================================================
-- A third kind of message: the birthday that is still three days away.
--
-- Run after 46. Safe to re-run.
--
-- WHY A MIGRATION FOR SOMETHING THAT LOOKS LIKE COPY.
--
-- notifications_log is not a log. It is the ceiling. Nothing sends without
-- first claiming a row here, and the unique (user_id, cycle_id, kind) is what
-- makes a duplicate physically impossible even when the function runs twice in
-- the same minute. A message kind that is not in the check constraint cannot
-- claim a row, so it cannot send at all: the insert raises, claim() returns
-- false, and the sender skips it forever with no error anywhere a person would
-- look.
--
-- So this is the whole feature, in one line. Without it the birthday email is
-- code that runs and does nothing.
--
-- WHY BIRTHDAYS HANG OFF A CYCLE AT ALL.
--
-- cycle_id is not null, and a birthday is not a fact about a cycle. It is
-- anchored to the group's newest cycle anyway, and that is not a workaround
-- being apologised for: the cycle is the unit that turns over on the group's
-- own calendar day, so "one per recipient per cycle" is exactly the ceiling
-- this message wants. Two friends with birthdays in the same window produce
-- ONE email listing both, for the same reason the digest lists every goal in
-- one message rather than sending four.
--
-- WHAT THIS CHANGES ABOUT THE PROMISE MADE ELSEWHERE.
--
-- The FAQ said two emails per cycle at most. With this it is three, and the
-- FAQ and the layout's small print have both been changed to say so. A ceiling
-- stated in a place users read is a promise, and quietly raising it while the
-- old number stays on screen is how a product starts lying about itself.
-- ============================================================================

alter table notifications_log drop constraint if exists notifications_log_kind_check;
alter table notifications_log add constraint notifications_log_kind_check
  check (kind in ('digest', 'nudge', 'birthday'));

-- No policy change. 03_policies already restricts this table to reading your
-- own rows, and the sender writes with the service role, which is the only
-- thing that ever inserts here.

notify pgrst, 'reload schema';

-- Check:
--   select kind, count(*) from notifications_log group by kind order by kind;
--   -- and that the constraint actually took:
--   insert into notifications_log (user_id, cycle_id, kind)
--   values (gen_random_uuid(), gen_random_uuid(), 'nope');
--   -- must fail on notifications_log_kind_check, not on the foreign keys
