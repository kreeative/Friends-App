import { useT } from '../lib/i18n'
import { ESTIMATES, arcPath, dayAngle, polar } from '../lib/cycleRing'

/**
 * L'anneau du cycle, dessine. La geometrie est dans src/lib/cycleRing.js.
 *
 * DANS LES COULEURS DE L'APPLICATION, ET PLUS EN ROUGE.
 *
 *   "i still dont like the design" -> trois maquettes -> "c"
 *
 * La premiere version empruntait aux pastilles du calendrier leurs deux
 * couleurs, le rouge des erreurs pour les regles et le rose pour le reste,
 * avec des pointilles pour les estimations. Juste, et clinique: un anneau
 * rouge et pointille au milieu d'une application rose et jaune. La direction
 * choisie est la marque: les regles dans le rose de la marque (--c-mark),
 * la fenetre fertile en lavande et les jours d'avant en abricot, les
 * pastels des evenements du calendrier, les regles attendues en rose
 * pastel, et le point du jour en jaune (--c-field) cercle d'encre. Tout en
 * trait plein.
 *
 * CE QUI DISTINGUE ENCORE UN FAIT D'UNE ESTIMATION. Plus les pointilles,
 * donc l'epaisseur: les regles enregistrees sont le trait le plus epais,
 * les estimations sont plus fines. Et le nom, toujours: la legende nomme
 * chaque couleur, la carte de phase nomme la phase, le nom parle du SVG dit
 * le jour. Aucune information n'est portee par la teinte seule (1.4.1).
 *
 * Les pastilles de phase (PHASE_DOT) sont les tons PROFONDS des memes
 * teintes, parce qu'une pastille de 8 px porte de l'information et doit
 * tenir 3:1 (1.4.11): examen-deep 4,9:1 et travail-deep 3,2:1 sur blanc. Le
 * calendrier les importe d'ici, donc le tiroir, la carte du profil, la
 * carte du calendrier et la grille disent la meme couleur pour la meme
 * phase.
 *
 * Les couleurs passent par style={{ stroke }} et pas par l'attribut: un
 * attribut de presentation SVG ne resout pas var().
 */

/* Les pastilles, en tons profonds, et toujours en chaines entieres: Tailwind
   lit le texte source et ne construit pas `bg-${token}`. */
export const PHASE_DOT = {
  period: 'bg-mark',
  predicted: 'border-2 border-mark bg-transparent',
  pms: 'bg-ev-travail-deep',
  fertile: 'bg-ev-examen-deep',
  today: 'border-2 border-ink bg-field',
}

/* Les fonds pastel des cartes et des pastilles de legende, par phase. */
export const PHASE_TINT = {
  period: 'bg-ev-cours',
  predicted: 'bg-ev-cours',
  pms: 'bg-ev-travail',
  fertile: 'bg-ev-examen',
  today: 'bg-field',
}

const STROKE = {
  period: 'rgb(var(--c-mark))',
  predicted: 'rgb(var(--c-ev-cours))',
  pms: 'rgb(var(--c-ev-travail))',
  fertile: 'rgb(var(--c-ev-examen))',
}

const LEGEND_ORDER = ['period', 'fertile', 'pms', 'predicted']

export default function CycleRing({ model, size = 220, compact = false, legend = false, sticker = null, className = '' }) {
  const { t } = useT()
  if (!model) return null
  const { length, day, marker, segments } = model
  const C = 100
  const R = 80
  const W = compact ? 12 : 16
  /* Sous 96 px, le centre ne tient que le nombre: "JOUR / 19 / sur 29" sur
     trois lignes deborderait d'un disque de 60 px. Le nom parle (aria)
     porte la phrase entiere quelle que soit la taille. */
  const tiny = size < 96
  const dot = polar(C, C, R, dayAngle(marker, length))
  const kinds = new Set(segments.map((s) => s.kind))
  const aria = t('cycle.ring_aria', { n: day, len: length })

  return (
    <div className={`flex flex-col items-center ${className}`} data-hook="cycle-ring" data-day={day} data-length={length}>
      <div className="ring-in relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 200 200" role="img" aria-label={aria} className="absolute inset-0 h-full w-full">
          <circle cx={C} cy={C} r={R} fill="none" strokeWidth={W} style={{ stroke: 'rgb(var(--c-ink) / 0.06)' }} />
          {segments.map((s) => (
            <path
              key={`${s.kind}-${s.from}`}
              d={arcPath(C, C, R, s.from, s.to, length)}
              fill="none"
              strokeWidth={ESTIMATES.has(s.kind) ? W - 4 : W}
              strokeLinecap="round"
              data-segment={s.kind}
              style={{ stroke: STROKE[s.kind] }}
            />
          ))}
          <circle
            className="ring-marker"
            cx={dot.x}
            cy={dot.y}
            r={compact ? 6.5 : 8.5}
            strokeWidth={compact ? 2.4 : 3}
            style={{ fill: 'rgb(var(--c-field))', stroke: 'rgb(var(--c-ink))' }}
            data-hook="cycle-marker"
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center" aria-hidden="true">
          {tiny ? (
            <span className="block text-h2 font-semibold leading-none text-ink">{day}</span>
          ) : (
            <div>
              <span className="block text-label font-semibold uppercase tracking-[0.06em] text-muted">
                {t('cycle.day_word')}
              </span>
              <span className={`block font-semibold leading-none text-ink ${compact ? 'text-h1' : 'text-metric'}`}>{day}</span>
              <span className={`block text-muted ${compact ? 'text-label' : 'text-small'}`}>{t('cycle.of_len', { n: length })}</span>
            </div>
          )}
        </div>
        {/* Un sticker pose a cote de l'anneau, comme sur les cartes de groupe:
            c'est ce qui dit que cet ecran est de la meme application que les
            autres. Decoratif, donc cache aux lecteurs d'ecran.

            A COTE, PAS DESSUS. La premiere position (gauche -7 %, largeur 32 %)
            mordait sur l'anneau en bas a gauche, et le point jaune du jour y
            passe du jour 17 au jour 22 d'un cycle de 29: pendant cinq jours
            par cycle, le seul fait de l'anneau etait cache sous le decor. Le
            point parcourt tout le cercle (rayon 80, il atteint 90 avec son
            trait), donc le sticker doit rester hors du rayon 90 quel que soit
            le jour. Avec ces nombres, la boite du sticker une fois tournee de
            12 degres a son coin le plus proche a 94 du centre (unites de la
            viewBox, pour 200). Mesure dans le probe aux jours 19 et 28: les
            deux boites ne se croisent pas. */}
        {sticker && (
          <img
            src={sticker}
            alt=""
            aria-hidden="true"
            data-hook="cycle-sticker"
            className="pointer-events-none absolute"
            style={{ left: -size * 0.2, bottom: -size * 0.03, width: size * 0.28, rotate: '-12deg', filter: 'drop-shadow(0 6px 10px rgb(0 0 0 / 0.15))' }}
          />
        )}
      </div>

      {legend && (
        <ul className="mt-4 flex flex-wrap justify-center gap-2" data-hook="cycle-legend">
          {[...LEGEND_ORDER.filter((k) => kinds.has(k)), 'today'].map((k) => (
            <li key={k} className={`flex items-center gap-1.5 rounded-pill px-3 py-1 text-label font-semibold text-ink ${PHASE_TINT[k]}`}>
              <span className={`h-2 w-2 shrink-0 rounded-pill ${PHASE_DOT[k]}`} aria-hidden="true" />
              {k === 'today' ? t('cycle.today_label') : t(`cycle.phase_${k}`)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
