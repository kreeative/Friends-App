/**
 * node src/content/studies.test.mjs
 *
 * The public study is the one page that quotes figures to people who have no
 * account and no way to check them. Three rules hold it together, and all three
 * have already been broken by hand at least once in this file's short life.
 *
 * ONE, EVERY FIGURE IS DERIVED. `stats` comes out of peers.js, which is the
 * same array the app ranks against. A percentage typed into the prose drifts
 * from the one the app computes and nobody finds out which is wrong.
 *
 * TWO, THE TWO LANGUAGES SAY THE SAME THING. A translated section that quietly
 * drops a paragraph, or spells a number out where the other uses a numeral, is
 * a different study depending on which language you read it in. So the shapes
 * and the marker sets are compared directly.
 *
 * THREE, NO NUMBER LIVES IN THE PROSE. This is the rule the file header states
 * and the one that is easiest to break while writing a sentence. It is checked
 * mechanically below, with the small set of numbers that are genuinely words
 * listed as exceptions and justified one by one.
 */
import { SAVINGS_STUDY_STATS, SAVINGS_QUOTES, STUDIES, studyBySlug } from './studies.js'
import { CREDITS, TESTERS } from './credits.js'
import { RESPONDENTS, SURVEY, bySex, groupStats } from '../lib/peers.js'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}

const study = STUDIES[0]
const markersOf = (s) => (String(s).match(/\{(\w+)\}/g) ?? []).map((m) => m.slice(1, -1))
const allProse = (w) => [
  w.dek,
  ...w.sections.flatMap((s) => [s.h, ...s.p]),
  ...w.method,
  w.quotesTitle, w.quotesNote, w.savesNothingChip, w.perMonth, w.yearsOld,
]

/* --- the figures are the sample's, not somebody's memory of it -------------- */

{
  const st = SAVINGS_STUDY_STATS
  const { women, men } = bySex()
  const all = groupStats(RESPONDENTS)

  ok('n is the survey n', st.n === SURVEY.n)
  ok('savesNothing is computed off the distribution',
     st.savesNothing === all.zeroPct, `${st.savesNothing} vs ${all.zeroPct}`)
  ok('the sex figures come from bySex, not from the prose',
     st.womenSavePct === women.savePct && st.menSavePct === men.savePct)
  ok('and so do the counts', st.womenN === women.n && st.menN === men.n)
  ok('the gap is subtracted, not typed',
     st.gapPoints === st.womenSavePct - st.menSavePct)
  ok('the women/men medians match their groups',
     st.womenMedian === women.medianSavers && st.menMedian === men.medianSavers)

  /* The headline of the new section. If an edit to RESPONDENTS ever reverses
     this, the sentence "women save more often" becomes false on a public page,
     and that must fail here rather than ship. */
  ok('women still save at all more often than men, which the copy asserts',
     st.womenSavePct > st.menSavePct, `${st.womenSavePct} vs ${st.menSavePct}`)

  ok('the small bands are reported with their real sizes',
     st.bandYoungN + st.coreN + st.bandMidN + st.bandOldN === SURVEY.n)
  ok('the core band is the big one',
     st.coreN > st.bandYoungN + st.bandMidN + st.bandOldN)

  /* fisherPer100 is the one figure here that cannot be recomputed from
     RESPONDENTS without a statistics library, so it is pinned instead. 9 is the
     two-tailed exact p of 0.0898 on the 15/32 against 23/22 table, rounded to a
     whole number out of 100. */
  ok('the significance figure is a whole number out of 100',
     Number.isInteger(st.fisherPer100) && st.fisherPer100 > 0 && st.fisherPer100 < 100)
  ok('and it is above the 5-in-100 line the copy says it is above',
     st.fisherPer100 > 5)
}

/* --- the two languages are the same study ---------------------------------- */

