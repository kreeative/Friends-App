-- ============================================================================
-- LES LIVRES — un seul fichier à coller
--
-- La bibliothèque est vide parce que 05 et 06 n'ont jamais été exécutés. Ce
-- fichier est simplement les deux collés bout à bout, dans le bon ordre, pour
-- qu'il n'y ait qu'un seul copier-coller à faire au lieu de deux.
--
--   Supabase → SQL Editor → New query → coller TOUT ce fichier → Run
--
-- Sans danger à relancer : les tables sont en `create table if not exists`,
-- les livres en `on conflict (slug) do nothing`. Le lancer deux fois ne crée
-- pas de doublons.
--
-- Après ça, /library affiche les trois livres. Attention : leur texte est du
-- remplissage généré, pas les vrais manuscrits — voir la note à la fin.
-- ============================================================================


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
  currency    text not null default 'EUR',
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


-- ============================================================================
-- Placeholder content for the reading library.
--
-- Real chapter titles from the content brief, PLACEHOLDER bodies. The point is
-- to exercise the reader against realistic volume — roughly 3,000 words a
-- chapter — so scrolling, progress saving and chapter switching are tested
-- against what the finished books will weigh, not against two paragraphs.
--
-- The bodies are generated with repeat() rather than pasted, which keeps this
-- file small while still producing full-length chapters.
--
-- Replace the bodies with the manuscripts when they are written. Chapter 1 of
-- each book is the free preview and should be the strongest chapter you have —
-- a weak free chapter is a broken storefront.
-- ============================================================================

-- ~40 words per sentence-block, repeated to reach chapter length.
create or replace function _placeholder_body(chapter_title text, paras int)
returns text language sql immutable as $$
  select '## ' || chapter_title || E'\n\n' || string_agg(
    'PLACEHOLDER. This paragraph stands in for the finished manuscript so the '
    || 'reader can be tested against a chapter of realistic length. The final '
    || 'text will open on a situation you recognise, set out what the research '
    || 'actually found, state plainly where the evidence is thin or failed to '
    || 'replicate, and end with one specific thing to do. Named researchers, '
    || 'no hype, no manufactured urgency.',
    E'\n\n')
  from generate_series(1, paras);
$$;

insert into books (slug, title, subtitle, description, price_cents, currency, published) values
 ('story-you-tell',
  'The Story You Tell About Ability',
  'Mindset, honestly',
  'What you believe about ability changes what you do after failure — the only moment that matters. Growth mindset has been oversold; this is where it actually works.',
  1200, 'EUR', true),
 ('evidence-of-yourself',
  'Evidence of Yourself',
  'Confidence as a byproduct, not a feeling',
  'Confidence is not manufactured internally and then acted on. It is the residue of accumulated evidence that you can handle things. Most advice inverts this and fails.',
  1200, 'EUR', true),
 ('design-beats-discipline',
  'Design Beats Discipline',
  'Why willpower is not the variable',
  'People who look disciplined are mostly not resisting more. They have arranged their lives so there is less to resist.',
  1200, 'EUR', true)
on conflict (slug) do nothing;

-- Chapter 1 of every book is the free preview. Everything else is gated by the
-- policy in 05_library.sql, not by anything in the application.
with outline(book_slug, idx, title) as (values
  ('story-you-tell', 1, 'The moment after failure'),
  ('story-you-tell', 2, 'Fixed and growth, and what the replications actually showed'),
  ('story-you-tell', 3, 'False growth mindset'),
  ('story-you-tell', 4, 'Why you think you failed'),
  ('story-you-tell', 5, 'Learned helplessness and its reverse'),
  ('story-you-tell', 6, 'Stress as a signal, not a threat'),
  ('story-you-tell', 7, 'Reappraisal as a trainable skill'),
  ('story-you-tell', 8, 'Practice, and the ceiling on practice'),
  ('story-you-tell', 9, 'What to do Monday'),

  ('evidence-of-yourself', 1, 'Confidence follows action'),
  ('evidence-of-yourself', 2, 'Bandura''s four sources'),
  ('evidence-of-yourself', 3, 'What doesn''t work, and why it''s still everywhere'),
  ('evidence-of-yourself', 4, 'Self-esteem is a trap; self-compassion isn''t'),
  ('evidence-of-yourself', 5, 'Nobody is watching as closely as you think'),
  ('evidence-of-yourself', 6, 'Acting before feeling ready'),
  ('evidence-of-yourself', 7, 'The impostor experience'),
  ('evidence-of-yourself', 8, 'Building an evidence file'),
  ('evidence-of-yourself', 9, 'Confidence under actual pressure'),

  ('design-beats-discipline', 1, 'The fuel tank that wasn''t'),
  ('design-beats-discipline', 2, 'What the disciplined actually do'),
  ('design-beats-discipline', 3, 'Habits are context, not character'),
  ('design-beats-discipline', 4, 'If-then'),
  ('design-beats-discipline', 5, 'Friction is the lever'),
  ('design-beats-discipline', 6, 'Bundling and precommitment'),
  ('design-beats-discipline', 7, 'Sixty-six days, give or take a lot'),
  ('design-beats-discipline', 8, 'The lapse is not the problem'),
  ('design-beats-discipline', 9, 'Identity and consistency'),
  ('design-beats-discipline', 10, 'Building your own system')
)
insert into chapters (book_id, idx, title, body, word_count, is_preview)
select b.id, o.idx, o.title, _placeholder_body(o.title, 48), 2900, (o.idx = 1)
from outline o
join books b on b.slug = o.book_slug
on conflict (book_id, idx) do nothing;

drop function _placeholder_body(text, int);

-- Sanity: 3 books, 28 chapters, 3 free previews.
-- select count(*) from books;
-- select count(*) from chapters;
-- select count(*) from chapters where is_preview;


-- ============================================================================
-- Vérification — doit renvoyer 3 lignes.
-- ============================================================================
select slug, title, price_cents, published from books order by created_at;
