-- ============================================================================
-- Rich & Friends, migration 58: une notification a l'heure choisie, par objectif
--
-- Run after 57. Safe to re-run.
--
-- CE QUI A ETE DEMANDE
--
--   "Per-goal independent notification reminders: a toggle, a frequency, and a
--    preferred time of day for the push."
--
-- POURQUOI IL N'Y A PAS DE COLONNE "FREQUENCE"
--
-- L'objectif a deja la sienne: cadence (ponctuel ou recurrent), active_days,
-- target_per_cycle, starts_on, ends_on. Un rappel qui aurait un calendrier a
-- lui contredirait celui de l'objectif: "rappelle-moi le lundi" sur un objectif
-- du mardi. Donc la seule question neuve est l'heure, et le rappel part les
-- jours ou l'objectif est du, selon les memes regles que l'ecran du point
-- (src/lib/schedule.js, isDueOn).
--
-- Le booleen `remind` qui existe deja reste la porte: il gouverne le recap du
-- soir et, maintenant, cette notification. L'heure est un detail derriere
-- lui. Null veut dire "pas de notification horaire, seulement le recap", ce
-- qui est l'etat de tous les objectifs existants le jour de la migration.
-- ============================================================================

alter table goals
  add column if not exists remind_at_min int
  check (remind_at_min is null or remind_at_min between 0 and 1439);

-- Le journal des envois connait une troisieme sorte. La contrainte est
-- recreee plutot qu'ajoutee: un check ne se modifie pas en place.
alter table reminder_log drop constraint if exists reminder_log_kind_check;
alter table reminder_log
  add constraint reminder_log_kind_check check (kind in ('water', 'event', 'goal'));

-- ---------------------------------------------------------------------------
-- Les rappels d'objectif a envoyer dans une fenetre.
--
-- Meme forme que due_event_reminders: la date locale de la personne vient de
-- son fuseau, l'instant du rappel est construit en heure locale puis ramene
-- en UTC, et le plafond est porte par la cle primaire de reminder_log.
--
-- "Du aujourd'hui" reprend isDueOn:
--   recurrent  starts_on <= jour <= ends_on (ou pas de fin), et le jour de la
--              semaine est dans active_days (ou active_days est null: tous)
--   ponctuel   sans echeance: toujours du; avec: la semaine qui la precede,
--              echeance comprise, comme l'ecran du point
--
-- Objectifs personnels seulement (owner_id non null). Un objectif de groupe
-- n'a pas UNE personne a reveiller a UNE heure; il passe par le recap.
-- ---------------------------------------------------------------------------
create or replace function due_goal_reminders(win_start timestamptz, win_end timestamptz)
returns table (
  user_id      uuid,
  goal_id      uuid,
  commitment   text,
  trigger_when text,
  trigger_where text,
  on_day       date,
  fire_at      timestamptz,
  ref          text
)
language sql
stable
security definer
set search_path = public
as $$
  with candidate as (
    select
      g.owner_id as user_id,
      g.id as goal_id,
      g.commitment,
      g.trigger_when,
      g.trigger_where,
      g.cadence,
      g.active_days,
      g.starts_on,
      g.ends_on,
      g.due_on,
      g.remind_at_min,
      coalesce(pr.timezone, 'UTC') as tz,
      d::date as on_day
    from goals g
    join profiles pr on pr.id = g.owner_id
    left join notify_pref p on p.user_id = g.owner_id
    cross join lateral generate_series(
      ((win_start at time zone coalesce(pr.timezone, 'UTC'))::date - 1),
      ((win_end   at time zone coalesce(pr.timezone, 'UTC'))::date + 1),
      interval '1 day'
    ) as d
    where g.status = 'active'
      and g.owner_id is not null
      and g.remind
      and g.remind_at_min is not null
      /* Un seul interrupteur pour couper tous les push d'un coup, celui des
         reglages. events_on est le meme interrupteur que pour l'agenda. */
      and coalesce(p.events_on, true)
  ),
  due as (
    select
      c.*,
      ((c.on_day + make_interval(mins => c.remind_at_min)) at time zone c.tz) as fire_at
    from candidate c
    where c.on_day >= c.starts_on
      and (c.ends_on is null or c.on_day <= c.ends_on)
      and (
        (c.cadence = 'recurring'
          and (c.active_days is null
               or coalesce(array_length(c.active_days, 1), 0) = 0
               or extract(dow from c.on_day)::int = any(c.active_days)))
        or
        (c.cadence = 'once'
          and (c.due_on is null or c.on_day between c.due_on - 7 and c.due_on))
      )
  )
  select
    d.user_id, d.goal_id, d.commitment, d.trigger_when, d.trigger_where,
    d.on_day, d.fire_at,
    d.goal_id::text || ':' || d.on_day::text as ref
  from due d
  where d.fire_at >= win_start
    and d.fire_at <  win_end
    and not exists (
      select 1 from reminder_log rl
      where rl.user_id = d.user_id and rl.kind = 'goal'
        and rl.ref = d.goal_id::text || ':' || d.on_day::text
    )
  order by d.fire_at
$$;

revoke all on function due_goal_reminders(timestamptz, timestamptz) from public, anon, authenticated;

-- Verifier apres avoir passe ce fichier:
--   select * from due_goal_reminders(now(), now() + interval '1 hour');
