/**
 * Ce qui S'ECHAPPE d'un sticker quand on le touche.
 *
 *   "Where are the new emotions reactions?"
 *
 * Le geste du corps (MOOD_MOTION) et celui du visage (FACES.fx) existaient, et
 * ils etaient courts et petits: un demi-seconde, quelques pourcents de
 * deplacement sur une tuile de 56 pixels. Assez pour qu'un oeil attentif voie
 * "ca a bouge", pas assez pour qu'une personne qui vient de taper voie une
 * REACTION. Une reaction, dans toutes les messageries, c'est aussi quelque
 * chose qui sort du sticker: des coeurs, des etincelles, une goutte de sueur,
 * un point d'interrogation.
 *
 * Donc chaque humeur a sa bouffee: trois ou quatre particules, chacune avec sa
 * forme, sa couleur, sa position de depart autour du corps, sa trajectoire et
 * son retard. Les formes sont dans MoodBurst.jsx, les trajectoires dans
 * index.css (`mp-*`), et cette table est la seule chose a lire pour savoir ce
 * qu'une humeur envoie en l'air.
 *
 * LES POSITIONS sont dans une boite de 96 sur 96 centree sur la tuile de 56:
 * la tuile occupe 20..76, donc un depart a y=14 est juste au-dessus de la
 * tete, et (41,47) et (55,47) sont les deux yeux, la ou une larme part.
 *
 * LES TRAJECTOIRES restent COURTES (20 pixels au plus) parce que la grille vit
 * dans un panneau qui coupe ce qui depasse: 24 pixels de marge en haut, 27
 * de chaque cote d'une tuile. Une particule qui sort du panneau n'est pas une
 * particule, c'est une barre de defilement horizontale.
 *
 * C'est de la decoration: `aria-hidden`, jamais la seule facon de dire quelque
 * chose, et rien de tout ca pour qui a demande moins de mouvement.
 */

/**
 * Combien de temps une tuile reste "en train de reagir" apres la tape.
 *
 * Un minuteur plutot que `animationend`: trois animations jouent en meme temps
 * (le corps, le visage, la bouffee) et aucune n'est la bonne a attendre. Et
 * sous prefers-reduced-motion la bouffee n'existe pas du tout, donc un
 * `animationend` sur elle n'arriverait jamais. Le plus long des gestes fait
 * 1300 ms (Serein respire); le test verifie que rien ne depasse ce chiffre.
 */
export const REACTION_MS = 1400

/** Les trajectoires, une classe `mp-<nom>` chacune dans index.css. */
export const FLIGHTS = ['up', 'upleft', 'upright', 'left', 'right', 'fall', 'slide', 'ring', 'drift']

/**
 * Les couleurs des particules. Des literaux et pas des jetons du theme: une
 * larme est bleue et un coeur est rose dans les deux themes, comme le vert du
 * "present cette semaine" est le meme partout. La fumee et la poussiere sont
 * de l'encre a demi transparente, donc elles suivent le theme toutes seules.
 */
export const TINTS = {
  pink: '#FF007A',
  sun: '#FFB014',
  fire: '#FF5C4D',
  water: '#3AA7F5',
  green: '#6DB33F',
  smoke: 'rgb(20 18 22 / 0.4)',
  grey: 'rgb(20 18 22 / 0.3)',
  dust: 'rgb(20 18 22 / 0.35)',
  ink: 'rgb(20 18 22 / 0.72)',
}

const part = (kind, at, fly, delay = 0, tint = 'ink', size = 1) => ({ kind, at, fly, delay, tint, size })
const heart = (at, fly, delay, tint = 'pink', size) => part('heart', at, fly, delay, tint, size)
const star = (at, fly, delay, tint = 'sun', size) => part('star', at, fly, delay, tint, size)
const drop = (at, fly, delay, tint = 'water', size) => part('drop', at, fly, delay, tint, size)
const puff = (at, fly, delay, tint = 'smoke', size) => part('puff', at, fly, delay, tint, size)
const bolt = (at, fly, delay, tint = 'sun', size) => part('bolt', at, fly, delay, tint, size)
const ring = (at, fly, delay, tint = 'dust', size) => part('ring', at, fly, delay, tint, size)
const glyph = (text, at, fly, delay, size = 1) => ({ ...part('glyph', at, fly, delay, 'ink', size), text })

export const BURSTS = {
  /* Le bout lumineux. */
  joyful: [heart([30, 24], 'upleft', 0), heart([48, 14], 'up', 90), heart([66, 24], 'upright', 180)],
  energized: [
    star([26, 22], 'upleft', 0), star([70, 22], 'upright', 60), bolt([48, 10], 'up', 120),
    star([22, 48], 'left', 200, 'sun', 0.8), star([74, 46], 'right', 240, 'sun', 0.8),
  ],
  excited: [glyph('!', [48, 12], 'up', 0, 1.2), star([28, 26], 'upleft', 120), star([68, 26], 'upright', 120)],
  grateful: [heart([34, 20], 'up', 0, 'pink', 0.9), heart([62, 18], 'up', 160, 'pink', 0.9), ring([48, 48], 'ring', 0)],
  serene: [ring([48, 48], 'ring', 0), ring([48, 48], 'ring', 320)],
  /* Le milieu. */
  neutral: [glyph('…', [48, 14], 'up', 0)],
  nostalgic: [star([30, 22], 'upleft', 0, 'dust'), star([66, 18], 'upright', 140, 'dust'), heart([48, 12], 'up', 260, 'dust', 0.8)],
  sensitive: [drop([41, 47], 'fall', 0), drop([55, 47], 'fall', 220)],
  bored: [glyph('z', [58, 22], 'drift', 0, 0.7), glyph('z', [64, 16], 'drift', 220, 0.9), glyph('z', [71, 10], 'drift', 440, 1.1)],
  sick: [puff([30, 20], 'upleft', 0, 'green'), puff([48, 14], 'up', 120, 'green'), puff([66, 20], 'upright', 240, 'green')],
  confused: [glyph('?', [48, 12], 'up', 0, 1.3), glyph('?', [68, 22], 'upright', 200, 0.9)],
  /* Le bout dur. */
  insecure: [drop([70, 30], 'slide', 0, 'water', 0.9), glyph('…', [48, 14], 'up', 160)],
  stressed: [drop([26, 26], 'upleft', 0), drop([70, 26], 'upright', 60), glyph('!', [48, 10], 'up', 120, 1.1)],
  angry: [puff([34, 18], 'up', 0), puff([48, 12], 'up', 100), puff([62, 18], 'up', 200), bolt([74, 20], 'upright', 140, 'fire')],
  discouraged: [drop([38, 14], 'fall', 0, 'grey'), drop([48, 10], 'fall', 150, 'grey'), drop([58, 14], 'fall', 300, 'grey')],
  sad: [drop([41, 47], 'fall', 0), drop([55, 47], 'fall', 180), drop([41, 47], 'fall', 520)],
  hurt: [star([28, 22], 'upleft', 0), star([48, 12], 'up', 80), star([68, 22], 'upright', 160)],
  guilty: [drop([70, 30], 'slide', 0, 'water', 0.9), glyph('…', [48, 14], 'up', 120)],
}

/** La bouffee d'une humeur, ou rien: une humeur oubliee ici ne fume pas. */
export const burstOf = (id) => BURSTS[id] ?? []
