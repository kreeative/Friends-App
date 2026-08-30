-- ============================================================================
-- Do the emails work?
--
-- Paste the whole thing into the SQL editor. Each block answers one link in
-- the chain, in order, so the first one that looks wrong is the one to fix.
--
-- THE MOST LIKELY "BUG" IS NOT A BUG.
--
-- All three messages only exist when somebody is in the state that produces
-- them. If nobody is, the function runs, finds nothing, sends nothing and
-- reports success. Block 5 is there so that case is distinguishable from a
-- broken pipeline, because the two look identical from the outside: no email.
--
-- The three, and when each one is due:
--
--   digest  . a few hours before a cycle opens
--   nudge   . a day AFTER somebody has been quiet a fortnight, not the moment
--             the nudge is raised. The group gets 24 hours to reach them first,
--             and if a friend taps "I'll check on them" in that window the mail
--             goes out in that friend's name instead of the app's
--   birthday. exactly three days before a friend's birthday, in the group's
--             own timezone. Not the week before, not the day itself
--
-- That nudge delay is new and it is the thing most likely to look broken:
-- somebody appears in block 5 as owed a nudge and no mail has gone out,
-- because it is not due yet. Block 5 says which of the two it is.
--
-- BEFORE ANY OF THIS, THE PREREQUISITES.
--
--   migrations 46, 47 and 48 run          (block 0 checks them)
--   RESEND_API_KEY and MAIL_FROM set      Project Settings -> Edge Functions
--   the notify function deployed          paste functions/notify/bundled.ts
--   04_schedule.sql run with BOTH placeholders replaced
--
-- The function is redeployed by hand, so it does NOT pick up repository
-- changes on its own. Every time the copy changes, bundled.ts has to be pasted
-- again or the inbox keeps the old wording.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0. Is the database actually ready for the mail the app now sends?
--
-- Three yes/no answers. A `false` here explains a silence that no amount of
-- looking at cron will, because the failure is downstream and silent: the
-- sender claims a row before every send, and a claim the constraint refuses
-- makes it skip that person forever with no error anywhere a person would see.
-- ----------------------------------------------------------------------------
select
  exists (
    select 1 from information_schema.columns
     where table_name = 'profiles' and column_name = 'locale'
  ) as m46_profiles_locale,

  (select pg_get_constraintdef(oid) like '%birthday%'
     from pg_constraint where conname = 'notifications_log_kind_check')
    as m47_birthday_allowed,

  (select pg_get_constraintdef(oid) like '%discouraged%'
     from pg_constraint where conname = 'daily_mood_moods_check')
    as m48_new_moods_allowed;


-- ----------------------------------------------------------------------------
-- 1. Are the two jobs registered, and are they active?
--
-- friends-tick advances cycles and RAISES the nudges. friends-notify sends.
-- Without the first, the second has nothing to find, which looks exactly like
-- the sender being broken.
--
-- Read the command column. If it still contains YOUR-PROJECT or
-- YOUR-SERVICE-ROLE-KEY then 04_schedule.sql was run without replacing them,
-- and every firing has been posting into nowhere.
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
--
-- Three kinds now. 'birthday' appearing here is the newest half of the
-- pipeline working; its absence means either nobody has a birthday three days
-- out, or migration 47 has not been run, which is block 0.
-- ----------------------------------------------------------------------------
select kind, count(*) as sent, max(sent_at) as last_one
  from notifications_log
 group by kind
 order by kind;


-- ----------------------------------------------------------------------------
-- 5. IS THERE ANYBODY TO WRITE TO?
--
-- THIS IS THE ONE TO READ BEFORE CONCLUDING ANYTHING IS BROKEN.
--
-- Each column is a reason a message would be sent in the next run, counted the
-- way the sender counts it. All zero means a correctly working pipeline with
-- nothing to do, which is the normal state of a small group where everybody is
-- checking in and nobody has a birthday this week.
--
-- nudges_due vs nudges_waiting is the distinction that matters. A nudge that
-- has been raised is NOT due until either somebody has claimed it or 24 hours
-- have passed, so a person sitting in nudges_waiting with no email is the
-- system working, not failing.
-- ----------------------------------------------------------------------------
select
  (select count(*) from cycles
    where state = 'upcoming'
      and opens_at > now()
      and opens_at < now() + interval '3 hours')
    as digests_due,

  (select count(*) from nudges
    where state in ('pending', 'claimed')
      and (claimed_by is not null or created_at < now() - interval '24 hours'))
    as nudges_due,

  (select count(*) from nudges
    where state in ('pending', 'claimed')
      and claimed_by is null
      and created_at >= now() - interval '24 hours')
    as nudges_waiting_for_the_group,

  -- A birthday exactly three days away, on the group's own calendar. The
  -- sender writes to everybody in the group EXCEPT the person whose birthday
  -- it is, so one row here is one message per other member.
  (select count(*)
     from group_members gm
     join profiles p on p.id = gm.user_id
     join groups g on g.id = gm.group_id
    where p.birthday is not null
      and extract(month from p.birthday)
          = extract(month from ((now() at time zone coalesce(g.timezone, 'UTC'))::date + 3))
      and extract(day from p.birthday)
          = extract(day from ((now() at time zone coalesce(g.timezone, 'UTC'))::date + 3)))
    as birthdays_due_in_three_days;


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


-- ----------------------------------------------------------------------------
-- 7. Who would get a birthday mail, and about whom.
--
-- Only worth running if block 5 shows a birthday due and nothing arrived. It
-- names the recipients, so an empty result next to a non-zero count in block 5
-- means the only member of that group is the birthday person themselves, which
-- is a group of one and correctly sends nothing.
-- ----------------------------------------------------------------------------
select g.name as group_name,
       who.display_name as birthday_person,
       reader.display_name as would_be_emailed
  from group_members gm
  join profiles who on who.id = gm.user_id
  join groups g on g.id = gm.group_id
  join group_members rm on rm.group_id = gm.group_id and rm.user_id <> gm.user_id
  join profiles reader on reader.id = rm.user_id
 where who.birthday is not null
   and extract(month from who.birthday)
       = extract(month from ((now() at time zone coalesce(g.timezone, 'UTC'))::date + 3))
   and extract(day from who.birthday)
       = extract(day from ((now() at time zone coalesce(g.timezone, 'UTC'))::date + 3))
 order by g.name, who.display_name;


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
