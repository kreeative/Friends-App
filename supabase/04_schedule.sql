-- ============================================================================
-- Friends v2, the scheduled heartbeat
-- Run last, after deploying the `notify` Edge Function.
--
-- This file is what makes §5 (a response to silence) possible at all. A static
-- site only executes when someone opens it, and the person who has gone quiet
-- is by definition not opening it. Something has to run on its own.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Every 10 minutes: top up cycles, open/close windows, raise nudges.
-- tick() is idempotent, so a missed or doubled run costs nothing.
select cron.schedule(
  'friends-tick',
  '*/10 * * * *',
  $$ select tick() $$
);

-- Hourly: hand the send decision to the Edge Function. It walks every group,
-- so an hourly cadence covers all timezones without a job per group.
--
-- Replace YOUR-PROJECT and YOUR-SERVICE-ROLE-KEY before running. Keep the
-- service role key out of the client, it bypasses every RLS policy.
select cron.schedule(
  'friends-notify',
  '0 * * * *',
  $$
  select net.http_post(
    url     := 'https://YOUR-PROJECT.supabase.co/functions/v1/notify',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer YOUR-SERVICE-ROLE-KEY'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- ---------------------------------------------------------------------------
-- Every 5 minutes: the reminders of the day. Water, and calendar events.
--
-- WHY A SECOND JOB RATHER THAN A FASTER FIRST ONE.
--
-- The hourly job is right for what it does: a digest goes out in the evening,
-- a nudge after a fortnight of silence, a birthday three days ahead. None of
-- that needs a finer clock, and running it twelve times an hour would walk
-- every group twelve times for the same result, since notifications_log caps
-- each message at one per person per cycle anyway.
--
-- The reminders need the opposite. A reminder thirty minutes before an 18:30
-- training has to leave at 18:00, and a water reminder falls where the
-- calculation puts it, not at the top of an hour. On the hourly job, half of
-- the day's reminders would arrive up to fifty-nine minutes late, which for a
-- reminder means not at all.
--
-- Five minutes, and not one, because the Edge Function has an invocation cost
-- and a reminder five minutes early or late is still a reminder. 288 runs a
-- day, against 24, and each one does nothing at all when nobody is due: two
-- indexed lookups that return no rows.
--
-- Replace YOUR-PROJECT and YOUR-SERVICE-ROLE-KEY, same as above.
select cron.schedule(
  'friends-reminders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := 'https://YOUR-PROJECT.supabase.co/functions/v1/notify',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer YOUR-SERVICE-ROLE-KEY'
    ),
    -- The job names itself. The function tells its three callers apart by what
    -- they ask for and never by the HTTP method: a note in index.ts records
    -- what deciding by method cost the last time, which was every scheduled
    -- message in the product, silently, for weeks.
    body    := '{"job":"reminders"}'::jsonb
  );
  $$
);

-- Nightly: trim the reminder journal. One row per reminder sent, kept thirty
-- days, is a few thousand rows; kept forever it becomes the biggest table in
-- the database for information that matters for five minutes.
select cron.schedule(
  'friends-prune-reminders',
  '17 4 * * *',
  $$ select prune_reminder_log() $$
);

-- Inspect or remove:
--   select * from cron.job;
--   select cron.unschedule('friends-tick');
--   select cron.unschedule('friends-reminders');
--
-- Did the five-minute job actually run, and what did it say?
--   select status_code, content::jsonb ->> 'sent', created
--     from net._http_response order by created desc limit 5;
--
-- `migrationPending: true` in that body means 57_reminders.sql has not been
-- run yet. That is the first thing to check if no reminder ever arrives.
