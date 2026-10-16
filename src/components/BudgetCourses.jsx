import { Link } from 'react-router-dom'
import { useT } from '../lib/i18n'
import { COURSES } from '../content/courses'
import { lessonsOf, modulesOf, say } from '../lib/courses'
import { Spot, Tape } from './StickerKit'

/**
 * "JAMAIS FAIT DE BUDGET ? SUIS CES COURS."
 *
 *   "After the introduction, the first thing you should see is: 'Never done
 *    a budget before? Take these courses.'"
 *
 * La premiere chose sous l'intro, avant le formulaire du plan. Celle-ci
 * finissait sur "Construire mon budget" et ouvrait directement un formulaire
 * a 0,00 $: quelqu'un qui n'a jamais fait de budget arrivait devant cinq
 * champs sans savoir quoi y mettre.
 *
 * Budget 101 d'abord, en grand: c'est le cours qui apprend a faire un
 * budget, et il est deja premier dans COURSES pour cette raison (voir la
 * note sur l'ordre dans src/content/courses.js). Les trois autres ensuite,
 * dans le meme ordre, plus petits.
 *
 * Les cartes menent au sommaire du cours, comme dans Lectures: c'est la que
 * la region est demandee pour les cours qui en dependent.
 *
 * DES TUILES, PAS UNE PILE. Trois cartes pleine largeur l'une sous l'autre
 * au-dessus de md, c'est ce que le balayage des largeurs refuse (une liste de
 * telephone etiree). Elles passent cote a cote des sm.
 *
 * Les stickers se posent dans un coin vide de la carte: rien ne couvre un
 * mot (CLAUDE.md), et la sonde de recouvrement le mesure.
 */
const ART = {
  'budget-101': 'wallet',
  'riche-lentement': 'cactus',
  'carte-de-credit': 'skullfire',
  'investir-101': 'chaching',
}

export default function BudgetCourses() {
  const { t, locale } = useT()
  const lead = COURSES.find((c) => c.slug === 'budget-101') ?? COURSES[0]
  const others = COURSES.filter((c) => c !== lead)
  const meta = (c) => t('bstart.meta', { modules: modulesOf(c).length, lessons: lessonsOf(c).length })

  return (
    <div data-hook="budget-courses">
      <Link
        to={`/cours/${lead.slug}`}
        data-hook="budget-course"
        data-slug={lead.slug}
        className="lean press relative block rounded-card bg-field p-6 text-on-field sm:p-8"
        style={{ '--tilt': '-0.6deg' }}
      >
        <Tape className="-top-3 left-10" tilt={-5} />
        <Spot name={ART[lead.slug]} tilt={9} eager className="absolute -right-3 -top-8 w-24 sm:-right-4 sm:w-36" />
        {/* The words keep clear of the sticker's corner; the button below
            them has the whole width. */}
        <span className="block pr-20 sm:pr-36">
          <span className="block text-label font-semibold uppercase tracking-wider">{t('bstart.first')}</span>
          <span className="mt-2 block text-[clamp(2.1rem,8vw,2.9rem)] font-semibold leading-none tracking-[-0.02em]">
            {say(lead.title, locale)}
          </span>
          <span className="mt-3 block max-w-[44ch] text-body">{say(lead.tagline, locale)}</span>
          <span className="mt-3 block text-small font-semibold">{meta(lead)}</span>
        </span>
        {/* Un bouton dessine, pas un bouton: la carte entiere est le lien, et
            un lien dans un lien ne s'imbrique pas. */}
        <span className="btn btn-primary mt-6 text-[1.1875rem] font-bold" aria-hidden="true">
          {t('bstart.go', { title: say(lead.title, locale) })}
        </span>
      </Link>

      <h2 className="eyebrow mb-4 mt-10">{t('bstart.then')}</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {others.map((c, n) => (
          <Link
            key={c.slug}
            to={`/cours/${c.slug}`}
            data-hook="budget-course"
            data-slug={c.slug}
            className="lg press relative flex items-center gap-4 overflow-visible p-4 sm:flex-col sm:items-start sm:p-5"
          >
            {/* One frame for every sticker: the cactus is tall and CHACHING is
                wide, and at their own sizes the three titles sat at three
                different heights. Absolute and object-contain inside a box of
                fixed size: a max-height of 100% on a grid item did not hold,
                and the cactus came down over "Rich, slowly". */}
            <span className="relative block h-14 w-14 shrink-0 sm:h-20 sm:w-20">
              <Spot name={ART[c.slug]} tilt={n % 2 ? 7 : -7} className="absolute inset-0 h-full w-full object-contain" />
            </span>
            <span className="min-w-0">
              <span className="block text-body font-semibold leading-tight text-ink">{say(c.title, locale)}</span>
              <span className="mt-1 block text-small text-muted">{meta(c)}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
