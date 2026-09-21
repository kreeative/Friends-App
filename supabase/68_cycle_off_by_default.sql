-- ============================================================================
-- Rich & Friends, migration 68: le suivi du cycle est eteint par defaut
--
-- Run after 67. Safe to re-run.
--
-- LA DEMANDE
--
--   "Rappelle-toi: seulement chez les femmes."
--
-- CE QUI FUYAIT, ET POURQUOI PERSONNE NE POUVAIT LE VOIR
--
-- Le code client est deja strict. cycleForGender() dans src/lib/setup.js rend
-- true pour 'woman' et pour personne d'autre, et son commentaire dit pourquoi:
-- "a man does not get a period tracker, which is the point of asking".
--
-- Mais 56_setup.sql a pose la colonne ainsi:
--
--   alter table profiles add column if not exists cycle_on boolean not null
--     default true;
--
-- `default true`. Toute ligne creee AVANT cette migration a donc recu true sans
-- que personne ne l'ait choisi, et setupPatch ne corrige que les gens qui
-- refont la configuration. Mesure dans Chromium: un profil gender='man',
-- cycle_on=true voit le bouton "Mon cycle", la couche Cycle du calendrier et
-- "Mes regles" sous "+ Ajouter".
--
-- Un suivi menstruel allume par defaut pour tout le monde n'est pas un reglage
-- trop genereux, c'est l'application qui decide a la place de la personne sur
-- la donnee la plus intime qu'elle detient.
--
-- CE QUE LE RATTRAPAGE NE TOUCHE PAS
--
-- Personne qui a DEJA note quelque chose. Une ligne dans cycle_log ou cycle_day
-- est une preuve d'usage, et eteindre le suivi de quelqu'un qui s'en sert
-- serait remplacer une erreur par une pire. La condition `not exists` est la
-- pour ca, et elle passe avant la question du genre.
--
-- Ni les femmes. gender = 'woman' est exactement le cas ou true est la bonne
-- reponse, que la personne l'ait choisi ou herite du defaut.
--
-- Reste donc: les hommes, les 'other' et les comptes ou la question n'a jamais
-- ete posee, qui n'ont jamais rien note. Ceux-la retrouvent le suivi en une
-- touche depuis leur profil s'ils le veulent, et ce commutateur n'est pas un
-- lot de consolation: c'est la seule bonne reponse a une question que
-- l'application ne peut pas deviner.
--
-- RIEN N'EST SUPPRIME
--
-- cycle_on ne fait qu'allumer ou eteindre un ecran. Aucune ligne de cycle_log
-- ni de cycle_day n'est touchee par ce fichier, et rallumer le suivi rend tout
-- ce qui etait la.
-- ============================================================================

-- 1. Le defaut, pour tout ce qui sera cree apres.
alter table profiles alter column cycle_on set default false;

-- 2. Et les lignes qui portent un true que personne n'a choisi.
update profiles p
   set cycle_on = false
 where p.cycle_on
   and p.gender is distinct from 'woman'
   and not exists (select 1 from cycle_log  c where c.user_id = p.id)
   and not exists (select 1 from cycle_day  d where d.user_id = p.id);

notify pgrst, 'reload schema';

-- Verifier apres avoir passe ce fichier:
--   -- le defaut doit etre false
--   select column_default from information_schema.columns
--    where table_name = 'profiles' and column_name = 'cycle_on';
--
--   -- et il ne doit plus rester personne d'allume sans raison
--   select gender, count(*) from profiles
--    where cycle_on group by gender order by 2 desc;
