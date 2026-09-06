-- ============================================================================
-- Rich & Friends, migration 57: les rappels
--
-- Run after 56. Safe to re-run.
--
-- CE QUI A ETE DEMANDE
--
--   "Chaque personne peut choisir a quelle heure ou a quelle frequence dans la
--    journee il veut recevoir une notification."
--   "Je veux que les notifications de boire de l'eau soient automatiques."
--   "Mon frere il oublie tout le temps qu'il a soccer. Une option comme ca
--    l'app peut lui renvoyer des notifications pour le prevenir que a telle
--    heure il a ca dans le calendrier."
--
-- TROIS TABLES ET UNE COLONNE
--
--   notify_pref     la fenetre eveillee et les reglages, un par personne
--   water_log       un verre bu, une ligne
--   reminder_log    le plafond: un rappel donne ne part qu'une fois
--   calendar_event.remind_min   le rappel d'un evenement, en minutes avant
--
-- POURQUOI water_next_at EST DANS LA BASE ET PAS RECALCULE PAR LE SERVEUR
--
-- Le calcul de l'intervalle vit dans src/lib/water.js, teste sous node. Le
-- reecrire ici en SQL ferait deux implementations de la meme arithmetique, et
-- deux implementations d'une meme regle finissent toujours par ne plus etre
-- d'accord: c'est la lecon que ce depot a deja payee ailleurs.
--
-- Donc le client calcule et ecrit l'instant du prochain rappel; la fonction
-- planifiee ne fait que comparer un timestamp et avancer d'un intervalle deja
-- decide. Quand personne n'ouvre l'application, l'intervalle reste celui de la
-- derniere information connue, ce qui est exactement le bon comportement:
-- sans nouvelle information il n'y a rien a recalculer.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Les reglages, un par personne.
--
-- UNE FENETRE EVEILLEE PLUTOT QUE DES HEURES DE SILENCE.
--
-- Les deux disent la meme chose et l'une se remplit, l'autre pas. "Ne me
-- derange pas de 23h a 8h" demande de penser en creux. "Je suis reveille de 8h
-- a 23h" est une phrase qu'on sait dire sur soi, et c'est aussi la duree dont
-- le calcul de l'eau a besoin pour repartir les verres.
--
-- Les deux bornes traversent minuit sans probleme: wake 22:00 / sleep 06:00
-- est la journee de quelqu'un qui travaille de nuit, et rien dans les
-- contraintes ci-dessous ne l'interdit. C'est le code qui sait lire une
-- fenetre qui passe minuit, pas la colonne.
-- ---------------------------------------------------------------------------
create table if not exists notify_pref (
  user_id          uuid primary key references profiles(id) on delete cascade,

  -- Minutes depuis minuit, heure locale de la personne.
  wake_min         int  not null default 480  check (wake_min  between 0 and 1439),
  sleep_min        int  not null default 1380 check (sleep_min between 0 and 1439),

  /* Eteint au depart, et c'est delibere. "Automatique" veut dire que l'HORAIRE
     se calcule tout seul, ce qu'il fait: on ne choisit aucune heure, seulement
     une cible. Ca ne veut pas dire allume sans qu'on ait rien demande. Huit
     notifications par jour a quelqu'un qui avait accepte les notifications de
     groupe est la meilleure facon de lui faire tout couper. */
  water_on         boolean not null default false,

  /* Les bornes viennent de src/lib/water.js et doivent rester d'accord avec
     elles: MIN_TARGET, MAX_TARGET. Une contrainte plus large que le formulaire
     ne sert a rien; plus etroite refuserait une valeur que l'ecran propose. */
  water_target_ml  int  not null default 2200 check (water_target_ml between 1000 and 4000),
  water_glass_ml   int  not null default 250  check (water_glass_ml  between 50 and 1000),

  /* Quand le prochain rappel d'eau doit partir. Ecrit par le client a chaque
     verre et a chaque changement de reglage; avance par la fonction planifiee
     apres un envoi. Null veut dire "rien de prevu", ce qui est l'etat normal
     quand water_on est faux ou quand la cible est atteinte. */
  water_next_at    timestamptz,

  /* Allumes, eux, parce qu'un rappel d'agenda ne part que si on a coche un
     rappel sur un evenement precis. Rien ne peut arriver sans qu'on l'ait
     demande, et une case a cocher avant celle-la serait une porte devant une
     porte. Ce reglage sert a tout couper d'un coup, pas a tout allumer. */
  events_on        boolean not null default true,
  events_lead_min  int  not null default 30 check (events_lead_min between 0 and 1440),

  /**
   * PAR OU TE JOINDRE. DEMANDE MOT POUR MOT.
   *
   *   "Ajouter une option dans les parametres que chaque personne peut set
   *    pour demander est-ce que c'est un app notification seulement ou email
   *    ou les deux, bref la personne pourra cocher."
   *
   * Deux booleens et pas un champ a trois valeurs. Les trois cas nommes sont
   * push seul, courriel seul, les deux, et deux cases a cocher les donnent
   * tous les trois sans qu'aucun ecran ait a traduire une enumeration.
   *
   * Le quatrieme cas, les deux eteints, n'a pas ete nomme et existe quand
   * meme: c'est "laisse-moi tranquille". Il est permis, parce que refuser de
   * decocher la derniere case oblige quelqu'un a couper les notifications au
   * niveau du telephone, ce qui coupe aussi celles qu'il voulait garder. Mais
   * il est DIT a l'ecran, plutot que de laisser croire que quelque chose
   * arrivera encore.
   *
   * Les deux a vrai par defaut: c'est ce que le produit faisait deja avant
   * que ce reglage existe, et un defaut qui change le comportement de tout le
   * monde le jour d'une migration est un defaut mal choisi.
   */
  push_on          boolean not null default true,
  email_on         boolean not null default true,

  updated_at       timestamptz not null default now()
);

