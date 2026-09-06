/**
 * Boire assez d'eau dans la journee, sans se faire harceler.
 *
 * LA QUESTION POSEE, MOT POUR MOT.
 *
 * "Je veux que les notifications de boire de l'eau soient automatiques, genre
 * chaque 30 min boire un verre d'eau ou whatever. Comment tu peux calculer
 * pour que tout le monde remplisse ses objectifs de boire de l'eau dans la
 * journee ?"
 *
 * POURQUOI L'INTERVALLE EST CALCULE ET PAS FIXE A 30 MINUTES.
 *
 * Une fenetre eveillee de 8h a 23h fait 900 minutes. Un rappel toutes les 30
 * minutes fait 30 rappels, donc 30 verres de 250 ml, donc 7,5 litres. C'est a
 * peu pres quatre fois la cible d'une journee. Le "ou whatever" de la demande
 * dit bien que le chiffre n'etait pas le sujet: ce qui etait demande, c'est
 * que ce soit automatique et reparti sur la journee.
 *
 * Donc l'intervalle sort de la cible et de la fenetre, et pas l'inverse. Avec
 * 2 litres, des verres de 250 ml et 900 minutes eveillees: 8 verres, un
 * toutes les 113 minutes, soit a peu pres toutes les deux heures.
 *
 * ET POURQUOI IL SE RECALCULE APRES CHAQUE VERRE.
 *
 * C'est la seule partie qui repond vraiment a "pour que tout le monde
 * remplisse ses objectifs". Un intervalle fixe ne rattrape rien: quelqu'un qui
 * saute toute sa matinee finit la journee a la moitie de sa cible et
 * l'application n'a rien remarque. Ici le prochain rappel est toujours "ce
 * qu'il reste a boire, reparti sur ce qu'il reste de journee", donc un retard
 * resserre les rappels et une grosse gorgee les espace.
 *
 * Avec un plancher, parce qu'un rattrapage sans limite finit par demander un
 * verre toutes les deux minutes a 22h50, ce qui n'est ni buvable ni une bonne
 * idee. Passe le plancher, la journee est simplement manquee et le dire est
 * plus honnete que de faire vibrer un telephone vingt fois.
 */

/** Un verre, en millilitres. La taille d'un verre a eau ordinaire. */
export const GLASS_ML = 250

/**
 * Jamais plus souvent que toutes les 30 minutes.
 *
 * C'est le chiffre de la demande, garde a sa vraie place: pas comme la
 * cadence, comme la limite. Au-dela ce n'est plus un rappel, c'est une
 * alarme, et une alarme qu'on ignore est une alarme qu'on desactive.
 */
export const MIN_GAP = 30

/**
 * Et jamais plus espace que deux heures.
 *
 * Sans plafond, quelqu'un qui a une petite cible et une longue journee reçoit
 * un rappel toutes les trois heures, ce qui ne construit aucune habitude: on
 * l'a oublie avant qu'il revienne.
 */
export const MAX_GAP = 120

/**
 * La cible d'une journee, en millilitres, selon ce qu'on sait de la personne.
 *
 * D'OU VIENNENT CES CHIFFRES.
 *
 * L'EFSA (2010) donne un apport adequat en eau TOTALE de 2,0 L/jour pour une
 * femme adulte et 2,5 L/jour pour un homme, dont a peu pres un quart vient des
 * aliments. Les valeurs ici sont donc legerement au-dessus de la part
 * "boissons" seule, ce qui est aussi le chiffre usuel de 2 L par jour que tout
 * le monde a deja entendu.
 *
 * Ce sont des points de depart, pas des prescriptions: la cible est reglable
 * entre 1 et 4 litres dans les reglages. Le sport, la chaleur, une grossesse,
 * un traitement changent le bon chiffre, et l'application ne sait rien de tout
 * ça.
 *
 * `gender` vient de l'ecran de configuration, qui accepte aussi "autre" et de
 * ne pas repondre. Le repli est la valeur du milieu plutot que celle d'un des
 * deux, parce qu'une non-reponse n'est pas une reponse.
 */
export const TARGET_BY_GENDER = { woman: 2000, man: 2500, other: 2200 }
export const DEFAULT_TARGET = 2200
export const MIN_TARGET = 1000
export const MAX_TARGET = 4000

export function defaultTarget(gender) {
  return TARGET_BY_GENDER[gender] ?? DEFAULT_TARGET
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))

/** La cible, ramenee dans les bornes que les reglages laissent choisir. */
export function safeTarget(ml) {
  const n = Number(ml)
  return Number.isFinite(n) ? clamp(Math.round(n), MIN_TARGET, MAX_TARGET) : DEFAULT_TARGET
}

