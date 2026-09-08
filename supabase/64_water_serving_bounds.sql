-- ============================================================================
-- Rich & Friends, migration 64: une bouteille a le droit de faire 40 oz
--
-- Run after 63. Safe to re-run.
--
-- L'ERREUR VUE A L'ECRAN
--
--   new row for relation "notify_pref" violates check constraint
--   "notify_pref_water_glass_ml_check"
--
-- Sur l'ecran des reglages, en essayant d'enregistrer la contenance d'une
-- bouteille. Rien ne s'enregistrait, donc ni l'unite ni la taille, donc l'ecran
-- restait en millilitres et la fonction avait l'air de ne pas exister.
--
-- DEUX BORNES QUI NE SE PARLAIENT PLUS
--
-- 57_reminders.sql pose `check (water_glass_ml between 50 and 1000)`. Ce
-- plafond etait juste quand la colonne contenait un VERRE: mille millilitres
-- de verre, c'est deja un pichet.
--
-- La migration 63 a change ce que la colonne veut dire, pas ses bornes. Elle y
-- met desormais la contenance de ce dans quoi on boit, et une bouteille de
-- 40 oz fait 1183 ml. src/lib/units.js a ete ecrit avec MAX_SERVING_ML = 2000
-- et la base est restee a 1000: deux bornes qui ne sont pas d'accord, et c'est
-- toujours celle qu'on ne voit pas qui gagne.
--
-- 2000 ml, soit 68 oz, couvre les grandes gourdes et les bouteilles de deux
-- litres. Le plancher reste a 50: en dessous ce n'est plus une gorgee notee,
-- c'est une faute de frappe.
--
-- LE CLIENT BORNE AUSSI, MAINTENANT
--
-- L'ecran envoyait ce qui etait tape sans le ramener dans les bornes, donc
-- taper 40 pendant que l'unite etait encore en millilitres envoyait 40 ml,
-- sous le plancher, et la base refusait. C'est corrige dans
-- ReminderSettings.jsx avec safeServing(). Cette migration reste necessaire
-- quand meme: borner en deux endroits est ce qui fait qu'une valeur juste
-- passe et qu'une valeur folle est refusee deux fois plutot que zero.
-- ============================================================================

alter table notify_pref
  drop constraint if exists notify_pref_water_glass_ml_check;

alter table notify_pref
  add constraint notify_pref_water_glass_ml_check
  check (water_glass_ml between 50 and 2000);

comment on column notify_pref.water_glass_ml is
  'Contenance de ce dans quoi la personne boit (verre, bouteille), en millilitres, entre 50 et 2000. Le nom dit verre pour raisons historiques; voir la migration 63.';

notify pgrst, 'reload schema';

-- Verifier apres avoir passe ce fichier:
--   -- une bouteille de 40 oz doit passer:
--   select 1183 between 50 and 2000 as bouteille_40oz_acceptee;
--   -- et la contrainte doit porter la nouvelle borne:
--   select pg_get_constraintdef(oid) from pg_constraint
--    where conname = 'notify_pref_water_glass_ml_check';
