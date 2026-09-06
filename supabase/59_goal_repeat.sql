-- ============================================================================
-- Rich & Friends, migration 59: repeter la notification d'un objectif
--
-- Run after 58. Safe to re-run.
--
-- CE QUI A ETE DEMANDE
--
--   "An option for the frequency of the notification?"
--
--   C'est la deuxieme moitie de la toute premiere demande sur les rappels:
--   "chaque personne peut choisir a quelle heure OU A QUELLE FREQUENCE dans
--   la journee il veut recevoir une notification". 58 a repondu a l'heure.
--   Ceci repond a la frequence.
--
-- CE QUE "FREQUENCE" VEUT DIRE ICI, ET CE QU'ELLE NE VEUT PAS DIRE
--
--   Pas un calendrier a part. Les jours restent ceux de l'objectif, pour la
--   raison ecrite dans 58: un rappel qui aurait ses propres jours finirait
--   par contredire ceux de l'objectif.
--
--   Une repetition DANS la journee: a partir de l'heure choisie, toutes les
--   N minutes, jusqu'a ce que l'objectif soit coche, et jamais apres le
--   coucher des reglages. Null veut dire une seule fois, ce qui est l'etat de
--   tous les objectifs existants le jour de la migration.
--
-- "COCHE", POUR UN OBJECTIF PERSONNEL
--
--   goal_days (migration 32): une ligne par objectif, par personne et par
--   jour, avec count_done. Fait quand count_done atteint target_per_cycle,
--   comme progressFor() le calcule pour la carte. Une fois coche, plus rien
--   ne part ce jour-la, pas meme le premier rappel: un rappel pour une chose
--   faite est du bruit, et le bruit est ce qui fait couper les notifications.
--
-- LA REF CHANGE DE FORME
--
--   '<objectif>:<date>' devient '<objectif>:<date>:<minute du creneau>' pour
--   que chaque repetition ait sa ligne dans reminder_log. Un rappel deja
--   journalise sous l'ancienne forme ne bloque donc plus le creneau du jour
--   ou cette migration passe; au pire un doublon, une fois.
-- ============================================================================

alter table goals
  add column if not exists remind_every_min int
  check (remind_every_min is null or remind_every_min between 15 and 720);

-- Le type de retour gagne une colonne (slot_n), et `create or replace` refuse
-- de changer un type de retour: on supprime d'abord. La revocation est
-- reposee plus bas, parce qu'elle tombe avec la fonction.
drop function if exists due_goal_reminders(timestamptz, timestamptz);

create function due_goal_reminders(win_start timestamptz, win_end timestamptz)
returns table (
  user_id       uuid,
  goal_id       uuid,
  commitment    text,
  trigger_when  text,
  trigger_where text,
  on_day        date,
  fire_at       timestamptz,
  slot_n        int,
  ref           text
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
      g.remind_every_min,
      g.target_per_cycle,
      coalesce(p.sleep_min, 1380) as sleep_min,
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
      and coalesce(p.events_on, true)
  ),
  due as (
    select c.*
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
      /* Deja coche ce jour-la: plus rien, pas meme le premier. */
      and not exists (
        select 1 from goal_days gd
        where gd.goal_id = c.goal_id
          and gd.user_id = c.user_id
          and gd.on_date = c.on_day
          and gd.count_done >= c.target_per_cycle
      )
  ),
  slot as (
    select
      d.*,
      s as slot_min,
      case when d.remind_every_min is null then 0
           else (s - d.remind_at_min) / d.remind_every_min end as slot_n,
      ((d.on_day + make_interval(mins => s)) at time zone d.tz) as fire_at
    from due d
    /* Les creneaux du jour: l'heure choisie, puis toutes les N minutes tant
       qu'on est avant le coucher. Si l'heure choisie est deja au coucher ou
       apres (ou si la fenetre eveillee traverse minuit), seulement la
       premiere: c'est celle qui a ete demandee explicitement. */
    cross join lateral generate_series(
      d.remind_at_min,
      case when d.remind_every_min is null or d.sleep_min <= d.remind_at_min
           then d.remind_at_min
           else d.sleep_min - 1 end,
      coalesce(d.remind_every_min, 1)
    ) as s
  )
  select
    s.user_id, s.goal_id, s.commitment, s.trigger_when, s.trigger_where,
    s.on_day, s.fire_at, s.slot_n::int,
    s.goal_id::text || ':' || s.on_day::text || ':' || lpad(s.slot_min::text, 4, '0') as ref
  from slot s
  where s.fire_at >= win_start
    and s.fire_at <  win_end
    and not exists (
      select 1 from reminder_log rl
      where rl.user_id = s.user_id and rl.kind = 'goal'
        and rl.ref = s.goal_id::text || ':' || s.on_day::text || ':' || lpad(s.slot_min::text, 4, '0')
    )
  order by s.fire_at
$$;

revoke all on function due_goal_reminders(timestamptz, timestamptz) from public, anon, authenticated;

notify pgrst, 'reload schema';

-- Verifier apres avoir passe ce fichier:
--   select * from due_goal_reminders(now(), now() + interval '1 hour');
