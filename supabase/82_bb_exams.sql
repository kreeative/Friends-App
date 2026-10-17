-- 82_bb_exams.sql
--
-- Hakkilo: a course has its exams, the midterm (intra) and the final, not
-- one date. Each one: its date (or none yet), the chapters it covers, and
-- its own length. Read by src/lib/bb/exams.js.
--
--   exams = [{ "id", "kind": "midterm" | "final", "at": ISO date or null,
--              "chapters": [chapter id] or null, "since": true or false,
--              "format": { "count", "minutes" } }]
--
-- exam_at stays: it holds the next exam, for an app opened before this
-- version. The policies of bb_courses (migration 80) already keep every row
-- to its owner; a new column needs none of its own.
--
-- Safe to run twice. Plain ASCII on purpose (it travels through a clipboard).

alter table public.bb_courses add column if not exists exams jsonb not null default '[]'::jsonb;

alter table public.bb_courses drop constraint if exists bb_courses_exams_shape;
-- A CASE, not an AND: Postgres does not promise to test the type first, and
-- jsonb_array_length raises on anything but an array.
alter table public.bb_courses add constraint bb_courses_exams_shape
  check (case when jsonb_typeof(exams) = 'array' then jsonb_array_length(exams) <= 6 else false end);

-- PostgREST learns the new column now, not at its next restart.
notify pgrst, 'reload schema';
