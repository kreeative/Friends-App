-- ============================================================================
-- Rich & Friends, migration 79: ton nom se voit toujours, ta photo et ton
-- humeur se choisissent
--
-- Run after 78 (75 must be in place). Safe to re-run.
--
-- LA DEMANDE
--
--   "If you don't want to share your picture, it's okay because it's
--    privacy. Well, we still need to have your name. Yeah, it doesn't share
--    your email anyways. [...] you can ask to not share your picture or your
--    mood."
--
-- La 75 posait quatre questions: le nom (sinon un pseudo), les photos de
-- preuve, l'e-mail, l'humeur. Il en reste deux, plus une troisieme quand le
-- groupe demande des photos en preuve:
--
--   ton nom           toujours visible. Plus de pseudo.
--   ta photo          group_sharing.name, qui garde son nom de colonne parce
--                     que la fonction notify deja deployee le lit. Non: le
--                     groupe ne lit plus ta ligne de profil (photo de profil,
--                     anniversaire), et te voit sous ton nom par
--                     group_members.alias. C'est la meme mecanique que le
--                     pseudo de la 75, avec ton vrai nom dedans.
--   tes preuves       group_sharing.photos, inchange.
--   ton humeur        mood_share, inchange.
--   ton e-mail        plus demande: il n'est partage avec personne.
--
-- LE NOM DOIT SE VOIR DES L'ARRIVEE.
--
-- Avant de repondre, la 75 ne montrait rien de toi (pas de ligne, pas de
-- partage), nom compris. Le nom est maintenant pose dans alias au moment ou
-- l'on entre dans le groupe, par un declencheur, donc le groupe te voit sous
-- ton nom tout de suite, sans photo tant que tu n'as pas repondu.
--
-- ET IL DOIT RESTER LE TIEN.
--
-- alias est une copie, tenue a jour quand tu changes de nom. Coupee a 30
-- caracteres, la contrainte de la 75: un prenom et un nom y tiennent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Ton nom, pose en entrant dans un groupe.
-- ---------------------------------------------------------------------------
create or replace function group_members_alias_from_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.alias is null then
    select nullif(trim(left(trim(p.display_name), 30)), '')
      into new.alias
      from profiles p
     where p.id = new.user_id;
  end if;
  return new;
end;
$$;

create or replace trigger group_members_alias_from_name
  before insert on group_members
  for each row execute function group_members_alias_from_name();

-- ---------------------------------------------------------------------------
-- 2. Et tenu a jour quand tu en changes.
-- ---------------------------------------------------------------------------
create or replace function profiles_name_to_alias()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.display_name is distinct from old.display_name then
    update group_members
       set alias = nullif(trim(left(trim(new.display_name), 30)), '')
     where user_id = new.id
       and alias is not null;
  end if;
  return new;
end;
$$;

create or replace trigger profiles_name_to_alias
  after update of display_name on profiles
  for each row execute function profiles_name_to_alias();

-- ---------------------------------------------------------------------------
-- 3. Un pseudo pose sous la 75 redevient le vrai nom.
-- ---------------------------------------------------------------------------
update group_members gm
   set alias = nullif(trim(left(trim(p.display_name), 30)), '')
  from profiles p
 where p.id = gm.user_id
   and gm.alias is not null
   and gm.alias is distinct from nullif(trim(left(trim(p.display_name), 30)), '');

-- Et une adresse partagee sous la 75 ne l'est plus.
update group_sharing set email = false where email;

-- ---------------------------------------------------------------------------
-- 4. Repondre. Meme signature que la 75, pour l'app et les droits.
--
-- p_alias et p_email sont lus et ignores: le nom est toujours le vrai,
-- l'e-mail n'est jamais partage. Un appel bricole ne peut pas remettre un
-- pseudo ni ouvrir une adresse.
-- ---------------------------------------------------------------------------
create or replace function set_group_sharing(
  p_group  uuid,
  p_name   boolean,
  p_alias  text,
  p_photos boolean,
  p_email  boolean,
  p_mood   boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  real_name text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not exists (
    select 1 from group_members where group_id = p_group and user_id = auth.uid()
  ) then
    raise exception 'not a member of this group';
  end if;

  select nullif(trim(left(trim(display_name), 30)), '')
    into real_name
    from profiles
   where id = auth.uid();

  insert into group_sharing (group_id, user_id, name, photos, email, answered_at)
  values (p_group, auth.uid(), coalesce(p_name, false), coalesce(p_photos, false),
          false, now())
  on conflict (group_id, user_id) do update
    set name        = excluded.name,
        photos      = excluded.photos,
        email       = false,
        answered_at = now();

  update group_members
     set alias = real_name
   where group_id = p_group and user_id = auth.uid();

  if p_mood is true then
    insert into mood_share (user_id, group_id) values (auth.uid(), p_group)
    on conflict do nothing;
  elsif p_mood is false then
    delete from mood_share where user_id = auth.uid() and group_id = p_group;
  end if;
end;
$$;

revoke all on function set_group_sharing(uuid, boolean, text, boolean, boolean, boolean) from public, anon;
grant execute on function set_group_sharing(uuid, boolean, text, boolean, boolean, boolean) to authenticated;

notify pgrst, 'reload schema';
