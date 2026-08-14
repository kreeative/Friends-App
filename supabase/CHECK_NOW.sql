-- ============================================================================
-- What does this database still need?
--
-- Paste the whole thing. One row per requirement, and the `status` column
-- says either RUN or ok. Nothing is changed by running it.
--
-- WHY THIS EXISTS.
--
-- "Which migrations have I run" is not a question this project can answer by
-- looking at the files, because the files are a list of what was written and
-- not a record of what was executed. Everything that has gone wrong on this
-- database has been that gap: a column added to 01_schema.sql after the
-- database was created from it, and a script that failed halfway and left
-- everything before the failure committed. Both are invisible until a screen
-- breaks, and both are one query away from being obvious.
--
-- It asks the catalogue rather than trusting a version table, so it is right
-- even about migrations that were run by hand, run twice, or half run.
-- ============================================================================
with needed(sort, feature, kind, obj, col, fix) as (values
  -- 12: how the day felt.
  (1,  'Daily mood',            'table',  'daily_mood',       null,          'supabase/12_daily_mood.sql'),

  -- 19 + 29: the money screen.
  (2,  'Budget',                'table',  'budget_plan',      null,          'supabase/19_budget.sql'),
  (3,  'Budget',                'table',  'budget_entry',     null,          'supabase/19_budget.sql'),
  (4,  'Transaction note',      'column', 'budget_entry',     'note',        'supabase/19_budget.sql'),
  (5,  'Leave out of budget',   'column', 'budget_entry',     'excluded',    'supabase/29_budget_excluded.sql'),

  -- 27: the journal, and the day recap that reads it.
  (6,  'Journal',               'table',  'journal_entries',  null,          'supabase/27_journal.sql'),
  (7,  'Journal passcode',      'table',  'journal_locks',    null,          'supabase/27_journal.sql'),

  -- 23 + 28: proof, and the recap that shows it.
  (8,  'Proof photo',           'column', 'checkin_items',    'photo_url',   'supabase/23_checkin_proofs.sql'),
  (9,  'Proof link',            'column', 'checkin_items',    'link_url',    'supabase/28_proof_kinds.sql'),
  (10, 'Proof kind on a goal',  'column', 'goals',            'proof_type',  'supabase/28_proof_kinds.sql'),
  (11, 'Proof gallery',         'view',   'group_proofs',     null,          'supabase/28_proof_kinds.sql'),

  -- The one that broke every check-in. See supabase/REPAIR.sql.
  (12, 'Check-in mood',         'column', 'checkins',         'mood',        'supabase/REPAIR.sql'),
  (13, 'Check-in mood, rolled up', 'column', 'member_cycle_status', 'mood',   'supabase/REPAIR.sql')
)
select
  feature,
  case
    when col is null then obj
    else obj || '.' || col
  end                                   as object,
  case when present then 'ok' else 'RUN' end as status,
  case when present then '' else fix end     as then_run
from (
  select
    n.*,
    case n.kind
      -- to_regclass covers tables and views alike and answers null rather
      -- than raising when the name is unknown, which is the whole point: a
      -- check that errors on the first missing object stops checking.
      when 'column' then exists (
        select 1
          from information_schema.columns c
         where c.table_schema = 'public'
           and c.table_name = n.obj
           and c.column_name = n.col
      )
      else to_regclass('public.' || n.obj) is not null
    end as present
  from needed n
) t
order by present, sort;
