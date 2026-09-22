-- ============================================================================
-- Les sept couleurs du calendrier deviennent une famille a elles, en pastel.
--
-- A passer apres la 69. Rejouable sans risque.
--
-- POURQUOI C'EST UNE MIGRATION ET PAS SEULEMENT DU CSS.
--
--   "I don't like the colors, they should be tones that match the pink, like
--    pastel."
--
-- Elle a raison et la cause est ici autant que dans la feuille de style. La
-- 53 avait donne sept reponses differentes en piochant dans les jetons que
-- l'application avait deja: 'field' est le jaune des grands blocs, 'ink' est
-- le noir du texte, 'negative' est le rouge des erreurs. Sept categories
-- distinctes, oui, mais trois couleurs empruntees a trois systemes differents.
--
-- Sur un mois entier ca se voit: "WORK" revient cinq fois par semaine, donc un
-- quart de la grille etait du jaune sature, et les examens des dalles noires.
--
-- Les sept ont maintenant leur propre famille, --c-ev-*, sept pastels d'une
-- meme clarte autour du rose du theme, avec une version foncee pour ce qui
-- doit tenir 3:1. Les valeurs sont dans src/index.css avec le raisonnement.
--
-- LES ANCIENS NOMS RESTENT DANS LA CONTRAINTE, ET C'EST DELIBERE.
--
-- Deux raisons. D'abord l'ordre des operations: retirer les anciens AVANT
-- l'UPDATE ferait echouer l'UPDATE sur sa propre contrainte, puisque les
-- lignes portent encore les anciennes valeurs au moment ou il s'execute.
--
-- Ensuite le deploiement: la base et le navigateur ne changent pas a la meme
-- seconde. Entre la migration et le rechargement de l'onglet, une version du
-- client qui ne connait que les anciens noms continue d'ecrire; et les tables
-- de rendu gardent les anciennes entrees pour qu'une ligne ecrite dans cet
-- intervalle se peigne quand meme. Sans ca elle se peindrait TRANSPARENTE,
-- ce qui est la faute exacte que raconte la note de CATEGORY_COLOUR: une
-- pastille plausible sur une capture, mesuree a 1:1 contre la case derriere.
--
-- UN JETON, PAS UNE COULEUR. Meme regle que la 53 et elle vaut deux fois ici:
-- 'ev-cours' vaut un rose en soleil et un bleu poudre en mer. Un hexadecimal
-- stocke serait juste sur exactement un des deux themes.
-- ============================================================================

alter table calendar_event drop constraint if exists calendar_event_colour_check;

alter table calendar_event
  add constraint calendar_event_colour_check
  check (colour in (
    'ev-cours', 'ev-examen', 'ev-etude', 'ev-travail',
    'ev-evenement', 'ev-perso', 'ev-sante',
    'accent', 'green', 'quiet', 'ink', 'negative', 'field',
    'cat-1', 'cat-2', 'cat-3', 'cat-4', 'cat-5', 'cat-6'
  ));

-- ---------------------------------------------------------------------------
-- Repeindre ce qui est deja stocke.
--
-- Sans ca, la nouvelle palette ne vaudrait que pour les evenements crees a
-- partir de maintenant, et un emploi du temps entre au debut du semestre
-- resterait jaune et noir. Ce n'est pas un correctif.
--
-- Seules les lignes encore sur la couleur par DEFAUT DE LEUR CATEGORIE sont
-- touchees, exactement comme la 53. Quelqu'un qui a volontairement mis une
-- autre couleur sur un evenement la garde: la colonne existe pour etre
-- surchargee, et ceci est un repeint, pas une remise a zero.
-- ---------------------------------------------------------------------------
update calendar_event set colour = 'ev-cours'     where category = 'cours'     and colour = 'cat-1';
update calendar_event set colour = 'ev-examen'    where category = 'examen'    and colour = 'ink';
update calendar_event set colour = 'ev-etude'     where category = 'etude'     and colour = 'cat-4';
update calendar_event set colour = 'ev-travail'   where category = 'travail'   and colour = 'field';
update calendar_event set colour = 'ev-evenement' where category = 'evenement' and colour = 'negative';
update calendar_event set colour = 'ev-perso'     where category = 'perso'     and colour = 'green';
update calendar_event set colour = 'ev-sante'     where category = 'sante'     and colour = 'quiet';

notify pgrst, 'reload schema';

-- Verification:
--   -- plus rien sur les anciens noms par defaut:
--   select category, colour, count(*) from calendar_event group by 1, 2 order by 1;
--
--   -- les nouveaux sont acceptes:
--   update calendar_event set colour = 'ev-cours' where category = 'cours';
--
--   -- une couleur inventee ne l'est toujours pas:
--   update calendar_event set colour = 'chartreuse' where category = 'cours';
--   -- doit echouer sur calendar_event_colour_check
