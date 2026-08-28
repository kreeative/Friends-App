-- ============================================================================
-- Remove imported transactions left behind by a bank that is already gone.
--
-- Run after 44. Safe to re-run. On a healthy database it deletes nothing.
--
-- WHAT THIS CLEANS UP.
--
-- 44 shipped with disconnect KEEPING the imported transactions, on the
-- reasoning that unlinking a bank means "stop reading my account" and not
-- "erase my history". That was overruled and the route was changed to remove
-- them, but anybody who disconnected in between is left in a state the app can
-- no longer reach:
--
--   plaid_item   deleted, so the bank is gone from the list
--   plaid_entry  still there, pointing at
--   budget_entry rows that are still in the budget
--
-- There is no Disconnect button for a bank that is already disconnected, so
-- those rows cannot be removed in bulk from any screen. They have to be
-- deleted one at a time, which for a few hundred imported transactions is not
-- a real option.
--
-- WHAT IT WILL NOT TOUCH.
--
-- Only rows the import created, found through plaid_entry, and only where the
-- plaid_item they belong to no longer exists. A transaction typed by hand has
-- no plaid_entry row and is never reached, INCLUDING one typed for the same
-- shop, the same amount and the same day as an imported one. That case was
-- checked against a real Postgres 16 before this file was written, because
-- matching on label and amount instead of on the link id is how a cleanup
-- becomes data loss.
--
-- Rows belonging to a bank that is STILL CONNECTED are not touched either.
-- Disconnecting that bank is what removes those, and it says how many first.
--
-- LOOK BEFORE YOU RUN IT.
--
-- This deletes budget rows and there is no undo. The SELECT at the top is the
-- same query as the DELETE below it, so run that first and read the list. If
-- it returns nothing, you have nothing to clean up and the rest is a no-op.
--
-- If you disconnected a bank while the old behaviour was live and you WANTED
-- to keep those transactions, do not run this file. Nothing else depends on
-- it; the orphaned plaid_entry rows are inert.
--
-- WHY THERE IS NO auth.uid() IN THIS FILE.
--
-- The first draft scoped every statement with `user_id = auth.uid()`, the way
-- the rest of this schema does. It was wrong twice, and the second way is the
-- dangerous one:
--
--   In the Supabase SQL editor there is no JWT, so auth.uid() returns NULL and
--   every `where user_id = auth.uid()` matches nothing. The file would have
--   run without error, reported nothing, deleted nothing, and left somebody
--   certain the cleanup was broken.
--
--   And run as `authenticated` instead, the plaid_item subquery fails outright
--   with "permission denied for table plaid_item", because 44 revokes every
--   privilege on that table from that role on purpose.
--
-- So this is a maintenance script, run by the project owner in the SQL editor,
-- as the superuser that editor already gives you. It works on every row that
-- is orphaned rather than on one person's, which is the right scope: a link
-- row whose bank is gone is orphaned for whoever owns it.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1. Read only. What would go.
-- ----------------------------------------------------------------------------
select e.happened_on,
       e.note,
       e.amount_cents,
       e.category,
       p.item_id as from_disconnected_bank
  from plaid_entry p
  join budget_entry e on e.id = p.entry_id
 where not exists (
     select 1 from plaid_item i
      where i.user_id = p.user_id
        and i.item_id = p.item_id)
 order by e.happened_on desc;

-- ----------------------------------------------------------------------------
-- STEP 2. Remove them.
--
-- The entries first, then the link rows. The other order would delete the only
-- record of which entries were imported and leave them behind for good.
-- ----------------------------------------------------------------------------
delete from budget_entry
 where id in (
   select p.entry_id
     from plaid_entry p
    where p.entry_id is not null
      and not exists (
        select 1 from plaid_item i
         where i.user_id = p.user_id
           and i.item_id = p.item_id));

-- The link rows for those same dead banks, including the ones whose entry_id
-- is already null because the person had deleted that transaction by hand.
-- Nothing points at them any more and keeping them would only make a later
-- re-link of the same bank skip transactions it should re-import.
delete from plaid_entry p
 where not exists (
   select 1 from plaid_item i
    where i.user_id = p.user_id
      and i.item_id = p.item_id);

-- ----------------------------------------------------------------------------
-- STEP 3. Check. Both must be 0.
-- ----------------------------------------------------------------------------
select
  (select count(*) from plaid_entry p
    where not exists (select 1 from plaid_item i
                       where i.user_id = p.user_id and i.item_id = p.item_id))
    as orphan_links_left,
  (select count(*) from plaid_entry p
     join budget_entry e on e.id = p.entry_id
    where not exists (select 1 from plaid_item i
                       where i.user_id = p.user_id and i.item_id = p.item_id))
    as orphan_transactions_left;

-- No schema change here, so no reload is needed. Left out on purpose rather
-- than copied from the other migrations out of habit.
