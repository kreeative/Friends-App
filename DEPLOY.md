# Going live

Supabase, then Vercel, then Stripe, then the domain. Nothing here needs a paid
plan except the domain and Stripe's per-transaction fee.

The SQL and the row level security have been executed and exercised against a
real PostgreSQL 16, group creation, joining by code, check-in submission,
offline replay, cross-group isolation, and the library paywall all behave as
intended. What follows is configuration, not debugging.

---

## 1. Supabase

**Create the project.** Pick a region close to your users. `eu-west-1`
(Ireland) or `eu-central-1` (Frankfurt) for Europe. The region cannot be
changed later, and it is what your privacy policy points at.

**Run the SQL in order.** Order matters: policies in `03` call functions from
`02`, which reference tables from `01`.

```
supabase/01_schema.sql      tables and indexes
supabase/02_functions.sql   is_member(), cycles, tick(), submit_checkin()
supabase/03_policies.sql    RLS for the check-in app
supabase/07_books_all_in_one.sql  the library: tables, paywall, 3 books
supabase/08_chapter_bodies.sql    the written chapters (generated)
```

`04_schedule.sql` is separate, see step 4.

`07` is `05_library.sql` and `06_library_seed.sql` concatenated, so it is one
paste rather than two. **Skip it and the Library page has nothing to show**, it will now name this file rather than claiming no books have been published.
`08` then replaces the placeholder chapter text with the written manuscripts;
re-run it after every edit to `content/books/`.

**Enable sign-in.** Authentication → Providers. Email works with no setup.
For Google you need an OAuth client from the Google Cloud console; Supabase
shows you the callback URL to paste into Google's authorised redirect URIs.

**Add your URLs.** Authentication → URL Configuration → Redirect URLs:

```
http://localhost:5173
https://your-project.vercel.app
https://richandfriends.xyz
```

A sign-in returning to a URL not on this list fails. The app now says so
explicitly rather than silently returning you to the sign-in screen.

**Replace the sign-in email.** Out of the box, a magic link arrives from
"Supabase Auth" with Supabase's own footer, because the project is using
Supabase's shared SMTP and its default template. Two reasons that cannot stay:

- It is not your brand, and the footer advertises someone else's product on a
  transactional email your buyers receive.
- **The built-in sender is rate limited**, a handful of emails per hour on the
  free tier, and Supabase documents it as unsuitable for production. Once more
  than a couple of people try to sign in, they get "email rate limit exceeded"
  and no message arrives at all.

Fix both under **Authentication → Emails**:

*SMTP Settings*, point at Resend, which you need anyway for the digests:

```
Host      smtp.resend.com
Port      465
Username  resend
Password  your Resend API key
Sender    hi@richandfriends.xyz
Name      Rich & Friends
```

The sender domain has to be verified in Resend first, so this waits until the
domain is connected (step 5).

*Email Templates → Magic Link*, paste `supabase/email/magic-link.html`. It is
bilingual, since Supabase stores only one template per type. Leave
`{{ .ConfirmationURL }}` exactly as written; that is the token Supabase
substitutes.

**Copy your keys.** Project Settings → API. You need the Project URL, the
anon/publishable key, and (for the Stripe webhook only) the service role key.
The service role key bypasses every policy in `03_policies.sql` and
`05_library.sql`. It belongs in Vercel's server-side environment and nowhere
else.

---

## 2. Vercel

Import the repository at vercel.com/new. `vercel.json` already declares the
build command, the output directory and the SPA rewrite, so accept what it
offers. The rewrite deliberately excludes `/api/`, or the serverless functions
would be swallowed by the single-page fallback.

Set the environment variables under Settings → Environment Variables:

| Key | Value | Exposed to browser |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `https://YOUR-PROJECT.supabase.co` | yes |
| `VITE_SUPABASE_ANON_KEY` | anon / publishable key | yes |
| `SUPABASE_URL` | same as above | no |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key | **no, never** |
| `STRIPE_SECRET_KEY` | `sk_live_…` or `sk_test_…` | no |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` (step 3) | no |

Only `VITE_*` reaches the client bundle, that prefix is the whole mechanism,
so anything without it stays server-side. Vite inlines the `VITE_*` values at
build time, so changing one needs a redeploy, not a restart.

### Vercel and Supabase hold different secrets, and neither reads the other's

This has already caused a wasted afternoon, so it is spelled out. There are two
separate places that run code, and a variable set in the wrong one is not a
warning, it is silence.

**Vercel** runs everything in `api/`, which reads `process.env` through
`api/_env.js`. Every Stripe and Plaid variable belongs here and only here:
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PLAID_CLIENT_ID`,
`PLAID_SECRET`, `PLAID_ENV`.

