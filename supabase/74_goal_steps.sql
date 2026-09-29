-- ============================================================================
-- Rich & Friends, migration 74: les etapes d'un objectif (une liste a cocher)
--
-- Run after 73. Safe to re-run.
--
-- LA DEMANDE
--
--   "Dans la section goals construit une option todo du genre un goal a
--    l'interieur duquel il y a des checklists qui auront un peu la meme
--    fonctionnalite que les goals normaux avec des options pour le temps
--    aussi et tout et quand tu vas checker le goal sur une vue tu vois comme
--    un pourcentage de progression"
--
-- Une table, goal_step: une ligne par etape, sous un objectif. Un titre, une
-- date facultative, une heure facultative, un rang, et le moment ou elle a
-- ete cochee (et par qui, pour un objectif commun). L'avancement de
-- l'objectif est cochees / total, calcule a l'ecran par src/lib/steps.js.
--
-- PAS DE NOUVEAU TYPE D'OBJECTIF. Un objectif "liste" est un objectif
-- ponctuel (cadence 'once') qui a des etapes. Le formulaire propose "Liste a
-- cocher" comme troisieme choix a cote de routine et jalon, et c'est la
-- presence d'etapes qui fait la liste, pas une colonne de plus a tenir en
-- accord avec une table a cote.
--
-- QUI VOIT, QUI COCHE. Voir, c'est voir l'objectif: la policy select est un
-- `exists` sur goals, et goals_select s'applique DANS ce sous-select, donc
-- une etape n'est visible que si l'objectif l'est. Ecrire, c'est pouvoir
-- modifier l'objectif, ou etre membre du groupe quand l'objectif est commun:
-- une liste commune se coche a plusieurs, c'est ce qui la rend commune.
-- ============================================================================

create table if not exists goal_step (
  id         uuid primary key default gen_random_uuid(),
  goal_id    uuid not null references goals(id) on delete cascade,
  title      text not null check (length(trim(title)) between 1 and 200),
  -- "des options pour le temps": une date, et une heure dans la journee,
  -- toutes deux facultatives. L'heure est en minutes locales comme partout
  -- (remind_at_min, start_min), et n'a de sens qu'avec une date.
  due_on     date,
  at_min     int check (at_min is null or (at_min between 0 and 1439)),
  constraint goal_step_time_needs_date check (at_min is null or due_on is not null),
  position   int not null default 0,
  done_at    timestamptz,
  done_by    uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists goal_step_goal on goal_step (goal_id, position);
-- Le calendrier lit les etapes datees par plage.
create index if not exists goal_step_due on goal_step (due_on) where due_on is not null;

alter table goal_step enable row level security;

-- ---------------------------------------------------------------------------
-- Qui peut ecrire une etape: la meme personne qui peut modifier l'objectif,
-- plus n'importe quel membre pour un objectif commun. SECURITY DEFINER parce
-- que la question porte sur la ligne goals elle-meme (proprietaire, auteur,
-- genre) et que la lire a travers goals_select suffirait pour voir mais pas
-- pour decider. Revoquee de public et anon, comme is_group_creator (62).
-- ---------------------------------------------------------------------------
create or replace function can_edit_goal(gid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from goals g
    where g.id = gid
      and (
        g.owner_id = auth.uid()
        or g.created_by = auth.uid()
        or (g.kind = 'group' and g.group_id is not null and is_member(g.group_id))
      )
  );
$$;

revoke execute on function can_edit_goal(uuid) from public, anon;
grant  execute on function can_edit_goal(uuid) to authenticated;

-- Voir une etape, c'est voir son objectif. goals_select s'applique dans le
-- sous-select, donc la regle des objectifs (les miens, ceux de mes groupes)
-- est la regle des etapes, ecrite une seule fois.
drop policy if exists goal_step_select on goal_step;
create policy goal_step_select on goal_step for select to authenticated
  using (exists (select 1 from goals g where g.id = goal_step.goal_id));

drop policy if exists goal_step_insert on goal_step;
create policy goal_step_insert on goal_step for insert to authenticated
  with check (can_edit_goal(goal_id));

drop policy if exists goal_step_update on goal_step;
create policy goal_step_update on goal_step for update to authenticated
  using (can_edit_goal(goal_id)) with check (can_edit_goal(goal_id));

drop policy if exists goal_step_delete on goal_step;
create policy goal_step_delete on goal_step for delete to authenticated
  using (can_edit_goal(goal_id));

notify pgrst, 'reload schema';

-- Verifier apres avoir passe ce fichier:
--   select tablename, rowsecurity from pg_tables where tablename = 'goal_step';
--   select polname, polcmd from pg_policy where polrelid = 'goal_step'::regclass;
--   -- la fonction n'est pas restee ouverte a anon:
--   select proacl from pg_proc where proname = 'can_edit_goal';
