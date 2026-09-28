-- ============================================================================
-- Rich & Friends, migration 73: Google Agenda et Outlook, dans les deux sens
--
-- Run after 72. Safe to re-run.
--
-- LA DEMANDE
--
--   "add an option into the app to link google calendar or outlook"
--
-- Deux sens, trois tables.
--
--   ENTRANT. Elle colle l'adresse secrete iCal de son Google (ou l'adresse ICS
--   publiee de son Outlook). /api/feed-sync va la lire, deplie les
--   repetitions, et pose les occurrences dans feed_event. Le calendrier les
--   dessine, en lecture seule, sur leur propre couche.
--
--   SORTANT. Elle cree une adresse a elle, et l'ajoute dans Google ("From
--   URL") ou Outlook ("Subscribe from web"). /api/ics sert son calendrier en
--   iCalendar a qui presente le token.
--
-- CE QUI EST SECRET, ET POURQUOI.
--
-- calendar_feed.url est l'adresse secrete de Google: qui la connait lit tout
-- le calendrier Google de la personne. Elle est lisible par sa proprietaire
-- et par personne d'autre (policy user_id = auth.uid()), l'API la lit avec la
-- cle service_role, et elle ne sort dans AUCUNE reponse: l'ecran n'affiche
-- que l'hote et une etiquette.
--
-- ics_share.token est l'adresse secrete de Rich & Friends, dans l'autre sens.
-- Meme regime que cal_link.token: lisible par elle seule, pas hache parce
-- qu'elle doit pouvoir le recopier, revoque en supprimant la ligne.
--
-- feed_event n'a QU'UNE policy select, comme booking. L'ecriture passe par
-- l'API avec la cle service_role. Supprimer une ligne ici ne supprimerait rien
-- chez Google, et elle reviendrait a la relecture suivante.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Les flux branches.
-- ---------------------------------------------------------------------------
create table if not exists calendar_feed (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  -- D'ou vient l'adresse, d'apres son hote. Ne sert qu'a l'etiquette et au
  -- petit mode d'emploi: les trois sont lus exactement pareil.
  provider      text not null check (provider in ('google', 'outlook', 'ics')),
  -- https seulement, tenu ici ET par feedUrlProblem() dans src/lib/feeds.js.
  -- L'API refuse d'aller chercher tout ce que cette fonction refuse; la
  -- contrainte est la ceinture sous les bretelles.
  url           text not null check (url ~ '^https://' and length(url) <= 2000),
  label         text check (label is null or length(label) <= 80),
  created_at    timestamptz not null default now(),
  -- La derniere lecture qui a MARCHE. C'est ce que l'ecran montre.
  last_sync_at  timestamptz,
  -- La derniere tentative, reussie ou pas. C'est ce qui decide si la page
  -- redemande une lecture: une adresse cassee ne doit pas etre re-essayee a
  -- chaque ouverture du calendrier.
  checked_at    timestamptz,
  -- Un mot-code (http_404, not_ics, timeout), jamais l'adresse, jamais un
  -- message d'un serveur tiers.
  last_error    text check (last_error is null or length(last_error) <= 60),
  event_count   integer not null default 0,
  unique (user_id, url)
);

alter table calendar_feed enable row level security;

drop policy if exists calendar_feed_select on calendar_feed;
create policy calendar_feed_select on calendar_feed
  for select using (user_id = auth.uid());

drop policy if exists calendar_feed_insert on calendar_feed;
create policy calendar_feed_insert on calendar_feed
  for insert with check (user_id = auth.uid());

drop policy if exists calendar_feed_update on calendar_feed;
create policy calendar_feed_update on calendar_feed
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists calendar_feed_delete on calendar_feed;
create policy calendar_feed_delete on calendar_feed
  for delete using (user_id = auth.uid());

-- Cinq flux par personne, au plus. Le chiffre est aussi FEED_LIMIT dans
-- src/lib/feeds.js. Un flux coute une lecture reseau a chaque ouverture du
-- calendrier passee la demi-heure, et cinq est deja plus que ce qu'une
-- personne a de calendriers.
create or replace function calendar_feed_cap() returns trigger
language plpgsql as $$
begin
  if (select count(*) from calendar_feed where user_id = new.user_id) >= 5 then
    raise exception 'feed_limit' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists calendar_feed_cap on calendar_feed;
create trigger calendar_feed_cap before insert on calendar_feed
  for each row execute function calendar_feed_cap();

-- ---------------------------------------------------------------------------
-- 2. Les occurrences lues.
-- ---------------------------------------------------------------------------
-- Une ligne par OCCURRENCE, deja depliee: un cours hebdomadaire fait une ligne
-- par semaine dans la fenetre lue (60 jours en arriere, 400 en avant). Le
-- navigateur n'a donc rien a deplier, et une regle de repetition exotique se
-- lit une fois, cote serveur, dans un module teste.
create table if not exists feed_event (
  id         bigserial primary key,
  feed_id    uuid not null references calendar_feed(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  uid        text not null check (length(uid) <= 300),
  title      text not null check (length(title) <= 200),
  location   text check (location is null or length(location) <= 200),
  url        text check (url is null or length(url) <= 500),
  all_day    boolean not null default false,
  -- L'instant, pour une heure. Pour une journee entiere: minuit UTC de la
  -- date, qui sert au tri et a rien d'autre.
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  -- La DATE d'une journee entiere, parce qu'une date n'a pas de fuseau et
  -- qu'un instant lu a Montreal l'aurait fait glisser a la veille.
  starts_on  date,
  -- Exclusive, comme DTEND en iCalendar.
  ends_on    date
);

create index if not exists feed_event_user_time on feed_event (user_id, starts_at);
create index if not exists feed_event_feed on feed_event (feed_id);

alter table feed_event enable row level security;

-- UNE SEULE POLICY, ET C'EST VOULU. Voir l'en-tete.
drop policy if exists feed_event_select on feed_event;
create policy feed_event_select on feed_event
  for select using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. L'adresse sortante.
-- ---------------------------------------------------------------------------
create table if not exists ics_share (
  user_id      uuid primary key references profiles(id) on delete cascade,
  token        text not null unique check (length(token) between 20 and 80),
  created_at   timestamptz not null default now(),
  -- La derniere fois que Google ou Outlook est venu lire. C'est ce qui repond
  -- a "est-ce que c'est branche": une date, pas un voyant.
  last_read_at timestamptz
);

alter table ics_share enable row level security;

drop policy if exists ics_share_select on ics_share;
create policy ics_share_select on ics_share
  for select using (user_id = auth.uid());

drop policy if exists ics_share_insert on ics_share;
create policy ics_share_insert on ics_share
  for insert with check (user_id = auth.uid());

-- Pas d'update: un token ne se modifie pas, il se remplace. Arreter le
-- partage, c'est supprimer la ligne, et l'adresse cesse de repondre.
drop policy if exists ics_share_delete on ics_share;
create policy ics_share_delete on ics_share
  for delete using (user_id = auth.uid());

notify pgrst, 'reload schema';

-- Verifier apres avoir passe ce fichier:
--   select tablename, rowsecurity from pg_tables
--    where tablename in ('calendar_feed','feed_event','ics_share');
--
--   -- feed_event ne doit avoir QUE select
--   select polname, polcmd from pg_policy
--    where polrelid = 'feed_event'::regclass;