/** Combien de verres pour atteindre une cible. */
export function glassesFor(targetMl, glassMl = GLASS_ML) {
  const g = Number(glassMl) > 0 ? Number(glassMl) : GLASS_ML
  return Math.max(1, Math.ceil(safeTarget(targetMl) / g))
}

/**
 * Le plan de la journee: quand boire le prochain verre, et combien il en
 * reste.
 *
 * Tout est en minutes depuis minuit, dans le fuseau de la personne, parce que
 * c'est la seule unite dans laquelle "je me leve a 8h" et "il est 14h20" se
 * comparent sans passer par une date.
 *
 * @param target   la cible du jour, en ml
 * @param glass    un verre, en ml
 * @param wakeMin  debut de la fenetre eveillee
 * @param sleepMin fin de la fenetre eveillee
 * @param drunkMl  ce qui a deja ete bu aujourd'hui
 * @param nowMin   l'heure qu'il est
 *
 * @returns {{
 *   done: boolean,        la cible est atteinte
 *   asleep: boolean,      hors de la fenetre eveillee, donc rien a envoyer
 *   late: boolean,        il reste a boire mais plus assez de journee pour le
 *                         faire au rythme du plancher
 *   remainingMl: number,
 *   glassesLeft: number,
 *   gapMin: number|null,  l'ecart entre deux rappels, arrondi a la minute
 *   nextMin: number|null, quand le prochain rappel part
 * }}
 */
export function planFor({
  target = DEFAULT_TARGET,
  glass = GLASS_ML,
  wakeMin = 480,
  sleepMin = 1380,
  drunkMl = 0,
  nowMin = 0,
} = {}) {
  const goal = safeTarget(target)
  const g = Number(glass) > 0 ? Number(glass) : GLASS_ML
  const remainingMl = Math.max(0, goal - Math.max(0, Number(drunkMl) || 0))

  const none = { remainingMl, glassesLeft: Math.ceil(remainingMl / g), gapMin: null, nextMin: null }

  if (remainingMl <= 0) return { ...none, done: true, asleep: false, late: false, glassesLeft: 0 }

  /* Avant le reveil, le premier verre part a l'heure du reveil et pas tout de
     suite: un rappel a 6h du matin sur une personne qui a dit se lever a 8h
     est exactement la notification qui fait desactiver la fonction. */
  if (nowMin < wakeMin) {
    const glassesLeft = Math.ceil(remainingMl / g)
    const window = Math.max(0, sleepMin - wakeMin)
    return {
      ...none,
      done: false,
      asleep: true,
      late: false,
      glassesLeft,
      gapMin: clamp(Math.round(window / glassesLeft), MIN_GAP, MAX_GAP),
      nextMin: wakeMin,
    }
  }

  /* Apres le coucher, plus rien. La journee est ce qu'elle est et le compteur
     repartira de zero demain. */
  if (nowMin >= sleepMin) {
    return { ...none, done: false, asleep: true, late: true, nextMin: null, gapMin: null }
  }

  const glassesLeft = Math.ceil(remainingMl / g)
  const minutesLeft = sleepMin - nowMin
  const ideal = minutesLeft / glassesLeft

  /**
   * `late` est rendu plutot que corrige en silence.
   *
   * Quand l'ideal passe sous le plancher, il n'y a plus assez de journee pour
   * finir la cible a un rythme buvable. On envoie quand meme au plancher,
   * parce que boire un peu vaut mieux que rien, mais l'appelant sait que la
   * cible ne sera pas atteinte et l'ecran peut le dire au lieu de promettre.
   */
  const late = ideal < MIN_GAP
  const gapMin = clamp(Math.round(ideal), MIN_GAP, MAX_GAP)

  return {
    remainingMl,
    glassesLeft,
    done: false,
    asleep: false,
    late,
    gapMin,
    nextMin: Math.min(nowMin + gapMin, sleepMin),
  }
}

/**
 * La phrase a mettre sous le reglage: "un verre toutes les X".
 *
 * Rendue en minutes et en heures parce que "toutes les 112 minutes" ne se lit
 * pas. La valeur exacte reste dans gapMin; ceci est de l'affichage.
 */
export function everyLabel(gapMin, t) {
  if (!gapMin) return ''
  const h = Math.floor(gapMin / 60)
  const m = gapMin % 60
  if (h === 0) return t('water.every_m', { m })
  if (m === 0) return t('water.every_h', { h })
  return t('water.every_hm', { h, m })
}
