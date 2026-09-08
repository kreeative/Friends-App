# Rich & Friends

A small-group accountability app built around one shared daily check-in instead
of a wall of goals. It has since grown a budget, a course library and a
calendar, but the check-in is still the thing it is for.

© 2026 Anne-Kelly Kouyaté. All rights reserved. This is proprietary software, see [LICENSE](./LICENSE). The published legal texts live in
[`src/legal/content.js`](./src/legal/content.js) and are served at `/legal/terms`,
`/legal/privacy` and `/legal/notice`.

v1 worked and went quiet after nine days. v2 is built against the specific
reasons accountability apps die, vague goals, no response to silence, no
ritual, punitive streaks, guilt-shaped UI. The reasoning behind each choice is
in [`DECISIONS.md`](./DECISIONS.md), including four places this departs from
the original brief and how to reverse them.

## Stack

React + Vite + Tailwind, Supabase for data and auth, static deploy to Vercel.
The one piece that is not static is a scheduled Supabase Edge Function, see
[Why there is a scheduled job](#why-there-is-a-scheduled-job).

```
src/
  context/      auth + group state
  components/   AppShell, GoalCard, CheckinRail, WaterToday, WeekStrip, ui
  pages/        Dashboard, Board, Goals, Money, Courses, Calendar, Library,
                Settings, Terms, Setup, SignIn, Welcome
  lib/          supabase client, offline queue, stats, time and unit helpers
  content/      courses, glossary, landing and marketing copy, in fr and en
  legal/        the served terms, privacy policy and legal notice
supabase/
  01_schema.sql      tables + indexes
  02_functions.sql   is_member(), cycle generation, tick(), submit_checkin()
  03_policies.sql    RLS, every policy explained inline
  04_schedule.sql    pg_cron jobs
  05..65_*.sql       every later migration, in order, each one commented
  functions/notify/  reminder, digest and nudge sender (Deno)
```

The numbered SQL files are the schema's history and they are meant to be read:
each one opens with what was asked for and why the shape is what it is.

## Setup

### 1. Supabase

Create a project, then run the SQL files **in order** in the SQL editor:

```
01_schema.sql  →  02_functions.sql  →  03_policies.sql
```

Then enable a sign-in method under **Authentication → Providers**. Google is
the primary path in the UI; email OTP works as a fallback with no extra setup.
Add your deployed URL and `http://localhost:5173` under **URL Configuration →
Redirect URLs**.

### 2. Local

```bash
npm install
cp .env.example .env      # add your project URL + anon key
npm run dev
```

The anon key is meant to be public, it ships in the bundle. It is safe
because every table has RLS and no policy in `03_policies.sql` grants anything
beyond "this row is mine" or "I am in this group". (v1's `using (true)` meant
anyone holding that key could read every group's data.)

### 3. Vercel

Connect the repo. `vercel.json` already sets the build command, the output
directory and the SPA rewrite, so the only manual step is environment
variables:

**Project settings → Environment variables**

| Key | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://YOUR-PROJECT.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | your anon or publishable key |

Deploy, then add the resulting URL to Supabase's redirect list. Vite inlines
`VITE_*` at build time, so changing either variable needs a fresh deploy, not
just a restart.

The `VITE_` prefix is a publishing instruction, not a naming convention:
anything carrying it ends up in the browser bundle. That is correct for these
two and for `VITE_VAPID_PUBLIC_KEY`, and it is why `PLAID_CLIENT_ID`,
`PLAID_SECRET`, `PLAID_ENV` and every Stripe secret deliberately do not have
it.

Via CLI instead:

```bash
npm i -g vercel
vercel link
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel --prod
```

### 4. The scheduled job

```bash
supabase functions deploy notify --no-verify-jwt
supabase secrets set RESEND_API_KEY=... MAIL_FROM="Friends <hi@yourdomain>"
```

Then edit `04_schedule.sql`, replace `YOUR-PROJECT` and
`YOUR-SERVICE-ROLE-KEY`, and run it.

Without `RESEND_API_KEY` the function logs what it would have sent instead of
sending, which is useful while testing.

## Why there is a scheduled job

The brief asked for no server. Almost everything honours that, but a static
bundle only executes when someone opens it, and the person the app most needs
to reach is the one who has stopped opening it. Detecting silence and sending
the two allowed emails has to happen on its own.

`pg_cron` plus one Edge Function is the smallest thing that works, and neither
is a server you maintain. The app degrades gracefully without it: the client
calls `tick()` on load, so cycles keep advancing and nudges still appear as
long as *somebody* opens the app. Only the emails genuinely require the
schedule.

## How it works

**Cycles.** Each group has one check-in window. `create_group()` opens a new
group on a DAILY rhythm (`cadence_days = 1`, midnight to midnight); the column
default in `01_schema.sql` is still the original weekly 7 and applies only to a
direct insert, which nothing does. `cycles` rows are generated ahead by
`ensure_cycles()`;
`tick()` opens and closes them and raises nudges. Materialising periods as rows
is what makes "missed two in a row" and "11 of the last 14" ordinary SQL
instead of date arithmetic spread through the client.

**Check-in.** One screen: a counter per recurring goal, done/not-yet for
one-offs, optional evidence, one line for next cycle. Writes to localStorage
first and syncs second, so a dead connection cannot lose it. Replay is safe. `submit_checkin()` upserts on `(cycle_id, user_id)`.

**The reveal.** While the window is open the board shows who has checked in,
not what they said. Everything opens at once when the window closes, or early
if everyone is in.

**Silence.** Two consecutive missed cycles raises a nudge the group can see and
claim. Rotation assigns it only if nobody volunteers within 24 hours. The quiet
person gets one email and a one-tap re-entry that parks their old goals rather
than confronting them with a backlog.

## Things worth knowing

- **Group size is not capped.** `join_group()` counts the existing members only
  to hand the newcomer a `nudge_order`, and lets anybody with the code in. Two
  to six is the size the product is designed around, not a rule the database
  enforces. At size 2 the nudge rotation has exactly one candidate, which is
  handled but worth remembering.
- `member_cycle_status` is a `security_invoker` view. Without that flag it
  would run as its owner and leak every group's data, do not drop it when
  editing.
- Changing a group's check-in day affects future cycles only. This is
  deliberate: history should not move.
