/**
 * node src/lib/courses.test.mjs
 *
 * Deux choses sont verifiees ici et elles ne se ressemblent pas. La navigation,
 * qui est du code, et la forme du contenu, qui est de la prose et qui casse
 * silencieusement: une lecon a qui il manque un champ ne leve rien, elle
 * affiche du vide.
 */
import { COUNTRIES, COUNTRY_ANSWERS, COURSES } from '../content/courses.js'
import { DEFAULT_COUNTRY, SOURCE_LOCALE, countryLabel, courseBySlug, hasRegions, lessonById, lessonsOf, modulesOf, neighbours, progressOf, safeCountry, say, variantFor } from './courses.js'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}
const eq = (name, a, b) => ok(name, a === b, `got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`)

console.log('\ncourses')

/* --- les regions --------------------------------------------------------- */
eq('quatre regions', COUNTRIES.length, 4)
eq('des identifiants uniques', new Set(COUNTRIES.map((c) => c.id)).size, 4)
ok('chacune a un drapeau et un nom', COUNTRIES.every((c) => c.flag && c.label))
ok('chacune a sa phrase de bienvenue', COUNTRIES.every((c) => COUNTRY_ANSWERS[c.id]))
ok('la region par defaut existe', COUNTRIES.some((c) => c.id === DEFAULT_COUNTRY))

eq('une region inconnue retombe sur le defaut', safeCountry('xx'), DEFAULT_COUNTRY)
eq('null aussi', safeCountry(null), DEFAULT_COUNTRY)
eq('rien aussi', safeCountry(), DEFAULT_COUNTRY)
eq('une region connue est gardee', safeCountry('af'), 'af')
ok('le libelle porte le drapeau', countryLabel('af').includes('🌍'), countryLabel('af'))
/* Et le NOM, pas l'objet qui le contient. Les deux assertions precedentes
   passaient sur "[object Object]": l'une cherchait le drapeau, qui etait bien
   la, l'autre cherchait le mot "undefined". Une assertion peut etre vraie et
   ne rien prouver. */
ok('et le nom de la region, pas son objet',
   countryLabel('us').includes('États-Unis'), countryLabel('us'))
ok('dans la langue demandee',
   countryLabel('us', 'en').includes('United States'), countryLabel('us', 'en'))
