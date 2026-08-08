-- ============================================================================
-- RUN THIS. Everything outstanding, in one paste.
--
-- Supabase -> SQL Editor -> paste the whole file -> Run.
--
-- Assumes 01_schema.sql, 02_functions.sql and 03_policies.sql have already
-- been run. If sign-in works, they have.
--
-- Safe to run twice. Every statement is written to be repeatable: tables use
-- IF NOT EXISTS, policies are dropped before being created, and the seed rows
-- use ON CONFLICT DO NOTHING. Running it again changes nothing and breaks
-- nothing, so if you are unsure whether it finished, just run it again.
--
-- NOT included: 08_chapter_bodies.sql, which replaces the placeholder chapter
-- text with the written manuscripts. You do not need it. The free chapter of
-- every book is bundled into the app itself and renders whether or not the
-- database has it, and the paid chapters are not written yet. Run 08 when
-- there is a manuscript worth putting behind the paywall.
--
-- Contents:
--   1. 07_books_all_in_one.sql            The library: tables, paywall policy, and the three books
--   2. 09_solo_goals_and_leaving.sql      Goals without a group; leaving and deleting a group
--   3. 10_cad_and_stripe.sql              Prices in CAD, and the Stripe price for each book
--   4. 11_chapter_index.sql               Chapter titles public, chapter bodies still paywalled
--   5. 12_daily_mood.sql                  How you feel today, and who is allowed to see it
-- ============================================================================



-- ============================================================
-- 07_books_all_in_one.sql
-- ============================================================

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
  1200, 'CAD', true),
 ('evidence-of-yourself',
  'Evidence of Yourself',
  'Confidence as a byproduct, not a feeling',
  'Confidence is not manufactured internally and then acted on. It is the residue of accumulated evidence that you can handle things. Most advice inverts this and fails.',
  1200, 'CAD', true),
 ('design-beats-discipline',
  'Design Beats Discipline',
  'Why willpower is not the variable',
  'People who look disciplined are mostly not resisting more. They have arranged their lives so there is less to resist.',
  1200, 'CAD', true)
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


-- ============================================================
-- 09_solo_goals_and_leaving.sql
-- ============================================================

-- ============================================================================
-- Goals without a group, and a way out of one.
--
-- Run after 01/02/03. Safe to re-run.
--
-- Two changes, both about the same omission: the app assumed a group was the
-- only place anything could live. You could not keep a goal of your own
-- without joining people, and once you had joined there was no exit that was
-- not signing out of the product entirely.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Goals may be solo.
--
-- group_id becomes nullable. A goal with no group is yours alone: nobody else
-- can read it, it does not appear on any board, and it is not part of anyone's
-- cycle. It is still a goal — same fields, same check-in semantics if you
-- later attach it to a group.
--
-- The new constraint is the thing that keeps this honest: without a group
-- there is nobody for a 'group' goal to belong to, so a goal with no group
-- must be personal and must have an owner. Otherwise it would be a row no
-- policy could ever match, which is the quiet way to lose data.
-- ---------------------------------------------------------------------------
alter table goals alter column group_id drop not null;

alter table goals drop constraint if exists goal_solo_is_personal;
alter table goals add constraint goal_solo_is_personal check (
  group_id is not null
  or (kind = 'personal' and owner_id is not null)
);

-- Opt out of the reminder email for one specific goal. Defaults to on, since
-- the digest is capped at one message per cycle either way and the whole point
-- of writing a trigger down is being reminded of it.
alter table goals add column if not exists remind boolean not null default true;

-- ---------------------------------------------------------------------------
-- 2. Policies.
--
-- Every one of these gains the same clause: a row with no group is visible to,
-- and writable by, exactly its owner. Group behaviour is unchanged.
-- ---------------------------------------------------------------------------
drop policy if exists goals_select on goals;
create policy goals_select on goals for select to authenticated
  using (
    (group_id is null and owner_id = auth.uid())
    or (group_id is not null and is_member(group_id))
  );

drop policy if exists goals_insert on goals;
create policy goals_insert on goals for insert to authenticated
  with check (
    (
      group_id is null
      and kind = 'personal'
      and owner_id = auth.uid()
    )
    or (
      group_id is not null
      and is_member(group_id)
      and (
        (kind = 'personal' and owner_id = auth.uid())
        or (kind = 'group' and owner_id is null)
      )
    )
  );

drop policy if exists goals_update on goals;
create policy goals_update on goals for update to authenticated
  using (
    (group_id is null and owner_id = auth.uid())
    or (
      group_id is not null
      and is_member(group_id)
      and (owner_id = auth.uid() or (kind = 'group' and owner_id is null))
    )
  )
  with check (
    (group_id is null and kind = 'personal' and owner_id = auth.uid())
    or (
      group_id is not null
      and is_member(group_id)
      and (owner_id = auth.uid() or (kind = 'group' and owner_id is null))
    )
  );

