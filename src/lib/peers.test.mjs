/**
 * node src/lib/peers.test.mjs
 *
 * Two things carry this file and both are about not lying to somebody.
 *
 * The distribution has to be the one that was collected: 92 answers, 38 of them
 * zero. If a future edit drops the zeroes to make the median look better, every
 * "you beat N %" in the app becomes wrong by 41 points in the direction that
 * flatters the app. That is asserted directly.
 *
 * And the comparison has to REFUSE anybody it does not fit: the wrong currency,
 * the wrong age, no age at all. A benchmark that answers for everybody is a
 * benchmark that is wrong for most of them.
 */
import {
  COMPARABLE,
  MONTHLY_XOF,
  PEG,
  SURVEY,
  appliesTo,
  comparableCurrency,
  medianAll,
  medianSavers,
  peerStanding,
  toXof,
} from './peers.js'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}

/* --- the sample is the sample ---------------------------------------------- */

{
  ok('92 answers, as fielded', MONTHLY_XOF.length === 92, String(MONTHLY_XOF.length))
  ok('and SURVEY.n agrees with the array', SURVEY.n === MONTHLY_XOF.length)
  const zeros = MONTHLY_XOF.filter((v) => v === 0).length
  ok('38 of them saved nothing', zeros === 38, String(zeros))
  ok('which is the 41 % the copy quotes',
     Math.round((zeros / MONTHLY_XOF.length) * 100) === SURVEY.savesNothingPct,
     `${Math.round((zeros / 92) * 100)} vs ${SURVEY.savesNothingPct}`)
  ok('sorted ascending, because peerStanding and median both assume it',
     MONTHLY_XOF.every((v, i) => i === 0 || MONTHLY_XOF[i - 1] <= v))
  ok('nothing negative', MONTHLY_XOF.every((v) => v >= 0))
  ok('every value is a whole number of XOF', MONTHLY_XOF.every((v) => Number.isInteger(v)))
}
{
  ok('the median of everybody is 10 000', medianAll() === 10000, String(medianAll()))
  /* The kinder number, and the one the report leads with. The gap between the
     two IS the finding: half the sample is at or under 10 000 because 41 % are
     at zero. */
  ok('the median among savers is 44 500', medianSavers() === 44500, String(medianSavers()))
  ok('and the two are not the same number', medianAll() !== medianSavers())
}

/* --- the peg is arithmetic, not a guess ------------------------------------ */

{
  ok('the CFA peg is the legal one', PEG === 655.957)
  ok('XOF and XAF are one to one', COMPARABLE.XOF === 1 && COMPARABLE.XAF === 1)
  ok('and the euro converts at the peg', COMPARABLE.EUR === PEG)
  ok('no other currency is comparable', Object.keys(COMPARABLE).length === 3,
     Object.keys(COMPARABLE).join())
  /* Every currency in this app is stored with two implied decimals, including
     the ones with no minor unit. 20 000 XOF is 2 000 000 cents. */
  ok('cents to XOF divides by a hundred', toXof(2000000, 'XOF') === 20000, String(toXof(2000000, 'XOF')))
  ok('100 EUR is 65 595.7 XOF', Math.round(toXof(10000, 'EUR')) === 65596,
     String(toXof(10000, 'EUR')))
  ok('lower case is accepted', toXof(2000000, 'xof') === 20000)
  ok('an uncomparable currency is null, never zero', toXof(2000000, 'CAD') === null)
  ok('and so is a missing one', toXof(2000000) === null)
  ok('comparableCurrency agrees', comparableCurrency('EUR') && !comparableCurrency('USD'))
  ok('and survives nonsense', !comparableCurrency(null) && !comparableCurrency(''))
}

/* --- where somebody stands -------------------------------------------------- */