**Supabase** runs the `notify` edge function, which reads `Deno.env.get`.
Setting a secret there makes it visible to that function and to nothing else.
It belongs here and only here: `RESEND_API_KEY`, `MAIL_FROM`, `SUPPORT_EMAIL`,
`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

Putting `STRIPE_WEBHOOK_SECRET` in Supabase as well as Vercel does not break
anything and does not help either: no Supabase function reads it. It is still
worth deleting the spare copy. A key that lives in two places has to be rotated
in two places, and the forgotten one is the one that is still valid when
somebody thought they had revoked it.

The one thing that must not move is the VAPID private key. It goes in Supabase
and nowhere else: not in the repository, not in Vercel, not in a message.

### The Stripe publishable key is not needed at all

Checkout here is Stripe-hosted. `api/checkout.js` creates the session on the
server and returns `session.url`, and the browser navigates to it. There is no
Stripe.js in the bundle and no `@stripe/stripe-js` dependency, so nothing ever
asks for a `pk_`. A publishable key set on Vercel is simply unused. It is safe
to leave and tidier to delete.

`STRIPE_SECRET_KEY` is the one that matters, and it belongs on Vercel exactly
as it is.

### Never put a Stripe key behind a VITE_ name

Worth stating on its own, because it is the one mistake here that cannot be
undone by editing a variable.

Vite does not inline only the `VITE_*` values the code reads. It builds
`import.meta.env` as a static object containing **every** `VITE_*` variable in
the environment and ships that object in the bundle. A variable nothing
imports still reaches the browser.

So `STRIPE_SECRET_KEY` is correct and `VITE_STRIPE_SECRET_KEY` publishes a live
payments key to every visitor, with no error, no warning, and a site that works
perfectly. The difference between those two names is five characters typed into
a dashboard field.

`src/lib/apiSyntax.test.mjs` now fails the build on a `VITE_` name that looks
server-side, and scans `dist/` for `sk_`, `rk_`, `whsec_`, Resend and
`service_role` shapes. That scan only sees the build on the machine running it,
so it is a tripwire rather than proof about production.

A publishable key (`pk_`) is designed to be public and is safe anywhere. A
secret key (`sk_`) grants the account. Check the prefix, not the label.

Then add the Vercel URL to Supabase's redirect list.

---

## 3. Stripe

**Get the keys.** Developers → API keys. Use test keys until you have bought
your own book end to end.

**Create the webhook.** Developers → Webhooks → Add endpoint:

```
https://your-domain/api/stripe-webhook
event: checkout.session.completed
```

Copy the signing secret into `STRIPE_WEBHOOK_SECRET` and redeploy.

**Test locally** before trusting it:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe-webhook
# prints a whsec_…, put that in .env for local runs
stripe trigger checkout.session.completed
```

Use `vercel dev` rather than `vite` locally, or `/api/*` will not exist.

**Two things about this flow worth knowing.** The price is read from the
database, never from the request, a client that could name its own price
could buy a book for a cent. And entitlement is written *only* by the webhook:
`entitlements` has no INSERT policy at all, so even a fully compromised
browser session cannot grant itself a book.

Stripe retries webhooks. The insert is an upsert against a unique
`(user_id, book_id)`, so a redelivery is a no-op rather than a second row, verified against a real database.

---

## 4. The scheduled job

Only needed for the two emails. Everything else works without it, because the
client calls `tick()` on load.

```bash
supabase functions deploy notify --no-verify-jwt
supabase secrets set RESEND_API_KEY=... MAIL_FROM="Rich & Friends <hi@richandfriends.xyz>"
```

Then edit `supabase/04_schedule.sql`, replace `YOUR-PROJECT` and
`YOUR-SERVICE-ROLE-KEY`, and run it.

Without `RESEND_API_KEY` the function logs what it would have sent instead of
sending, which is the right way to test the schedule before wiring up mail.

---

## 5. The domain

`richandfriends.xyz` is registered at GoDaddy. In Vercel: Settings → Domains →
Add. Vercel shows the records to create; GoDaddy supports no `ALIAS`, so the
apex needs the A record Vercel displays and `www` needs a CNAME to
`cname.vercel-dns.com`. Alternatively point GoDaddy's nameservers at Vercel and
let it manage both.

Certificates are issued automatically once DNS resolves.

Then, in this order:

- add `https://richandfriends.xyz` to Supabase → URL Configuration **before**
  making it the primary domain, or sign-in breaks the moment it switches;
- point the Stripe webhook at the final domain;
- verify the domain in Resend so `MAIL_FROM` can use it;
- fill the domain and a contact address into the `[BRACKETS]` in
  `src/legal/content.js`.

Neither Vercel nor GoDaddy includes mailbox hosting. **ImprovMX** (any DNS) or
**Cloudflare Email Routing** (Cloudflare DNS) will forward
`contact@richandfriends.xyz` to an existing inbox for free.

---

## Troubleshooting

### After Google, the browser lands on `localhost` and cannot connect

The single most common setup failure, and it is one setting.

Supabase Auth has two separate fields under **Authentication → URL
Configuration**:

- **Site URL**, where it sends people by default.
- **Redirect URLs**, the allowlist of where it is *permitted* to send them.

