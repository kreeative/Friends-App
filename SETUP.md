# Turning the site on

Five files of SQL, pasted into Supabase in order. That is the whole job.

Nothing in the app can do this for you: the code knows how to *read* the
tables, but only you can create them, because only you can sign in to your own
database.

**Time: about ten minutes.** You cannot break anything by doing it twice, every file is written to be safe to re-run.

---

## Before you start

Open <https://supabase.com/dashboard>, pick your project, and click **SQL
Editor** in the left sidebar. That is where everything below gets pasted.

You will paste from files in this repo. The easiest way to get their contents:

- on GitHub, open the file and press the **Copy raw file** button, or
- open the file on your computer and copy everything in it.

Copy the **whole file**, from the first line to the last.

---

## The order

Run these one at a time. Paste, press **Run**, wait for it to say success,
*then* clear the editor and do the next one.

| # | File | What it does |
|---|------|--------------|
| 1 | `supabase/01_schema.sql` | The tables |
| 2 | `supabase/02_functions.sql` | Cycles, check-ins, the weekly tick |
| 3 | `supabase/03_policies.sql` | Who is allowed to see what |
| 4 | `supabase/07_books_all_in_one.sql` | **The books**, tables, paywall, and the three titles |
| 5 | `supabase/08_chapter_bodies.sql` | **The writing**, the chapters themselves |
| 6 | `supabase/09_solo_goals_and_leaving.sql` | Goals without a group; leaving and deleting a group |
| 7 | `supabase/10_cad_and_stripe.sql` | Prices in CAD, and the Stripe product for each book |
| 8 | `supabase/11_chapter_index.sql` | Chapter titles public, bodies still paywalled |

The order is not cosmetic. Step 3 defines rules that call functions made in
step 2, which use tables made in step 1. Step 5 only fills in chapters that
step 4 created, run it alone and it will succeed while changing nothing,
which is the confusing way to fail.

If you have already done 1 to 3 in the past, start at 4.

---

## Did it work?

After step 5, paste this and press Run:

```sql
select b.slug,
       b.title,
       count(c.*)                        as chapters,
       count(*) filter (where c.is_preview) as free,
       min(c.word_count)                 as shortest_chapter
  from books b
  left join chapters c on c.book_id = b.id
 group by b.slug, b.title
 order by b.title;
```

You should get **three rows**, each with **9 or 10 chapters** and **1 free**
one.

Look at `shortest_chapter`. If it says `2900` for a book, that book is still
placeholder text, go back and run step 5.

To see which chapters are still unwritten:

```sql
select b.slug, c.idx, c.title
  from chapters c join books b on b.id = c.book_id
 where c.body like '%PLACEHOLDER.%'
 order by b.slug, c.idx;
```

Today that will list 25 chapters. Three are written, chapter 1 of each book,
which is the free preview and the only part someone reads before deciding to
pay.

Now open the site and go to **Library**. The three books are there.

---

## When something goes wrong

**"relation … does not exist"**, you skipped a file, or ran them out of
order. Start again at step 1; re-running the earlier ones is harmless.

**The Library says the catalogue is empty**, step 4 has not run. The page
names the file it wants; that is what it is telling you.

**The Library says the tables do not exist**, same thing, one step earlier.
Step 4 again.

**Everything works but the chapters are gibberish about PLACEHOLDER**, step
5 has not run, or it ran before step 4.

---

## Buying a book

The books display and the free chapter reads with nothing more than the above.
**Taking money needs three more things**, set in Vercel under
Settings → Environment Variables:

```
STRIPE_SECRET_KEY           sk_live_… or sk_test_…
STRIPE_WEBHOOK_SECRET       whsec_…
SUPABASE_SERVICE_ROLE_KEY   from Supabase → Settings → API
```

**If Vercel refuses the name `SUPABASE_SERVICE_ROLE_KEY`**, store it as
`service_role` instead. The code accepts either, and also `SERVICE_ROLE` and
`SUPABASE_SERVICE_KEY`, so whichever one the dashboard lets you save will
work. The same applies to the other two: `stripe_secret_key` and
`stripe_webhook_secret` are accepted in lower case.

Each book is sold through a Stripe **Product**, and every product needs a
**default price** set on it in the Stripe dashboard. Without one, checkout
says so by name rather than failing generically: a Product carries no amount,
only its Price does.

Redeploy after adding them. Vercel does not pick up new variables on a
running deployment.

Until they are set, the Buy button says exactly which ones are missing rather
than failing silently. That message is for you, not for customers, so set them
before you tell anyone the site is open.

Full Stripe setup, including the webhook, is in `DEPLOY.md`.

---

## Changing the writing

The manuscripts are markdown files in `content/books/`, one folder per book.
Edit the prose there, then:

```
node scripts/build-chapters.mjs
```

That regenerates `supabase/08_chapter_bodies.sql`. Paste it into the SQL
Editor and run it. Repeat as often as you like, it only ever updates the
chapter text, and it cannot disturb the books, the titles, or which chapter is
free.
