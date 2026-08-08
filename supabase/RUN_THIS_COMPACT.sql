-- Rich & Friends: everything outstanding, one paste. Safe to run twice.
-- Assumes 01_schema, 02_functions and 03_policies have already been run.

create table if not exists books (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  title       text not null,
  subtitle    text,
  description text,
  cover_url   text,
  price_cents int  not null check (price_cents >= 0),
  currency    text not null default 'CAD',
  word_count  int,
  published   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists chapters (
  id         uuid primary key default gen_random_uuid(),
  book_id    uuid not null references books(id) on delete cascade,
  idx        int  not null,
  title      text not null,
  body       text not null,          -- markdown
  word_count int,
  is_preview boolean not null default false,
  unique (book_id, idx)
);

-- A `books` or `chapters` table may already exist with a different shape, in
-- which case CREATE TABLE IF NOT EXISTS above silently did nothing and left it
-- as it was. Add anything missing rather than assuming this file owns it.
-- Columns are added nullable: an existing row cannot be forced to satisfy a
-- NOT NULL that was never there.
alter table books add column if not exists slug        text;
alter table books add column if not exists title       text;
alter table books add column if not exists subtitle    text;
alter table books add column if not exists description text;
alter table books add column if not exists cover_url   text;
alter table books add column if not exists price_cents int;
alter table books add column if not exists currency    text default 'CAD';
alter table books add column if not exists word_count  int;
alter table books add column if not exists published   boolean default false;
alter table books add column if not exists created_at  timestamptz default now();
alter table books add column if not exists stripe_ref  text;

create unique index if not exists books_slug_key on books(slug);

alter table chapters add column if not exists book_id    uuid references books(id) on delete cascade;
alter table chapters add column if not exists idx        int;
alter table chapters add column if not exists title      text;
alter table chapters add column if not exists body       text;
alter table chapters add column if not exists word_count int;
alter table chapters add column if not exists is_preview boolean default false;

create unique index if not exists chapters_book_idx_key on chapters(book_id, idx);

create index if not exists chapters_book_idx on chapters(book_id, idx);

create table if not exists entitlements (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles(id) on delete cascade,
  book_id           uuid not null references books(id) on delete cascade,
  stripe_session_id text unique,
  amount_cents      int,
  purchased_at      timestamptz not null default now(),
  unique (user_id, book_id)
);

create index if not exists entitlements_user_idx on entitlements(user_id);

create table if not exists reading_progress (
  user_id      uuid not null references profiles(id) on delete cascade,
  book_id      uuid not null references books(id) on delete cascade,
  chapter_id   uuid references chapters(id) on delete set null,
  scroll_pct   numeric(5,2) not null default 0 check (scroll_pct between 0 and 100),
  updated_at   timestamptz not null default now(),
  primary key (user_id, book_id)
);

create table if not exists highlights (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  book_id     uuid not null references books(id) on delete cascade,
  chapter_id  uuid not null references chapters(id) on delete cascade,
  quoted_text text not null check (length(quoted_text) between 1 and 1200),
  note        text check (length(note) <= 1000),
  created_at  timestamptz not null default now()
);

create index if not exists highlights_user_idx on highlights(user_id, created_at desc);

create table if not exists reading_shares (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  group_id   uuid not null references groups(id) on delete cascade,
  book_id    uuid not null references books(id) on delete cascade,
  kind       text not null check (kind in ('started', 'highlight')),
  highlight_id uuid references highlights(id) on delete cascade,
  message    text check (length(message) <= 500),
  shared_at  timestamptz not null default now(),
  constraint share_shape check (
    (kind = 'highlight' and highlight_id is not null) or
    (kind = 'started'   and highlight_id is null)
  )
);

create index if not exists reading_shares_group_idx on reading_shares(group_id, shared_at desc);

create or replace function owns_book(b uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from entitlements where book_id = b and user_id = auth.uid()
  );
$$;

alter table books            enable row level security;
alter table chapters         enable row level security;
alter table entitlements     enable row level security;
alter table reading_progress enable row level security;
alter table highlights       enable row level security;
alter table reading_shares   enable row level security;

drop policy if exists books_select on books;
create policy books_select on books for select to authenticated
  using (published = true);

drop policy if exists chapters_select on chapters;
create policy chapters_select on chapters for select to authenticated
  using (
    exists (select 1 from books b where b.id = book_id and b.published)
    and (is_preview = true or owns_book(book_id))
  );

drop policy if exists entitlements_select on entitlements;
create policy entitlements_select on entitlements for select to authenticated
  using (user_id = auth.uid());

drop policy if exists progress_all on reading_progress;
create policy progress_all on reading_progress for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and owns_book(book_id));

drop policy if exists highlights_all on highlights;
create policy highlights_all on highlights for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and owns_book(book_id));

drop policy if exists shares_select on reading_shares;
create policy shares_select on reading_shares for select to authenticated
  using (is_member(group_id));

drop policy if exists shares_write on reading_shares;
create policy shares_write on reading_shares for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and is_member(group_id)
    and owns_book(book_id)
  );

