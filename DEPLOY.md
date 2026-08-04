# Going live

Four things, in this order. Nothing here needs a paid plan except the domain,
and even that is optional at the start.

The SQL and the row level security in this repo have been executed and
exercised against a real PostgreSQL 16 — group creation, joining by code,
check-in submission, offline replay, and cross-group isolation all behave as
intended. What follows is configuration, not debugging.

---

## 1. Supabase

**Create the project** at supabase.com. Pick a region close to your users —
`eu-west-1` (Ireland) or `eu-central-1` (Frankfurt) if the group is in Europe.
The region cannot be changed later, and it is what your privacy policy points
at when it mentions where data lives.

**Run the SQL.** Open SQL Editor and run the files in order. Order matters:
the policies in `03` call functions defined in `02`, which reference tables
created in `01`.

```
supabase/01_schema.sql
supabase/02_functions.sql
supabase/03_policies.sql
```

Each should finish with no error. If `02` warns that the trigger
`on_auth_user_created` does not exist, that is expected — it is a `drop if
exists` running on a clean database.

**Turn on Google sign-in.** Authentication → Providers → Google. You will need
an OAuth client from the Google Cloud console: create a project, then
Credentials → Create OAuth client ID → Web application. Supabase shows you the
callback URL to paste into Google's "Authorised redirect URIs" — it looks like
`https://YOUR-PROJECT.supabase.co/auth/v1/callback`. Copy Google's client ID
and secret back into Supabase.

Email sign-in works with no setup and is already wired as the fallback, so you
can test before touching Google at all.

**Add your URLs.** Authentication → URL Configuration → Redirect URLs:

```
http://localhost:5173
https://YOUR-SITE.netlify.app
https://yourdomain          ← once you have one
```

A sign-in that returns to a URL not on this list fails silently. It is the
single most common first-deploy problem.

**Copy your keys.** Project Settings → API. You need the Project URL and the
`anon` key. The `service_role` key on that page must never go near the
frontend — it bypasses every policy in `03_policies.sql`.

---

## 2. Netlify

Connect the repository at app.netlify.com → Add new site → Import an existing
project. `netlify.toml` already declares the build command, the publish
directory and the SPA redirect, so accept what it offers.

Then add the two variables under Site configuration → Environment variables:

| Key | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://YOUR-PROJECT.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | your anon key |

Deploy. Vite inlines `VITE_*` at build time, so changing either value later
needs a fresh deploy, not just a restart.

Finally, go back to Supabase and add the `.netlify.app` URL to the redirect
list. Sign-in will not work until you do.

---

## 3. The scheduled job

Only needed for the two emails. Everything else works without it, because the
client calls `tick()` on load.

```bash
supabase functions deploy notify --no-verify-jwt
supabase secrets set RESEND_API_KEY=... MAIL_FROM="Rich & Friends <hi@yourdomain>"
```

Then edit `supabase/04_schedule.sql`, replace `YOUR-PROJECT` and
`YOUR-SERVICE-ROLE-KEY`, and run it in the SQL editor.

Without `RESEND_API_KEY` the function logs what it would have sent instead of
sending it, which is the right way to test the schedule before wiring up mail.

Note that Resend will only send from a domain you have verified, so a custom
`MAIL_FROM` waits until step 4. Until then it falls back to Resend's own
sandbox sender, which is fine for testing with your own address.

---

## 4. A domain

**Free, and real:** Netlify gives every site a `*.netlify.app` subdomain with
working HTTPS. `richandfriends.netlify.app` costs nothing and is a legitimate
place to launch. Site configuration → Domain management → Options → Edit site
name.

**Avoid the "free domain" TLDs.** `.tk`, `.ml`, `.ga`, `.cf` were handed out by
Freenom, which stopped issuing them and has a long history of reclaiming names
without warning. A brand you intend to protect should not sit on one.

**Cheap and yours,** roughly, per year:

| | Typical cost | Notes |
| --- | --- | --- |
| `.xyz` | €1–3 first year, ~€12 after | Cheapest real option |
| `.fr` | €7–10 | Requires an EU address; fits a French publisher |
| `.com` | €10–12 | Worth it if you intend to register the trade mark |
| `.app` | €14–18 | HTTPS enforced by the TLD |

Buy at cost from Cloudflare Registrar or Porkbun — neither marks up renewals,
which is where cheap registrars make their money back. If you are a student,
the GitHub Student Developer Pack includes a free `.me` for a year.

