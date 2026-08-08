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
-- 2. Retire the rows nobody could buy.
--
-- This is the rule that actually catches them, and matching on the title is
-- not: the leftovers are titled "Story You Tell" while the real book is "The
-- Story You Tell About Ability", so no amount of normalising brings those two
-- together. What every leftover does have in common is that it costs nothing
-- and points at no Stripe object, which means Checkout has nothing to charge
-- for. It is not a free book, because this app has no such thing. It is a row
-- that cannot be sold.
--
-- Anything anybody already owns is left published regardless. A book vanishing
-- off somebody's shelf is worse than a duplicate card.
-- ---------------------------------------------------------------------------
update books b
set published = false
where b.published
  and coalesce(b.price_cents, 0) = 0
  and coalesce(nullif(trim(b.stripe_ref), ''), '') = ''
  and not exists (select 1 from entitlements e where e.book_id = b.id);

-- ---------------------------------------------------------------------------
-- 3. Then, if a title still appears twice, keep the one somebody can buy.
--
-- Ranked the same way the storefront ranks it, so the two cannot disagree:
-- wired to Stripe beats not wired, then a real price beats zero, then the
-- older row wins so a re-run is stable.
-- ---------------------------------------------------------------------------
with norm as (
  select
    id,
    price_cents,
    stripe_ref,
    created_at,
    regexp_replace(
      lower(regexp_replace(title, '^(the|a|an)\s+', '', 'i')),
      '[^a-z0-9]', '', 'g'
    ) as k
  from books
),
ranked as (
  select
    id,
    k,
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
  and b.published;

-- ---------------------------------------------------------------------------
-- 4. Move any entitlement onto the row that survived.
--
-- Belt and braces. If somebody did somehow buy a duplicate, this keeps their
-- book readable instead of quietly taking it off their shelf along with the
-- row it pointed at.
-- ---------------------------------------------------------------------------
with norm as (
  select
    id,
    price_cents,
    stripe_ref,
    created_at,
    published,
    regexp_replace(
      lower(regexp_replace(title, '^(the|a|an)\s+', '', 'i')),
      '[^a-z0-9]', '', 'g'
    ) as k
  from books
),
keeper as (
  select distinct on (k) k, id
  from norm
  where published
  order by k, (stripe_ref is not null and stripe_ref <> '') desc,
           (price_cents > 0) desc, created_at asc
)
update entitlements e
set book_id = keeper.id
from norm n
join keeper on keeper.k = n.k
where e.book_id = n.id
  and n.id <> keeper.id
  and not exists (
    select 1 from entitlements x
    where x.user_id = e.user_id and x.book_id = keeper.id
  );

-- Check: three rows, all published, all priced, all with a Stripe ref.
--   select slug, title, price_cents, currency, stripe_ref
--   from books where published order by title;
