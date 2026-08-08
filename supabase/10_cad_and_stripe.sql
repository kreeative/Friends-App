-- ============================================================================
-- Prices in Canadian dollars, and the link to Stripe.
--
-- Run after 07. Safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The Stripe identifier for each book.
--
-- One column, not two, because a book has exactly one thing to sell and the
-- checkout handler can tell the two kinds apart by their prefix:
--
--   price_…  a Price, which is what Stripe Checkout actually wants
--   prod_…   a Product, which has no amount on it. The handler resolves it to
--            the product's default_price before charging anything.
--
-- Left null, the book still sells: checkout falls back to price_cents and
-- currency below. That keeps the catalogue working while products are being
-- wired up rather than turning a half-configured book into a dead button.
-- ---------------------------------------------------------------------------
alter table books add column if not exists stripe_ref text;

comment on column books.stripe_ref is
  'Stripe price_… or prod_… id. Null means charge price_cents/currency inline.';

-- ---------------------------------------------------------------------------
-- 2. Canadian dollars.
--
-- The amount does not change, only the unit it is named in: 1200 minor units
-- was 12.00 EUR and is now 12.00 CAD. This is a re-denomination, not a
-- conversion, and it is deliberate. Converting at some exchange rate would
-- invent a number that has to be maintained, and the price a Canadian
-- publisher wants to charge Canadians is a decision rather than an FX rate.
--
-- What Stripe actually charges comes from the Price object when stripe_ref is
-- set, so these two columns are the display price and the fallback.
-- ---------------------------------------------------------------------------
update books set currency = 'CAD' where currency is distinct from 'CAD';

alter table books alter column currency set default 'CAD';

-- ---------------------------------------------------------------------------
-- 3. Wire the three books to Stripe.
--
-- These are Price ids, which is what Stripe Checkout wants directly: a Price
-- carries the amount, a Product does not. The handler uses a price_ id as-is
-- and only has to go looking for a default price when given a prod_ one.
-- ---------------------------------------------------------------------------
update books set stripe_ref = 'price_1U1qJjLZRMaGXv1mXtAa5jiF' where slug = 'design-beats-discipline';
update books set stripe_ref = 'price_1U1qVgLZRMaGXv1mipl2PNKa' where slug = 'evidence-of-yourself';
update books set stripe_ref = 'price_1U1qWTLZRMaGXv1mFvnYmfFs' where slug = 'story-you-tell';

-- Check: three rows, all CAD, all with a ref.
--   select slug, price_cents, currency, stripe_ref from books order by title;