The app asks to come back to wherever it is running (`window.location.origin`).
If that address is not on the allowlist, Supabase does not error, it silently
falls back to **Site URL**. A new project's Site URL is `http://localhost:3000`,
so a phone gets sent to itself, finds nothing listening, and shows "Safari
can't open the page".

Fix both fields:

```
Site URL:       https://richandfriends.xyz

Redirect URLs:  https://richandfriends.xyz/**
                https://www.richandfriends.xyz/**
                https://YOUR-PROJECT.vercel.app/**
                http://localhost:5173/**
```

The `/**` wildcard matters, without it only the exact root path is allowed,
and any return carrying query parameters is rejected.

Note that the URI registered in the **Google Cloud console** is a different
thing again: that one must be Supabase's callback,
`https://YOUR-PROJECT.supabase.co/auth/v1/callback`, not your site. If it were
wrong you would have been stopped by Google rather than bounced back.

### "Could not find the table 'public.group_members' in the schema cache"

The database is empty, the migrations in `supabase/` were never run. Nothing
in the application creates tables; they exist only because you ran the SQL.

Open Supabase → SQL Editor and run the files **in this order**, waiting for
each to report success before starting the next:

```
01_schema.sql       tables and indexes
02_functions.sql    is_member(), cycles, tick(), submit_checkin()
03_policies.sql     row level security
07_books_all_in_one.sql   the library: tables, paywall policy, 3 books
08_chapter_bodies.sql     the written chapters
```

The order is not cosmetic: `03` defines policies that call functions created
in `02`, which reference tables created in `01`. Running them out of order
fails with a missing-function or missing-relation error. The same applies to
the last two. `08` only updates rows that `07` created, so on its own it
succeeds and changes nothing, which is the confusing way to fail.

`07` was marked optional here for a long time. It is not: the Library page is
empty until it runs, and the buy button has nothing to sell.

**Paste the contents of the file, not its name.** The SQL editor runs exactly
the characters in the box, it has no notion of files or paths. Pasting the
line `supabase/01_schema.sql` produces:

```
ERROR: syntax error at or near "supabase"
LINE 1: supabase/01_schema.sql
        ^
```

Postgres is reading `supabase` as the start of a statement. The same happens
if a stray heading or a note in another language is left above the SQL: the
box must contain SQL and nothing else, with no filename on the first line.

Open each file, select all of it, copy, paste into a **new query**, Run. The
raw text is one click away:

```
https://raw.githubusercontent.com/kreeative/friends-app/main/supabase/01_schema.sql
https://raw.githubusercontent.com/kreeative/friends-app/main/supabase/02_functions.sql
https://raw.githubusercontent.com/kreeative/friends-app/main/supabase/03_policies.sql
https://raw.githubusercontent.com/kreeative/friends-app/main/supabase/05_library.sql
https://raw.githubusercontent.com/kreeative/friends-app/main/supabase/06_library_seed.sql
```

A correct paste starts with a comment or a `create`. Every file here opens on
a `-- ====` rule. If the first line of your paste is not a `--` comment or a
SQL keyword, that is the bug.

If the tables clearly exist and the message persists, PostgREST is holding a
stale schema cache. It normally reloads within seconds; to force it, run
`notify pgrst, 'reload schema';` in the SQL editor.

Worth knowing why this surfaced only now: before the error handling was added,
a failed group query was indistinguishable from "this user has no groups", so
the app showed the Start screen instead. Creating a group there would have
failed too, just as quietly.

### Sign-in returns to the app but nothing happens

The address is missing from the Redirect URLs allowlist. The app now shows
this as a message naming the setting rather than silently returning to the
sign-in screen.

### The app shows "Supabase is not configured"

`VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing from Vercel, or was
added after the last build. Vite inlines them at build time, redeploy after
adding them.

---

## What the watermark does and does not do

Describe it to buyers honestly, because the distinction matters.

**It does:** print the buyer's name and a short account tag faintly behind the
text and in the margin, so a leaked screenshot or PDF can be traced back to the
account it came from.

**It does not:** prevent copying. Nothing on the web can. The browser has to
render the words to show them, and anything rendered can be screenshotted,
selected via developer tools, or photographed off the screen. Any product
claiming otherwise is selling false confidence.

What actually protects the books is that they are cheap enough that copying is
not worth the effort, that each chapter is fetched one at a time behind a
server-side entitlement check so nobody can pull a whole book from a public
endpoint, and that a bought copy carries progress and highlights a pirated one
does not.

---

## Checklist

- [ ] SQL 01, 02, 03, 05, 06 run in order without error
- [ ] Sign-in provider enabled; all redirect URLs added, including localhost
- [ ] Vercel env vars set, six of them, only two prefixed `VITE_`
- [ ] Deployed, and the Vercel URL added back to Supabase
- [ ] Stripe webhook created, secret set, test purchase completed
- [ ] `notify` deployed and `04_schedule.sql` run
- [ ] Domain connected, added to Supabase, pointed at by Stripe and Resend
- [ ] `[BRACKETS]` in `src/legal/content.js` filled in
- [ ] Repository set to private
- [ ] Placeholder chapters replaced with the manuscripts