/* Ajoutees apres coup: `create table if not exists` ne touche pas une table
   qui existe deja, donc ces deux lignes sont ce qui rend ce fichier correct
   pour quelqu'un qui l'a deja execute une fois. */
alter table notify_pref add column if not exists push_on  boolean not null default true;
alter table notify_pref add column if not exists email_on boolean not null default true;


-- ---------------------------------------------------------------------------
-- 2. Un verre bu, une ligne.
--
-- Plutot qu'un compteur par jour. Un compteur ne se defait pas: appuyer deux
-- fois sur le bouton par accident laisse la journee fausse et rien a faire
-- pour la corriger. Une ligne se supprime, et on obtient au passage l'heure de
-- chaque verre, ce qui est ce qui rend le rattrapage possible.
--
-- `on_day` est la date LOCALE de la personne, pas une derivee de `at`. Une
-- date derivee d'un instant en UTC compte le verre de 21h a Montreal dans la
-- journee du lendemain, ce qui remet le compteur a zero en pleine soiree.
-- ---------------------------------------------------------------------------
create table if not exists water_log (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  on_day  date not null,
  ml      int  not null check (ml between 1 and 3000),
  at      timestamptz not null default now()
);

create index if not exists water_log_user_day_idx on water_log (user_id, on_day);


