# The manuscripts

One directory per book, named with the book's `slug`. One markdown file per
chapter, named with the chapter number:

```
content/books/
  design-beats-discipline/
    01-the-fuel-tank-that-wasnt.md
  evidence-of-yourself/
    01-confidence-follows-action.md
  story-you-tell/
    01-the-moment-after-failure.md
```

The number at the front of the filename is the chapter's `idx`. Everything
after it is for humans, the title shown in the app comes from the seed, not
from the filename, so renaming a file cannot break a table of contents.

## Adding or editing a chapter

1. Write or edit the `.md` file.
2. `node scripts/build-chapters.mjs`
3. Paste the regenerated `supabase/08_chapter_bodies.sql` into the Supabase
   SQL Editor and run it.

Step 3 is safe to repeat as often as you like. The generated file only ever
updates bodies and word counts for chapters that already exist; it never
creates, deletes or reorders anything, so it cannot disagree with the seed.

**Order matters once:** `07_books_all_in_one.sql` has to have been run first.
That is the file that creates the tables, the three books, and the chapters
with their titles and preview flags. `08` fills in the prose.

## Which chapters are still placeholder

After running both files:

```sql
select b.slug, c.idx, c.title
  from chapters c join books b on b.id = c.book_id
 where c.body like '%PLACEHOLDER.%'
 order by b.slug, c.idx;
```

## House style

Set by the brief the placeholder text describes, and worth keeping to:

- Open on a situation the reader recognises, not on a definition.
- Name the researchers and say what they actually did. "A study found" is not
  a citation and reads as though you are hiding something.
- **Say where the evidence is thin, and say it before someone else does.**
  Two of these three books are about findings that were oversold in the
  popular press; conceding that early is what buys the rest of the argument.
- End on one specific thing to do this week. One, not a list.
- No manufactured urgency, no hype, no "secret".

## Chapter 1 is the shop window

The first chapter of each book is the free preview, and the paywall that
enforces that lives in the database policy, not in the app. It should be the
strongest chapter in the book, it is what someone reads before deciding
whether to pay for the other eight.
