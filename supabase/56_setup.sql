-- ============================================================================
-- The five things the app asks once, on the way in.
--
-- Run after 55. Safe to re-run.
--
-- WHY ASK AT ALL.
--
-- Signing in with Google hands over a name and a photo and nothing else.
-- Signing in with an email hands over less than that: display_name is seeded
-- with the part of the address before the @, so an account starts life called
-- "annklyy" and the first thing anybody sees of a new member is a login.
--
-- Everything else was worse, because it was never asked. The theme was pink
-- for everybody, the language was guessed from the browser, the pronouns were
-- they/them by default and the cycle tracker was on a screen a man had no use
-- for. Every one of those is a setting that already existed and that nobody
-- ever found, because a preference nobody is offered is a preference nobody
-- has.
--
-- So it is asked once, in one screen, and every answer stays editable on the
-- profile afterwards. That last part is the condition for asking at all: a
-- question you cannot revisit is not a setting, it is a label somebody else
-- put on you.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Has this person been through it.
--
-- A timestamp rather than a boolean, because "when" answers a question a flag
-- cannot: whether somebody signed up before or after the flow existed, which
-- is exactly what the backfill below turns on.
--
-- THE BACKFILL RUNS ONCE, AND ONLY WHEN THE COLUMN IS CREATED.
--
-- Everybody who already has an account has already made these choices, or has
-- lived without them for months and does not need a form in front of the app
-- tomorrow morning. So they are marked as done.
--
-- But this file is meant to be safe to re-run, and a plain
--
--   update profiles set setup_done_at = now() where setup_done_at is null
--
-- is not: run it a second time next week and it silently marks every person
-- who signed up in between as having completed a setup they were never shown,
-- which is the same as deleting the feature for them. Guarding on the column's
-- own existence means the backfill happens exactly once, at the moment the
-- column appears, and every later run does nothing.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'profiles'
      and column_name  = 'setup_done_at'
  ) then
    alter table profiles add column setup_done_at timestamptz;
    update profiles set setup_done_at = now();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Which theme, on the account rather than only on the device.
--
-- The theme has always lived in localStorage, which is right: it is what the
-- screen in your hand looks like, it has to be applied before the first paint,
-- and no server is involved. It is also why choosing sun on a phone left a
-- tablet on the default, and this app is used from a phone and a tablet by the
-- same person on the same day.
--
-- So the account remembers the choice as well, and the device still wins when
-- it has one of its own. See ThemeProvider: a device with nothing stored takes
-- the account's answer, a device with something stored keeps it.
--
-- Nullable, and null means never chosen. It is not the same as 'sun': the
-- fallback is a default, this column is a decision.
-- ---------------------------------------------------------------------------
alter table profiles add column if not exists theme text;

alter table profiles drop constraint if exists profiles_theme_check;
alter table profiles add constraint profiles_theme_check
  check (theme is null or theme in ('sun', 'sea'));

-- ---------------------------------------------------------------------------
-- 3. Woman, man, or neither of those.
--
-- THIS IS NOT THE PRONOUNS COLUMN AND MUST NOT BECOME ONE.
--
-- profiles.pronouns already exists and is what the app calls somebody by. It
-- is a free string, it defaults to they/them, and migration 26 is explicit
-- that nothing may guess it from anything else. None of that changes here, and
-- no sentence in the product is written from this column.
--
-- This one exists for a single mechanical purpose: deciding whether the cycle
-- tracker is part of your app. That is a feature about a body, it is the one
-- screen in the product that is not for everybody, and the alternative to
-- asking was showing a period tracker to every man who signs up.
--
-- 'other' is a real answer and not a tidy-up bucket, which is why it does not
-- decide anything on its own. See the column below.
-- ---------------------------------------------------------------------------
alter table profiles add column if not exists gender text;

alter table profiles drop constraint if exists profiles_gender_check;
alter table profiles add constraint profiles_gender_check
  check (gender is null or gender in ('woman', 'man', 'other'));

-- ---------------------------------------------------------------------------
-- 4. Whether the cycle tracker is part of this person's app.
--
-- SEPARATE FROM gender, DELIBERATELY, AND THIS IS THE WHOLE POINT.
--
-- The setup screen sets this from the answer above, because that is what was
-- asked for and it is right nearly every time: a woman gets the tracker, a man
-- does not. But "nearly every time" is doing real work in that sentence. A
-- woman who does not menstruate should not have to answer a question about her
-- gender differently to make a period tracker go away, and somebody who
-- answered 'other' and does menstruate should not lose the feature because the
-- app could not work out what to do with them.
--
-- One derived default, one switch that overrides it, and the switch is on the
-- profile page next to the answer that set it. Reading it costs one boolean
-- everywhere the feature appears, instead of gender logic scattered across
-- four screens.
--
-- DEFAULT true, WHICH IS NOT AN OVERSIGHT.
--
-- Every account that exists today has the tracker, and this migration must not
-- take a feature away from somebody who is using it. New accounts never see
-- this default: the setup screen writes the real value before the app is
-- reachable.
-- ---------------------------------------------------------------------------
alter table profiles add column if not exists cycle_on boolean not null default true;

-- The policies are unchanged. profiles already carries "select to everyone in
-- the app, update only your own row", and these four columns are the same kind
-- of fact as display_name and pronouns beside them. Nothing here is readable
-- by anybody who could not already read the row.

notify pgrst, 'reload schema';

-- Check:
--   select count(*) filter (where setup_done_at is null) as awaiting_setup,
--          count(*) filter (where setup_done_at is not null) as done
--   from profiles;
--   -- should read 0 awaiting on the first run, since everybody predates it
--
--   select id, display_name, theme, gender, cycle_on, setup_done_at
--   from profiles order by created_at desc limit 20;
