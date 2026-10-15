/**
 * La pointe d'une fleche, posee sur la direction de sa courbe.
 *
 *   "Tes flèches sont mal dessinées."
 *
 * Elles l'etaient, et ca se mesure (arrow.test.mjs le refait). La pointe de la
 * premiere fleche etait ecrite a la main: deux traits a 12 et 67 degres de la
 * ligne a son bout, au lieu de deux traits symetriques. La tete partait de
 * travers et la fleche avait l'air cassee.
 *
 * Une pointe se calcule. Une courbe de Bezier arrive sur son bout dans la
 * direction de son dernier point de controle vers ce bout; un segment droit,
 * dans la direction de son debut vers son bout. Les deux traits repartent en
 * arriere de chaque cote de cette direction, a angle egal et de meme longueur.
 * Toutes les fleches du site passent par ici (src/components/StickerKit.jsx).
 *
 * Pur et sans import, pour que node le teste pour de vrai: StickerKit importe
 * art.js, qui ne se charge que dans un bundler.
 *
 * @param from    le dernier point de controle, ou le debut d'un segment droit
 * @param tip     le bout de la fleche
 * @param len     la longueur de chaque trait
 * @param spread  l'angle de chaque trait avec la ligne, en degres
 * @returns       un morceau de chemin SVG: trait, bout, trait
 */
export function head(from, tip, len, spread = 32) {
  const a = Math.atan2(tip[1] - from[1], tip[0] - from[0])
  const end = (side) => {
    const b = a + Math.PI + (side * spread * Math.PI) / 180
    return `${(tip[0] + len * Math.cos(b)).toFixed(1)} ${(tip[1] + len * Math.sin(b)).toFixed(1)}`
  }
  return `M${end(1)}L${tip[0]} ${tip[1]}L${end(-1)}`
}
