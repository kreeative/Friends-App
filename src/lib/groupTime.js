/**
 * L'heure d'un groupe, dans le fuseau de la personne qui la lit.
 *
 * CE QUI A ETE RAPPORTE
 *
 *   Capture de l'ecran d'un groupe: "Sunday 00:00 · America/Toronto".
 *
 *   "Instead of all the group being on the Toronto timeline, can it just be
 *    adjusted in real time for everyone? Like if I said something is gonna
 *    send a notification in 5 minutes at 9:30 my time, even if it's 3:30 at
 *    someone else's, they should also receive it at the same time."
 *
 * CE QUI SE PASSAIT VRAIMENT, ET POURQUOI CE N'EST PAS CE QUE LA LIGNE DISAIT
 *
 * La demande est deja satisfaite par la base et ne l'etait pas par l'ecran.
 * `cycles.opens_at` est un `timestamptz`, c'est-a-dire un INSTANT: la periode
 * d'un groupe s'ouvre au meme moment pour tout le monde sur la planete, et la
 * fonction planifiee compare des instants. Personne n'attend son tour.
 *
 * Ce que la ligne affichait, c'etait la REGLE qui a servi a fabriquer cet
 * instant: dimanche, minuit, dans le fuseau du groupe. Pour quelqu'un a
 * Toronto c'est la meme chose; pour quelqu'un a Paris, "Sunday 00:00 ·
 * America/Toronto" ne dit pas quand sa porte s'ouvre, et il faut faire le
 * calcul de tete pour le savoir. La ligne n'etait pas fausse, elle etait
 * inutilisable, ce qui se lit exactement comme un bogue de fuseau.
 *
 * DONC: LE MEME INSTANT, DIT DANS LE FUSEAU DE CHACUN.
 *
 * On reconstruit l'instant de la prochaine ouverture a partir de la regle du
 * groupe, puis on le formate dans le fuseau du lecteur. A Paris la ligne dit
 * "dimanche 06:00", et une deuxieme phrase precise que c'est le meme moment
 * pour tout le monde. Chez la personne qui a cree le groupe, les deux fuseaux
 * sont les memes et la deuxieme phrase n'apparait pas.
 *
 * POURQUOI PASSER PAR UN INSTANT PLUTOT QUE PAR UNE SOUSTRACTION D'HEURES
 *
 * Parce que le decalage entre deux fuseaux n'est pas une constante. Toronto et
 * Paris sont a six heures l'un de l'autre la plupart de l'annee et a cinq
 * pendant les deux semaines ou les changements d'heure ne tombent pas au meme
 * moment. Une soustraction d'heures se trompe pendant ces semaines-la, deux
 * fois par an, ce qui est exactement le genre de faute qu'on ne voit jamais en
 * la relisant. `Intl` connait les regles; on lui demande.
 */

/** Les fuseaux invalides existent: une valeur trainee, un renommage. */
export function safeZone(tz, fallback = 'UTC') {
  if (!tz || typeof tz !== 'string') return fallback
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz })
    return tz
  } catch {
    return fallback
  }
}

/** Le fuseau du navigateur, ou UTC si le navigateur ne le dit pas. */
export function deviceZone() {
  try {
    return safeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
  } catch {
    return 'UTC'
  }
}

/**
 * Le decalage d'un fuseau, en minutes, a un instant donne.
 *
 * Il n'y a pas d'API pour ca, donc: on formate l'instant dans le fuseau, on
 * relit les champs comme s'ils etaient de l'UTC, et la difference avec
 * l'instant de depart est le decalage. C'est la methode standard et elle
 * traverse les changements d'heure, parce que `Intl` applique la regle en
 * vigueur a CET instant-la.
 */
export function zoneOffset(at, tz) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: safeZone(tz),
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]))
  /* `hour` peut rendre "24" a minuit avec hour12: false. Date.UTC accepte 24
     et roule au lendemain, ce qui est le bon comportement, mais autant le
     ramener explicitement pour que la valeur intermediaire soit lisible. */
  const h = Number(p.hour) % 24
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), h, Number(p.minute), Number(p.second))
  return (asUtc - at.getTime()) / 60000
}

/**
 * Un mur d'horloge dans un fuseau, rendu en instant.
 *
 * Deux candidats, pas une iteration jusqu'a convergence: le decalage lu a
 * l'instant approximatif, et celui lu au premier candidat. En dehors des deux
 * heures de bascule annuelles, les deux donnent le meme instant. Sur une
 * bascule, ils encadrent le trou ou le recouvrement, et c'est la qu'il faut
 * choisir plutot que boucler.
 *
 * ON GARDE CELUI QUI DIT VRAIMENT L'HEURE DEMANDEE.
 *
 * Ecrit d'abord comme deux passes qui se corrigent, la seconde ecrasant la
 * premiere. Le test sur le 8 mars 2026 a Toronto, ou 02:00 n'existe pas, a
 * rendu un instant qui se lit 01:00 sur place: une porte qui s'ouvre une
 * heure TOT, une fois par an, sans que rien ne le signale.
 *
 * Donc: on regarde ce que chaque candidat affiche reellement dans le fuseau.
 *
 *   deux candidats valides   c'est l'heure qui existe deux fois, en automne.
 *                            On prend la premiere: c'est celle a laquelle la
 *                            regle se realise.
 *   aucun candidat valide    c'est l'heure qui n'existe pas, au printemps. On
 *                            prend le plus tard, donc l'instant juste apres le
 *                            saut: la porte s'ouvre au moment ou l'heure
 *                            serait arrivee, jamais avant.
 */
