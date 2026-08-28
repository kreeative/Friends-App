-- ============================================================================
-- Importing transactions from a linked bank, via Plaid.
--
-- Run after 43. Safe to re-run.
--
-- THE ACCESS TOKEN IS THE MOST DANGEROUS STRING THIS PROJECT WILL EVER STORE.
--
-- 19_budget.sql says of the budget tables: "the rest of the app is built to be
-- seen by four other people; this is built to be seen by nobody... That is not
-- a default to be relaxed later, it is the feature."
--
-- A Plaid access_token is stricter than that again. The budget rows are a
-- record of what somebody spent. The access_token is a live bearer credential
-- to their actual bank account, and it is not read by the owner in any flow:
-- only the server ever needs it, only to call Plaid, and it is useful to an
-- attacker the moment it is copied anywhere.
--
-- So budget_entry's rule, "user_id = auth.uid()", is NOT strict enough here.
-- If the owner's browser can select it, then any script that runs on the page
-- can select it too, and one cross-site scripting bug becomes bank access
-- rather than a leaked budget.
--
-- plaid_item therefore has:
--
--   * row level security enabled with NO POLICIES AT ALL. In Postgres that
--     denies everything to every non-superuser role. Not "the owner only",
--     nothing.
--   * all privileges revoked from anon and authenticated, so PostgREST will
--     not expose the table at any URL even if a policy is added by mistake
--     later. Both halves, because either alone can be undone by one line.
--
-- The service role bypasses RLS and is the only thing that reads it. It lives
-- in the Vercel environment and is never sent to a browser, which is the same
-- arrangement api/checkout.js already relies on.
--
-- The owner still needs to see which bank is connected and when it last
-- synced. That is what my_bank_connections() is for: a security definer
-- function returning the safe columns and only those. Same pattern as
-- my_project_invites() in 41, and the same reason: expose the answer, not the
-- table.
-- ============================================================================

create table if not exists plaid_item (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,

  -- Plaid's own identifiers. item_id is stable for the life of the link and is
  -- what a webhook would arrive quoting.
  item_id       text not null,
  access_token  text not null,

  -- Shown to the owner so "which bank is this" has an answer that is not a
  -- uuid. Nullable because Plaid does not always resolve an institution.
  institution   text,

  -- The cursor for /transactions/sync. Null means "never synced", which is a
  -- different thing from "synced and found nothing", and the sync route treats
  -- them differently: a null cursor asks Plaid for the full history.
  cursor        text,

  -- Set when Plaid tells us the link is broken and the person has to re-auth.
  -- A dead link that looks alive is worse than one that says it is dead.
  status        text not null default 'good' check (status in ('good', 'reauth', 'revoked')),

  last_synced_at timestamptz,
  created_at     timestamptz not null default now(),

  -- One row per Plaid item. Re-linking the same bank updates rather than
  -- accumulating dead tokens next to live ones.
  unique (user_id, item_id)
);

create index if not exists plaid_item_user_idx on plaid_item (user_id);

alter table plaid_item enable row level security;

-- No policies. See the note above: this is deliberate and is the whole design,
-- not an oversight to be filled in later.

-- Belt as well as braces. RLS decides which ROWS a role may see; these decide
-- whether the role may address the table at all. PostgREST builds its API from
-- the grants, so revoking them takes the table off the wire entirely.
revoke all on plaid_item from anon, authenticated;


-- ============================================================================
-- Which imported transaction is which, so a re-sync cannot duplicate one.
--
-- WHY A LINK TABLE AND NOT A COLUMN ON budget_entry.
--
-- budget_entry is the hand-kept ledger. Hanging a Plaid id off it would put a
-- vendor's identifier in the middle of the table that has to keep working when
-- somebody never connects a bank at all, and it would mean the import needs
-- write access to a column on every row rather than to its own table.
--
-- WHY entry_id IS `on delete set null` AND THE ROW SURVIVES.
--
-- This is the part that is easy to get wrong. If somebody deletes an imported
-- transaction from their ledger, the next sync must NOT put it back.
--
-- With `on delete cascade` the link row would vanish with the entry, the next
-- sync would see a Plaid transaction it has no record of, and it would import
-- it again. The person would delete it again. Forever, every sync, and they
-- would have no way to find out why.
--
-- So the link row is the memory of "this Plaid transaction has been dealt
-- with", and it outlives the entry it created. entry_id going null is exactly
-- the signal "imported once, then deleted on purpose, leave it alone".
--
-- Same reasoning as budget_fixed.paid_entry_id in 43, for the same reason:
-- deleting somebody's row because it resembles ours is not a tidy-up.
-- ============================================================================

