/* Extensions explicites: charge par node dans reminders.test.mjs, qui ne
   resout pas les imports sans extension comme le fait Vite. */
import { DEFAULT_TARGET, GLASS_ML, planFor, safeTarget } from './water.js'

/**
 * Quand l'application a le droit de faire vibrer un telephone.
 *
 * LA DEMANDE.
 *
 * "Chaque personne peut choisir a quelle heure ou a quelle frequence dans la
 * journee il veut recevoir une notification."
 *
 * UNE FENETRE EVEILLEE PLUTOT QUE DES HEURES DE SILENCE.
 *
 * Les deux disent la meme chose et l'une se remplit, l'autre pas. "Ne me
 * derange pas de 23h a 8h" demande de penser a l'envers, en creux, et laisse
 * la question de ce qui se passe quand les deux bouts se croisent. "Je suis
 * reveille de 8h a 23h" est une phrase qu'on sait dire sur soi, et c'est aussi
 * la fenetre dont le calcul de l'eau a besoin pour repartir les verres.
 *
 * Un seul reglage, donc, qui sert a deux choses: rien ne part en dehors, et
 * c'est sur cette duree que les rappels d'eau se repartissent.
 *
 * TOUT EST EN MINUTES DEPUIS MINUIT.
 *
 * Pas en Date, pas en chaine "08:00". C'est la seule unite dans laquelle "je
 * me leve a 8h" et "il est 14h20" se comparent sans traverser un fuseau
 * horaire, et le fuseau est justement la partie qu'on ne veut pas refaire a
 * chaque comparaison.
 */

export const DAY = 1440

/** Reveil et coucher par defaut: 8h et 23h. */
export const DEFAULT_WAKE = 8 * 60
export const DEFAULT_SLEEP = 23 * 60

/**
 * Les sortes de rappel, et lesquelles sont allumees au depart.
 *
 * L'EAU EST ETEINTE AU DEPART, ET C'EST DELIBERE.
 *
 * "Je veux que les notifications de boire de l'eau soient automatiques."
 * Automatique veut dire que l'HORAIRE se calcule tout seul, ce qu'il fait: on
 * ne choisit aucune heure, seulement une cible. Ca ne veut pas dire allume
 * sans qu'on ait rien demande. Envoyer huit notifications par jour a quelqu'un
 * qui avait juste accepte les notifications de groupe est la meilleure facon
 * de lui faire couper les notifications en entier, y compris celles qu'il
 * voulait.
 *
 * Les rappels d'agenda sont allumes, eux, parce qu'ils ne partent que si on a
 * explicitement coche un rappel sur un evenement. Rien ne peut donc arriver
 * sans qu'on l'ait demande, et une deuxieme case a cocher avant celle-la
 * serait une porte devant une porte.
 */
export const KINDS = ['water', 'events']

/**
 * Les deux canaux par lesquels l'application peut joindre quelqu'un.
 *
 * DEMANDE MOT POUR MOT: "est-ce que c'est un app notification seulement ou
 * email ou les deux, bref la personne pourra cocher".
 *
 * Deux booleens et pas une enumeration a trois valeurs. Les trois cas nommes
 * sortent des deux cases sans qu'aucun ecran ait a traduire quoi que ce soit,
 * et le quatrieme, les deux eteints, existe alors gratuitement.
 */
export const CHANNELS = ['push', 'email']

export const DEFAULTS = {
  wake_min: DEFAULT_WAKE,
  sleep_min: DEFAULT_SLEEP,
  /* Les deux a vrai: c'est ce que le produit faisait avant que ce reglage
     existe, et un defaut qui change le comportement de tout le monde le jour
     d'une migration est un defaut mal choisi. */
  push_on: true,
  email_on: true,
  water_on: false,
  water_target_ml: DEFAULT_TARGET,
  water_glass_ml: GLASS_ML,
  events_on: true,
  events_lead_min: 30,
}

/** Combien de minutes avant un evenement le rappel peut partir. */
export const LEAD_CHOICES = [0, 10, 15, 30, 60, 120, 1440]

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))

