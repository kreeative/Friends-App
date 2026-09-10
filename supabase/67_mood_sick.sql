-- ============================================================================
-- Rich & Friends, migration 67: une dix-huitieme humeur, malade
--
-- Run after 66. Safe to re-run.
--
-- POURQUOI CE FICHIER N'EST PAS OPTIONNEL
--
-- C'est exactement la situation que 48_moods_sad_discouraged.sql decrit, et
-- elle echoue de la pire des facons sans lui:
--
--   36_daily_moods_array.sql a pose une contrainte sur daily_mood.moods qui
--   NOMME les humeurs acceptees, et une borne sur leur nombre. 48 l'a elargie a
--   dix-sept. Le client en offre maintenant dix-huit.
--
--   Sans ce fichier, toucher le nouveau visage a l'air parfaitement normal,
--   l'upsert est refuse par la contrainte, et MoodToday n'a rien a montrer:
--   les humeurs que l'application connait et celles que la base accepte ne sont
--   pas d'accord, et la personne qui a touche est la derniere a l'apprendre.
--
-- LE NOMBRE COMPTE AUTANT QUE LA LISTE
--
-- `<= 17` refuserait quelqu'un qui les prend toutes les dix-huit alors que
-- chacune est dans la liste: la meme panne, arrivee une touche plus tard.
--
-- POURQUOI `mood` N'EST TOUJOURS PAS CONTRAINTE
--
-- Meme raison que 36 et 48. La colonne simple n'a jamais eu de check, une annee
-- de lignes est passee dedans, et en ajouter un maintenant ferait echouer cette
-- migration chez quiconque detient une valeur que la liste a oubliee. Elle
-- porte celle qui represente les autres, et cleanMoods dans src/lib/moods.js
-- laisse tomber ce qu'il ne reconnait pas en chemin vers l'ecran.
--
-- RIEN N'EST REMPLI NI MIGRE
--
-- Aucune ligne existante ne peut porter 'sick': jusqu'a ce deploiement aucun
-- client ne pouvait l'ecrire. C'est une contrainte elargie, d'ou trois
-- instructions plutot que la danse prudente qu'il a fallu a 36.
-- ============================================================================

alter table daily_mood drop constraint if exists daily_mood_moods_check;
alter table daily_mood add constraint daily_mood_moods_check check (
  moods <@ array[
    'joyful', 'grateful', 'energized', 'serene',
    'excited', 'sensitive', 'neutral', 'nostalgic',
    'confused', 'bored', 'sad', 'discouraged',
    'stressed', 'angry', 'insecure', 'hurt', 'guilty',
    'sick'
  ]::text[]
  and coalesce(array_length(moods, 1), 0) <= 18
);

notify pgrst, 'reload schema';

-- Verifier apres avoir passe ce fichier:
--   -- doit rendre true
--   select array['sick']::text[] <@ array[
--     'joyful','grateful','energized','serene','excited','sensitive','neutral',
--     'nostalgic','confused','bored','sad','discouraged','stressed','angry',
--     'insecure','hurt','guilty','sick']::text[];
--
--   -- et la contrainte telle que la base la detient maintenant:
--   select pg_get_constraintdef(oid)
--     from pg_constraint
--    where conname = 'daily_mood_moods_check';
