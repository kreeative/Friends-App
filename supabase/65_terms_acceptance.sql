-- ============================================================================
-- Rich & Friends, migration 65: accepter les conditions, et savoir qui l'a fait
--
-- Run after 64. Safe to re-run.
--
-- LA DEMANDE
--
--   "When the user installs the app for the first time they should accept the
--    terms and conditions, work on that too. Every existing user should also
--    have a pop up so they could go and accept."
--
-- Les textes existent depuis longtemps et sont servis a /legal/terms,
-- /legal/privacy et /legal/notice, dans les deux langues. Ce qui manquait
-- n'etait pas le texte, c'etait la TRACE: personne n'avait jamais rien
-- accepte, et l'application n'avait aucun moyen de le dire.
--
-- POURQUOI UNE DATE ET UNE VERSION, PAS UN BOOLEEN
--
-- Un booleen repond "oui", ce qui ne vaut rien le jour ou quelqu'un demande a
-- quoi la personne a dit oui. Une acceptation est un fait date, et les textes
-- changent: LAST_UPDATED vit dans src/legal/content.js et vaut aujourd'hui
-- '2026-08-04'.
--
-- Garder la version acceptee est ce qui permettra, le jour ou les conditions
-- changent vraiment, de redemander a ceux qui ont accepte l'ancienne et a
-- personne d'autre. Sans elle, le choix serait entre ne jamais redemander et
-- redemander a tout le monde a chaque correction de virgule.
--
-- CE QUE CETTE MIGRATION NE FAIT PAS
--
-- Elle ne remplit rien retroactivement. Aucune ligne existante ne recoit de
-- date: personne n'a accepte, donc la colonne dit null, et c'est exactement ce
-- qui declenche l'ecran d'acceptation au prochain lancement. Ecrire une date
-- pour les comptes existants serait inventer un consentement, ce qui est la
-- seule chose que ce fichier ne doit surtout pas faire.
-- ============================================================================

alter table profiles
  add column if not exists terms_accepted_at timestamptz;

alter table profiles
  add column if not exists terms_version text;

comment on column profiles.terms_accepted_at is
  'Quand la personne a accepte les conditions. NULL = jamais accepte, ce qui declenche l ecran d acceptation. Jamais rempli retroactivement.';

comment on column profiles.terms_version is
  'La version des textes acceptee, soit LAST_UPDATED de src/legal/content.js. Permet de ne redemander qu a ceux qui ont accepte une version anterieure.';

-- Les politiques de profiles couvrent deja ces colonnes: profiles_update est
-- `id = auth.uid()`, donc chacun ecrit la sienne et celle de personne d'autre.
-- Rien a ajouter, et surtout pas une politique de plus qui elargirait l'acces
-- a la table pour deux colonnes.

notify pgrst, 'reload schema';

-- Verifier apres avoir passe ce fichier:
--   select count(*) filter (where terms_accepted_at is null) as a_demander,
--          count(*) filter (where terms_accepted_at is not null) as acceptes
--     from profiles;
