-- ============================================================================
-- Did migration 28 actually land? Four numbers, one row.
--
-- Worth having as a file because of how 28 failed the first time. The Supabase
-- SQL editor runs a script statement by statement rather than in one
-- transaction, so when the view at the end was refused with 42P16 the three
-- statements before it had already committed. The database was left in a state
-- no migration describes: columns added, function replaced, view still the old
-- one, and nothing on screen saying so.
--
-- Every number should be 1. Anything at 0 is the step that did not run.
--
--   1_goals_proof_type   the column the goal form writes
--   2_items_link_url     the column a link proof is stored in
--   3_function_updated   submit_checkin knows how to carry a link through
--   4_view_updated       group_proofs returns links and notes, not just photos
--
-- If any of them is 0, run supabase/RUN_28.sql again. It is idempotent: the
-- alters are `if not exists`, the constraints are dropped before being added,
-- the function is `create or replace`, and the view is dropped first. Verified
-- by running it twice against a database in exactly the half-applied state
-- above, which took it from 1,1,1,0 to 1,1,1,1 without an error.
-- ============================================================================
select
  (select count(*) from information_schema.columns
     where table_name = 'goals' and column_name = 'proof_type')       as "1_goals_proof_type",
  (select count(*) from information_schema.columns
     where table_name = 'checkin_items' and column_name = 'link_url') as "2_items_link_url",
  (select count(*) from pg_proc
     where proname = 'submit_checkin' and prosrc like '%link_url%')   as "3_function_updated",
  (select count(*) from information_schema.columns
     where table_name = 'group_proofs' and column_name = 'link_url')  as "4_view_updated";
