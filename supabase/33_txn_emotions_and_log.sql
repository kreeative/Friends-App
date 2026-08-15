-- ============================================================================
-- How a spend felt, and what happened to it since.
--
-- Run after 32. Safe to re-run.
--
-- Two additions to budget_entry that answer two different questions nobody
-- could ask before:
--
--   emotions   why the money went, which is the only interesting question
--              anybody has when they cannot account for a month.
--   the log    what this row used to say, because until now an edit
--              overwrote its own evidence.
--
-- NOTE ON THE TABLE NAME. The request called this table `transactions`. In
-- this schema it has always been `budget_entry`, since migration 19, with an
-- index, four policies and a client that reads it by that name. Renaming it to
-- match a sentence would be a breaking change to everything that touches
-- money in exchange for nothing, so the name stays and this is the note that
-- says why, once, where somebody looking for `transactions` will find it.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The feelings.
--
-- text[] rather than a join table. The alternative is budget_entry_emotion
-- with two columns and a composite key, which is the correct normal form and
-- the wrong trade here: the values are a closed set of thirteen that the
-- application ships, nothing is ever queried by feeling across users, and the
-- only read is "the tags on this row", which an array answers without a join.
--
-- DEFAULT IS EMPTY, NOT 'neutral'. The form pre-selects neutral, and that is a
-- decision about a form. Writing it as a column default would put the word
-- "neutral" on every row created by anything that never asked, including rows
-- written before this migration if a backfill were added later, and a feeling
-- nobody expressed is not data, it is noise that looks like data.
--
-- The constraint is what keeps this honest. An array column with no check is
-- a text field that accepts anything, and the totals in src/lib/emotions.js
-- silently drop whatever they do not recognise, so a typo would vanish rather
-- than fail. Named values mean a bad write is refused at the door.
-- ---------------------------------------------------------------------------
alter table budget_entry add column if not exists emotions text[] not null default '{}';

alter table budget_entry drop constraint if exists budget_entry_emotions_check;
alter table budget_entry add constraint budget_entry_emotions_check check (
  emotions <@ array[
    'neutral', 'unsure', 'routine',
    'pleasure', 'calm', 'celebration', 'gift', 'selfcare',
    'impulse', 'stress', 'craving', 'tired', 'frustration'
  ]::text[]
  and array_length(emotions, 1) is distinct from 0
  and coalesce(array_length(emotions, 1), 0) <= 13
);

-- ---------------------------------------------------------------------------
-- 2. The history.
--
-- WHY entry_id HAS NO FOREIGN KEY.
--
-- Because the most important row this table will ever hold is the one written
-- when a transaction is deleted, and a foreign key with `on delete cascade`
-- would delete the entire history of a row at the exact moment that history
-- became the only remaining record of it. `on delete set null` would keep the
-- rows and lose which transaction they belonged to, which is the same loss
-- spread thinner. So it is a plain uuid: the log outlives what it describes,
-- which is the whole job of a log.
--
-- user_id DOES cascade, and that is not an inconsistency. Somebody closing
-- their account expects their financial history to go with them, and
-- delete_account() in migration 31 removes the profile row that everything
-- hangs from. An audit trail that survived the person it was about would be a
-- privacy problem wearing the word "audit".
-- ---------------------------------------------------------------------------
create table if not exists budget_entry_log (
  id         uuid primary key default gen_random_uuid(),
  entry_id   uuid not null,
  user_id    uuid not null references profiles(id) on delete cascade,
  action     text not null check (action in ('created', 'updated', 'deleted')),

  -- [{field, from, to}], one object per column that actually changed. jsonb
  -- rather than json because it is the type Postgres compares and indexes, and
  -- nothing here depends on key order.
  changes    jsonb not null default '[]'::jsonb,
  at         timestamptz not null default now()
);

-- The drawer's only query: this transaction's history, newest first.
create index if not exists budget_entry_log_entry_idx
  on budget_entry_log (entry_id, at desc);

alter table budget_entry_log enable row level security;

