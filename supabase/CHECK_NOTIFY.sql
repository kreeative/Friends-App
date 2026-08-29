-- ============================================================================
-- Is the reminder pipeline actually running?
--
-- Paste the whole thing into the SQL editor. Each block answers one link in
-- the chain, in order, so the first one that looks wrong is the one to fix.
--
-- THE MOST LIKELY "BUG" IS NOT A BUG.
--
-- A nudge only exists for somebody at two consecutive missed cycles. If nobody
-- is in that state, the function runs, finds nothing, sends nothing and
-- reports success. Block 5 is there so that case is distinguishable from a
-- broken pipeline, because the two look identical from the outside: no email.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Are the two jobs registered, and are they active?
--
-- friends-tick advances cycles and RAISES the nudges. friends-notify sends.
-- Without the first, the second has nothing to find, which looks exactly like
-- the sender being broken.
-- ----------------------------------------------------------------------------
select jobname, schedule, active, command
  from cron.job
 order by jobname;


-- ----------------------------------------------------------------------------
-- 2. Did they actually run, and did they succeed?
--
-- status 'failed' with a message is a SQL-level failure: a bad URL string, a
-- missing extension. It is not the Edge Function returning an error, which is
-- block 3.
-- ----------------------------------------------------------------------------
select j.jobname,
       r.status,
       r.return_message,
       r.start_time
  from cron.job_run_details r
  join cron.job j on j.jobid = r.jobid
 order by r.start_time desc
 limit 20;


-- ----------------------------------------------------------------------------
-- 3. What did the Edge Function answer?
--
-- pg_net is asynchronous: cron.job_run_details says the REQUEST was made, not
-- that it worked. The answer lands here, and only for the last 6 hours.
--
--   200 and {"ok":true}   the function ran. Whether it sent anything is 4 and 5.
--   401                   the Authorization header is wrong. Use the
--                         service_role key, not the anon key.
--   404                   the function is not deployed, or is deployed under a
--                         different name than 'notify'.
--   500                   the function threw. Its own logs say why:
--                         Dashboard -> Edge Functions -> notify -> Logs.
--
-- Every column null except id, error_msg and created is pg_net's timeout
-- signature, not an answer from the function.
-- ----------------------------------------------------------------------------
select id,
       status_code,
       left(content, 300) as body,
       error_msg,
       created
  from net._http_response
 order by created desc
 limit 10;


-- ----------------------------------------------------------------------------
-- 4. Has anything been sent?
--
-- One row per email, written BEFORE the send. A row here means the function
-- claimed the right to send; the send itself either happened or was logged as
-- failed in the function's own logs. No rows at all means it never got that
-- far, which sends you back to 3, or means block 5 has nobody in it.
-- ----------------------------------------------------------------------------
select kind, count(*) as sent, max(sent_at) as last_one
  from notifications_log
 group by kind
 order by kind;


-- ----------------------------------------------------------------------------
-- 5. Is there anybody to write to?
--
-- THIS IS THE ONE TO READ BEFORE CONCLUDING ANYTHING IS BROKEN.
--
-- nudges: raised by tick() when somebody reaches two consecutive misses.
-- upcoming: a cycle opening in the next three hours is what triggers a digest.
--
-- Both empty means a correctly working pipeline with nothing to do. It is the
-- normal state of a small group where everybody is checking in.
-- ----------------------------------------------------------------------------
select
  (select count(*) from nudges where state in ('pending', 'claimed'))
    as people_owed_a_nudge,
  (select count(*) from cycles
    where state = 'upcoming'
      and opens_at > now()
      and opens_at < now() + interval '3 hours')
    as cycles_opening_soon;


-- ----------------------------------------------------------------------------
-- 6. Does anybody have a language on file?
--
-- Null is fine and falls back to French. This is only worth looking at if
-- somebody reports an email in the wrong language: the count climbs on its own
-- as people open the app, since the client writes it once per profile.
-- ----------------------------------------------------------------------------
select coalesce(locale, '(not yet known)') as locale, count(*)
  from profiles
 group by 1
 order by 2 desc;


-- ============================================================================
-- FIRE IT NOW, instead of waiting for the top of the hour.
--
-- Replace both placeholders. Then re-run block 3 a few seconds later: the
-- response is asynchronous and will not be there instantly.
--
-- Safe to run repeatedly. Every send first claims a row in notifications_log,
-- whose unique (user_id, cycle_id, kind) constraint makes a duplicate
-- physically impossible, so running this ten times cannot send ten emails.
-- ============================================================================

-- select net.http_post(
--   url     := 'https://YOUR-PROJECT.supabase.co/functions/v1/notify',
--   headers := jsonb_build_object(
--     'Content-Type',  'application/json',
--     'Authorization', 'Bearer YOUR-SERVICE-ROLE-KEY'
--   ),
--   body    := '{}'::jsonb
-- );
