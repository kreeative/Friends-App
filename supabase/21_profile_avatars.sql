-- ============================================================================
-- Profile photos.
--
-- Run after 20. Safe to re-run.
--
-- profiles.avatar_url has existed since 01_schema.sql, but nothing has ever
-- been able to write it except the sign-up trigger, which copies whatever
-- Google hands over. Anybody who signed in with an email code has had no
-- picture and no way to add one, and nobody at all has been able to change
-- theirs. This is the missing half: somewhere to put the file.
--
-- WHY A PUBLIC BUCKET
--
-- Avatars are shown next to a name on a screen the viewer is already
-- authorised to see, so the file itself carries nothing the reader could not
-- already read. The alternative is a signed URL per avatar per render, which
-- means a round trip for every face on the board, an expiry to manage, and a
-- cache that cannot work. The cost of public is that an URL, once known, is
-- readable without a session. For a picture somebody chose as their public
-- face in a group, that is the right trade.
--
-- Writing is not public. The policies below let you write exactly one folder,
-- the one named after your own user id, so nobody can replace anybody else's
-- picture, and the app puts every file at `<uid>/avatar.jpg`.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The bucket.
--
-- Created through the table rather than the dashboard so this file is the
-- whole setup and a fresh project needs no clicking. `on conflict` makes it
-- re-runnable; the update keeps the settings correct on a bucket somebody
-- already made by hand.
--
-- The size limit is deliberately small. The client downscales to a 512px
-- square JPEG before uploading, which lands around 40kB, so anything
-- approaching a megabyte here is a client that failed to resize, and storing
-- a 12 megapixel photo to render it at 40 pixels helps nobody.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  1048576,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 2. Who may do what.
--
-- storage.objects already has RLS enabled by Supabase, so these are added to
-- the existing set rather than switching anything on. Every one of them is
-- scoped to bucket_id = 'avatars' and leaves other buckets untouched.
--
-- `(storage.foldername(name))[1]` is the first path segment, which for
-- `3f2b.../avatar.jpg` is the uploader's user id. Comparing it to auth.uid()
-- is what makes the folder yours: a crafted upload to somebody else's id
-- fails the check rather than being rejected by the app.
-- ---------------------------------------------------------------------------
drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists avatars_own_insert on storage.objects;
create policy avatars_own_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Update as well as insert, because the app writes to a fixed path and
-- replaces the file rather than accumulating one per change. Without this the
-- first photo would upload and the second would fail.
drop policy if exists avatars_own_update on storage.objects;
create policy avatars_own_update on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_own_delete on storage.objects;
create policy avatars_own_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- 3. A name is not optional, and an empty one is not a name.
--
-- display_name has been `not null` since the first schema, which stops a null
-- and allows '   '. Now that the field is editable that gap is reachable: an
-- empty name renders as an empty row with an empty avatar and no way to tell
-- who it is. The client refuses to save one; this is the same rule in the
-- place it cannot be bypassed.
--
-- Existing rows are repaired first, otherwise adding the constraint fails on
-- any account that already has one.
-- ---------------------------------------------------------------------------
update profiles set display_name = 'Friend'
where display_name is null or length(trim(display_name)) = 0;

alter table profiles drop constraint if exists profiles_display_name_check;
alter table profiles add constraint profiles_display_name_check
  check (length(trim(display_name)) between 1 and 60);

-- Check:
--   select id, public, file_size_limit from storage.buckets where id = 'avatars';
--   select policyname from pg_policies
--    where tablename = 'objects' and policyname like 'avatars_%';