ok('et jamais un objet imprime', !/\[object/.test(countryLabel('af')), countryLabel('af'))
ok('et une region inconnue ne rend pas undefined',
   !countryLabel('xx').includes('undefined'), countryLabel('xx'))

/* --- les cours ----------------------------------------------------------- */
ok('au moins deux cours', COURSES.length >= 2)
eq('des slugs uniques', new Set(COURSES.map((c) => c.slug)).size, COURSES.length)
ok('un cours inconnu rend null', courseBySlug('rien-du-tout') === null)

for (const course of COURSES) {
  const all = lessonsOf(course)
  ok(`${course.slug}: des identifiants de lecon uniques`,
     new Set(all.map((l) => l.id)).size === all.length)
  ok(`${course.slug}: chaque lecon a un titre`, all.every((l) => say(l.title).length > 2))
  ok(`${course.slug}: chaque lecon declare son etat`,
     all.every((l) => l.state === 'written' || l.state === 'plan'),
     all.filter((l) => !['written', 'plan'].includes(l.state)).map((l) => l.id).join(', '))

  /**
   * LA VERIFICATION QUI COMPTE VRAIMENT.
   *
   * Une lecon marquee 'written' doit porter de quoi remplir une page. Sans
   * ceci, oublier `points` sur une lecon donne un ecran avec un titre, un
   * sous-titre et rien dessous, ce qui ne leve aucune erreur et ne se voit
   * qu'en ouvrant la bonne lecon sur le bon appareil.
   */
  for (const l of all.filter((x) => x.state === 'written')) {
    const hasBody = Array.isArray(l.points) ? l.points.length >= 2 : Boolean(l.byCountry)
    ok(`${course.slug} ${l.id}: une lecon ecrite a un corps`, hasBody)
    if (Array.isArray(l.points)) {
      ok(`${course.slug} ${l.id}: chaque point a une accroche et un texte`,
         l.points.every((p) => say(p.lead) && say(p.body)))
    }
  }

  /* Une lecon en plan a le droit d'etre courte, mais pas muette: elle porte
     au moins la phrase qui dit de quoi elle parlera. */
  for (const l of all.filter((x) => x.state === 'plan')) {
    ok(`${course.slug} ${l.id}: une lecon en plan annonce quand meme son sujet`,
       Boolean(l.sub))
  }
}

/* --- les deux langues ---------------------------------------------------- */

/**
 * LE TEST QUI EMPECHE LA DERIVE.
 *
 * Le contenu a ete ecrit en francais et traduit apres coup. Sans ce test, la
 * prochaine lecon ajoutee n'aura qu'une langue, say() rendra sagement le
 * francais a un anglophone, et personne ne s'en apercevra: il n'y a ni erreur,
 * ni case vide, juste une phrase dans la mauvaise langue au milieu d'une page
 * anglaise. C'est exactement le genre de manque qui se decouvre par un
 * utilisateur plutot que par une console.
 *
 * Il liste ce qui manque au lieu de dire "quelque chose manque", parce qu'un
 * echec qui ne nomme pas la lecon coute une demi-heure a diagnostiquer.
 */
{
  const missing = []
  const walk = (node, path) => {
    if (node === null || node === undefined) return
    if (typeof node === 'string') return
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${path}[${i}]`))
      return
    }
    if (typeof node !== 'object') return
    /**
     * Une feuille de contenu est un objet dont `fr` est une CHAINE.
     *
     * Le test de la seule presence de la cle ne suffit pas, et la premiere
     * version s'y est fait prendre: byCountry et COUNTRY_ANSWERS sont indexes
     * par region, et l'une des regions s'appelle `fr`. Le marcheur voyait une
     * cle `fr`, croyait tenir une phrase francaise, et signalait deux faux
     * positifs. Pire, il s'arretait la et ne descendait jamais dans la version
     * francaise de la lecon, donc il aurait pu MASQUER de vrais manques.
     *
     * Une phrase est une chaine; une carte de regions contient des objets. La
     * distinction est nette et ne demande aucune convention de nommage.
     */
    if (typeof node[SOURCE_LOCALE] === 'string') {
      if (!node.en || String(node.en).trim() === '') missing.push(path)
      return
    }
    for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`)
  }

  for (const course of COURSES) walk(course, course.slug)
  walk(COUNTRY_ANSWERS, 'COUNTRY_ANSWERS')
  walk(COUNTRIES, 'COUNTRIES')

  ok('tout le contenu existe dans les deux langues', missing.length === 0,
     missing.slice(0, 12).join(', ') + (missing.length > 12 ? ` (+${missing.length - 12})` : ''))

  /**
   * ET LA PREUVE QUE LE MARCHEUR A REGARDE QUELQUE CHOSE.
   *
   * Sans ce compte, un marcheur casse qui ne descend nulle part trouve zero
   * manque et passe le test avec les honneurs. C'est la meme classe d'erreur
   * que la mesure de contraste qui annoncait Infinity:1 sans photographier un
   * seul pixel.
   */
  let leaves = 0
  const count = (node) => {
    if (!node || typeof node !== 'string' && typeof node !== 'object') return
    if (typeof node === 'string') return
    if (Array.isArray(node)) return node.forEach(count)
    if (typeof node[SOURCE_LOCALE] === 'string') { leaves += 1; return }
    Object.values(node).forEach(count)
  }
  COURSES.forEach(count)
  count(COUNTRY_ANSWERS)
  count(COUNTRIES)
  ok('et il a bien parcouru tout le contenu', leaves > 150, `${leaves} phrases visitees`)
}

/* say() lui-meme: le repli est ce qui evite une case vide, et il faut qu'il
   soit teste sinon on ne saura jamais s'il a jamais servi. */
eq('say rend la langue demandee', say({ fr: 'oui', en: 'yes' }, 'en'), 'yes')
eq('et le francais par defaut', say({ fr: 'oui', en: 'yes' }), 'oui')
eq('une traduction manquante retombe sur la source',
   say({ fr: 'oui' }, 'en'), 'oui')
eq('une chaine nue passe telle quelle', say('brut', 'en'), 'brut')
eq('rien du tout rend une chaine vide, pas undefined', say(null, 'en'), '')
eq('ni pour un champ absent', say(undefined, 'en'), '')

