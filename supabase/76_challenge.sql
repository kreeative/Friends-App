-- ============================================================================
-- Rich & Friends, migration 76: le defi 21 matins
--
-- Run after 75. Safe to re-run. Run it BEFORE creating the challenge group:
-- the "Defi 21 matins" button in the app calls create_challenge(), which is
-- defined here, and says so plainly when it is missing.
--
-- LA DEMANDE
--
--   "Let's take a 21 days challenge of Miracle Morning. Here's how you can
--    join the group. And then basically when they're gonna join, all the
--    objectives are gonna be there in the to-do list. And then ask them if
--    they woke up, drink water, went to the gym, whatever."
--
-- Un groupe quotidien, cree avec ses objectifs du matin deja dedans. Ce sont
-- des objectifs de GROUPE (kind = 'group', owner_id null): chaque membre les a
-- dans sa liste des qu'il entre, et la carte du jour les lui pose un par un.
-- Rien a copier a l'arrivee, donc rien qui puisse manquer a quelqu'un.
--
-- 21 JOURS PAR PERSONNE, PAS UNE DATE COMMUNE.
--
-- Une video circule pendant des semaines. Avec une date de fin commune,
-- quelqu'un qui arrive au jour 15 aurait six jours de defi. Les objectifs
-- n'ont donc pas de fin, et l'app compte les 21 jours de chacun depuis son
-- arrivee (group_members.joined_at). Voir src/lib/challenge.js.
--
-- LE TEXTE DES OBJECTIFS VIENT DE L'APP.
--
-- Il est dans la langue de la personne qui cree le groupe, avec ses accents,
-- et vit dans src/content/challenge.js. Ce fichier reste en ASCII: il passe
-- par un presse-papiers, et de l'UTF-8 abime en route donne une erreur qui
-- montre le mauvais endroit.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Quel defi, sur le groupe.
--
-- null pour tous les groupes ordinaires. Le lien d'invitation d'un groupe defi
-- mene a la page du defi, et le tableau affiche "Jour N sur 21".
-- ---------------------------------------------------------------------------
alter table groups add column if not exists challenge text;

alter table groups drop constraint if exists groups_challenge_check;
alter table groups add constraint groups_challenge_check
  check (challenge is null or challenge in ('morning21'));


-- ---------------------------------------------------------------------------
-- 2. create_challenge(): le groupe et ses objectifs, d'un seul coup.
--
-- Une seule transaction. Trois appels depuis l'app (creer, ajouter, marquer)
-- pouvaient laisser un groupe defi sans objectifs, ou des objectifs dans un
-- groupe ordinaire, au premier reseau qui coupe.
--
-- Quotidien: cadence 1, ouvert de minuit a minuit dans le fuseau du groupe.
--
-- LA PREMIERE PERIODE EST AUJOURD'HUI.
--
-- ensure_cycles (migration 18) ancre la premiere periode sur le dernier
-- checkin_dow. La premiere version passait 0, dimanche: le groupe defi cree
-- en production un jeudi est ne avec quatre periodes deja passees (du
-- dimanche au mercredi). tick() les ferme a son passage suivant, et deux
-- periodes manquees de suite font une relance "tout va bien ?" contre la
-- personne qui vient de creer le groupe, visible par tous ceux qui
-- rejoignent. Le jour de controle est donc le jour meme, dans le fuseau du
-- groupe: l'ancre tombe sur aujourd'hui a minuit, et rien n'est dans le passe.
--
-- POURQUOI 'paused' PUIS 'active'.
--
-- Le declencheur goals_notify_group (migrations 50 et 61) previent chaque
-- membre a l'insertion d'un objectif de groupe actif. A la creation, le seul
-- membre est la personne qui cree le groupe: elle recevrait huit
-- notifications pour huit objectifs qu'elle vient de poser elle-meme. Le
-- declencheur ne regarde que l'insertion, donc on insere en pause et on
-- active juste apres.
--
-- L'ordre est garde: created_at avance d'une milliseconde par objectif, et
-- l'app trie sur created_at. Sans ca, huit lignes au meme instant sortent
-- dans un ordre quelconque, et "Me lever" peut arriver apres "Ecrire".
-- ---------------------------------------------------------------------------
create or replace function create_challenge(
  p_name      text,
  p_timezone  text,
  p_challenge text,
  p_goals     jsonb
)
returns groups
language plpgsql
security definer
set search_path = public
as $$
declare
  g     groups%rowtype;
  n     int;
  tz    text;
  today date;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_challenge is null or p_challenge not in ('morning21') then
    raise exception 'unknown_challenge';
  end if;
  if p_goals is null or jsonb_typeof(p_goals) <> 'array' then
    raise exception 'goals_required';
  end if;
  n := jsonb_array_length(p_goals);
  if n < 1 or n > 12 then
    raise exception 'goals_count';
  end if;

  tz := coalesce(nullif(trim(p_timezone), ''), 'UTC');
  g := create_group(p_name, tz, 1, extract(dow from (now() at time zone tz))::int, 0, 24);

  update groups set challenge = p_challenge where id = g.id
  returning * into g;

  today := (now() at time zone g.timezone)::date;

  insert into goals (group_id, owner_id, kind, commitment, goal_type, cadence,
                     target_per_cycle, starts_on, proof_type, status,
                     created_by, created_at)
  select g.id, null, 'group',
         left(trim(e.value ->> 'commitment'), 200),
         'process', 'recurring', 1, today,
         case when e.value ->> 'proof_type' in ('photo', 'link', 'text', 'none')
              then e.value ->> 'proof_type' else 'none' end,
         'paused',
         auth.uid(),
         now() + (e.ord * interval '1 millisecond')
    from jsonb_array_elements(p_goals) with ordinality as e(value, ord);

  update goals set status = 'active'
   where group_id = g.id and kind = 'group' and status = 'paused';

  return g;
end;
$$;

revoke all on function create_challenge(text, text, text, jsonb) from public;
revoke all on function create_challenge(text, text, text, jsonb) from anon;
grant execute on function create_challenge(text, text, text, jsonb) to authenticated;


notify pgrst, 'reload schema';


-- ---------------------------------------------------------------------------
-- Checks. Run these after the file; each should return what its comment says.
-- ---------------------------------------------------------------------------
-- The column, and its one allowed value (one row, morning21 in the check):
--   select column_name from information_schema.columns
--    where table_name = 'groups' and column_name = 'challenge';
--
-- The function (one row):
--   select proname from pg_proc where proname = 'create_challenge';
--
-- After creating the challenge in the app, its goals in order (eight rows):
--   select commitment, status from goals
--    where group_id = (select id from groups where challenge = 'morning21'
--                       order by created_at desc limit 1)
--    order by created_at;
