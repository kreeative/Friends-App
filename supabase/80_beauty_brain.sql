-- 80_beauty_brain.sql
--
-- Beauty & Brain: the study platform made by the Rich & Friends team.
-- Same accounts (auth.users), separate data: every table is prefixed bb_.
--
-- Who reads what:
--   * each student reads and writes only her own rows (user_id = auth.uid());
--   * no group, no other student and no owner reads materials, items,
--     answers or mistakes;
--   * bb_usage and bb_subscriptions are written by the server only (service
--     role); a student can read her own rows to see her limits and her plan.
--
-- Raw files live in the private bucket bb-materials, under <user_id>/...,
-- readable and writable by their owner only.
--
-- Safe to run twice: create ... if not exists, and policies created only when
-- missing. Plain ASCII on purpose (it travels through a clipboard).

create extension if not exists pgcrypto;

-- The study profile ---------------------------------------------------------

create table if not exists public.bb_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  first_name text check (first_name is null or char_length(first_name) <= 60),
  school text check (school is null or char_length(school) <= 160),
  country text check (country is null or char_length(country) <= 60),
  level text check (level is null or level in ('high_school','cegep','uni_1','uni_2','uni_3','uni_4','masters','phd','pro')),
  program text check (program is null or char_length(program) <= 160),
  language text check (language is null or language in ('fr','en','both')),
  term_start date,
  term_end date,
  weekly_hours int check (weekly_hours is null or weekly_hours between 1 and 80),
  goal text check (goal is null or goal in ('pass','b','a','scholarship')),
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Courses and their material ------------------------------------------------

create table if not exists public.bb_courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  code text check (code is null or char_length(code) <= 40),
  professor text check (professor is null or char_length(professor) <= 120),
  language text check (language is null or language in ('fr','en')),
  exam_at timestamptz,
  exam_format jsonb not null default '{}'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists bb_courses_user on public.bb_courses (user_id);

create table if not exists public.bb_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid not null references public.bb_courses(id) on delete cascade,
  kind text not null default 'slides' check (kind in ('slides','guide','exam','transcript','notes','photo')),
  file_name text not null check (char_length(file_name) between 1 and 200),
  mime text,
  size_bytes bigint,
  storage_path text,
  pasted_text text check (pasted_text is null or char_length(pasted_text) <= 400000),
  status text not null default 'uploaded' check (status in ('uploaded','reading','ready','failed')),
  error text,
  pages int,
  created_at timestamptz not null default now(),
  reading_at timestamptz,
  processed_at timestamptz
);
alter table public.bb_materials add column if not exists reading_at timestamptz;
create index if not exists bb_materials_course on public.bb_materials (course_id);

create table if not exists public.bb_chapters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid not null references public.bb_courses(id) on delete cascade,
  material_id uuid references public.bb_materials(id) on delete set null,
  position int not null default 0,
  title text not null check (char_length(title) between 1 and 200),
  summary text,
  items_ready boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists bb_chapters_course on public.bb_chapters (course_id);

-- An anchor is where something was said: a slide, a page, a timestamp, a
-- photo, with the words quoted. Everything the app teaches points at one.
create table if not exists public.bb_anchors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid not null references public.bb_courses(id) on delete cascade,
  material_id uuid references public.bb_materials(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  excerpt text not null check (char_length(excerpt) between 1 and 2000),
  hash text,
  created_at timestamptz not null default now()
);
create index if not exists bb_anchors_course on public.bb_anchors (course_id);

create table if not exists public.bb_concepts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid not null references public.bb_courses(id) on delete cascade,
  chapter_id uuid references public.bb_chapters(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  definition text,
  definition_anchor uuid references public.bb_anchors(id) on delete set null,
  kind text not null default 'definition' check (kind in ('definition','process','list','formula','comparison','example','other')),
  anchor_ids uuid[] not null default '{}',
  weight int not null default 1 check (weight between 1 and 3),
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists bb_concepts_course on public.bb_concepts (course_id);
create index if not exists bb_concepts_chapter on public.bb_concepts (chapter_id);

-- Easily confused pairs, and the one sentence that separates them.
create table if not exists public.bb_twins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid not null references public.bb_courses(id) on delete cascade,
  a_concept uuid not null references public.bb_concepts(id) on delete cascade,
  b_concept uuid not null references public.bb_concepts(id) on delete cascade,
  separator text not null,
  anchor_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists bb_twins_course on public.bb_twins (course_id);

-- What the professor said will be on the exam, with the quote.
create table if not exists public.bb_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid not null references public.bb_courses(id) on delete cascade,
  concept_id uuid references public.bb_concepts(id) on delete cascade,
  quote text not null,
  anchor_id uuid references public.bb_anchors(id) on delete set null,
  strength int not null default 1 check (strength between 1 and 3),
  created_at timestamptz not null default now()
);
create index if not exists bb_signals_course on public.bb_signals (course_id);

