-- ---------------------------------------------------------------------------
-- 55. Answering a nudge.
--
-- "X is asking after you" arrives and there is nothing to do with it. The
-- quiet person reads it, feels the nudge, and has no way to say the one thing
-- the sender actually wants to hear back: I am fine.
--
-- So a nudge gets a reply, and the reply is a notification of its own going
-- the other way. One tap, no typing. The point of the whole feature is two
-- people making contact, and a message that can only be received is half of
-- that.
--
-- WHY A NEW KIND RATHER THAN REUSING 'nudge'.
--
-- The wording is addressed in the opposite direction. A row of kind 'nudge'
-- reads "somebody is asking after you"; the reply reads "X is doing fine".
-- Reusing the kind would print the wrong sentence at the wrong person, which
-- is the exact bug migration 54 caused by widening a constraint and leaving
-- the renderer behind. See the notes in Notifications.jsx.
--
-- Safe to run twice.
-- ---------------------------------------------------------------------------

alter table notification drop constraint if exists notification_kind_check;
alter table notification add constraint notification_kind_check
  check (kind in ('group_goal', 'book', 'nudge', 'nudge_reply'));

notify pgrst, 'reload schema';

-- Check:
--   select kind, count(*) from notification group by kind;
--   -- and that the constraint takes the new value:
--   select 'nudge_reply' in ('group_goal','book','nudge','nudge_reply') as ok;
