-- ============================================================================
-- One card per book.
--
-- Run after 07 and 10. Safe to re-run.
--
-- The live catalogue is showing six books: the three real ones at twelve
-- dollars, and a second set of the same three titles at zero, under different
-- slugs. The second set predates 07_books_all_in_one.sql. That file inserts
-- `on conflict (slug) do nothing`, so it never noticed them, because they
-- collide on the title and not on the key it was checking.
--
-- Unpublished rather than deleted. A deleted book takes its chapters with it
-- and would take an entitlement with it too, and while nobody can have bought
-- a zero-priced row, "probably nobody" is not a good enough reason to run a
-- destructive statement against a live catalogue. Unpublished rows vanish from
-- the shop, which is the actual requirement, and can be deleted by hand once
-- you have looked at them.
--
-- Order matters here, and the first draft of this file had it wrong. Anything
-- somebody owns has to be moved onto the surviving row BEFORE the row it sits
-- on is retired. Retiring first and moving afterwards takes the book off their
-- shelf in between, and if the move then misses, it stays off.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. The column this file sorts on.
--
-- 10_cad_and_stripe.sql adds stripe_ref. If it has not been run, everything
-- below fails on the first reference to it, and the failure is a column error
-- that says nothing about which file to go and run.
-- ---------------------------------------------------------------------------
alter table books add column if not exists stripe_ref text;

-- ---------------------------------------------------------------------------
-- 1. Look before you change anything.
--
-- Run this on its own first. It shows every title that appears more than once
-- and which row this file is about to keep.
-- ---------------------------------------------------------------------------
--   with norm as (
--     select id, slug, title, price_cents, stripe_ref, published,
--            regexp_replace(lower(regexp_replace(title, '^(the|a|an)\s+', '', 'i')),
--                           '[^a-z0-9]', '', 'g') as k
--     from books
--   )
--   select k, id, slug, title, price_cents, stripe_ref, published
--   from norm
--   where k in (select k from norm group by k having count(*) > 1)
--   order by k, price_cents desc;

-- ---------------------------------------------------------------------------
-- 2. Move every entitlement onto the row that is going to survive.
--
-- First, not last. This is what makes the two statements below safe: once a
-- purchase has been moved, retiring the row it used to point at cannot take
-- anybody's book away.
--
-- The keeper is chosen without reference to `published`, so this agrees with
-- the ranking below no matter which of them has run before.
-- ---------------------------------------------------------------------------
with norm as (
  select
    id, price_cents, stripe_ref, created_at,
    regexp_replace(
      lower(regexp_replace(title, '^(the|a|an)\s+', '', 'i')),
      '[^a-z0-9]', '', 'g'
    ) as k
  from books
),
keeper as (
  select distinct on (k) k, id
  from norm
  order by k,
           (stripe_ref is not null and stripe_ref <> '') desc,
           (price_cents > 0) desc,
           created_at asc
)
update entitlements e
set book_id = keeper.id
from norm n
join keeper on keeper.k = n.k
where e.book_id = n.id
  and n.id <> keeper.id
  -- Skip anyone who already owns the keeper: the unique (user_id, book_id)
  -- would reject the update, and they have lost nothing either way.
  and not exists (
    select 1 from entitlements x
    where x.user_id = e.user_id and x.book_id = keeper.id
  );

-- Whatever could not be moved above is a genuine duplicate purchase by the
-- same person. Drop the copy rather than leaving a row pointing at a book that
-- is about to leave the shop.
with norm as (
  select
    id, price_cents, stripe_ref, created_at,
    regexp_replace(
      lower(regexp_replace(title, '^(the|a|an)\s+', '', 'i')),
      '[^a-z0-9]', '', 'g'
    ) as k
  from books
),
keeper as (
  select distinct on (k) k, id
  from norm
  order by k,
           (stripe_ref is not null and stripe_ref <> '') desc,
           (price_cents > 0) desc,
           created_at asc
)
delete from entitlements e
using norm n, keeper
where keeper.k = n.k
  and e.book_id = n.id
  and n.id <> keeper.id;

-- ---------------------------------------------------------------------------
-- 3. Retire the rows nobody could buy.
--
-- This is the rule that actually catches them, and matching on the title is
-- not: the leftovers are titled "Story You Tell" while the real book is "The
-- Story You Tell About Ability", so no amount of normalising brings those two
-- together. What every leftover does have in common is that it costs nothing
-- and points at no Stripe object, which means Checkout has nothing to charge
-- for. It is not a free book, because this app has no such thing. It is a row
-- that cannot be sold.
-- ---------------------------------------------------------------------------
update books b
set published = false
where b.published
  and coalesce(b.price_cents, 0) = 0
  and coalesce(nullif(trim(b.stripe_ref), ''), '') = ''
  and not exists (select 1 from entitlements e where e.book_id = b.id);

-- ---------------------------------------------------------------------------
-- 4. Then, if a title still appears twice, keep the one somebody can buy.
--
-- Ranked exactly as in step 2, so the row that kept the purchases is the row
-- that stays in the shop. Still guarded on entitlements: after step 2 there
-- should be none left on a loser, and if there somehow are, a duplicate card
-- is better than a book disappearing off somebody's shelf.
-- ---------------------------------------------------------------------------
with norm as (
  select
    id, price_cents, stripe_ref, created_at,
    regexp_replace(
      lower(regexp_replace(title, '^(the|a|an)\s+', '', 'i')),
      '[^a-z0-9]', '', 'g'
    ) as k
  from books
),
ranked as (
  select
    id, k,
    row_number() over (
      partition by k
      order by
        (stripe_ref is not null and stripe_ref <> '') desc,
        (price_cents > 0) desc,
        created_at asc
    ) as rn
  from norm
)
update books b
set published = false
from ranked r
where r.id = b.id
  and r.rn > 1
  and b.published
  and not exists (select 1 from entitlements e where e.book_id = b.id);

-- Check: three rows, all published, all priced, all with a Stripe ref.
--   select slug, title, price_cents, currency, stripe_ref
--   from books where published order by title;

-- ---------------------------------------------------------------------------
-- 5. Never leave a title with nothing published.
--
-- A safety net, added after this file unpublished the only sellable copy of
-- "Evidence of Yourself" on a live catalogue. The ranking above assumes at
-- least one row per title is worth keeping, and every step is guarded, but
-- "every step is guarded" is exactly the reasoning that produced the bug: the
-- steps are individually correct and the combination still managed to retire
-- everything under one title.
--
-- So rather than reason harder about the ordering, assert the postcondition.
-- For any title with no published row left, put the best candidate back. This
-- is cheap, it is idempotent, and it makes the failure impossible rather than
-- unlikely.
-- ---------------------------------------------------------------------------
with norm as (
  select
    id, title, price_cents, stripe_ref, created_at, published,
    regexp_replace(
      lower(regexp_replace(title, '^(the|a|an)\s+', '', 'i')),
      '[^a-z0-9]', '', 'g'
    ) as k
  from books
),
orphaned as (
  select k from norm group by k having bool_and(not published)
),
best as (
  select distinct on (n.k) n.k, n.id
  from norm n
  join orphaned o on o.k = n.k
  order by n.k,
           (n.stripe_ref is not null and n.stripe_ref <> '') desc,
           (n.price_cents > 0) desc,
           n.created_at asc
)
update books b
set published = true
from best
where b.id = best.id;

-- Check: every title should have exactly one published row.
--   select regexp_replace(lower(regexp_replace(title,'^(the|a|an)\s+','','i')),
--                         '[^a-z0-9]','','g') as k,
--          count(*) filter (where published) as published_copies
--   from books group by k order by k;