create table if not exists public.bb_blueprints (
  course_id uuid primary key references public.bb_courses(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  confirmed_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Questions ----------------------------------------------------------------

create table if not exists public.bb_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid not null references public.bb_courses(id) on delete cascade,
  chapter_id uuid references public.bb_chapters(id) on delete cascade,
  concept_id uuid references public.bb_concepts(id) on delete cascade,
  type text not null check (type in ('mcq','tf','flash','cloze','short')),
  bloom int not null default 1 check (bloom between 1 and 6),
  stem text not null,
  options jsonb not null default '[]'::jsonb,
  answer jsonb not null default '{}'::jsonb,
  explanation text,
  anchor_ids uuid[] not null default '{}',
  outside boolean not null default false,
  quality text not null default 'pass' check (quality in ('pass','revised','reject','quarantine')),
  revision_note text,
  source text not null default 'ai' check (source in ('ai','concept')),
  created_at timestamptz not null default now()
);
create index if not exists bb_items_course on public.bb_items (course_id);
create index if not exists bb_items_concept on public.bb_items (concept_id);

-- The student's progress -----------------------------------------------------

create table if not exists public.bb_schedule (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id uuid not null references public.bb_items(id) on delete cascade,
  course_id uuid not null references public.bb_courses(id) on delete cascade,
  stability double precision not null default 0,
  difficulty double precision not null default 0,
  due timestamptz not null default now(),
  reps int not null default 0,
  lapses int not null default 0,
  state text not null default 'new' check (state in ('new','learning','review','relearning')),
  last_review timestamptz,
  primary key (user_id, item_id)
);
create index if not exists bb_schedule_due on public.bb_schedule (user_id, course_id, due);

create table if not exists public.bb_reviews (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id uuid not null references public.bb_items(id) on delete cascade,
  course_id uuid not null references public.bb_courses(id) on delete cascade,
  concept_id uuid,
  session_id uuid,
  rating int not null check (rating between 1 and 4),
  confidence text check (confidence is null or confidence in ('sure','unsure','guess')),
  correct boolean,
  bloom int,
  ms int,
  mode text,
  created_at timestamptz not null default now()
);
create index if not exists bb_reviews_user_course on public.bb_reviews (user_id, course_id, created_at);

create table if not exists public.bb_mistakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid not null references public.bb_courses(id) on delete cascade,
  item_id uuid not null references public.bb_items(id) on delete cascade,
  concept_id uuid,
  misconception text,
  confident boolean not null default false,
  right_streak int not null default 0,
  last_right_on date,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, item_id)
);

create table if not exists public.bb_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid not null references public.bb_courses(id) on delete cascade,
  minutes int,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  answered int not null default 0,
  correct int not null default 0
);

create table if not exists public.bb_coach_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid not null references public.bb_courses(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  mode text,
  created_at timestamptz not null default now()
);
create index if not exists bb_coach_course on public.bb_coach_messages (user_id, course_id, created_at);

-- Costs and the plan (written by the server only) -----------------------------

create table if not exists public.bb_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  route text not null,
  model text,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cache_read int not null default 0,
  cache_write int not null default 0,
  cost_usd numeric(10,5) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists bb_usage_user_day on public.bb_usage (user_id, created_at);

create table if not exists public.bb_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','plus_month','plus_semester','plus_year','owner')),
  status text not null default 'inactive',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  stripe_customer text,
  stripe_subscription text,
  updated_at timestamptz not null default now()
);

-- Row level security ----------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'bb_profiles','bb_courses','bb_materials','bb_chapters','bb_anchors','bb_concepts',
    'bb_twins','bb_signals','bb_blueprints','bb_items','bb_schedule','bb_reviews',
    'bb_mistakes','bb_sessions','bb_coach_messages','bb_usage','bb_subscriptions'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;

  -- Own rows, every operation.
  foreach t in array array[
    'bb_profiles','bb_courses','bb_materials','bb_chapters','bb_anchors','bb_concepts',
    'bb_twins','bb_signals','bb_blueprints','bb_items','bb_schedule','bb_reviews',
    'bb_mistakes','bb_sessions','bb_coach_messages'
  ] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_own') then
      execute format(
        'create policy %I on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
        t || '_own', t);
    end if;
  end loop;

  -- Read-only for the owner of the row; the server writes.
  foreach t in array array['bb_usage','bb_subscriptions'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_read_own') then
      execute format(
        'create policy %I on public.%I for select to authenticated using (user_id = auth.uid())',
        t || '_read_own', t);
    end if;
  end loop;
end $$;

revoke all on public.bb_usage, public.bb_subscriptions from anon;
revoke insert, update, delete on public.bb_usage, public.bb_subscriptions from authenticated;

-- The private bucket ------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('bb-materials', 'bb-materials', false, 26214400)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'bb_materials_own_read') then
    create policy bb_materials_own_read on storage.objects for select to authenticated
      using (bucket_id = 'bb-materials' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'bb_materials_own_insert') then
    create policy bb_materials_own_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'bb-materials' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'bb_materials_own_update') then
    create policy bb_materials_own_update on storage.objects for update to authenticated
      using (bucket_id = 'bb-materials' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'bb_materials_own_delete') then
    create policy bb_materials_own_delete on storage.objects for delete to authenticated
      using (bucket_id = 'bb-materials' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
end $$;

-- Nobody signed out reads or writes any of this. RLS already returns nothing
-- to anon (every policy is "to authenticated"); the grants go as well.
do $$
declare
  t text;
begin
  foreach t in array array[
    'bb_profiles','bb_courses','bb_materials','bb_chapters','bb_anchors','bb_concepts',
    'bb_twins','bb_signals','bb_blueprints','bb_items','bb_schedule','bb_reviews',
    'bb_mistakes','bb_sessions','bb_coach_messages','bb_usage','bb_subscriptions'
  ] loop
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
