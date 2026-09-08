-- ============================================================================
-- Rich & Friends, migration 63: l'eau se note dans l'unite de ta bouteille
--
-- Run after 62. Safe to re-run.
--
-- LA DEMANDE
--
--   "Je ne bois pas de verre d'eau. J'ai une bouteille d'eau qui fait 40 oz.
--    Donc je ne suivais pas vraiment avec la notation en verres combien je
--    bois. Je viens d'ouvrir ma calculatrice et j'ai fait le calcul de ma
--    cible d'eau moins l'eau que je bois dans ma bouteille."
--
-- Ouvrir une calculatrice pour savoir ou on en est, c'est l'application qui
-- n'a pas fait son travail.
--
-- UNE SEULE COLONNE, ET C'EST VOULU
--
-- water_log.ml et notify_pref.water_target_ml restent en MILLILITRES, et tout
-- le calcul du rythme continue de tourner en millilitres. L'unite ne change
-- que ce qui est ecrit a l'ecran et ce qui est tape dans un champ.
--
-- C'est la seule facon de ne pas casser l'historique. Stocker l'unite avec
-- chaque ligne de water_log aurait donne une table ou additionner deux lignes
-- demande d'abord de les convertir, et quelqu'un qui a note six mois en ml
-- puis passe aux onces doit voir ses six mois CONVERTIS, pas reinterpretes.
--
-- water_glass_ml GARDE SON NOM
--
-- Il contient desormais la contenance de ce dans quoi on boit, verre ou
-- bouteille, toujours en millilitres. Le renommer aurait demande de reecrire
-- chaque lecture cliente en meme temps que la colonne change de nom, sur une
-- base que personne ne peut migrer depuis un iPad si ca se passe mal. Le nom
-- est un peu faux, les donnees sont justes, et ce commentaire est la pour que
-- la prochaine lecture ne s'y trompe pas.
-- ============================================================================

alter table notify_pref
  add column if not exists water_unit text not null default 'ml';

-- La contrainte a part, et posee seulement si elle manque: `add constraint`
-- echoue sur une base ou ce fichier a deja tourne, et un fichier de migration
-- qui ne supporte pas d'etre repasse est un fichier qu'on n'ose plus lancer.
do $$
begin
  alter table notify_pref
    add constraint notify_pref_water_unit_check check (water_unit in ('ml', 'oz'));
exception
  when duplicate_object then null;
end $$;

comment on column notify_pref.water_unit is
  'Unite d affichage et de saisie de l eau: ml ou oz. Le stockage reste en millilitres partout.';

comment on column notify_pref.water_glass_ml is
  'Contenance de ce dans quoi la personne boit (verre, bouteille), en millilitres. Le nom dit verre pour raisons historiques.';

-- ---------------------------------------------------------------------------
-- LA FONCTION PLANIFIEE DOIT CONNAITRE L'UNITE.
--
-- Sans elle, la notification de 10h annonce "il reste 800 ml" a quelqu'un qui
-- pense en onces, ce qui est la calculatrice reouverte sur l'ecran de
-- verrouillage: exactement le probleme que cette migration existe pour
-- supprimer.
--
-- DROP puis CREATE, et pas CREATE OR REPLACE: Postgres refuse de remplacer une
-- fonction dont le type de retour change, et ajouter une colonne a un
-- `returns table` change le type de retour. Le DROP est conditionnel pour que
-- le fichier se repasse.
-- ---------------------------------------------------------------------------
drop function if exists due_water_reminders(timestamptz, timestamptz);

create function due_water_reminders(win_start timestamptz, win_end timestamptz)
returns table (
  user_id      uuid,
  tz           text,
  target_ml    int,
  glass_ml     int,
  water_unit   text,
  wake_min     int,
  sleep_min    int,
  drunk_ml     int,
  local_day    date,
  local_min    int,
  ref          text
)
language sql
stable
security definer
set search_path = public
as $$
  with due as (
    select
      p.user_id,
      coalesce(pr.timezone, 'UTC') as tz,
      p.water_target_ml as target_ml,
      p.water_glass_ml  as glass_ml,
      coalesce(p.water_unit, 'ml') as water_unit,
      p.wake_min,
      p.sleep_min,
      (p.water_next_at at time zone coalesce(pr.timezone, 'UTC'))::date as local_day,
      (extract(hour   from p.water_next_at at time zone coalesce(pr.timezone, 'UTC'))::int * 60
       + extract(minute from p.water_next_at at time zone coalesce(pr.timezone, 'UTC'))::int) as local_min
    from notify_pref p
    join profiles pr on pr.id = p.user_id
    where p.water_on
      and p.water_next_at is not null
      /* `< win_end` et pas `between`: un rappel en retard, parce que la
         fonction n'a pas tourne pendant vingt minutes, doit partir au tour
         suivant plutot que d'etre saute en silence. */
      and p.water_next_at < win_end
  )
  select
    d.user_id,
    d.tz,
    d.target_ml,
    d.glass_ml,
    d.water_unit,
    d.wake_min,
    d.sleep_min,
    coalesce((
      select sum(w.ml)::int from water_log w
      where w.user_id = d.user_id and w.on_day = d.local_day
    ), 0) as drunk_ml,
    d.local_day,
    d.local_min,
    d.local_day::text || ':' || to_char(make_interval(mins => d.local_min), 'HH24:MI') as ref
  from due d
  /* Reveille. Les deux bornes egales veulent dire toute la journee, et une
     fenetre qui traverse minuit se lit avec un OR: c'est la meme regle que
     isAwake() dans src/lib/reminders.js. */
  where (
    d.wake_min = d.sleep_min
    or (d.wake_min < d.sleep_min and d.local_min >= d.wake_min and d.local_min < d.sleep_min)
    or (d.wake_min > d.sleep_min and (d.local_min >= d.wake_min or d.local_min < d.sleep_min))
  )
  and not exists (
    select 1 from reminder_log rl
    where rl.user_id = d.user_id and rl.kind = 'water'
      and rl.ref = d.local_day::text || ':' || to_char(make_interval(mins => d.local_min), 'HH24:MI')
  )
$$;

revoke all on function due_water_reminders(timestamptz, timestamptz) from public, anon, authenticated;

notify pgrst, 'reload schema';

-- Verifier apres avoir passe ce fichier:
--   select water_unit, water_glass_ml, water_target_ml from notify_pref;
--   select user_id, water_unit, target_ml, drunk_ml from due_water_reminders(now(), now() + interval '1 hour');
