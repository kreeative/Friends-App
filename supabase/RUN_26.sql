-- Rich & Friends: migration 26, pronouns and self-celebration.
-- Run after 25. Safe to re-run.

alter table profiles add column if not exists pronouns text;

alter table profiles drop constraint if exists profiles_pronouns_check;
alter table profiles add constraint profiles_pronouns_check
  check (pronouns is null or length(trim(pronouns)) between 1 and 40);

alter table celebrations drop constraint if exists celebrations_not_self;

notify pgrst, 'reload schema';