**Genuinely free, if you can wait:** `eu.org` hands out real subdomains such as
`richandfriends.eu.org` at no cost and has done since 1996. Approval is manual
and can take days or weeks. It works, but it reads as a hobby address rather
than a brand.

### Getting "netlify" out of the address bar

Nothing else has to change: Netlify does not put a badge, a banner or any
branding on the page itself, on any plan. The subdomain is the only place the
name appears.

Once you own a domain:

1. **Netlify → Domain management → Add a domain.** Enter the domain without
   `https://`. Netlify checks that you own it and then shows you the DNS
   records to create.

2. **Point the DNS.** Two ways, and Netlify will offer both:

   *Netlify DNS* — change the nameservers at your registrar to the four
   Netlify gives you. Simplest, and apex domains work without special record
   types.

   *Keep your registrar's DNS* — add the records exactly as Netlify displays
   them: a CNAME for `www` pointing at your `*.netlify.app` hostname, and for
   the apex either an `ALIAS`/`ANAME` record if your registrar supports one
   (Cloudflare and Porkbun both do) or the A record Netlify shows. Use the
   values on screen rather than any written down elsewhere — Netlify's
   addresses change occasionally.

3. **Wait.** Usually minutes, occasionally a few hours. Netlify issues a
   Let's Encrypt certificate automatically once DNS resolves; there is nothing
   to buy or upload.

4. **Set the primary domain** under Domain management, and turn on *Force
   HTTPS*. Requests to the `.netlify.app` address will then redirect to your
   domain, so the old one stops appearing.

Then, and this order matters:

- add the new URL to Supabase → Authentication → URL Configuration, or
  sign-in breaks the moment the domain becomes primary;
- verify the domain in Resend so `MAIL_FROM` can use it;
- fill the domain into the `[BRACKETS]` in `src/legal/content.js`.

### If the domain is at GoDaddy

GoDaddy does not support `ALIAS`/`ANAME` records, so the apex cannot be
pointed at a hostname. That leaves two routes.

**Switch the nameservers to Netlify** (simplest). Netlify → Domains → Add a
domain, then copy the four `*.nsone.net` nameservers it gives you. In GoDaddy:
My Products → the domain → **Nameservers → Change → I'll use my own
nameservers** → paste all four → Save. Netlify then handles the apex and `www`
without further records.

Note this switches *all* DNS for the domain away from GoDaddy — any email
forwarding or other records configured there stop working.

**Or keep DNS at GoDaddy.** Delete the parked `@` A record and the default
`www` CNAME GoDaddy creates, then add exactly what Netlify shows: an A record
for `@` pointing at Netlify's load balancer, and a CNAME for `www` pointing at
`your-site.netlify.app`. Use the address on Netlify's screen rather than one
copied from a guide — it has changed before.

Three GoDaddy-specific things worth checking on the day you buy:

- **Renewal price.** The cheap first year is promotional; `.xyz` renews far
  higher at GoDaddy than at Porkbun or Cloudflare. Decide now whether to keep
  it there or transfer after the 60-day lock ICANN imposes on new
  registrations.
- **Auto-renew** is on by default. Leave it on — losing the domain is worse —
  but know what it will charge.
- **WHOIS privacy.** Confirm it is enabled. Without it, the postal address of
  an individual registrant is publishable, which matters here because the
  legal notice already names a private person.

### A contact address at the domain

The legal texts need a working email at the domain, and neither Netlify nor
GoDaddy provides mailbox hosting free. Two free routes that forward to an
existing inbox:

- **ImprovMX** — works with any DNS provider, two MX records and a TXT.
- **Cloudflare Email Routing** — free, but requires Cloudflare to be the DNS
  provider. That combines fine with Netlify hosting: keep DNS at Cloudflare
  and point the records at Netlify.

**Connecting it:** Netlify → Domain management → Add a domain, then point your
registrar's nameservers at Netlify, or add the CNAME it gives you. HTTPS is
issued automatically within a few minutes.

Then, in order: add the new URL to Supabase's redirect list, verify the domain
in Resend so `MAIL_FROM` can use it, and fill the domain into the legal texts
in `src/legal/content.js`.

---

## Checklist

- [ ] SQL files 01, 02, 03 run in order, no errors
- [ ] Google provider configured, or email fallback accepted for now
- [ ] All redirect URLs added, including localhost
- [ ] Netlify env vars set and site deployed
- [ ] Deployed URL added back to Supabase
- [ ] `notify` function deployed and `04_schedule.sql` run
- [ ] Domain connected, added to Supabase, verified in Resend
- [ ] `[BRACKETS]` in `src/legal/content.js` filled in
- [ ] Repository set to private
