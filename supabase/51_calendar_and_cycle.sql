-- ============================================================================
-- The calendar: a timetable, and a cycle tracker.
--
-- Run after 50. Safe to re-run.
--
-- THE CYCLE TABLES ARE THE MOST SENSITIVE DATA IN THIS PRODUCT.
--
-- 19_budget.sql says that about money, and this is worse. Menstrual data says
-- whether somebody is pregnant, whether they are trying to be, whether they
-- have stopped, and roughly when. It has been subpoenaed. People have deleted
-- apps over it.
--
-- So the rule from the budget applies here with nothing softened. Every policy
-- on cycle_log and cycle_day is `user_id = auth.uid()`, with no group path, no
-- shared view, no reporting function and no aggregate. Nothing in this
-- application will ever let one member see another member's cycle, and that is
-- not a default to be relaxed later, it is the feature.
--
-- Concretely, the things a well-meaning future change might add and must not:
--   * a group calendar that overlays everybody's events
--   * a "who is having a rough week" signal on the board
--   * a mood or analytics query that joins cycle_day
--   * the service role reading these tables to send anything to anyone else
--
-- The reminder in section 5 is the one exception that touches a cycle date,
-- and it is addressed to the person themselves and to nobody else.
--
-- WHY THE TIMETABLE AND THE CYCLE SHARE A MIGRATION AND NOT A TABLE.
--
-- They are drawn on the same grid and that is the whole of what they have in
-- common. A class has a start and an end and repeats on Tuesdays; a period is
-- a date somebody records afterwards and a prediction the app derives. Putting
-- both in one events table would mean one set of policies over data with two
-- completely different sensitivities, and the looser requirement always wins
-- that argument eventually.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The timetable.
--
-- WHY NOT AN RRULE STRING.
--
-- iCalendar recurrence is a small language, and storing one means writing an
-- expander for it, and then the database cannot answer "what is on this week"
-- without running that expander in the client over every row that has ever
-- existed. What people actually enter for a term timetable is "Tuesdays and
-- Thursdays, 10:00 to 12:00, until December". Two integers, an array of
-- weekdays and an end date cover that, and they are queryable.
--
-- Minutes from midnight rather than a time type, because the grid positions a
-- block by arithmetic and every read would otherwise start by parsing a clock
-- back into a number. It also makes "ends after it starts" a plain check.
-- ---------------------------------------------------------------------------
create table if not exists calendar_event (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  title      text not null check (length(trim(title)) between 1 and 120),
  category   text not null default 'perso' check (category in ('cours','examen','etude','perso')),
  -- Where it is. A room number, a building, a video link.
  location   text check (location is null or length(location) <= 160),
  -- The first day it happens. A one-off happens only on this day.
  starts_on  date not null,
  -- Minutes from midnight. 600 is 10:00. An all-day thing leaves both null.
  start_min  int check (start_min is null or start_min between 0 and 1439),
  end_min    int check (end_min   is null or end_min   between 1 and 1440),
  /* Which days it repeats on, 0 = Sunday through 6 = Saturday, matching
     JavaScript's getDay() so the client never has to shift the numbering.
     Empty means it does not repeat. */
  weekdays   smallint[] not null default '{}',
  -- When the repetition stops. Null means it runs until deleted, which is what
  -- somebody entering a weekly habit expects; a term gets an end date.
  until_on   date,
  /* One of the palette's own tokens, not a hex value. A stored #FF6699 is the
     right colour on exactly one of this app's two themes, which is the same
     mistake the delete button comment in GoalCard warns about.

     The list is exactly what tailwind.config.js declares. The first draft of
     this constraint allowed 'blue', 'violet' and 'yellow', none of which is a
     token in this project: Tailwind builds each colour as var(--c-<name>), so
     those rows would have painted transparent. A screenshot did not reveal it;
     sampling the painted pixels did, at 1:1 against the tile behind. A check
     constraint that permits a value the client cannot render is a constraint
     that is not doing its job. */
  colour     text not null default 'accent' check (colour in ('accent','green','quiet','cat-1','cat-2','cat-3','cat-4')),
  created_at timestamptz not null default now(),

  -- A block that ends before it starts is not a block. Both null is an all-day
  -- entry, which is allowed; one null and one set is a half-filled form.
  constraint calendar_event_times check (
    (start_min is null and end_min is null) or
    (start_min is not null and end_min is not null and end_min > start_min)
  ),
  -- A repetition that ends before it begins would render nothing, forever,
  -- with no way to tell that from a bug.
  constraint calendar_event_until check (until_on is null or until_on >= starts_on),

  /* Weekdays have to be days. The expander drops anything outside 0 to 6 and
     then, finding no valid days left, treats the row as a one-off so the entry
     is still visible rather than silently vanishing. That is the right
     fallback and it is not a reason to accept the data: a row of {9} would
     draw once and never repeat, which is not what anybody asked for and looks
     like the recurrence feature being broken. */
  constraint calendar_event_weekdays check (
    weekdays <@ array[0,1,2,3,4,5,6]::smallint[] and array_length(weekdays, 1) is distinct from 0
  )
);

create index if not exists calendar_event_user_idx on calendar_event (user_id, starts_on);