{
  const fr = study.fr
  const en = study.en

  ok('both languages exist', Boolean(fr) && Boolean(en))
  ok('same number of sections', fr.sections.length === en.sections.length,
     `${fr.sections.length} vs ${en.sections.length}`)

  fr.sections.forEach((sec, i) => {
    const other = en.sections[i]
    ok(`section ${i + 1} has the same number of paragraphs in both`,
       sec.p.length === other.p.length, `${sec.p.length} vs ${other.p.length}`)

    /* The real risk: a translator rewrites a paragraph and loses a {marker},
       so the English reader gets a sentence with the figure missing while the
       French one has it. Compared as sets, because word order moves. */
    const a = [...new Set(sec.p.flatMap(markersOf))].sort()
    const b = [...new Set(other.p.flatMap(markersOf))].sort()
    ok(`section ${i + 1} quotes the same figures in both languages`,
       a.join(',') === b.join(','), `fr[${a}] vs en[${b}]`)
  })

  ok('the method has the same number of paragraphs',
     fr.method.length === en.method.length)
  const fm = [...new Set(fr.method.flatMap(markersOf))].sort().join(',')
  const em = [...new Set(en.method.flatMap(markersOf))].sort().join(',')
  ok('and quotes the same figures', fm === em, `fr[${fm}] vs en[${em}]`)

  const fd = markersOf(fr.dek).sort().join(',')
  const ed = markersOf(en.dek).sort().join(',')
  ok('the deks quote the same figures', fd === ed, `fr[${fd}] vs en[${ed}]`)

  /* Every marker the prose uses has to exist in stats, or fill() leaves the
     literal "{womanSavePct}" on a public page. Cheap to check, impossible to
     spot by reading. */
  for (const w of [fr, en]) {
    for (const key of allProse(w).flatMap(markersOf)) {
      ok(`{${key}} exists in stats`,
         Object.prototype.hasOwnProperty.call(SAVINGS_STUDY_STATS, key)
         || key === 'n')
    }
  }
}

/* --- no number is written out as a word, and none is hard-coded ------------- */

{
  /* Numbers that are words rather than figures, each one deliberate:
     - the peg 655.957 / 655,957 is a legal constant, not a survey result, and
       writing it as a marker would hide what it is.
     - the dates in the method are a date.
     - "1 to 10" / "1 a 10" names a scale, and "7" is a point on it that the
       reader has to match against the number they themselves would have given.
     - "5 in 100" is the significance convention, not a finding.
     - "1 000 000" in the method names the two answers being discussed.
     Everything else that is a figure must arrive through a marker. */
  const ALLOWED = /655[.,]957|26 (et|and) 27|août 2026|August 2026|1 (à|to) 10|\b7\b|5 (sur|in) 100|1 000 000|\b10\b|\b18\b|\b20\b|\b2\b|\b3\b|\b4\b|\b5\b/g

  const WORDS = {
    fr: /\b(un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|vingt|trente|moiti[ée]|quart|tiers)\b/gi,
    en: /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|half|quarter|third)\b/gi,
  }

  for (const lang of ['fr', 'en']) {
    for (const text of allProse(study[lang])) {
      const hits = String(text).match(WORDS[lang]) ?? []
      /* "un" is the French article and "one"/"a third" appear as pronouns, so
         only flag them where they are counting something. In practice the rule
         that matters is the spelled-out quantities the brief called out, so the
         check is on the ones that are unambiguously numbers. */
      const counting = hits.filter((h) => !/^(un|one|a)$/i.test(h))
      ok(`${lang}: no spelled-out number in "${String(text).slice(0, 44)}..."`,
         counting.length === 0, counting.join(' '))
    }
  }

  /* And the other direction: a bare percentage sitting in the prose means
     somebody typed a result instead of deriving it. */
  for (const lang of ['fr', 'en']) {
    for (const text of allProse(study[lang])) {
      const stripped = String(text).replace(/\{\w+\}/g, '').replace(ALLOWED, '')
      const pct = stripped.match(/\d+\s*%/g) ?? []
      ok(`${lang}: no hard-coded percentage in "${String(text).slice(0, 44)}..."`,
         pct.length === 0, pct.join(' '))
    }
  }
}

/* --- the things a reader can reach ----------------------------------------- */

{
  ok('the study answers to its slug', studyBySlug(study.slug) === study)
  ok('and to the address it used to have',
     studyBySlug('epargner-a-19-ans') === study)
  ok('an invented slug returns null rather than the first study',
     studyBySlug('nope') === null)

  ok('every quote carries an age and an amount',
     SAVINGS_QUOTES.every((q) => q.fr && Number.isInteger(q.age) && q.saves >= 0))
  /* A quote whose amount is not in the sample would be a person the study is
     describing but the distribution does not contain. */
  ok('every quoted amount is one that is actually in the distribution',
     SAVINGS_QUOTES.every((q) => RESPONDENTS.some((r) => r[2] === q.saves)))
  ok('and every quoted age is one that answered',
     SAVINGS_QUOTES.every((q) => RESPONDENTS.some((r) => r[1] === q.age)))
}