/** Une minute-du-jour ramenee dans [0, 1439]. */
export function safeMin(n, fallback = 0) {
  const v = Number(n)
  return Number.isFinite(v) ? clamp(Math.round(v), 0, DAY - 1) : fallback
}

export function safeLead(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return DEFAULTS.events_lead_min
  /**
   * La valeur la plus proche de celles offertes, plutot que la valeur brute:
   * une minute arbitraire venue d'une vieille ligne s'afficherait comme aucun
   * des choix et le select rendrait vide.
   *
   * `<=` et pas `<`, ce qui n'est pas un detail. 45 minutes est a egale
   * distance de 30 et de 60, et la liste etant croissante, `<` gardait le
   * premier, donc 30. Sur un rappel, l'egalite doit pencher vers le PLUS
   * TOT: etre prevenu quinze minutes trop en avance ne coute rien, quinze
   * minutes trop tard veut dire rate.
   */
  return LEAD_CHOICES.reduce((best, c) => (Math.abs(c - v) <= Math.abs(best - v) ? c : best))
}

/**
 * "08:00" depuis 480, et l'inverse.
 *
 * Deux fonctions plutot qu'un toLocaleTimeString, parce que <input type="time">
 * parle exactement ce format-la, en 24h, quelle que soit la langue de la page.
 * L'affichage localise est un autre travail et il se fait ailleurs.
 */
