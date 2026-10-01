import { Link } from 'react-router-dom'
import { localeTag, useT } from '../lib/i18n'
import { daysBetween, phaseOn } from '../lib/cycle'
import { ringModel } from '../lib/cycleRing'
import CycleRing, { PHASE_DOT } from './CycleRing'

/**
 * La carte du cycle sur le calendrier.
 *
 *   "The menstruation tab... it looks cheap, it doesn't feel like I care
 *    about women's health."
 *
 * Sur le calendrier, le cycle n'etait qu'un bouton "+ Mes regles" dans la
 * rangee d'outils et des points de huit pixels sur la grille. Le tiroir a
 * ete redessine; c'est ici qu'on arrive le plus souvent, et c'est ici que
 * ca se voyait le moins.
 *
 * La carte repond a la question qu'on se pose en ouvrant le calendrier,
 * "j'en suis ou", avec le meme anneau que le tiroir et la carte du profil
 * (une seule geometrie, src/lib/cycleRing.js), les prochaines regles en
 * mots avec la date, et la phase du jour quand il y en a une. Le detail
 * reste dans le tiroir, qui s'ouvre depuis le profil: le calendrier ne le
 * monte pas ouvert, voir la note de Calendar.jsx.
 *
 * Elle ne dit rien que predict() ne dise, et rien ne sort de la personne:
 * elle lit l'etat que CyclePanel remonte, elle n'ecrit rien.
 */
export default function CycleStrip({ starts = [], prediction = null }) {
  const { t, locale } = useT()
  const ring = ringModel(starts, prediction)
  if (!ring || !prediction) return null

  const today = new Date()
  const away = daysBetween(today, prediction.nextStart)
  const phase = phaseOn(today, starts, prediction)
  const head = away === 0 ? t('cal.cycle_today') : away > 0 ? t('cal.cycle_in', { n: away }) : t('cal.cycle_late', { n: -away })
  const date = new Intl.DateTimeFormat(localeTag(locale), { weekday: 'long', day: 'numeric', month: 'long' }).format(prediction.nextStart)

  return (
    <section className="lg flex items-center gap-4 p-4 sm:p-5" data-hook="cal-cycle-card" data-days={away} data-phase={phase ?? ''}>
      <CycleRing model={ring} size={96} compact className="shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="eyebrow">{t('cycle.title')}</p>
        <p className="text-safe mt-0.5 text-body font-semibold text-ink">{head}</p>
        <p className="text-safe text-small text-muted">{t('cycle.expected_on', { date })}</p>
        {phase && (
          <p className="text-safe mt-1.5 flex items-start gap-2 text-small text-ink" data-hook="cal-cycle-care">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-pill ${PHASE_DOT[phase]}`} aria-hidden="true" />
            <span>
              <span className="font-semibold">{t(`cycle.phase_${phase}`)}.</span> {t(`cycle.care_${phase}`)}
            </span>
          </p>
        )}
        <Link
          to="/profile"
          className="press mt-2 inline-block text-small font-semibold text-ink underline decoration-1 underline-offset-2"
          data-hook="cal-cycle-link"
        >
          {t('cycle.manage')}
        </Link>
      </div>
    </section>
  )
}