export function zonedTimeToInstant({ year, month, day, hour = 0, minute = 0 }, tz) {
  const zone = safeZone(tz)
  const naive = Date.UTC(year, month - 1, day, hour, minute)
  const first = new Date(naive - zoneOffset(new Date(naive), zone) * 60000)
  const second = new Date(naive - zoneOffset(first, zone) * 60000)

  const seen = new Map()
  for (const c of [first, second]) seen.set(c.getTime(), c)
  const both = [...seen.values()].sort((a, b) => a - b)

  const lands = both.filter((c) => {
    const p = partsIn(c, zone)
    return p.year === year && p.month === month && p.day === day && p.hour === hour && p.minute === minute
  })
  if (lands.length > 0) return lands[0]
  return both[both.length - 1]
}

/** Les champs de date d'un instant, lus dans un fuseau. */
export function partsIn(at, tz) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: safeZone(tz),
    hour12: false,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]))
  const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
    dow: DOW[p.weekday],
  }
}

/**
 * Le prochain instant ou la regle du groupe se realise.
 *
 * La regle est "tel jour de la semaine, telle heure, dans tel fuseau". On
 * essaie les huit prochains jours locaux du groupe et on garde le premier qui
 * tombe apres maintenant. Huit et pas sept: si l'occurrence d'aujourd'hui est
 * deja passee, la bonne reponse est dans sept jours, et un tableau de sept
 * jours rate ce cas une fois par semaine.
 */
export function nextOpening({ dow, hour, tz }, now = new Date()) {
  const zone = safeZone(tz)
  const today = partsIn(now, zone)
  for (let d = 0; d <= 8; d += 1) {
    /* Date.UTC normalise les debordements de mois, donc on peut ajouter d au
       quantieme sans se soucier de la longueur du mois. */
    const roll = new Date(Date.UTC(today.year, today.month - 1, today.day + d))
    const cand = {
      year: roll.getUTCFullYear(),
      month: roll.getUTCMonth() + 1,
      day: roll.getUTCDate(),
      hour,
      minute: 0,
    }
    const asDate = new Date(Date.UTC(cand.year, cand.month - 1, cand.day))
    if (asDate.getUTCDay() !== dow) continue
    const at = zonedTimeToInstant(cand, zone)
    if (at.getTime() > now.getTime()) return at
  }
  return null
}

/**
 * Ce qu'il faut ecrire sous le nom d'un groupe.
 *
 * @returns {{
 *   at: Date|null,      l'instant de la prochaine ouverture
 *   when: string,       "dimanche 06:00", dans le fuseau du lecteur
 *   groupWhen: string,  la meme chose dans le fuseau du groupe
 *   sameZone: boolean,  le lecteur est-il dans le fuseau du groupe
 * }}
 *
 * `sameZone` compare les instants formates et pas les noms de fuseau:
 * America/Toronto et America/Montreal sont deux noms pour la meme heure, et
 * dire a quelqu'un de Montreal "c'est aussi 00:00 a Toronto" serait une
 * precision qui ne precise rien.
 */
export function openingLabel({ dow, hour, tz, viewerTz, locale = 'fr', now = new Date() }) {
  if (!Number.isInteger(dow) || !Number.isInteger(hour)) {
    return { at: null, when: '', groupWhen: '', sameZone: true }
  }
  const zone = safeZone(tz)
  const mine = safeZone(viewerTz, zone)
  const at = nextOpening({ dow, hour, tz: zone }, now)
  if (!at) return { at: null, when: '', groupWhen: '', sameZone: true }

  const fmt = (z) =>
    new Intl.DateTimeFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
      timeZone: z,
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .format(at)
      /**
       * fr-CA rend "dimanche 06 h 00"; l'application ecrit les heures avec
       * deux points partout ailleurs, y compris dans les reglages de rappels.
       *
       * Le motif exige un chiffre de chaque cote. Ecrit d'abord comme "un h
       * entoure d'espaces optionnels", il a mange le h de "dimanche" et rendu
       * "dimanc:e 06 h 00": une expression qui cherche une lettre isolee doit
       * dire de quoi elle est isolee.
       *
       * Et le motif lui-meme ne s'ecrit pas dans ce commentaire: une barre
       * oblique apres une etoile ferme le bloc, ce qui a casse ce fichier
       * entier a la premiere redaction de cette note.
       */
      .replace(/(\d)\s*h\s*(\d)/, '$1:$2')
      .replace(/,/g, '')
      .replace(/\s+/g, ' ')
      .trim()

  const when = fmt(mine)
  const groupWhen = fmt(zone)
  return { at, when, groupWhen, sameZone: when === groupWhen }
}
