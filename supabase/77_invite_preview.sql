-- ============================================================================
-- Rich & Friends, migration 77: ce qu'un lien d'invitation montre avant
-- d'entrer
--
-- Run after 76. Safe to re-run. The app works without it: the invitation page
-- then says "un groupe" instead of the group's name.
--
-- LA DEMANDE
--
--   "Why every time when you click on this kind of link, it's always sending
--    you to the normal home page of the app? It doesn't send you to a page
--    saying, hey, join this group with the link you clicked."
--
-- Le lien d'un groupe ouvre maintenant une page d'invitation, /join/CODE, qui
-- dit quel groupe et combien de personnes y sont, avec un seul bouton. Pour
-- le dire avant la connexion, la page a besoin de lire le groupe derriere le
-- code, ce que la RLS refuse, a raison, a quelqu'un qui n'en est pas membre.
-- D'ou cette fonction, qui ne rend que ce que l'invitation affiche.
--
-- CE QUI EST MONTRE, ET A QUI.
--
--   le nom        a tout le monde pour un groupe defi: son lien est fait pour
--                 etre publie, dans une bio. Pour un groupe ordinaire,
--                 seulement a quelqu'un de connecte. Un code fait six
--                 caracteres; sans cette regle, n'importe qui pourrait essayer
--                 des codes au hasard et lire le nom de groupes prives.
--   le nombre     a tout le monde: "12 personnes" ne dit rien de personne.
--   le defi       a tout le monde: la page change de forme pour un defi.
--   l'identifiant seulement a quelqu'un de connecte, pour ouvrir le groupe
--                 quand il en fait deja partie.
--   deja membre   vrai seulement pour la personne connectee qui en est.
--
-- Aucun nom de membre, aucune photo: l'invitation ne montre personne.
-- ============================================================================

create or replace function invite_preview(p_code text)
returns table (
  group_id  uuid,
  name      text,
  members   int,
  challenge text,
  is_member boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select case when auth.uid() is not null then g.id end,
         case when g.challenge is not null or auth.uid() is not null then g.name end,
         (select count(*)::int from group_members m where m.group_id = g.id),
         g.challenge,
         coalesce(auth.uid() is not null and exists (
           select 1 from group_members m
            where m.group_id = g.id and m.user_id = auth.uid()
         ), false)
    from groups g
   where g.invite_code = upper(trim(coalesce(p_code, '')))
   limit 1;
$$;

grant execute on function invite_preview(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Les objectifs d'un defi, pour la page d'invitation.
--
-- Ceux de la base et pas une copie dans le code: un objectif de groupe se
-- modifie, et l'invitation doit montrer ce que la personne trouvera en
-- entrant, dans la langue ou le groupe a ete cree. Seulement pour un groupe
-- defi, dont le lien est public; un groupe ordinaire ne montre rien.
-- ---------------------------------------------------------------------------
create or replace function invite_goals(p_code text)
returns table (title text)
language sql
stable
security definer
set search_path = public
as $$
  select gl.commitment
    from groups g
    join goals gl on gl.group_id = g.id
                 and gl.kind = 'group'
                 and gl.status = 'active'
   where g.invite_code = upper(trim(coalesce(p_code, '')))
     and g.challenge is not null
   order by gl.created_at
   limit 20;
$$;

grant execute on function invite_goals(text) to anon, authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Checks. Run these after the file; each should return what its comment says.
-- ---------------------------------------------------------------------------
-- The function (one row):
--   select proname from pg_proc where proname = 'invite_preview';
--
-- A code nobody has (no row):
--   select * from invite_preview('ZZZZZZ');
