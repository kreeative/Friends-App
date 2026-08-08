-- ============================================================================
-- Why no reminder emails have arrived.
--
-- Read-only. Run it and read the messages; it changes nothing.
--
-- Sending a reminder needs four things lined up, and the failure of any one of
-- them looks identical from outside: no email, no error, and nothing anywhere
-- in the app to suggest something is wrong. This says which one.
--
--   1. pg_cron and pg_net installed
--   2. jobs called friends-tick and friends-notify scheduled
--   3. friends-notify pointing at a real project URL and key, rather than the
--      placeholders 04_schedule.sql ships with
--   4. the `notify` Edge Function deployed, with RESEND_API_KEY set
--
-- Only the first three are visible from in here. The fourth is inferred at the
-- end from whether any call has ever come back 2xx.
--
-- Everything runs inside one block that checks before it looks. An earlier
-- draft of this file queried cron.job directly and failed with "relation
-- cron.job does not exist" on precisely the database it was written to
-- diagnose, which is a diagnostic that only works once you no longer need it.
-- ============================================================================
do $$
declare
  has_cron  boolean;
  has_net   boolean;
  cmd       text;
  sched     text;
  is_active boolean;
  r         record;
  total     int;
begin
  select exists (select 1 from pg_extension where extname = 'pg_cron') into has_cron;
  select exists (select 1 from pg_extension where extname = 'pg_net')  into has_net;

  raise notice '--------------------------------------------------------------';
  raise notice 'Rich & Friends: reminder email check';
  raise notice '--------------------------------------------------------------';

  -- 1. Extensions ------------------------------------------------------------
  if has_cron then
    raise notice '[ok]   pg_cron installed';
  else
    raise notice '[FAIL] pg_cron missing. Database > Extensions, enable pg_cron.';
  end if;

  if has_net then
    raise notice '[ok]   pg_net installed';
  else
    raise notice '[FAIL] pg_net missing. Database > Extensions, enable pg_net.';
  end if;

  if not has_cron then
    raise notice '';
    raise notice 'Nothing is scheduled, so nothing has ever tried to send.';
    raise notice 'Enable the extensions above, then run 04_schedule.sql.';
    return;
  end if;

  -- 2. Jobs ------------------------------------------------------------------
  execute $q$ select schedule, active from cron.job where jobname = 'friends-tick' $q$
    into sched, is_active;
  if sched is null then
    raise notice '[FAIL] job friends-tick missing. Run 04_schedule.sql.';
  elsif not is_active then
    raise notice '[FAIL] job friends-tick exists but is disabled.';
  else
    raise notice '[ok]   job friends-tick scheduled (%)', sched;
  end if;

  execute $q$ select command, schedule, active from cron.job where jobname = 'friends-notify' $q$
    into cmd, sched, is_active;

  if cmd is null then
    raise notice '[FAIL] job friends-notify missing. Run 04_schedule.sql.';
    return;
  elsif not is_active then
    raise notice '[FAIL] job friends-notify exists but is disabled.';
  else
    raise notice '[ok]   job friends-notify scheduled (%)', sched;
  end if;

  -- 3. Placeholders ----------------------------------------------------------
  --
  -- This is the one that catches most people. 04_schedule.sql contains the
  -- literal strings YOUR-PROJECT and YOUR-SERVICE-ROLE-KEY with an instruction
  -- above them to replace both. Run unedited, it schedules a job that posts to
  -- a hostname that does not exist, every hour, for ever, silently.
  if cmd like '%YOUR-PROJECT%' or cmd like '%YOUR-SERVICE-ROLE-KEY%' then
    raise notice '[FAIL] friends-notify still contains the placeholders from 04_schedule.sql.';
    raise notice '       It is posting to a hostname that does not exist.';
    raise notice '       Re-run 04_schedule.sql with your real project ref and service role key.';
  else
    raise notice '[ok]   friends-notify has a real target';
  end if;

  -- 4. Did any call ever land ------------------------------------------------
  if not has_net then
    raise notice '';
    raise notice 'pg_net is missing, so there is no call history to look at.';
    return;
  end if;

  execute $q$ select count(*) from net._http_response $q$ into total;

  raise notice '';
  if total = 0 then
    raise notice '[FAIL] No HTTP calls recorded. The job has never actually run.';
    raise notice '       cron runs on the hour; if it was just scheduled, wait one.';
    return;
  end if;

  for r in
    execute $q$
      select status_code, count(*) as calls, max(created) as most_recent
      from net._http_response group by status_code order by max(created) desc
    $q$
  loop
    raise notice '  % call(s) returned %, most recent %',
      r.calls, coalesce(r.status_code::text, 'no response'), r.most_recent;

    if r.status_code between 200 and 299 then
      raise notice '       [ok] the function answered';
    elsif r.status_code = 404 then
      raise notice '       [FAIL] notify is not deployed. Run: supabase functions deploy notify';
    elsif r.status_code in (401, 403) then
      raise notice '       [FAIL] the function rejected the key in the cron job';
    elsif r.status_code >= 500 then
      raise notice '       [FAIL] the function errored. Check its logs and RESEND_API_KEY';
    else
      raise notice '       [??]  unexpected, check the function logs';
    end if;
  end loop;

  raise notice '';
  raise notice 'Nothing here can tell you whether Resend delivered a message.';
  raise notice 'If every line above is ok and no email arrives, check Resend:';
  raise notice 'an unverified sending domain accepts the API call and then does';
  raise notice 'not deliver, which reads as 200 here and silence in the inbox.';
end $$;
