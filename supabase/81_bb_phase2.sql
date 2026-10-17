-- 81_bb_phase2.sql
--
-- Beauty & Brain, phases 2 and 3 of the build prompt: the timed mock exam,
-- the case lab, the study plan written into the calendar, the chapter
-- visuals, variations of a mistake, a session ticking a Rich & Friends goal,
-- and study squads.
--
-- The rules of 80 hold: every row is the student's own (user_id =
-- auth.uid()); no group, no other student and no owner reads a score, an
-- answer, a case or a mistake. The one thing a squad sees is EFFORT
-- (minutes, sessions, streak), through bb_squad_effort(), and only for the
-- members who said yes in that group.
--
-- Safe to run twice. Plain ASCII on purpose (it travels through a clipboard).

-- The Rich & Friends goal a finished session ticks, if the student asked for it.
alter table public.bb_profiles add column if not exists rf_goal_id uuid references public.goals(id) on delete set null;

-- The hours the student usually studies, in minutes after midnight: where the
-- plan puts its blocks in the calendar.
alter table public.bb_profiles add column if not exists study_from int check (study_from is null or study_from between 0 and 1439);
alter table public.bb_profiles add column if not exists study_to int check (study_to is null or study_to between 1 and 1440);

-- A chapter that has no process, sequence, comparison or hierarchy to draw:
-- remembered, so the visuals are not asked for (and paid for) twice.
alter table public.bb_chapters add column if not exists visuals_none boolean not null default false;

-- A variation of an item that went into the mistake log: another scenario,
-- the same skill. Answering it counts for the original mistake.
alter table public.bb_items add column if not exists variant_of uuid references public.bb_items(id) on delete cascade;
create index if not exists bb_items_variant on public.bb_items (variant_of) where variant_of is not null;

-- Mock exams ---------------------------------------------------------------------

create table if not exists public.bb_exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid not null references public.bb_courses(id) on delete cascade,
  minutes int not null check (minutes between 5 and 600),
  item_ids uuid[] not null default '{}',
  answers jsonb not null default '{}'::jsonb,
  score int,
  total int,
  by_chapter jsonb,
  by_bloom jsonb,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create index if not exists bb_exams_course on public.bb_exams (user_id, course_id, started_at);

-- The case lab ---------------------------------------------------------------------

create table if not exists public.bb_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid not null references public.bb_courses(id) on delete cascade,
  chapter_ids uuid[] not null default '{}',
  title text not null check (char_length(title) between 1 and 200),
  body text not null check (char_length(body) between 1 and 20000),
  exhibits jsonb not null default '[]'::jsonb,
  questions jsonb not null default '[]'::jsonb,
  rubric jsonb not null default '[]'::jsonb,
  model_answer text,
  anchor_ids uuid[] not null default '{}',
  outside_note text,
  created_at timestamptz not null default now()
);
create index if not exists bb_cases_course on public.bb_cases (user_id, course_id, created_at);

create table if not exists public.bb_case_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  case_id uuid not null references public.bb_cases(id) on delete cascade,
  course_id uuid not null references public.bb_courses(id) on delete cascade,
  answer text not null check (char_length(answer) between 1 and 20000),
  grade jsonb,
  points numeric(6,2),
  out_of numeric(6,2),
  created_at timestamptz not null default now()
);
create index if not exists bb_case_attempts_case on public.bb_case_attempts (user_id, case_id, created_at);

-- The study plan, day by day, and the calendar entry each day wrote --------------

create table if not exists public.bb_plan_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid references public.bb_courses(id) on delete cascade,
  on_date date not null,
  kind text not null check (kind in ('study','mock','eve','rest')),
  minutes int check (minutes is null or minutes between 5 and 600),
  event_id uuid references public.calendar_event(id) on delete set null,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists bb_plan_days_user on public.bb_plan_days (user_id, on_date);

-- Chapter visuals (dual coding) ----------------------------------------------------

