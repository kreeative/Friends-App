-- ============================================================================
-- One entry that does not count.
--
-- Run after 28. Safe to re-run.
--
-- A refund landing back in the account, a transfer between your own pockets, a
-- flight your employer pays back next month: all of them are real movements
-- worth having a record of, and none of them should move the number that says
-- what you have left this period. Without somewhere to put them, the honest
-- options are both bad. Delete the row and lose the record, or leave it in and
-- watch the budget lie by exactly its amount.
--
-- A flag on the row rather than a category, because it is not a kind of
-- spending. It is the same spending, marked as not counting, and a category
-- named "does not count" would sit in the breakdown pretending to be one.
-- ============================================================================
alter table budget_entry add column if not exists excluded boolean not null default false;

-- The period read filters on this, so it belongs in the index the period read
-- already uses. Partial, so the index stays the size of the counting set:
-- excluded rows are the rare ones and none of the sums ever ask for them.
create index if not exists budget_entry_counting_idx
  on budget_entry (user_id, happened_on desc) where not excluded;

notify pgrst, 'reload schema';

-- Check:
--   select happened_on, kind, amount_cents, excluded, note
--     from budget_entry order by happened_on desc limit 20;