/* --- l'ordre des modules ------------------------------------------------- */

/**
 * Un cours qui commence au module 3, c'est ce qui a ete rapporte.
 *
 * La cause n'etait pas un tri manquant mais un numero venu d'ailleurs: le
 * module s'appelait 3 parce que la demande disait "Module 3 : Investir 101",
 * alors qu'il ouvre son propre cours. Le tri est la ceinture: il rend
 * impossible qu'un module ajoute au mauvais endroit du fichier apparaisse au
 * milieu du cours.
 */
for (const course of COURSES) {
  const ns = modulesOf(course).map((m) => Number(m.n))
  ok(`${course.slug}: les modules montent`,
     ns.every((n, i) => i === 0 || ns[i - 1] <= n), ns.join(', '))
  ok(`${course.slug}: aucun numero de module n'est illisible`,
     ns.every((n) => Number.isFinite(n)), modulesOf(course).map((m) => m.n).join(', '))
  ok(`${course.slug}: le cours commence a 0 ou a 1`, ns[0] <= 1, String(ns[0]))
}
eq('un cours absent n’a pas de module', modulesOf(null).length, 0)

/* Le tri doit aussi commander l'ordre de lecture, sinon "suivant" saute d'un
   module a l'autre selon l'ordre du fichier. */
{
  const ids = lessonsOf(courseBySlug('investir-101')).map((l) => l.module.n)
  ok('l’ordre de lecture suit l’ordre des modules',
     ids.every((n, i) => i === 0 || ids[i - 1] <= n), ids.join(', '))
}

/* --- la navigation ------------------------------------------------------- */
{
  const course = courseBySlug('riche-lentement')
  ok('le cours se retrouve par son slug', Boolean(course))
  const all = lessonsOf(course)

  eq('la premiere lecon n’a pas de precedente', neighbours(course, all[0].id).prev, null)
  eq('la derniere n’a pas de suivante', neighbours(course, all[all.length - 1].id).next, null)

  /* A TRAVERS les modules, pas dans. La derniere lecon du module 0 est suivie
     de la premiere du module 1; une navigation qui s'arrete au bord oblige a
     repasser par le sommaire entre chaque module. */
  const last0 = course.modules[0].lessons[course.modules[0].lessons.length - 1]
  const first1 = course.modules[1].lessons[0]
  eq('la navigation franchit les modules', neighbours(course, last0.id).next?.id, first1.id)
  eq('et dans l’autre sens', neighbours(course, first1.id).prev?.id, last0.id)

  eq('une lecon inconnue n’a ni l’une ni l’autre',
     JSON.stringify(neighbours(course, 'nope')), JSON.stringify({ prev: null, next: null }))
  ok('une lecon se retrouve par son identifiant', say(lessonById(course, '0.1')?.title).length > 3)
  eq('un identifiant inconnu rend null', lessonById(course, 'nope'), null)
}

/* --- les variantes par pays ---------------------------------------------- */
{
  const course = courseBySlug('investir-101')
  const lesson = lessonById(course, 'i2.1')
  ok('la lecon a geometrie variable existe', Boolean(lesson?.byCountry))
  ok('elle couvre les quatre regions',
     COUNTRIES.every((c) => Boolean(lesson.byCountry[c.id])),
     Object.keys(lesson.byCountry).join(', '))
  ok('chaque version a son Saint-Graal et son premier pas',
     COUNTRIES.every((c) => lesson.byCountry[c.id].grail && lesson.byCountry[c.id].todo))
  ok('elle a un tronc commun avant les variantes', Boolean(lesson.universal))

  eq('la variante suit la region', say(variantFor(lesson, 'fr').grail).includes('PEA'), true)
  eq('et l’Afrique a la sienne', say(variantFor(lesson, 'af').grail).includes('SGI'), true)
  /* Et la traduction suit la variante, pas seulement la langue source. */
  eq('la version anglaise de la variante existe aussi',
     say(variantFor(lesson, 'af').grail, 'en').includes('licensed broker'), true)

  /* Un identifiant traine dans localStorage qui survit a un renommage ne doit
     pas rendre une page vide. */
  ok('une region inconnue retombe sur le defaut plutot que sur rien',
     variantFor(lesson, 'zz') === variantFor(lesson, DEFAULT_COUNTRY))

  /* Une lecon ordinaire n'a pas de variantes, et ce n'est pas une erreur. */
  eq('une lecon universelle n’a pas de variante', variantFor(lessonById(course, 'i3.1'), 'ca'), null)
  eq('ni une lecon absente', variantFor(null, 'ca'), null)
}

