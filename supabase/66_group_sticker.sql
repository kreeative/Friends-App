-- ============================================================================
-- Rich & Friends, migration 66: un groupe peut choisir son image
--
-- Run after 65. Safe to re-run.
--
-- LA DEMANDE
--
--   "Update the sticker for this group."
--
-- CE QUI EXISTAIT, ET POURQUOI CA NE SUFFISAIT PLUS
--
-- L'image d'un groupe etait CALCULEE a partir de son identifiant, dans
-- stickerFor() de src/lib/art.js. Le commentaire de cette fonction disait deja
-- ou etait la limite, mot pour mot:
--
--   "This is deliberately not a stored assignment: the cost is that adding art
--    can reshuffle which group shows which sticker [...] If a group ever needs
--    to *own* its artwork, that is a column, not a change here."
--
-- Voila la colonne. Le calcul reste, comme defaut: un groupe qui n'a rien
-- choisi garde une image stable sans que personne ait eu a la choisir, et rien
-- n'est a remplir retroactivement.
--
-- PAS DE CONTRAINTE SUR LA VALEUR
--
-- La colonne porte un NOM de fichier, et le dossier des stickers change: on en
-- ajoute, on en renomme, on vient d'en remplacer vingt-trois. Une contrainte
-- qui listerait les noms valides devrait etre repassee a chaque changement
-- d'illustration, et le jour ou on l'oublierait elle refuserait une image qui
-- existe.
--
-- Le client fait le travail dans l'autre sens: un nom qui ne correspond plus a
-- aucun fichier retombe sur l'image calculee, comme une liste de stickers
-- filtree retombe sur ce qui existe. Voir chooseSticker() dans
-- src/lib/stickerPick.js.
--
-- Seule la longueur est bornee, parce qu'un nom de fichier n'a aucune raison
-- de faire trois kilo-octets.
--
-- QUI PEUT LA CHANGER
--
-- Rien a ajouter. groups_update est deja `is_group_admin(id)` des deux cotes,
-- using et with check, donc les admins et le createur peuvent ecrire cette
-- colonne comme ils ecrivent deja le nom et le rythme. Une politique de plus
-- pour une colonne de decoration elargirait l'acces a la table pour rien.
-- ============================================================================

alter table groups
  add column if not exists sticker text;

alter table groups
  drop constraint if exists groups_sticker_check;

alter table groups
  add constraint groups_sticker_check
  check (sticker is null or length(sticker) between 1 and 40);

comment on column groups.sticker is
  'Le nom de fichier du sticker choisi pour ce groupe, sans le .png. NULL = image calculee a partir de l id, ce qui est le defaut. Aucun controle sur la valeur ici: le dossier des illustrations change, et un nom devenu faux retombe sur l image calculee cote client.';

notify pgrst, 'reload schema';

-- Verifier apres avoir passe ce fichier:
--   select id, name, sticker from groups;
--   -- la colonne doit exister et valoir NULL partout, personne n a encore choisi
