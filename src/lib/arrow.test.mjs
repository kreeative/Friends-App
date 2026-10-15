/**
 * node src/lib/arrow.test.mjs
 *
 * "Tes flèches sont mal dessinées." Une pointe est juste quand ses deux
 * traits sont symetriques autour de la direction d'arrivee de la ligne: meme
 * angle de chaque cote, meme longueur. Ce fichier le mesure sur la pointe
 * calculee, et sur l'ancienne pointe ecrite a la main, pour garder la trace
 * de ce qui n'allait pas.
 */
import { head } from './arrow.js'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}

console.log('\narrow heads')

/* Les deux traits d'une pointe: angle de chacun avec la direction d'arrivee
   (en degres, signe compris) et longueur. */
function barbs(from, tip, ends) {
  const travel = Math.atan2(tip[1] - from[1], tip[0] - from[0])
  return ends.map(([x, y]) => {
    const back = Math.atan2(y - tip[1], x - tip[0])
    let d = ((back - (travel + Math.PI)) * 180) / Math.PI
    while (d > 180) d -= 360
    while (d < -180) d += 360
    return { angle: d, len: Math.hypot(x - tip[0], y - tip[1]) }
  })
}

function parse(path) {
  const n = path.match(/-?\d+(?:\.\d+)?/g).map(Number)
  return { a: [n[0], n[1]], tip: [n[2], n[3]], b: [n[4], n[5]] }
}

/* The second and third cases were the hero's looping arrow and the arrow in
   the spinning badge. Both left the page with the badge; their geometry stays
   here as two more directions to check, arriving leftward and up-right. */
const cases = [
  ['the arc on the reasons', [50, 7], [88, 15], 14, 32],
  ['arriving leftward and slightly up', [30, 38], [12, 30], 13, 32],
  ['a straight diagonal up-right, 40 degree barbs', [70, 130], [126, 74], 30, 40],
  ['straight down', [0, 0], [0, 10], 5, 30],
  ['straight left', [10, 0], [0, 0], 5, 45],
]
for (const [name, from, tip, len, spread] of cases) {
  const p = parse(head(from, tip, len, spread))
  ok(`${name}: the head starts at the tip`, p.tip[0] === tip[0] && p.tip[1] === tip[1])
  const [one, two] = barbs(from, tip, [p.a, p.b])
  ok(`${name}: the two strokes mirror each other around the line`,
     Math.abs(one.angle + two.angle) < 0.6, `${one.angle.toFixed(1)} / ${two.angle.toFixed(1)}`)
  ok(`${name}: at the angle asked for`,
     Math.abs(Math.abs(one.angle) - spread) < 0.6 && Math.abs(Math.abs(two.angle) - spread) < 0.6,
     `${one.angle.toFixed(1)} / ${two.angle.toFixed(1)}`)
  ok(`${name}: and of equal length`,
     Math.abs(one.len - len) < 0.2 && Math.abs(two.len - len) < 0.2, `${one.len.toFixed(2)} / ${two.len.toFixed(2)}`)
}

/* L'ancienne pointe, ecrite a la main: 'M90 18l-15-9M90 18l-12 13' au bout de
   'C24 14 56 6 90 18'. Elle est consignee ici pour que le chiffre du message
   de commit reste verifiable. */
{
  const old = barbs([56, 6], [90, 18], [[75, 9], [78, 31]])
  ok('the old hand-written head was lopsided: 12 and 67 degrees off the line',
     Math.round(Math.abs(old[0].angle)) === 12 && Math.round(Math.abs(old[1].angle)) === 67,
     `${old[0].angle.toFixed(1)} / ${old[1].angle.toFixed(1)}`)
}

console.log(`  ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
