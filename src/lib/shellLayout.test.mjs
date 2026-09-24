/**
 * node src/lib/shellLayout.test.mjs
 *
 * The two navigations, and the fact that exactly one of them is ever showing.
 *
 * WHAT WAS MEASURED, in headless Chromium at real device widths, before any of
 * this was written down. The rail was 13rem of words for one round and is now
 * 5.5rem of icons with a word under each, so the numbers below are the second
 * set:
 *
 *   390px  phone            rail hidden, bottom bar visible, top bar visible
 *   820px  iPad portrait    rail 16..104, bottom bar hidden, top bar hidden
 *   1180px iPad landscape   same, grid takes the rest
 *   1440px laptop           same
 *
 * This file cannot lay anything out and does not pretend to. What it holds is
 * the set of class contracts that result depends on, because the realistic
 * regression is not a subtle CSS interaction, it is somebody adding a nav item
 * or restyling a bar without knowing there are two of them.
 *
 * ONE MEASUREMENT HERE WAS WRONG FOR A WHILE AND IT IS WORTH RECORDING.
 * The probe looked for the bottom bar by matching `bottom-4` in a className,
 * and the rail carries `bottom-4` too, so it reported the rail's visibility as
 * the tab bar's and the phone layout looked broken when it was not. The
 * assertion below pins the class that actually distinguishes them.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { MOOD_IDS } from './moods.js'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
/**
 * The same file with its comments removed.
 *
 * Assertions of the form "this string is gone" match the note explaining why it
 * is gone, so they fail against a codebase that is already correct. That has
 * happened twice here: once for CameraIcon, once for text-on-accent/70. Declared
 * beside read() rather than halfway down, for the temporal-dead-zone reason
 * recorded on the file reads below.
 */
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}

console.log('\nshell layout')

const shell = read('src/components/AppShell.jsx')
/**
 * Every file this suite reads, declared here rather than beside the block that
 * first needed it.
 *
 * Three separate runs died on "Cannot access 'x' before initialization": a
 * `const` declared halfway down is in the temporal dead zone for every
 * assertion above it, so moving one assertion, or adding one that reuses an
 * existing binding, crashes the whole file rather than failing a test. Read
 * once, at the top, and the order of the blocks stops mattering.
 */
const goalsPage = read('src/pages/Goals.jsx')
const gcard = read('src/components/GoalCard.jsx')
const carousel = read('src/components/CheckinCarousel.jsx')
const rail = read('src/components/CheckinRail.jsx')

/* --- exactly one navigation is visible at any width ---------------------- */

ok('there is a side rail', /data-hook="side-rail"/.test(shell))
ok(
  'the rail appears only from md up',
  /hidden w-\[3\.5rem\] flex-col p-1\.5 md:flex/.test(shell),
  'without md:flex it would show on a phone alongside the bottom bar',
)
ok(
  'the bottom bar disappears from md up',
  /inset-x-4 bottom-4[^"]*md:hidden/.test(shell),
  'two navigations at once is the failure this pairing prevents',
)

/* The class that tells the two bars apart, which a probe got wrong. Both
   carry bottom-4; only the tab bar spans the width. */
ok(
  'only the bottom bar carries inset-x-4',
  (shell.match(/inset-x-4/g) ?? []).length === 1,
  'the rail must stay identifiable separately from it',
)

/* --- the content clears the rail ---------------------------------------- */

ok(
  'content is padded past the rail from md up',
  /md:pl-\[5\.5rem\]/.test(shell),
  '3.5rem of rail plus the 1rem it is inset by on each side',
)
ok(
  'and not padded below it',
  !/\bpl-\[7\.5rem\](?!\])/.test(shell.replace(/md:pl-\[5\.5rem\]/g, '')),
  'a phone would be pushed off its own screen',
)

/* --- one chrome, not two ------------------------------------------------- */

/* The whole top bar is a phone component now. Once the rail took the bell and
   the avatar there was nothing left in it above md except the group name, and
   an empty 76px strip is the opposite of what this layout was asked for. */
ok(
  'the top bar is hidden from md up',
  /<header className="sticky top-0 z-40 px-4 pt-4 md:hidden">/.test(shell),
  'the rail carries the lockup, the bell and the avatar above md',
)
/* Anchored to the rail's own source rather than to a character window from
   the hook. The window was 2600 and a comment added above the lockup pushed it
   out of range: the assertion failed on a file where the lockup was exactly
   where it should be. A distance in characters is not a structural fact. */
ok(
  'the rail carries a lockup of its own',
  /LockupInline/.test(shell.slice(shell.indexOf('function SideRail'), shell.indexOf('function TabBar'))),
)
/**
 * HOME IS IN BOTH NAVIGATIONS.
 *
 * The two swap wholesale, so walking into a group replaced every destination at
 * once and the dashboard left the screen. Getting back meant the wordmark,
 * which is a logo: it happens to link home and nothing said so.
 *
 * First in both, so the icon under your thumb does not move when you cross into
 * a group. A menu whose items relocate depending on where you are is one you
 * have to read rather than aim at.
 *
 * MEASURED, because five tabs is where this bar has clipped French labels
 * before and the group set has different words. At 320, 360, 390 and 430, with
 * scrollWidth compared against clientWidth per label: nothing clipped, and the
 * bar does not overflow. 320 is narrower than any phone this is built for.
 */
