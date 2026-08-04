-- ============================================================================
-- Friends v2 — the scheduled heartbeat
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
-- service role key out of the client — it bypasses every RLS policy.
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

-- Inspect or remove:
--   select * from cron.job;
--   select cron.unschedule('friends-tick');
