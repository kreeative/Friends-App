-- ---------------------------------------------------------------------------
-- 54. A shared book reaches somebody.
--
-- Safe to re-run.
--
-- WHY THIS EXISTS.
--
-- After a purchase the library offers "let your friends know". Pressing it
-- inserted a row into reading_shares, and nothing in the entire application
-- ever read that table. It was reported the only way it could be: "I went
-- and looked afterwards and saw nothing."
--
-- So the button wrote to a table that had no readers. This gives it one, in
-- the place the app already shows things that arrived while you were away:
-- the notification inbox.
--
-- WHY A TRIGGER RATHER THAN A SECOND INSERT FROM THE BROWSER.
--
-- Same reason 50 uses one for shared goals. Two inserts from the client is two
-- chances to write half of it, and the second one runs under the sharer's own
-- policies, which do not let them write a row addressed to somebody else. A
-- SECURITY DEFINER trigger writes both sides in one transaction or neither.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Two more kinds of message.
--
-- The check constraint is the gate: a kind it does not know cannot be
-- inserted, so the trigger below would raise and the share would fail. Widened
-- before anything tries to use them.
--
-- 'book' is somebody sharing a book with the group. 'nudge' is reserved here
-- rather than in a later file, because the alternative is doing this same
-- constraint dance twice.
-- ---------------------------------------------------------------------------
alter table notification drop constraint if exists notification_kind_check;
alter table notification add constraint notification_kind_check
  check (kind in ('group_goal', 'book', 'nudge'));

-- ---------------------------------------------------------------------------
-- 2. The subject of a book notification.
--
-- Nullable, because every row written before this migration has no book and
-- never will. on delete cascade, so removing a book from the catalogue takes
-- the messages about it rather than leaving rows pointing at nothing.
-- ---------------------------------------------------------------------------
alter table notification add column if not exists book_id uuid references books(id) on delete cascade;

-- ---------------------------------------------------------------------------
-- 3. Fan the share out to the group.
--
-- Everyone in the group except the person who shared it. They already know.
--
-- The href goes to the library rather than to a book page, because a member
-- who does not own the book cannot open it and landing on a paywall from a
-- friend's recommendation reads as a sales pitch rather than as news.
-- ---------------------------------------------------------------------------
create or replace function notify_book_share()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notification (user_id, kind, href, book_id, actor_id, group_id)
  select gm.user_id,
         'book',
         '/library',
         new.book_id,
         new.user_id,
         new.group_id
    from group_members gm
   where gm.group_id = new.group_id
     and gm.user_id is distinct from new.user_id;

  return new;
end $$;

drop trigger if exists reading_shares_notify on reading_shares;
create trigger reading_shares_notify
  after insert on reading_shares
  for each row execute function notify_book_share();

-- ---------------------------------------------------------------------------
-- 4. Let the inbox read the book's title.
--
-- The notification page joins books(title) the way it already joins
-- goals(commitment). Without a select policy the join returns null and every
-- book message reads "shared a book" with no book in it.
--
-- Books are a public catalogue, so this is a plain read for any signed-in
-- person. It exposes nothing: the titles are on the marketing site.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_policies
     where tablename = 'books' and policyname = 'books_select_all'
  ) then
    create policy books_select_all on books for select to authenticated using (true);
  end if;
end $$;

notify pgrst, 'reload schema';