-- ---------------------------------------------------------------------------
-- 3. Read only, to everybody.
--
-- ONE POLICY, AND THE ABSENCE OF THE OTHER THREE IS THE FEATURE.
--
-- With RLS on and no insert, update or delete policy, nothing arriving through
-- the API can add to this table, change a row in it, or remove one. Not the
-- app, not a stolen anon key, not the person themselves. An audit trail the
-- audited party can edit is not an audit trail, and the usual instinct here,
-- an insert policy scoped to auth.uid(), would hand exactly that away.
--
-- The trigger below writes the rows, and it is `security definer` so that it
-- runs as the function's owner rather than the caller and is not itself
-- stopped by the absence of an insert policy.
-- ---------------------------------------------------------------------------
drop policy if exists budget_entry_log_select on budget_entry_log;
create policy budget_entry_log_select on budget_entry_log for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. The trigger.
--
-- WHY THE DATABASE AND NOT THE CLIENT.
--
-- A client forgets code paths. A client cannot see a row changed from the SQL
-- editor, by a future job, or by a second application. And a client that
-- writes its own audit trail can be asked not to: a log entry inserted by the
-- same session that made the change is worth exactly what the change is worth.
-- Here, every write to budget_entry produces a row, whoever made it and
-- whatever they were using.
--
-- `is distinct from` rather than <>, throughout. NULL <> NULL is NULL, not
-- true, so a column going from null to null would be recorded as a change and
-- a column going from a value to null would not be recorded at all. That is
-- the entire bug class this operator exists for, and every comparison below
-- crosses a nullable column.
-- ---------------------------------------------------------------------------
create or replace function log_budget_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  diff jsonb := '[]'::jsonb;
  who  uuid;
  what uuid;
  act  text;
begin
  if tg_op = 'DELETE' then
    who  := old.user_id;
    what := old.id;
    act  := 'deleted';
  elsif tg_op = 'INSERT' then
    who  := new.user_id;
    what := new.id;
    act  := 'created';
  else
    who  := new.user_id;
    what := new.id;
    act  := 'updated';

    /* Only the columns that moved. A diff listing every column on every edit
       is a diff nobody reads, and the drawer would say "category changed from
       food to food" under the one line somebody opened it for. */
    if new.amount_cents is distinct from old.amount_cents then
      diff := diff || jsonb_build_object('field', 'amount_cents', 'from', old.amount_cents, 'to', new.amount_cents);
    end if;
    if new.kind is distinct from old.kind then
      diff := diff || jsonb_build_object('field', 'kind', 'from', old.kind, 'to', new.kind);
    end if;
    if new.category is distinct from old.category then
      diff := diff || jsonb_build_object('field', 'category', 'from', old.category, 'to', new.category);
    end if;
    if new.note is distinct from old.note then
      diff := diff || jsonb_build_object('field', 'note', 'from', old.note, 'to', new.note);
    end if;
    if new.happened_on is distinct from old.happened_on then
      diff := diff || jsonb_build_object('field', 'happened_on', 'from', old.happened_on, 'to', new.happened_on);
    end if;
    if new.excluded is distinct from old.excluded then
      diff := diff || jsonb_build_object('field', 'excluded', 'from', old.excluded, 'to', new.excluded);
    end if;
    if new.emotions is distinct from old.emotions then
      diff := diff || jsonb_build_object('field', 'emotions', 'from', to_jsonb(old.emotions), 'to', to_jsonb(new.emotions));
    end if;

    /* An update that moved nothing this log records is not history. Supabase
       sends the whole row on every save, so re-saving a sheet without touching
       anything is an ordinary thing to do, and recording it would fill the
       drawer with entries that say a change happened and cannot say what. */
    if diff = '[]'::jsonb then
      return new;
    end if;
  end if;

  insert into budget_entry_log (entry_id, user_id, action, changes)
  values (what, who, act, diff);

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

/* AFTER, not BEFORE. On insert the id is only assigned once the row exists, so
   a BEFORE trigger would file the whole history of every new transaction
   against a null. AFTER also means a write refused by a check constraint or by
   RLS leaves no log entry claiming it happened. */
drop trigger if exists budget_entry_log_trg on budget_entry;
create trigger budget_entry_log_trg
  after insert or update or delete on budget_entry
  for each row execute function log_budget_entry();

notify pgrst, 'reload schema';

-- Check:
--   select emotions from budget_entry limit 5;
--   select action, changes, at from budget_entry_log order by at desc limit 10;
--   select relrowsecurity from pg_class where relname = 'budget_entry_log';   -- t
--   select count(*) from pg_policies where tablename = 'budget_entry_log';    -- 1
