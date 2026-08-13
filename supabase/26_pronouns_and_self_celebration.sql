-- ============================================================================
-- Pronouns, and celebrating yourself.
--
-- Run after 25. Safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Pronouns.
--
-- The app writes sentences about people who are not reading them: "Rue will
-- see it when they open the app". Every one of those was hard-coded to
-- they/them, which is the right default and is not an answer for somebody who
-- has told you otherwise.
--
-- NULLABLE, AND NULL IS NOT they/them.
--
-- Null means "has not said", which is a different fact from having chosen the
-- neutral set, and the difference is visible on a profile: an unanswered
-- profile shows nothing rather than asserting a set on somebody's behalf. The
-- client resolves null to they/them when it needs a word, which is the only
-- option that cannot be wrong about a person.
--
-- The display string itself is stored, "she/her", "ze/hir", rather than a code
-- with a lookup table. It is what a person would write, and it means a set the
-- client has never heard of still renders correctly on their profile. A column
-- of codes would need a migration every time somebody used a set nobody had
-- thought of.
--
-- 'none' is the one reserved value: somebody who answered by declining. It is
-- stored rather than left null so that the difference between "asked and said
-- no" and "never asked" survives.
-- ---------------------------------------------------------------------------
alter table profiles add column if not exists pronouns text;

-- A length bound and nothing else. There is no list of valid pronouns and
-- there should not be one in a check constraint: the point of the free text
-- box is that the set nobody thought of is allowed.
alter table profiles drop constraint if exists profiles_pronouns_check;
alter table profiles add constraint profiles_pronouns_check
  check (pronouns is null or length(trim(pronouns)) between 1 and 40);

-- ---------------------------------------------------------------------------
-- 2. Celebrating yourself.
--
-- 25 refused it, on the reasoning that celebrating yourself is not what the
-- feature is for and would be the first thing somebody tried through a
-- console. On reflection that is the app deciding what somebody is allowed to
-- be pleased about.
--
-- "I passed my driving test" is a real thing to say to a group of friends, and
-- the alternative was waiting for somebody else to notice, or not saying it.
-- The constraint went further than a rule about abuse: nothing is gained by
-- refusing it, since a celebration is already public to the group and signed
-- with the sender's name, so anybody overdoing it is visible to exactly the
-- people who would tell them.
--
-- Everything else stands: still as yourself, still into a group you are in,
-- still about somebody who is also in it. Yourself now passes that last test
-- rather than failing a separate one.
-- ---------------------------------------------------------------------------
alter table celebrations drop constraint if exists celebrations_not_self;

notify pgrst, 'reload schema';

-- Check:
--   select display_name, pronouns from profiles order by created_at;
--   select conname from pg_constraint where conrelid = 'celebrations'::regclass;
