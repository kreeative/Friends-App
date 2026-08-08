-- ============================================================================
-- Buying before you have an account.
--
-- Run after 07. Safe to re-run.
--
-- Checkout used to refuse anybody who was not signed in, which meant the shop
-- demanded an account before it would take money from somebody who had just
-- read the free chapter and wanted the rest. Stripe collects an email address
-- during payment anyway, so the account can be matched or made afterwards out
-- of something the buyer had to give regardless.
--
-- Two pieces are needed for that. Somewhere to park a purchase whose owner
-- does not exist yet, and a way to hand it over the moment they do.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The buyer's address, where a query can reach it.
--
-- auth.users holds the email, and the service role can read it, but a policy
-- and an RPC running as the caller cannot. Mirroring it onto profiles, folded
-- to lower case and unique, is what lets the webhook match a purchase to an
-- account in one indexed lookup rather than paging through every user.
--
-- A stored column rather than an expression index, because the webhook and the
-- claim function both compare against it and neither can drift from the other.
-- ---------------------------------------------------------------------------
alter table profiles add column if not exists email_lower text;

create unique index if not exists profiles_email_lower_idx
  on profiles (email_lower) where email_lower is not null;

update profiles p
set email_lower = lower(trim(u.email))
from auth.users u
where u.id = p.id
  and u.email is not null
  and p.email_lower is distinct from lower(trim(u.email));

-- Keep it filled for accounts made from here on. handle_new_user() already
-- runs on insert into auth.users; this replaces it rather than adding a second
-- trigger, so there is still exactly one thing writing a new profile.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, display_name, avatar_url, email_lower)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(coalesce(new.email, 'friend'), '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url',
    lower(trim(new.email))
  )
  on conflict (id) do update set email_lower = excluded.email_lower;
  return new;
end;
$$;

-- An address can change. Without this, somebody who updates their email keeps
-- the old one on their profile and a purchase made under the new address never
-- finds them.
create or replace function sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update profiles set email_lower = lower(trim(new.email)) where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function sync_profile_email();

-- ---------------------------------------------------------------------------
-- 2. Purchases with nobody to give them to yet.
--
-- Keyed on (email, book_id) so a Stripe redelivery is a no-op, the same rule
-- the entitlements table already follows. Rows are deleted when claimed, so
-- this is a queue and not a second ledger: what somebody owns is always and
-- only what is in entitlements.
-- ---------------------------------------------------------------------------
create table if not exists pending_entitlements (
  id                uuid primary key default gen_random_uuid(),
  email             text not null,
  book_id           uuid not null references books(id) on delete cascade,
  stripe_session_id text,
  amount_cents      int,
  created_at        timestamptz not null default now(),
  unique (email, book_id)
);

alter table pending_entitlements enable row level security;

-- No policy for anybody. The service role bypasses RLS and is the only thing
-- that writes here; the claim below is SECURITY DEFINER and is the only thing
-- that reads. An email address alongside what was bought against it is not
-- something any signed-in user should be able to query.
revoke all on pending_entitlements from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Handing them over.
--
-- Called by the client on sign-in. SECURITY DEFINER because it has to read a
-- table nobody can read and write an entitlement the caller could otherwise
-- forge, and it is safe because it takes no arguments: it can only ever act on
-- the address of the person calling it. There is no way to ask it for somebody
-- else's purchases.
-- ---------------------------------------------------------------------------
create or replace function claim_entitlements()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  addr text;
  n    int := 0;
begin
  if auth.uid() is null then return 0; end if;

  select lower(trim(email)) into addr from auth.users where id = auth.uid();
  if addr is null or addr = '' then return 0; end if;

  insert into entitlements (user_id, book_id, stripe_session_id, amount_cents)
  select auth.uid(), p.book_id, p.stripe_session_id, p.amount_cents
  from pending_entitlements p
  where p.email = addr
  on conflict (user_id, book_id) do nothing;

  get diagnostics n = row_count;

  -- Deleted whether or not the insert added a row. A purchase the account
  -- already had is still claimed; leaving it queued would retry it forever.
  delete from pending_entitlements where email = addr;

  return n;
end;
$$;

grant execute on function claim_entitlements() to authenticated;

-- Check: nothing should sit here for long.
--   select email, book_id, created_at from pending_entitlements order by created_at;