export function toHm(min) {
  const m = safeMin(min)
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export function fromHm(hm, fallback = 0) {
  const parts = /^(\d{1,2}):(\d{2})$/.exec(String(hm ?? '').trim())
  if (!parts) return fallback
  const min = Number(parts[1]) * 60 + Number(parts[2])
  return min >= 0 && min < DAY ? min : fallback
}

/**
 * Est-ce que cette minute tombe dans la fenetre eveillee?
 *
 * LE PASSAGE DE MINUIT EST LE CAS QUI COMPTE.
 *
 * Une fenetre 08:00 - 23:00 est un simple intervalle. Une fenetre 22:00 -
 * 06:00, celle de quelqu'un qui travaille de nuit, ne l'est pas: elle traverse
 * minuit, donc `wake <= min && min < sleep` est faux a 2h du matin, qui est
 * precisement le moment ou cette personne est reveillee. Ecrit naivement, ce
 * reglage rend le silence complet.
 *
 * Les deux bouts egaux veulent dire toute la journee, pas rien: c'est le seul
 * repli qui n'eteint pas quelque chose que personne n'a demande d'eteindre.
 */
export function isAwake(min, wakeMin = DEFAULT_WAKE, sleepMin = DEFAULT_SLEEP) {
  const m = safeMin(min)
  const w = safeMin(wakeMin, DEFAULT_WAKE)
  const s = safeMin(sleepMin, DEFAULT_SLEEP)
  if (w === s) return true
  return w < s ? m >= w && m < s : m >= w || m < s
}

/**
 * Combien de temps la personne est eveillee, en minutes.
 *
 * C'est le denominateur du calcul de l'eau: les verres se repartissent sur les
 * heures ou on est debout, pas sur vingt-quatre heures dont on en dort huit.
 */
export function awakeMinutes(wakeMin = DEFAULT_WAKE, sleepMin = DEFAULT_SLEEP) {
  const w = safeMin(wakeMin, DEFAULT_WAKE)
  const s = safeMin(sleepMin, DEFAULT_SLEEP)
  if (w === s) return DAY
  return w < s ? s - w : DAY - w + s
}

/**
 * Une ligne notify_pref lue depuis la base, complete et dans les bornes.
 *
 * Une ligne peut manquer entierement, parce que personne n'a encore ouvert les
 * reglages, et l'application doit marcher dans ce cas: c'est l'etat de tout le
 * monde le jour ou la migration passe. Elle peut aussi porter des valeurs
 * ecrites avant un renommage, ou nulles sur une colonne ajoutee plus tard.
 */
export function prefOf(row) {
  const r = row ?? {}
  return {
    wake_min: safeMin(r.wake_min, DEFAULTS.wake_min),
    sleep_min: safeMin(r.sleep_min, DEFAULTS.sleep_min),
    water_on: Boolean(r.water_on ?? DEFAULTS.water_on),
    water_target_ml: safeTarget(r.water_target_ml ?? DEFAULTS.water_target_ml),
    water_glass_ml: Number(r.water_glass_ml) > 0 ? Number(r.water_glass_ml) : GLASS_ML,
    /* `?? true` et pas `|| true`: false doit rester false. Un `||` ici
       rallumerait les rappels d'agenda de quelqu'un qui vient de les couper,
       ce qui est le pire bogue possible sur un ecran de reglages. */
    events_on: Boolean(r.events_on ?? DEFAULTS.events_on),
    push_on: Boolean(r.push_on ?? DEFAULTS.push_on),
    email_on: Boolean(r.email_on ?? DEFAULTS.email_on),
    events_lead_min: safeLead(r.events_lead_min ?? DEFAULTS.events_lead_min),
  }
}

/**
 * Le plan d'eau du jour a partir d'une ligne de reglages.
 *
 * Un seul endroit ou la fenetre eveillee et le calcul de l'eau se rencontrent,
 * pour que l'ecran des reglages, le widget du tableau de bord et la fonction
 * planifiee lisent tous le meme chiffre. Trois appels a planFor() avec trois
 * facons de deriver la fenetre, c'est trois chiffres differents affiches au
 * meme moment.
 */
export function waterPlan(row, { drunkMl = 0, nowMin = 0 } = {}) {
  const p = prefOf(row)
  return planFor({
    target: p.water_target_ml,
    glass: p.water_glass_ml,
    wakeMin: p.wake_min,
    sleepMin: p.sleep_min,
    drunkMl,
    nowMin,
  })
}

/**
 * A quelle minute du jour un rappel doit partir pour un evenement.
 *
 * "Mon frere il oublie tout le temps qu'il a soccer. Une option comme ca
 * l'app peut lui renvoyer des notifications pour le prevenir que a telle heure
 * il a ca dans le calendrier."
 *
 * Rend null pour un evenement sans heure. Un truc qui dure toute la journee
 * n'a pas de "trente minutes avant", et calculer a partir de minuit enverrait
 * le rappel de la fete nationale a 23h30 la veille.
 *
 * Peut rendre un nombre negatif, ce qui veut dire "la veille": un rappel a
 * 24h d'un cours de 9h tombe a 9h la veille. C'est a l'appelant de savoir quel
 * jour il regarde, et le rendre plutot que de le ramener a zero garde
 * l'information au lieu de la perdre.
 */
export function remindMinFor(startMin, leadMin) {
  if (startMin === null || startMin === undefined) return null
  const s = Number(startMin)
  if (!Number.isFinite(s)) return null
  return s - safeLead(leadMin)
}

/**
 * Par quels canaux joindre cette personne.
 *
 * Un seul endroit qui lit ces deux colonnes, pour que l'ecran des reglages, le
 * texte sous la case du formulaire d'objectif et la fonction planifiee soient
 * d'accord. Trois lectures de `row.email_on` a trois endroits, c'est trois
 * occasions qu'une d'elles oublie le repli.
 */
export function channelsOf(row) {
  const p = prefOf(row)
  return { push: p.push_on, email: p.email_on }
}

/**
 * Les deux canaux coupes: personne ne sera joint.
 *
 * Cas permis et pas nomme dans la demande, donc il doit se DIRE. Refuser de
 * decocher la derniere case obligerait a couper les notifications au niveau du
 * telephone, ce qui coupe aussi celles qu'on voulait garder; mais laisser
 * croire qu'un rappel arrivera encore serait la meme faute que le bouton qui
 * a l'air d'effacer une date et ne l'efface pas.
 */
export function isMuted(row) {
  const c = channelsOf(row)
  return !c.push && !c.email
}

/**
 * La cle i18n qui decrit la livraison, pour la phrase sous une case a cocher.
 *
 * Rendue comme une cle plutot que comme une phrase: ce fichier est pur et
 * testable sous node, et il n'a pas a savoir dans quelle langue la page est.
 */
export function channelKey(row) {
  const c = channelsOf(row)
  if (c.push && c.email) return 'remind.by_both'
  if (c.push) return 'remind.by_push'
  if (c.email) return 'remind.by_email'
  return 'remind.by_none'
}
