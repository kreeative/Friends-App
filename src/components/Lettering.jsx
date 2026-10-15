import { LETTERING } from '../content/lettering'

/**
 * Le lettrage du logo, sur une ligne, a n'importe quelle taille.
 *
 * Trace depuis la tuile par scripts/lettering.py, qui dit pourquoi un vecteur
 * plutot que le PNG et pourquoi une ligne plutot que deux. Il se peint en
 * currentColor: c'est le parent qui choisit le jaune.
 *
 * Decoratif. Le nom de l'application est ecrit en toutes lettres ailleurs
 * dans le pied de page, et une image de mots lue a voix haute en plus de ces
 * mots serait le nom dit deux fois.
 */
export default function Lettering({ className = '', style }) {
  return (
    <svg
      viewBox={`0 0 ${LETTERING.w} ${LETTERING.h}`}
      aria-hidden="true"
      focusable="false"
      className={className}
      style={style}
      data-hook="lettering"
    >
      <path fill="currentColor" fillRule="evenodd" d={LETTERING.d} />
    </svg>
  )
}
