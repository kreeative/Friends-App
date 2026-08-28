-- ============================================================================
-- Paying a fixed charge logs the transaction, and the two stay attached.
--
-- Run after 42. Safe to re-run.
--
-- THE ARITHMETIC BUG THIS FIXES.
--
-- summarise() in src/lib/budget.js computes:
--
--   balance   = earned - spent            (spent = logged transactions)
--   fixedDue  = committed - fixedPaid     (what the plan still owes)
--   available = balance - fixedDue
--
-- and 35 made "Payer" write last_paid_on, which moves a charge out of
-- fixedDue. Nothing wrote a transaction, so `spent` never moved.
--
-- Measured, on a 3 000 income with a 1 000 rent:
--
--   before Payer   available = 2 000
--   after  Payer   available = 3 000   <-- went UP by the rent
--
-- Paying the rent made the app say there was a thousand MORE to spend. The
-- comment in FixedCharges.jsx said this was deliberate, on the grounds that
-- also logging a transaction would double-count. It would, for anybody who
-- then logs it by hand; the trouble is that the default path, which is to tap
-- Payer and nothing else, was simply wrong. Both halves have to move or
-- neither does.
--
-- With the transaction written, spent goes up by 1 000 and fixedDue goes down
-- by 1 000, so available stays at 2 000 and the ledger gains the line that
-- actually happened. That is the correct answer to both questions at once.
--
-- WHY A COLUMN AND NOT A MATCH ON label AND amount.
--
-- Unmarking has to remove the transaction it created, and finding it again by
-- comparing label, amount and date would also match a spend the person entered
-- themselves for the same rent on the same day. Deleting somebody's own row
-- because it resembles ours is not a tidy-up, it is data loss.
--
-- So the charge remembers which entry it wrote. One id, nullable, and the
-- reference is `on delete set null`: deleting the transaction by hand from the
-- ledger is allowed and simply detaches it, rather than being blocked or
-- silently taking the charge's paid state with it.
-- ============================================================================

alter table budget_fixed
  add column if not exists paid_entry_id uuid
  references budget_entry(id) on delete set null;

-- Reading it goes the other way too: "is this entry the one a charge wrote",
-- asked when the ledger row is being deleted.
create index if not exists budget_fixed_paid_entry_idx
  on budget_fixed(paid_entry_id);

-- No policy change. budget_fixed and budget_entry are both already
-- `user_id = auth.uid()` on all four verbs (19_budget.sql), and this column
-- joins two tables the same person already owns outright. Nothing here widens
-- anybody's read by a row.

notify pgrst, 'reload schema';

-- Check:
--   select f.label, f.last_paid_on, e.amount_cents, e.note
--     from budget_fixed f
--     left join budget_entry e on e.id = f.paid_entry_id
--    where f.user_id = auth.uid();
