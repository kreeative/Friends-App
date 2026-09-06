/* Extension explicite: charge par node dans goalRow.test.mjs, qui ne resout
   pas les imports sans extension comme le fait Vite. */
import { dayKey } from './time.js'
import { fromHm } from './reminders.js'

/**
 * La ligne `goals` que le formulaire envoie, a partir de ce qui est a l'ecran.
 *
 * Extrait du composant pour une seule raison: ce qui suit est deja parti casse
 * en production et le test qui le couvrait etait une expression reguliere sur
 * le texte source, qui verifiait la presence de la ligne fautive. Une fonction
 * pure se teste sur ce qu'elle rend, donc sur ce que Postgres recevra.
 */

/**
 * UNE CHAINE VIDE N'EST PAS UNE DATE, ET NULL NON PLUS QUAND LA COLONNE
 * L'INTERDIT.
 *
 * `goals.starts_on` est `date not null default current_date`. Le formulaire
 * envoyait `startsOn || null`, ce qui vise juste pour `due_on` et `ends_on`,
 * qui acceptent null, et rate completement ici: un null explicite dans un
 * INSERT ecrase le DEFAULT de la colonne au lieu de le laisser s'appliquer.
 * Toute personne qui ne touchait pas au champ, c'est-a-dire tout le monde,
 * recevait
 *
 *   [23502] null value in column "starts_on" of relation "goals"
 *
 * et ne pouvait creer aucun objectif. Rapporte par une utilisatrice reelle.
 *
 * Le repli est le jour local et pas l'omission de la cle. Omettre laisserait
 * `current_date` s'appliquer, mais `current_date` est la date du serveur, en
 * UTC: a Montreal, apres 20h, il rend deja demain, et l'objectif cree ce soir
 * ne serait pas demande ce soir. `dayKey()` lit l'horloge de la personne,
 * comme partout ailleurs dans ce depot (Calendar.jsx fait le meme repli).
 */
export function startsOnFor(value, today = dayKey(new Date())) {
  return value || today
}

/**
 * Tous les champs d'un objectif, prets pour insert() comme pour update().
 *
 * `today` est un parametre pour que le test n'ait pas a dependre de l'heure a
 * laquelle il tourne.
 */
export function goalRow(f, today = dayKey(new Date())) {
  /* Un objectif sans groupe ne peut pas appartenir a un groupe, quoi que dise
     la bascule, et la bascule n'est pas affichee dans ce cas. Ceinture et
     bretelles, parce que la contrainte de la base refuse la combinaison et
     que son message n'est pas fait pour etre lu. */
  const kind = f.groupId ? f.kind : 'personal'

  return {
    group_id: f.groupId ?? null,
    kind,
    owner_id: kind === 'personal' ? f.userId : null,
    commitment: (f.commitment ?? '').trim(),
    goal_type: f.goalType,
    trigger_when: (f.when ?? '').trim() || null,
    trigger_where: (f.where ?? '').trim() || null,
    evidence_def: (f.evidence ?? '').trim() || null,
    proof_type: f.proofType,
    cadence: f.cadence,
    target_per_cycle: f.cadence === 'recurring' ? Number(f.target) || 1 : 1,
    /* Tous les jours est stocke null plutot que les sept, pour que "aucune
       restriction" ait une seule representation au lieu de deux. */
    active_days:
      f.cadence === 'recurring' && f.days?.length > 0 && f.days.length < 7
        ? [...f.days].sort()
        : null,
    /* Ces deux-la acceptent null, donc la chaine vide devient bien null. */
    due_on: f.cadence === 'once' ? f.dueOn || null : null,
    ends_on: f.cadence === 'recurring' ? f.endsOn || null : null,
    starts_on: startsOnFor(f.startsOn, today),
    stake_text: (f.stake ?? '').trim() || null,
    remind: f.remind,
    /**
     * L'heure d'une notification par objectif, en minutes locales, ou null.
     *
     * Null et pas '' : la colonne accepte null et c'est "pas de notification
     * horaire, seulement le recap". Une heure sans la case "me le rappeler"
     * cochee est ignoree: le booleen reste la porte, l'heure est un detail
     * derriere elle. fromHm rend le repli null sur une saisie vide ou
     * illisible plutot qu'un NaN qui violerait la contrainte.
     */
    remind_at_min: f.remind && f.remindAt ? fromHm(f.remindAt, null) : null,
    /* La frequence n'a de sens qu'avec une heure: "toutes les heures" a
       partir de rien n'est pas un horaire. Null = une seule fois. */
    remind_every_min:
      f.remind && f.remindAt && fromHm(f.remindAt, null) != null && Number(f.remindEvery) > 0
        ? Number(f.remindEvery)
        : null,
  }
}
