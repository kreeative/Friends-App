-- 83_bb_focus.sql
--
-- Hakkilo: the study time. One row per stretch of focus, from the Pomodoro
-- timer, a study session or a mock exam (src/bb/focus.js): when it began
-- and how many seconds it lasted. "Comme ca l'app calcule au total combien
-- de temps tu passes" (Kee).
--
-- The rule of 80 holds: every row is the student's own (user_id =
-- auth.uid()), nobody else reads it, and it goes with the account.
--
-- A row is known by its start: the same block seen ending by two tabs, or
-- sent again after a network failure, is one row (the app inserts with
-- on conflict do nothing).
--
-- bb_focus_totals(tz) adds them up for today, this week (from Monday) and
-- in all, in the student's own time zone, so a long history is never read
-- row by row in the browser.
--
-- Safe to run twice. Plain ASCII on purpose (it travels through a clipboard).

create table if not exists public.bb_focus (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  seconds int not null check (seconds between 1 and 14400),
  source text not null default 'timer' check (source in ('timer','session','exam')),
  created_at timestamptz not null default now(),
  primary key (user_id, started_at)
);

alter table public.bb_focus enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'bb_focus' and policyname = 'bb_focus_own') then
    create policy bb_focus_own on public.bb_focus for all to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

revoke all on public.bb_focus from anon;

create or replace function public.bb_focus_totals(tz text default 'UTC')
returns table (today int, week int, total int)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce(sum(seconds) filter (where (started_at at time zone tz)::date = (now() at time zone tz)::date), 0)::int,
    coalesce(sum(seconds) filter (where (started_at at time zone tz)::date >= date_trunc('week', now() at time zone tz)::date), 0)::int,
    coalesce(sum(seconds), 0)::int
  from public.bb_focus
  where user_id = auth.uid();
$$;

revoke all on function public.bb_focus_totals(text) from public;
revoke all on function public.bb_focus_totals(text) from anon;
grant execute on function public.bb_focus_totals(text) to authenticated;

-- PostgREST learns the table and the function now, not at its next restart.
notify pgrst, 'reload schema';
