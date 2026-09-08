-- ============================================================================
-- Rich & Friends, migration 62: qui peut supprimer un objectif
--
-- Run after 61. Safe to re-run.
--
-- LA DEMANDE
--
--   "Ya des goals qu on peut pas supprimer, je comprends pas. Ajoute une regle:
--    seules les personnes qui ont cree le goal, ou les admins, ou le createur
--    du groupe peuvent supprimer."
--
-- CE QUI SE PASSAIT VRAIMENT
--
-- La regle en base disait deja presque cela:
--
--   owner_id = auth.uid() or is_group_admin(group_id)
--
-- et is_group_admin() compte le createur du groupe depuis la migration 18. Un
-- objectif commun n a pas de proprietaire (owner_id est null, c est ce qui le
-- rend commun), donc seuls les admins pouvaient le supprimer, et cela
-- fonctionnait.
--
-- Le bouton, lui, ne s affichait pas. L ecran recopiait la regle a la main et
-- la recopiait mal: il testait `role === 'admin'` alors que le createur d un
-- groupe porte le role 'creator'. La personne qui a cree le groupe n avait donc
-- jamais l entree Supprimer dans le menu, sur aucun objectif commun, alors que
-- la base l aurait acceptee. C est corrige dans src/lib/goalPerms.js, avec un
-- test, et l ecran ne recopie plus rien: il appelle cette fonction.
--
-- CE QUE CE FICHIER CHANGE VRAIMENT
--
-- Une seule chose, et c est la partie de la demande qui n existait pas encore:
-- l AUTEUR d un objectif commun peut le supprimer, meme sans etre admin. On
-- sait qui c est depuis la migration 50, la colonne created_by, et jusqu ici
-- personne ne s en servait pour les droits. Quelqu un qui ajoute un objectif
-- commun par erreur devait demander a un admin de le retirer.
--
-- Le createur du groupe est nomme explicitement, en plus de is_group_admin().
-- Les deux se recouvrent aujourd hui, et c est voulu: la demande dit "ou le
-- createur du groupe", et un droit ecrit noir sur blanc ne depend pas d une
-- ligne de group_members restee juste.
--
-- CE QUE CE FICHIER NE CHANGE PAS
--
-- Un objectif personnel reste a son proprietaire. La politique d insertion
-- impose owner_id = auth.uid() sur un objectif personnel, donc created_by et
-- owner_id y designent la meme personne et la nouvelle branche n ouvre rien.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. LE CREATEUR DU GROUPE, NOMME.
--
-- SECURITY DEFINER comme is_member() et is_group_admin(), et pour la meme
-- raison: une expression de politique est evaluee avec les droits de celui qui
-- interroge, donc un `select ... from groups` ecrit directement dedans se
-- ferait filtrer par la politique de groups, quand il ne partirait pas en
-- recursion.
-- ---------------------------------------------------------------------------
create or replace function is_group_creator(gid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from groups
    where id = gid and created_by = auth.uid()
  );
$$;

-- Revoquer d abord, accorder ensuite, par nom. Une fonction nouvellement creee
-- est executable par PUBLIC, ce qui inclut anon: la cle publique du navigateur
-- suffirait a l appeler.
revoke execute on function is_group_creator(uuid) from public, anon;
grant  execute on function is_group_creator(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- 2. LA REGLE DE SUPPRESSION.
--
-- Quatre branches, dans l ordre ou on les lit:
--
--   owner_id = auth.uid()      ton objectif a toi
--   created_by = auth.uid()    celui que tu as ecrit, meme s il est commun
--   is_group_admin(group_id)   admin du groupe, createur compris (migr. 18)
--   is_group_creator(group_id) le createur du groupe, nomme
--
-- `group_id is not null` devant les deux dernieres: un objectif solo n a pas de
-- groupe, et is_group_admin(null) vaut faux, mais l ecrire evite d appeler deux
-- fonctions pour rien sur chaque ligne d une liste personnelle.
--
-- ATTENTION AU SILENCE. Postgres ne leve rien sur un DELETE que la politique
-- refuse: zero ligne supprimee, aucune erreur. C est pour cela que le client
-- demande les lignes supprimees en retour (`.delete().select('id')` dans
-- GroupContext) et traite zero ligne comme un refus.
-- ---------------------------------------------------------------------------
drop policy if exists goals_delete on goals;
create policy goals_delete on goals for delete to authenticated
  using (
    owner_id = auth.uid()
    or created_by = auth.uid()
    or (group_id is not null and is_group_admin(group_id))
    or (group_id is not null and is_group_creator(group_id))
  );

notify pgrst, 'reload schema';

-- Verifier apres avoir passe ce fichier:
--   -- la politique porte bien les quatre branches:
--   select qual from pg_policies where tablename = 'goals' and policyname = 'goals_delete';
--   -- et la fonction n est pas restee ouverte a anon:
--   select proacl from pg_proc where proname = 'is_group_creator';
