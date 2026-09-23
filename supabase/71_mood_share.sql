-- ============================================================================
-- Rich & Friends, migration 71: le partage des humeurs se choisit par groupe,
-- dans les reglages, et plus case par case.
--
-- Run after 70. Safe to re-run.
--
-- LA DEMANDE
--
--   "Humeur du jour, remove l'option qui demande de partager dans les
--    groupes, bouge la plutot dans les parametres, comme ca chaque personne
--    peut aller dans ses parametres et choisir avec quel groupe elle veut
--    partager ses humeurs."
--
-- CE QU'IL Y AVAIT
--
-- daily_mood.shared, un booleen par JOURNEE, coche dans le formulaire au
-- moment de choisir un visage. Deux choses ne vont pas avec ca.
--
-- La premiere est que la question revient tous les jours alors que la reponse,
-- elle, ne change pas: quelqu'un qui partage ses humeurs avec ses amis les
-- partage encore demain. Une case a recocher chaque jour est une question
-- posee dix-huit fois pour une decision prise une fois.
--
-- La deuxieme est qu'elle est indivisible. "Partager avec mes groupes" est un
-- seul oui pour tous les groupes a la fois, et quelqu'un qui est dans le
-- groupe de ses amies ET dans celui de son cours n'a aucun moyen de dire oui a
-- l'une et non a l'autre. C'est exactement la distinction demandee ici.
--
-- CE QUE CA DEVIENT
--
-- Une ligne par groupe avec qui on accepte de partager. Pas de ligne, pas de
-- partage: l'absence est le non, donc le defaut est prive sans qu'il faille
-- ecrire un booleen quelque part.
--
-- LA POLITIQUE DE LECTURE, ET POURQUOI ELLE PASSE PAR UNE FONCTION
--
-- Une politique RLS qui fait `exists (select 1 from mood_share ...)` est
-- elle-meme soumise a la RLS de mood_share. Comme mood_share ne se lit que par
-- son proprietaire, et qu'il le faut (personne n'a a savoir avec qui quelqu'un
-- d'autre partage), la sous-requete ne rendrait jamais rien et AUCUNE humeur
-- ne serait plus visible nulle part. C'est un echec silencieux: pas d'erreur,
-- juste un tableau de groupe vide pour toujours.
--
-- D'ou mood_visible_to_me(), en SECURITY DEFINER, qui est le seul endroit
-- autorise a lire mood_share pour quelqu'un d'autre, qui ne rend qu'un
-- booleen, et qui verifie les deux appartenances: celle de la personne qui
-- regarde ET celle de la personne regardee. Quitter un groupe arrete donc le
-- partage vers ce groupe sans qu'il faille nettoyer quoi que ce soit.
--
-- `day = current_date` ne bouge pas. Ce qui est visible reste l'humeur du
-- jour, jamais l'historique, et cette partie-la n'a jamais ete le probleme.
--
-- PERSONNE NE PERD CE QU'IL AVAIT
--
-- shared = true voulait dire "avec mes groupes", au pluriel. La reprise ecrit
-- donc exactement ca: pour chaque personne qui a deja partage une humeur, une
-- ligne par groupe dont elle est membre. Sa visibilite ne change pas, et elle
-- peut maintenant la restreindre.
--
-- daily_mood.shared est laisse en place et n'est plus lu par rien. Supprimer
-- une colonne est destructeur, et celle-ci porte l'historique de ce que les
-- gens avaient choisi.
-- ============================================================================

-- 1. La table.
create table if not exists mood_share (
  user_id    uuid not null references auth.users(id) on delete cascade,
  group_id   uuid not null references groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, group_id)
);

comment on table mood_share is
  'Les groupes avec qui une personne accepte de montrer son humeur du jour. '
  'Pas de ligne, pas de partage.';

create index if not exists mood_share_group_idx on mood_share (group_id);

-- 2. Elle ne se lit et ne s'ecrit que par la personne qu'elle concerne.
--    Pas de chemin par le groupe, deliberement: un membre n'a pas a apprendre
--    qui, dans le groupe, a choisi de ne pas partager. Meme raison que
--    group_mute a la migration 69.
alter table mood_share enable row level security;

drop policy if exists mood_share_own on mood_share;
create policy mood_share_own on mood_share
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 3. La seule chose autorisee a lire mood_share pour quelqu'un d'autre, et
--    elle ne rend qu'un booleen.
create or replace function mood_visible_to_me(owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from mood_share ms
      join group_members moi   on moi.group_id = ms.group_id and moi.user_id = auth.uid()
      join group_members lelle on lelle.group_id = ms.group_id and lelle.user_id = ms.user_id
     where ms.user_id = owner
  );
$$;

comment on function mood_visible_to_me(uuid) is
  'Vrai si le proprietaire partage son humeur avec un groupe ou nous sommes '
  'tous les deux. SECURITY DEFINER parce que la RLS de mood_share interdit de '
  'lire les lignes des autres, y compris depuis une politique.';

revoke all on function mood_visible_to_me(uuid) from public, anon;
grant execute on function mood_visible_to_me(uuid) to authenticated;

-- 4. La politique de lecture de daily_mood.
drop policy if exists daily_mood_select on daily_mood;
create policy daily_mood_select on daily_mood
  for select
  using (
    user_id = auth.uid()
    or (day = current_date and mood_visible_to_me(user_id))
  );

comment on column daily_mood.shared is
  'Superseded par mood_share a la migration 71. Plus lu par aucune politique '
  'ni par le client. Garde parce qu il porte l historique de ce que les gens '
  'avaient choisi, et que supprimer une colonne est destructeur.';

-- 5. La reprise: personne ne perd ce qu'il avait.
insert into mood_share (user_id, group_id)
select distinct dm.user_id, gm.group_id
  from daily_mood dm
  join group_members gm on gm.user_id = dm.user_id
 where dm.shared
on conflict do nothing;

notify pgrst, 'reload schema';

-- Verifier apres avoir passe ce fichier:
--   -- la table, sa politique unique, et la RLS active
--   select relname, relrowsecurity from pg_class where relname = 'mood_share';
--   select polname from pg_policy p join pg_class c on c.oid = p.polrelid
--    where c.relname = 'mood_share';
--
--   -- la reprise: autant de personnes que de gens qui partageaient
--   select count(*) as lignes, count(distinct user_id) as gens from mood_share;
--
--   -- et la politique ne parle plus de `shared`
--   select pg_get_expr(polqual, polrelid) from pg_policy p
--     join pg_class c on c.oid = p.polrelid
--    where c.relname = 'daily_mood' and polname = 'daily_mood_select';
