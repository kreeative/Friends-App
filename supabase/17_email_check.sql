-- ============================================================================
-- Why no reminder email has arrived.
--
-- Read-only. Creates one function, selects from it, changes nothing else.
--
-- Sending a reminder needs four things lined up, and any one of them failing
-- looks identical from outside: no email, no error, nothing in the app to
-- suggest anything is wrong. This says which one.
--
--   1. pg_cron and pg_net installed
--   2. jobs friends-tick and friends-notify scheduled
--   3. friends-notify pointing at a real project URL and key, not the
--      placeholders 04_schedule.sql ships with
--   4. the `notify` Edge Function deployed and answering
--
-- Returns a TABLE rather than raising notices, and that is the whole point of
-- this rewrite. The first version reported through `raise notice`, which is
-- fine in psql and invisible in the Supabase SQL Editor: it printed "Success.
-- No rows returned" and told the reader nothing at all. A diagnostic that
-- reports through a channel its audience cannot see is worse than no
-- diagnostic, because it also costs a round trip and some confidence.
--
-- Every lookup is guarded and dynamic. cron.job and net._http_response do not
-- exist until their extensions are installed, and a plain reference to either
-- fails to parse on exactly the database this is meant to diagnose.
--
-- Drop it afterwards if you like:  drop function email_check();
-- ============================================================================

create or replace function email_check()
returns table (step int, item text, status text)
language plpgsql
as $$
declare
  has_cron boolean;
  has_net  boolean;
  cmd      text;
  sched    text;
  act      boolean;
  total    int;
  r        record;
  n        int := 0;
begin
  select exists(select 1 from pg_extension where extname='pg_cron') into has_cron;
  select exists(select 1 from pg_extension where extname='pg_net')  into has_net;

  n := n+1; step := n; item := 'pg_cron extension';
  status := case when has_cron then 'ok'
                 else 'MISSING. Database > Extensions, enable pg_cron' end;
  return next;

  n := n+1; step := n; item := 'pg_net extension';
  status := case when has_net then 'ok'
                 else 'MISSING. Database > Extensions, enable pg_net' end;
  return next;

  if not has_cron then
    n := n+1; step := n; item := 'scheduled jobs';
    status := 'cannot check, pg_cron is not installed';
    return next;
    return;
  end if;

  execute $q$select schedule, active from cron.job where jobname='friends-tick'$q$
    into sched, act;
  n := n+1; step := n; item := 'job friends-tick';
  status := case when sched is null then 'MISSING. The scheduling SQL did not run'
                 when not act      then 'DISABLED'
                 else 'ok, runs ' || sched end;
  return next;

  execute $q$select command, schedule, active from cron.job where jobname='friends-notify'$q$
    into cmd, sched, act;
  n := n+1; step := n; item := 'job friends-notify';
  status := case when cmd is null then 'MISSING. The scheduling SQL did not run'
                 when not act     then 'DISABLED'
                 else 'ok, runs ' || sched end;
  return next;

  if cmd is not null then
    n := n+1; step := n; item := 'friends-notify target';
    status := case
      when cmd like '%YOUR-PROJECT%' or cmd like '%YOUR-SERVICE-ROLE-KEY%'
        then 'PLACEHOLDERS STILL THERE. It is posting to a hostname that does not exist'
      else 'ok, a real URL and key' end;
    return next;
  end if;

  if not has_net then return; end if;

  execute $q$select count(*) from net._http_response$q$ into total;
  if total = 0 then
    n := n+1; step := n; item := 'calls made so far';
    status := 'none yet. cron fires on the hour, or press Invoke on the function';
    return next;
    return;
  end if;

  for r in execute $q$
    select status_code, count(*) as calls, max(created) as most_recent
    from net._http_response group by status_code order by max(created) desc
  $q$ loop
    n := n+1; step := n;
    item := 'HTTP ' || coalesce(r.status_code::text,'(no response)') || ', ' || r.calls || ' call(s)';
    status := case
      when r.status_code between 200 and 299
        then 'ok, the function answered. Last at ' || r.most_recent
      when r.status_code = 404
        then 'FAIL. Nothing deployed at that URL. Check the project ref'
      when r.status_code in (401,403)
        then 'FAIL. Rejected. Is JWT verification still on, or the key wrong?'
      when r.status_code >= 500
        then 'FAIL. The function errored. Check its Logs tab'
      else 'unexpected, check the function Logs tab' end;
    return next;
  end loop;
end;
$$;

select * from email_check() order by step;
