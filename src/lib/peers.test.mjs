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
  RESPONDENTS,
  SURVEY,
  appliesTo,
  byAgeBand,
  byOutcome,
  bySex,
  comparableCurrency,
  groupStats,
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

/* --- the rows are the source, everything else is derived from them ---------- */

{
  ok('92 rows, one per answer', RESPONDENTS.length === SURVEY.n)
  ok('and MONTHLY_XOF is their third column, not a second copy',
     MONTHLY_XOF.length === RESPONDENTS.length)

  /* The whole reason for storing rows is that the app's ranking and the study's
     breakdown must be the same sample. If a row is edited and the sorted list
     stops matching, this is where it shows. */
  const resorted = RESPONDENTS.map((r) => r[2]).sort((a, b) => a - b)
  ok('the sorted amounts are exactly MONTHLY_XOF',
     resorted.every((v, i) => v === MONTHLY_XOF[i]))
  ok('MONTHLY_XOF is ascending, which peerStanding walks',
     MONTHLY_XOF.every((v, i) => i === 0 || MONTHLY_XOF[i - 1] <= v))

  ok('every row has a sex the breakdown knows',
     RESPONDENTS.every((r) => r[0] === 'f' || r[0] === 'h'))
  ok('every row has an age inside the stated range',
     RESPONDENTS.every((r) => r[1] >= SURVEY.ageRange[0] && r[1] <= SURVEY.ageRange[1]))
  ok('every row has a difficulty on the 1-to-10 scale that was asked',
     RESPONDENTS.every((r) => Number.isInteger(r[3]) && r[3] >= 1 && r[3] <= 10))
  ok('no negative amounts', RESPONDENTS.every((r) => r[2] >= 0))

  /* SURVEY.women and SURVEY.men are written down separately and are what the
     method paragraph quotes. They have to be a count of these rows. */
  ok('the stated count of women is the number of rows',
     RESPONDENTS.filter((r) => r[0] === 'f').length === SURVEY.women)
  ok('and so is the count of men',
     RESPONDENTS.filter((r) => r[0] === 'h').length === SURVEY.men)
}

/* --- the breakdowns the public study publishes ------------------------------ */

{
  const all = groupStats(RESPONDENTS)
  ok('the whole sample still saves nothing 41 % of the time',
     all.zeroPct === SURVEY.savesNothingPct, `got ${all.zeroPct}`)
  ok('and the savers median is still 44 500',
     all.medianSavers === medianSavers(), `got ${all.medianSavers}`)
  ok('difficulty median 6 across everybody',
     all.difficulty === SURVEY.difficultyMedian)

  const { women, men } = bySex()

  /* THE RESULT THE STUDY LEADS WITH. Women save at all more often than men.
     Asserted as the direction plus both figures, so a wrong edit to a row
     cannot quietly reverse a sentence on a public page. */
  ok('more women than men put something aside',
     women.savePct > men.savePct, `${women.savePct} vs ${men.savePct}`)
  ok('women: 68 % save something, 32 % nothing',
     women.savePct === 68 && women.zeroPct === 32, JSON.stringify(women))
  ok('men: 49 % save something, 51 % nothing',
     men.savePct === 49 && men.zeroPct === 51, JSON.stringify(men))
  ok('the two groups are the whole sample', women.n + men.n === SURVEY.n)

  /* THE RESULT THE STUDY REFUSES TO LEAD WITH. Among savers the men's median is
     higher, and a Mann-Whitney on the two gives z = -1.29, which is well inside
     the noise for n = 32 and n = 22. The page prints both medians and says so.
     This asserts the gap exists in the data, NOT that it means anything. */
  ok('among savers the men median higher, which the copy calls unproven',
     men.medianSavers > women.medianSavers,
     `${men.medianSavers} vs ${women.medianSavers}`)
  ok('women savers median 30 000', women.medianSavers === 30000)
  ok('men savers median 50 000', men.medianSavers === 50000)

  /* The null result, which is half the point: saving is rated exactly as hard
     by both, so the behaviour gap is not a reported-difficulty gap. */
  ok('both sexes rate the difficulty the same',
     women.difficulty === men.difficulty && women.hardPct === men.hardPct,
     `${women.difficulty}/${women.hardPct} vs ${men.difficulty}/${men.hardPct}`)

  const bands = byAgeBand()
  ok('four age bands', bands.length === 4)
  ok('the bands account for everybody exactly once',
     bands.reduce((s, b) => s + b.n, 0) === SURVEY.n)
  const core = bands.find((b) => b.id === '18-20')
  ok('18-20 is 69 of the 92, which is why it is the only band quoted alone',
     core.n === 69)
  ok('and it reproduces the whole sample rather than departing from it',
     Math.abs(core.zeroPct - all.zeroPct) <= 3, `${core.zeroPct} vs ${all.zeroPct}`)

  /* The guard against the most tempting wrong headline on this page. The 25+
     band has a savers median of 125 000, nearly three times the sample, off
     FOUR people. If a future edit ever quotes a band median, this says out loud
     how many people it rests on. */
  const oldest = bands.find((b) => b.id === '25+')
  ok('the 25+ band is 5 people and is never quoted as a finding', oldest.n === 5)
  ok('the small bands are all reported with an n', bands.every((b) => b.n > 0))

  const { zero, saving } = byOutcome()
  ok('those who save nothing rate it harder than those who save',
     zero.difficulty > saving.difficulty, `${zero.difficulty} vs ${saving.difficulty}`)
  ok('7 for the first group, 6 for the second, which is what the copy says',
     zero.difficulty === 7 && saving.difficulty === 6)

  ok('groupStats refuses an empty slice rather than dividing by zero',
     groupStats([]) === null && groupStats() === null)
}

console.log(`\npeers\n\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
