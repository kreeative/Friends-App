import {
  DECLINED,
  FALLBACK,
  PRONOUN_OPTIONS,
  getUserPronoun,
  isPluralPronoun,
  pronounLabel,
  pronounSet,
} from './pronouns.js'
let pass = 0, fail = 0
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  ok ? pass++ : fail++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`)
}

const p = (pronouns) => ({ display_name: 'Someone', pronouns })
const all = (u) =>
  ['subject', 'object', 'possessive', 'possessivePronoun', 'reflexive'].map((c) =>
    getUserPronoun(u, c),
  )

// ---- the default, and every way of not having answered ---------------------
eq('the fallback is neutral', FALLBACK, 'they/them')
eq('nothing set',      all(p(null)), ['they', 'them', 'their', 'theirs', 'themselves'])
eq('empty string',     all(p('')), ['they', 'them', 'their', 'theirs', 'themselves'])
eq('only spaces',      all(p('   ')), ['they', 'them', 'their', 'theirs', 'themselves'])
eq('no profile at all', all(null), ['they', 'them', 'their', 'theirs', 'themselves'])
// Declining is an answer, and the answer is still the neutral set.
eq('prefer not to say', all(p(DECLINED)), ['they', 'them', 'their', 'theirs', 'themselves'])

// ---- the three sets --------------------------------------------------------
eq('they/them', all(p('they/them')), ['they', 'them', 'their', 'theirs', 'themselves'])
eq('she/her',   all(p('she/her')), ['she', 'her', 'her', 'hers', 'herself'])
eq('he/him',    all(p('he/him')), ['he', 'him', 'his', 'his', 'himself'])
eq('case is ignored', all(p('She/Her')), ['she', 'her', 'her', 'hers', 'herself'])
eq('padding is trimmed', all(p('  he/him  ')), ['he', 'him', 'his', 'his', 'himself'])

// ---- verb agreement --------------------------------------------------------
eq('they takes a plural verb', isPluralPronoun(p('they/them')), true)
eq('she does not',             isPluralPronoun(p('she/her')), false)
eq('he does not',              isPluralPronoun(p('he/him')), false)
eq('unset takes a plural verb', isPluralPronoun(p(null)), true)
// A neopronoun conjugates as a singular, which is how they are actually used.
eq('a custom set is singular', isPluralPronoun(p('ze/hir')), false)

// ---- custom sets -----------------------------------------------------------
// The two forms written down are used; the three that are not are left neutral
// rather than invented, because "zir" cannot be derived from "ze/hir".
eq('two parts', all(p('ze/hir')), ['ze', 'hir', 'their', 'theirs', 'themselves'])
eq('three parts', all(p('ze/hir/hirs')), ['ze', 'hir', 'hirs', 'hirs', 'themselves'])
eq('one part is used for both', all(p('xe')), ['xe', 'xe', 'their', 'theirs', 'themselves'])
eq('extra parts are ignored', getUserPronoun(p('a/b/c/d'), 'object'), 'b')
eq('slashes with spaces', all(p('ze / hir')), ['ze', 'hir', 'their', 'theirs', 'themselves'])
eq('nothing but slashes falls back', all(p('///')), ['they', 'them', 'their', 'theirs', 'themselves'])

// ---- a bare string is accepted too, so callers need no wrapper -------------
eq('a raw string works', getUserPronoun('she/her', 'object'), 'her')

// ---- an unknown case does not crash the sentence ---------------------------
eq('an unknown case is the subject', getUserPronoun(p('he/him'), 'nonsense'), 'he')
eq('no case is the subject',         getUserPronoun(p('he/him')), 'he')

// ---- what a profile shows --------------------------------------------------
eq('unset shows nothing',   pronounLabel(p(null)), null)
eq('declined shows nothing', pronounLabel(p(DECLINED)), null)
eq('a set shows itself',    pronounLabel(p('she/her')), 'she/her')
eq('a custom set shows itself as written', pronounLabel(p('Ze/Hir')), 'Ze/Hir')

// ---- the picker ------------------------------------------------------------
eq('five options', PRONOUN_OPTIONS, ['they/them', 'she/her', 'he/him', 'custom', 'none'])
eq('the set is a whole set', Object.keys(pronounSet(p('she/her'))).sort(), [
  'object', 'plural', 'possessive', 'possessivePronoun', 'reflexive', 'subject',
])

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
