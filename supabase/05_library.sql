-- ============================================================================
-- Rich & Friends — paid reading library
-- Run after 03_policies.sql. Schema and policies only; no UI depends on this
-- yet, and it is safe to run before the reader exists.
--
-- The single rule this file exists to enforce: a chapter body that is not a
-- preview is unreadable without a matching entitlement, and that check lives
-- in the policy, not in the application. The client is never trusted with it.
-- ============================================================================

create table if not exists books (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  title       text not null,
  subtitle    text,
  description text,
  cover_url   text,
  price_cents int  not null check (price_cents >= 0),
  currency    text not null default 'CAD',
  word_count  int,
  published   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists chapters (
  id         uuid primary key default gen_random_uuid(),
  book_id    uuid not null references books(id) on delete cascade,
  idx        int  not null,
  title      text not null,
  body       text not null,          -- markdown
  word_count int,
  is_preview boolean not null default false,
  unique (book_id, idx)
);

create index if not exists chapters_book_idx on chapters(book_id, idx);

-- ---------------------------------------------------------------------------
-- entitlements: written only by the Stripe webhook, holding the service role.
-- There is deliberately no INSERT policy — a client that could write its own
-- entitlement would make the paywall decorative.
--
-- The unique constraint on (user_id, book_id) makes webhook redelivery safe:
-- Stripe retries, and an upsert on a duplicate event is a no-op rather than a
-- second row.
-- ---------------------------------------------------------------------------
create table if not exists entitlements (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles(id) on delete cascade,
  book_id           uuid not null references books(id) on delete cascade,
  stripe_session_id text unique,
  amount_cents      int,
  purchased_at      timestamptz not null default now(),
  unique (user_id, book_id)
);

create index if not exists entitlements_user_idx on entitlements(user_id);

create table if not exists reading_progress (
  user_id      uuid not null references profiles(id) on delete cascade,
  book_id      uuid not null references books(id) on delete cascade,
  chapter_id   uuid references chapters(id) on delete set null,
  scroll_pct   numeric(5,2) not null default 0 check (scroll_pct between 0 and 100),
  updated_at   timestamptz not null default now(),
  primary key (user_id, book_id)
);

create table if not exists highlights (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  book_id     uuid not null references books(id) on delete cascade,
  chapter_id  uuid not null references chapters(id) on delete cascade,
  quoted_text text not null check (length(quoted_text) between 1 and 1200),
  note        text check (length(note) <= 1000),
  created_at  timestamptz not null default now()
);

create index if not exists highlights_user_idx on highlights(user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- reading_shares: opt-in only, and the row's existence IS the consent. There
-- is no "shared: false" state, because a purchase that was never shared should
-- leave no trace anyone can query.
-- ---------------------------------------------------------------------------
create table if not exists reading_shares (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  group_id   uuid not null references groups(id) on delete cascade,
  book_id    uuid not null references books(id) on delete cascade,
  kind       text not null check (kind in ('started', 'highlight')),
  highlight_id uuid references highlights(id) on delete cascade,
  message    text check (length(message) <= 500),
  shared_at  timestamptz not null default now(),
  -- a highlight share must carry a highlight; a "started" share must not
  constraint share_shape check (
    (kind = 'highlight' and highlight_id is not null) or
    (kind = 'started'   and highlight_id is null)
  )
);

create index if not exists reading_shares_group_idx on reading_shares(group_id, shared_at desc);

-- ---------------------------------------------------------------------------
-- owns_book(): the entitlement check, as a SECURITY DEFINER function for the
-- same reason is_member() is one — the chapters policy must be able to consult
-- entitlements without being filtered by the entitlements policy in turn.
-- ---------------------------------------------------------------------------
create or replace function owns_book(b uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from entitlements where book_id = b and user_id = auth.uid()
  );
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table books            enable row level security;
alter table chapters         enable row level security;
alter table entitlements     enable row level security;
alter table reading_progress enable row level security;
alter table highlights       enable row level security;
alter table reading_shares   enable row level security;

-- books
-- Enforces: the catalogue is visible to any signed-in user, because you cannot
-- decide to buy something you cannot see. Unpublished drafts stay hidden.
drop policy if exists books_select on books;
create policy books_select on books for select to authenticated
  using (published = true);

-- chapters — THE policy this file exists for.
-- Enforces: a chapter row is selectable only when it is the free preview, or
-- when the reader holds an entitlement for its book. Bodies are never
-- filtered in application code, so a hand-written PostgREST query against
-- /chapters returns exactly what the reader paid for and nothing else.
drop policy if exists chapters_select on chapters;
create policy chapters_select on chapters for select to authenticated
  using (
    exists (select 1 from books b where b.id = book_id and b.published)
    and (is_preview = true or owns_book(book_id))
  );

-- entitlements
-- Enforces: you can see what you own, and nothing else — not even the fact
-- that someone else owns a book. No INSERT, UPDATE or DELETE policy exists at
-- all: only the webhook's service-role key writes here, which is what makes
-- the webhook the sole source of truth for entitlement.
drop policy if exists entitlements_select on entitlements;
create policy entitlements_select on entitlements for select to authenticated
  using (user_id = auth.uid());

-- reading_progress
-- Enforces: private to the reader. Where someone is in a book is nobody
-- else's business, including their group's.
drop policy if exists progress_all on reading_progress;
create policy progress_all on reading_progress for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and owns_book(book_id));

-- highlights
-- Enforces: private by default, and only creatable for a book you own — so a
-- highlight cannot be used as an oracle to extract text you have not bought.
drop policy if exists highlights_all on highlights;
create policy highlights_all on highlights for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and owns_book(book_id));

-- reading_shares
-- Enforces: the group sees what a member chose to share, and a member can
-- only create or withdraw their own share. Deliberately never written
-- automatically on purchase — see the note at the top of the table.
drop policy if exists shares_select on reading_shares;
create policy shares_select on reading_shares for select to authenticated
  using (is_member(group_id));

drop policy if exists shares_write on reading_shares;
create policy shares_write on reading_shares for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and is_member(group_id)
    and owns_book(book_id)
  );

-- Same PUBLIC-grant trap as 03_policies.sql: revoke first, then grant by
-- name. owns_book() keys on auth.uid() so an anonymous caller only ever
-- learns "no", but leaving a SECURITY DEFINER function open to PUBLIC is a
-- habit worth not having.
revoke execute on function owns_book(uuid) from public;
grant execute on function owns_book(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- What this does NOT do, stated plainly so it is not mistaken for security:
--
-- It stops someone reading a chapter they have not bought. It does not stop
-- someone who HAS bought a book from copying its text — no web application
-- can, because the browser must render the words to show them. Watermarking
-- (handled in the reader, not here) makes a leaked copy traceable to a buyer;
-- it does not prevent the leak.
-- ---------------------------------------------------------------------------
