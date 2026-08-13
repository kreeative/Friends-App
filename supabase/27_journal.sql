-- ============================================================================
-- The journal: the first thing in this app that nobody else can see.
--
-- Run after 26. Safe to re-run.
--
-- Every other table here is social by construction. goals are visible to the
-- group, checkins are the whole point of the group, moods are shown on the
-- board, celebrations are said in front of people. That is the app working as
-- intended, and it is also the reason there has been nowhere to write down the
-- thing you are not ready to say out loud yet, which is most of what anybody
-- actually needs to write down.
--
-- So this table is the opposite of all of them, and the policies are the
-- feature rather than a guard on it: user_id = auth.uid(), four times, with no
-- group in the predicate anywhere. There is no view, no join to profiles, and
-- deliberately no `shares_group` escape hatch. A journal that a group member
-- can read under some condition is not a journal.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The entries.
--
-- `day` is a date rather than a timestamp, and it is separate from created_at,
-- because the two answer different questions. created_at is when this was
-- typed; day is the day it is about. Writing up Sunday on Tuesday evening is
-- the normal case for a journal, not an edge case, and an app that files it
-- under Tuesday has quietly refused to let anybody catch up.
--
-- `kind` says which of the two editors owns the entry. Both columns exist on
-- every row regardless: a handwritten page can carry a typed title, and a
-- typed entry that later gets a drawing should not need a new row. The check
-- constraint is what stops a row claiming to be handwriting with nothing drawn.
--
-- `ink` is jsonb, holding the stroke format in src/lib/ink.js: a few hundred
-- numbers per page. The alternative was an image in storage, which is the
-- wrong size on every screen it was not drawn on and turns a year of daily
-- notes into a year of PNGs. jsonb rather than json because it is the type
-- Postgres actually indexes and compares, and the client never depends on key
-- order.
--
-- No length cap on body. A journal entry is exactly as long as it is, and a
-- character limit on somebody's diary is an absurd thing for an app to have an
-- opinion about. `ink` is capped, in the check below, because a runaway
-- pointermove loop is a bug rather than a long entry.
-- ---------------------------------------------------------------------------
create table if not exists journal_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  day        date not null,
  kind       text not null default 'text' check (kind in ('text', 'ink')),
  body       text,
  ink        jsonb,
  mood       text check (mood is null or length(mood) <= 24),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- An entry has to be something. An empty row is a card in the grid that
  -- opens on nothing, and the only way to get one is a bug or a console.
  constraint journal_entries_not_empty check (
    (kind = 'text' and coalesce(length(trim(body)), 0) > 0)
    or (kind = 'ink' and ink is not null)
  ),

  -- About a megabyte of strokes, which is far more than anybody draws by hand
  -- and far less than a loop that appends a point per frame forever.
  constraint journal_entries_ink_size check (ink is null or pg_column_size(ink) < 1048576)
);

-- The grid's own query: my entries, newest day first. Both columns in the
-- index because the page is always scoped to one person and always ordered by
-- day, and created_at breaks the tie when two entries share a date.
create index if not exists journal_entries_mine_idx
  on journal_entries (user_id, day desc, created_at desc);

alter table journal_entries enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Yours, and only yours.
--
-- Four policies that say the same thing, which is the point. There is no
-- is_member() here and there never should be.
--
-- Both `using` and `with check` on update, because `using` alone decides which
-- rows you may edit and says nothing about what you may turn them into: without
-- the second half, an update could reassign user_id and hand somebody else's
-- account an entry they never wrote.
-- ---------------------------------------------------------------------------
drop policy if exists journal_entries_select on journal_entries;
create policy journal_entries_select on journal_entries for select to authenticated
  using (user_id = auth.uid());

