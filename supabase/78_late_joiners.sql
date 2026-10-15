-- ============================================================================
-- Rich & Friends, migration 78: une periode finie avant ton arrivee ne compte
-- pas contre toi
--
-- Run after 77. Safe to re-run. Only `create or replace`: nothing is dropped,
-- no row is written or deleted.
--
-- CE QUI SE PASSAIT
--
-- member_cycle_status croisait chaque membre avec CHAQUE periode du groupe, y
-- compris celles qui etaient finies avant qu'il entre. Une periode fermee
-- sans point ni absence y vaut "missed". Quelqu'un qui rejoignait un groupe y
-- arrivait donc avec des jours rates qu'il n'avait jamais pu faire.
--
-- Vu sur le groupe du defi, cree le 15 octobre. Ses periodes du 11 au 14
-- existent (celles que la migration 76 ne cree plus pour un nouveau defi). La
-- personne entree le 15 a 19h28 UTC avait 4 jours rates des son premier jour:
--
--   - sa serie et son taux partaient de zero sur quatre;
--   - le graphique du groupe passait ces 4 jours de "absent" a "rate", parce
--     qu'un jour est rate des qu'une personne attendue l'a rate;
--   - et tick(): a la fermeture d'une periode, il cree une relance pour chaque
--     membre qui a rate CETTE periode et LA PRECEDENTE. missed_cycle() ne
--     regardait pas la date d'arrivee, donc la precedente, finie avant
--     l'arrivee, comptait. Sans point le 15, la relance partait a minuit,
--     heure de Toronto, contre quelqu'un dans son premier jour.
--
-- Ce n'est pas propre au defi. Dans tout groupe, la periode d'avant l'arrivee
-- comptait; avec un rythme quotidien, un seul jour sans point suffisait pour
-- etre relance. Chaque personne venue d'une video y serait passee.
--
-- LA REGLE
--
-- Une periode compte pour quelqu'un si elle etait encore ouverte quand il est
-- entre: joined_at < closes_at. Celle pendant laquelle on entre compte, on
-- pouvait encore pointer. Celles d'avant n'existent pas pour soi.
--
-- Une exception dans la vue: une periode d'avant ou l'on a POINTE reste. Ca
-- n'arrive qu'a quelqu'un parti puis revenu (joined_at est celui du retour),
-- et un point fait reste fait. Une absence d'avant, elle, disparait: elle ne
-- compte ni pour ni contre, et la garder laisserait des jours "absent" avant
-- le debut d'un groupe.
-- ============================================================================

create or replace function missed_cycle(uid uuid, cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
           select 1
             from cycles c
             join group_members gm on gm.group_id = c.group_id
                                  and gm.user_id = uid
            where c.id = cid
              and gm.joined_at < c.closes_at
         )
     and not exists (select 1 from checkins     where cycle_id = cid and user_id = uid)
     and not exists (select 1 from away_periods where cycle_id = cid and user_id = uid);
$$;

-- Same columns, same order, same security_invoker: `create or replace view`
-- refuses anything else. Only the where clause is new.
create or replace view member_cycle_status
with (security_invoker = on)
as
select
  c.group_id,
  gm.user_id,
  c.id   as cycle_id,
  c.seq,
  c.opens_at,
  c.closes_at,
  c.state,
  case
    when ci.id is not null then 'submitted'
    when ap.id is not null then 'away'
    when c.state = 'closed' then 'missed'
    else 'pending'
  end as status,
  ci.mood
from cycles c
join group_members gm  on gm.group_id = c.group_id
left join checkins ci  on ci.cycle_id = c.id and ci.user_id = gm.user_id
left join away_periods ap on ap.cycle_id = c.id and ap.user_id = gm.user_id
where gm.joined_at < c.closes_at
   or ci.id is not null;

notify pgrst, 'reload schema';