/* --- l’avancement -------------------------------------------------------- */
{
  const p = progressOf(courseBySlug('riche-lentement'))
  ok('des lecons sont ecrites', p.written > 0)
  ok('et le total est plus grand', p.total >= p.written)
  eq('un cours absent compte zero', progressOf(null).total, 0)
}

/**
 * UNE LECON QUI N'INTERROGE JAMAIS NE SAIT PAS CE QU'ELLE A TRANSMIS.
 *
 * Ecrit apres avoir relu Investir 101 comme un debutant complet, a la demande:
 * "est-ce qu'a la fin du module tu es confident pour commencer, est-ce que ce
 * que tu as lu tu as retenu quelque chose". La reponse etait non, et une des
 * quatre raisons etait mesurable: cinq lecons redigees, zero quiz, zero
 * reflexion. La question "as-tu retenu quelque chose" n'avait pas de reponse
 * parce que le cours ne la posait jamais.
 *
 * Ce test compte, par cours, les lecons redigees qui n'ont ni quiz ni
 * reflexion. Il ne bloque pas: un cours peut legitimement en manquer pendant
 * qu'on l'ecrit, et Riche lentement a seize lecons encore a l'etat de plan.
 * Il IMPRIME l'ecart, pour qu'il soit visible a chaque execution au lieu de se
 * decouvrir en relisant le cours six mois plus tard.
 *
 * Carte de credit 101, lui, est tenu au complet: il a ete ecrit apres cette
 * critique et il n'a aucune excuse.
 */
{
  for (const c of COURSES) {
    const written = lessonsOf(c).filter((l) => l.state === 'written')
    const noQuiz = written.filter((l) => !l.quiz?.length)
    const noThink = written.filter((l) => !l.reflection)
    console.log(
      `     ${c.slug}: ${written.length} redigees, ${written.length - noQuiz.length} avec quiz, ` +
        `${written.length - noThink.length} avec reflexion`,
    )
    if (noQuiz.length) console.log(`       sans quiz: ${noQuiz.map((l) => l.id).join(', ')}`)
  }

  /**
   * Investir 101 est tenu au meme standard depuis qu'il a ete complete: la
   * relecture "comme un debutant" lui reprochait zero quiz sur cinq lecons,
   * pas de lecon sur le geste, pas de recap. Les quatre lecons manquantes
   * sont ecrites et les cinq anciennes ont leur quiz. Si ce cours retombe a
   * une lecon redigee sans quiz, c'est une regression, pas un cours en
   * cours d'ecriture.
   */
  for (const slug of ['investir-101']) {
    const c = COURSES.find((x) => x.slug === slug)
    const w = lessonsOf(c).filter((l) => l.state === 'written')
    ok(`${slug}: toutes les lecons redigees ont un quiz`,
       w.every((l) => l.quiz?.length >= 3),
       `sans quiz: ${w.filter((l) => !l.quiz?.length).map((l) => l.id).join(', ')}`)
    ok(`${slug}: et une reflexion`,
       w.every((l) => l.reflection),
       `sans reflexion: ${w.filter((l) => !l.reflection).map((l) => l.id).join(', ')}`)
    ok(`${slug}: et finit par un recapitulatif`,
       /retenir|take away/i.test(say(w.at(-1).title, 'fr') + say(w.at(-1).title, 'en')),
       say(w.at(-1).title, 'fr'))
    /* La lecon du geste nomme quelque chose a taper dans chaque region. C'est
       ce que la relecture reclamait: "le cours diagnostique la maladie et
       s'arrete avant l'ordonnance". Sans un nom, le lecteur reste devant la
       barre de recherche. */
    const buy = lessonsOf(c).find((l) => /appuies sur acheter|press buy/i.test(say(l.title, 'fr') + say(l.title, 'en')))
    ok(`${slug}: une lecon montre le geste d achat`, Boolean(buy), 'aucune lecon "le jour ou tu appuies sur acheter"')
    ok(`${slug}: et elle nomme un symbole par region`,
       Boolean(buy) && ['ca', 'fr', 'us'].every((r) => /[A-Z]{2,5}/.test(say(buy.byCountry?.[r]?.grail, 'fr'))),
       'une lecon "acheter" sans nom a taper laisse le lecteur devant la barre de recherche')
    /* Et l Afrique dit honnetement qu il n y a pas de FNB, au lieu d inventer
       un symbole qui n existe pas a la BRVM. */
    ok(`${slug}: et dit qu il n y a pas de FNB a la BRVM plutot que d en inventer un`,
       Boolean(buy) && /pas de FNB|no all-in-one ETF/i.test(say(buy.byCountry?.af?.grail, 'fr') + say(buy.byCountry?.af?.grail, 'en')),
       'un symbole invente serait pire qu aucun')
  }

  const cc = COURSES.find((c) => c.slug === 'carte-de-credit')
  ok('le cours carte de credit existe', Boolean(cc))
  const written = lessonsOf(cc).filter((l) => l.state === 'written')
  ok('il a huit lecons redigees', written.length === 8, String(written.length))
  ok(
    'et chacune verifie ce qu elle a transmis',
    written.every((l) => l.quiz?.length >= 3),
    `sans quiz: ${written.filter((l) => !l.quiz?.length).map((l) => l.id).join(', ')}`,
  )
  ok(
    'et chacune pose une reflexion',
    written.every((l) => l.reflection),
    `sans reflexion: ${written.filter((l) => !l.reflection).map((l) => l.id).join(', ')}`,
  )
  /* La lecon qui manquait a Investir 101: une derniere qui recapitule. Un
     cours qui s'arrete sur sa lecon la plus technique laisse le lecteur sans
     rien a emporter. */
  ok(
    'et le cours finit par un recapitulatif',
    /retenir|take away/i.test(say(written.at(-1).title, 'fr') + say(written.at(-1).title, 'en')),
    say(written.at(-1).title, 'fr'),
  )
  /* Chaque bonne reponse doit exister dans les options, sinon le quiz marque
     faux une reponse juste et personne ne le remarque avant de le passer. */
  const bad = []
  for (const l of lessonsOf(cc)) {
    for (const q of l.quiz ?? []) {
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) {
        bad.push(`${l.id}: answer ${q.answer} sur ${q.options.length} options`)
      }
      if (!q.why) bad.push(`${l.id}: une question sans explication`)
    }
  }
  ok('chaque bonne reponse pointe une option qui existe, et s explique', bad.length === 0, bad.join(' | '))
}

