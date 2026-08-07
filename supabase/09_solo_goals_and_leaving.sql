-- ============================================================================
-- Goals without a group, and a way out of one.
--
-- Run after 01/02/03. Safe to re-run.
--
-- Two changes, both about the same omission: the app assumed a group was the
-- only place anything could live. You could not keep a goal of your own
-- without joining people, and once you had joined there was no exit that was
-- not signing out of the product entirely.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Goals may be solo.
--
-- group_id becomes nullable. A goal with no group is yours alone: nobody else
-- can read it, it does not appear on any board, and it is not part of anyone's
-- cycle. It is still a goal — same fields, same check-in semantics if you
-- later attach it to a group.
--
-- The new constraint is the thing that keeps this honest: without a group
-- there is nobody for a 'group' goal to belong to, so a goal with no group
-- must be personal and must have an owner. Otherwise it would be a row no
-- policy could ever match, which is the quiet way to lose data.
-- ---------------------------------------------------------------------------
alter table goals alter column group_id drop not null;

alter table goals drop constraint if exists goal_solo_is_personal;
alter table goals add constraint goal_solo_is_personal check (
  group_id is not null
  or (kind = 'personal' and owner_id is not null)
);

-- Opt out of the reminder email for one specific goal. Defaults to on, since
-- the digest is capped at one message per cycle either way and the whole point
-- of writing a trigger down is being reminded of it.
alter table goals add column if not exists remind boolean not null default true;

-- ---------------------------------------------------------------------------
-- 2. Policies.
--
-- Every one of these gains the same clause: a row with no group is visible to,
-- and writable by, exactly its owner. Group behaviour is unchanged.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 3. Leaving.
--
-- A function rather than a delete policy on group_members, because leaving is
-- not one row's worth of work. Three things have to be decided in one place,
-- atomically, or a group can be left in a state nobody can administer:
--
--   your goals    the personal ones come with you, unattached, rather than
--                 being deleted. Someone who leaves a group has not stopped
--                 wanting to run three times a week, and silently binning
--                 their history is the kind of thing people do not forgive.
--   the last admin  promoted from whoever has been there longest, so a group
--                 can never end up with members and no administrator.
--   the last member  takes the group with them. An empty group is not a group,
--                 and leaving it behind means an invite code that still works
--                 and lets a stranger walk into an empty room.
-- ---------------------------------------------------------------------------
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

  -- Personal goals survive the exit, detached from the group. Group goals do
  -- not: they belong to the people still in it.
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

-- ---------------------------------------------------------------------------
-- 4. Deleting.
--
-- Admins only, and it takes the cycles, check-ins and group goals with it via
-- the existing cascades. Personal goals are detached first for the same reason
-- as above — deleting a group is a decision about a group, not about what four
-- other people were trying to do with their year.
--
-- There is deliberately no soft delete. A group that appears in your list but
-- does nothing is worse than one that is gone.
-- ---------------------------------------------------------------------------
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

-- Sanity:
--   select group_id, kind, owner_id, commitment from goals where group_id is null;
--   select proname from pg_proc where proname in ('leave_group','delete_group');