create table if not exists public.bb_visuals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid not null references public.bb_courses(id) on delete cascade,
  chapter_id uuid not null references public.bb_chapters(id) on delete cascade,
  kind text not null check (kind in ('steps','table','timeline','matrix','tree')),
  title text not null check (char_length(title) between 1 and 200),
  data jsonb not null,
  anchor_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists bb_visuals_chapter on public.bb_visuals (chapter_id);

-- Study squads: in each group, whether this member's study effort is shown ------

create table if not exists public.bb_squad_share (
  group_id uuid not null,
  user_id uuid not null default auth.uid(),
  shared boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (group_id, user_id),
  -- Leaving the group removes the answer.
  foreign key (group_id, user_id) references public.group_members (group_id, user_id) on delete cascade
);

-- Row level security -------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['bb_exams','bb_cases','bb_case_attempts','bb_plan_days','bb_visuals','bb_squad_share'] loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_own') then
      execute format(
        'create policy %I on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
        t || '_own', t);
    end if;
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- What a squad sees: effort, never scores --------------------------------------
--
-- For the members of the group who switched their study effort on in it:
-- the name the group already shows, minutes and sessions over the last seven
-- days, and the current streak of study days. Nothing about courses, answers,
-- marks or mistakes is read. Ranked by minutes, then streak: effort, never
-- grades.
--
-- Both ways or not at all: the caller must be a member of the group AND show
-- her own effort in it. Someone who shares nothing sees nothing.

create or replace function public.bb_squad_effort(p_group uuid)
returns table (user_id uuid, name text, minutes_week int, sessions_week int, streak int, me boolean)
language sql
stable
security definer
set search_path = public
as $$
  with allowed as (
    select 1
      from group_members me
      join bb_squad_share mine on mine.group_id = me.group_id and mine.user_id = me.user_id and mine.shared
     where me.group_id = p_group and me.user_id = auth.uid()
  ),
  members as (
    select gm.user_id,
           coalesce(nullif(trim(gm.alias), ''), nullif(trim(p.display_name), ''), '?') as name,
           coalesce(nullif(p.timezone, ''), 'UTC') as tz
      from group_members gm
      join profiles p on p.id = gm.user_id
      join bb_squad_share s on s.group_id = gm.group_id and s.user_id = gm.user_id and s.shared
     where gm.group_id = p_group
       and exists (select 1 from allowed)
  ),
  sessions as (
    select s.user_id,
           (s.started_at at time zone m.tz)::date as d,
           case
             when s.ended_at is null then least(30, ceil(s.answered / 2.0))::int
             else least(60, greatest(1, round(extract(epoch from (s.ended_at - s.started_at)) / 60.0)))::int
           end as mins
      from bb_sessions s
      join members m on m.user_id = s.user_id
     where s.answered > 0
       and s.started_at > now() - interval '120 days'
  ),
  week as (
    select s.user_id, sum(s.mins)::int as minutes_week, count(*)::int as sessions_week
      from sessions s
      join members m on m.user_id = s.user_id
     where s.d > (now() at time zone m.tz)::date - 7
     group by s.user_id
  ),
  days as (
    select distinct user_id, d from sessions
  ),
  islands as (
    select user_id, d, d - (row_number() over (partition by user_id order by d))::int as grp
      from days
  ),
  runs as (
    select user_id, max(d) as last_day, count(*)::int as len
      from islands
     group by user_id, grp
  ),
  streaks as (
    select r.user_id, max(r.len) as streak
      from runs r
      join members m on m.user_id = r.user_id
     where r.last_day >= (now() at time zone m.tz)::date - 1
     group by r.user_id
  )
  select m.user_id,
         m.name,
         coalesce(w.minutes_week, 0),
         coalesce(w.sessions_week, 0),
         coalesce(st.streak, 0),
         m.user_id = auth.uid()
    from members m
    left join week w on w.user_id = m.user_id
    left join streaks st on st.user_id = m.user_id
   order by coalesce(w.minutes_week, 0) desc, coalesce(st.streak, 0) desc, m.name;
$$;

revoke all on function public.bb_squad_effort(uuid) from public;
revoke all on function public.bb_squad_effort(uuid) from anon;
grant execute on function public.bb_squad_effort(uuid) to authenticated;

notify pgrst, 'reload schema';