-- ---------------------------------------------------------------------------
-- 3. Le plafond: un rappel donne ne part qu'une fois.
--
-- Meme principe que notifications_log, et pour la meme raison: la fonction
-- planifiee tourne toutes les cinq minutes et peut tourner deux fois pour la
-- meme fenetre apres un redemarrage ou un timeout reseau. La cle primaire rend
-- le doublon physiquement impossible, ce qui est plus solide qu'un `if not
-- exists` dans le code appelant.
--
-- `ref` identifie l'occurrence et pas l'evenement:
--   event  '<uuid de l evenement>:<date locale>'
--   water  '<date locale>:<hh:mm du creneau>'
--
-- Sans la date dedans, un cours hebdomadaire n'enverrait son rappel qu'une
-- seule fois dans sa vie.
-- ---------------------------------------------------------------------------
create table if not exists reminder_log (
  user_id uuid not null references profiles(id) on delete cascade,
  kind    text not null check (kind in ('water', 'event')),
  ref     text not null check (length(ref) between 1 and 120),
  sent_at timestamptz not null default now(),
  primary key (user_id, kind, ref)
);

/* Le journal grandit d'une ligne par rappel envoye et ne sert qu'a empecher un
   doublon dans la fenetre de quelques minutes qui suit. Un index sur la date
   permet de le tailler sans balayer la table. */
create index if not exists reminder_log_sent_idx on reminder_log (sent_at);


-- ---------------------------------------------------------------------------
-- 4. Le rappel d'un evenement, en minutes avant.
--
-- Par evenement et pas global, parce que c'est ce qui a ete demande: le frere
-- oublie le soccer, pas tout son agenda. Un rappel sur chaque cours de la
-- semaine serait une notification toutes les deux heures et la fonction serait
-- coupee dans la journee.
--
-- Null veut dire aucun rappel, et c'est le defaut: rien ne change pour les
-- evenements qui existent deja.
-- ---------------------------------------------------------------------------
alter table calendar_event
  add column if not exists remind_min int
  check (remind_min is null or remind_min between 0 and 1440);


-- ---------------------------------------------------------------------------
-- 5. RLS. Tout est a soi et rien n'est a personne d'autre.
--
-- Meme forme que les policies du cycle: `user_id = auth.uid()`, sans chemin de
-- groupe, sans vue partagee, sans fonction d'agregat. Ce que quelqu'un boit et
-- a quelle heure il dort ne regarde que lui.
-- ---------------------------------------------------------------------------
alter table notify_pref  enable row level security;
alter table water_log    enable row level security;
alter table reminder_log enable row level security;

drop policy if exists notify_pref_all on notify_pref;
create policy notify_pref_all on notify_pref for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists water_log_all on water_log;
create policy water_log_all on water_log for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

/* Le journal des envois est en lecture seule pour la personne concernee, et
   meme ca est plus une politesse qu'un besoin: c'est la fonction planifiee,
   qui parle avec la cle de service, qui ecrit dedans. Pas de policy d'ecriture
   du tout, donc un client ne peut pas se declarer deja prevenu et faire sauter
   un rappel. */
drop policy if exists reminder_log_select on reminder_log;
create policy reminder_log_select on reminder_log for select to authenticated
  using (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- 6. Les rappels d'agenda a envoyer dans une fenetre.
--
-- POURQUOI CETTE FONCTION EXISTE PLUTOT QU'UNE REQUETE DANS LA FONCTION EDGE.
--
-- L'expansion d'une recurrence a besoin de la date LOCALE de la personne, donc
-- de son fuseau, donc d'une jointure sur profiles et d'une conversion par
-- ligne. Fait cote client de la fonction edge, ca voudrait dire rapatrier tous
-- les evenements de tout le monde toutes les cinq minutes pour en garder
-- trois. Postgres sait faire cette selection sur place.
--
-- COMMENT UNE OCCURRENCE EST TROUVEE.
--
-- On regarde les trois dates locales qui peuvent toucher la fenetre (la
-- veille, le jour, le lendemain), parce qu'un rappel a 24 heures d'un cours du
-- matin tombe la veille et qu'un fuseau a l'est peut deja etre demain. Pour
-- chacune on demande si l'evenement a lieu ce jour-la, puis on calcule
-- l'instant du rappel et on garde ceux qui tombent dans la fenetre.
--
-- weekdays vide veut dire "ne se repete pas", donc l'evenement n'a lieu que le
-- jour de starts_on. C'est la meme convention que src/lib/agenda.js, ou elle
-- est notee de la meme facon; le 0 = dimanche vient de getDay() en JavaScript
-- et extract(dow) en Postgres numerote pareil, ce qui est la raison pour
-- laquelle cette colonne est stockee comme ca.
-- ---------------------------------------------------------------------------
create or replace function due_event_reminders(win_start timestamptz, win_end timestamptz)
returns table (
  user_id    uuid,
  event_id   uuid,
  title      text,
  location   text,
  on_day     date,
  start_min  int,
  fire_at    timestamptz,
  ref        text
)
language sql
stable
security definer
set search_path = public
as $$
  with candidate as (
    select
      e.user_id,
      e.id as event_id,
      e.title,
      e.location,
      e.start_min,
      e.starts_on,
      e.until_on,
      e.weekdays,
      e.excluded_on,
      coalesce(e.remind_min, p.events_lead_min) as lead_min,
      coalesce(pr.timezone, 'UTC') as tz,
      d::date as on_day
    from calendar_event e
    join profiles pr on pr.id = e.user_id
    /* left join: quelqu'un qui n'a jamais ouvert les reglages n'a pas de ligne
       notify_pref, et c'est l'etat de tout le monde le jour ou cette migration
       passe. Un inner join ici ferait une fonctionnalite qui ne marche que
       pour les gens qui sont alles la configurer, c'est-a-dire personne. */
    left join notify_pref p on p.user_id = e.user_id
    cross join lateral generate_series(
      ((win_start at time zone coalesce(pr.timezone, 'UTC'))::date - 1),
      ((win_end   at time zone coalesce(pr.timezone, 'UTC'))::date + 1),
      interval '1 day'
    ) as d
    where e.remind_min is not null
      and e.start_min is not null
      and coalesce(p.events_on, true)
  ),
  occurrence as (
    select
      c.*,
      /* L'instant du rappel, construit en heure locale puis ramene en UTC.
         `at time zone tz` sur un timestamp SANS fuseau dit "ce mur d'horloge,
         dans ce fuseau", ce qui est exactement ce qu'on veut: 8h30 chez la
         personne, quel que soit le decalage du jour, changement d'heure
         compris. */
      ((c.on_day + make_interval(mins => c.start_min - c.lead_min)) at time zone c.tz) as fire_at
    from candidate c
    where c.on_day >= c.starts_on
      and (c.until_on is null or c.on_day <= c.until_on)
      and not (c.on_day = any(c.excluded_on))
      and (
        /* Pas de repetition: seulement le jour de depart. */
        (coalesce(array_length(c.weekdays, 1), 0) = 0 and c.on_day = c.starts_on)
        /* Sinon, les jours de la semaine choisis. */
        or extract(dow from c.on_day)::smallint = any(c.weekdays)
      )
  )
  select
    o.user_id,
    o.event_id,
    o.title,
    o.location,
    o.on_day,
    o.start_min,
    o.fire_at,
    o.event_id::text || ':' || o.on_day::text as ref
  from occurrence o
  where o.fire_at >= win_start
    and o.fire_at <  win_end
    /* Deja envoye. Le plafond est aussi porte par la cle primaire de
       reminder_log a l'insertion, donc ce filtre est une optimisation et non
       la garantie: c'est la contrainte qui rend le doublon impossible. */
    and not exists (
      select 1 from reminder_log rl
      where rl.user_id = o.user_id and rl.kind = 'event' and rl.ref = o.event_id::text || ':' || o.on_day::text
    )
  order by o.fire_at
$$;

/* Reservee a la fonction planifiee, qui parle avec la cle de service. Elle est
   SECURITY DEFINER et lit l'agenda de tout le monde, donc la laisser
   accessible a `authenticated` serait donner a n'importe quel compte la liste
   des rendez-vous des autres. */
revoke all on function due_event_reminders(timestamptz, timestamptz) from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- 7. Les rappels d'eau a envoyer dans une fenetre.
--
-- Beaucoup plus simple, et c'est voulu: toute l'arithmetique est deja faite
-- dans src/lib/water.js et son resultat est dans water_next_at. Ici on compare
-- un timestamp et on verifie que la personne est bien reveillee, parce qu'un
-- water_next_at ecrit hier soir peut avoir traverse la nuit si l'application
-- n'a pas ete rouverte.
-- ---------------------------------------------------------------------------
create or replace function due_water_reminders(win_start timestamptz, win_end timestamptz)
returns table (
  user_id      uuid,
  tz           text,
  target_ml    int,
  glass_ml     int,
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
     isAwake() dans src/lib/reminders.js, ecrite ici parce que la fonction doit
     pouvoir refuser un envoi sans demander au client. */
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


-- ---------------------------------------------------------------------------
-- 8. Tailler le journal.
--
-- Une ligne par rappel envoye, pour toujours, finirait par etre la plus grosse
-- table de la base pour une information qui ne sert que quelques minutes. On
-- garde trente jours, ce qui laisse de quoi regarder ce qui est parti quand
-- quelque chose est signale.
-- ---------------------------------------------------------------------------
create or replace function prune_reminder_log()
returns integer
language sql
security definer
set search_path = public
as $$
  with gone as (
    delete from reminder_log where sent_at < now() - interval '30 days' returning 1
  )
  select count(*)::int from gone
$$;

revoke all on function prune_reminder_log() from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- Verifier apres avoir passe ce fichier:
--
--   select count(*) from notify_pref;
--   select * from due_event_reminders(now(), now() + interval '1 hour');
--   select * from due_water_reminders(now(), now() + interval '5 minutes');
-- ---------------------------------------------------------------------------