ok(
  'home is in the group navigation too',
  /const IN_GROUP = \(id\) => \[\s*\n\s*\{ to: '\/', key: 'nav\.home'/.test(shell),
  'the two navigations swap wholesale, so without this the dashboard is unreachable',
)
ok(
  'and it is first in both, so it does not move',
  /const MINE = \[\s*\n\s*\{ to: '\/', key: 'nav\.home'/.test(shell),
)

/**
 * AND THE LOCKUP IS NAMED FOR THE BRAND, NOT FOR WHERE IT GOES.
 *
 * It was aria-label="Accueil", which was right while the rail had no home item.
 * With one in both navigations that put two links with the same name and the
 * same destination inside one <nav>: read twice by a screen reader, tabbed
 * through twice by a keyboard. Verified in Chromium that each rail now lists
 * exactly one "Accueil".
 */
ok(
  'the wordmark does not claim to be the home control',
  /aria-label=\{t\('brand\.name'\)\}/.test(shell) &&
    !/aria-label=\{t\('nav\.home'\)\}[\s\S]{0,120}LockupInline/.test(shell),
  'two links, one name, one destination, in the same navigation',
)
ok(
  'and the brand name is the same string in both locales',
  (read('src/lib/i18n.jsx').match(/'brand\.name': 'Rich & Friends'/g) ?? []).length === 2,
  'a brand name is not translated',
)

ok(
  'and the group name has somewhere to be',
  /data-hook="rail-group"/.test(shell),
  'it was in the top bar, which no longer runs at this width',
)

/**
 * THE BADGE IS THE GROUP'S STICKER, NOT ITS FIRST LETTER.
 *
 * "F" is not a picture of FUTUR MILLIARDAIRE, it is a picture of the letter F,
 * and one letter in a rail of glyphs reads as a missing icon. The sticker is
 * already the group's face on the settings header, derived from the group id
 * so it is stable for the group's life and identical for everyone in it.
 *
 * Verified in Chromium that the two screens agree rather than each picking
 * their own: the rail badge and the settings header resolved to the same
 * asset path, and the rail image decoded (naturalWidth > 0) rather than being
 * an img tag with a good src painting nothing.
 *
 * The initial stays UNDER the image rather than being replaced by it. art.js
 * is explicit that a renamed PNG must not take a page down, and a 404 there is
 * a network failure rather than a page error, so nothing else would catch it.
 * An empty tinted disc looks like a design decision; a letter looks like a
 * group.
 */
/**
 * RATTRAPER DES REGLES OUBLIEES.
 *
 * Demande: "I want to be able to go back and add my menstruation."
 *
 * L'historique laissait deja MODIFIER une date et en SUPPRIMER une. Ce qu'il ne
 * laissait pas faire, c'est en CREER une dans le passe: le seul chemin etait
 * "c'est arrive aujourd'hui" puis reculer la date a la main. Ca marche une
 * fois, et ca echoue exactement quand on en a besoin, parce que
 * `unique (user_id, started_on)` refuse un deuxieme aujourd'hui.
 *
 * Ce qui est epingle ici, en plus du geste: que l'ecriture reste DANS le cycle.
 * La regle de 51_calendar_and_cycle.sql est `user_id = auth.uid()`, sans chemin
 * vers le groupe, sans vue partagee, sans agregat. Ce n'est pas un defaut a
 * relacher plus tard, c'est la fonction.
 */
{
  /**
   * LE SUIVI DU CYCLE EST ETEINT PAR DEFAUT.
   *
   * "Rappelle-toi: seulement chez les femmes."
   *
   * Le code client etait deja strict, cycleForGender ne rend true que pour
   * 'woman'. C'est la BASE qui fuyait: 56_setup.sql a pose la colonne en
   * `default true`, donc toute ligne creee avant portait true sans que personne
   * ne l'ait choisi. Mesure dans Chromium: un profil gender='man',
   * cycle_on=true voyait le bouton, la couche et "Mes regles".
   */
  const setup = code('src/lib/setup.js')
  ok('seule une femme allume le suivi a la configuration',
     /cycleForGender\(gender\) \{\s*return gender === 'woman'/.test(setup))

  const sql = readdirSync(join(root, 'supabase'))
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort((a, b) => Number(a.split('_')[0]) - Number(b.split('_')[0]))
    .map((f) => read(`supabase/${f}`))
    .filter((t) => /alter column cycle_on set default/.test(t))
    .pop()
  ok('et une migration remet le defaut de la colonne a false',
     /alter column cycle_on set default false/.test(sql ?? ''),
     '`default true` fait decider l application a la place de la personne')
  ok('le rattrapage epargne qui a deja note quelque chose',
     /not exists \(select 1 from cycle_log/.test(sql ?? '')
       && /not exists \(select 1 from cycle_day/.test(sql ?? ''),
     'eteindre le suivi de quelqu un qui s en sert serait remplacer une erreur par une pire')
  ok('et il epargne les femmes',
     /gender is distinct from 'woman'/.test(sql ?? ''))
  ok('rien n est supprime', !/delete from cycle_(log|day)/i.test(sql ?? ''))

  /**
   * ET LE CLIENT PORTE LA MEME GARDE QUE LA MIGRATION.
   *
   *   "Where is the period thing I don't see it did you publish it"
   *
   * C'etait publie. Mesure sur son compte au moment du rapport: gender null,
   * cycle_on false, et QUATRE lignes dans cycle_log. La migration 68 avait
   * epargne cette ligne, exactement comme elle le promet. C'est l'ecran du
   * profil qui l'a eteinte: pickGender ecrivait cycle_on: cycleForGender(next)
   * sans condition, donc une touche sur la liste des genres d'un compte dont la
   * question n'a jamais ete posee, ce que porte chaque ligne d'avant la
   * migration 56, faisait partir "Mon cycle", "+ Mes regles", la couche Cycle,
   * le tiroir et ses quatre dates dans la meme image.
   *
   * La migration avait la bonne regle et le client avait la meme derivation
   * sans la garde. Les deux la portent maintenant.
   */
  const me = code('src/pages/Me.jsx')
  ok('la reponse de genre ne decide plus seule de l interrupteur',
     !/cycle_on: cycleForGender\(/.test(me),
     'une touche sur la liste des genres eteignait un suivi qui servait')
  ok('elle passe par la garde',
     /updateProfile\?\.\(\{ gender: next, \.\.\.cyclePatchForGender\(next, recorded\) \}\)/.test(me))
  ok('et seul un zero confirme la laisse bouger',
     /cyclePatchForGender\(gender, recorded\) \{\s*return recorded === 0 \?/.test(setup),
     'null et undefined sont un compte qui n est pas arrive, pas une absence de regles')
  ok('le compte est demande sans rapatrier les lignes',
     /from\('cycle_log'\)\s*\.select\('id', \{ count: 'exact', head: true \}\)/.test(me),
     'ce sont les lignes les plus sensibles du produit et cet ecran n en a pas besoin')
  ok('et l etat eteint dit ce qu il garde',
     /data-hook="me-cycle-state"/.test(me) && /me\.cycle_off_kept/.test(me),
     '"rien n est efface" est vrai et inverifiable pour qui vient de voir ses dates partir')

  /**
   * ET LE PROFIL SE RELIT EN REVENANT SUR L'APPLICATION.
   *
   * Il a fallu QUATRE fois "Where is the period thing I don't see it did you
   * publish it" pour trouver celle-la. C'etait publie, la colonne etait
   * revenue a true, et son ecran disait toujours non: l'effet qui lit le
   * profil ne se declenche que sur session?.user?.id, donc a la connexion. Une
   * application posee sur l'ecran d'accueil n'est pas rechargee pendant des
   * jours, et gardait le profil de son premier chargement.
   *
   * Le cycle est seulement la correction qui s'est fait remarquer, parce
   * qu'elle fait disparaitre des boutons. Le theme, la devise, la langue et le
   * nom passent par la meme variable et se seraient tus.
   */
  const ctx = code('src/context/AuthContext.jsx')
  ok('le profil se relit quand on revient sur l application',
     /addEventListener\('visibilitychange', relire\)/.test(ctx)
       && /addEventListener\('focus', relire\)/.test(ctx))
  ok('et les deux ecouteurs sont retires',
     (ctx.match(/removeEventListener\('(visibilitychange|focus)', relire\)/g) ?? []).length === 2,
     'sinon chaque remontage en empile une paire de plus')
  /* Le corps de `relire`, decoupe entre sa declaration et le branchement des
     ecouteurs juste apres, plutot qu'avec une expression reguliere gourmande
     qui attrapait l'ensemencement de l'effet d'au-dessus et rendait ce cas
     faux pour une ecriture qui n'est pas la sienne. */
  const corpsRelire = ctx.slice(
    ctx.indexOf('const relire = async () =>'),
    ctx.indexOf("document.addEventListener('visibilitychange'"),
  )
  ok('la relecture lit, et seulement ca',
     /\.select\('\*'\)/.test(corpsRelire)
       && !/\.(update|upsert|insert|delete|rpc)\(/.test(corpsRelire),
     `une ecriture a chaque deverrouillage du telephone: ${corpsRelire.slice(0, 80)}`)
  ok('et une lecture ratee garde ce qu on a',
     /if \(!alive \|\| error \|\| !data\) return/.test(ctx),
     'setProfile(null) sur une panne reseau ferait clignoter toute l application')
  ok('deux evenements pour un aller-retour ne font qu une requete',
     /Date\.now\(\) - lastRead\.current < 30000/.test(ctx),
     'visibilitychange et focus arrivent souvent ensemble')
}

{
  const cal = code('src/pages/Calendar.jsx')
  /**
   * "A cote du bouton ajouter, ajouter une option ajouter menstruation."
   *
   * Un bouton, pas une reponse dans un choix. La version d'avant faisait
   * demander a "+ Ajouter" ce qu'on ajoutait, et la question se payait DANS LES
   * DEUX SENS: ajouter un cours passait par elle aussi.
   */
  ok('les regles ont leur propre bouton', /data-hook="cal-add-period"/.test(cal))
  ok('et "+ Ajouter" ne pose plus de question a personne',
     !/data-hook="cal-add-kind"/.test(cal) && !/setAdding/.test(cal),
     'un cours passait par "Tu ajoutes quoi ?" pour arriver la ou il allait deja')
  ok('il ouvre l horaire directement',
     /data-hook="cal-add"[\s\S]{0,400}/.test(cal)
       && /onClick=\{\(\) => setEditing\(\{ starts_on: dayKey\(anchor\)/.test(cal))
  ok('le bouton des regles n existe que s il y a un cycle a noter',
     /\{periodTracking && \(\s*<button[\s\S]{0,400}data-hook="cal-add-period"/.test(cal),
     'grise, il resterait la publicite d une fonction a laquelle on a dit non')
  /**
   * ET LE GESTE EST DE COCHER LES JOURS SUR LE MOIS.
   *
   *   "Look the way you can just coche the case number on flo. Our app doesn't
   *    show the day as little round and I don't want it too, so adapt to the
   *    full month view only."
   *
   * Le champ date est parti: une regle de trois jours demandait trois
   * passages, et corriger une regle deja notee etait impossible sans passer
   * par le tiroir du cycle pour l'y supprimer.
   */
  ok('le champ date est parti', !/data-hook="cal-period-day"/.test(cal))
  ok('le bouton bascule en vue MOIS', /setView\('month'\)/.test(cal)
     && /const startPicking/.test(cal),
     'cocher trois jours de suite dans la vue jour demanderait trois navigations')
  ok('la grille du mois coche au lieu d ouvrir le jour',
     /onPick=\{picking \? togglePeriodDay/.test(cal))
  ok('et la selection part de ce qui est DEJA enregistre',
     /setPicked\(selectedFrom\(cycle\.starts\)\)/.test(cal),
     'sinon les jours deja notes s afficheraient decoches sur une grille qui les colorie')

  /* PAS DE PASTILLE A COCHER. Elle a demande le geste de Flo, pas sa
     decoration: la tuile se remplit, et rien ne s'ajoute a une case qui porte
     deja un chiffre, une marque de phase et des pastilles d'evenement. */
  ok('la tuile cochee est remplie, pas surchargee d une pastille',
     /data-picked=\{on \? 'yes' : undefined\}/.test(cal)
       && /\{phase && !on &&/.test(cal),
     'une pastille de plus dans le coin d une case pleine ne repond a rien')

  /**
   * ROSE, ET LA GRILLE SE VIDE PENDANT QU'ON COCHE.
   *
   *   "Black not red."
   *   "No, the black is not prettier, make it pink. Remove the information
   *    when we are selecting the period day, just so it's not overwhelming,
   *    and fix the UI."
   *
   * Trois formes, et les deux premieres sont la raison de la troisieme.
   *
   * ROUGE: `bg-negative`, la couleur des erreurs et des suppressions. Sur un
   * mois entier, cinq grands blocs rouges, c'est-a-dire ce que cette couleur
   * veut dire partout ailleurs: quelque chose ne va pas.
   *
   * NOIR: le raisonnement tenait et la mesure aussi, 17,48:1 pour le chiffre.
   * Ce que la mesure ne dit pas et que la capture dit, c'est que cinq dalles
   * noires couvertes de pastilles jaunes sont lourdes.
   *
   * ROSE, ET LA GRILLE SE VIDE. Le fouillis n'etait pas la couleur seule,
   * c'etait la couleur PLUS tout ce qui restait dessus. Pendant le pointage,
   * la seule question posee par cette grille est "ce jour-la ou pas": les
   * pastilles d'evenement et la ligne "+N autres" ne repondent a rien. Elles
   * partent, donc la tuile n'a plus besoin de 6,5rem, donc le mois tient d'un
   * coup d'oeil. Tout revient a la fermeture du pointage.
   *
   * --c-pick est declare a :root et pas par theme, comme `negative` et
   * `green`: prendre --c-accent aurait rendu du bleu en mer, ou "fais-le
   * rose" ne veut plus dire grand-chose.
   *
   * ET C'EST L'ENCRE DESSUS, PAS LE BLANC. Le blanc sur ce rose fait 3,80:1,
   * ce que index.css documente deja: assez pour du grand texte, pas pour du
   * texte normal, et un chiffre de jour a 14px est du texte normal. Mesure en
   * pixels peints sur la tuile: 4,60:1 en soleil, 4,54:1 en mer.
   */
  ok('et elle est rose, ni rouge ni noire',
     /\$\{on \? 'bg-pick' : ''\}/.test(cal)
       && !/on \? 'bg-negative/.test(cal) && !/on \? 'bg-ink text-on-accent'/.test(cal),
     'le rouge est la couleur des erreurs, et cinq dalles noires sont lourdes')
  {
    /* `css` est lu plus bas dans ce fichier: ici on relit la feuille plutot
       que de deplacer sa declaration, qui sert a des dizaines de cas. */
    const feuille = read('src/index.css')
    ok('le rose est declare une fois, pas par theme',
       /--c-pick: 255 0 122;/.test(feuille)
         && !/\[data-theme='sea'\][\s\S]{0,6000}--c-pick:/.test(feuille),
       'par theme, il serait bleu en mer')
  }
  /**
   * ET LE CHIFFRE EST BLANC SUR LE ROSE, PARCE QU'IL EST DEVENU GRAND.
   *
   *   "Regles rose carre, la date a l'interieur blanche."
   *
   * Il etait a l'encre, a 4,60:1, et ce cas-la disait pourquoi: le blanc sur
   * ce rose fait 3,80:1, WCAG 1.4.3 demande 4,5 pour du texte normal, et un
   * chiffre de 14px semibold est du texte normal.
   *
   * Ce qui a change n'est pas l'exigence, c'est la taille. 1.4.3 demande 3,0
   * pour du GRAND texte, defini comme 24px ou 18,66px a partir du gras 700.
   * Le chiffre est en 19px gras pendant le pointage, ou la grille videe lui
   * laisse toute la tuile, donc 3,80 est au-dessus de ce qu'il lui faut.
   *
   * Hors pointage il partage sa place avec les pastilles d'evenement, donc il
   * y reste petit, et petit veut dire a l'encre. Les deux branches sont
   * epinglees ensemble: separees, quelqu'un pourrait agrandir l'une ou
   * recolorer l'autre sans que le couple taille-couleur soit relu.
   */
  ok('le chiffre coche est blanc, et assez grand pour l etre',
     /picking\s*\n?\s*\? `text-\[1\.1875rem\] font-bold leading-none \$\{on \? 'text-on-pick' : 'text-ink'\}`/.test(cal),
     '19px gras est du grand texte: 3,80:1 depasse les 3,0 exiges')
  ok('et hors pointage il reste petit, donc a l encre',
     /: 'text-small font-semibold text-ink'/.test(cal),
     'a 14px il faudrait 4,5:1, et le blanc n en fait que 3,80')
  {
    const feuille2 = read('src/index.css')
    ok('le dessus du rose est declare une fois, comme le rose',
       /--c-on-pick: 255 255 255;/.test(feuille2)
         && !/\[data-theme='sea'\][\s\S]{0,6000}--c-on-pick:/.test(feuille2),
       'le rose est le meme dans les deux themes, son dessus doit l etre aussi')
    ok('et tailwind en fait une classe',
       /'on-pick': c\('on-pick'\)/.test(read('tailwind.config.js')),
       'une couleur absente de la config sort du HTML sans regle du tout')
  }
  ok('la grille se vide pendant le pointage',
     /\{!picking && list\.slice\(0, shown\)\.map/.test(cal)
       && /\{!picking && list\.length > shown && \(/.test(cal),
     'c est ce qui faisait le fouillis, pas la couleur seule')
  /**
   * ET LA TUILE EST REMPLIE EN ENTIER, PAS UN ROND DERRIERE LE CHIFFRE.
   *
   *   "Je prefere ca." (capture: le mois a sa taille normale, cinq tuiles
   *    entierement roses, le chiffre a l'encre au milieu)
   *
   * Ce qui avait ete fait a la place tenait en trois gestes: tuile ramenee a
   * 3rem, carte qui ne s'etire plus, marque reduite a un rond de la taille du
   * chiffre, au motif qu'une tuile pleine large de 250px est une dalle. Sauf
   * que la plainte d'origine visait le NOIR, "the black is not prettier", et
   * qu'une fois roses les dalles sont ce qui est voulu. Un raisonnement n'est
   * pas une demande.
   *
   * Donc le mois pendant le pointage est le mois tout court: meme carte
   * etiree, meme tuile de 6,5rem au-dessus de md. La seule difference qui
   * reste est la grille videe de ses pastilles, qui elle a bien ete demandee.
   *
   * L'encre sur le rose ne bouge pas avec la taille de la tuile: 4,60:1 en
   * soleil, 4,54:1 en mer, mesure en pixels peints sur la tuile pleine.
   */
  ok('la tuile garde sa taille pendant le pointage',
     /picking\s*\n\s*\? 'min-h-\[3\.4rem\] items-center justify-center p-1 md:min-h-\[6\.5rem\] md:p-1\.5'/.test(cal),
     'elle avait ete ramenee a 3rem, et la capture montre le contraire')
  ok('et la carte du mois s etire comme d habitude',
     /className="lg w-full overflow-hidden p-3 md:flex md:min-h-0 md:flex-1 md:flex-col"/.test(cal)
       && /className="grid grid-cols-7 gap-1 month-fill md:min-h-0 md:flex-1"/.test(cal),
     'le pointage ne se distingue plus du mois par sa geometrie')
  ok('le rose est sur la tuile, pas derriere le chiffre',
     /\} \$\{on \? 'bg-pick' : ''\} \$\{/.test(cal)
       && !/picking \? 'h-9 w-9 md:h-10 md:w-10'/.test(cal),
     'le rond etait un selecteur de dates, et ce n est pas ce qui a ete choisi')
  /* La plaque blanche sous une pastille posee sur une tuile pleine n'a plus
     de raison d'etre: il n'y a plus de pastille pendant le pointage. Du code
     mort qui a l'air correct est pire qu'un correctif manquant. */
  ok('et la plaque blanche des pastilles est partie avec elles',
     !/on \? 'bg-surface text-ink'/.test(cal),
     'du code qu aucun etat n atteint plus')
  ok('et c est une case a cocher pour un lecteur d ecran aussi',
     /role=\{picking \? 'checkbox' : undefined\}/.test(cal)
       && /aria-checked=\{picking \? Boolean\(on\) : undefined\}/.test(cal),
     'une tuile remplie ne dit rien a qui ne la voit pas')

  ok('le futur est refuse, et desactive plutot qu inerte',
     /if \(k > dayKey\(new Date\(\)\)\) return/.test(cal) && /disabled=\{future\}/.test(cal),
     'une tuile qui ne repond pas se lit comme un bogue')

  /**
   * LA PARTIE QUI EFFACERAIT DES DONNEES.
   *
   * Toutes les lignes ont ended_on a null et le calendrier en dessine cinq
   * jours. Sans `touched`, enregistrer apres avoir coche un jour de septembre
   * inventerait une duree sur chaque regle de l annee derniere.
   */
  ok('le calcul vit dans un module pur, avec ses tests',
     /from '\.\.\/lib\/periodPick'/.test(cal)
       && existsSync(join(root, 'src/lib/periodPick.test.mjs'))
       && /periodPick\.test\.mjs/.test(read('package.json')))
  ok('et l ecran lui passe ce qui a ete REELLEMENT tape',
     /touched: touchedDays/.test(cal) && /setTouchedDays\(new Set\(\)\)/.test(cal),
     'sans ca, enregistrer reecrit une duree inventee sur tout l historique')

  /* RLS refuse un DELETE en silence. Continuer apres un refus ecrirait la
     nouvelle serie a cote de l ancienne, donc deux lignes pour une regle. */
  ok('la suppression compte ses lignes', /delete\(\{ count: 'exact' \}\)/.test(cal))
  ok('et un refus arrete tout', /if \(count === 0\) return setNotice/.test(cal))
  ok('le retrait passe AVANT l ajout',
     cal.indexOf("delete({ count: 'exact' })") < cal.indexOf('.upsert('),
     'unique (user_id, started_on) refuserait une serie qui commence le meme jour')

  ok('une reussite le dit, y compris quand elle a RETIRE',
     /data-hook="cal-period-saved"/.test(cal) && /cal\.pick_removed_one/.test(cal),
     'retirer une regle ne laisse rien a l ecran et passerait pour un bouton mort')
  ok('et elle le dit en role="status", pas en alerte',
     /role="status" data-hook="cal-period-saved"/.test(cal))

  const i18nCal = read('src/lib/i18n.jsx')
  for (const key of ['cal.add_period', 'cal.pick_how', 'cal.pick_n_one', 'cal.pick_n_other',
                     'cal.pick_saved_one', 'cal.pick_removed_one']) {
    const hits = i18nCal.split(`'${key}'`).length - 1
    ok(`${key} existe dans les deux langues (${hits})`, hits === 2)
  }
  ok('et les chaines du champ date sont parties avec lui',
     !/cal\.add_what|cal\.add_event|cal\.add_period_when|cal\.period_saved/.test(i18nCal),
     'une cle que plus personne ne lit est une cle que le prochain doit verifier')
  ok('l ecriture du calendrier ne touche que cycle_log',
     /savePeriod[\s\S]{0,1400}from\('cycle_log'\)/.test(cal)
       && !/savePeriod[\s\S]{0,1400}from\('(checkins|goals|group_members|group_feed)'\)/.test(cal))

  /* Et le calendrier doit dessiner la duree REELLE, sinon cocher trois jours
     en colorierait cinq et l application contredirait la saisie. */
  const cyc = code('src/lib/cycle.js')
  ok('phaseOn honore ended_on', /fromKey\(row\?\.ended_on\)/.test(cyc)
     && /daysBetween\(s, end\) \+ 1 : periodDays/.test(cyc),
     'il dessinait cinq jours a partir de chaque debut, quoi qu il arrive')

  const cp = code('src/components/CyclePanel.jsx')
  ok('on peut ajouter une date passee', /data-hook="cycle-add-past"/.test(cp))
  ok('le champ est borne a aujourd hui', /max=\{dayKey\(new Date\(\)\)\}/.test(cp))
  ok('et le futur est refuse cote code aussi',
     /if \(key > dayKey\(new Date\(\)\)\) return/.test(cp),
     'un max sur un champ date se contourne en tapant, et la base ne le sait pas')
  ok('un doublon est un upsert, pas une erreur Postgres',
     /onConflict: 'user_id,started_on'/.test(cp) && /t\('cycle\.already'\)/.test(cp),
     '"duplicate key value violates unique constraint" n est pas une phrase a montrer ici')
  ok('et le rattrapage n ecrit que dans cycle_log',
     /addPast[\s\S]{0,900}from\('cycle_log'\)/.test(cp)
       && !/addPast[\s\S]{0,900}from\('(checkins|goals|group_members|group_feed)'\)/.test(cp),
     'la politique du cycle est user_id = auth.uid(), sans chemin vers le groupe')
}

/**
 * COUPER LES NOTIFICATIONS D'UN SEUL GROUPE.
 *
 *   "Add an option to desactive notification for specific group."
 *
 * Avant, le seul geste possible etait de decocher push et courriel dans les
 * reglages du compte, ce qui coupe aussi l'eau, l'agenda, les objectifs et le
 * cycle: tout eteindre pour faire taire un groupe.
 */
{
  const set = code('src/pages/Settings.jsx')
  const tog = code('src/components/GroupNotifyToggle.jsx')

  ok('le commutateur est sur la page du GROUPE', /<GroupNotifyToggle groupId=/.test(set),
     'un reglage sur ce groupe-la se cherche la ou on est deja')
  ok('et il est haut, au-dessus de la liste des membres',
     set.indexOf('GroupNotifyToggle') < set.indexOf('settings.members_count'),
     'dix membres mettent le commutateur a un ecran et demi de defilement')
  ok('tous les membres y ont droit, pas seulement les admins',
     !/myRole === 'creator'[\s\S]{0,200}GroupNotifyToggle/.test(set)
       && !/isAdmin[\s\S]{0,200}GroupNotifyToggle/.test(set),
     'c est un reglage sur soi, pas sur le groupe')

  ok('la case dit ce qui ARRIVE, pas ce qui est coupe',
     /checked=\{on === true\}/.test(tog),
     'une case "couper" cochee pour dire que tout va bien est une double negation')
  ok('et elle attend de savoir avant de se dessiner',
     /useState\(null\)/.test(tog) && /disabled=\{on === null \|\| busy\}/.test(tog),
     'partir de true ferait clignoter "allume" chez quelqu un qui a coupe')

  /* RLS refuse un DELETE en silence: zero ligne, aucune erreur. Sans le compte,
     rallumer un groupe aurait l'air d'avoir marche et la case reviendrait
     decochee au prochain chargement. */
  ok('le DELETE compte ses lignes', /delete\(\{ count: 'exact' \}\)/.test(tog))
  ok('et zero ligne est traite comme un echec', /err \|\| count === 0/.test(tog))
  ok('une deuxieme coupure n est pas une erreur a l ecran',
     /onConflict: 'user_id,group_id'/.test(tog),
     'la cle primaire est (user_id, group_id): un insert repete serait une violation')
  ok('et la migration absente est dite plutot que montree en panne',
     /isMissingTable/.test(tog) && /data-hook="group-notify-absent"/.test(tog),
     'un commutateur qui ne commute rien apprend que les reglages ne comptent pas')

  const i18n = read('src/lib/i18n.jsx')
  for (const key of ['gnotif.section', 'gnotif.label',
                     'gnotif.off_help', 'gnotif.failed', 'gnotif.absent']) {
    const hits = i18n.split(`'${key}'`).length - 1
    ok(`${key} existe dans les deux langues (${hits})`, hits === 2)
  }

  /**
   * COURT, ET C'EST MESURE.
   *
   *   "The button for notification is hella too long and too detailed."
   *
   * L'etat allume portait l'enumeration des quatre messages du groupe: mesure
   * a 390px, quatre lignes et 124 caracteres sous une case qui dit deja ce
   * qu'elle fait. Elle est partie, avec sa cle.
   */
  ok('rien a lire quand c est allume',
     !/gnotif\.on_help/.test(i18n) && !/gnotif\.on_help/.test(tog)
       && /\{on === false && \(/.test(tog),
     'un mode d emploi sous un interrupteur qui marche')

  /* Mais l'etat coupe garde la sienne: elle porte le seul fait qui manquerait,
     que la cloche continue de se remplir. Sans elle, trois lignes non lues
     apres avoir coupe se lisent comme une panne. */
  ok('et l etat coupe nomme toujours la cloche',
     /cloche/.test(i18n) && /in the bell/.test(i18n))
  /* Une seule ligne a 390px veut dire une cinquantaine de caracteres au plus
     dans cette colonne. 164 en faisaient cinq. */
  const courtes = [...i18n.matchAll(/'gnotif\.off_help': '([^']*)'/g)].map((m) => m[1])
  ok(`les deux phrases d etat coupe tiennent en une ligne (${courtes.map((s) => s.length).join(', ')})`,
     courtes.length === 2 && courtes.every((s) => s.length <= 50),
     courtes.join(' | '))

  /* La politique n'a pas de chemin de groupe, et c'est la fonctionnalite. */
  /* Sans les commentaires: l'explication de cette migration NOMME is_member et
     is_group_admin pour dire pourquoi elle ne s'en sert pas, et la premiere
     version de ce test a echoue sur sa propre justification. */
  const sql = read('supabase/69_group_mute.sql').replace(/^\s*--.*$/gm, '')
  ok('la table existe', /create table if not exists group_mute/.test(sql))
  ok('RLS est active', /alter table group_mute enable row level security/.test(sql))
  ok('et la politique est user_id = auth.uid(), rien d autre',
     /using \(user_id = auth\.uid\(\)\)/.test(sql)
       && /with check \(user_id = auth\.uid\(\)\)/.test(sql)
       && !/is_member\(|is_group_admin\(/.test(sql),
     'un membre n a pas a savoir qui l a coupe')
  ok('rien n est a rattraper le jour de la migration',
     !/^\s*update profiles/m.test(sql) && !/insert into group_mute/.test(sql),
     'absence de ligne = non coupe, donc le comportement ne change pour personne')
}

/**
 * LE FRANCAIS PORTE SES ACCENTS.
 *
 * "Regles prevues" etait a l'ecran, en toutes lettres, sur la capture qu'elle a
 * envoyee. Ce n'etait pas une faute isolee: trente-sept lignes du bloc fr
 * etaient ecrites sans accents, presque toutes dans le cycle.
 *
 * Le bloc fr SEULEMENT. "medical" et "regular" sont des mots anglais justes, et
 * une recherche sur tout le fichier les refuserait pour une raison qui n'existe
 * pas.
 *
 * La liste ne contient que des formes qui n'ont AUCUNE lecture correcte sans
 * accent en francais. "cote" en est absent: un cote et un cote existent tous
 * les deux. "arrive" aussi: "ca arrive tous les mois" est juste.
 */
{
  const i18n = read('src/lib/i18n.jsx')
  /* Sans les commentaires. Ils sont en ASCII partout dans ce depot, par choix,
     et "plutot que" dans une explication n'est pas une chaine que quelqu'un
     lit a l'ecran. Mesure: la premiere version de ce test a echoue dessus. */
  const fr = i18n
    .slice(i18n.indexOf('\n  fr: {'))
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
  ok('le bloc francais a bien ete trouve', fr.length > 1000 && fr.includes("'cycle.title'"))

  const INTERDITS = [
    'Regles', 'regles enregistrees', 'prevue', 'prevues', 'prevu ', 'Prevu', 'Prevois',
    'Prepare ', 'prevision', 'prevenir', 'ecart', 'donnees', 'plutot', 'regulier',
    'Fenetre', 'luteale', 'recompense', 'Duree', 'Utilisee', 'entree', 'entrees',
    'Demarrees', 'supprimee', 'Appuye ', 'obligee', 'echeances', 'Verification',
    'deploye', 'repondu', 'precedentes', 'recentes', 'avis medical', 'jours pres',
    /* Ajoutes quand la capture du dialogue "Modifier quoi ?" a montre "se
       repete" et "toute la serie": la liste ne couvrait que les mots du cycle,
       donc elle ne pouvait pas trouver ceux du calendrier. */
    'la serie', 'se repete', 'Se repete', 'Debut du', 'A partir du',
    "'Etude'", 'Evenement', 'Fete', 'cet evenement',
    /* Trouves en redessinant le formulaire: la puce "Sante" etait a l'ecran
       sans son accent depuis le debut, et "a la date ci-dessous" est la ligne
       qui s'affiche sous les jours de la semaine quand aucun n'est coche. Le
       mot est dans la liste, la phrase est prise avec sa virgule parce que
       "a la" tout seul a des lectures justes. */
    "'Sante'", ', a la date',
  ]
  const restants = INTERDITS.filter((m) => fr.includes(m))
  ok('aucune chaine francaise ne se promene sans ses accents',
     restants.length === 0,
     restants.join(', '))

  /* Et les accents sont bien arrives, plutot qu'avoir ete enleves avec le mot.
     Un test qui ne verifie que l'absence passe aussi quand on supprime la
     phrase. */
  for (const attendu of ['Règles prévues', 'plutôt régulier', 'Fenêtre fertile',
                         'à un jour près', 'phase lutéale',
                         'se répète', 'toute la série', 'Événement',
                         "'Santé'", 'à la date ci-dessous']) {
    ok(`et "${attendu}" est ecrit comme ca`, fr.includes(attendu))
  }
}

/**
 * LES HUMEURS QUE L'APPLICATION OFFRE ET CELLES QUE LA BASE ACCEPTE.
 *
 * Demande: "add emotion sick".
 *
 * daily_mood.moods porte une contrainte qui NOMME les humeurs acceptees et
 * borne leur nombre. Quand le catalogue avance et que la contrainte reste,
 * toucher le nouveau visage a l'air parfaitement normal, l'upsert est refuse,
 * et la personne qui a touche est la derniere a l'apprendre. C'est ecrit mot
 * pour mot en tete de 48_moods_sad_discouraged.sql, et c'est arrive une fois.
 *
 * Ce cas compare les deux listes plutot que de croire l'une ou l'autre. Il lit
 * la DERNIERE migration qui repose la contrainte, pas un numero fige: en figer
 * un voudrait dire que ce test cesse de mesurer le jour ou une 68 arrive.
 *
 * Le NOMBRE compte autant que la liste: `<= 17` refuserait quelqu'un qui les
 * prend toutes les dix-huit alors que chacune est dedans, la meme panne une
 * touche plus tard.
 */
{
  const sql = readdirSync(join(root, 'supabase'))
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort((a, b) => Number(a.split('_')[0]) - Number(b.split('_')[0]))
    .map((f) => ({ f, texte: read(`supabase/${f}`) }))
    .filter((x) => /add constraint daily_mood_moods_check/.test(x.texte))
    .pop()

  ok('une migration pose la contrainte des humeurs', Boolean(sql), String(sql?.f))

  const liste = (sql?.texte.match(/moods <@ array\[([\s\S]*?)\]::text\[\]/) ?? [])[1] ?? ''
  const acceptes = [...liste.matchAll(/'([a-z]+)'/g)].map((m) => m[1])
  const manquants = MOOD_IDS.filter((id) => !acceptes.includes(id))
  const inconnus = acceptes.filter((id) => !MOOD_IDS.includes(id))

  ok(`la base accepte les ${MOOD_IDS.length} du catalogue (${sql?.f})`,
     manquants.length === 0,
     manquants.length ? `absentes du SQL: ${manquants.join(', ')}` : '')
  ok('et rien de plus', inconnus.length === 0,
     inconnus.length ? `dans le SQL mais pas dans le catalogue: ${inconnus.join(', ')}` : '')

  const borne = Number((sql?.texte.match(/array_length\(moods, 1\), 0\) <= (\d+)/) ?? [])[1])
  ok(`et la borne est ${MOOD_IDS.length}, pas moins`, borne === MOOD_IDS.length,
     `<= ${borne}`)

  /* Et un visage sans libelle rendrait sa cle brute a l'ecran. */
  const i18n = read('src/lib/i18n.jsx')
  const sansLibelle = MOOD_IDS.filter(
    (id) => (i18n.match(new RegExp(`'mood\\.${id}'`, 'g')) ?? []).length !== 2,
  )
  ok('chacune a un libelle dans les deux langues', sansLibelle.length === 0,
     sansLibelle.join(', '))
}

/**
 * RATTRAPER UN JOUR OUBLIE.
 *
 * Demande: "add the ability to go back on previously day to add if the goal
 * where done".
 *
 * Le calendrier de la fiche montrait l'histoire sans permettre de la corriger:
 * ses cases etaient des <div>. La plomberie existait deja, setGoalDay prend une
 * date depuis le debut.
 *
 * Ce qui est epingle, c'est QUELS JOURS refusent le geste. Ce sont exactement
 * les trois que cellClass peignait deja a part, et les confondre est ce qui
 * ferait mentir le compte de jours tenus:
 *
 *   le futur          on ne coche pas demain
 *   avant la creation un objectif cree jeudi n'est pas en retard depuis lundi
 *   un jour non prevu un objectif du lundi et du mercredi n'a rien a se faire
 *                     pardonner un mardi
 */
{
  const gd = code('src/components/GoalDetail.jsx')
  ok('les jours du calendrier sont touchables',
     /data-day=\{st\.day\}/.test(gd) && /onClick=\{\(\) => mark\(date, st\)\}/.test(gd))
  ok('et les trois refus sont dans une seule condition',
     /const canMark = inMonth && !finished && st\.due && !st\.future && !st\.before/.test(gd),
     'les separer est comment l un des trois finit par etre oublie')
  ok('le rattrapage vise LA date touchee, pas aujourd hui',
     /setGoalDay\(goal, nextCount\(goal, st\.done\), date\)/.test(gd),
     'setGoalDay sans troisieme argument ecrit le jour courant')
  ok('avec la meme regle de comptage que le bouton du haut',
     (gd.match(/nextCount\(goal,/g) ?? []).length === 2,
     'deux regles pour le meme geste selon le jour vise serait pire que pas de geste')
  ok('et l ecran dit que c est touchable',
     /data-hook="goal-backfill-hint"/.test(gd),
     'un calendrier devenu cliquable qui n en dit rien est une fonction cachee')
}

/**
 * LA BARRE DU BAS N'A AUCUN ANCETRE ENTRE ELLE ET LE VIEWPORT.
 *
 * Rapporte: "it shall stick to the bottom not be moving around", avec en photo
 * la barre au milieu de l'ecran, du contenu en dessous, et la barre de
 * defilement visible sur le cote: pendant un defilement.
 *
 * Son CSS etait deja juste. Ce qui ne l'etait pas, c'est ou elle se trouvait
 * dans l'arbre: dans `.ground`, qui porte `overflow-x: clip`. Un ancetre qui
 * coupe est la seule chose de cette page qui puisse s'interposer entre un
 * enfant `fixed` et le viewport, et selon le moteur il devient son bloc
 * conteneur, la coupe, ou la laisse decrocher pendant un defilement.
 *
 * Chromium la garde a sa place, mesure a 828px quel que soit le defilement, et
 * WebKit ne peut pas etre installe dans ce conteneur. Ce cas epingle donc la
 * FORME, pas le symptome: la barre est rendue hors de `.ground`, et rien ne
 * doit l'y remettre.
 */
{
  const src = code('src/components/AppShell.jsx')
  ok('AppShell rend un fragment, pas un seul div',
     /return \(\s*<>/.test(src),
     'il en faut un pour que la barre puisse sortir de .ground')
  ok('et la barre du bas en est le dernier enfant, hors de .ground',
     /<TabBar tabs=\{[^}]*\} \/>\s*<\/>\s*\)\s*\}/.test(src),
     'un ancetre qui coupe peut devenir le bloc conteneur d un enfant fixed')

  /**
   * DEUXIEME FOIS, ET CETTE FOIS L'EN-TETE ETAIT SUR LA PHOTO AUSSI.
   *
   *   "The menu bar should stay fixed down, this is a bug."
   *
   * La barre du bas au milieu de l'ecran, ET l'en-tete collant absent du haut.
   * Les deux ensemble designent la cause, parce qu'une seule chose de cette
   * page peut casser les deux: `overflow-x: clip` sur `.ground`.
   *
   * La note d'alors disait pourquoi ce n'etait pas `hidden`: un ancetre qui
   * coupe en `hidden` tue `position: sticky`. La specification dit qu'un axe
   * en `clip` laisse l'autre en `visible`, la ou `hidden` le force a `auto`.
   * WebKit n'a pas toujours fait cette difference, et un `overflow-y` a `auto`
   * est un conteneur de defilement: l'en-tete se colle alors a lui, il ne
   * defile jamais, donc l'en-tete s'en va avec la page.
   *
   * ELLE NE MANQUE PLUS. Le rail de stickers coupe sur son enveloppe,
   * `absolute inset-0` de `.ground`. Elle s'arretait avant le bas d'une page
   * longue; mesure aujourd'hui sur 4412px, l'enveloppe, `.ground` et le
   * document font tous les trois 4412px. Et le balayage passe a 320px, la
   * largeur ou le defaut s'etait vu et ou il n'y avait pas d'instrument.
   */
  ok('et .ground ne coupe plus rien',
     !/overflow-x: clip/.test(code('src/index.css')),
     'un ancetre qui coupe tue position: sticky sur les moteurs qui confondent clip et hidden')
  ok('le rail de stickers coupe sur sa propre enveloppe',
     /absolute inset-0 z-20 overflow-hidden/.test(code('src/components/Stickers.jsx')),
     'c est la que la coupe appartient: sur ce qui deborde')
  ok('et le balayage regarde enfin 320px',
     /SWEEP_WIDTHS \?\? '320,390,820,1180,1440'/.test(read('scripts/sweep-widths.mjs')),
     'la largeur ou les sept pixels de defilement lateral s etaient vus')

  /**
   * ET LE VERRE N'EST PLUS SUR L'ELEMENT `fixed`.
   *
   * Un backdrop-filter doit reechantillonner ce qu'il y a derriere a chaque
   * image. WebKit ne sait pas le faire sur le fil du defilement: la couche
   * retombe sur le fil principal et se peint avec un defilement en retard, ce
   * qui est une barre qui flotte au milieu de l'ecran pendant qu'on glisse.
   *
   * Deux boites: la `fixed` tient la position et ne porte aucun filtre,
   * l'interieure tient le verre et ne depend pas du defilement. C'est deja la
   * forme de TopNav, ou le <header> est `sticky` et le verre est sur le <nav>
   * dedans.
   *
   * Mesure: la barre est au meme pixel a tous les crans (836 sur 852), et la
   * capture apres est identique a la capture avant, pixel pour pixel.
   */
  ok('la boite qui est fixed ne porte pas le verre',
     /className="fixed inset-x-4 bottom-4 z-30 mx-auto max-w-content md:hidden"/.test(src),
     'un backdrop-filter sur un element dont la position depend du defilement decroche sur WebKit')
  ok('et le verre est sur une boite interieure',
     /data-hook="tab-bar"[\s\S]{0,400}<div className="lg lg-chrome">/.test(src))
  ok('comme l en-tete, qui a deja cette forme',
     /<header className="sticky top-0 z-40 px-4 pt-4 md:hidden">\s*\n\s*<nav className="lg lg-chrome/.test(src),
     'deux barres de la meme application ne doivent pas resoudre le meme probleme differemment')
}

ok(
  /* Etait `stickerFor(activeId)`. Depuis la migration 66 un groupe choisit son
     image, et le rail doit lire ce choix: sinon il montre la face calculee a
     cote de la page ou le choix vient d'etre fait, ce qui est exactement le
     desaccord entre deux surfaces que ce cas existe pour empecher. */
  'the rail badge draws the group sticker, the chosen one',
  /data-hook="rail-group"[\s\S]{0,700}stickerFor\(activeId, group\.sticker\)/.test(shell) &&
    /from '\.\.\/lib\/art'/.test(shell),
  'the settings header already uses stickerFor, so this is two surfaces agreeing',
)
ok(
  'and keeps the initial underneath as the fallback',
  /data-hook="rail-group"[\s\S]{0,600}group\.name\.trim\(\)\]\[0\]\?\.toUpperCase\(\)/.test(shell),
  'a renamed PNG is a 404, not a page error, so nothing else would catch it',
)
ok(
  'the picture is decorative, so the name is still the accessible one',
  /data-hook="rail-group"[\s\S]{0,900}alt=""[\s\S]{0,80}aria-hidden="true"/.test(shell) &&
    /aria-label=\{group\.name\}/.test(shell),
  'a screen reader gets the group name, not a sticker filename',
)

/* --- the rail says what its icons mean ----------------------------------- */

/**
 * The one that matters most, and the reason it is an assertion rather than a
 * comment. An icon-only rail puts its names in a hover tooltip, and a tablet
 * has no hover: this layout exists FOR tablets. Deleting the label to save
 * 14px would leave an iPad user with no way to learn what a ring means short
 * of pressing it, and nothing would look broken.
 */
const icons = read('src/components/NavIcons.jsx')
ok('there is an icon set', /export const NAV_ICON/.test(icons))
ok(
  'every icon takes the current colour rather than its own',
  !/stroke="#|fill="#/.test(icons),
  'a hard-coded hue is right in exactly one of the two themes',
)
ok(
  'and none of them is announced to a screen reader',
  /'aria-hidden': 'true'/.test(icons),
  'the accessible name belongs to the link, not to the drawing',
)
/**
 * ICONS ALONE, ASKED FOR, AND THE NAMES HAD TO GO SOMEWHERE.
 *
 * The 11px word under each icon existed because an icon-only rail puts its
 * names in a hover tooltip and a tablet has no hover. That argument did not
 * change; it was overruled, which is a different thing, and these are what
 * stop the overrule costing a screen reader anything.
 *
 * An icon whose link has no text and no aria-label is an unlabelled link. This
 * is the assertion that catches somebody removing one.
 */
/* Scoped to SideRail, and with a window big enough to hold one. The first
   version searched the whole file at 700 characters and found ONE of the three
   NavLinks: the rail's blocks are longer than that because of the comment
   inside the className function, and the tab bar's link was being checked for
   an aria-label it does not need, since its name is the word inside it. */
const railSrc = shell.slice(shell.indexOf('function SideRail'), shell.indexOf('function TabBar'))
const railLinks = railSrc.match(/<NavLink[\s\S]{0,2000}?<\/NavLink>/g) ?? []
ok('the rail still has its links', railLinks.length >= 2, String(railLinks.length))
ok(
  'no rail item is left unlabelled',
  railLinks.every((l) => /aria-label=/.test(l)),
  'the visible word is gone, so this is the only accessible name left',
)
ok(
  'and every one carries a tooltip as well',
  railLinks.every((l) => /title=/.test(l)),
  'the weakest affordance available without a printed word, and better than none',
)
ok('there is no label component left over', !/RailLabel/.test(shell))
ok(
  'the bell has both too',
  /aria-label=\{count \?/.test(read('src/components/NotificationBell.jsx')) &&
    /title=\{count \?/.test(read('src/components/NotificationBell.jsx')),
)

/* --- the calendar uses the width ---------------------------------------- */

const cal = read('src/pages/Calendar.jsx')

ok(
  'the calendar has no width cap above md, and it is the only page without one',
  /max-w-content[^"]*md:max-w-none/.test(cal),
  'a grid is the exception; a 1200px settings form is worse, not better',
)
/* --- and so does every other page --------------------------------------- */

/**
 * THE 40REM COLUMN IS GONE, ON PURPOSE, AND THE LIMITS MOVED INWARD.
 *
 * The argument for keeping it was about CONTENT and was being made with a rule
 * about the PAGE, which cost every grid, table and card list on every screen.
 * These pin the replacement: the page is released, and the things that
 * genuinely need a limit carry their own.
 *
 * If somebody puts a cap back on .shell, the ones below start failing, which is
 * the signal that the fix belongs on a paragraph or an input instead.
 */
const css = read('src/index.css')

ok(
  'the shell is released above md',
  /\.shell \{[\s\S]{0,140}md:max-w-none/.test(css),
  'this is the change that was asked for twice',
)
ok(
  'and is still a reading column on a phone',
  /\.shell \{[\s\S]{0,140}max-w-content/.test(css),
  'a phone has one width and none of this applies to it',
)
ok('there is a limit for prose', /\.measure \{/.test(css))
ok('and one for a form', /\.measure-form \{/.test(css))
ok(
  'a card list becomes columns rather than full-width rows',
  /\.card-grid \{[\s\S]{0,120}lg:grid-cols-2/.test(css),
  'measured on goals at 1440: Supprimer and Terminer ended up 800px apart',
)
/* Les reglages sont une SUITE maintenant, pas deux colonnes: voir la note sur
   .column-page. Ce qui restait a verifier de cette assertion est qu'aucune
   colonne n'est revenue par la bande. */
ok(
  'a settings page is one column, never a grid of boxes',
  !/\.pane-grid \{[\s\S]{0,120}grid-cols-/.test(css),
  'deux colonnes de cases sont ce qui a ete appele un bento, trois fois',
)
ok(
  'a button stops before it becomes a section of the page',
  /\.btn \{[\s\S]{0,300}md:max-w-\[26rem\]/.test(css),
  'measured at 1440: "Configurer mon budget" was a 1213px pink bar',
)
ok(
  'and is still full width on a phone, where that was decided',
  /\.btn \{[\s\S]{0,220}w-full/.test(css),
)
ok(
  'the card lists actually use it',
  (read('src/pages/Goals.jsx').match(/card-grid/g) ?? []).length >= 4 &&
    /card-grid/.test(read('src/pages/Library.jsx')),
)
ok(
  'and the settings pages use the pane grid',
  /pane-grid/.test(read('src/pages/Me.jsx')) && /pane-grid/.test(read('src/pages/Account.jsx')),
)

/**
 * LES QUATRE ETAGERES DE LECTURES.
 *
 * La page empilait quatre sortes de contenu dans une seule colonne: une carte
 * "ouvrir les cours", la formation sous son propre titre, deux bannieres
 * d'etudes, puis le catalogue. Rien ne les separait, et le catalogue etait a
 * quatre ecrans de defilement du titre.
 *
 * Ce qui a ete demande: "barre d'onglets defilante, tout en haut de l'ecran,
 * juste en dessous du titre principal Library" avec [ Courses ] [ Articles ]
 * [ Books ] [ Studies ], et "supprimer la carte intermediaire / le bouton
 * d'atterrissage (Open the courses)".
 *
 * Mesure dans Chromium, sur les captures et pas sur les styles calcules, aux
 * quatre largeurs de la sonde. Les contrastes sont dans probe/shelf.mjs.
 */
const lib = read('src/pages/Library.jsx')
{
  /* Par position et pas par une regex bornee: la distance entre les deux
     balises est faite de commentaires, donc un `{0,400}` mesure la longueur
     d'une note plutot que l'ordre des elements, et se casse a la prochaine
     phrase ajoutee. Le dernier TopBar est celui de la page; le premier est
     dans le retour anticipe de la formation. */
  const bar = lib.lastIndexOf('<TopBar')
  const rail = lib.indexOf('<ShelfTabs')
  const firstShelf = lib.indexOf('<Section', bar)
  ok(
    'the tab rail sits under the title, before anything else',
    bar > 0 && rail > bar && firstShelf > rail,
    'a rail below the first shelf is a rail nobody scrolls back up to find',
  )
}
ok(
  'and the landing card that stood in front of the courses is gone',
  !/data-hook="to-courses"/.test(lib) && !/courses\.enter/.test(read('src/lib/i18n.jsx')),
  'it did not lead to a course, it led to a page that listed the courses',
)
ok(
  'the courses are listed on the page itself',
  /data-hook="course-card"/.test(lib) && /COURSES\.map/.test(lib),
  'the whole point of removing the door is that what was behind it is here',
)
ok(
  'the shelf lives in the query string, not in a useState',
  /params\.get\('shelf'\)/.test(lib) && !/useState\([^)]*shelf/i.test(lib),
  'the phone back button would otherwise leave the page instead of the tab',
)
{
  const i18n = read('src/lib/i18n.jsx')
  for (const [k, en, fr] of [
    ['courses', 'Courses', 'Cours'],
    ['articles', 'Articles', 'Articles'],
    ['books', 'Books', 'Livres'],
    ['studies', 'Studies', 'Études'],
  ]) {
    ok(
      `the ${k} tab is written in both locales`,
      i18n.includes(`'library.tab_${k}': '${en}'`) && i18n.includes(`'library.tab_${k}': '${fr}'`),
      'a key added to one locale only shows the other locale an English word',
    )
  }
}
ok(
  'the start button is written in both locales',
  /'courses\.start': 'Start the course'/.test(read('src/lib/i18n.jsx')) &&
    /'courses\.start': 'Commencer le cours'/.test(read('src/lib/i18n.jsx')),
)
ok(
  'no page opts out with a prop any more',
  !/shell-wide/.test(css) && !/<Screen wide/.test(read('src/pages/Dashboard.jsx')),
  'a prop every caller passes and nothing reads is one the next person has to check',
)
ok('month tiles grow when there is room', /md:min-h-\[6\.5rem\]/.test(cal))
ok(
  'and show a third entry rather than counting it as hidden',
  /const shown = useWide\(\) \? 3 : 2/.test(cal),
  'a class cannot change the number passed to slice()',
)

/* The two-column split is gone. It was xl-only and still cost a laptop 20rem
   for a panel that is mostly four dates; the drawer costs the grid nothing at
   any width. */
ok(
  'the cycle panel no longer takes a column from the grid',
  !/xl:grid-cols-\[minmax\(0,1fr\)_20rem\]/.test(cal),
  'this is what left the grid at 572px on an iPad in landscape',
)
ok('it is a drawer', /data-hook="cycle-drawer"/.test(read('src/components/CyclePanel.jsx')))

/* --- the layers ---------------------------------------------------------- */

ok('there is a layer toolbar', /data-hook="cal-layers"/.test(cal))

/**
 * ET LES CINQ PASTILLES SONT DERRIERE UN "..." .
 *
 *   "From timetable to cycle remove them, put them together on a 3 dots icon
 *    like ..."
 *
 * Cinq pastilles en rang faisaient deux lignes de chrome sur un telephone
 * avant d'arriver au mois, pour des reglages qu'on touche une fois et pas tous
 * les jours.
 *
 * Trois choses sont epinglees, et chacune se casserait en silence.
 */
ok('les calques sont dans un menu, plus en rang',
   /data-hook="cal-layers-open"/.test(cal) && /data-hook="cal-layers-menu"/.test(cal)
     && /aria-haspopup="true"/.test(cal),
   'cinq pastilles avant la grille sont deux lignes de reglages avant ce qu on vient voir')
ok('le bouton dit combien sont eteints, en chiffres',
   /data-hook="cal-layers-off"/.test(cal) && /cal\.layers_some/.test(cal),
   'sinon un mois auquel il manque des choses ressemble a un mois vide')
/**
 * LES DEUX SORTIES. Un panneau qui ne se ferme qu'en retouchant son bouton est
 * un panneau qu'on laisse ouvert par-dessus la grille. `pointerdown` et pas
 * `click`: sur un ecran tactile le clic arrive a la fin du geste, donc le menu
 * restait ouvert le temps du deplacement du doigt.
 */
ok('il se ferme en touchant ailleurs et avec Echap',
   /document\.addEventListener\('pointerdown', ailleurs\)/.test(cal)
     && /e\.key === 'Escape'/.test(cal),
   'un seul des deux et le menu reste ouvert sur la grille')
ok('et les deux ecouteurs sont retires avec lui',
   /removeEventListener\('pointerdown', ailleurs\)/.test(cal)
     && /removeEventListener\('keydown', echap\)/.test(cal),
   'deux ecouteurs sur le document pour une page qui n en a pas besoin')
/**
 * ET LES DEUX FAUTES QUE CE PANNEAU A FAITES AVANT D'ETRE JUSTE, TOUTES DEUX
 * DEJA ECRITES SUR LE PANNEAU DES "?" DANS ui.jsx.
 *
 * Ancre sur le BOUTON avec left-0: mesure a 390px, il partait a x=270 sur 224
 * de large, donc il finissait a 494 sur un ecran de 390 et deux libelles
 * etaient coupes en deux. `right-0` ne fait que deplacer le probleme, la
 * rangee passant a la ligne. Ancre sur la rangee, il va de 16 a 256 sur 390.
 *
 * Et en `.lg`, la feuille des cartes: ouvert au-dessus de la carte du mois, on
 * lisait "September 2026" a travers les libelles. Le flou n'y change rien, il
 * floute ce qu'il y a derriere sans le cacher.
 */
/* Commentaires retires d'abord: les deux notes qui expliquent ces deux
   corrections vivent entre le data-hook et la classe, et une fenetre assez
   large pour les enjamber serait une fenetre assez large pour attraper
   n'importe quoi. Ce depot a deja paye ce cas une fois. */
const calNu = cal.replace(/\/\*[\s\S]*?\*\//g, '')
ok('le menu s ancre sur la rangee, pas sur le bouton',
   /className="relative flex flex-wrap items-center gap-2" data-hook="cal-actions"/.test(calNu)
     && /data-hook="cal-layers-menu"[\s\S]{0,200}absolute left-0 right-0 top-full/.test(calNu),
   'ancre sur le bouton, il sortait de l ecran par la droite a 390px')
ok('et il est opaque, parce qu il flotte au-dessus de texte',
   /data-hook="cal-layers-menu"[\s\S]{0,200}glass-strong[\s\S]{0,120}bg-surface/.test(calNu),
   'en .lg on lisait le mois a travers les libelles')
ok('les trois points sont dessines, pas le caractere',
   /viewBox="0 0 20 6"/.test(cal) && (cal.match(/<circle cx="\d+" cy="3" r="2\.2"/g) ?? []).length === 3,
   'le caractere tombe sur la ligne de base: trois points colles en bas du bouton')
ok(
  'a layer that is off is not signalled by colour alone',
  /line-through/.test(cal) && /border-2 \$\{LAYER_RING\[layer\]\}/.test(cal),
  'WCAG 1.4.1: the fill, the hollow dot and the struck word all say it',
)
ok(
  'the toggles are buttons that report their own state',
  /aria-pressed=\{on\}/.test(cal),
  'a checkbox in a toolbar implies a form that submits',
)

/* --- rails run to the screen, not to their column ------------------------ */

/**
 * .bleed-row's numbers ARE the layout's numbers, and that is the whole reason
 * these assertions exist.
 *
 * 9.5rem is the nav's 7.5 plus the shell's 2. Change either one and the rows
 * stop at the wrong place: too small and a card hits an invisible wall inside
 * the window, too large and the document scrolls sideways. Both happened. The
 * previous version was inline `-mx-6 px-6` on five elements, which was already
 * 8px wrong the moment the shell went from px-6 to px-8 and nothing said so.
 */
ok(
  'there is one place that knows how far a rail bleeds',
  /\.bleed-row \{/.test(css),
  'it was five copies of -mx-6 px-6, and they were already out of step',
)
ok(
  'the left bleed is the nav offset plus the shell padding',
  /\.bleed-row \{[\s\S]{0,600}margin-left: -7\.5rem/.test(css) &&
    /\.bleed-row \{[\s\S]{0,600}padding-left: 7\.5rem/.test(css),
  '5.5rem of md:pl on the content wrapper plus 2rem of md:px on the shell',
)
ok(
  'and the right is the shell padding alone, since nothing is over there',
  /\.bleed-row \{[\s\S]{0,600}margin-right: -2rem/.test(css),
)
ok(
  'a snapped card rests on the text column rather than under the nav',
  /\.bleed-row \{[\s\S]{0,600}scroll-padding-left: 7\.5rem/.test(css),
  'without this the snap points sit at the scroller edge and card one parks behind the glass',
)
/* Matched inside a className rather than anywhere in the file. The first
   version of this looked for the bare string and failed on the comment that
   explains why the string is gone. */
ok(
  'no rail still bleeds by the old inline amount',
  !['NudgeBanner', 'BirthdayBanner', 'MonthByMonth'].some((f) =>
    /className="(?:[^"]*\s)?-mx-6/.test(read(`src/components/${f}.jsx`)),
  ),
  'a rail that stops 8px short of another rail reads as a mistake',
)
ok(
  'the rails use it',
  ['NudgeBanner', 'BirthdayBanner', 'MonthByMonth'].every((f) =>
    /bleed-row/.test(read(`src/components/${f}.jsx`)),
  ),
)
/* The layering that lets a card go behind rather than over. It already existed
   and is asserted because the effect silently dies if either number moves. */
ok(
  'the nav sits above the page, so a card passes under it',
  /data-hook="side-rail"[\s\S]{0,200}z-30|z-30[\s\S]{0,200}data-hook="side-rail"/.test(shell) &&
    /<div className="relative z-10">/.test(shell),
)

/* --- the check-in screen is gone, and so is the tab that outlived it ----- */

/**
 * BRAVO WAS A PAGE MADE OF TWO LINKS, AND THIS IS WHAT KEEPS IT GONE.
 *
 * The tab was the check-in. The check-in moved onto the goals page, and what
 * was left on that route was a destination whose whole content was "Proof" and
 * "Celebrate", both of which only led somewhere else. Both jobs are sections
 * on the goals page now, so the screen has been deleted rather than emptied
 * again.
 *
 * The route survives as a redirect on purpose: links to /checkin exist in push
 * notifications already delivered, in browser history, and in whatever anybody
 * pasted into a chat. Without it those fall through to the catch-all, which is
 * the dashboard, and somebody following "you have not checked in" lands
 * somewhere that does not mention it.
 */
ok(
  'the check-in screen is deleted, not emptied',
  !existsSync(join(root, 'src/pages/Checkin.jsx')),
)
ok(
  'the tab is out of the group nav',
  !/nav\.checkin/.test(shell) && !/g\/\$\{id\}\/checkin/.test(shell),
)
ok(
  'but the route still resolves, as a redirect',
  /path="checkin" element=\{<CheckinRedirect \/>\}/.test(read('src/App.jsx')) &&
    /Navigate to=\{`\/g\/\$\{groupId\}\/goals`\}/.test(read('src/App.jsx')),
  'a dead link from a push notification would otherwise land on the dashboard',
)
for (const [file, what] of [
  ['src/pages/Board.jsx', 'the board'],
  ['src/pages/Dashboard.jsx', 'the dashboard'],
  ['src/components/TodayObjective.jsx', "today's objective"],
]) {
  ok(
    `${what} sends people to the goals page, not through the redirect`,
    !/\/checkin`/.test(read(file)),
    'a redirect is for links we do not control, not for our own',
  )
}
/* Comments stripped first, like cycCode below. The first version of this
   assertion failed against a codebase that was already correct, because the
   note explaining WHY CameraIcon was removed names CameraIcon. */
ok(
  'the glyphs it used are not left behind',
  !/ForwardIcon|CameraIcon|PartyIcon/.test(code('src/components/ActionBar.jsx')) &&
    !/IconCheckin/.test(code('src/components/NavIcons.jsx')),
  'an exported glyph with no caller is the start of a sprite sheet',
)
ok(
  'and neither are its strings',
  !/checkin\.tab_next|checkin\.one_thing|'board\.next'|'nav\.checkin'|'checkin\.tab_proof'|'checkin\.tab_celebrate'/.test(
    read('src/lib/i18n.jsx'),
  ),
)
ok(
  'the board does not show a next commitment that can no longer be written',
  !/next_commitment/.test(read('src/pages/Board.jsx')),
)

/**
 * THE DAILY QUESTION RUNS IN BOTH MODES, AND THEY WRITE TO DIFFERENT TABLES.
 *
 * A group goal is answered into a cycle: submit_checkin upserts the whole
 * checkin_items list, which is why the group branch posts every answer. A solo
 * goal has no cycle, because cycles.group_id is not null, so it is written to
 * goal_days one row at a time through the same setGoalDay the card's tick
 * calls. Asserting the split is asserting that neither branch was quietly
 * pointed at the other's table.
 */
ok(
  'the check-in opens for a solo goal too',
  /const openSolo = !groupId/.test(goalsPage) &&
    /const open = openGroup \|\| openSolo/.test(goalsPage),
)
ok(
  'solo writes goal_days through setGoalDay, not the cycle queue',
  /if \(openSolo\)[\s\S]{0,900}setGoalDay\(g, count, now\)/.test(goalsPage),
)
ok(
  'and the cycle queue is still what a group answer goes through',
  /enqueue\(\{ cycle_id: currentCycle\.id/.test(goalsPage),
)
ok(
  'the evidence picker is off where there is nowhere to store it',
  /proof=\{openGroup\}/.test(goalsPage) &&
    /wantProof && proof !== 'none'/.test(read('src/components/CheckinCarousel.jsx')),
  'goal_days has a count and a date and no column for a photograph',
)
ok(
  'and the carousel is still rendered for the link that opens it',
  /\{carousel && \(/.test(goalsPage) && /setCarousel\(true\)/.test(goalsPage),
  'a button that sets state nothing reads is a button that does nothing',
)
ok(
  'sitting a period out stays group-only',
  /\{openGroup && \(/.test(goalsPage),
  'away_periods is keyed by cycle_id, and nobody needs to notify themselves',
)
/**
 * THE CARDS CARRY NOTHING UNDER THE RULE, AND THE RAIL CARRIES THE QUESTION.
 *
 * The card had a tick, a "not due today" line, a streak and seven dots. Asked
 * for: "everything after the horizontal line after the objective disappears".
 * The information was not wrong, it was in the wrong place: the rail at the top
 * asks whether today is done, once, and repeating it under every card asked it
 * five more times and made a list of goals read as a list of chores.
 *
 * The `track` prop went with the block instead of being left accepted and
 * ignored. GoalDetail still takes one, because the expanded view is where a
 * streak and a history belong, and GoalCard derives it from the goal rather
 * than being told: a prop is a thing a caller can forget, and the answer is
 * written on the row.
 */
ok(
  'the goal card no longer asks the daily question',
  !/track=\{tracks\}/.test(goalsPage) && !/const tracks = /.test(goalsPage),
  'the rail asks it once, above the list',
)
ok(
  'and the card derives the history flag rather than taking a prop',
  /const solo = !goal\.group_id/.test(gcard) && !/^\s*track = false,$/m.test(gcard),
  'goal_days exists for goals with no group; the row already says which',
)
ok(
  'the detail view keeps its streak and history',
  /track=\{solo\}/.test(gcard),
  'that is where somebody goes when the history IS the question',
)

/* The second door to the calendar is gone. It existed because the bottom bar
   is capped at four tabs and the calendar could not be a fifth; the rail
   carries it at every width above md now, and the tab bar is one tap away
   below. */
ok(
  'the week strip no longer offers its own way into the calendar',
  !/to-calendar|week\.open_calendar/.test(read('src/components/WeekStrip.jsx')),
)
ok(
  'and the string went with it',
  !/week\.open_calendar/.test(read('src/lib/i18n.jsx')),
)

/* --- the calendar's three containers ------------------------------------- */

/**
 * One header carrying a title, three buttons, a view switch, a pager, the
 * month and four filter chips was nine controls of five kinds in one box.
 * The split is by WHAT A CONTROL DOES: row one opens things and turns layers
 * on and off, row two moves around inside what is already drawn, row three is
 * the drawing.
 */
ok('the actions and the filters are their own row', /data-hook="cal-actions"/.test(cal))
ok('the pager is its own card', /data-hook="cal-toolbar"/.test(cal))
ok(
  'and that card holds no filters',
  !/data-hook="cal-toolbar"[\s\S]{0,1400}data-hook="cal-layers"/.test(cal),
  'a toolbar that both changes what is drawn and where you look is one nobody can read',
)
/**
 * THE CANVAS ENDS WHERE THE PAGE DOES.
 *
 * The month grid was 6.5rem per row whatever the window, so on a laptop the
 * card stopped about 220px short of the bottom and left a band of empty ground
 * under it. Measured after: 32px, which is the page's own bottom padding.
 *
 * min-h-0 is the assertion worth having. A flex child defaults to
 * min-height:auto and refuses to shrink below its content, so flex-1 without
 * it does nothing at all and the fix looks applied while changing nothing.
 */
ok(
  'the page is a full-height column above md',
  /md:flex md:h-dvh md:max-w-none md:flex-col/.test(cal),
  'without a height to fill, nothing below can flex into it',
)
ok(
  'the canvas takes what is left, and can shrink',
  /md:flex md:min-h-0 md:flex-1 md:flex-col md:overflow-y-auto/.test(cal),
  'flex-1 without min-h-0 is a no-op, and the day list has to be able to scroll',
)
ok(
  'the month rows share the card',
  /\.month-fill \{[\s\S]{0,120}grid-template-rows: auto repeat\(var\(--weeks/.test(css),
  'a month is five or six weeks, so the count cannot be a literal',
)
ok(
  'and they can shrink below their content',
  /\.month-fill \{[\s\S]{0,120}minmax\(0, 1fr\)/.test(css),
  'a bare 1fr row will not shrink, so a busy month would push past the card',
)
ok(
  'the fill is above md only',
  /@media \(min-width: 768px\) \{\s*\.month-fill/.test(css),
  'six rows across a 600px phone is 90px each, which holds a date and nothing',
)
ok(
  'the week hours fill too, with a floor',
  /\.week-hours \{[\s\S]{0,200}min-height: calc\(var\(--hours/.test(css),
  'a short window scrolls the canvas rather than crushing a nine-hour day',
)
ok(
  'and the hour height is not inline',
  !/style=\{\{ height: `\$\{hours\.length \* 3\}rem` \}\}/.test(cal),
  'an inline style beats every class, so it could not be released at one breakpoint',
)

ok(
  'the month is the heading now that the page title has gone up',
  /<h1[^>]*first-letter:uppercase[\s\S]{0,220}fmt\.format\(anchor\)/.test(cal),
  'Intl returns "septembre 2026" in French and "September 2026" in English',
)

/**
 * ET LA BARRE DU MOIS TIENT SUR DEUX LIGNES SUR UN TELEPHONE, PLUS TROIS.
 *
 *   "So there's more space for the calendar."
 *
 * Les trois groupes etaient trois elements d'une rangee qui passe a la ligne,
 * donc a 390px chacun prenait la sienne. Mesure avant: 158px de barre, la
 * grille ne commencant qu'a 368px du haut d'un ecran de 844.
 *
 * Le mois et le pager partagent la premiere ligne, les onglets prennent la
 * seconde sur toute la largeur. Mesure apres: 112px, grille a 322.
 *
 * ET LE NOM DU MOIS RACCOURCIT SOUS sm, parce qu'il ne tenait a AUCUNE largeur
 * de telephone: a 390 la rangee interieure fait 324px pour un titre de 165, un
 * pager de 148 et 12 d'ecart, soit 325. Un pixel de trop, et la barre
 * reprenait ses trois etages.
 */
ok('le mois et le pager partagent une ligne, les onglets prennent la suivante',
   /<div className="flex flex-wrap items-center gap-x-3 gap-y-2">/.test(cal)
     && /className="flex w-full gap-1 rounded-pill bg-ink\/\[0\.06\] p-1 sm:w-auto"/.test(cal),
   'trois elements dans une rangee qui passe a la ligne font trois lignes a 390px')
ok('le titre ne se replie pas: c est le pager qui bouge s il le faut',
   /<h1 className="flex-1 shrink-0 whitespace-nowrap/.test(cal) && !/<h1 className="text-safe[^"]*whitespace-nowrap/.test(cal),
   '.text-safe porte min-w-0, donc le titre passait PAR DESSUS le pager a 320px')
ok('et le mois est ecrit en court sous sm',
   /const fmtCourt = new Intl\.DateTimeFormat/.test(cal)
     && /<span className="sm:hidden">\{fmtCourt\.format\(anchor\)\}<\/span>/.test(cal),
   '"September 2026" plus le pager font 325px pour 324 de rangee')

/* --- the secondary button is glass --------------------------------------- */

ok(
  'the secondary button is a raised sheet rather than an outline',
  /\.goal-action \{[\s\S]{0,400}var\(--glass-tint\)/.test(css),
  'an outline round transparent nothing reads as disabled beside a filled button',
)
ok(
  'it uses the token and not a literal white',
  !/\.goal-action \{[\s\S]{0,400}bg-white/.test(css),
  'a literal white stays white on a surface a token would have darkened',
)
ok('and it lifts on hover', /\.goal-action:hover \{[\s\S]{0,200}translateY\(-2px\)/.test(css))
ok(
  'with the motion opted out of',
  /prefers-reduced-motion[\s\S]{0,300}\.goal-action/.test(css),
)

/**
 * LE PROFIL EST DEUX COLONNES QUI COULENT, PLUS UNE GRILLE DE CASES.
 *
 *   "Same here" -- le meme vide que sur le tableau de bord.
 *
 * La grille placait chaque carte dans une case, et la hauteur d'une rangee est
 * celle de son plus grand element. Mesure a 1024, 1180, 1290, 1440 et 1728:
 * les preferences, 293px, tenaient seules une rangee haute de 1027px, donc
 * 1096px de colonne vide, 79% d'elle.
 *
 * `dense` etait la pour que l'aside remonte a cote du formulaire, et il
 * marchait pour ca. Ce qu'il ne pouvait pas faire, c'est empiler DEUX cartes
 * dans la colonne etroite: la rangee 1 etant prise, la deuxieme partait en
 * rangee 2, sous le formulaire. Mesure: y=1255. Le trou changeait de place.
 *
 * Deux colonnes reelles, chacune a sa hauteur, comme .page-grid. Le placement
 * explicite et `dense` n'ont plus d'objet et sont partis.
 */
ok('there is a profile grid', /\.profile-grid \{/.test(css))
ok(
  'et ce sont deux colonnes, pas des cases placees a la main',
  /\.pane-col-main \{[^}]*flex-col/.test(css) && /\.pane-col-aside \{[^}]*flex-col/.test(css),
  'une colonne qui coule ne se fabrique pas avec des rangees',
)
ok(
  'le placement case par case est parti avec',
  !/grid-auto-flow: row dense/.test(css) && !/\.profile-grid > \.pane-aside/.test(css),
  'une regle qui ne place plus rien est une regle que le prochain doit verifier',
)
{
  const me = code('src/pages/Me.jsx')
  ok(
    'la page ouvre bien ses deux colonnes',
    /className="pane-col-main/.test(me) && /className="pane-col-aside/.test(me),
  )
  ok(
    'et plus aucune section ne porte l ancienne classe',
    !/className="pane-aside"/.test(me),
  )
  /* Le formulaire reste PREMIER dans le DOM: c'est ce qu'on vient chercher, et
     c'est l'ordre juste sur un telephone. L'echange se fait avec `order`, donc
     la tabulation et le lecteur d'ecran suivent toujours le DOM. */
  ok(
    'le formulaire vient avant les preferences dans le DOM',
    me.indexOf('className="pane-col-main') < me.indexOf('className="pane-col-aside'),
    'personne ne doit tabuler vers les preferences avant d avoir vu son nom',
  )
  /* Et il vient aussi en premier A L'ECRAN, partout. `order` posait l'aside a
     gauche du formulaire pendant qu'il y avait deux colonnes; dans une colonne
     unique il ne ferait qu'une chose, montrer aux grands ecrans une suite
     differente de celle du telephone. */
  ok(
    'et plus aucun `order` ne le contredit au-dessus de lg',
    !/\.pane-col-main \{[^}]*order-/.test(css) && !/\.pane-col-aside \{[^}]*order-/.test(css),
  )
}

/**
 * LES REGLAGES AUSSI: DEUX COLONNES QUI COULENT.
 *
 *   "Same" -- le troisieme ecran avec le meme vide.
 *
 * Mesure a 1024, 1180, 1290, 1440 et 1728: "Quand et comment te joindre" fait
 * 1686px, la rangee qui la contient aussi, et "Notifications" en face, 178px,
 * avait 1471px de vide sous elle. Sur toute la page 1856px de trous pour
 * 2395px de grille, soit 77%, et la page mesurait 2395px pour 1102px de
 * contenu dans une colonne.
 */
{
  const acc = code('src/pages/Account.jsx')
  ok('la page des reglages a deux colonnes qui coulent',
     /className="pane-col-a/.test(acc) && /className="pane-col-b/.test(acc)
       && /\.pane-col-a \{[^}]*flex-col/.test(css) && /\.pane-col-b \{[^}]*flex-col/.test(css))
  ok('et une seule de chaque, pas trois boites',
     (acc.match(/className="pane-col-a/g) ?? []).length === 1
       && (acc.match(/className="pane-col-b/g) ?? []).length === 1,
     'la premiere version en avait ouvert trois')

  /* Les deux moities d'un meme reglage restent voisines: la note en tete de
     push.section dit qu'accorder la permission sans regler les heures se lit
     comme une fonction cassee. */
  ok('les deux sections des notifications sont dans la meme colonne',
     acc.indexOf("t('push.section')") > acc.indexOf('className="pane-col-a')
       && acc.indexOf("t('remind.section')") < acc.indexOf('className="pane-col-b'),
     'les separer casserait la paire que la note de push.section protege')

  /* ET LA ZONE DE DANGER RESTE DERNIERE SUR UN TELEPHONE. L'ordre du DOM est
     l'ordre de la pile, et "Supprimer mon compte" au milieu serait une ligne
     sur le chemin de quelqu'un qui descend vers autre chose. */
  ok('la zone de danger est la derniere section du DOM',
     acc.lastIndexOf("t('danger.zone')") > acc.lastIndexOf("t('me.account')")
       && acc.lastIndexOf("t('danger.zone')") > acc.lastIndexOf("t('remind.section')"))
  ok('et plus aucun `order` ne le contredit au-dessus de lg',
     !/\.pane-col-a \{[^}]*order-/.test(css) && !/\.pane-col-b \{[^}]*order-/.test(css),
     'une colonne unique montrerait sinon deux suites differentes selon la largeur')
}

/* --- the sign-in is a card, and only where there is room for one ---------- */

const signin = read('src/pages/SignIn.jsx')
ok(
  'the sign-in centres from sm up rather than pinning top and bottom',
  /sm:justify-center/.test(signin),
  'justify-between on a laptop put the pitch and the button 900px apart',
)
ok(
  'and there is no card on a phone',
  /sm:lg sm:lg-frost/.test(signin),
  'a card inside a 390px screen is a border drawn 16px from another border',
)

/* --- decoration stays where it has room --------------------------------- */

const stickers = read('src/components/Stickers.jsx')
ok(
  'the stickers are limited to the phone layout',
  /absolute inset-0 z-20 overflow-hidden md:hidden/.test(stickers),
  'measured at 1440px they landed on the page title, a calendar tile and the cycle panel',
)

/* --- a dialog is not chrome ---------------------------------------------- */

ok('there is a modal treatment of its own', /\.lg-modal \{/.test(css))
/**
 * NEITHER DIAL IS PINNED TO A NUMBER, AND THAT IS DELIBERATE.
 *
 * This pinned `--lg-a: 0.9x` for one round and then the alpha was asked to go
 * back to 0.75, so the test was a record of one afternoon's preference. The
 * replacement pinned the saturate instead, on the theory that it was the dial
 * carrying the tint. The sweep in index.css says otherwise: at a fixed alpha,
 * 120% and 200% land one unit apart. That theory was wrong.
 *
 * So what is asserted is the range each dial has to stay inside for the sheet
 * to be a sheet, and the numbers inside it are taste.
 */
ok(
  'the modal is glass rather than a white rectangle',
  /\.lg-modal \{[\s\S]{0,200}--lg-a: 0\.[5-9][0-9]?;/.test(css),
  'at 1 the backdrop-filter is dead weight and the sheet stops reading as a sheet',
)
ok(
  'and not so transparent that the page reads through the form',
  Number((css.match(/\.lg-modal \{[\s\S]{0,200}--lg-a: (0\.[0-9]+);/) ?? [])[1]) >= 0.7,
  'measured, 0.75 puts the sheet at #F1EFF0 over the real page; below that it keeps darkening',
)
ok(
  'the dialog floats on a two-layer shadow',
  /\.lg-modal \{[\s\S]{0,900}box-shadow:\s*\n?\s*0 25px 50px -12px rgb\(var\(--c-accent\)/.test(css),
  'the deep tinted drop and the white halo that were asked for',
)
ok(
  'and it wins over .lg, which sets box-shadow at the same specificity',
  /\.lg-modal \{[\s\S]{0,900}!important/.test(css),
  'without it the shadow is written and silently discarded on source order',
)
ok(
  'the modal input fill is scoped to the modal',
  /\.lg-modal \.field \{/.test(css),
  'unscoped, a 60 per cent white input over the coloured page is the rose fill again',
)
ok(
  'and it goes opaque on focus',
  /\.lg-modal \.field:focus \{[\s\S]{0,160}background-color: rgb\(var\(--c-surface\)\)/.test(css),
)

const wizard = read('src/components/TimetableWizard.jsx')
const cyclePanel = read('src/components/CyclePanel.jsx')
for (const [name, src] of [['the event form', cal], ['the wizard', wizard], ['the cycle drawer', cyclePanel]]) {
  ok(`${name} uses it`, /lg lg-modal/.test(src))
  ok(`and ${name} is not chrome any more`, !/lg lg-chrome relative/.test(src))
}
ok(
  'the nav still is chrome',
  /lg lg-chrome/.test(read('src/components/AppShell.jsx')),
  'the bar is a sheet you see the page through on purpose, that is orientation',
)

/* --- the input is white, not a rose well --------------------------------- */

ok(
  'the field is the surface token',
  /\.field \{[\s\S]{0,300}background-color: rgb\(var\(--c-surface\)\)/.test(css),
  'every input in the app sat on --c-raised, which is #FFECEF in sun',
)
ok(
  'and it is not the raised tint any more',
  !/\.field \{[\s\S]{0,300}var\(--c-raised\)/.test(css),
)
ok(
  'it keeps a border, because white on white has no edge',
  /\.field \{[\s\S]{0,300}border: 1px solid rgb\(var\(--c-ink\)/.test(css),
)
ok(
  'and the accent is on the focus ring, where it is a state and not a fill',
  /\.field:focus \{[\s\S]{0,200}box-shadow: 0 0 0 3px rgb\(var\(--c-accent\)/.test(css),
)

/**
 * LE GRIS QUI SE TAIT EST MESURE, ET IL NE L'ETAIT PAS.
 *
 * Deux placeholders sont arrives sur le formulaire d'evenement, et la sonde de
 * contraste les a pris avec la note sous les jours. Sur la feuille du
 * dialogue, qui est --glass-tint a 0.75 sur une page teintee et pas du blanc:
 *
 *   .field::placeholder   --c-muted a 0.75   3.66:1 sun   3.53:1 sea
 *   .field-note           rgb(100 106 116)   4.34:1 sun   4.36:1 sea
 *
 * Le commentaire de .field-note annoncait 4.6:1 "sur blanc". C'etait vrai, et
 * c'etait sur un fond ou ce texte ne se trouve jamais.
 *
 * Apres: 5.50:1 et 4.89:1 en sun, 5.53:1 et 4.91:1 en sea.
 */
ok(
  'the quiet grey is one value and it is named',
  /--quiet-ink: 92 98 108;/.test(css),
)
ok(
  'the placeholder and the hint under a field share it',
  /\.field::placeholder \{\s*color: rgb\(var\(--quiet-ink\)\);/.test(css)
    && /\.field-note \{[\s\S]{0,120}color: rgb\(var\(--quiet-ink\)\);/.test(css),
)
ok(
  'and no placeholder is a diluted theme colour any more',
  !/::placeholder \{[\s\S]{0,120}text-muted\//.test(css)
    && !/::placeholder \{[\s\S]{0,120}var\(--c-muted\) \/ 0/.test(css),
  'un gris a 60 pour cent n a pas de contraste, il a celui du fond sous lui',
)

/* --- the event form is a centred dialog, not a panel in the page --------- */

ok(
  'the event form portals to the body',
  /data-hook="cal-form"[\s\S]{0,400}role="dialog"/.test(cal),
  'a form nested in the page scrolled with it and sat under the rail',
)
ok(
  'and it centres from sm up',
  /items-end justify-center sm:items-center"[\s\S]{0,60}data-hook="cal-form"/.test(cal),
  'a sheet from the bottom on a phone, a centred card on everything else',
)

/* --- ce que la sonde avait trouve sur ce formulaire --------------------- */

/**
 * "AMELIORATE THE DESIGN."
 *
 * Une sonde a ouvert le dialogue a 390, 820, 1290 et 1728 avant d'y toucher.
 * Ce qu'elle a rendu, et qui est ce que ce bloc empeche de revenir:
 *
 *   six etiquettes en CAPITALES grises pour un seul formulaire
 *   "What" large de 608px et vide, "Where" pareil, sans rien dedans
 *   "Starts" et "Ends" larges de 309px chacun, pour cinq caracteres
 *   sept puces qui retombent en six et une, l'orpheline au bout
 *   Enregistrer au fond du defilement, hors de l'ecran sur un telephone
 */
{
  const form = cal.slice(cal.indexOf('function EventForm('))
  ok(
    'the event form has no shouting label left on it',
    !/text-label font-semibold uppercase/.test(form),
    'les capitales grises sont le style des entetes de carte; six empiles font une table des matieres',
  )
  ok(
    'and every field is named in the style the rest of the app names fields',
    (form.match(/className="field-label"/g) ?? []).length >= 8,
    '.field-label existe depuis le formulaire d\'objectif et dit quoi, puis pourquoi, puis un exemple',
  )
  ok(
    'the row of categories finally says what it is asking',
    /field-label">\{t\('cal\.f_kind'\)\}/.test(form),
    'elle flottait sous le titre sans nom, donc rien ne disait que c\'etait une question',
  )
  ok(
    'the two free-text boxes carry an example inside them',
    /placeholder=\{t\('cal\.ph_title'\)\}/.test(form) && /placeholder=\{t\('cal\.ph_where'\)\}/.test(form),
    'un rectangle de 608 sur 74 sans une lettre dedans ne dit pas ce qu\'on attend',
  )
  ok(
    'the clocks are capped at something a clock needs',
    /grid grid-cols-2 gap-3 sm:max-w-\[24rem\]/.test(form),
    'une heure fait cinq caracteres et le champ en faisait 309px',
  )
  ok('and so are the two dates', /grid grid-cols-2 gap-3 sm:max-w-\[28rem\]/.test(form))
  ok(
    'the seven categories sit in a grid rather than a row that falls over',
    /grid grid-cols-2 gap-2 sm:grid-cols-4/.test(form),
    'une puce seule sur sa ligne se lit comme un oubli; une derniere rangee courte se lit comme une grille',
  )
  ok(
    'and the save button is pinned under the scroll, like the wizard next door',
    /border-t border-hairline px-5 py-4">\s*\n\s*<button type="submit"/.test(form),
    'il etait a la fin du defilement, donc a trois coups de pouce du formulaire qu\'on venait de remplir',
  )
  ok(
    'which means the scrolling part is a div inside the form, not the form itself',
    /<form onSubmit=\{save\} className="flex min-h-0 flex-1 flex-col">/.test(form)
      && /<div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">/.test(form),
  )
}

/* Un nom de categorie tient en un mot. "Evenement / Fete" mesurait 146px dans
   une cellule de 146, ce qui est ce qui faisait retomber la rangee. */
{
  const i18n = read('src/lib/i18n.jsx')
  const longs = [...i18n.matchAll(/'cal\.cat_\w+': '([^']*)'/g)]
    .map((m) => m[1])
    .filter((v) => v.includes('/') || v.includes(' '))
  ok('a category is a word, not its own glossary', longs.length === 0, longs.join(', '))
}

/* --- l'appui long sur une carte du rail ---------------------------------- */

/**
 * "APPUYER LONGUEMENT SUR LE GOAL POUR DETAILLER ET POUVOIR AJOUTER LA
 *  PREUVE."
 *
 * Le meme geste et le meme composant que les dates du calendrier: une touche
 * repond, un appui long ouvre. La note de DayCell dit pourquoi ca marche et ca
 * vaut mot pour mot ici.
 *
 * DEUX PIEGES, ET LES DEUX ONT ETE TROUVES PAR LA SONDE, PAS PAR LECTURE.
 *
 * 1. LE CLIC QUI SUIT L'APPUI. Les gestionnaires sont sur la CARTE, donc un
 *    appui long commence sur "Cocher aujourd'hui" ouvre la fiche puis le
 *    relachement declenche quand meme le clic du bouton: la fiche s'ouvrirait
 *    ET la journee serait cochee. `consumedClick` le jette, sur les trois
 *    boutons de la carte.
 *
 * 2. LA CAPTURE DU POINTEUR. useLongPress capture par defaut, ce qui est juste
 *    quand l'element qui tient le geste est celui qu'on clique. Ici le clic
 *    appartient a un ENFANT, et le navigateur emet le clic sur l'ancetre
 *    commun du bas et du haut du pointeur: avec la capture, les deux sont la
 *    carte, donc le bouton ne recevait plus rien. Mesure: zero ecriture apres
 *    une touche courte qui avait toujours marche.
 *
 * Sonde, huit cas, tous justes: une touche courte coche toujours, un appui
 * long ouvre la fiche du bon objectif, un appui long commence sur le bouton
 * ouvre sans cocher, un glissement ne l'ouvre pas, et la fiche porte le champ
 * de preuve.
 */
{
  const rail = read('src/components/CheckinRail.jsx')
  const goals = read('src/pages/Goals.jsx')
  const detail = read('src/components/GoalDetail.jsx')
  const hook = read('src/lib/useLongPress.js')

  ok('la carte du rail tient un appui long',
     /useLongPress\(\(el\) => onOpen\?\.\(goal, el\)/.test(rail),
     'et l element est transmis: c est le rectangle dont le panneau sort')
  ok('et le hook est dans un composant, pas dans la boucle',
     /^function RailCard\(/m.test(rail),
     'un hook appele dans un .map est un hook dont le nombre d appels change avec les donnees')
  ok('les trois boutons de la carte jettent le clic qui suit un appui long',
     (rail.match(/if \(consumedClick\(\)\) return/g) ?? []).length === 3,
     'sinon la fiche s ouvre ET la journee se coche')
  ok('et le pointeur n est pas capture, parce que le clic appartient a un enfant',
     /capture: false,/.test(rail) && /enabled = true, capture = true/.test(hook),
     'avec la capture, le clic est emis sur la carte et le bouton ne recoit rien')
  /* Un geste avec un delai dedans doit dire qu'il a commence, sinon la
     demi-seconde ou rien ne se passe ne se distingue pas d'un controle mort.
     Meme raison, meme duree que .hold-ring. */
  ok('l appui se voit pendant qu il dure',
     /hold-bar pointer-events-none/.test(rail) && /\.hold-bar \{/.test(css),
     'et sans evenements de pointeur, ou il volerait les pointermove de l appui')
  ok('la duree de la barre est celle de l appui', /animation: hold-fill 550ms/.test(css))

  ok('la page ouvre la fiche de l objectif tenu',
     /onOpen=\{\(goal, el\) => setDetail\(\{ goal, el \}\)\}/.test(goals))
  ok('et la fiche recoit la preuve du jour',
     /proofType=\{openGroup \? proofTypeOf\(detail\.goal\) : 'none'\}/.test(goals)
       && /onProof=\{openGroup \?/.test(goals),
     'une preuve vit sur un checkin_item: un objectif solo n a nulle part ou la mettre')
  /* Le meme saveAll que le rail. submit_checkin reecrit la liste complete des
     items d'un cycle, donc un deuxieme chemin d ecriture effacerait les autres
     objectifs de la journee. C est deja la note du carrousel. */
  ok('et l ecriture reste celle de la page',
     /onProof=\{openGroup \? \(patch\) => \{\s*\n\s*set\(detail\.goal\.id, patch\)\s*\n\s*saveAll\(\)/.test(goals),
     'un composant qui ne connait qu un objectif et qui enregistrerait lui-meme effacerait les autres')
  ok('la fiche ne montre le champ que si on le lui donne',
     /\{onProof && proofType !== 'none' && \(/.test(detail),
     'ouverte depuis la liste des objectifs, la preuve du jour n a pas de sens')
  for (const cle of ['goal.proof_today']) {
    const n = read('src/lib/i18n.jsx').split(`'${cle}'`).length - 1
    ok(`${cle} existe dans les deux langues (${n})`, n === 2)
  }
}

/* --- les anniversaires sur la grille ------------------------------------ */

/**
 * "IT SHOULD AUTOMATICALLY PULL UP YOUR FRIENDS [...] YOUR BDAY AS WELL, AND
 *  OF COURSE YOU CAN REMOVE IT IF YOU WANT."
 *
 * Trois choses, et chacune a sa raison d'etre epinglee.
 *
 * AUTOMATIQUEMENT: la meme requete que la banniere du tableau de bord, SANS
 * filtre de groupe. `group_members_select` est `is_member(group_id)` cote base,
 * donc elle rend deja exactement les listes dont on fait partie et le profil
 * embarque repasse par `profiles_select`. Nommer les groupes ici repeterait
 * une regle que la base applique deja et se tromperait la premiere fois que
 * quelqu'un en rejoint un en cours de session.
 *
 * LE TIEN AUSSI, et il arrive par la meme porte: le profil est ajoute a la
 * liste plutot que traite a part. Un deuxieme chemin pour une seule personne
 * est un deuxieme endroit ou la date peut etre fausse.
 *
 * TU PEUX L'ENLEVER: la couche `anniversaires`, avec sa puce dans la barre.
 * Sonde: trois gateaux avant, zero apres la puce, zero apres rechargement,
 * parce que la couche est dans localStorage comme les quatre autres.
 */
{
  ok('le calendrier lit les gens de tes groupes pour leurs dates',
     /from\('group_members'\)\s*\n\s*\.select\('profiles\(id, display_name, birthday\)'\)/.test(cal),
     'sans filtre de groupe: la politique RLS rend deja les bonnes listes')
  ok('et le tien passe par la meme porte que les autres',
     /profile\?\.birthday \? \[\.\.\.friends, \{ id: user\?\.id/.test(cal),
     'un deuxieme chemin pour une seule personne est un deuxieme endroit ou la date peut etre fausse')
  ok('les entrees sont fabriquees pour la plage affichee, pas stockees',
     /birthdayEntries\(gens, range\.from, range\.to/.test(cal))
  ok('et elles passent par le meme filtre de couches que le reste',
     /visibleEvents\(\[\.\.\.events, \.\.\.asEvents, \.\.\.anniversaires, \.\.\.reserves\], hidden\)/.test(cal),
     'c est ce qui rend la puce "Anniversaires" capable de les enlever')
  /* Un anniversaire est derive d'un profil comme un objectif est derive de sa
     ligne: ouvrir le formulaire dessus insererait un vrai evenement portant le
     meme texte, donc un doublon que l'annee suivante ne fera pas disparaitre. */
  ok('un anniversaire ne s ouvre pas dans le formulaire',
     (cal.match(/entry\?\.goalId \|\| entry\?\.birthdayOf/g) ?? []).length === 2,
     'ni pour modifier, ni pour choisir la portee')
  for (const cle of ['cal.layer_anniversaires', 'cal.bday_mine']) {
    const n = read('src/lib/i18n.jsx').split(`'${cle}'`).length - 1
    ok(`${cle} existe dans les deux langues (${n})`, n === 2)
  }
}

/* --- les reservations Cal.com ------------------------------------------- */

/**
 * LES RENDEZ-VOUS PRIS SUR SES PAGES DE RESERVATION.
 *
 *   "So when people book me on my Kreeative cal booking pages it shows on my
 *    Rich and Friends calendar can you do that?"
 *   "And hyperlink to Rich and Friends so I can directly click and go."
 *
 * Trois choses a tenir, et chacune est une facon differente de se tromper en
 * silence: ce que l'API accepte d'ecrire, ce qu'elle garde du paiload, et le
 * fait que le clic marche sur les trois rendus et pas sur un seul.
 */
{
  const api = read('api/cal-webhook.js')
  const sql = read('supabase/72_cal_bookings.sql')
  const cal = code('src/pages/Calendar.jsx')
  const conn = code('src/components/CalConnect.jsx')

  /* L'URL SEULE N'AUTORISE RIEN. Un token qui suffirait a ecrire serait une
     URL qui traine dans un tableau de bord tiers, et n'importe qui pourrait
     poser des rendez-vous sur le calendrier de quelqu'un. */
  ok('la signature est exigee, pas seulement le token',
     /if \(!signatureOk\(body, req\.headers\['x-cal-signature-256'\], lien\.signing_secret\)\)/.test(api))
  ok('et la comparaison est a temps constant',
     /crypto\.timingSafeEqual/.test(api) && !/attendu === /.test(api),
     'un === ici rend le bon resultat en fuyant le secret sur le temps de reponse')
  ok('les longueurs sont comparees avant',
     /if \(a\.length !== b\.length\) return false[\s\S]{0,80}timingSafeEqual/.test(api),
     'timingSafeEqual leve sur deux tampons de tailles differentes au lieu de rendre false')
  /* Repondre 404 sur un token inconnu et 401 sur une signature fausse ferait
     de cette URL un oracle qui confirme quels tokens existent. */
  ok('token inconnu et signature fausse rendent le meme refus',
     (api.match(/return refus\(/g) ?? []).length >= 4
       && (api.match(/status\(401\)/g) ?? []).length === 1)
  ok('et aucun refus ne dit le secret',
     !/signing_secret[^\n]*console\./.test(api) && !/console\.[a-z]+\([^)]*secret/i.test(api),
     'un message d erreur ne porte jamais un identifiant')

  /* LA DECISION DE CONFIDENTIALITE, TENUE PAR LE SCHEMA ET PAS PAR LA BONNE
     VOLONTE: le courriel et les reponses au formulaire arrivent dans le
     paiload et n'ont pas de colonne. Une colonne vide finit par etre remplie
     par le prochain qui passe. */
  ok('la table ne peut pas porter de courriel', !/\bemail\b/.test(sql))
  ok('ni les reponses au formulaire', !/responses|notes/.test(sql))
  ok('et le webhook n en ecrit pas non plus', !/email:/.test(api))

  /* Supprimer une reservation ici n'annule rien chez Cal, donc rien ne la
     supprime ici: le rendez-vous resterait vivant et la personne arriverait. */
  ok('booking n a qu une policy select',
     /create policy booking_select on booking\s*\n\s*for select using \(user_id = auth\.uid\(\)\)/.test(sql)
       && !/create policy [a-z_]+ on booking\s*\n\s*for (insert|update|delete)/.test(sql))
  ok('les deux tables ont RLS',
     /alter table cal_link enable row level security/.test(sql)
       && /alter table booking enable row level security/.test(sql))
  /* Cal reessaye une livraison qui n'a pas repondu, et un report reutilise
     l'uid. Sans la clef d'unicite, chaque reessai ferait une ligne de plus. */
  ok('une livraison rejouee reste une seule ligne',
     /unique \(user_id, source, uid\)/.test(sql)
       && /onConflict: 'user_id,source,uid'/.test(api))
  ok('une annulation marque la ligne au lieu de la supprimer',
     /cancelled_at: new Date\(\)\.toISOString\(\)/.test(api)
       && !/from\('booking'\)\s*\n?\s*\.delete\(/.test(api),
     '"ou est passe mon rendez-vous de jeudi" doit avoir une reponse')
  ok('et elle demande le compte',
     /\{ count: 'exact' \}\)\s*\n\s*\.eq\('user_id', lien\.user_id\)/.test(api),
     'un UPDATE qui ne touche rien ne dit rien de lui-meme')

  /* Le clic est dans openEditor, ou passent la puce du mois, le bloc de la
     semaine et la ligne du jour. Dans un seul des trois, il marcherait sur un
     ecran sur trois. */
  ok('une reservation s ouvre chez Cal',
     /if \(entry\?\.bookingOf\) \{\s*\n\s*if \(entry\.href\) window\.open\(entry\.href, '_blank', 'noopener,noreferrer'\)/.test(cal),
     'sans noopener la page ouverte peut renvoyer celle-ci ailleurs')
  ok('et elle ne s ouvre pas dans le formulaire',
     /if \(entry\?\.bookingOf\) \{[\s\S]{0,200}return\s*\n\s*\}/.test(cal),
     'elle se modifie dans Cal, et un formulaire ici ecrirait un doublon')
  ok('la page les lit sans refiltrer par user_id',
     /\.from\('booking'\)\s*\n\s*\.select\('id, title, guest_name/.test(cal)
       && !/from\('booking'\)[\s\S]{0,200}eq\('user_id'/.test(cal),
     'booking_select EST user_id = auth.uid(), le repeter fait deux endroits qui divergent')

  /* Les deux chaines sont tirees avec le generateur cryptographique. Les
     sorties de Math.random sont predictibles a partir de quelques tirages, et
     un secret de signature devinable ne signe rien. */
  ok('le token et le secret sont imprevisibles',
     /crypto\.getRandomValues/.test(conn) && !/Math\.random/.test(conn))
  ok('l URL est construite sur l origine courante',
     /window\.location\.origin/.test(conn),
     'une URL en dur ferait pointer le webhook d une preview vers la production')
  ok('debrancher demande le compte',
     /\.delete\(\{ count: 'exact' \}\)/.test(conn) && /if \(error \|\| !count\)/.test(conn),
     'RLS refuse un DELETE en silence, et Cal continuerait d ecrire')
  ok('l etat branche est une date et pas un voyant',
     /lien\.last_seen_at\s*\n?\s*\? t\('cal\.connect_live'/.test(conn),
     'un voyant vert serait vert avant meme que Cal ait ete configure')

  for (const cle of ['cal.layer_reservations', 'cal.connect_section', 'cal.connect_what',
                     'cal.connect_step_url', 'cal.connect_step_secret', 'cal.connect_waiting',
                     'cal.connect_live', 'cal.connect_stop']) {
    const n = read('src/lib/i18n.jsx').split(`'${cle}'`).length - 1
    ok(`${cle} existe dans les deux langues (${n})`, n === 2)
  }
}

/* --- deleting one of a series ------------------------------------------- */

/**
 * UN SEUL DIALOGUE POUR LES DEUX QUESTIONS.
 *
 *   "Quand je clique sur edit un jour, je veux que ca me demande si je veux
 *    editer tous les mercredis de ce programme ou juste ce mercredi."
 *
 * Supprimer posait deja la question. Modifier ne la posait pas, donc changer
 * l'heure parce qu'un cours etait deplace une fois deplacait les quinze
 * suivants, en silence.
 *
 * Les deux passent par ScopeChoice: elles demandent la meme chose, et deux
 * boites a 90 pour cent identiques sur un meme ecran sont ce que la note
 * d'EventForm refuse deja pour lui et le wizard. Le hook du conteneur est donc
 * une prop, et c'est ce qui les distingue dans une sonde.
 */
ok('there is one dialog for both questions', /function ScopeChoice\(/.test(cal)
   && !/function DeleteChoice\(/.test(cal))
/* Les deux appelants NOMMENT leur hook plutot que d'en heriter un par
   defaut: un defaut aurait fait que le dialogue de modification s'annonce
   comme celui de suppression le jour ou on oublie la prop. */
ok('opened for a delete', /hook="cal-delete"/.test(cal))
ok('and for an edit', /hook="cal-edit-scope"/.test(cal))
/* LES TROIS CLES A CHAQUE APPEL, sans valeur par defaut. En retirant les
   defauts sans les fournir cote suppression, ce dialogue s'est mis a rendre
   t(undefined) et a disparu: la sonde l'a vu, ce test le retient. */
ok('both callers name their strings',
   (cal.match(/titleKey="cal\.(del|edit)_title"/g) ?? []).length === 2
     && (cal.match(/oneKey="cal\.(del|edit)_one"/g) ?? []).length === 2
     && (cal.match(/allKey="cal\.(del|edit)_all"/g) ?? []).length === 2)
ok('offering the one day', /data-hook="del-one"/.test(cal))
ok('and the whole rule', /data-hook="del-all"/.test(cal))

/**
 * ET ON PEUT SUPPRIMER DEPUIS LE FORMULAIRE, PAS SEULEMENT DEPUIS LA LISTE.
 *
 *   "There should also be an option to delete the thing, if you don't want it
 *    anymore, and then when you're going to delete it's going to ask you
 *    again: do you want to delete this thing or the whole thing."
 *
 * Supprimer existait, mais seulement dans la liste de la vue Jour. Apres avoir
 * repondu "cette date ou toute la serie", on arrivait dans le formulaire sans
 * aucun moyen d'en sortir en effacant: il fallait annuler, retrouver la ligne
 * dans la vue Jour, et la supprimer de la.
 *
 * LE FORMULAIRE NE SUPPRIME PAS LUI-MEME. Il rend la main a la page, qui
 * possede deja les deux chemins et leurs garde-fous: le dialogue de perimetre,
 * le `count` exact sur le DELETE, et la remise en place si l'ecriture n'a pas
 * eu lieu. Les refaire dans le formulaire en donnerait deux versions, et c'est
 * la deuxieme qui oublie le compte.
 *
 * Sonde Chromium, les quatre cas du parcours:
 *
 *   serie, "toute la serie" -> formulaire -> Supprimer -> la meme question ->
 *     un seul DELETE, sur l'id de la serie, et rien avant la reponse
 *   serie, "cette date" -> Supprimer -> pas de question, un PATCH qui ajoute
 *     le 23 septembre a excluded_on
 *   evenement d'un seul jour -> pas de question, un DELETE
 *   evenement en creation -> pas de bouton du tout
 */
ok('le formulaire peut supprimer',
   /data-hook="cal-form-delete"/.test(cal) && /function EventForm\(\{ initial, onClose, onSaved, onDelete \}\)/.test(cal),
   'il fallait annuler, retrouver la ligne dans la vue Jour, et la supprimer de la')
ok('et il repose la question du perimetre par le meme chemin',
   /if \(entry\.id\) return askRemove\(entry\)/.test(cal),
   'askRemove porte le dialogue, le count exact et la remise en place')
ok('une occurrence detachee retire son jour au lieu d effacer la regle',
   /return detachDay\(entry\.detachFrom\)\.then\(load\)/.test(cal),
   'supprimer une occurrence jamais ecrite, c est une exception sur la regle d origine')
ok('rien a supprimer sur un evenement qu on est en train de creer',
   /editing\.id \|\| editing\.detachFrom\s*\n?\s*\?/.test(cal),
   'la, supprimer et annuler sont le meme geste, et en montrer deux fait douter des deux')
ok('et le bouton est loin d Enregistrer',
   /data-hook="cal-form-delete"[\s\S]{0,160}ml-auto[\s\S]{0,120}text-negative/.test(cal)
     || /ml-auto[\s\S]{0,200}data-hook="cal-form-delete"/.test(cal),
   'deux boutons de sens contraire cote a cote sont deux boutons qu on confond')
ok(
  'it sits above the form it was opened from',
  /z-\[70\][\s\S]{0,200}data-hook=\{hook\}/.test(cal),
  'the form is z-60, so a dialog at the same level would have been a coin toss',
)
/* Le rouge est reserve a la suppression: modifier toute une serie se defait,
   l'effacer ne se defait pas. */
{
  /* La prop `danger` n'est passee que par l'appel de suppression, et c'est
     elle seule qui rend le second bouton rouge. */
  const suppr = cal.slice(cal.indexOf('hook="cal-delete"') - 200, cal.indexOf('hook="cal-delete"') + 200)
  const modif = cal.slice(cal.indexOf('hook="cal-edit-scope"') - 400, cal.indexOf('hook="cal-edit-scope"') + 200)
  ok('only the destructive answer is red',
     /\bdanger\b/.test(suppr) && !/\bdanger\b/.test(modif),
     'modifier toute une serie se defait, l effacer ne se defait pas')
  ok('and the flag is what picks the colour',
     /danger\s*\n?\s*\?\s*'bg-negative[\s\S]{0,80}text-negative/.test(cal))
}
ok(
  'and only a repeating entry gets asked',
  /const recurring = Array\.isArray\(entry\?\.weekdays\)[\s\S]{0,120}if \(!recurring\) return removeSeries/.test(cal),
  'a one-off has one occurrence, so the question has one honest answer',
)

/* --- a write that did not happen says so --------------------------------- */

/**
 * EVERY delete, not "both of them".
 *
 * This counted the occurrences and expected exactly two, so adding a third
 * delete failed the test for having written one rather than for having written
 * it wrong. Asking that every `.from(...).delete(` carries a count says the
 * thing that matters and holds for the next one too.
 */
{
  /* Chained onto a supabase query, so `next.delete(k)` on a Set is not one of
     these. The row-removing writes are what RLS can refuse in silence. */
  const chained = cal.match(/^\s*\.delete\([^)]*\)/gm) ?? []
  const counted = chained.filter((s) => s.includes("count: 'exact'"))
  ok(
    `every row delete asks for a count (${counted.length}/${chained.length})`,
    chained.length >= 2 && counted.length === chained.length,
    'RLS refuses by matching zero rows, with no error to catch',
  )
  /* And the one removal that is an update rather than a delete: taking a day
     out of a series writes its exception list. */
  ok(
    'and so does the one that removes by updating',
    /\.update\(\{ excluded_on: next \}, \{ count: 'exact' \}\)/.test(cal),
  )
}
ok(
  'and put the list back when nothing was written',
  (cal.match(/setEvents\(before\)/g) ?? []).length === 2,
  'the optimistic update is what makes a failed write invisible',
)
ok('with something on screen saying why', /data-hook="cal-notice"/.test(cal))
ok(
  'and it is an alert, not a status',
  /role="alert" data-hook="cal-notice"/.test(cal),
  'a row that just came back on its own needs the reason read out',
)

/* --- the calendar is in both navigations -------------------------------- */

/**
 * The one that was actually reported: it was in the rail and not in the tab
 * bar, so on a phone the menu simply did not have it. Both are built from one
 * list now, and this is the assertion that stops them drifting apart again.
 */
ok(
  'both navigations append the calendar to the same list',
  (shell.match(/\[\.\.\.tabs, CALENDAR\]/g) ?? []).length === 2,
  'one of them had it and the other did not, which is how it went missing on the phone',
)
ok(
  'and the tab bar renders that list rather than the raw tabs',
  /\{rows\.map\(\(tab, i\) => \(/.test(shell),
  'building rows and then mapping tabs is a fifth destination nobody can reach',
)

/* --- the rail has room to breathe --------------------------------------- */

ok(
  'the rail rows are spaced rather than stacked',
  /flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto/.test(shell),
  'at gap-0.5 the active pill touched its neighbours and read as a band',
)
ok(
  'and the lockup is separated from the destinations',
  /LockupInline[\s\S]{0,220}mb-10 mt-4 h-px shrink-0 bg-hairline/.test(shell),
  'asked for twice: 4px, then 24, now 40, which is about one empty row',
)

/* --- an exam does not look like a class --------------------------------- */

/**
 * THE CHIP HAS NO EDGE, AND THAT IS THE ASSERTION.
 *
 * It carried a 3px full-strength left rule for one round. That was rejected on
 * sight and the original chip was asked back, so this pins the absence: the
 * rule is the obvious thing to reach for the next time somebody measures the
 * washes and finds them close, and it is not available.
 */
ok(
  'no swatch carries a rule at its edge',
  !/border-l-\[3px\]/.test(cal),
  'the plain soft pill was asked back for explicitly',
)
ok(
  'and there is a dark option, which neither ramp otherwise has',
  /ink: 'bg-ink\/\[0\.30\] text-ink ring-ink\/35'/.test(cal),
  'at 0.12 an exam and a health entry were two greys 5.0 apart',
)
ok(
  'yellow gets the alpha it needs rather than the shared one',
  /field: 'bg-field\/\[0\.6[0-9]\]/.test(cal),
  'a quarter of #FFD60A over white is white',
)
ok(
  'the category pills show the colour they will paint in',
  /data-cat=\{c\}/.test(cal) && /SWATCH_BAR\[CATEGORY_COLOUR\[c\]\]/.test(cal),
  'picking a category decides what the chip looks like for the rest of the term',
)
ok(
  'and the pill dot goes white when selected, so it stays visible on the accent',
  /on \? 'bg-on-accent'/.test(cal),
)

/* --- the deletion dialog names what it is deleting ---------------------- */

ok(
  'the title is set apart from the sentence around it',
  /<strong className="font-semibold text-ink">\{entry\.title\}<\/strong>/.test(cal),
)
ok(
  'and the sentence is split on a sentinel, not concatenated',
  /t\('cal\.del_body', \{ what: SPLIT, when \}\)\.split\(SPLIT\)/.test(cal),
  'three strings hard-code the title coming before the date, which is not a property of translation',
)

/* --- the secondary button is glass everywhere --------------------------- */

ok(
  'the outline button has a ground now',
  /\.btn-ghost \{[\s\S]{0,200}var\(--glass-tint\)/.test(css),
  'text-ink with no background is a word floating beside a filled button',
)
ok('and it lifts on hover', /\.btn-ghost:hover \{[\s\S]{0,200}translateY\(-2px\)/.test(css))
ok(
  'with the motion opted out of',
  /prefers-reduced-motion[\s\S]{0,300}\.btn-ghost/.test(css),
)
ok(
  'the two glass secondaries blur by the same amount',
  (css.match(/backdrop-filter: blur\(16px\) saturate\(160%\)/g) ?? []).length >= 2,
  'they were 12 and 16, sitting next to each other on the calendar toolbar',
)

/* --- the cycle drawer ---------------------------------------------------- */

const cyc = read('src/components/CyclePanel.jsx')
ok(
  '"it started today" is a toggle',
  /aria-pressed=\{Boolean\(todayRow\)\}/.test(cyc),
  'it was one-way, and the only undo was finding today among the recorded dates',
)
ok(
  'and pressing it again removes only today',
  /if \(todayRow\) \{[\s\S]{0,120}removeEntry\(todayRow\.id\)/.test(cyc),
  'nothing else in the history is reachable from that button',
)
ok(
  'the state is not carried by the fill alone',
  /todayRow \? '✓' : '🌸'/.test(cyc),
  '1.4.1: colour is never the only thing saying it',
)
ok('deleting a date says so', /data-hook="cycle-said"/.test(cyc))
ok(
  'and the message clears itself off a ref, not off the function object',
  /clearTimeout\(saidTimer\.current\)/.test(cyc),
  'flash is rebuilt every render, so a timer hung off it would never be cleared',
)
ok(
  'the timer is cleaned up on unmount',
  /useEffect\(\(\) => \(\) => clearTimeout\(saidTimer\.current\), \[\]\)/.test(cyc),
  'the drawer unmounts every time it is closed, which is the normal path',
)
/**
 * L'EAU N'EST PLUS DANS CE TIROIR.
 *
 *   "Remove the water stuff since it's on the profile."
 *
 * Elle etait comptee a deux endroits, ici en verres et sur la carte de
 * l'accueil en millilitres, sur la meme journee. Deux compteurs de la meme
 * chose sont deux endroits ou verifier ce qu'on a bu et un ou le chiffre a
 * l'air faux. Ce tiroir parle du cycle; boire de l'eau est une habitude de
 * tous les jours.
 *
 * Ce cas verifiait que les gouttes etaient dessinees plutot qu'un emoji bleu.
 * Il verifie maintenant qu'il n'en reste rien: ni le dessin, ni l'etat, ni la
 * requete qui lisait cycle_day pour en jeter le contenu.
 */
ok('rien de l eau ne reste dans le tiroir du cycle',
   !/viewBox="0 0 16 20"/.test(cyc) && !/WATER_GOAL|setWater|cycle\.water/.test(cyc)
     && !/from\('cycle_day'\)/.test(cyc),
   'un compteur en double est un endroit de plus ou le chiffre a l air faux')
ok('et la constante des huit verres part avec lui',
   !/export const WATER_GOAL/.test(read('src/lib/cycle.js')),
   'la carte de l accueil compte des millilitres, pas des verres: voir water.js')
ok(
  'there is a note about the phase',
  /data-hook="cycle-care"/.test(cyc),
)

/**
 * ET CE QU'ON VIENT CHERCHER EST UN CHIFFRE, PAS UNE PHRASE GRISE.
 *
 *   "Modify the my cycle UI."
 *
 * C'etait "Expected in 28 days." en corps de texte, suivi d'une ligne grise,
 * au milieu d'une pile de champs de date: la seule chose qu'on ouvre ce tiroir
 * pour savoir etait ecrite de la meme taille que le reste.
 *
 * Le nombre est en `text-metric` et la DATE est dessous, parce que "dans 28
 * jours" oblige a compter sur un calendrier. La ligne de confiance reste dans
 * la meme boite: les separer est comment quelqu'un finit par citer la date en
 * oubliant qu'elle est approximative.
 */
ok('le compte a rebours est un chiffre, avec sa date',
   /data-hook="cycle-next"/.test(cyc) && /text-metric/.test(cyc)
     && /t\('cycle\.expected_on'/.test(cyc),
   'une phrase grise au milieu de champs de date ne se trouve pas')
ok('aujourd hui n a pas de nombre',
   /daysAway === 0 \? \(\s*\n?\s*<p className="text-h2 font-semibold text-ink">\{t\('cycle\.today_big'\)\}/.test(cyc),
   '"0 jour restant" est une facon absurde d ecrire "c est aujourd hui"')
ok('et la ligne de confiance reste collee au chiffre',
   cyc.indexOf("data-hook=\"cycle-next\"") < cyc.indexOf("cycle.conf_")
     && cyc.indexOf("cycle.conf_") < cyc.indexOf('data-hook="cycle-care"'),
   'separees, la date se cite sans le qualificatif qui va avec')

/**
 * LES ECARTS REELS, SUR CHAQUE LIGNE DE L'HISTORIQUE.
 *
 * La carte du haut annonce une moyenne et un ecart-type. Les ecarts qui les
 * produisent sont deja dans la liste juste en dessous; les ecrire rend la
 * phrase verifiable par la personne avec ses propres dates.
 */
ok('chaque regle enregistree dit son ecart avec la precedente',
   /data-hook="cycle-gap"/.test(cyc) && /daysBetween\(fromKey\(avant\.started_on\), fromKey\(row\.started_on\)\)/.test(cyc),
   'la moyenne du haut est sinon un nombre a croire sur parole')
ok('sauf la plus ancienne, qui n a rien avant elle',
   /const ecart = avant\s*\n?\s*\?/.test(cyc) && /\{ecart != null &&/.test(cyc))
/* Comments stripped first. The previous version of this assertion matched the
   comment written to explain it, which is a failure this repo has already paid
   for once: a test that reads its own prose is a test of nothing. */
const cycCode = cyc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
ok(
  'and it reads the phase rather than asking for anything',
  !/symptom|mood/i.test(cycCode),
  'migration 51 exists to make a "who is having a rough week" signal impossible',
)
ok(
  'phaseOn is called with three arguments, so periodDays keeps its default',
  /phaseOn\(new Date\(\), starts, prediction\)/.test(cyc),
  'passing the estimate object as the fourth makes every day inside a NaN window read as a period',
)
ok('the drawer has its warm wash', /cycle-warm/.test(cyc) && /\.cycle-warm::after \{/.test(css))
ok(
  'and the wash is the accent token rather than a literal rose',
  /\.cycle-warm::after \{[\s\S]{0,400}rgb\(var\(--c-accent\) \/ 0\.09\)/.test(css),
  'a hex here would be an unexplained pink glow inside a blue app',
)
ok(
  'it fades out rather than tinting the whole drawer',
  /\.cycle-warm::after \{[\s\S]{0,400}height: 12rem/.test(css),
  'a wash behind the history inputs is the pink-fields problem again',
)

/* --- one pink, and the artwork is part of the palette now --------------- */

/**
 * The complaint was inconsistent pinks and there were three: --c-accent at
 * #E60070, --c-mark and --c-cat-1 at #FF007A, and #DE3578 baked inside every
 * logo PNG. The third is the one nobody could have found by reading the CSS,
 * which is why the generator exists and why this asserts the generator rather
 * than the pixels.
 */
const POP = '255 0 122'
ok(
  'the accent, the mark and the head of the ramp are one value',
  (css.match(new RegExp(POP, 'g')) ?? []).length >= 5,
  'sun accent, sun mark, sun cat-1, public accent, public mark',
)
ok(
  'and #E60070 is gone, which was the second pink',
  !/--c-accent: 230 0 112/.test(css),
  'the accent and the ramp head were four degrees of hue apart',
)
/**
 * #FF007A IS 3.80:1 AND THAT IS A DECISION, NOT AN OVERSIGHT.
 *
 * It was named directly as the brand pink after a deeper one had been tried,
 * so this asserts that the trade is WRITTEN DOWN rather than asserting a ratio
 * the colour does not meet. A note somebody has to read before changing
 * --c-on-accent is the only thing that stops this becoming a discovery later.
 */
ok(
  'the accent contrast is documented where the token is',
  /3\.80:1/.test(css) && /--c-on-accent. #111111 on/.test(css),
  'the one-line fix has to be findable from the token itself',
)

/**
 * ET LE QUANTIEME D'AUJOURD'HUI N'EST PLUS DU BLANC SUR CE ROSE.
 *
 *   "Quand le rose selectionne les regles, la date qui est dedans est en
 *    blanc."
 *
 * La pastille d'aujourd'hui dans la bande de l'accueil portait
 * `text-on-accent`: 3,80:1 mesure sur les pixels peints, pour un chiffre de
 * 14px semibold qui en demande 4,5. C'etait la ligne "the selected day in the
 * calendar" de la note du jeton, restee ecrite et jamais regardee.
 *
 * Le bouton rose garde son ecriture blanche, qui a ete demandee: ce qui change
 * est un jeton separe, pour du texte de taille normale pose sur l'accent. Il
 * vaut l'encre en soleil (4,60:1) et le blanc en mer (5,40:1), parce que le
 * rose ne porte pas le blanc et que le bleu ne porte pas l'encre. Mesure apres
 * coup: 4,60:1 en soleil, 5,40:1 en mer.
 */
const bande = read('src/components/WeekStrip.jsx')
ok(
  "le quantieme d'aujourd'hui prend le jeton du texte, pas celui du bouton",
  /isToday\s*\n?\s*\? 'bg-accent text-on-accent-small font-semibold'/.test(bande),
  'text-on-accent sur cette pastille mesurait 3,80:1',
)
ok(
  'et ce jeton existe dans les deux themes',
  (css.match(/--c-on-accent-small:/g) ?? []).length >= 3,
  'soleil, mer et la vitrine: un jeton absent rend la couleur nulle, pas noire',
)
ok(
  "il s'inverse d'un theme a l'autre plutot que de valoir l'encre partout",
  /--c-on-accent-small: var\(--c-ink\);\s*\/\* 4,60:1 sur #FF007A/.test(css)
    && /--c-on-accent-small: 255 255 255;\s*\/\* 5,40:1 sur #0B6FAD/.test(css),
  "l'encre sur le bleu de mer ne fait que 3,19:1, donc un text-ink global casse mer",
)
ok(
  'tailwind construit bien la classe',
  /'on-accent-small': c\('on-accent-small'\)/.test(read('tailwind.config.js')),
  'une couleur absente de la config sort du HTML sans regle du tout',
)
const gen = read('scripts/brand-icons.py')
ok('the artwork is generated rather than hand-edited', /POP = \(255, 0, 122\)/.test(gen))
ok(
  'and the generator points at the token rather than restating the trade',
  /index\.css/.test(gen),
  'two copies of a contrast argument is how they end up disagreeing',
)
ok(
  'the small icons use the monogram, not the four-line wordmark',
  /tile\(mono, 32/.test(gen) && /tile\(mono, 64/.test(gen),
  'at 32px the words were a clipped smudge',
)
ok(
  'the apple icon is not pre-rounded',
  /tile\(word, 180, POP\)\.convert\('RGB'\)/.test(gen),
  'iOS masks it itself, and transparent corners inside that mask render black',
)
ok(
  'the icon URLs were bumped so Safari notices',
  /\?v=4/.test(read('index.html')) && /\?v=4/.test(read('public/manifest.webmanifest')),
  'a favicon is the most aggressively cached asset a browser has',
)

/* --- the recap knows what was on the day -------------------------------- */

const recap = read('src/components/DayRecap.jsx')
const strip = read('src/components/WeekStrip.jsx')
ok(
  'the strip passes the day it already loaded',
  /agenda=\{agenda\.get\(selected\) \?\? \[\]\}/.test(strip),
  'it read calendar_event for the dots and then did not hand it down',
)
ok('and the phase with it', /cyclePhase=\{phaseOn\(selectedDate, cycleStarts, prediction\)\}/.test(strip))
ok(
  'the prop is not called phase',
  !/^\s+phase = null,$/m.test(recap),
  'the component already has a phase for the morph state, and two would not build',
)
ok('the recap draws the agenda', /data-hook="recap-agenda"/.test(recap))
ok('and the cycle line', /data-hook="recap-cycle"/.test(recap))
ok(
  'a day with a class on it is not an empty day any more',
  /agenda\.length === 0 &&\s*\n\s*!cyclePhase/.test(recap),
  'the emptiness test did not mention the calendar, so a full day opened as "rien"',
)

/* --- the heads-up under the home calendar ------------------------------- */

const heads = read('src/components/CycleHeadsUp.jsx')
ok('there is a heads-up', /data-hook="cycle-headsup"/.test(heads))
ok(
  'it is gated on the reminder switch that already exists',
  /if \(!remind \|\| hidden/.test(heads),
  'no new consent was invented for a card on a screen people open in public',
)
ok(
  'and it reads without writing',
  !/supabase/.test(heads),
  'migration 51 exists to make a "who is having a rough week" signal impossible',
)
ok(
  'the predicted phase is bounded by the reminder days',
  /phase === 'predicted' && away > Math\.max\(1, days\)/.test(heads),
  'that window widens as the recorded cycles disagree, up to nine days',
)
ok(
  'dismissal is for the day rather than forever',
  /localStorage\.setItem\(KEY, today\)/.test(heads),
  'a card somebody can silence permanently is one they silence once by accident',
)
/* It moved OUT of the calendar card and became a sibling under it. "Under"
   was read the way it was written: under, as in another card. Inside, it was
   the last row of the calendar. */
/* The regex allows a comment and a gate between the two, and both are real
   things that now sit there. What it still proves is the only thing it was
   written to prove: the card follows the calendar's closing tag rather than
   appearing before it, which is the difference between another card and the
   last row of one. */
ok(
  'it is a sibling of the calendar card, not a block inside it',
  /<\/div>\s*(?:\{\/\*[\s\S]*?\*\/\}\s*)?(?:\{periodTracking && \(\s*)?<CycleHeadsUp/.test(strip),
  '"juste en bas du calendrier" means another card, not the last row of one',
)

/* --- and only for somebody whose app has the tracker in it -------------- */

/**
 * A man who signs up does not get a period tracker on his dashboard.
 *
 * Gated in two places on purpose and both are asserted, because the failure
 * mode of the first alone is invisible: a component handed empty props draws
 * nothing today and starts drawing again the moment somebody gives it a
 * fallback. See cycleOn in src/lib/setup.js.
 */
ok(
  'the strip asks whether the tracker is part of this app',
  /import \{ cycleOn \} from '\.\.\/lib\/setup'/.test(strip) &&
    /const periodTracking = cycleOn\(profile\)/.test(strip),
)
ok(
  'the heads-up is gated on it',
  /\{periodTracking && \(\s*\n\s*<CycleHeadsUp/.test(strip),
  'a card about somebody else’s body on the home screen of somebody who said no',
)
ok(
  'and the period history is never even fetched',
  /if \(!periodTracking\) return\s*\n\s*try \{\s*\n\s*const \[\{ data: logs \}/.test(strip),
  'hidden after fetching still means it was read onto the phone',
)

/* The calendar, same question, three consequences. */
ok(
  'the calendar asks it too',
  /const periodTracking = cycleOn\(profile\)/.test(cal),
)
ok(
  'the drawer button is absent rather than disabled',
  /\{periodTracking && \(\s*\n\s*<button type="button" onClick=\{\(\) => setDrawer\(true\)\}/.test(cal),
  'a greyed-out button still advertises the feature',
)
ok(
  'the layer toggle is not offered',
  /LAYERS\.filter\(\(l\) => l !== 'cycle' \|\| periodTracking\)/.test(cal),
  'a switch that governs nothing invites a tap and answers with no change',
)
ok(
  'the overlay is emptied, not just hidden',
  /!periodTracking \|\| hidden\.has\('cycle'\)/.test(cal),
)
ok(
  'and CyclePanel, which is what reads cycle_log, is not mounted',
  /\{periodTracking && \(\s*\n\s*<CyclePanel/.test(cal),
)
ok(
  'and it is a card in its own right',
  /className="lg mt-4 overflow-hidden" data-hook="cycle-headsup"/.test(heads),
  'the same sheet every other card in that column is made of',
)

/* --- the daily question is its own act ---------------------------------- */

/**
 * THIS HAS MOVED TWICE AND BOTH MOVES WERE RIGHT.
 *
 * It began as a screen of its own listing every goal again with one Submit.
 * That was wrong because it asked the question away from the goal.
 *
 * It then went onto the goal cards, which was wrong for the opposite reason:
 * a card already holds a title, two badges, an owner, a progress row and four
 * management actions, and a question with a counter and a Save on top of that
 * is a form with a heading. "Modifier" and "Fait" are not the same kind of
 * thing and were adjacent.
 *
 * So the card is a card, and the question is a banner and a carousel. These
 * assert the separation in both directions, because the tempting fix next time
 * something feels far away is to put a control back on a card.
 */

ok('there is a banner when something is due', /data-hook="checkin-banner"/.test(goalsPage))
/**
 * THE CHECK-IN IS A RAIL YOU SLIDE, NOT A BUTTON THAT OPENS A MODAL.
 *
 * "A sliding chain of goals, like the UI in the groups when people are
 * missing. You could slide them, and they will be gray. And when you click
 * done today, there will be bright pink."
 *
 * So it is NudgeBanner's shape pointed at your own goals. The button it
 * replaced was one more tap before the first answer and a layer over a list
 * somebody was already looking at, on the section whose whole job is speed.
 */
ok('with a rail of goals under it', /data-hook="checkin-rail"/.test(rail))
ok(
  'that slides, with the next card showing',
  /snap-x snap-mandatory/.test(rail) && /w-\[78%\]/.test(rail),
  'a rail whose cards fill the width is indistinguishable from one card',
)
/**
 * PINK IS "NOT YET", GREY IS "DONE", WHICH IS THE SECOND TIME ROUND.
 *
 * It shipped the other way. The loud colour was being spent on the goals that
 * need nothing from you while the ones still waiting sat quiet; inverted, the
 * pink cards ARE the remaining work and finishing one takes it out of the
 * queue.
 *
 * THAT MOVED A KNOWN CONTRAST PROBLEM FROM THE EXCEPTION TO THE DEFAULT.
 * White on the accent is 3.80:1, documented in index.css as a decision. It
 * clears the 3:1 large text needs and fails the 4.5 normal text needs, and it
 * now applies to every unanswered card rather than the odd finished one.
 *
 * So the pink card carries exactly one piece of white-on-pink text, the title,
 * at 22px bold, which IS large text. Everything smaller sits in an opaque white
 * pill with ink on it. Audited in Chromium on the painted pixels, compositing
 * every translucent layer down, in BOTH states:
 *
 *   pink  title 3.80 (large, needs 3)   pills 17.48   button 17.48
 *   grey  title 6.45 (large, needs 3)   pills  5.74   button 12.92
 *
 *   0 failing across both states, out of 20 pieces of text.
 *
 * The one that did fail first was the counter's denominator at
 * text-on-accent/70, which composited to 2.28:1, under even the large-text
 * threshold. It is full opacity now.
 */
ok(
  'pink is unanswered and grey is done',
  /done \? 'bg-ink\/\[0\.05\]' : 'bg-accent shadow-raised'/.test(rail),
  'the loud colour belongs on the work that is left',
)
ok(
  'the only white-on-pink text is the title, and it is large',
  /text-safe line-clamp-2 text-h2 font-bold leading-tight/.test(rail),
  '22px bold is large text, so 3.80:1 clears the 3:1 it needs',
)
ok(
  'and the small facts sit on an opaque pill instead',
  /done\s*\n?\s*\? 'bg-ink\/\[0\.06\] text-muted'\s*\n?\s*: 'bg-on-accent text-ink'/.test(rail),
  'a translucent white would composite back down towards the 3.80',
)
/* Comments stripped, like the glyph assertion above. The first version of
   this matched the note explaining WHY text-on-accent/70 was removed, so it
   failed on a file that was already correct. */
ok(
  'nothing on the card is drawn at partial opacity',
  !/text-on-accent\/\d/.test(code('src/components/CheckinRail.jsx')),
  'text-on-accent/70 measured 2.28:1, under even the large-text threshold',
)

/**
 * AND THE CARDS SAY MORE THAN WHETHER THEY ARE DONE.
 *
 * Asked for: "the number of streak days for a recurring goal, or if you say
 * you are going to read 3 chapters but you just read 2 out of 3".
 *
 * The streak is only ever non-zero for a goal with no group: streakOf walks
 * goal_days, and a group goal is answered into checkin_items, so it has no
 * rows there. Showing nothing is the honest outcome rather than a zero. A
 * group streak would have to come out of completion.js over cycles, which is a
 * different number and a different piece of work.
 */
ok(
  'the card reports the run behind it',
  /data-hook="rail-streak"/.test(rail) && /streakOf\(goal, dayIndex, new Date\(\)\)/.test(rail),
)
ok(
  'and how far into today it is',
  /counted && count > 0/.test(rail) && /t\('goal\.today_count'/.test(rail),
  '2 of 3 is a started day, and the card should say so',
)
ok(
  'reading the same index the rest of the app reads',
  /dayIndex=\{dayIndex\}/.test(goalsPage),
  'a second source for the streak would disagree with the detail page',
)
ok(
  'and colour is not the only signal',
  /aria-pressed=\{done\}/.test(rail) &&
    /done \? t\('goal\.done_today'\) : t\('goal\.mark_today'\)/.test(rail),
  '1.4.1: the word and the pressed state carry it without the pink',
)
ok(
  'a counter is done only when it reaches its target',
  /const done = counted \? count >= target : a\.outcome === 'done'/.test(rail),
  'colouring 2 of 3 as finished is the card lying about the number on it',
)

/**
 * THE BANNER IS TYPE ON THE PAGE, NOT A CARD.
 *
 * It was a `lg` sheet, which put a white rectangle directly above a column of
 * white rectangles and made the daily question look like the first goal in the
 * list. Measured in Chromium at 430 and 1024 after the change: background
 * rgba(0,0,0,0), no shadow, no class list at all on the wrapper.
 */
ok(
  'the check-in banner has no card round it',
  /data-hook="checkin-banner"[\s\S]{0,200}/.test(goalsPage) &&
    !/className="lg overflow-hidden px-5 py-4"\s*\n\s*data-hook="checkin-banner"/.test(goalsPage) &&
    !/<div\s*\n\s*className="lg[^"]*"\s*\n\s*data-hook="checkin-banner"/.test(goalsPage),
  'a white rectangle above a column of white rectangles is another goal card',
)

/**
 * AND THE SLIDE IS SHAPED LIKE A NUDGE CARD, WITH VALIDATE AT THE BOTTOM.
 *
 * "un peu comme les notifications dans le groupe": heading, a grey line under
 * it, the control, one full-width action. What it replaces is dialog chrome, a
 * bordered header and a bordered footer holding Precedent and Suivant, which
 * made a small card read as a wizard and made the button that RECORDS the
 * answer look like the one that skips it.
 *
 * Measured at 430 and 1024: the action spans 88% and 81% of the sheet, which
 * is its full width inside px-6, and there are zero divider rules left.
 */
ok(
  'the slide action is full width, like the nudge card it is modelled on',
  /data-hook="carousel-next"[\s\S]{0,200}className="btn-primary press w-full"/.test(carousel),
)
ok(
  'and it says what pressing it does',
  /t\('checkin\.validate'\)/.test(carousel) &&
    /'checkin\.validate': 'Valider'/.test(read('src/lib/i18n.jsx')) &&
    /'checkin\.validate': 'Confirm'/.test(read('src/lib/i18n.jsx')),
  '"Suivant" describes paging, not answering',
)
ok(
  'back only exists once there is somewhere to go back to',
  /\{i > 0 && \(/.test(carousel) && !/disabled=\{i === 0\}/.test(carousel),
  'a permanently disabled control on card one of two teaches people it does nothing',
)
ok(
  'the dialog rules are gone from the slide',
  !/border-b border-hairline px-5 py-4/.test(carousel) &&
    !/border-t border-hairline px-5 py-4/.test(carousel),
  'three rules across a card this small read as a wizard',
)
ok(
  'the goal is the heading and the question is the line under it',
  /data-hook="carousel-title"[\s\S]{0,120}goal\.commitment[\s\S]{0,400}t\('checkin\.carousel_q'\)/.test(carousel),
  'the goal is what somebody is looking for, so it goes first',
)
ok(
  'and the French question is a question rather than a dangling colon',
  !/'checkin\.carousel_q': 'As-tu realise :'/.test(read('src/lib/i18n.jsx')),
  'the colon introduced the goal, which now sits above it',
)
ok('and it opens a carousel', /data-hook="checkin-carousel"/.test(carousel))
ok(
  'which asks one goal at a time',
  /data-hook="carousel-title"/.test(carousel) && /goals\[Math\.min\(i, goals\.length - 1\)\]/.test(carousel),
  'a list in a modal is the old screen with a scrim on it',
)
ok(
  'the cards carry no daily controls any more',
  !/checkinFor/.test(goalsPage) && !/footer=\{/.test(goalsPage),
  'that is the clutter this round removed',
)
ok(
  'and GoalCard still offers the slot, unused, rather than growing the job back',
  /footer = null,/.test(gcard),
)
ok(
  'the carousel saves nothing itself',
  !/supabase|enqueue/.test(carousel),
  'submit_checkin upserts the whole item list, so only the page can write it',
)

/**
 * THE ONE THAT WOULD HAVE DESTROYED DATA SILENTLY, AND STILL APPLIES.
 *
 * submit_checkin upserts on (cycle_id, user_id) and carries the whole item
 * list. The existing check-in has to be READ before anything is written, and
 * the payload built from every answered goal, or a save deletes what was there
 * with no error anywhere.
 */
ok(
  'the existing check-in is read before anything is written',
  /from\('checkins'\)[\s\S]{0,200}checkin_items\(goal_id/.test(goalsPage),
  'starting from an empty map means the first save deletes what was there',
)
ok(
  'and the payload is built from every answered goal',
  /const items = live\s*\n\s*\.filter\(\(g\) => current\[g\.id\]\)/.test(goalsPage),
)
/**
 * THE ANSWERS COME FROM A REF, AND THAT IS NOT A STYLE CHOICE.
 *
 * The carousel advances on a timer so a tapped chip has a moment to show as
 * pressed. That timer's closure holds the `onDone` it was handed at click
 * time, which closed over the answers as they were BEFORE the tap. On the last
 * card that is the save, so the goal somebody had just answered was the one
 * missing from the payload, every time.
 *
 * Nothing looked wrong: the celebration played, the modal closed, and the
 * request went out with every OTHER answer in it. It was found by reading the
 * request body. A ref cannot go stale from any closure of any age.
 */
ok(
  'the save reads a ref rather than the state it closed over',
  /const current = answersRef\.current/.test(goalsPage) &&
    /answersRef\.current = next/.test(goalsPage),
  'a timer-driven save loses the answer that started the timer',
)
ok(
  'and the hydrate seeds the ref too',
  /answersRef\.current = seeded/.test(goalsPage),
  'otherwise the first save posts only what was typed this session',
)

/* --- the card is a card ------------------------------------------------- */

ok(
  'the four management actions are behind one control',
  /data-hook="goal-menu"/.test(gcard) && /data-hook="goal-menu-items"/.test(gcard),
  'three filled pills and a red word at the bottom of every card is a settings screen',
)
ok(
  'the loud row is gone',
  !/goal-action-soft press[\s\S]{0,200}goal-action-done press/.test(gcard),
)
/**
 * THE ACTIONS EXPAND THE CARD. THEY ARE NOT A LAYER OVER IT.
 *
 * Three rounds landed here and the last one deletes the other two. They were
 * `absolute right-0 z-50` inside a card carrying overflow-hidden, so they were
 * painted and then clipped away: measured in Chromium at 430 and 1024, all
 * four items unreachable on the first card, and on the last card the menu sat
 * at top -400, entirely off screen. Then they were portalled to the body and
 * placed from the button's rect, which worked and cost a scrim, a measured
 * position, a flip, a scroll listener and a tab-bar floor.
 *
 * All of that machinery existed to hold a floating layer in the right place.
 * The rows are part of the card now, so there is no layer: nothing to
 * position, nothing to dismiss, nothing to re-measure on scroll, and nothing
 * an ancestor can clip, because no positioned element is left to clip.
 *
 * These assertions are the ones that keep it that way. Each of the three
 * previous designs fails at least one.
 */
ok(
  'the actions are rendered inside the card, not into the body',
  !/createPortal\(/.test(gcard) && !/document\.body/.test(gcard),
  'a portal is the design this replaced; it needed five other things to hold it up',
)
ok(
  'and are not positioned at all, so overflow-hidden cannot reach them',
  !/position: 'fixed'/.test(gcard) && !/data-hook="goal-menu-items"[\s\S]{0,300}absolute/.test(gcard),
  'the clipping bug and the off-screen bug were both position bugs',
)
ok(
  'no scrim, because there is no layer to dismiss',
  !/fixed inset-0/.test(gcard),
)
ok(
  'nothing re-measures on scroll',
  !/addEventListener\('scroll'/.test(gcard) && !/getBoundingClientRect\(\)[\s\S]{0,200}floor/.test(gcard),
  'the rows move with the card because they are in it',
)
ok(
  'the control sits at the top of the card',
  /data-hook="goal-menu"[\s\S]{0,400}absolute right-3 top-3/.test(gcard),
  'asked for: the dots at the top rather than under everything',
)
ok(
  'and is a sibling of the header rather than nested in it',
  /data-hook="goal-menu"[\s\S]{0,600}<\/button>\s*\n\s*\)\}/.test(gcard),
  'the header is a real button, so a control inside it would be a button in a button',
)
ok(
  'the header leaves room for it',
  /showControls && !finished \? 'pr-10' : ''/.test(gcard),
  'without it a long title runs under a control it cannot see',
)
ok(
  'the expanded rows are tied to the control for a screen reader',
  /aria-expanded=\{menu\}/.test(gcard) &&
    /aria-controls=\{`goal-actions-\$\{goal\.id\}`\}/.test(gcard) &&
    /id=\{`goal-actions-\$\{goal\.id\}`\}/.test(gcard),
  'aria-haspopup="menu" described a popup, and there is no popup any more',
)
ok(
  'and delete is separated from the three that can be undone',
  /border-t border-hairline[^"]*text-negative|text-negative[^"]*border-t border-hairline/.test(gcard),
)
ok(
  'only goals due today are asked',
  /dueOn\(answerable\.filter/.test(goalsPage),
  'a twice-a-week goal on a Thursday is not a question today can answer',
)
/**
 * ET SEULEMENT CEUX QU'ON PEUT REPONDRE.
 *
 * `live` etait TOUS les objectifs du groupe, y compris les objectifs
 * personnels des autres, donc le rail demandait a chacun de repondre pour tout
 * le monde: "il en reste 11 sur 11" sur une personne qui en a trois. Et une
 * reponse donnee la n'aurait aucun sens: on ne peut pas savoir si quelqu'un
 * d'autre a couru ce matin.
 *
 * Invisible avec une seule personne dans les donnees de test, ce qui est le
 * cas de toutes les sondes de ce depot. Trouve en fabriquant une fixture de
 * groupe realiste pour les captures d'App Store, et epingle ici parce que le
 * prochain qui simplifie `answerable` en `live` ne verra rien echouer.
 */
ok(
  'et seulement les siens et ceux du groupe',
  /kind === 'group' \|\| g\.owner_id === user\?\.id/.test(goalsPage),
  'le rail demandait de repondre pour les objectifs personnels des autres',
)
ok(
  'and only while the period is open',
  /phase === 'open'/.test(goalsPage),
)
ok(
  'the away button is on the page, not in the carousel',
  /data-hook="goals-away"/.test(goalsPage) && !/goals-away/.test(carousel),
)

/* --- a date nobody set is not "Invalid Date" ---------------------------- */

ok(
  'shortDate refuses a missing or unparseable date',
  /if \(!iso\) return null/.test(read('src/lib/time.js')) &&
    /Number\.isNaN\(d\.getTime\(\)\)/.test(read('src/lib/time.js')),
  'new Date(undefined) formats as the literal words "Invalid Date"',
)
ok(
  'and the card says something else instead of "by" with nothing after it',
  /: t\('goal\.once'\)/.test(gcard),
  'a due date is optional on a one-off, so the missing case is ordinary',
)

/* --- and where proof and praise ended up -------------------------------- */

/**
 * These five used to read Checkin.jsx, asserting that the goals pane, the
 * Submit, the away button and their leftover identifiers had gone from it. The
 * file is deleted now, which subsumes all of them: its absence is asserted up
 * with the Bravo block.
 *
 * What replaces them is the other half of that move. The two jobs the screen
 * was carrying had to land somewhere, and "the page is gone" is only half an
 * answer. These check they arrived.
 */
ok(
  'the proof strip is on the goals page',
  /data-hook="goals-proof"/.test(goalsPage) &&
    /<ProofGallery groupId=\{groupId\}/.test(goalsPage),
)
ok(
  'with the full grid still one link away',
  /data-hook="goals-proof-all"/.test(goalsPage) && /\/proofs`/.test(goalsPage),
  '/proofs already existed behind the same link from the tab that is gone',
)
ok(
  'and the compliment is there, behind a button rather than open',
  /data-hook="goals-celebrate-open"/.test(goalsPage) && /<CelebrateStep/.test(goalsPage),
  'a face row and a textarea between the goals and the archive, every day, unasked',
)
ok(
  'both are group-only, because both read a group',
  (goalsPage.match(/\{groupId && \(/g) ?? []).length >= 2,
  'group_proofs is a group view and celebrate() posts to a group',
)
ok(
  'the strip refreshes when the carousel attaches a photo',
  /setProofTick\(\(n\) => n \+ 1\)/.test(goalsPage),
  'it loads once on mount, which is the whole of "my photo did not appear"',
)

/**
 * THE PURCHASE CHECK IS ON THE ACCOUNT SCREEN, NOT THE GROUP ONE.
 *
 * It was mounted in Settings.jsx, which despite the name is the GROUP settings
 * page at /g/:groupId/settings. Wrong screen twice over: a book purchase
 * belongs to a person rather than to a group, and somebody with no group had
 * no route to it at all. It was reported as missing, and a page nobody can
 * navigate to IS missing.
 *
 * Verified in Chromium at both addresses: present and clickable on /settings
 * under a "Purchases" heading, absent from the group page, no page errors on
 * either.
 */
const account = read('src/pages/Account.jsx')
const groupSettings = read('src/pages/Settings.jsx')
ok(
  'the purchase check is on the personal account screen',
  /<PurchaseCheck \/>/.test(account) && /components\/PurchaseCheck/.test(account),
)
ok(
  'and not on the group settings screen',
  !/<PurchaseCheck/.test(code('src/pages/Settings.jsx')) &&
    !/import PurchaseCheck/.test(groupSettings),
  'a person with no group could not reach it there',
)

/**
 * THE CHAPTER DRAWER OPENED ONTO NOTHING.
 *
 * Reported from a real iPad: the reader shows chapter one, "Chapitres" opens a
 * sheet, and the sheet contains a title, a Fermer button and no chapters.
 *
 * The cause was an assignment fifteen lines above the guard that was meant to
 * prevent it. `setChapters(chs)` ran unconditionally, and only afterwards did
 * the code check whether `chs` was empty and decide to leave the bundled
 * chapter alone. By then the bundled table of contents was gone. It also took
 * the previous and next buttons with it, since those are derived from the same
 * list, so the book became one unnavigable page.
 *
 * The state that produces it is a catalogue with a books row and no chapter
 * rows, which is what production looks like right now.
 *
 * Reproduced in Chromium against that exact fixture before the fix (drawer
 * empty), confirmed after (nine chapters), and confirmed again by reverting
 * only this line with the rest of the change in place, which put it back to
 * empty. The one line is what moved it.
 */
const reader = read('src/pages/Reader.jsx')
ok(
  'an empty chapter list from the database cannot replace the seeded one',
  /if \(chs\.length > 0\) setChapters\(chs\)/.test(reader),
  'seeding exists so the book opens when the catalogue is not loaded',
)
ok(
  'the chapter drawer is reachable by a data hook',
  /data-hook="chapter-list"/.test(reader),
  'a probe keyed to the `list` class found zero rows and blamed the app',
)

/**
 * NEVER ASK SOMEBODY TO BUY A BOOK THEY ALREADY OWN.
 *
 * A chapter comes back locked for two unrelated reasons: the paywall doing its
 * job, or the entitlement existing while the text does not. The card said the
 * same thing for both, which put a payment button in front of the person who
 * had just recovered their purchase. `owned` is read first so that case gets
 * its own message and no button.
 */
ok(
  'the locked card checks ownership before offering to sell',
  /book\.owned \? t\('reader\.owned_missing_title'\)/.test(reader) &&
    /\{book\.owned \? null : book\.local \?/.test(reader),
  'the alternative is taking money twice for one book',
)

/**
 * A PAID BOOK ARRIVES WITHOUT ANYBODY READING A DIAGNOSTIC.
 *
 * Recovery started as a button on the settings screen underneath an
 * explanation of webhooks. It worked, and it asked the wrong thing of somebody
 * who had just paid: read a paragraph, decide it applies to you, find
 * Settings, find Purchases, press a button.
 *
 * The library now calls the same recovery itself, once, about six seconds into
 * the wait, which is long after a working webhook would have delivered. Once
 * rather than per tick: a Stripe call on a two-second timer for thirty seconds
 * is a lot of requests, and if the first found no paid session the fifteenth
 * will not either.
 */
ok(
  'the library recovers a missing purchase on its own',
  /recoverPurchases/.test(lib) && /tries === 3/.test(lib),
  'a person who paid should not have to find a settings page',
)
ok(
  'recovery lives in one place, used by both callers',
  /export async function recoverPurchases/.test(read('src/lib/library.js')),
  'two copies of a granting call is two things to get wrong',
)

/**
 * THE READING SURFACE IS WHITE PAPER AND BLACK TYPE.
 *
 * Asked for directly. The app ground is a blush in sun and an ice blue in sea,
 * which works everywhere that is cards and chips and a screenful at most; a
 * book is forty minutes of continuous prose, and a tint that is pleasant for
 * ten seconds is something you read THROUGH for forty minutes. The body also
 * ran at text-ink/85, a translucency invented to soften a wall of type, which
 * over a tint composites to neither the ink nor the paper.
 *
 * Measured from painted pixels in both themes, by screenshotting the prose,
 * hiding it, screenshotting again and diffing: #111111 on #FFFFFF, 18.88:1.
 */
ok(
  'the reader declares its own surface',
  /data-surface="reading"/.test(reader) && /\[data-surface='reading'\]/.test(css),
  'custom properties inherit, so the subtree wins over either theme',
)
ok(
  'and the prose is full ink, not a translucency',
  !/text-ink\/85/.test(code('src/pages/Reader.jsx')),
  'ink at 85% over a tinted ground is the grey this change removes',
)

/**
 * A GOAL YOU WRITE DOWN NOW FOR JANUARY 2027.
 *
 * Asked for with that exact case: something whose registration opens on the
 * first of January, worth recording today, and not worth being asked about
 * every evening for sixteen months.
 *
 * The gating already existed. isDueOn has honoured starts_on since it was
 * written, and a one-off with a deadline already stays out of the list until a
 * week before. The column was simply never on the form, so the only way to set
 * it was by hand in the database.
 *
 * Verified in Chromium: filled the field, saved, and read the request the
 * browser actually posted. starts_on: "2027-01-01" is in the row.
 */
{
  const form = read('src/components/GoalForm.jsx')
  /**
   * Sans les commentaires, pour l'assertion "il n'y a plus de ligne construite
   * ici". Elle lisait le fichier entier et a echoue sur une NOTE qui cite
   * `starts_on: "2027-01-01"` en racontant un bogue. Une assertion de la forme
   * "ce texte ne doit pas apparaitre dans le code" doit lire le code; sinon
   * elle interdit d'ecrire sur le sujet qu'elle surveille, ce qui pousse a
   * retirer l'explication plutot que le probleme.
   */
  const formCode = code('src/components/GoalForm.jsx')
  /**
   * L'ASSERTION QUI ETAIT ICI VERIFIAIT LA PRESENCE DU BOGUE.
   *
   * Elle lisait /starts_on: startsOn \|\| null/ dans le source et passait,
   * parce que la ligne etait bien la. Elle etait la et elle rendait la
   * creation d'objectif impossible: starts_on est `not null default
   * current_date`, et un null explicite ecrase le DEFAULT au lieu de le
   * laisser s'appliquer, donc tout le monde recevait
   *
   *   [23502] null value in column "starts_on" of relation "goals"
   *
   * Le contenu de la ligne vit maintenant dans goalRow(), et goalRow.test.mjs
   * regarde ce qu'elle rend au lieu de la chercher dans un fichier. Ce qui
   * reste ici est ce que ce fichier peut vraiment dire: que le formulaire
   * envoie bien la ligne construite ailleurs.
   */
  ok('the form builds its row with the tested helper',
     /goalRow\(\{/.test(formCode) && !/starts_on:/.test(formCode),
     'a copy of the row inside the component is a second place for it to be wrong')
  ok('and offers it for a habit and for a one-off',
     (form.match(/t\('form\.starts'\)/g) ?? []).length === 2,
     'a deadline buys a week of silence, which is useless sixteen months out')
  ok('the save button has a hook rather than a guessable label',
     /data-hook="goal-save"/.test(form),
     'two probe runs timed out guessing at its text and then at its type')
  ok('isDueOn still honours it',
     /if \(starts && today < starts\) return false/.test(read('src/lib/schedule.js')))

  /**
   * LE BOUTON RESET DU SELECTEUR NATIF, QUI MENTAIT.
   *
   * Rapporte avec une capture: "le bouton RESET ca reset jamais rien". Ce
   * panneau gris est le selecteur de date de Safari, pas un ecran de cette
   * application, et son Reset ecrit '' directement dans l'input.
   *
   * Sur un champ controle sans garde, ca donnait le pire des trois resultats:
   * le DOM affichait une case vide, l'etat React gardait 2027-01-01, et comme
   * l'etat n'avait pas change il n'y avait pas de nouveau rendu pour remettre
   * l'ancienne valeur a l'ecran. Le champ avait l'air efface ET l'objectif
   * s'enregistrait avec la vieille date.
   *
   * CE QUE CETTE ASSERTION VAUT, ET CE QU'ELLE NE VAUT PAS.
   *
   * Elle verifie la presence de la garde, ce qui est exactement le genre
   * d'assertion qui a deja laisse passer un bogue dans ce depot. Ce qui prouve
   * que ca marche est la sonde probe/datereset.mjs, qui vide le champ des
   * trois facons qu'un navigateur utilise et lit la ligne postee: sans la
   * garde, deux de ses assertions tombent. Celle-ci est un fil-piege, pour
   * qu'un retrait de la garde ne passe pas en silence entre deux sondes.
   */
  /* La garde vit maintenant dans PickerField (src/components/ui.jsx), un seul
     composant pour la date et pour l'heure: le meme defaut a ete rapporte deux
     fois, la deuxieme avec le selecteur d'HEURE d'iOS ouvert. Une copie par
     type de champ aurait garanti que la prochaine correction n'en couvre
     qu'une des deux. */
  const ui = read('src/components/ui.jsx')
  /* Le motif exact a change: la garde du flou porte maintenant devant elle un
     refus d'une seule fois, pose par la croix. Voir pickerField.test.mjs et
     PickerField dans ui.jsx. Ce qui est epingle ici reste la meme phrase, dans
     sa forme actuelle: ce que le DOM contient vraiment est compare a ce que
     React croit, et propage s'ils different. */
  ok('a native picker clearing the field cannot leave a stale value behind',
     /if \(e\.target\.value !== value\) onChange\(e\.target\.value\)/.test(ui),
     'without it the box looks empty and the old date is what gets saved')
  ok('and the goal form uses that one component for both its dates and its time',
     /PickerField/.test(form) && !/type="time"[\s\S]{0,80}onBlur/.test(form),
     'a second copy of the guard is a second place to forget it')
  ok('and the calendar form has the same guard',
     (read('src/pages/Calendar.jsx').match(/onBlur=\{\(e\) => \{ if \(e\.target\.value !==/g) ?? []).length === 2,
     'same class of fault, same two-line fix, on both of its date fields')

  /**
   * ET IL FAUT POUVOIR REVENIR A VIDE, SANS PASSER PAR LE SELECTEUR.
   *
   * "Being able to reset, I also mean being able to go blank on the space
   * where the time is, because when you click a time but you didn't mean to,
   * it doesn't leave at all, causing you to restart the whole thing."
   *
   * Le Reset du panneau gris appartient a Safari. La croix appartient a
   * l'application: elle vide l'etat React directement et n'apparait que quand
   * il y a quelque chose a effacer. La sonde remind.mjs clique dessus et lit
   * la ligne postee; ceci est le fil-piege.
   */
  /* Le gestionnaire n'est plus une fleche d'une ligne: la croix doit annuler
     l'action par defaut de son clic, sinon le <label> de Field la transmet au
     champ et le selecteur natif s'ouvre sur le champ qu'on vient de vider,
     puis le flou remet la date. Mesure dans Chromium: apres le tap, le focus
     etait DANS le champ date. pickerField.test.mjs epingle les trois lignes. */
  ok('the field can be emptied by a control of ours',
     /justCleared\.current = true\s*onChange\(''\)/.test(ui) && /data-hook=\{hook \? `\$\{hook\}-clear`/.test(ui))
  for (const key of ['form.clear_date', 'form.clear_time']) {
    const hits = read('src/lib/i18n.jsx').split(`'${key}'`).length - 1
    ok(`${key} exists in both languages (${hits})`, hits === 2)
  }
}

/**
 * L'EAU EST NOTEE OU ELLE EST BUE, PAS AU FOND DES REGLAGES.
 *
 * "Ajouter une petite option sur l'ecran home pour rentrer rapidement les
 * verres d'eau qu'on a bu [...] c'est accessible seulement dans les reglages
 * et c'est trop long d'aller jusque la pour acceder a ca."
 *
 * Regler est rare, noter arrive huit fois par jour, et les deux n'ont donc pas
 * a etre au meme endroit. Ce qui est epingle ici est qu'il n'y a QU'UNE
 * implementation derriere les deux ecrans: deux copies de "insere une ligne,
 * recalcule le prochain rappel, reecris water_next_at" derivent en silence,
 * parce que les deux ecrans continuent d'avoir l'air de marcher.
 */
{
  const hook = read('src/lib/useWater.js')
  const card = read('src/components/WaterToday.jsx')
  const settings = read('src/components/ReminderSettings.jsx')

  ok('the water logic lives in one hook', /export function useWaterToday/.test(hook))
  ok('and both screens use it',
     /useWaterToday\(\)/.test(card) && /useWaterToday\(\)/.test(settings))
  ok('so neither screen writes water_log on its own',
     !/from\('water_log'\)/.test(card) && !/from\('water_log'\)/.test(settings),
     'a second insert path is a second place for the next reminder to be wrong')
  ok('the card is on the dashboard', /<WaterToday \/>/.test(read('src/pages/Dashboard.jsx')))
  ok('and stays away when water is off', /!pref\.water_on\) return null/.test(card))
  ok('the water push lands on the card rather than on the page',
     /url: '\/\?boire=1'/.test(read('supabase/functions/notify/index.ts')),
     '"it is at the top" is not an answer to somebody who was just interrupted')
  ok('and the card knows to look for that parameter',
     /params\.get\('boire'\)/.test(card))
  ok('the count is written as well as drawn',
     /water-card-count/.test(card) && /remind\.today/.test(card),
     'colour is never the only signal (1.4.1)')

  /**
   * LES EXPLICATIONS SONT DERRIERE UN POINT D'INTERROGATION.
   *
   *   "Every explanation put them next to the bold name with a ?, and in the
   *    help center article too."
   *
   * Sept paragraphes gris sous sept noms en gras. Mesure de la carte avant et
   * apres, meme bouchon de donnees:
   *
   *   390px    1882px  ->  1173px
   *   1290px   1470px  ->  1030px
   *
   * Rien n'est supprime. Chaque phrase est derriere le "?" a cote de son nom,
   * et la meme chose, developpee, est dans l'aide: le "?" repond a "c'est quoi
   * ce reglage", la page d'aide repond a "oui mais pourquoi".
   *
   * CE QUI RESTE VISIBLE: tout ce qui est un ETAT. "2,2 L", "50 ml - 2 L",
   * "environ un rappel toutes les 1 h 40", l'avertissement quand les deux
   * canaux sont decoches. Une phrase qui change avec les reglages est la
   * reponse de l'ecran a ton geste, pas de la documentation, et la ranger
   * reviendrait a cacher le resultat de ce qu'on vient de faire.
   */
  for (const cle of ['remind.how_hint', 'remind.water_hint', 'remind.unit_hint',
                     'remind.serving_hint', 'remind.window_hint', 'remind.events_hint',
                     'remind.lead_hint']) {
    ok(`${cle} n est plus un paragraphe a l ecran`,
       !new RegExp(`text-muted[^>]*>\\{t\\('${cle.replace('.', '\\.')}'\\)`).test(settings)
         && new RegExp(`hint=\\{t\\('${cle.replace('.', '\\.')}'\\)\\}`).test(settings))
  }
  ok('et le point d interrogation est le composant qui existe deja',
     /import \{ Field, HINT_ANCHOR, Hint \} from '\.\/ui'/.test(settings),
     'un deuxieme "?" a cote du premier serait deux reglages du meme glyphe')

  /* Un clic dans un <label> active le controle du label. Le <details> pose
     dedans aurait donc bascule l'interrupteur en meme temps qu'il ouvre sa
     phrase, et vole le curseur d'un champ. Le label s'arrete au nom. */
  ok('le details est dehors du label, jamais dedans',
     /<\/label>\s*\n\s*\{hint && <Hint text=\{hint\} \/>\}/.test(settings),
     'ouvrir l explication aurait bascule l interrupteur')

  /**
   * ET LE PANNEAU OUVERT PASSE AU-DESSUS DES AUTRES LIGNES.
   *
   * Regarde plutot que raisonne: le panneau de "Boire de l'eau" fait 110px et
   * le titre "Millilitres ou onces" est 24px plus bas. Chaque ligne de titre
   * etant positionnee, a z-index egal c'est l'ordre du DOM qui gagne, donc le
   * titre se peignait PAR-DESSUS la phrase. Un z-index fixe sur toutes les
   * lignes ne repare pas ca, il le garantit.
   *
   * Sonde: les sept panneaux ouverts un par un, a 390 et a 1290, et ce qui est
   * peint au milieu de chacun doit etre le panneau lui-meme.
   */
  ok('l ancre du panneau fait la largeur de la ligne, et elle est partagee',
     /export const HINT_ANCHOR = 'relative has-\[\[open\]\]:!z-40'/.test(read('src/components/ui.jsx')),
     'deux copies de cette ligne derivent, et la deuxieme est celle qu on oublie')
  ok('et elle ne monte qu une ligne a la fois, celle qui est ouverte',
     (settings.match(/\$\{HINT_ANCHOR\}/g) ?? []).length === 3,
     'un z-index fixe sur toutes les lignes garantit le recouvrement au lieu de l empecher')

  /**
   * ET MAINTENANT C'EST CHAQUE CHAMP DE L'APPLICATION, PAS SEULEMENT CET
   * ECRAN-LA.
   *
   *   "Every sub explanation put them next to the bold name with a ?, and in
   *    the help center article too."
   *
   * La premiere fois, le "?" a ete pose a la main sur les sept reglages. La
   * deuxieme demande est la meme, un cran plus bas: les explications SOUS
   * chaque champ. Elles passent par un seul composant, `Field`, donc c'est lui
   * qui change, et les trente et un `hint=` du depot suivent d'un coup:
   * quinze dans le formulaire d'objectif, cinq sur le profil, trois dans les
   * projets, deux dans le detail d'un projet, deux au demarrage d'un groupe.
   *
   * LE <details> EST DANS LE <label> ICI, ET C'EST VERIFIE PLUTOT QUE SUPPOSE.
   *
   * Un clic dans un label est transmis a son controle. La specification ne le
   * transmet PAS quand la cible est du contenu interactif, et <details> en
   * est; ce qui compte est ce que Chromium fait. Sonde: apres un clic sur le
   * "?" de la page Profil, document.activeElement est le SUMMARY, a 390 comme
   * a 1290, et le panneau est ouvert.
   *
   * ReminderSettings sort quand meme son "?" de son label, et ce n'est pas une
   * incoherence: la-bas le label enveloppe un <button role="switch">, qui
   * n'est pas un controle etiquetable, donc il n'y a rien a quoi transmettre.
   */
  {
    const ui = read('src/components/ui.jsx')
    ok('une explication de champ est derriere un "?" partout',
       /\{hint && <Hint text=\{hint\} \/>\}/.test(ui)
         && !/hint && <span className="field-note">/.test(ui),
       'repetee par champ, la ligne grise fait un formulaire a trois lignes par question')
    ok('et elle s ancre sur la ligne du nom, pas sur le champ entier',
       /<span className=\{`\$\{HINT_ANCHOR\} mb-1\.5 flex items-center`\}>/.test(ui),
       'ancre sur le label entier, le panneau s ouvrirait SOUS la boite')

    /**
     * ET LE DISQUE FAIT LA TAILLE DU TEXTE, SANS RETRECIR LA CIBLE.
     *
     *   "The ? are too big, reduce the circle so it fits the text."
     *
     * 24 px de disque a cote d'un libelle de 16 px, c'etait plus haut que la
     * ligne annotee. 18 px de disque, 11 px de glyphe: mesure sur les pixels
     * peints, le disque fait 1,10 fois la bande d'encre du libelle, son centre
     * tombe a 0,60 px de celui de cette bande, et le "?" y tient 6,61:1.
     *
     * Le ::before est ce qui empeche la reduction de devenir une regression:
     * WCAG 2.5.8 demande une cible de 24 px sur 24. Il grandit quand le disque
     * retrecit, 5 px sur les quatre cotes maintenant, sans rien peindre.
     * Verifie par elementFromPoint aux quatre coins d'un carre de 24 px: 4 sur
     * 4 tombent sur le sommaire.
     */
    ok('le disque du "?" fait 14 px, pas 24 ni 18',
       /h-\[0\.875rem\] w-\[0\.875rem\]/.test(ui) && /text-\[0\.625rem\]/.test(ui),
       'un disque plus haut que la ligne qu il annote se lit comme un bouton')
    ok('et la cible tactile reste a 24 px',
       /before:absolute before:-inset-\[0\.3125rem\] before:content-\[''\]/.test(ui)
         && /summary\s*\n?\s*className="press relative /.test(ui),
       '14 + 5 + 5 = 24: le ::before grandit quand le disque retrecit')
    ok('l alignement suit la taille du glyphe',
       /align-\[calc\(0\.383em-0\.22rem\)\]/.test(ui),
       'la constante est la moitie de la hauteur de capitale du "?", qui a retreci avec lui')

    /* Le compte des `hint=` est la mesure de la portee: si quelqu'un ecrit sa
       propre note grise a cote plutot que de passer par Field, ce chiffre ne
       bouge pas et le test ne dit rien. Donc on verifie aussi qu'il ne reste
       pas de .field-note dans un formulaire. */
    const formulaires = ['src/components/GoalForm.jsx', 'src/pages/Me.jsx',
                         'src/components/Projects.jsx', 'src/components/ProjectDetail.jsx',
                         'src/pages/Start.jsx']
    const total = formulaires.reduce((n, f) => n + (read(f).match(/hint=\{t\(/g) ?? []).length, 0)
    ok(`les ${total} explications de champ passent par Field`, total >= 25, String(total))
    const restes = formulaires.filter((f) => /className="field-note"/.test(code(f)))
    ok('et aucune ne s est reecrite a cote en gris',
       restes.length <= 1, restes.join(' '))
  }

  /* Les memes explications dans l'aide, qui est le deuxieme endroit demande. */
  const faq = read('src/content/faq.js')
  ok('les reglages ont leur section dans l aide',
     (faq.match(/id: 'reglages'/g) ?? []).length === 2,
     'une seule des deux langues serait une page a moitie traduite')

  /**
   * WHAT THE SCREEN SAYS AFTER A REFUSAL.
   *
   * Reported as "but it still not working", with a photo of a settings screen
   * carrying three things at once: a check-constraint refusal in red, a field
   * that had snapped back to the old value, and a Save button reading
   * "Enregistre". Only the last one was false, and it is the one that gets
   * believed.
   *
   * Three shapes hold it together, and each was wrong on its own:
   *
   *   setError was set on failure and cleared NOWHERE, so the red banner
   *   outlived the problem. Fixing the database left the message on screen.
   *
   *   save() returned undefined, so the caller could not tell a refusal from a
   *   success and lit the confirmation either way.
   *
   *   touching the button blurred the field first, so one tap committed TWICE:
   *   onBlur with what was typed, then onClick with the value load() had just
   *   restored. The second one succeeded, which is why a refusal could end on
   *   a confirmation.
   */
  ok('a successful read clears a stale refusal', /else setError\(null\)/.test(hook),
     'set on error and cleared nowhere is a banner that outlives its cause')
  ok('and a successful write clears it too', /setError\(null\)\s*\n\s*return true/.test(hook))
  ok('save says whether it went through',
     /return false/.test(hook) && /return true/.test(hook),
     'undefined cannot tell a refusal from a success')
  ok('so the settings screen waits for the answer before confirming',
     /const saved = await save\(\{ water_glass_ml: ml \}\)/.test(settings)
     && /if \(!saved\) return/.test(settings))
  ok('and one tap is one write',
     /onPointerDown=\{\(e\) => e\.preventDefault\(\)\}/.test(settings),
     'without it the blur commits what was typed and the click commits what was restored')
}

/**
 * THE WAIT AFTER PAYING.
 *
 * The poll was a flat two seconds, fifteen times. That is a fine ceiling and
 * the wrong opening: a working webhook lands in about a second, so the usual
 * case was the book being ready and the page sitting out the rest of the
 * interval before noticing.
 *
 * Measured in Chromium by timestamping the reads the page actually makes:
 * 188, 807, 1415, 2224, 3236ms, against two reads in the same window before.
 * The total window is still about half a minute, because a retry after a cold
 * start is well past ten seconds and an earlier nine-second ceiling turned a
 * slow success into a silent failure.
 */
{
  const lib2 = read('src/pages/Library.jsx')
  ok('the purchase poll backs off rather than waiting a flat two seconds',
     /const BACKOFF = \[0, 600, 600/.test(lib2))
  ok('and the schedule is at module scope, not rebuilt every render',
     lib2.indexOf('const BACKOFF') < lib2.indexOf('export default function Library'))
  const total = (lib2.match(/const BACKOFF = \[([^\]]+)\]/) ?? [])[1]
    ?.split(',').map(Number).reduce((a, b) => a + b, 0)
  ok(`the window is still about half a minute (${(total / 1000).toFixed(1)}s)`,
     total > 20000 && total < 40000)
}

/**
 * "LET YOUR FRIENDS KNOW" WROTE TO A TABLE NOTHING READ.
 *
 * Reported: pressed it, went looking, saw nothing. shareToGroup inserted into
 * reading_shares, and no screen in the application has ever selected from that
 * table. The button worked perfectly and reached nobody.
 *
 * Migration 54 gives it a reader by fanning the share into the notification
 * inbox, which is where the app already shows what arrived while you were
 * away.
 */
{
  const mig = read('supabase/54_book_share_notifications.sql')
  ok('a share now becomes a notification', /create trigger reading_shares_notify/.test(mig))
  ok('and the kind constraint knows about it',
     /check \(kind in \('group_goal', 'book', 'nudge'\)\)/.test(mig),
     'a kind the constraint refuses makes the trigger raise and the share fail')
  ok('everybody but the sharer is told',
     /gm\.user_id is distinct from new\.user_id/.test(mig))
  ok('the inbox asks for the book title',
     /books\(title\)/.test(read('src/lib/notifications.js')),
     'without the join every book row reads "shared a book" with no book in it')
  ok('and the page renders a book row as a book',
     /r\.kind === 'book'/.test(read('src/pages/Notifications.jsx')),
     'calling a shared book "added a shared goal" is worse than not showing it')
}

/**
 * iPad and laptop are first-class, and nobody should have to ask.
 *
 * Measured before this was written: at 1180px the home page was one 1030px
 * column, the library three cards stacked full width, a lesson a 490px column
 * against the rail with six hundred empty pixels beside it. Every page had
 * been checked at 390px because that is what was being looked at.
 *
 * The rule is the one the .shell note already gives: limits go on blocks, not
 * on the page. What this pins is that the blocks that need one carry it, and
 * that the instrument which finds the next one exists and is asked for.
 */
{
  const sheet = read('src/index.css')
  ok('there is a reading column', /\.reading\s*\{[^}]*max-w-\[60ch\]/.test(sheet))
  ok('and a page that is one bounded column',
     /\.column-page \.shell\s*\{[^}]*md:max-w-\[46rem\]/.test(sheet),
     'la coquille, pas la grille: le titre de la page n est pas dans la grille')

  const lib = code('src/pages/Library.jsx')
  ok('the library shelves are grids, not stacks',
     (lib.match(/className="card-grid"/g) ?? []).length >= 3,
     String((lib.match(/className="card-grid"/g) ?? []).length))
  ok('no shelf is a space-y stack of cards',
     !/className="space-y-3">\s*\{COURSES\.map/.test(lib) && !/className="space-y-3">\s*\{\(shelf ===/.test(lib))

  const home = code('src/pages/Dashboard.jsx')

  /**
   * LES CARTES SE SUIVENT, ET C'EST LA TROISIEME FORME DE CETTE GRILLE.
   *
   *   "How much got done, book, bring them down and etire les pour qu'ils fit
   *    la page."
   *   "Genre je veux que les cartes se suivent les unes apres les autres, pas
   *    qu'elle soit comme un bento."
   *
   * Forme 1, deux <div> et items-start: colonne de droite 562px contre 993px a
   * gauche, 431px de blanc dessous a toutes les largeurs.
   *
   * Forme 2, items-stretch et `grow-card`: 301px de contenu dans une carte de
   * 496 et 261px dans une autre de 496, contenu centre au milieu du vide. Le
   * trou n'avait pas disparu, il etait passe DANS les cartes. C'est ce que le
   * mot bento designe.
   *
   * Forme 3, une seule suite mise en colonnes. Mesure a 1024, 1180, 1290, 1440
   * et 1728: les deux colonnes finissent a 33px puis 79px l'une de l'autre, au
   * lieu de 431px, sans qu'aucune carte soit etiree ni assignee.
   *
   * FORME 4, ET C'EST LA REPONSE A LA MEME PHRASE DITE UNE TROISIEME FOIS.
   *
   *   "Pourquoi c'est pas aligne les unes apres les autres et c'est toujours
   *    un bento ?"
   *
   * La forme 3 reglait le trou en gardant DEUX colonnes. Deux colonnes de
   * cases restent deux colonnes de cases, et ce qui etait demande n'etait pas
   * un meilleur equilibre mais une SUITE. Donc une colonne, a toutes les
   * largeurs, et la largeur bornee par .column-page pour que la suite ne
   * redevienne pas ce qu'elle etait avant les colonnes: des cartes de 1030px.
   */
  ok('the home feed is one run of cards, not two assigned columns',
     /className="page-grid"/.test(home) && !/page-main/.test(home) && !/page-side/.test(home),
     'une carte assignee a une colonne decide la hauteur de cette colonne par la redaction')
  ok('and it is one column, not two and not a grid',
     !/\.page-grid\s*\{[^}]*columns-2/.test(sheet)
       && !/\.page-grid\s*\{[^}]*grid-cols-/.test(sheet))
  ok('with nothing left that stretches a card to fill a hole',
     !/grow-card\s*\{/.test(sheet) && !/\.page-side\s*\{/.test(sheet)
       && !/className="grow-card"/.test(home),
     'le vide etait passe dans les cartes au lieu de disparaitre')
  /* `break-inside: avoid` protegeait les cartes du passage d'une colonne a
     l'autre. Il n'y a plus de colonnes, donc il est parti avec elles: une
     regle qu'aucun etat n'atteint est une regle que le prochain lecteur
     essaiera de comprendre. */
  ok('and the column-break guard went with the columns',
     !/\.page-grid > \*/.test(sheet))
  ok('the phone sees exactly what the laptop sees, in DOM order',
     /\.page-grid\s*\{\s*@apply block;\s*\}/.test(sheet),
     'une seule forme a toutes les largeurs, donc rien a verifier par palier')

  const courses = code('src/pages/Courses.jsx')
  ok('a lesson and a course summary are reading columns',
     (courses.match(/className="reading"/g) ?? []).length === 2,
     String((courses.match(/className="reading"/g) ?? []).length))
  ok('and no lesson block carries its own 48ch any more', !/max-w-\[48ch\]/.test(courses))

  ok('the width sweep exists and is wired',
     existsSync(join(root, 'scripts/sweep-widths.mjs')) &&
       /"sweep": "node scripts\/sweep-widths\.mjs"/.test(read('package.json')))
  ok('and the working agreements ask for it', /npm run sweep/.test(read('CLAUDE.md')))
}

/**
 * LA CARTE DU TABLEAU DE BORD, RANGEE PLUTOT QU'AMPUTEE.
 *
 * Demande: "move the section title inline or replace it with a small info
 * icon, remove the long paragraph block at the bottom, keep the card compact,
 * focusing strictly on the percentage stat, progress bar and count".
 *
 * La methodologie n'est pas supprimee, elle passe derriere un point
 * d'interrogation: c'est une phrase qu'on lit une fois et qu'on ne relit
 * jamais, et elle faisait un tiers de la hauteur de la carte.
 *
 * DEUX DE CES ASSERTIONS VIENNENT D'UNE CAPTURE, PAS D'UNE IDEE.
 *
 * Premiere version: le Hint dans le <span className="eyebrow">. Le panneau
 * heritait de text-transform: uppercase et s'ancrait sur un span large de
 * trois mots. Deuxieme version: le panneau passait SOUS la barre de periodes,
 * parce que `.lg > *` pose z-[2] sur chaque enfant de la carte et qu'entre
 * egaux c'est l'ordre du DOM qui gagne. Les deux fois, la sonde d'origine
 * passait. Ce qui suit epingle les deux corrections.
 */
{
  const card = read('src/components/MyCompletion.jsx')
  const dash = code('src/pages/Dashboard.jsx')

  ok('the long note is gone from the card body',
     !/text-small text-muted">\{t\('analytics\.note_mine'\)\}/.test(card))
  ok('and lives behind a question mark instead',
     /<Hint text=\{t\('analytics\.note_mine'\)\} \/>/.test(card))
  ok('the dashboard no longer stacks a second label over it',
     !/you_overall/.test(dash) && !/you_overall/.test(read('src/lib/i18n.jsx')),
     'two eyebrows for one card is one too many')
  ok('the scope moved into the sentence rather than being dropped',
     (read('src/lib/i18n.jsx').match(/analytics\.note_mine': '(You, across every group|Toi, tous groupes confondus)/g) ?? []).length === 2,
     '"tous groupes confondus" is what the section title was for')
  ok('the marker sits beside the eyebrow, not inside it',
     /<span className="eyebrow">\{t\('analytics\.title'\)\}<\/span>/.test(card),
     'inside, the panel inherits uppercase and anchors to a three-word box')
  ok('and the header outranks the rest of the card',
     /relative !z-30 flex/.test(card),
     '.lg > * pins every child at z-[2], so the panel rendered under the period bar')
}

/**
 * BUDGET 101 EST UN COURS, PAS UNE "FORMATION" A COTE.
 *
 * "Budget 101 doit etre le meme format que les autres cours, mais ca doit
 * plus parler de comment faire un budget."
 *
 * Il avait son propre lecteur (Formation.jsx), son propre stockage de
 * progression (lessons.js, localStorage) et sa propre carte avec une fleche
 * au lieu d'un bouton "Commencer le cours": sur l'etagere Cours, c'etait le
 * seul element qui ne ressemblait pas aux autres. Ce qui est epingle ici est
 * que les deux implementations n'existent pas en meme temps, parce que la
 * moitie morte est ce qui revient dans six mois.
 */
{
  ok('the old formation player is gone',
     !existsSync(join(root, 'src/components/Formation.jsx')) &&
       !existsSync(join(root, 'src/lib/lessons.js')),
     'two Budget 101s is exactly the confusion this change is about')
  const lib = code('src/pages/Library.jsx')
  ok('and the shelf has no separate entry for it',
     !/formation-entry/.test(lib) && !/Formation/.test(lib))
  ok('the count no longer adds one for it',
     !/formation/.test(code('src/lib/shelves.js')),
     'a +1 next to four cards announced five courses')

  const courses = read('src/content/courses.js')
  ok('it is the first course, before the ones that spend money',
     /export const COURSES = \[[\s\S]{0,400}BUDGET_101,/.test(courses),
     '"invest what is left" assumes you know what is left')
  const budget = read('src/content/budget101.js')
  ok('and it is written, not a plan',
     !/state: 'plan'/.test(budget) && (budget.match(/state: 'written'/g) ?? []).length >= 10)
  ok('every lesson ends on something to go and do',
     (budget.match(/\n          todo: \{/g) ?? []).length ===
       (budget.match(/state: 'written'/g) ?? []).length,
     'a lesson that ends in agreement changes nothing')
}

/**
 * L'HEURE D'OUVERTURE N'EST PLUS ECRITE SOUS LE NOM DU GROUPE.
 *
 *   "Dimanche 4h heure Toronto, enleve ca dans le ui et ux."
 *
 * Cet ecran a porte trois versions de la meme phrase. D'abord "Sunday 00:00 ·
 * America/Toronto", qui imprimait un nom de fuseau a la place d'une heure.
 * Puis la conversion dans le fuseau du lecteur, avec une deuxieme ligne quand
 * les deux differaient. Les deux disaient une REGLE, et une regle n'est pas
 * une heure dont on peut faire quelque chose.
 *
 * La question utile est "dans combien de temps", et le tableau y repond deja
 * sur cycles.opens_at, qui est un instant. C'est ce qui rend cette suppression
 * sans perte, et c'est ce que les deux premieres verifications epinglent.
 */
{
  const settings = code('src/pages/Settings.jsx')
  const head = code('src/components/GroupHeader.jsx')

  ok('la carte du groupe ne dit plus quand la periode ouvre',
     !/openingLabel|deviceZone/.test(settings)
       && !/data-hook="group-when"/.test(head),
     'une regle exprimee dans un fuseau se convertit de tete avant de servir')
  ok('et le tableau repond toujours a la vraie question',
     /board\.opens_in/.test(code('src/pages/Board.jsx')),
     '"ouvre dans 3 h" est un instant, pas une regle')

  /* LE TEMOIN D'ENREGISTREMENT VIVAIT DANS CETTE LIGNE. Le supprimer avec elle
     aurait rendu muets le changement de nom et le changement d'image, qui sont
     les deux gestes de cette carte. */
  ok('renommer et changer l image disent toujours qu ils enregistrent',
     /data-hook="group-saving"/.test(head) && /t\('settings\.saving'\)/.test(head))
  ok('et en role="status", parce que rien d autre ne bouge a l ecran',
     /role="status" data-hook="group-saving"/.test(head))

  /* Les chaines et le module partent avec la phrase: un export sans appelant
     est le debut d'une planche de sprites, comme ailleurs dans ce fichier. */
  ok('la chaine de la deuxieme ligne est partie avec elle',
     !/when_everywhere/.test(read('src/lib/i18n.jsx')))
  ok('et groupTime aussi, avec son test',
     !existsSync(join(root, 'src/lib/groupTime.js'))
       && !existsSync(join(root, 'src/lib/groupTime.test.mjs'))
       && !/groupTime/.test(read('package.json')),
     'openingLabel n avait que cet appelant; la conversion reste dans git')
  ok('et plus personne ne l importe',
     !/groupTime/.test(settings) && !/groupTime/.test(head))
}

/**
 * LE POINT D'INTERROGATION, A LA HAUTEUR DU TEXTE.
 *
 * "Can we adjust the ? at the same level as the text."
 *
 * Il etait en `align-middle`, et le centre de son disque tombait 9,3 px sous
 * celui des capitales du titre, mesure sur les pixels peints a cote
 * d'"Objectifs" en 32 px. La correction est une longueur sur `vertical-align`,
 * en em, donc juste a toutes les tailles.
 *
 * Deux details sont epingles parce que les deux ont deja coute une mesure:
 * la longueur est sur le <details> et pas sur le sommaire, sinon l'em se
 * resout sur la police du marqueur (11 px) au lieu de celle du titre; et le
 * <details> n'est pas `relative`, sinon le panneau s'ancre a nouveau sur le
 * marqueur et sort de l'ecran.
 *
 * LE SOMMAIRE, LUI, L'EST DEVENU, ET CE N'EST PAS LA MEME CHOSE. Le panneau
 * est son FRERE, pas son descendant: un bloc conteneur pose sur le sommaire ne
 * peut donc pas le rattraper. Il porte `relative` pour son ::before, qui rend
 * a la cible les 24 px que le disque a perdus en retrecissant. Le cas
 * ci-dessous vise donc le <details> nommement, au lieu d'interdire le mot
 * partout: une interdiction trop large se lit comme une regle et n'en est pas
 * une.
 */
{
  const ui = read('src/components/ui.jsx')
  ok('the marker is raised by a length, not centred on the x-height',
     /align-\[calc\(0\.383em-0\.22rem\)\]/.test(ui),
     'align-middle put its centre 9.3px below the title cap band')
  ok('and the length sits on the element that inherits the title’s size',
     /<details\s+className="group ml-2 inline-block align-\[/.test(ui),
     'on the summary, em resolves against text-label and the correction is 0.28px')
  ok('the details itself is not positioned',
     !/<details[^>]*className="[^"]*\brelative\b/.test(ui),
     'a positioned ancestor recaptures the panel, which is how it left the screen')
}

/**
 * UNE NOTIFICATION QU'ON TOUCHE DOIT OUVRIR QUELQUE CHOSE.
 *
 * "Cette notification quand on clique ca fait rien, pareil pour les autres."
 *
 * Mesure dans Chromium, avec la mise a jour "lu" laissee sans reponse: la
 * ligne quittait la liste, l'app restait sur /notifications, et plus rien
 * n'arrivait jamais. openOne attendait cette ecriture AVANT de naviguer, donc
 * le tap valait exactement ce que valait le reseau. Un telephone a deux barres
 * est cette mesure avec un delai plus long.
 *
 * Et la zone qui repondait au doigt: 41px morts sur une ligne de 94px, 42%
 * seulement de la carte nudge. Le `py-5` etait sur la ligne, pas sur le
 * bouton.
 *
 * Les deux sont epingles ici parce que les deux se defont en une ligne, sans
 * que rien n'echoue: remettre un `await` devant la navigation, ou remonter la
 * marge interieure sur l'enveloppe.
 */
{
  const notif = code('src/pages/Notifications.jsx')

  ok('rien n’attend le reseau avant de naviguer',
     !/await markRead\(\[r\.id\]\)/.test(notif),
     'un tap ne doit pas valoir ce que vaut la connexion')
  ok('la mise a jour "lu" part quand meme',
     /markRead\(\[r\.id\]\)\.then\(/.test(notif),
     'elle reste, elle ne passe simplement plus devant')
  ok('une ligne sans adresse ne renvoie plus a l’accueil',
     !/navigate\(r\.href \?\? '\/'\)/.test(notif),
     'atterrir sur le tableau de bord n’est pas une destination')
  ok('et ne dessine pas de fleche',
     /\{r\.href && \(/.test(notif),
     'une fleche sur une ligne qui ne voyage pas est une ligne qui ment')
  ok('la marge interieure est sur le bouton, pas sur la ligne',
     /pt-5 text-left/.test(notif) && !/data-hook="notif-row" className="py-5"/.test(notif),
     '41px morts sur 94px, mesures: viser une carte et tomber dans sa marge')
}

/**
 * UN EX AEQUO EST LE NOMBRE, EN GRIS. PAS DE SIGNE EGAL.
 *
 * "Au lieu de mettre =4, rends juste le nombre gris quand c'est ex aequo,
 * juste le nombre."
 *
 * Le signe se remet en une ligne, et il se remettra: `=2` est la facon dont
 * une vraie table de championnat s'ecrit, donc quelqu'un qui relit ce
 * composant le trouvera manquant. Sur un tableau de six amies qui n'ont encore
 * rien fait, il mettait une ponctuation devant chaque ligne et la colonne se
 * lisait comme une panne avant de se lire comme un classement.
 *
 * Et text-mark ne vaut plus que pour une premiere place TENUE SEULE: l'or sur
 * deux personnes a egalite dirait que chacune tient le haut du tableau toute
 * seule. Mesure dans Chromium sur les deux cas.
 */
{
  const ga = code('src/components/GroupAnalytics.jsx')

  ok('plus de signe egal devant un rang',
     !/tied \? '=' : ''/.test(ga),
     'la colonne se lisait comme une panne avant de se lire comme un classement')
  ok('la couleur du premier ne va qu a un premier seul',
     /row\.position === 1 && !row\.tied \? 'text-mark'/.test(ga),
     'l or sur deux ex aequo dirait que chacune tient le haut toute seule')
  ok('un ex aequo reste lisible sans couleur, par le nombre repete',
     /\{row\.position === null \? '-' : row\.position\}/.test(ga),
     'trois lignes qui disent 4 est ce a quoi ressemble une egalite, en gris comme en noir et blanc')
  ok('et l egalite est lisible par une sonde',
     /data-tied=\{row\.tied \? 'yes' : 'no'\}/.test(ga))
}

/**
 * REMPLACER TOUT LE PACK DE STICKERS NE DOIT PAS VIDER LES PAGES.
 *
 * Demande: "remplace tout les sticker par ceux ci".
 *
 * Quatre surfaces nomment des stickers precis, douze noms ecrits a la main.
 * Ces listes sont filtrees contre ce qui existe, ce qui est juste pour UN nom
 * disparu et faux pour tous a la fois: le filtre rend alors une liste vide, et
 * la rangee de la connexion comme le decor de chaque page disparaissent sans
 * erreur, sans image cassee, sans rien dans la console.
 *
 * Mesure: dossier entierement renomme, puis Chromium a 390. Avant, zero
 * sticker place sur les deux surfaces. Apres, six et six.
 */
{
  const art = code('src/lib/art.js')
  const signin = code('src/pages/SignIn.jsx')
  const stk = code('src/components/Stickers.jsx')

  ok('la regle de choix vit dans un fichier que node peut executer',
     /from '\.\/stickerPick'/.test(art),
     'art.js utilise import.meta.glob et ne se teste que par son texte')
  ok('et pickStickers accepte un minimum', /pickStickers = \(wanted, atLeast = 0\)/.test(art))

  ok('la rangee de la connexion en demande six',
     /'popsicle'\], 6\)/.test(signin),
     'sans le compte, un pack remplace laisse la page de connexion nue')
  const comptes = [...stk.matchAll(/pickStickers\(\[[^\]]*\], (\d+)\)/g)].map((m) => Number(m[1]))
  ok('et les trois jeux de Stickers.jsx aussi', comptes.length === 3, JSON.stringify(comptes))
  ok('chacun avec autant de stickers que de noms voulus',
     comptes.join(',') === '6,4,6', JSON.stringify(comptes))
}

/**
 * UN GROUPE POSSEDE SON IMAGE.
 *
 * Demande: "Update the sticker for this group."
 *
 * L'image etait CALCULEE a partir de l'identifiant, et le commentaire de
 * stickerFor disait ou etait la limite: "if a group ever needs to *own* its
 * artwork, that is a column, not a change here". La migration 66 est cette
 * colonne.
 *
 * Ce qui est epingle: que le calcul reste le defaut, que les TROIS surfaces qui
 * dessinent le visage d'un groupe lisent le meme choix, et qu'une base sans la
 * migration reponde une phrase plutot qu'une trace Postgres.
 */
{
  const art = code('src/lib/art.js')
  const head = code('src/components/GroupHeader.jsx')
  const shell = code('src/components/AppShell.jsx')
  const dash = code('src/pages/Dashboard.jsx')
  const sql = code('supabase/66_group_sticker.sql')

  ok('la colonne existe et ne se remplit pas retroactivement',
     /add column if not exists sticker text/.test(sql) && !/update groups set sticker/i.test(sql))
  ok('et aucune politique n est ajoutee pour elle',
     !/create policy/i.test(sql),
     'groups_update est deja is_group_admin des deux cotes')

  ok('le choix passe devant le calcul, dans un fichier testable',
     /chooseSticker\(chosen, id, STICKER_NAMES\)/.test(art))
  ok('stickerFor accepte un choix', /stickerFor\(id, chosen = null\)/.test(art))

  const appels = [head, shell, dash].filter((f) => /stickerFor\([^)]*,\s*\w+\.sticker\)/.test(f))
  ok('les trois surfaces lisent le choix', appels.length === 3,
     `${appels.length} sur 3: une seule qui l oublie et le rail contredit la page`)

  ok('changer l image est reserve aux admins',
     /disabled=\{!canEdit\}[\s\S]{0,400}data-hook="group-sticker"/.test(head))
  ok('on peut revenir au calcul', /saveSticker\(null\)/.test(head),
     'sans ca, une fois l image changee il n y a plus de chemin de retour')
  ok('une colonne absente donne une phrase, pas du Postgres',
     /isMissingColumn\(err, 'sticker'\) \? t\('settings\.sticker_pending'\)/.test(head))

  /**
   * TOUT CE QUI EST PLUS ETROIT QUE LA CARTE PORTE mx-auto.
   *
   *   "Le nom du groupe doit etre centre en bas du logo."
   *
   * `text-center` sur la carte centre le TEXTE dans sa boite et ne dit rien de
   * l'endroit ou cette boite se pose. Quatre elements ici sont plus etroits
   * que la carte: le bouton du nom s'ajuste a son contenu, le champ est
   * plafonne a 38rem par `.field`, la note a 42ch, et l'image fait 96px dans
   * un bouton elargi par "CHANGER L'IMAGE". Sans mx-auto, chacun se range a
   * gauche, et du texte centre dans une boite collee a gauche reste a gauche.
   *
   * L'image est la plus sournoise: le preflight de Tailwind pose
   * `img { display: block }`, donc text-center ne l'atteint pas. Elle etait a
   * -19px du centre, et SEULEMENT chez un admin, parce qu'un simple membre n'a
   * pas le libelle qui elargit le bouton.
   *
   * La note du fuseau horaire etait la quatrieme. Elle a ete supprimee depuis,
   * avec la phrase qu'elle completait, donc il n'y a plus rien a centrer la:
   * une verification sur un element disparu passe ou echoue pour une raison
   * qui n'a plus de rapport avec l'alignement.
   */
  for (const [quoi, re] of [
    ['l image', /className="mx-auto h-24 w-24 object-contain"/],
    ['le nom', /data-hook="group-name"\s*\n\s*className="press mx-auto/],
    ['le champ', /data-hook="group-name-field"[\s\S]{0,80}className="field mx-auto/],
  ]) {
    ok(`${quoi} est centre dans la carte`, re.test(head),
       'text-center ne pose pas une boite plus etroite que son parent')
  }
  ok('et le nom se cherche par un data-hook, pas par sa classe',
     /data-hook="group-name"/.test(head) && /data-hook="group-name-field"/.test(head),
     'les selecteurs sur les classes ont casse a chaque restylage de ce depot')
}

/**
 * AUCUN TITRE DE PROSE NE MONTE AU-DESSUS DE 600.
 *
 *   "Bienvenue sur Rich and Friends est trop gras."
 *
 * index.css pose deja la regle et dit pourquoi, mot pour mot: "Poppins is a
 * geometric face and its bold is genuinely bold: at 700 the bowls close up and
 * a heading stops being a heading and starts being a block of ink."
 *
 * Deux ecrans la contredisaient avec `font-extrabold`, soit 800: l'accueil et
 * la configuration, qui se suivent. Mesure dans Chromium: 800 sur 32px, contre
 * un corps a 500, et 21.8% d'encre dans le rectangle du titre contre 17.0%
 * apres correction.
 *
 * LES CHIFFRES NE SONT PAS DE LA PROSE. `font-bold` sur un montant ou un
 * compteur en taille h1 reste permis: c'est une valeur, pas un titre, et elle
 * porte `tabular-nums` ou `leading-none` qui la distinguent. La regle porte
 * sur les <h1> et <h2>, qui sont les balises que index.css regle.
 */
{
  const pages = readdirSync(join(root, 'src/pages'))
    .filter((f) => f.endsWith('.jsx'))
    .map((f) => [`src/pages/${f}`, read(`src/pages/${f}`)])
  const composants = readdirSync(join(root, 'src/components'))
    .filter((f) => f.endsWith('.jsx'))
    .map((f) => [`src/components/${f}`, read(`src/components/${f}`)])

  const gras = []
  for (const [nom, texte] of [...pages, ...composants]) {
    for (const m of texte.matchAll(/<h[12]\s[^>]*className="([^"]*)"/g)) {
      if (/font-(bold|extrabold|black)/.test(m[1])) gras.push(`${nom}: ${m[1].slice(0, 60)}`)
    }
  }
  ok('aucun h1 ni h2 ne force une graisse au-dessus de 600',
     gras.length === 0, gras.join(' | '))

  ok('et la regle est toujours ecrite dans la feuille de style',
     /h1,\s*\n\s*h2,\s*\n\s*h3 \{[\s\S]{0,80}font-weight: 600;/.test(css),
     'sans elle, retirer la classe ne donnerait plus 600 mais la valeur du navigateur')
}

/**
 * QUI VOIT MON HUMEUR: LE CHOIX A DEMENAGE DANS LES REGLAGES.
 *
 *   "Humeur du jour, remove l'option qui demande de partager dans les groupes,
 *    bouge la plutot dans les parametres, comme ca chaque personne peut aller
 *    dans ses parametres et choisir avec quel groupe elle veut partager ses
 *    humeurs."
 *
 * Ce qui etait la: une case a cocher dans le formulaire, posee chaque jour, et
 * indivisible. "Partager avec mes groupes" etait un seul oui pour tous les
 * groupes a la fois, donc quelqu'un qui est dans le groupe de ses amies ET
 * dans celui de son cours n'avait aucun moyen de dire oui a l'une et non a
 * l'autre.
 *
 * Trois choses sont epinglees ici, et chacune se casserait en silence.
 */
{
  const carte = read('src/components/MoodToday.jsx')
  const bloc = read('src/components/MoodShare.jsx')
  const compte = read('src/pages/Account.jsx')
  const sql = read('supabase/71_mood_share.sql')

  ok('la case a cocher a quitte le formulaire',
     !/setDraftShared|t\('mood\.share'\)/.test(carte) && !/shared: nextShared/.test(carte),
     'la question revenait tous les jours pour une reponse qui ne change pas')
  ok('et le formulaire n ecrit plus la colonne',
     !/shared: /.test(carte.replace(/\/\*[\s\S]*?\*\//g, '')),
     'plus aucune politique ne la lit depuis la migration 71')
  ok('il DIT ou va ce qui vient d etre tape',
     /data-hook="mood-audience"/.test(carte) && /mood\.share_where_some/.test(carte)
       && /to="\/settings"/.test(carte),
     'enlever la case sans rien dire laisse quelqu un sans savoir qui voit')

  ok('le bloc vit dans les reglages personnels, pas dans ceux d un groupe',
     /<MoodShare \/>/.test(compte) && /moodshare\.section/.test(compte),
     'la page d un groupe ne montre qu un groupe')
  ok('un interrupteur par groupe, avec son etat ecrit',
     /data-hook="moodshare-toggle"/.test(bloc)
       && /moodshare\.on/.test(bloc) && /moodshare\.off/.test(bloc),
     'une coche seule est une information portee par une forme, 1.4.1')

  /**
   * LE COMPTE EXACT SUR LE DELETE, ET C'EST LA SEULE ERREUR QUI SE PAIERAIT EN
   * VIE PRIVEE.
   *
   * La RLS refuse un DELETE en silence: zero ligne, aucune erreur. Sans le
   * compte, eteindre un groupe afficherait "eteint" pendant que la ligne reste
   * en base, donc le groupe continuerait de voir l'humeur. Sonde: avec un stub
   * qui repond zero ligne, l'interrupteur revient ET le dit.
   */
  ok('eteindre compte ses lignes et refuse de mentir',
     /delete\(\{ count: 'exact' \}\)/.test(bloc) && /if \(!count\) throw/.test(bloc),
     'un refus silencieux afficherait "eteint" sur un groupe qui voit encore')
  ok('et un echec remet l interrupteur ou il etait, avec un mot',
     /setOn\(avant\)/.test(bloc) && /data-hook="moodshare-failed"/.test(bloc),
     'un interrupteur qui revient sans un mot est pire que pas d interrupteur')

  /**
   * ET LA POLITIQUE PASSE PAR UNE FONCTION, CE QUI N'EST PAS UN DETAIL.
   *
   * Une politique RLS qui fait `exists (select 1 from mood_share ...)` est
   * elle-meme soumise a la RLS de mood_share, qui ne se lit que par son
   * proprietaire. La sous-requete ne rendrait donc jamais rien et AUCUNE
   * humeur ne serait plus visible nulle part: pas d'erreur, juste un tableau
   * de groupe vide pour toujours.
   */
  ok('mood_share ne se lit que par la personne qu elle concerne',
     /create policy mood_share_own on mood_share\s*\n\s*for all\s*\n\s*using \(user_id = auth\.uid\(\)\)/.test(sql)
       && (sql.match(/create policy/g) ?? []).length === 2,
     'un chemin par le groupe apprendrait qui a choisi de ne pas partager')
  ok('la visibilite passe par une fonction SECURITY DEFINER',
     /security definer/.test(sql) && /set search_path = public/.test(sql)
       && /mood_visible_to_me\(user_id\)/.test(sql),
     'sinon la politique se heurte a la RLS de mood_share et plus rien n est visible')
  ok('et elle verifie les DEUX appartenances',
     /join group_members moi[\s\S]{0,200}join group_members lelle/.test(sql),
     'quitter un groupe doit arreter le partage sans rien nettoyer')
  ok('la politique de lecture ne parle plus de `shared`',
     /user_id = auth\.uid\(\)\s*\n\s*or \(day = current_date and mood_visible_to_me\(user_id\)\)/.test(sql),
     'la colonne reste pour l historique et n est plus lue')
  ok('personne ne perd ce qu il avait',
     /insert into mood_share \(user_id, group_id\)[\s\S]{0,300}where dm\.shared/.test(sql),
     'shared = true voulait dire "avec mes groupes", au pluriel')

  const i18n = read('src/lib/i18n.jsx')
  for (const cle of ['moodshare.section', 'moodshare.help', 'moodshare.on', 'moodshare.off',
                     'moodshare.failed', 'mood.share_where_some', 'mood.share_where_none',
                     'mood.share_pick']) {
    ok(`${cle} existe dans les deux langues`,
       (i18n.match(new RegExp(`'${cle.replace('.', '\\.')}':`, 'g')) ?? []).length === 2,
       'une seule occurrence veut dire une langue qui rend la cle brute')
  }
}

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