{
  /* Saving nothing beats nobody. Counting the other 37 zeroes as "beaten"
     would tell somebody who saved nothing that they are ahead of 40 % of the
     room, which is the single most misleading thing this file could say. */
  const z = peerStanding(0, 'XOF')
  ok('zero beats nobody', z.beats === 0, String(z.beats))
  ok('and is reported as saving nothing', z.savesNothing === true)
  ok('and ties with the 38 in the sample who also did', z.ties === 38, String(z.ties))
}
{
  /* 5 000 XOF is above the 38 zeroes and nothing else. */
  const s = peerStanding(500000, 'XOF')
  ok('5 000 beats exactly the 38 who saved nothing', s.below === 38, String(s.below))
  ok('which reads as 41 %', s.beats === 41, String(s.beats))
  ok('and is not "saves nothing"', s.savesNothing === false)
  ok('ties counted separately, not folded in', s.ties === 6, String(s.ties))
}
{
  const top = peerStanding(100000000, 'XOF')  /* 1 000 000 XOF, the joint maximum */
  ok('the top of the sample beats 90', top.beats === 98, String(top.beats))
  ok('and does not claim to beat everybody, because two people tied there',
     top.below === 90 && top.ties === 2, `${top.below}/${top.ties}`)
}
{
  /* The same amount expressed in euros must land in the same place. 100 EUR is
     65 596 XOF, which sits above the four answers of 65 600? No: below them. */
  const eur = peerStanding(10000, 'EUR')
  const xof = peerStanding(Math.round(toXof(10000, 'EUR')) * 100, 'XOF')
  ok('a euro amount is placed by the peg, not by its face value',
     eur.below === 73 && eur.beats === 79, `${eur.below}/${eur.beats}`)
  ok('and agrees with the same amount typed in XOF', eur.below === xof.below,
     `${eur.below} vs ${xof.below}`)
}
{
  ok('an uncomparable currency refuses rather than guessing',
     peerStanding(500000, 'CAD') === null)
  ok('a negative amount refuses', peerStanding(-100, 'XOF') === null)
  ok('so does a non-number', peerStanding(NaN, 'XOF') === null)
  ok('and undefined', peerStanding(undefined, 'XOF') === null)
  ok('n is carried so the screen can name the sample size',
     peerStanding(0, 'XOF').n === 92)
}
{
  /* Monotonic: saving more can never place you lower. Checked across the whole
     range rather than at a few points, because an off-by-one in the comparison
     would show up as a single non-monotonic step somewhere in the middle. */
  let broke = null
  let prev = -1
  for (let xof = 0; xof <= 1100000; xof += 500) {
    const b = peerStanding(xof * 100, 'XOF').beats
    if (b < prev) { broke = `${xof} went from ${prev} to ${b}`; break }
    prev = b
  }
  ok('saving more never places you lower, 0 to 1 100 000 XOF', broke === null, broke ?? '')
}

/* --- who it is allowed to answer for ---------------------------------------- */

{
  ok('a 19-year-old in XOF is exactly who this is for',
     appliesTo({ age: 19, currency: 'XOF' }).ok === true)
  /* The diaspora case: they said Cote d'Ivoire and they count in euros. */
  ok('so is a 24-year-old who picked CI and counts in euros',
     appliesTo({ age: 24, currency: 'EUR', country: 'CI' }).ok === true)
  /* The peg makes the arithmetic exact. It does not make the comparison
     relevant to a student in Paris who never said anything about CI. */
  const far = appliesTo({ age: 19, currency: 'EUR' })
  ok('but a euro user who never said where is refused',
     far.ok === false && far.why === 'country', JSON.stringify(far))
  ok('and CFA needs no country, being answer enough on its own',
     appliesTo({ age: 19, currency: 'XAF' }).ok === true)
  ok('30 is the edge and is included',
     appliesTo({ age: 30, currency: 'XOF' }).ok === true)

  /* Three quarters of the sample is 18 to 20. Telling a 45-year-old where they
     stand against that is true and misleading, which is the thing this codebase
     keeps refusing to be. */
  const old = appliesTo({ age: 45, currency: 'XOF' })
  ok('a 45-year-old is refused', old.ok === false && old.why === 'age', JSON.stringify(old))

  const cur = appliesTo({ age: 19, currency: 'CAD' })
  ok('a dollar user is refused for the currency, not the age',
     cur.ok === false && cur.why === 'currency', JSON.stringify(cur))

  /* Guessing that an unknown user is young in order to show them a feature is
     deciding what is true from what is convenient. */
  const none = appliesTo({ currency: 'XOF' })
  ok('no birthday means no comparison', none.ok === false && none.why === 'no-age')
  ok('and an empty call refuses rather than throwing', appliesTo().ok === false)
}

/* --- the claims the copy is allowed to make --------------------------------- */

{
  ok('the survey names its own basis so it cannot be mistaken for a rate',
     SURVEY.basis === 'self-reported-monthly-amount')
  ok('and carries the month it was fielded', SURVEY.fielded === '2026-08')
  ok('median age 19', SURVEY.medianAge === 19)
  ok('87 % already had an app, which is the whole point',
     SURVEY.hasAppPct === 87)
  ok('67 % had an ambition', SURVEY.hasAmbitionPct === 67)
  ok('difficulty median 6 of 10', SURVEY.difficultyMedian === 6)
  ok('the age range is the real one', SURVEY.ageRange[0] === 15 && SURVEY.ageRange[1] === 32)
  ok('women and men sum to n', SURVEY.women + SURVEY.men === SURVEY.n)
}

console.log(`\npeers\n\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