/**
 * LA QUESTION DE REGION EST POSEE AU DEBUT DES COURS QUI EN DEPENDENT.
 *
 * "J'avais demande qu'au debut du cours on te demande ta region pour adapter
 * ton learning." Elle etait sur la page de liste, avant tout choix de cours.
 * hasRegions() est ce qui decide de la poser: vrai pour un cours qui a au
 * moins une lecon par pays, faux sinon, parce qu'une question qui n'adapte
 * rien est une question de trop.
 */
{
  ok('investir-101 depend de la region', hasRegions(COURSES.find((c) => c.slug === 'investir-101')))
  ok('carte-de-credit aussi', hasRegions(COURSES.find((c) => c.slug === 'carte-de-credit')))
  ok('un cours sans lecon par pays, non',
     !hasRegions({ modules: [{ n: 1, lessons: [{ id: 'x.1', state: 'written', points: [] }] }] }))
  ok('un cours absent, non plus', !hasRegions(null))
  /* La phrase de bienvenue est un champ du cours et pas une table globale,
     parce qu'elle parle de CELI et de PEA: elle n'a de sens que pour Investir
     101. Un cours regional sans elle est normal. */
  const inv = COURSES.find((c) => c.slug === 'investir-101')
  ok('investir-101 porte ses reponses par region', ['ca', 'fr', 'us', 'af'].every((r) => inv.regionAnswers?.[r]?.fr))
  ok('carte-de-credit n en a pas, et c est voulu', !COURSES.find((c) => c.slug === 'carte-de-credit').regionAnswers)
}

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
