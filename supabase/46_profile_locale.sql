-- ============================================================================
-- Which language to write to somebody in.
--
-- Run after 45. Safe to re-run.
--
-- WHY THE SERVER NEEDS TO KNOW THIS AT ALL.
--
-- The app is bilingual and the language lives in localStorage, on the device,
-- under `friends.locale`. That is the right home for it: it takes effect
-- instantly, it survives being signed out, and nothing on the server has ever
-- needed to render a screen.
--
-- The reminder emails change that. supabase/functions/notify runs on a
-- schedule, with nobody's browser involved, and it has to choose words. With
-- the language only on the device it had no way to choose, so both messages
-- were written in English and sent to everybody. For a product whose own
-- survey is 91 % Ivorian that is not a small rough edge: the one message the
-- app sends to somebody who has gone quiet arrives in a language they may not
-- read.
--
-- WHY IT IS NULLABLE.
--
-- Same reasoning as currency in 22, and it matters for the same reason.
-- `not null default 'en'` would make "has not said" and "chose English"
-- indistinguishable the moment the row is created, and every French account
-- would be pinned to English forever with nobody able to tell why. The client
-- writes the detected language once, on first sight, and it can only know to
-- do that while the column is still null.
--
-- Null reads as the fallback everywhere, so nothing is undefined while unset.
--
-- WHY THE LIST IS CONSTRAINED HERE AND CURRENCY'S IS NOT.
--
-- 22 argues, correctly, that the set of currencies an app supports is a client
-- decision and does not belong in a check constraint. Languages are different:
-- there are two, both are compiled into the bundle as whole dictionaries, and
-- a third one is a translation project rather than a config change. A value
-- outside this list is a bug, not a preference, and a row carrying 'de' would
-- make the sender fall back silently instead of failing where it was written.
-- ============================================================================

alter table profiles add column if not exists locale text;

alter table profiles drop constraint if exists profiles_locale_check;
alter table profiles add constraint profiles_locale_check
  check (locale is null or locale in ('fr', 'en'));

-- No policy change. profiles already has its own read and write rules and this
-- is one more column on a row somebody already owns. It is deliberately NOT
-- sensitive: which language you read is not private in the way a budget is,
-- and the group screens already show each other's names.

notify pgrst, 'reload schema';

-- Check:
--   select id, locale from profiles where locale is not null;
--   select count(*) filter (where locale is null) as not_yet_known from profiles;
