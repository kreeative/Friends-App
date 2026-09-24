import { dayKey } from './cycle.js'
import { LAYER_COLOUR } from './agenda.js'

/**
 * Les reservations Cal.com, en entrees de calendrier.
 *
 *   "So when people book me on my Kreeative cal booking pages it shows on my
 *    Rich and Friends calendar can you do that?"
 *
 * Meme forme que birthdayEntries et que la conversion des objectifs: une ligne
 * d'une autre table devient la forme que toute la page sait deja dessiner. La
 * grille du mois, les blocs de la semaine, la liste du jour et les puces ne
 * savent rien de Cal et n'ont pas a l'apprendre.
 */

/**
 * L'INSTANT EST STOCKE, LE JOUR EST CALCULE.
 *
 * booking.starts_at est un timestamptz parce qu'une reservation est prise
 * depuis un autre fuseau que le tien la moitie du temps. calendar_event, lui,
 * porte une date et des minutes depuis minuit, en local, parce qu'un cours de
 * 9h est a 9h quel que soit l'endroit d'ou on regarde l'horaire.
 *
 * Les deux sont justes pour ce qu'ils decrivent, et c'est ICI que la traduction
 * se fait, une fois. new Date(iso) rend l'instant, et getHours/getMinutes le
 * lisent dans le fuseau de l'appareil, qui est le fuseau de qui regarde.
 *
 * Le piege evite: formater l'ISO en le decoupant au T, ce qui rend l'heure UTC
 * et pose un rendez-vous de 14h a Montreal a 18h sur la grille, sans rien qui
 * ait l'air faux.
 */
function minutesLocales(d) {
  return d.getHours() * 60 + d.getMinutes()
}

/**
 * Le titre affiche.
 *
 * "Discovery call, Fatim" plutot que le seul titre du type de rendez-vous, et
 * plutot que la phrase toute faite de Cal ("Discovery call between Kee and
 * Fatim"), qui nomme l'organisatrice sur son propre calendrier et mange la
 * largeur d'une puce sur un telephone.
 *
 * Sans nom, le titre seul. C'est le cas d'une reservation dont Cal n'a envoye
 * que l'organisatrice, et le titre seul reste utile.
 */
export function bookingTitle(row) {
  const titre = String(row?.title ?? '').trim()
  const nom = String(row?.guest_name ?? '').trim()
  if (!titre) return nom || ''
  return nom ? `${titre}, ${nom}` : titre
}

/**
 * OU VA LE CLIC.
 *
 *   "And hyperlink to Rich and Friends so I can directly click and go."
 *
 * Le lien de l'appel d'abord, la page Cal ensuite. L'ordre est celui de ce
 * qu'on veut a 14h moins une: a l'heure du rendez-vous, la chose a ouvrir est
 * la salle, pas la fiche. La fiche est ce qu'on ouvre quand il n'y a pas de
 * salle, c'est-a-dire un rendez-vous en personne ou par telephone.
 *
 * Null quand il n'y a ni l'un ni l'autre, et le calendrier rend alors une
 * entree qui ne s'ouvre pas, comme un anniversaire.
 */
export function bookingHref(row) {
  const lien = (v) => (/^https?:\/\//i.test(String(v ?? '')) ? String(v) : null)
  return lien(row?.join_url) ?? lien(row?.web_url) ?? null
}

/**
 * Les entrees a dessiner, pour la plage affichee.
 *
 * Les annulees ne sont pas dessinees. Elles restent en base, ce qui est ce qui
 * permet de repondre a "ou est passe mon rendez-vous de jeudi", mais un
 * rendez-vous annule sur la grille est un rendez-vous auquel on se presente.
 *
 * Un `from`/`to` absent ne filtre rien: la requete a deja borne la plage et
 * refiltrer ici avec des bornes que l'appelant n'a pas donnees viderait la
 * grille en silence.
 */
export function bookingEntries(rows, from = null, to = null) {
  const out = []

  for (const row of rows ?? []) {
    if (!row?.id || row.cancelled_at) continue
    const debut = new Date(row.starts_at)
    const fin = new Date(row.ends_at)
    if (Number.isNaN(debut.getTime()) || Number.isNaN(fin.getTime())) continue
    if (from && debut < from) continue
    if (to && debut > to) continue

    const titre = bookingTitle(row)
    if (!titre) continue

    /* Un rendez-vous qui traverse minuit finirait avec end_min < start_min, ce
       que blockStyle dessine comme un bloc de hauteur negative. Il est coupe a
       23h59 le jour ou il commence: la grille de cette application est une
       journee, et un bloc faux est pire qu'un bloc raccourci. */
    const memeJour = dayKey(debut) === dayKey(fin)
    const finMin = memeJour ? minutesLocales(fin) : 1440

    out.push({
      id: `cal:${row.id}`,
      /* Ce que openEditor regarde pour refuser d'ouvrir le formulaire dessus,
         comme goalId et birthdayOf. Une reservation se modifie dans Cal. */
      bookingOf: row.id,
      href: bookingHref(row),
      /* Ce que le bouton doit dire. "Rejoindre" et "Ouvrir dans Cal" ne sont
         pas la meme promesse: l'un ouvre une salle, l'autre une fiche, et un
         bouton "Rejoindre" sur un rendez-vous en personne envoie quelqu'un
         chercher un appel qui n'existe pas. */
      joinable: Boolean(bookingHref({ join_url: row.join_url })),
      title: titre,
      category: 'reservation',
      colour: LAYER_COLOUR.reservations,
      starts_on: dayKey(debut),
      start_min: minutesLocales(debut),
      end_min: Math.max(minutesLocales(debut) + 1, finMin),
      weekdays: [],
      until_on: null,
      location: null,
      excluded_on: [],
    })
  }

  return out
}
