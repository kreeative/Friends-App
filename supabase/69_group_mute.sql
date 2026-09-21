-- ============================================================================
-- Rich & Friends, migration 69: couper les notifications d'UN groupe
--
-- Run after 68. Safe to re-run.
--
-- LA DEMANDE
--
--   "Add an option to desactive notification for specific group."
--
-- CE QUI EXISTAIT, ET POURQUOI CA NE SUFFISAIT PAS
--
-- notify_pref.push_on et notify_pref.email_on decident PAR OU on te joint.
-- Ce sont deux interrupteurs pour toute l'application: les decocher coupe
-- aussi les rappels d'eau, d'agenda, d'objectif et de cycle, qui n'ont rien a
-- voir avec un groupe. Quelqu'un que son groupe de lundi fatigue n'a aujourd
-- hui qu'un seul geste possible, et c'est tout couper.
--
-- Une ligne ici veut dire: ce groupe-la, laisse-le tranquille.
--
-- UNE TABLE PLUTOT QU'UNE COLONNE SUR group_members
--
-- La colonne aurait ete plus courte a ecrire et c'est un piege. group_members
-- porte `role`, et il n'y a aujourd'hui AUCUNE politique UPDATE dessus: voir
-- 03_policies.sql, qui n'en pose que pour select et delete. Ajouter une
-- colonne la-dedans obligerait a ouvrir l'ecriture sur cette table, et une
-- politique RLS ne sait pas restreindre les COLONNES. `using (user_id =
-- auth.uid())` autoriserait donc aussi bien
--
--   update group_members set role = 'admin' where user_id = auth.uid()
--
-- c'est-a-dire se nommer administrateur soi-meme. Il faudrait rattraper ca
-- avec des grants par colonne, une mecanique que ce depot n'utilise nulle part
-- ailleurs et qu'un `grant all` ulterieur annulerait sans bruit.
--
-- Une table a part ne touche a la surface d'ecriture d'aucune table existante.
-- C'est la meme forme que les tables du cycle: `user_id = auth.uid()`, et rien
-- d'autre.
--
-- PERSONNE D'AUTRE NE PEUT LE VOIR
--
-- La politique n'a pas de chemin de groupe, et c'est la fonctionnalite, pas un
-- defaut a assouplir plus tard. Si les membres pouvaient lire cette table,
-- l'application diffuserait "Anne-Kelly a coupe les notifications du groupe",
-- ce qui est une information sociale qu'elle n'a aucune raison de publier.
--
-- Meme chose du cote de l'envoi: quand quelqu'un pousse un petit mot a une
-- personne qui a coupe ce groupe, la reponse rendue a l'expediteur est la MEME
-- que pour un telephone injoignable. Il apprend que ca n'est pas arrive, pas
-- pourquoi.
--
-- ABSENCE = NON COUPE
--
-- Pas de colonne booleenne, pas de defaut a poser, aucune ligne a rattraper.
-- Personne n'a de ligne ici aujourd'hui, donc personne n'est coupe aujourd'hui,
-- et le comportement du jour de la migration est exactement celui de la veille.
--
-- CE QUE LA COUPURE ARRETE, ET CE QU'ELLE N'ARRETE PAS
--
-- Elle arrete les quatre messages que le groupe fabrique: le rappel d'ouverture
-- de la periode, l'anniversaire, le nouvel objectif commun, et le petit mot
-- quand quelqu'un s'inquiete de toi. Push et courriel.
--
-- Elle n'arrete PAS:
--
--   - la cloche dans l'application. Rien n'est supprime ni cache: la ligne est
--     ecrite comme avant, elle n'est simplement plus poussee sur un telephone
--     ni envoyee par courriel. Couper, c'est ne plus etre interrompue, pas
--     perdre ce qui s'est passe.
--
--   - la reponse a un petit mot qu'on a envoye soi-meme. "Je vais bien" qui
--     revient est la reponse a un geste qu'on a fait deux minutes plus tot, et
--     l'avaler serait repondre au silence par du silence.
--
--   - l'eau, l'agenda, les objectifs et le cycle, qui ne passent par aucun
--     groupe et n'ont jamais eu a en passer par un.
-- ============================================================================

create table if not exists group_mute (
  user_id    uuid not null references profiles(id) on delete cascade,
  group_id   uuid not null references groups(id)   on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, group_id)
);

comment on table group_mute is
  'Une ligne = cette personne ne veut plus etre interrompue par ce groupe. Push et courriel seulement; la cloche dans l application continue d etre remplie. Absence de ligne = non coupe, ce qui est le defaut et n a rien a rattraper.';

-- La cle primaire porte deja (user_id, group_id), qui est la seule question
-- posee a cette table. Aucun index de plus: il ne servirait a rien et
-- ralentirait les deux ecritures.

alter table group_mute enable row level security;

-- Un seul chemin, le sien. Pas de vue partagee, pas de fonction d agregat,
-- rien qui passe par is_member(): un membre n a pas a savoir qui l a coupe.
drop policy if exists group_mute_all on group_mute;
create policy group_mute_all on group_mute for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

notify pgrst, 'reload schema';

-- Verifier apres avoir passe ce fichier:
--   -- la table doit exister et etre vide
--   select count(*) from group_mute;
--
--   -- et RLS doit etre active, avec exactement une politique
--   select relrowsecurity from pg_class where relname = 'group_mute';
--   select polname, pg_get_expr(polqual, polrelid) as lecture
--     from pg_policy where polrelid = 'group_mute'::regclass;
--   -- lecture doit etre (user_id = auth.uid()), sans aucun mot de groupe