drop policy if exists journal_entries_insert on journal_entries;
create policy journal_entries_insert on journal_entries for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists journal_entries_update on journal_entries;
create policy journal_entries_update on journal_entries for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists journal_entries_delete on journal_entries;
create policy journal_entries_delete on journal_entries for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. updated_at, kept honest by the database.
--
-- The grid shows "edited" against entries that have been changed, and a client
-- that forgets to send the column makes that a lie. Doing it in a trigger also
-- means a row updated from the SQL editor tells the truth too.
-- ---------------------------------------------------------------------------
create or replace function touch_journal_entry()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists journal_entries_touch on journal_entries;
create trigger journal_entries_touch
  before update on journal_entries
  for each row execute function touch_journal_entry();

-- ---------------------------------------------------------------------------
-- 4. The passcode, and why it is not a column on profiles.
--
-- The obvious home for this is next to the pronouns and the birthday. That
-- would be a hole big enough to drive through: profiles_select in 03_policies
-- lets anybody who shares a group with you read your entire profile row, so
-- every group member would hold the passcode hash of every other member. Four
-- digits is ten thousand candidates, and ten thousand candidates against a
-- hash you already have is a loop that finishes over lunch.
--
-- So it gets its own table whose select policy is auth.uid() and nothing else.
-- Nobody reads this but its owner, including people you share a group with,
-- including the rest of this schema.
--
-- WHAT IT DOES AND DOES NOT DO. It stops somebody picking up an unlocked
-- phone, which is the thing that actually happens. It does not encrypt
-- anything: the entries above are plain text and readable by anybody holding
-- the database, service key in hand. Making that untrue means encrypting the
-- bodies with a key derived from the passcode, which is buildable on exactly
-- this record and which makes a forgotten passcode a permanently unreadable
-- journal. That trade belongs to the person whose diary it is.
--
-- The salt and the iteration count are stored beside the hash rather than
-- baked into the client, so raising the count later does not lock out anybody
-- who set a passcode before it changed. See src/lib/lock.js.
-- ---------------------------------------------------------------------------
create table if not exists journal_locks (
  user_id    uuid primary key references profiles(id) on delete cascade,
  hash       text not null check (hash ~ '^[0-9a-f]{64}$'),
  salt       text not null check (salt ~ '^[0-9a-f]{32}$'),
  iterations int  not null default 210000 check (iterations >= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table journal_locks enable row level security;

drop policy if exists journal_locks_select on journal_locks;
create policy journal_locks_select on journal_locks for select to authenticated
  using (user_id = auth.uid());

drop policy if exists journal_locks_insert on journal_locks;
create policy journal_locks_insert on journal_locks for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists journal_locks_update on journal_locks;
create policy journal_locks_update on journal_locks for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Turning the lock off. The row goes rather than a flag flipping, so "no
-- passcode" is the absence of a record instead of a record that says it does
-- not count, and there is one fewer state for anything to get wrong.
drop policy if exists journal_locks_delete on journal_locks;
create policy journal_locks_delete on journal_locks for delete to authenticated
  using (user_id = auth.uid());

drop trigger if exists journal_locks_touch on journal_locks;
create trigger journal_locks_touch
  before update on journal_locks
  for each row execute function touch_journal_entry();

-- ---------------------------------------------------------------------------
-- 5. Has the onboarding slider been read?
--
-- On profiles rather than in localStorage, so dismissing it on a phone also
-- dismisses it on a laptop. Same shape as has_seen_budget_intro, and same
-- reason: a carousel that reappears on every device somebody signs in on is a
-- carousel they learn to swipe away without reading.
-- ---------------------------------------------------------------------------
alter table profiles add column if not exists has_seen_journal_intro boolean not null default false;

-- PostgREST caches the schema, so new tables are invisible to the API until it
-- is told. Without this the app gets "relation does not exist" against a table
-- that is plainly there in the editor.
notify pgrst, 'reload schema';

-- Check:
--   select day, kind, left(body, 40) from journal_entries order by day desc limit 10;
--   select user_id, iterations from journal_locks;
