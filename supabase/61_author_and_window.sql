-- ============================================================================
-- Rich & Friends, migration 61: l'auteur est prevenu, et la fenetre eveillee
-- ne concerne plus que l'eau
--
-- Run after 59. Safe to re-run.
--
-- DEUX DEMANDES, ET LES DEUX RENVERSENT UN CHOIX PRECEDENT
--
--   "Beh non, je veux aussi recevoir la notif meme si c'est moi qui l'ai
--    creee."
--
--   "Cette option choisir les heures auxquelles tu es reveille pour recevoir
--    des notifications, on va changer ca parce que ca bloque toutes les
--    notifications. [...] l'heure du reveil et du coucher, mais qui impacte
--    uniquement comment le systeme va repartir le nombre de verres d'eau que
--    tu dois boire, ca n'impacte aucune autre notification."
--
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. L'AUTEUR AUSSI.
--
-- 50_group_goal_notifications.sql excluait celui qui avait ecrit l'objectif,
-- et la raison etait bonne: on ne previent pas quelqu'un de ce qu'il vient de
-- faire, c'est le genre de message qui apprend a ignorer les autres.
--
-- Elle est renversee, et c'est une decision de produit, pas une correction. Ce
-- qui a ete observe: un objectif commun ajoute, une seule notification recue,
-- et l'impression que rien n'etait parti. Une notification qui revient a
-- l'auteur est aussi la seule preuve visible que le systeme a fait quelque
-- chose. Sur un produit ou personne ne peut voir la boite des autres, cette
-- preuve vaut la petite redondance.
--
-- La colonne created_by reste et reste utile: le message dit qui a ajoute
-- l'objectif, et la phrase "tu as ajoute" ne s'ecrit pas sans savoir que c'est
-- toi. Seule l'exclusion disparait.
-- ---------------------------------------------------------------------------
create or replace function notify_group_goal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind <> 'group' or new.status <> 'active' then
    return new;
  end if;

  /* Tous les membres, sans exception. L'ancienne version portait ici un
     `is distinct from coalesce(new.created_by, ...)`; le coalesce etait la
     parce qu'une comparaison a null n'exclut rien et ne previent alors
     personne. Sans exclusion, ce piege disparait avec elle. */
  insert into notification (user_id, kind, href, goal_id, actor_id, group_id)
  select gm.user_id,
         'group_goal',
         '/g/' || new.group_id::text,
         new.id,
         new.created_by,
         new.group_id
    from group_members gm
   where gm.group_id = new.group_id;

  return new;
end $$;

-- Le declencheur lui-meme n'a pas change; recree par securite sur une base ou
-- il aurait ete perdu.
drop trigger if exists goals_notify_group on goals;
create trigger goals_notify_group
  after insert on goals
  for each row execute function notify_group_goal();

-- Le defaut de created_by, pose dans 50 a l'interieur d'un bloc a exception,
-- donc absent sur une base a moitie migree. Sans lui la colonne est nulle sur
-- chaque objectif et le message ne peut nommer personne.
do $$
begin
  alter table goals alter column created_by set default auth.uid();
exception
  when others then
    raise notice 'created_by garde son defaut actuel: %', sqlerrm;
end $$;


-- ---------------------------------------------------------------------------
-- 2. LA FENETRE EVEILLEE NE TOUCHE PLUS QUE L'EAU.
--
-- Elle n'a jamais bloque les courriels ni les messages de groupe: aucun envoi
-- de la fonction planifiee ne la consulte. Mais elle etait presentee comme
-- une regle generale ("rien ne part en dehors"), elle etait posee tout en haut
-- des reglages, et elle etait vraiment lue a deux endroits: le rythme de
-- l'eau, et la borne de la repetition d'un rappel d'objectif.
--
-- Le premier est ce qu'elle doit faire et reste. Le second part.
--
-- CE QUI REMPLACE LA BORNE, ET POURQUOI IL EN FAUT UNE
--
-- Un objectif regle sur "toutes les heures a partir de 20:00" doit bien
-- s'arreter quelque part, sinon il sonne toute la nuit. La borne devient la
-- FIN DE LA JOURNEE LOCALE, qui n'est pas un reglage: c'est la definition du
-- jour auquel l'objectif est du. Minuit passe, c'est un autre jour, et la
-- serie recommence a l'heure choisie.
--
-- Une notification a 23:30 sur un objectif qu'on a soi-meme regle a 20:00
-- toutes les heures est ce qu'on a demande. Le telephone, lui, a son propre
-- mode de concentration, et c'est le bon endroit pour "pas la nuit": il vaut
-- pour toutes les applications et personne n'a a le redire ici.
-- ---------------------------------------------------------------------------
create or replace function due_goal_reminders(win_start timestamptz, win_end timestamptz)
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
    /* 1439, la derniere minute du jour local, et non plus l'heure du coucher:
       la fenetre eveillee ne concerne plus que l'eau. */
    cross join lateral generate_series(
      d.remind_at_min,
      case when d.remind_every_min is null then d.remind_at_min else 1439 end,
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
--   -- l'auteur a bien une ligne, comme tout le monde:
--   select count(*) from notification where goal_id = '<id de l objectif>';
--   -- et la repetition va jusqu'a la fin du jour:
--   select * from due_goal_reminders(now(), now() + interval '1 hour');
