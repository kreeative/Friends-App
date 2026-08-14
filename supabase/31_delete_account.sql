-- ============================================================================
-- Deleting your account, from inside the app.
--
-- Run after 30. Safe to re-run.
--
-- Apple's guideline 5.1.1(v) requires that an app which lets you create an
-- account lets you delete it, in the app, not by writing to somebody. That is
-- the occasion. It is the right thing regardless of any store: an account you
-- can open and cannot close is not really yours.
--
-- WHY THIS IS A FUNCTION AND NOT A DELETE FROM THE CLIENT.
--
-- The row that matters is in auth.users, which no client may touch. Everything
-- else follows from it: profiles.id references auth.users(id) on delete
-- cascade, and forty-seven tables reference profiles(id) the same way. Remove
-- the one row and the rest goes with it, in the database, in one transaction,
-- with no list here to fall out of date the next time a table is added.
--
-- THE ONE FOREIGN KEY THAT REFUSES.
--
--   groups.created_by uuid not null references profiles(id) on delete restrict
--
-- A naive delete fails outright for anybody who has ever created a group. That
-- restrict is not an obstacle to route around, it is a question being asked:
-- what happens to a group when the person who made it leaves?
--
-- Deleting the group would be the easy answer and the wrong one. One person
-- closing their account must not destroy four other people's history. So the
-- group is handed over: the longest-standing other member becomes the owner,
-- promoted to admin so they can actually run it. Only a group with nobody else
-- in it is deleted, and that is not really a group.
--
-- WHAT SURVIVES.
--
-- Nothing of the person. Their journal, their budget, their goals, their
-- check-ins and their proofs all cascade. Two columns are `set null` rather
-- than cascade, daily_role.claimed_by and assigned_to, so a day that was
-- claimed simply stops naming anybody. Group rows they wrote in still exist as
-- rows in other people's groups, but every path back to a person is gone.
-- ============================================================================

create or replace function delete_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  me   uuid := auth.uid();
  g    record;
  heir uuid;
begin
  if me is null then
    raise exception 'delete_account: not signed in';
  end if;

  /* Hand over, or wind up, every group this person created. Done first,
     because the restrict above blocks the delete until it is. */
  for g in select id from groups where created_by = me loop
    select gm.user_id
      into heir
      from group_members gm
     where gm.group_id = g.id
       and gm.user_id <> me
     /* An existing admin first, then whoever has been there longest. Somebody
        already trusted with the group is the least surprising owner for it. */
     order by (gm.role = 'admin') desc, gm.joined_at asc
     limit 1;

    if heir is null then
      delete from groups where id = g.id;
    else
      update groups set created_by = heir where id = g.id;
      /* 'creator' is not a value this column accepts: the creator is whoever
         groups.created_by names, and the role column only knows member and
         admin. The heir is made an admin so the promotion is real. */
      update group_members set role = 'admin'
       where group_id = g.id and user_id = heir;
    end if;
  end loop;

  /* The avatar, which lives in storage rather than in a table and so is
     reached by no cascade. Wrapped because a project that has never created
     the bucket has no rows to delete and should not fail here for it. */
  begin
    delete from storage.objects where bucket_id = 'avatars' and owner = me;
  exception
    when undefined_table or insufficient_privilege then
      null;
  end;

  /* And the row everything else hangs from. */
  delete from auth.users where id = me;
end;
$$;

/* Nobody signed out has an account to delete, and the function reads
   auth.uid() rather than taking an id, so it can only ever delete the caller.
   That is the whole of its security: there is no argument to pass somebody
   else's identifier in. */
revoke execute on function delete_account() from public, anon;
grant execute on function delete_account() to authenticated;

notify pgrst, 'reload schema';

-- Check (as yourself, from the SQL editor this returns null for auth.uid()):
--   select proname, prosecdef from pg_proc where proname = 'delete_account';
