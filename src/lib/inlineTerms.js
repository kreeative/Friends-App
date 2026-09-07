/* Extension explicite: charge par node dans inlineTerms.test.mjs, qui ne
   resout pas les imports sans extension comme le fait Vite. */
import { GLOSSARY } from '../content/glossary.js'
import { inRegion } from './glossary.js'

/**
 * Reperer les mots a expliquer DANS le paragraphe ou ils sont ecrits.
 *
 * CE QUI A ETE DEMANDE, ET POURQUOI LA LISTE EN BAS NE SUFFISAIT PAS
 *
 *   "Mais surtout dans le learning tu parles de lump sum, y a des gens qui
 *    savent pas, qui ont jamais entendu parler d'ETF etc. Chaque nouveau terme
 *    financier, meme le mot taxes, doit etre defini dans la lecon au niveau du
 *    paragraphe ou il est mentionne."
 *
 * Le bloc "LES MOTS" au bas de la lecon repond a "quels mots ai-je appris".
 * Il ne repond pas a "je bloque sur celui-la, maintenant": il faut savoir
 * qu'il existe, descendre, chercher, remonter, et retrouver sa ligne. La
 * plupart des gens ne le font pas; ils continuent de lire sans comprendre,
 * puis ferment.
 *
 * Donc le mot devient touchable la ou il est ecrit, et la definition s'ouvre
 * sous le paragraphe.
 *
 * POURQUOI ON RECONNAIT LE MOT PLUTOT QUE DE LE BALISER DANS LE TEXTE
 *
 * L'autre solution etait d'ecrire les cours avec des marques, du genre
 * [[fnb]]. Elle a l'air plus sure et elle ne l'est pas: il faudrait reprendre
 * les quatre cours a la main, et chaque phrase ajoutee plus tard oublierait
 * ses marques sans que rien ne le signale. Ici la reconnaissance est faite au
 * rendu, donc une phrase ecrite demain est couverte le jour ou elle est
 * ecrite.
 *
 * LE PRIX DE CE CHOIX, ET COMMENT IL EST PAYE
 *
 * Un motif trop large attrape le mauvais mot. "Action" est un mot francais
 * courant, "solde" est aussi une promotion, "indice" est aussi un indice. Donc
 * une entree n'est reconnue QUE si elle porte un `match` explicite, ecrit pour
 * elle; sans `match`, elle reste dans la liste du bas et n'est jamais
 * detectee dans le texte. Le test verifie que chaque motif attrape son propre
 * terme, et qu'aucun n'attrape les pieges connus.
 *
 * UNE SEULE FOIS PAR LECON
 *
 * Souligner les huit occurrences d'"inflation" ferait une page de liens. La
 * premiere porte l'explication; les suivantes sont du texte, parce qu'a ce
 * moment-la le mot a deja ete explique.
 */

/** Les deux apostrophes qui existent dans ce depot, dans un motif. */
const APOS = '[’\']'

/**
 * Le motif d'une entree, prepare une fois.
 *
 * UN MOTIF PAR LANGUE, parce que la page se lit dans les deux. Le meme
 * paragraphe dit "FNB" en francais et "ETF" en anglais; un seul motif
 * n'attraperait que la moitie des lecteurs, et l'autre moitie verrait un
 * lexique en bas sans jamais voir un mot souligne.
 *
 * Bornes de mot ecrites a la main plutot que `\b`: `\b` ne connait pas les
 * lettres accentuees comme des lettres, donc "marché" se terminerait a
 * "march" et "intérêts" attraperait la fin d'un autre mot.
 *
 * L'apostrophe typographique est acceptee partout ou une droite est ecrite. Le
 * contenu emploie U+2019 et les motifs sont ecrits avec une apostrophe
 * droite: sans cette substitution, "coût d’opportunité" ne serait jamais
 * reconnu, ce qui est le genre de defaut qui ne leve rien et ne se voit pas.
 */
function patternOf(entry, locale) {
  const src = entry?.match?.[locale] ?? entry?.match?.fr
  if (!src) return null
  return new RegExp(`(^|[^\\p{L}\\p{N}])(${src.replace(/'/g, APOS)})(?![\\p{L}\\p{N}])`, 'iu')
}

/**
 * Decouper un texte en segments, dont certains sont des termes.
 *
 * @param text     la phrase a lire
 * @param locale   la langue affichee: les motifs sont ecrits par langue
 * @param country  la region, pour ne pas proposer le CELI a quelqu'un en France
 * @param used     un Set d'identifiants deja expliques plus haut dans la page.
 *                 MUTE: c'est ce qui fait la regle "une seule fois par lecon"
 *                 a travers plusieurs appels, un par paragraphe.
 *
 * @returns un tableau de {text} et de {text, id, entry}
 *
 * Le plus long motif gagne quand deux se chevauchent, parce que "taux
 * d'utilisation" contient "taux" et que reconnaitre le court laisserait le
 * long a moitie souligne.
 */
export function splitTerms(text, { country = 'ca', locale = 'fr', used = new Set() } = {}) {
  const src = typeof text === 'string' ? text : ''
  if (!src) return [{ text: '' }]

  const candidates = []
  for (const [id, entry] of Object.entries(GLOSSARY)) {
    if (used.has(id) || !entry.match || !inRegion(entry, country)) continue
    const re = patternOf(entry, locale)
    const m = re?.exec(src)
    if (!m) continue
    /* m[1] est le caractere qui precede, capture pour ne pas le consommer. */
    const start = m.index + m[1].length
    candidates.push({ id, entry, start, end: start + m[2].length, text: m[2] })
  }

  /* Le plus a gauche d'abord, et a position egale le plus long. */
  candidates.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start))

  const out = []
  let at = 0
  for (const c of candidates) {
    if (c.start < at) continue /* chevauche un terme deja pris */
    if (used.has(c.id)) continue /* pris par un candidat plus a gauche dans CE texte */
    if (c.start > at) out.push({ text: src.slice(at, c.start) })
    out.push({ text: c.text, id: c.id, entry: c.entry })
    used.add(c.id)
    at = c.end
  }
  if (at < src.length) out.push({ text: src.slice(at) })
  return out.length ? out : [{ text: src }]
}

/** Est-ce que ce texte contient au moins un terme a expliquer? */
export function hasTerms(text, opts) {
  return splitTerms(text, { ...opts, used: new Set(opts?.used ?? []) }).some((s) => s.id)
}