drop policy if exists goals_delete on goals;
create policy goals_delete on goals for delete to authenticated
  using (
    owner_id = auth.uid()
    or (group_id is not null and is_group_admin(group_id))
  );

-- ---------------------------------------------------------------------------
-- 3. Leaving.
--
-- A function rather than a delete policy on group_members, because leaving is
-- not one row's worth of work. Three things have to be decided in one place,
-- atomically, or a group can be left in a state nobody can administer:
--
--   your goals    the personal ones come with you, unattached, rather than
--                 being deleted. Someone who leaves a group has not stopped
--                 wanting to run three times a week, and silently binning
--                 their history is the kind of thing people do not forgive.
--   the last admin  promoted from whoever has been there longest, so a group
--                 can never end up with members and no administrator.
--   the last member  takes the group with them. An empty group is not a group,
--                 and leaving it behind means an invite code that still works
--                 and lets a stranger walk into an empty room.
-- ---------------------------------------------------------------------------
create or replace function leave_group(p_group uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me       uuid := auth.uid();
  v_left     int;
  v_admins   int;
begin
  if v_me is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  if not exists (select 1 from group_members where group_id = p_group and user_id = v_me) then
    raise exception 'not a member of this group' using errcode = '42501';
  end if;

  -- Personal goals survive the exit, detached from the group. Group goals do
  -- not: they belong to the people still in it.
  update goals
     set group_id = null
   where group_id = p_group
     and owner_id = v_me
     and kind = 'personal';

  delete from group_members where group_id = p_group and user_id = v_me;

  select count(*) into v_left from group_members where group_id = p_group;

  if v_left = 0 then
    delete from groups where id = p_group;
    return;
  end if;

  select count(*) into v_admins
    from group_members where group_id = p_group and role = 'admin';

  if v_admins = 0 then
    update group_members
       set role = 'admin'
     where group_id = p_group
       and user_id = (
         select user_id from group_members
          where group_id = p_group
          order by joined_at, user_id
          limit 1
       );
  end if;
end;
$$;

revoke all on function leave_group(uuid) from public;
grant execute on function leave_group(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Deleting.
--
-- Admins only, and it takes the cycles, check-ins and group goals with it via
-- the existing cascades. Personal goals are detached first for the same reason
-- as above — deleting a group is a decision about a group, not about what four
-- other people were trying to do with their year.
--
-- There is deliberately no soft delete. A group that appears in your list but
-- does nothing is worse than one that is gone.
-- ---------------------------------------------------------------------------
create or replace function delete_group(p_group uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  if not exists (
    select 1 from group_members
     where group_id = p_group and user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'only an admin can delete a group' using errcode = '42501';
  end if;

  update goals
     set group_id = null
   where group_id = p_group
     and kind = 'personal'
     and owner_id is not null;

  delete from groups where id = p_group;
end;
$$;

revoke all on function delete_group(uuid) from public;
grant execute on function delete_group(uuid) to authenticated;

-- Sanity:
--   select group_id, kind, owner_id, commitment from goals where group_id is null;
--   select proname from pg_proc where proname in ('leave_group','delete_group');


-- ============================================================
-- 10_cad_and_stripe.sql
-- ============================================================

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


-- ============================================================
-- 11_chapter_index.sql
-- ============================================================

-- ============================================================================
-- Chapter titles are public. Chapter bodies are not.
--
-- Run after 07. Safe to re-run.
--
-- The paywall was doing slightly too much. `chapters_select` hides the whole
-- row of anything you have not bought, so a visitor querying a nine-chapter
-- book got exactly one row back: the free preview. The consequences were all
-- in the wrong direction.
--
--   The contents drawer listed one chapter, so the book looked one chapter
--   long. Nothing was marked "locked", because there was nothing there to
--   mark. There was no next chapter, so the reader ran out of book at the end
--   of the free sample with no indication that anything followed. And the
--   storefront concealed the very thing it is trying to sell: eight more
--   chapters, by name.
--
-- Titles are not the product. The writing is. So this exposes the index and
-- keeps the bodies exactly as locked as they were.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A view, because RLS is row-level and the split needed here is by column.
--
-- Views run with the privileges of their owner unless told otherwise, so this
-- one reads `chapters` without that table's policy applying, and does its own
-- filtering in the WHERE clause: published books only, and no `body` column
-- anywhere in the projection. There is no way to widen it from the client.
--
-- Note what is deliberately absent: `body`. Not "body, filtered" or "body,
-- truncated" — absent. A column that is not in the view cannot leak from it,
-- which is a much shorter thing to audit than a policy.
-- ---------------------------------------------------------------------------
create or replace view chapter_index as
  select c.id,
         c.book_id,
         c.idx,
         c.title,
         c.is_preview,
         c.word_count
    from chapters c
    join books b on b.id = c.book_id
   where b.published;

-- Postgres 15 and later let a view opt into the caller's privileges. This one
-- must not: the whole point is to read past the chapters policy.
alter view chapter_index set (security_invoker = off);

grant select on chapter_index to authenticated, anon;

-- The table's own policy is untouched and still the only route to a body.
-- Stated here so a future reader does not assume the view replaced it:
--
--   chapters_select: is_preview = true OR owns_book(book_id)
--
-- Check: nine or ten rows per book for a signed-in non-buyer, and still
-- exactly one readable body.
--   select b.slug, count(*) from chapter_index c
--     join books b on b.id = c.book_id group by b.slug;


-- ============================================================
-- 12_daily_mood.sql
-- ============================================================

-- ============================================================================
-- How you are today, kept apart from the check-in.
--
-- Run after 01/02/03. Safe to re-run.
--
-- Mood was a column on `checkins`, which tied it to a cycle: you could only
-- say how you were during the hours your group's window happened to be open,
-- and only in a group. But how you are is a fact about you on a Tuesday, not
-- about a group's schedule, and the person most worth asking is the one who
-- has not opened a check-in in three weeks.
--
-- So it moves to its own table, one row per person per day, and to the
-- dashboard. The old column stays where it is: it is history, and rewriting
-- what somebody recorded during a past check-in is not this migration's job.
-- ============================================================================

create table if not exists daily_mood (
  user_id    uuid not null references profiles(id) on delete cascade,
  day        date not null default current_date,
  mood       text not null,
  /**
   * Off by default, and that is the important line in this file.
   *
   * Sharing how you feel with four people who know you is a real thing to
   * offer and a worse thing to assume. Anyone who wants it can turn it on in
   * one tap; nobody has to discover after the fact that their bad Tuesday was
   * broadcast. Defaults are the only privacy setting most people ever use.
   */
  shared     boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

create index if not exists daily_mood_day_idx on daily_mood(day);

alter table daily_mood enable row level security;

-- ---------------------------------------------------------------------------
-- Reading: always your own. Someone else's only when they have shared it,
-- only for today, and only if you actually share a group with them.
--
-- All three conditions matter. Without `shared` it is not consented to;
-- without the date bound a group-mate could read back a history of your moods,
-- which is a different and much more invasive thing than knowing how someone
-- is this morning; without shares_group it would be public.
-- ---------------------------------------------------------------------------
-- The membership test is written out rather than calling shares_group(),
-- which lives in 03_policies.sql. Inlining it means this file has exactly one
-- prerequisite -- the tables in 01_schema.sql -- and cannot fail with a
-- missing-function error for someone running the files out of order.
drop policy if exists daily_mood_select on daily_mood;
create policy daily_mood_select on daily_mood for select to authenticated
  using (
    user_id = auth.uid()
    or (
      shared
      and day = current_date
      and exists (
        select 1
          from group_members mine
          join group_members theirs on theirs.group_id = mine.group_id
         where mine.user_id = auth.uid()
           and theirs.user_id = daily_mood.user_id
      )
    )
  );

drop policy if exists daily_mood_write on daily_mood;
create policy daily_mood_write on daily_mood for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists daily_mood_update on daily_mood;
create policy daily_mood_update on daily_mood for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists daily_mood_delete on daily_mood;
create policy daily_mood_delete on daily_mood for delete to authenticated
  using (user_id = auth.uid());

-- Check:
--   select * from daily_mood where user_id = auth.uid();


-- ============================================================
-- Did it work?
-- ============================================================
-- Three books, all CAD, all with a Stripe price, 9 or 10 chapters each,
-- exactly one of them free.
select b.slug,
       b.currency,
       b.stripe_ref,
       count(c.*)                            as chapters,
       count(*) filter (where c.is_preview)  as free
  from books b
  left join chapters c on c.book_id = b.id
 group by b.slug, b.currency, b.stripe_ref
 order by b.slug;

-- The four things this file added, which should all say true.
select 'leave_group exists'   as check, to_regprocedure('leave_group(uuid)')  is not null as ok
union all select 'delete_group exists',  to_regprocedure('delete_group(uuid)') is not null
union all select 'chapter_index exists', to_regclass('chapter_index')          is not null
union all select 'daily_mood exists',    to_regclass('daily_mood')             is not null;
