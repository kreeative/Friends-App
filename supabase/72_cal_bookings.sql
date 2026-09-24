-- ============================================================================
-- Rich & Friends, migration 72: les reservations Cal.com sur le calendrier
--
-- Run after 71. Safe to re-run.
--
-- LA DEMANDE
--
--   "So when people book me on my Kreeative cal booking pages it shows on my
--    Rich and Friends calendar can you do that?"
--   "And hyperlink to Rich and Friends so I can directly click and go."
--
-- Cal.com pousse chaque reservation sur une URL a nous. Deux tables: celle qui
-- dit a qui appartient l'URL, et celle qui garde ce qui est arrive.
--
-- CE QUI EST GARDE, ET CE QUI NE L'EST PAS
--
-- Le nom de la personne qui reserve, le titre du type de rendez-vous, les
-- heures, et les deux liens. RIEN D'AUTRE.
--
-- Cal envoie aussi l'adresse courriel, le fuseau, et les reponses au
-- formulaire de reservation. Ces champs existent dans le paiload et n'ont pas
-- de colonne ici, ce qui est la seule facon fiable de ne pas les garder: une
-- colonne vide finit par etre remplie par le prochain qui passe. Le choix est
-- explicite ("event type and who booked"), et Cal reste l'endroit ou le
-- dossier complet d'un client vit.
--
-- POURQUOI LA LECTURE SEULE
--
-- booking n'a QU'UNE policy select. Pas d'insert, pas d'update, pas de delete
-- pour authenticated. L'ecriture passe par /api/cal-webhook, qui parle avec la
-- cle service_role et ignore donc RLS de toute facon.
--
-- Ce n'est pas une precaution, c'est le sens de la chose: supprimer une
-- reservation dans Rich & Friends n'annule rien chez Cal. Un bouton qui
-- effacerait la ligne ici laisserait le rendez-vous vivant, la personne
-- arriverait quand meme, et le calendrier aurait dit le contraire. On annule
-- dans Cal, et le webhook le reporte ici.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Le lien entre un compte et son webhook Cal.
-- ---------------------------------------------------------------------------
-- `token` voyage dans l'URL que Cal appelle, et c'est lui qui dit DE QUI est
-- la reservation: le paiload de Cal ne porte aucun identifiant Rich & Friends.
--
-- `signing_secret` est le meme secret des deux cotes. Cal signe le corps brut
-- en HMAC-SHA256 avec, l'API verifie avec, et une signature qui ne tombe pas
-- juste fait rejeter la livraison. Sans lui, l'URL seule suffirait a ecrire
-- n'importe quoi sur le calendrier de quelqu'un.
--
-- Les deux sont lisibles par leur proprietaire et par personne d'autre. Elle
-- doit voir le secret pour le coller dans Cal, donc il n'est pas hache: un
-- hachage rendrait la seule operation qu'on en fait impossible.
create table if not exists cal_link (
  user_id        uuid primary key references profiles(id) on delete cascade,
  token          text not null unique check (length(token) between 20 and 80),
  signing_secret text not null check (length(signing_secret) between 20 and 200),
  connected_at   timestamptz not null default now(),
  -- La derniere livraison verifiee. C'est ce qui repond a "est-ce que c'est
  -- branche", et une date est la seule reponse honnete a cette question: un
  -- voyant vert qui ne regarde que l'existence de la ligne serait vert avant
  -- meme que Cal ait ete configure.
  last_seen_at   timestamptz
);

alter table cal_link enable row level security;

drop policy if exists cal_link_select on cal_link;
create policy cal_link_select on cal_link
  for select using (user_id = auth.uid());

drop policy if exists cal_link_write on cal_link;
create policy cal_link_write on cal_link
  for insert with check (user_id = auth.uid());

drop policy if exists cal_link_update on cal_link;
create policy cal_link_update on cal_link
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Debrancher, c'est supprimer la ligne. Le webhook ne trouve plus le token et
-- refuse tout ce qui arrive ensuite.
drop policy if exists cal_link_delete on cal_link;
create policy cal_link_delete on cal_link
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. Les reservations.
-- ---------------------------------------------------------------------------
create table if not exists booking (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  -- Une seule source aujourd'hui. La colonne existe pour que Calendly ou un
  -- flux ICS n'aient pas besoin d'une deuxieme table le jour ou ils arrivent.
  source       text not null default 'cal' check (source in ('cal')),
  -- L'identifiant de Cal. C'est la clef de l'upsert: Cal reessaye une
  -- livraison qui n'a pas repondu, et une reservation qui arrive deux fois
  -- doit rester une ligne.
  uid          text not null check (length(uid) between 1 and 200),
  -- Le titre du type de rendez-vous, "Discovery call". Pas une phrase
  -- composee par Cal avec le nom dedans: le nom a sa propre colonne, donc le
  -- calendrier peut choisir de ne pas l'afficher sans avoir a decouper du
  -- texte.
  title        text not null check (length(trim(title)) between 1 and 200),
  -- Qui a reserve. Null est une valeur normale: une reservation sans nom
  -- s'affiche comme le titre seul, ce qui reste utile.
  guest_name   text check (guest_name is null or length(guest_name) <= 120),
  -- En timestamptz, et pas en date + minutes comme calendar_event. Une
  -- reservation est prise depuis un autre fuseau que le tien la moitie du
  -- temps, et c'est l'instant qui est vrai; le jour et l'heure affiches en
  -- sont deduits a l'ecran.
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  check (ends_at > starts_at),
  -- La page de la reservation chez Cal.
  web_url      text check (web_url is null or length(web_url) <= 500),
  -- Le lien de l'appel, quand il y en a un. C'est celui qu'on veut a 14h.
  join_url     text check (join_url is null or length(join_url) <= 500),
  -- Annulee plutot que supprimee. La ligne reste, le calendrier ne la dessine
  -- plus, et "ou est passe mon rendez-vous de jeudi" a une reponse.
  cancelled_at timestamptz,
  updated_at   timestamptz not null default now(),
  unique (user_id, source, uid)
);

-- La requete du calendrier est toujours "les miennes, dans cette plage".
create index if not exists booking_user_time on booking (user_id, starts_at);

alter table booking enable row level security;

-- UNE SEULE POLICY, ET C'EST VOULU. Voir l'en-tete: le webhook ecrit avec la
-- cle service_role, qui ignore RLS; le navigateur ne fait que lire.
drop policy if exists booking_select on booking;
create policy booking_select on booking
  for select using (user_id = auth.uid());

notify pgrst, 'reload schema';

-- Verifier apres avoir passe ce fichier:
--   -- les deux tables sont la et fermees
--   select tablename, rowsecurity from pg_tables
--    where tablename in ('cal_link','booking');
--
--   -- booking ne doit avoir QUE select
--   select polname, polcmd from pg_policy
--    where polrelid = 'booking'::regclass;