alter table calendar_event enable row level security;

drop policy if exists calendar_event_select on calendar_event;
create policy calendar_event_select on calendar_event for select to authenticated
  using (user_id = auth.uid());

drop policy if exists calendar_event_insert on calendar_event;
create policy calendar_event_insert on calendar_event for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists calendar_event_update on calendar_event;
create policy calendar_event_update on calendar_event for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists calendar_event_delete on calendar_event;
create policy calendar_event_delete on calendar_event for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on calendar_event to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Recorded periods.
--
-- One row per period that actually happened. Predictions are NOT stored: they
-- are derived from these rows every time they are drawn, because a stored
-- prediction goes stale the moment a real date is entered and there is then no
-- way to tell a prediction from a fact. The app has to be able to tell those
-- apart, since one of them is worth showing a reminder about.
--
-- ended_on is nullable and usually null. Asking somebody to come back and
-- close the record is asking for a chore they will not do, and the length is
-- only needed for the prediction, which uses the gap between starts.
-- ---------------------------------------------------------------------------
create table if not exists cycle_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  started_on date not null,
  ended_on   date,
  created_at timestamptz not null default now(),
  -- The same day twice is a double tap, not two periods.
  unique (user_id, started_on),
  constraint cycle_log_order check (ended_on is null or ended_on >= started_on)
);

create index if not exists cycle_log_user_idx on cycle_log (user_id, started_on desc);

-- ---------------------------------------------------------------------------
-- 3. The daily log.
--
-- Hydration and how the day felt. Separate from cycle_log because it is a
-- different shape of thing: one row per day somebody logged, whether or not it
-- was during a period, and most days will have neither.
--
-- water is a count of glasses rather than millilitres. Nobody knows what their
-- glass holds, and a number that has to be estimated precisely is a number
-- that does not get entered.
-- ---------------------------------------------------------------------------
create table if not exists cycle_day (
  user_id  uuid not null references profiles(id) on delete cascade,
  on_day   date not null,
  water    smallint not null default 0 check (water between 0 and 30),
  -- Free text is deliberately absent. A symptoms list is a fixed vocabulary
  -- the client can translate; a notes field would be the single most sensitive
  -- column in the product and it is not needed to make this useful.
  symptoms text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, on_day)
);

-- ---------------------------------------------------------------------------
-- 4. The lockdown, stated once for both.
--
-- Identical to the budget's, for the same reason and with the same intent.
-- `revoke from anon` is belt and braces: RLS already refuses an anonymous
-- caller, and a table whose grant list does not mention anon cannot be reached
-- even if a policy is one day written carelessly.
-- ---------------------------------------------------------------------------
alter table cycle_log enable row level security;
alter table cycle_day enable row level security;

drop policy if exists cycle_log_all on cycle_log;
create policy cycle_log_all on cycle_log for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists cycle_day_all on cycle_day;
create policy cycle_day_all on cycle_day for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on cycle_log to authenticated;
grant select, insert, update, delete on cycle_day to authenticated;
revoke all on cycle_log from anon;
revoke all on cycle_day from anon;

-- ---------------------------------------------------------------------------
-- 5. What to be told about, and how far ahead.
--
-- One row per person, created on demand. Absent means the defaults below,
-- which is why every read has to cope with no row rather than assuming one.
--
-- cycle_remind_days is the only setting here with a real range: two or three
-- days is what the request asked for, and the cap at seven exists because a
-- reminder further out than that is about a week rather than a day and stops
-- being actionable.
-- ---------------------------------------------------------------------------
create table if not exists notification_preference (
  user_id           uuid primary key references profiles(id) on delete cascade,
  -- The group goal email from migration 50. In-app rows are not affected: this
  -- turns off the mail, not the notification.
  group_goal_email  boolean not null default true,
  -- The cycle reminder. Off by default, and deliberately so: this is the one
  -- feature in the product that must never surprise somebody by existing.
  cycle_remind      boolean not null default false,
  cycle_remind_days smallint not null default 2 check (cycle_remind_days between 1 and 7),
  /**
   * The average the person stated during setup, if they did.
   *
   * It is not a notification preference and it is here anyway, because the
   * alternative is a fourth table holding one integer per user. The range
   * matches MIN_CYCLE and MAX_CYCLE in src/lib/cycle.js, and estimate() stops
   * using it once there are three measured gaps: at that point the
   * measurements are better than the recollection.
   */
  stated_cycle      smallint check (stated_cycle is null or stated_cycle between 21 and 45),
  updated_at        timestamptz not null default now()
);

alter table notification_preference enable row level security;

drop policy if exists notification_preference_all on notification_preference;
create policy notification_preference_all on notification_preference for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on notification_preference to authenticated;
revoke all on notification_preference from anon;

notify pgrst, 'reload schema';

-- Check:
--   select count(*) from calendar_event;
--   -- and that the cycle tables refuse a foreign read, as a signed-in user:
--   select count(*) from cycle_log;   -- only ever your own
--
--   -- the constraint that catches a half-filled time:
--   insert into calendar_event (user_id, title, starts_on, start_min)
--   values (auth.uid(), 'x', current_date, 600);
--   -- must fail on calendar_event_times
