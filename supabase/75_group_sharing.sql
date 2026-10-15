-- ============================================================================
-- Rich & Friends, migration 75: ce qu'on partage avec un groupe, choisi en
-- le rejoignant
--
-- Run after 74. Safe to re-run. Run it AFTER the app version that reads it is
-- live: the app works with or without this file, but people who join a group
-- once it has run are asked their choices by that version only.
--
-- LA DEMANDE
--
--   "When someone join a group, let's add a feature that directly asks them
--    whether they want to share their name, their pictures, email, or their
--    mood with the group."
--
-- Quatre questions, une fois, en arrivant dans un groupe, et modifiables
-- ensuite dans les reglages du groupe:
--
--   ton nom et ta photo de profil   sinon un pseudo, et le groupe ne lit
--                                   plus du tout ton profil
--   tes photos de preuve            celles qu'on joint a un point du jour
--   ton e-mail                      pour que les membres puissent t'ecrire
--   ton humeur du jour              la table mood_share de la migration 71
--
-- UNE REPONSE QUI NE TIENT QU'A L'ECRAN N'EN EST PAS UNE.
--
-- Chaque "non" est tenu par la base, pas par l'interface:
--
--   le nom      profiles_select ne laisse plus lire un profil qu'a travers un
--               groupe ou la personne a dit oui. Les trois vues qui portent un
--               nom (fil, preuves, celebrations) passent au pseudo.
--   les photos  un declencheur retire la photo d'un point du jour poste dans
--               un groupe ou la personne a dit non.
--   l'e-mail    voir plus bas: il etait lisible par tous les membres.
--   l'humeur    mood_share, deja tenu par une politique depuis la 71.
--
-- L'E-MAIL ETAIT DEJA LISIBLE, ET C'ETAIT UN DEFAUT.
--
-- La migration 14 a copie l'adresse de chaque compte dans profiles.email_lower
-- pour que le webhook Stripe retrouve un acheteur. Or profiles_select laisse
-- lire la ligne ENTIERE de quiconque partage un groupe avec soi, donc
-- n'importe quel membre pouvait lire l'adresse des autres par l'API, sans que
-- personne l'ait jamais choisi. Demander "partager ton e-mail ?" n'a de sens
-- que si "non" veut dire non.
--
-- L'adresse part donc dans une table privee, account_emails, que seul son
-- proprietaire lit. Pas en supprimant la colonne: un declencheur la vide et la
-- recopie dans la table privee a chaque ecriture. Ainsi, rien de ce qui ecrit
-- encore profiles.email_lower (handle_new_user et sync_profile_email de la 14,
-- ou la 14 elle-meme si quelqu'un la repasse) ne casse l'inscription, et rien
-- ne peut y remettre une adresse lisible. Le webhook lit account_emails.
--
-- POUR CEUX QUI SONT DEJA DANS UN GROUPE, RIEN NE CHANGE.
--
-- Chaque membre existant recoit une reponse: nom et photos partages, e-mail
-- non (il n'a jamais ete montre nulle part), humeur inchangee. Ils ne voient
-- pas la question; ils peuvent changer dans les reglages du groupe. Seuls ceux
-- qui rejoignent un groupe apres ce fichier la voient.
--
-- TANT QU'ON N'A PAS REPONDU, ON NE PARTAGE RIEN.
--
-- Pas de ligne dans group_sharing veut dire non a tout. La question arrive a
-- l'ouverture du groupe, donc ce n'est qu'un instant, mais c'est l'instant ou
-- un groupe de defi plein d'inconnus verrait sinon un nom complet et un
-- anniversaire. Celui ou celle qui CREE un groupe recoit nom et photos
-- d'office: c'est son groupe, et la question se change dans les reglages.
--
-- QUI VOIT LES REPONSES DES AUTRES: PERSONNE.
--
-- group_sharing ne se lit que par la personne qu'elle concerne, comme
-- mood_share (71) et group_mute (69): un membre n'a pas a apprendre qui a dit
-- non. Le pseudo, lui, est sur group_members, parce que le groupe doit le
-- voir pour l'afficher.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. L'e-mail, dans une table que seul son proprietaire lit.
--
-- user_id vers auth.users et pas vers profiles: le declencheur ci-dessous
-- ecrit ici AVANT que la ligne de profiles existe (BEFORE INSERT), et une cle
-- vers profiles refuserait.
-- ---------------------------------------------------------------------------
create table if not exists account_emails (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  email_lower text not null,
  updated_at  timestamptz not null default now()
);

create unique index if not exists account_emails_email_idx on account_emails (email_lower);

comment on table account_emails is
  'L adresse de chaque compte, en minuscules. Lue par son proprietaire, par le '
  'webhook Stripe (service role) et par group_member_emails() pour les groupes '
  'ou la personne a choisi de la partager. Remplace profiles.email_lower (75).';

alter table account_emails enable row level security;

drop policy if exists account_emails_own on account_emails;
create policy account_emails_own on account_emails
  for select to authenticated
  using (user_id = auth.uid());

-- Aucune politique d'ecriture: seul le declencheur (SECURITY DEFINER) ecrit.

create or replace function profiles_email_to_private()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_lower is not null then
    insert into account_emails (user_id, email_lower, updated_at)
    values (new.id, lower(trim(new.email_lower)), now())
    on conflict (user_id) do update
      set email_lower = excluded.email_lower,
          updated_at  = now();
    new.email_lower := null;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_email_to_private on profiles;
create trigger profiles_email_to_private
  before insert or update of email_lower on profiles
  for each row execute function profiles_email_to_private();

-- La reprise. Reecrire la colonne avec sa propre valeur declenche le
-- declencheur, qui la recopie dans account_emails et la vide.
update profiles set email_lower = email_lower where email_lower is not null;

-- ---------------------------------------------------------------------------
-- 2. Le pseudo, visible par le groupe.
-- ---------------------------------------------------------------------------
alter table group_members add column if not exists alias text;

alter table group_members drop constraint if exists group_members_alias_check;
alter table group_members add constraint group_members_alias_check
  check (alias is null or length(trim(alias)) between 1 and 30);

-- ---------------------------------------------------------------------------
-- 3. Les reponses, lisibles par leur seul auteur.
-- ---------------------------------------------------------------------------
-- Cree, et rempli pour les membres d'avant, UNE SEULE FOIS. Repasser ce
-- fichier ne doit pas reprendre: la reprise donnerait "nom et photos" a
-- quelqu'un qui vient d'arriver et n'a pas encore repondu, c'est-a-dire le
-- contraire de ce qu'il n'a pas encore dit. Mesure: avec un simple
-- `on conflict do nothing`, une deuxieme passe le faisait.
do $$
begin
  if to_regclass('public.group_sharing') is null then
    create table group_sharing (
      group_id    uuid not null,
      user_id     uuid not null,
      name        boolean not null default false,
      photos      boolean not null default false,
      email       boolean not null default false,
      answered_at timestamptz not null default now(),
      primary key (group_id, user_id),
      -- Quitter le groupe efface la reponse: revenir, c'est se voir reposer
      -- la question.
      foreign key (group_id, user_id)
        references group_members (group_id, user_id) on delete cascade
    );

    -- Les membres d'avant: nom et photos, pas d'e-mail, comme jusqu'ici.
    insert into group_sharing (group_id, user_id, name, photos, email, answered_at)
    select gm.group_id, gm.user_id, true, true, false, gm.joined_at
      from group_members gm;
  end if;
end;
$$;

comment on table group_sharing is
  'Ce que chaque membre partage avec chaque groupe. Pas de ligne: rien. '
  'Ecrite par set_group_sharing(), lue par son auteur seulement.';

alter table group_sharing enable row level security;

drop policy if exists group_sharing_own on group_sharing;
create policy group_sharing_own on group_sharing
  for select to authenticated
  using (user_id = auth.uid());

-- Celui ou celle qui cree un groupe: nom et photos d'office.
create or replace function group_sharing_for_creator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'creator' then
    insert into group_sharing (group_id, user_id, name, photos, email)
    values (new.group_id, new.user_id, true, true, false)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists group_sharing_for_creator on group_members;
create trigger group_sharing_for_creator
  after insert on group_members
  for each row execute function group_sharing_for_creator();

-- ---------------------------------------------------------------------------
-- 4. Les lectures, par fonctions SECURITY DEFINER.
--
-- Meme raison qu'a la 71: une politique qui interroge group_sharing est
-- soumise a la RLS de group_sharing, qui ne montre a chacun que ses propres
-- lignes, et ne trouverait donc jamais celles des autres.
-- ---------------------------------------------------------------------------

-- Interne: pas accordee a authenticated, elle repondrait pour n'importe qui.
create or replace function member_shares(p_user uuid, p_group uuid, p_what text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case p_what
             when 'name'   then s.name
             when 'photos' then s.photos
             when 'email'  then s.email
             else false
           end
      from group_sharing s
     where s.user_id = p_user and s.group_id = p_group
  ), false);
$$;

revoke all on function member_shares(uuid, uuid, text) from public, anon, authenticated;

-- Vrai si nous partageons un groupe ou cette personne montre son nom.
create or replace function profile_visible_to_me(other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from group_members mine
      join group_members theirs on theirs.group_id = mine.group_id
      join group_sharing s      on s.group_id = theirs.group_id
                               and s.user_id  = theirs.user_id
                               and s.name
     where mine.user_id = auth.uid()
       and theirs.user_id = other
  );
$$;

revoke all on function profile_visible_to_me(uuid) from public, anon;
grant execute on function profile_visible_to_me(uuid) to authenticated;

-- La politique de lecture des profils. Avant: shares_group(id), n'importe quel
-- groupe commun. shares_group() reste definie et n'est plus lue par rien.
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select to authenticated
  using (id = auth.uid() or profile_visible_to_me(id));

-- Les adresses que les membres d'un groupe ont choisi d'y partager, pour un
-- membre de ce groupe et personne d'autre.
create or replace function group_member_emails(p_group uuid)
returns table (user_id uuid, email text)
language sql
stable
security definer
set search_path = public
as $$
  select s.user_id, e.email_lower
    from group_sharing s
    join account_emails e on e.user_id = s.user_id
   where s.group_id = p_group
     and s.email
     and exists (
       select 1 from group_members me
        where me.group_id = p_group and me.user_id = auth.uid()
     );
$$;

revoke all on function group_member_emails(uuid) from public, anon;
grant execute on function group_member_emails(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Repondre, et changer d'avis.
--
-- Une seule fonction pour les quatre, pour que la reponse soit atomique.
-- p_mood a null ne touche pas a l'humeur (les reglages du compte la gerent
-- deja groupe par groupe, voir MoodShare).
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
  pseudo text := nullif(trim(coalesce(p_alias, '')), '');
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not exists (
    select 1 from group_members where group_id = p_group and user_id = auth.uid()
  ) then
    raise exception 'not a member of this group';
  end if;
  if not coalesce(p_name, false) and (pseudo is null or length(pseudo) > 30) then
    raise exception 'alias_required';
  end if;

  insert into group_sharing (group_id, user_id, name, photos, email, answered_at)
  values (p_group, auth.uid(), coalesce(p_name, false), coalesce(p_photos, false),
          coalesce(p_email, false), now())
  on conflict (group_id, user_id) do update
    set name        = excluded.name,
        photos      = excluded.photos,
        email       = excluded.email,
        answered_at = now();

  update group_members
     set alias = case when coalesce(p_name, false) then null else pseudo end
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

-- ---------------------------------------------------------------------------
-- 6. Les photos de preuve.
--
-- Une photo postee dans un groupe ou on a dit non n'y est pas enregistree: le
-- point du jour l'est, sans elle. L'interface n'offre plus le champ photo dans
-- ce groupe, donc ceci ne sert qu'a un client ancien ou a un appel a la main.
-- Les photos postees AVANT d'avoir dit non restent; chacune se supprime dans
-- la galerie.
-- ---------------------------------------------------------------------------
create or replace function checkin_photo_sharing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  gid uuid;
  uid uuid;
begin
  if new.photo_url is null then
    return new;
  end if;
  select cy.group_id, ck.user_id into gid, uid
    from checkins ck
    join cycles cy on cy.id = ck.cycle_id
   where ck.id = new.checkin_id;
  if gid is not null and not member_shares(uid, gid, 'photos') then
    new.photo_url := null;
  end if;
  return new;
end;
$$;

drop trigger if exists checkin_photo_sharing on checkin_items;
create trigger checkin_photo_sharing
  before insert or update of photo_url on checkin_items
  for each row execute function checkin_photo_sharing();

-- ---------------------------------------------------------------------------
-- 7. Les trois vues qui portent un nom.
--
-- Elles joignaient profiles en INNER JOIN. Avec un profil devenu invisible,
-- la ligne entiere disparaissait: la preuve, la celebration, l'entree du fil
-- de quelqu'un qui a choisi un pseudo n'existaient plus pour les autres.
-- LEFT JOIN, et le pseudo du groupe a la place du nom. Memes colonnes, dans le
-- meme ordre, donc `create or replace` suffit.
-- ---------------------------------------------------------------------------
create or replace view group_feed_detail
with (security_invoker = on)
as
select
  f.id,
  f.group_id,
  f.user_id,
  f.kind,
  f.goal_id,
  f.cycle_id,
  f.created_at,
  coalesce(p.display_name, gm.alias) as display_name,
  p.avatar_url,
  gl.commitment as goal_title
from group_feed f
left join profiles p       on p.id = f.user_id
left join group_members gm on gm.group_id = f.group_id and gm.user_id = f.user_id
left join goals gl         on gl.id = f.goal_id;

create or replace view group_proofs
with (security_invoker = on)
as
select
  ci.id            as item_id,
  cy.group_id,
  c.user_id,
  ci.photo_url,
  ci.link_url,
  ci.outcome,
  ci.evidence,
  c.submitted_at,
  cy.opens_at      as day_at,
  g.commitment     as goal_title,
  coalesce(g.proof_type, 'photo') as goal_proof_type,
  coalesce(p.display_name, gm.alias) as display_name,
  p.avatar_url,
  coalesce(r.total, 0)  as reaction_count,
  coalesce(r.counts, '{}'::jsonb) as reaction_counts,
  coalesce(m.mine, '[]'::jsonb)   as my_reactions
from checkin_items ci
join checkins c   on c.id = ci.checkin_id
join cycles   cy  on cy.id = c.cycle_id
left join profiles p       on p.id = c.user_id
left join group_members gm on gm.group_id = cy.group_id and gm.user_id = c.user_id
left join goals g on g.id = ci.goal_id
left join lateral (
  select count(*) as total,
         jsonb_object_agg(x.emoji, x.n) as counts
  from (
    select emoji, count(*) as n
    from proof_reactions pr
    where pr.item_id = ci.id
    group by emoji
  ) x
) r on true
left join lateral (
  select jsonb_agg(pr.emoji) as mine
  from proof_reactions pr
  where pr.item_id = ci.id and pr.user_id = auth.uid()
) m on true
where ci.photo_url is not null
   or ci.link_url is not null
   or nullif(trim(ci.evidence), '') is not null;

create or replace view celebrations_detail
with (security_invoker = on)
as
select
  c.id,
  c.group_id,
  c.sender_id,
  c.receiver_id,
  c.message,
  c.created_at,
  c.seen_at,
  g.name          as group_name,
  coalesce(s.display_name, gs.alias) as sender_name,
  s.avatar_url    as sender_avatar,
  coalesce(r.display_name, gr.alias) as receiver_name,
  r.avatar_url    as receiver_avatar
from celebrations c
join groups   g on g.id = c.group_id
left join profiles s       on s.id = c.sender_id
left join profiles r       on r.id = c.receiver_id
left join group_members gs on gs.group_id = c.group_id and gs.user_id = c.sender_id
left join group_members gr on gr.group_id = c.group_id and gr.user_id = c.receiver_id;

notify pgrst, 'reload schema';

-- Verifier apres avoir passe ce fichier:
--   -- plus aucune adresse lisible dans profiles, toutes dans account_emails
--   select count(*) filter (where email_lower is not null) as encore_visibles
--     from profiles;                                   -- 0
--   select count(*) from account_emails;               -- un par compte
--
--   -- une reponse par membre existant
--   select count(*) as membres, (select count(*) from group_sharing) as reponses
--     from group_members;                              -- egaux
--
--   -- la politique des profils passe par la nouvelle fonction
--   select pg_get_expr(polqual, polrelid) from pg_policy
--    where polname = 'profiles_select';
