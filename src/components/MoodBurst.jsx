import { TINTS, burstOf } from '../lib/bursts'

/**
 * La bouffee de particules qui sort d'un sticker quand on le touche.
 *
 * Voir src/lib/bursts.js pour QUI envoie QUOI. Ici, seulement les formes et
 * le montage: un svg de 96 sur 96 pose par-dessus la tuile de 56, deborde de
 * 20 de chaque cote, et chaque particule est un groupe qui porte sa
 * trajectoire (`mp-<fly>`), son retard, et dedans la forme a sa place.
 *
 * Deux groupes par particule et pas un: le groupe exterieur est celui que la
 * feuille de style anime (transform-box: fill-box, origine au centre, donc un
 * scale grandit la particule sur place), le groupe interieur porte la
 * translation qui la met a son point de depart. Sur un seul groupe, les deux
 * transformations se battraient pour la meme propriete.
 *
 * Le composant est remonte a chaque tape par sa `key`, donc tout repart du
 * debut, et il est retire quand la reaction finit, donc rien ne reste a
 * animer sur une grille que plus personne ne touche.
 */

const SHAPES = {
  heart: (c, s) => (
    <path
      transform={`scale(${s})`}
      fill={c}
      d="M0 -2.4C0 -6.2 -5.6 -6.4 -5.6 -1.8C-5.6 1.4 -1.4 4.2 0 6.2C1.4 4.2 5.6 1.4 5.6 -1.8C5.6 -6.4 0 -6.2 0 -2.4Z"
    />
  ),
  star: (c, s) => (
    <path transform={`scale(${s})`} fill={c} d="M0 -6.5L1.7 -1.7L6.5 0L1.7 1.7L0 6.5L-1.7 1.7L-6.5 0L-1.7 -1.7Z" />
  ),
  drop: (c, s) => (
    <path transform={`scale(${s})`} fill={c} d="M0 -6C0 -6 -4.2 -0.8 -4.2 2A4.2 4.2 0 0 0 4.2 2C4.2 -0.8 0 -6 0 -6Z" />
  ),
  puff: (c, s) => <circle r={4.6 * s} fill={c} />,
  bolt: (c, s) => <path transform={`scale(${s})`} fill={c} d="M-1.5 -7.5L3.5 -7.5L0.5 -1.5L4.5 -1.5L-3 7.5L-1 1.5L-5 1.5Z" />,
  ring: (c, s) => <circle r={9 * s} fill="none" stroke={c} strokeWidth="1.6" />,
  glyph: (c, s, text) => (
    <text textAnchor="middle" dominantBaseline="central" fontSize={11 * s} fontWeight="700" fill={c}>
      {text}
    </text>
  ),
}

export default function MoodBurst({ mood }) {
  const parts = burstOf(mood)
  if (parts.length === 0) return null
  /* `data-burst`, pas `data-mood`: ce nom-la est le crochet des TUILES, et une
     sonde qui cherche la tuile "sad" tomberait sur deux elements. */
  return (
    <svg viewBox="0 0 96 96" className="mood-burst" aria-hidden="true" data-hook="mood-burst" data-burst={mood}>
      {parts.map((p, i) => (
        <g key={i} className={`mp mp-${p.fly}`} style={{ animationDelay: `${p.delay}ms` }}>
          <g transform={`translate(${p.at[0]} ${p.at[1]})`}>{SHAPES[p.kind](TINTS[p.tint], p.size, p.text)}</g>
        </g>
      ))}
    </svg>
  )
}