revoke execute on function owns_book(uuid) from public;
grant execute on function owns_book(uuid) to authenticated;

create or replace function _placeholder_body(chapter_title text, paras int)
returns text language sql immutable as $$
  select '## ' || chapter_title || E'\n\n' || string_agg(
    'PLACEHOLDER. This paragraph stands in for the finished manuscript so the '
    || 'reader can be tested against a chapter of realistic length. The final '
    || 'text will open on a situation you recognise, set out what the research '
    || 'actually found, state plainly where the evidence is thin or failed to '
    || 'replicate, and end with one specific thing to do. Named researchers, '
    || 'no hype, no manufactured urgency.',
    E'\n\n')
  from generate_series(1, paras);
$$;

insert into books (slug, title, subtitle, description, price_cents, currency, published) values
 ('story-you-tell',
  'The Story You Tell About Ability',
  'Mindset, honestly',
  'What you believe about ability changes what you do after failure — the only moment that matters. Growth mindset has been oversold; this is where it actually works.',
  1200, 'CAD', true),
 ('evidence-of-yourself',
  'Evidence of Yourself',
  'Confidence as a byproduct, not a feeling',
  'Confidence is not manufactured internally and then acted on. It is the residue of accumulated evidence that you can handle things. Most advice inverts this and fails.',
  1200, 'CAD', true),
 ('design-beats-discipline',
  'Design Beats Discipline',
  'Why willpower is not the variable',
  'People who look disciplined are mostly not resisting more. They have arranged their lives so there is less to resist.',
  1200, 'CAD', true)
on conflict (slug) do nothing;

with outline(book_slug, idx, title) as (values
  ('story-you-tell', 1, 'The moment after failure'),
  ('story-you-tell', 2, 'Fixed and growth, and what the replications actually showed'),
  ('story-you-tell', 3, 'False growth mindset'),
  ('story-you-tell', 4, 'Why you think you failed'),
  ('story-you-tell', 5, 'Learned helplessness and its reverse'),
  ('story-you-tell', 6, 'Stress as a signal, not a threat'),
  ('story-you-tell', 7, 'Reappraisal as a trainable skill'),
  ('story-you-tell', 8, 'Practice, and the ceiling on practice'),
  ('story-you-tell', 9, 'What to do Monday'),

  ('evidence-of-yourself', 1, 'Confidence follows action'),
  ('evidence-of-yourself', 2, 'Bandura''s four sources'),
  ('evidence-of-yourself', 3, 'What doesn''t work, and why it''s still everywhere'),
  ('evidence-of-yourself', 4, 'Self-esteem is a trap; self-compassion isn''t'),
  ('evidence-of-yourself', 5, 'Nobody is watching as closely as you think'),
  ('evidence-of-yourself', 6, 'Acting before feeling ready'),
  ('evidence-of-yourself', 7, 'The impostor experience'),
  ('evidence-of-yourself', 8, 'Building an evidence file'),
  ('evidence-of-yourself', 9, 'Confidence under actual pressure'),

  ('design-beats-discipline', 1, 'The fuel tank that wasn''t'),
  ('design-beats-discipline', 2, 'What the disciplined actually do'),
  ('design-beats-discipline', 3, 'Habits are context, not character'),
  ('design-beats-discipline', 4, 'If-then'),
  ('design-beats-discipline', 5, 'Friction is the lever'),
  ('design-beats-discipline', 6, 'Bundling and precommitment'),
  ('design-beats-discipline', 7, 'Sixty-six days, give or take a lot'),
  ('design-beats-discipline', 8, 'The lapse is not the problem'),
  ('design-beats-discipline', 9, 'Identity and consistency'),
  ('design-beats-discipline', 10, 'Building your own system')
)
insert into chapters (book_id, idx, title, body, word_count, is_preview)
select b.id, o.idx, o.title, _placeholder_body(o.title, 48), 2900, (o.idx = 1)
from outline o
join books b on b.slug = o.book_slug
on conflict (book_id, idx) do nothing;

drop function _placeholder_body(text, int);

select slug, title, price_cents, published from books order by created_at;

alter table goals alter column group_id drop not null;

alter table goals drop constraint if exists goal_solo_is_personal;
alter table goals add constraint goal_solo_is_personal check (
  group_id is not null
  or (kind = 'personal' and owner_id is not null)
);

alter table goals add column if not exists remind boolean not null default true;

drop policy if exists goals_select on goals;
create policy goals_select on goals for select to authenticated
  using (
    (group_id is null and owner_id = auth.uid())
    or (group_id is not null and is_member(group_id))
  );

drop policy if exists goals_insert on goals;
create policy goals_insert on goals for insert to authenticated
  with check (
    (
      group_id is null
      and kind = 'personal'
      and owner_id = auth.uid()
    )
    or (
      group_id is not null
      and is_member(group_id)
      and (
        (kind = 'personal' and owner_id = auth.uid())
        or (kind = 'group' and owner_id is null)
      )
    )
  );

