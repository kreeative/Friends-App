import { useId } from 'react'

/**
 * La goutte qui se remplit.
 *
 *   "I don't really like the water bar."
 *
 * Deux barres de suite, une fine avec des pastilles, puis une a cases, et
 * aucune des deux n'etait aimee. Une barre est un objet d'administration: elle
 * dit un pourcentage, pas de l'eau. Le reste de l'application parle en formes
 * pleines et rondes (les stickers, les visages des humeurs), et c'est ce
 * langage-la que l'eau doit parler aussi.
 *
 * Donc une goutte, pleine et plate comme un sticker, qui se remplit par le
 * bas. Le niveau EST la quantite, il n'y a rien a compter, et une goutte se
 * lit "eau" avant meme qu'on ait lu le titre.
 *
 * COMMENT ELLE EST FAITE
 *
 * Une forme de goutte sert trois fois: en fond gris (la piste), en masque
 * (clipPath) pour le liquide, et c'est tout. Le liquide est un rectangle avec
 * une vague sur le dessus, deplace verticalement selon le niveau; la
 * transition sur ce deplacement fait MONTER l'eau quand on boit, et une
 * vaguelette glisse d'une periode en meme temps (`is-slosh`), remontee a
 * chaque geste par sa cle pour repartir du debut.
 *
 * Le liquide est `--c-progress` et pas `--c-accent`: c'est le jeton des
 * jauges partout ailleurs, bleu en theme mer quand le bouton reste rose.
 *
 * LA GEOMETRIE, POUR QUI RETOUCHE
 *
 * Boite 64x80. La pointe est en (32,4), le corps est un cercle de rayon 24
 * centre en (32,50), donc le bas est a y=74 et la hauteur utile fait 70. La
 * crete de la vague est a y=6 dans le groupe du liquide; le groupe est donc
 * deplace de 68 - 70 x niveau pour que le haut de l'eau tombe a 74 - 70 x
 * niveau. A zero on le pousse hors de la goutte, sinon la crete laisserait
 * un fil rose au fond d'une goutte vide.
 */
export const DROP = 'M32 4C32 4 8 32 8 50a24 24 0 0 0 48 0C56 32 32 4 32 4Z'

export function liquidOffset(level) {
  const p = Math.max(0, Math.min(1, Number(level) || 0))
  return p === 0 ? 78 : 68 - 70 * p
}

export default function WaterDrop({ level = 0, pours = 0 }) {
  const id = useId()
  const p = Math.max(0, Math.min(1, Number(level) || 0))
  return (
    <svg
      viewBox="0 0 64 80"
      className="h-20 w-16 shrink-0"
      aria-hidden="true"
      data-hook="water-drop"
      data-level={Math.round(p * 100)}
    >
      <defs>
        <clipPath id={id}>
          <path d={DROP} />
        </clipPath>
      </defs>
      <path d={DROP} className="water-drop-track" />
      <g clipPath={`url(#${id})`}>
        <g className="water-drop-liquid" style={{ transform: `translateY(${liquidOffset(p).toFixed(2)}px)` }}>
          <path
            key={pours}
            data-hook="water-wave"
            className={`water-drop-wave${pours ? ' is-slosh' : ''}`}
            d="M-32 6q8-6 16 0t16 0t16 0t16 0t16 0t16 0v90h-96z"
          />
        </g>
      </g>
      {/* Le reflet: un trait blanc court, comme sur un sticker. */}
      <path d="M18 47q0-9 6-16" className="water-drop-shine" />
    </svg>
  )
}
