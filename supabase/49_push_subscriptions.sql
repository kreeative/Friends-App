-- ============================================================================
-- Where a push notification is delivered.
--
-- Run after 48. Safe to re-run.
--
-- WHY PUSH AT ALL, WHEN THE EMAIL WORKS.
--
-- The email does work. It arrives, in the inbox, and that was proved rather
-- than assumed. Nine people received one and not one of them noticed, because
-- whether a message makes a phone light up is decided by Gmail on their
-- device, not by us. For an application whose entire point is reminding
-- somebody at the right moment, that is building on sand.
--
-- A push notification is the opposite: it appears on the lock screen, the
-- wording is ours, the moment is ours, and the recipient sets nothing up.
--
-- THE ENDPOINT IS THE PRIMARY KEY, AND THAT IS DELIBERATE.
--
-- The push service hands the browser a URL that identifies this browser on
-- this device. Subscribing twice returns the same URL, so the endpoint is a
-- natural key and re-subscribing is an upsert rather than a second row. With a
-- generated id instead, every reload of the settings screen would add another
-- subscription and one person would get four copies of one notification.
--
-- One person may legitimately have several rows: a phone and a laptop are two
-- browsers and two endpoints. That is why user_id is not unique.
--
-- WHAT IS NOT STORED.
--
-- No device name, no user agent, no platform. It would be easy, it would look
-- thorough on a settings screen, and none of it is needed to deliver a
-- message. The endpoint already says which browser; anything beyond that is a
-- record of what hardware somebody owns, kept by an application that has no
-- use for it.
-- ============================================================================

create table if not exists push_subscription (
  -- The push service's URL for this browser. Long: FCM's run past 150 chars.
  endpoint     text primary key,
  user_id      uuid not null references profiles(id) on delete cascade,
  -- The browser's P-256 public key and auth secret, both base64url. These are
  -- what the payload is encrypted to, so without them a row is undeliverable.
  p256dh       text not null,
  auth         text not null,
  created_at   timestamptz not null default now(),
  -- Touched on every successful send, so a row that has stopped working can be
  -- told from one that simply has not been written to yet.
  last_seen_at timestamptz not null default now()
);

create index if not exists push_subscription_user_idx on push_subscription (user_id);

alter table push_subscription enable row level security;

-- ---------------------------------------------------------------------------
-- Yours, and only yours, in every direction.
--
-- Reading somebody else's row would hand over a URL that anybody holding it
-- can post a notification to. It is a capability, not an identifier, so the
-- policies are the same shape as the budget's: user_id = auth.uid(), with no
-- group path and no shared view.
--
-- The sender reads this table with the service role, which bypasses RLS. That
-- is the only thing that ever reads across users.
-- ---------------------------------------------------------------------------
drop policy if exists push_subscription_select on push_subscription;
create policy push_subscription_select on push_subscription for select to authenticated
  using (user_id = auth.uid());

drop policy if exists push_subscription_insert on push_subscription;
create policy push_subscription_insert on push_subscription for insert to authenticated
  with check (user_id = auth.uid());

-- Needed because subscribing again on the same browser is an upsert onto the
-- same endpoint. Without it a returning reader would silently keep stale keys:
-- a browser can rotate them, and a row with the old p256dh encrypts to a key
-- nothing can read.
drop policy if exists push_subscription_update on push_subscription;
create policy push_subscription_update on push_subscription for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists push_subscription_delete on push_subscription;
create policy push_subscription_delete on push_subscription for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on push_subscription to authenticated;

notify pgrst, 'reload schema';

-- Check:
--   select count(*) from push_subscription;
--   -- and that the policy actually bites, as a signed-in user:
--   select * from push_subscription;   -- only ever your own rows