drop policy if exists goals_update on goals;
create policy goals_update on goals for update to authenticated
  using (
    (group_id is null and owner_id = auth.uid())
    or (
      group_id is not null
      and is_member(group_id)
      and (owner_id = auth.uid() or (kind = 'group' and owner_id is null))
    )
  )
  with check (
    (group_id is null and kind = 'personal' and owner_id = auth.uid())
    or (
      group_id is not null
      and is_member(group_id)
      and (owner_id = auth.uid() or (kind = 'group' and owner_id is null))
    )
  );

drop policy if exists goals_delete on goals;
create policy goals_delete on goals for delete to authenticated
  using (
    owner_id = auth.uid()
    or (group_id is not null and is_group_admin(group_id))
  );

create or replace function leave_group(p_group uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me       uuid := auth.uid();
  v_left     int;
  v_admins   int;
begin
  if v_me is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  if not exists (select 1 from group_members where group_id = p_group and user_id = v_me) then
    raise exception 'not a member of this group' using errcode = '42501';
  end if;

  update goals
     set group_id = null
   where group_id = p_group
     and owner_id = v_me
     and kind = 'personal';

  delete from group_members where group_id = p_group and user_id = v_me;

  select count(*) into v_left from group_members where group_id = p_group;

  if v_left = 0 then
    delete from groups where id = p_group;
    return;
  end if;

  select count(*) into v_admins
    from group_members where group_id = p_group and role = 'admin';

  if v_admins = 0 then
    update group_members
       set role = 'admin'
     where group_id = p_group
       and user_id = (
         select user_id from group_members
          where group_id = p_group
          order by joined_at, user_id
          limit 1
       );
  end if;
end;
$$;

revoke all on function leave_group(uuid) from public;
grant execute on function leave_group(uuid) to authenticated;

create or replace function delete_group(p_group uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  if not exists (
    select 1 from group_members
     where group_id = p_group and user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'only an admin can delete a group' using errcode = '42501';
  end if;

  update goals
     set group_id = null
   where group_id = p_group
     and kind = 'personal'
     and owner_id is not null;

  delete from groups where id = p_group;
end;
$$;

revoke all on function delete_group(uuid) from public;
grant execute on function delete_group(uuid) to authenticated;

alter table books add column if not exists stripe_ref text;

comment on column books.stripe_ref is
  'Stripe price_… or prod_… id. Null means charge price_cents/currency inline.';

update books set currency = 'CAD' where currency is distinct from 'CAD';

alter table books alter column currency set default 'CAD';

update books set stripe_ref = 'price_1U1qJjLZRMaGXv1mXtAa5jiF' where slug = 'design-beats-discipline';
update books set stripe_ref = 'price_1U1qVgLZRMaGXv1mipl2PNKa' where slug = 'evidence-of-yourself';
update books set stripe_ref = 'price_1U1qWTLZRMaGXv1mFvnYmfFs' where slug = 'story-you-tell';

create or replace view chapter_index as
  select c.id,
         c.book_id,
         c.idx,
         c.title,
         c.is_preview,
         c.word_count
    from chapters c
    join books b on b.id = c.book_id
   where b.published;

alter view chapter_index set (security_invoker = off);

grant select on chapter_index to authenticated, anon;

create table if not exists daily_mood (
  user_id    uuid not null references profiles(id) on delete cascade,
  day        date not null default current_date,
  mood       text not null,
  /**
   * Off by default, and that is the important line in this file.
   *
   * Sharing how you feel with four people who know you is a real thing to
   * offer and a worse thing to assume. Anyone who wants it can turn it on in
   * one tap; nobody has to discover after the fact that their bad Tuesday was
   * broadcast. Defaults are the only privacy setting most people ever use.
   */
  shared     boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

create index if not exists daily_mood_day_idx on daily_mood(day);

alter table daily_mood enable row level security;

drop policy if exists daily_mood_select on daily_mood;
create policy daily_mood_select on daily_mood for select to authenticated
  using (
    user_id = auth.uid()
    or (
      shared
      and day = current_date
      and exists (
        select 1
          from group_members mine
          join group_members theirs on theirs.group_id = mine.group_id
         where mine.user_id = auth.uid()
           and theirs.user_id = daily_mood.user_id
      )
    )
  );

drop policy if exists daily_mood_write on daily_mood;
create policy daily_mood_write on daily_mood for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists daily_mood_update on daily_mood;
create policy daily_mood_update on daily_mood for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists daily_mood_delete on daily_mood;
create policy daily_mood_delete on daily_mood for delete to authenticated
  using (user_id = auth.uid());

select b.slug,
       b.currency,
       b.stripe_ref,
       count(c.*)                            as chapters,
       count(*) filter (where c.is_preview)  as free
  from books b
  left join chapters c on c.book_id = b.id
 group by b.slug, b.currency, b.stripe_ref
 order by b.slug;

select 'leave_group exists'   as check, to_regprocedure('leave_group(uuid)')  is not null as ok
union all select 'delete_group exists',  to_regprocedure('delete_group(uuid)') is not null
union all select 'chapter_index exists', to_regclass('chapter_index')          is not null
union all select 'daily_mood exists',    to_regclass('daily_mood')             is not null;
