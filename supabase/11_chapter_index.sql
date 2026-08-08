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