create table if not exists plaid_entry (
  plaid_transaction_id text primary key,
  user_id  uuid not null references profiles(id) on delete cascade,
  item_id  text not null,
  entry_id uuid references budget_entry(id) on delete set null,

  -- Kept so a removed-then-readded Plaid transaction can be told apart from a
  -- deletion by the person. Plaid does re-issue ids in rare correction flows.
  imported_at timestamptz not null default now()
);

create index if not exists plaid_entry_user_idx  on plaid_entry (user_id);
create index if not exists plaid_entry_entry_idx on plaid_entry (entry_id);

alter table plaid_entry enable row level security;

-- This one the owner MAY read: it holds no credential, only which of their own
-- ledger rows came from an import, which is what lets the ledger mark a row as
-- imported rather than typed.
drop policy if exists plaid_entry_read   on plaid_entry;
drop policy if exists plaid_entry_write  on plaid_entry;
drop policy if exists plaid_entry_update on plaid_entry;
drop policy if exists plaid_entry_delete on plaid_entry;

create policy plaid_entry_read on plaid_entry for select using (user_id = auth.uid());

-- READ AND NOTHING ELSE, AND THE GRANT SAYS SO TOO.
--
-- Every write to this table is made by the sync route with the service role.
-- The browser never inserts here, so there is no insert policy: a policy for a
-- verb nobody may use is dead text that reads like a capability.
--
-- The grant is explicit rather than left to Supabase's default privileges on
-- the public schema. Writing the four policies and no grant at all is how the
-- first draft of this file went out: the policies looked complete, and a
-- select as the owner failed with "permission denied for table plaid_entry",
-- because RLS decides which ROWS a role may see and the grant decides whether
-- the role may address the table at all. Both halves have to be there, and
-- saying so here is cheaper than finding it again from a broken import.
grant select on plaid_entry to authenticated;

-- Nothing for anon, and nothing writable for anybody but the service role.
revoke insert, update, delete on plaid_entry from anon, authenticated;
revoke all on plaid_entry from anon;


-- ============================================================================
-- What the owner is allowed to know about their own links.
--
-- Everything except the token. Security definer so it can read a table the
-- caller has no grants on, and `set search_path = public` so it cannot be
-- redirected by a caller who controls their own search_path, which is the
-- standard hardening for a definer function and is applied to every one of
-- them in this project.
-- ============================================================================

create or replace function my_bank_connections()
returns table (
  item_id        text,
  institution    text,
  status         text,
  last_synced_at timestamptz,
  created_at     timestamptz,
  imported       bigint)
language sql
security definer
stable
set search_path = public
as $$
  select i.item_id,
         i.institution,
         i.status,
         i.last_synced_at,
         i.created_at,
         (select count(*) from plaid_entry e
           where e.item_id = i.item_id and e.user_id = i.user_id)
    from plaid_item i
   where i.user_id = auth.uid()
   order by i.created_at desc;
$$;

revoke all on function my_bank_connections() from public;
grant execute on function my_bank_connections() to authenticated;


-- ============================================================================
-- Disconnecting has NO function here, on purpose.
--
-- An earlier draft of this file had a security definer disconnect_bank() the
-- browser could call. It has been removed, because the browser must not be the
-- thing that disconnects a bank.
--
-- Revoking an item at Plaid requires its access_token, and the token is gone
-- the moment the row is deleted. So the order has to be: tell Plaid first,
-- delete second. Only the server can do the first half, which means only the
-- server can be trusted with the second. A function the client could call
-- would let somebody delete the row without ever revoking the item, leaving it
-- live at Plaid, still authorised against their bank, with nothing left here
-- able to revoke it.
--
-- api/plaid/disconnect.js does both halves in that order, and deletes the row
-- with the service role scoped by user_id.
--
-- WHAT DISCONNECTING DELIBERATELY DOES NOT DO IS DELETE THE TRANSACTIONS.
--
-- The imported rows are the person's budget. Somebody unlinking a bank is
-- saying "stop reading my account", not "erase four months of my spending
-- history", and quietly doing the second because they asked for the first
-- would be the single most destructive thing in this schema.
--
-- The plaid_entry rows are kept too, so that re-linking the same bank does not
-- re-import everything that was already imported once.
-- ============================================================================

drop function if exists disconnect_bank(text);

notify pgrst, 'reload schema';

-- Check, as the owner. The first must return your links; the second must fail
-- with "permission denied for table plaid_item", and that failure IS the test.
--   select * from my_bank_connections();
--   select access_token from plaid_item;
--
-- Verified against a real Postgres 16 before shipping:
--   the owner reading their own access_token   -> permission denied
--   my_bank_connections() as the owner         -> their links, no token column
--   my_bank_connections() as somebody else     -> only that person's links
--   the owner inserting into plaid_entry       -> permission denied
--   the owner deleting an imported budget_entry-> plaid_entry row SURVIVES
--                                                 with entry_id null, so the
--                                                 next sync skips it forever