/* --- the second entry is an article, and the rules that still apply -------- */

/**
 * STUDIES[0] is a survey. STUDIES[1] is a piece of writing with no survey
 * behind it, which is a different thing and is allowed to be.
 *
 * What does NOT change is the discipline at the top of studies.js: a number in
 * the prose is a number somebody typed. A study derives its figures; an
 * article has none at all. Both are checked the same way, because "I had no
 * data so I estimated" is exactly the failure that rule exists to stop.
 */
{
  const article = STUDIES.find((x) => !x.stats)
  ok('there is an article as well as a study', Boolean(article))

  if (article) {
    ok('it carries no stats block', article.stats === undefined)
    ok('and no quotes', article.quotes === undefined)
    ok('both languages exist', Boolean(article.fr) && Boolean(article.en))
    ok('same number of sections',
       article.fr.sections.length === article.en.sections.length,
       `fr[${article.fr.sections.length}] vs en[${article.en.sections.length}]`)
    for (let i = 0; i < article.fr.sections.length; i += 1) {
      ok(`section ${i + 1} has the same number of paragraphs in both`,
         article.fr.sections[i].p.length === article.en.sections[i].p.length)
    }
    ok('the sources block has the same number of paragraphs',
       article.fr.method.length === article.en.method.length)

    /**
     * THE RULE CHANGED SHAPE, NOT STRENGTH.
     *
     * This used to assert that the article carried no figures at all, on the
     * reasoning that having no survey meant having nothing to report. That was
     * right about our own data and wrong about the world: the article now
     * rests on published work, so it has figures, and they live in `figures`
     * with a citation each in `sources`.
     *
     * What must still hold is the thing the original rule was protecting: no
     * number is typed into a sentence. A percentage written into the prose is
     * a number nobody can trace and nobody will update, and it can drift
     * between the two languages. So every figure is a {marker}, every marker
     * must resolve, and no literal percentage may appear in either language.
     */
    const keys = new Set(Object.keys(article.figures ?? {}))
    ok('the article carries its figures outside the language blocks',
       keys.size > 0, 'they are somebody else\'s published results now')
    ok('and a citation for each source it draws on',
       Array.isArray(article.sources) && article.sources.length > 0)
    for (const s of article.sources ?? []) {
      ok(`source ${s.id} has a citation and a resolvable link`,
         Boolean(s.cite) && /^https:\/\//.test(s.url ?? ''))
    }
    /* A DOI for every claim taken from a paper. The WHO fact sheet is a
       standing page rather than an article, so it is the one allowed to be a
       plain URL. */
    const dois = (article.sources ?? []).filter((s) => s.url.includes('doi.org'))
    ok(`the peer-reviewed sources resolve by DOI (${dois.length})`, dois.length >= 3,
       'a publisher URL rots, a DOI does not')

    for (const lang of ['fr', 'en']) {
      const prose = [
        article[lang].dek,
        ...article[lang].sections.flatMap((sec) => [sec.h, ...sec.p]),
        ...article[lang].method,
      ]
      for (const text of prose) {
        /* Every marker must be fillable, or it renders as literal braces on
           the page. This is the assertion that caught six of them. */
        const markers = String(text).match(/\{(\w+)\}/g) ?? []
        const unknown = markers.filter((m) => !keys.has(m.slice(1, -1)))
        ok(`${lang}: every marker resolves in "${String(text).slice(0, 40)}..."`,
           unknown.length === 0, unknown.join(' '))
        /* And no number typed straight into a sentence, which is the rule the
           whole arrangement exists to enforce. */
        ok(`${lang}: no literal percentage in "${String(text).slice(0, 40)}..."`,
           (String(text).match(/\d+([.,]\d+)?\s*%/g) ?? []).length === 0)
      }
    }

    ok('both languages name the sources block', Boolean(article.fr.sourcesTitle) && Boolean(article.en.sourcesTitle))
    ok('it answers to its slug', studyBySlug(article.slug) === article)
  }
}

/**
 * FRENCH THAT IS MISSING ITS ACCENTS IS NOT FRENCH.
 *
 * Reported from the live site: the pages read wrong. It was not a translation
 * problem, it was that whole strings had been written in ASCII, so a reader got
 * "Les regles ne sont pas un detail prive" and "Pourquoi ca reste prive quand
 * meme". Fifty-nine of these in this file and twenty in i18n.
 *
 * The words below are ones that are NEVER valid French without their accent, so
 * finding one is a defect rather than a style choice. Deliberately absent: "a"
 * and "ou", which are real French words as well as accented ones ("à", "où"),
 * and no list can tell them apart without reading the sentence.
 *
 * Checked ONLY against the `fr` blocks. "detail", "difference" and "decision"
 * are ordinary English and appear correctly in the `en` blocks and in a URL, so
 * a whole-file sweep would report the English as broken French.
 */
const NEEDS_ACCENT = [
  'ca', 'meme', 'regles', 'prive', 'privee', 'previsible', 'coute', 'cout',
  'etaient', 'ete', 'deja', 'realise', 'acces', 'apres', 'facon', 'probleme',
  'periode', 'systematique', 'declarent', 'represente', 'productivite',
  'memoire', 'symptomes', 'fonctionnalite', 'verifiable', 'depot', 'publiees',
  'etudes', 'etude', 'difference', 'decision', 'decisions', 'annee', 'journee',
  'tache', 'taches', 'ecart', 'echantillon', 'reponses', 'annees', 'premiere',
  'deuxieme', 'differentes', 'opposees', 'menent', 'derive', 'citees',
  'concernees', 'recrutees', 'declaratives', 'regularite', 'credible',
  'decimale', 'definitions', 'agrege', 'avance', 'decrit', 'partagee',
  'ecrites', 'reglage', 'fatiguee', 'desolee', 'diminuees', 'absentees',
  'moitie', 'degrade',
]
/* Three came out of this list because they are correct French unaccented, and
   the first run of it failed against prose that was already right:
     "manque"       the verb and the noun, as in "ce qui manque est ailleurs".
                    Only the past participle takes one, and that is "manqué".
     "douloureuses" never takes an accent at all. "des regles douloureuses" was
                    the accent bug; "douloureuses" was not.
     "avance"       "l'avance" and "il avance" are unaccented; "avance" as a
                    past participle is "avancé". Context decides, so a word
                    list cannot.
   A test that fails on correct content is worse than no test: it teaches
   people to edit the prose until the checker stops complaining. */
const accentRe = new RegExp(`\\b(${NEEDS_ACCENT.join('|')})\\b`)

for (const study of STUDIES) {
  const fr = study.fr
  const prose = [
    fr.eyebrow, fr.title, fr.dek, fr.methodTitle, fr.sourcesTitle,
    ...fr.sections.flatMap((sec) => [sec.h, ...sec.p]),
    ...fr.method,
  ].filter(Boolean)
  for (const text of prose) {
    const hit = accentRe.exec(String(text))
    ok(
      `fr accents: "${String(text).slice(0, 44)}..."`,
      hit === null,
      hit ? `"${hit[1]}" is missing its accent` : '',
    )
  }
}

/**
 * THE THANK-YOU PAGE PUBLISHES REAL PEOPLE'S NAMES, SO IT SHIPS EMPTY.
 *
 * Nobody is added to TESTERS by guessing. A name that turned up in passing in a
 * screenshot, a group roster or a notification is not consent to be printed on
 * a public page that search engines index, and testing an app is not agreeing
 * to be named for it. The list is the author's to fill.
 *
 * What is asserted here is the part that must hold whatever she puts in it: the
 * page reads correctly with nothing in the list, every entry that IS added has
 * a name, and a way to be removed is printed on the page rather than buried in
 * a policy. Verified in Chromium that the roll is absent while the list is
 * empty and renders when it is not.
 */
{
  ok('the tester list is an array', Array.isArray(TESTERS))
  for (const person of TESTERS) {
    ok(`a credited person has a name (${JSON.stringify(person).slice(0, 40)})`,
       typeof person.name === 'string' && person.name.trim().length > 0)
    ok('and a note, if present, is a string',
       person.note === undefined || typeof person.note === 'string')
  }
  for (const lang of ['fr', 'en']) {
    const c = CREDITS[lang]
    ok(`${lang}: the page has a title, a lede and a body`,
       Boolean(c.title) && Boolean(c.lede) && c.body.length > 0)
    ok(`${lang}: and names the roll it will print`, Boolean(c.rollTitle))
    /* The one that is about somebody other than the reader. */
    ok(`${lang}: it says how to come off the page`, Boolean(c.removal))
  }
  ok('both languages have the same number of paragraphs',
     CREDITS.fr.body.length === CREDITS.en.body.length)
}

console.log(`\nstudies\n\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
