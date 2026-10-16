import { useState } from 'react'
import { Link } from 'react-router-dom'
import { localeTag, useT } from '../lib/i18n'
import { daysBetween, phaseOn } from '../lib/cycle'
import { ringModel } from '../lib/cycleRing'
import { cycleDetails } from '../lib/cycleDetails'
import { useLongPress } from '../lib/useLongPress'
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
 *
 * ELLE S'OUVRE SOUS LE DOIGT.
 *
 *   "You should be able to click and expand the tab when you click it for a
 *    long time."
 *
 * Un appui long (HOLD_MS, le meme que les dates et le rail) ouvre la carte
 * sur place: les dates a venir, le cycle moyen et sa regularite, les
 * dernieres regles notees. Un deuxieme appui long la referme. La barre du bas
 * se remplit pendant l'appui, comme sur le rail, pour que la demi-seconde
 * d'attente se voie.
 *
 * Le bouton "Voir plus" fait la meme chose d'une touche: un clavier ne fait
 * pas d'appui long, et quelqu'un qui ne sait pas qu'il existe doit pouvoir
 * ouvrir la carte quand meme. Il porte aria-expanded.
 *
 * Pas de capture du pointeur: la carte contient le lien "Mon cycle", et avec
 * la capture le clic n'atteindrait plus le lien (voir useLongPress). Le clic
 * qui suit un appui long, lui, est jete avant d'atteindre quoi que ce soit.
 */
export default function CycleStrip({ starts = [], prediction = null }) {
  const { t, locale } = useT()
  const [open, setOpen] = useState(false)
  const { holding, handlers, consumedClick } = useLongPress(() => setOpen((o) => !o), { capture: false })

  const ring = ringModel(starts, prediction)
  if (!ring || !prediction) return null

  const today = new Date()
  const away = daysBetween(today, prediction.nextStart)
  const phase = phaseOn(today, starts, prediction)
  const head = away === 0 ? t('cal.cycle_today') : away > 0 ? t('cal.cycle_in', { n: away }) : t('cal.cycle_late', { n: -away })
  const tag = localeTag(locale)
  const date = new Intl.DateTimeFormat(tag, { weekday: 'long', day: 'numeric', month: 'long' }).format(prediction.nextStart)
  const short = new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'short' })
  const span = (a, b) => (daysBetween(a, b) === 0 ? short.format(a) : short.formatRange ? short.formatRange(a, b) : `${short.format(a)} - ${short.format(b)}`)
  const more = open ? cycleDetails(starts, prediction, today) : null

  const label = (u) =>
    u.kind === 'ovulation' ? t('cal.cycle_ovulation') : u.kind === 'predicted' ? t('cycle.phase_predicted') : t(`cycle.phase_${u.kind}`)

  return (
    /* Une barre, pas une carte vide: l'anneau en 80, trois lignes, et le lien
       a droite des qu'il y a la place. A 1180 la premiere version faisait
       une carte pleine largeur avec trois lignes courtes et du vide.
         "the pop up over the calendar could be less big" */
    <section
      {...handlers}
      /* Apres un appui long, le relachement produit encore un clic: jete ici,
         en capture, avant le lien "Mon cycle" qui sinon partirait vers le
         profil sous le doigt qui voulait ouvrir la carte. */
      onClickCapture={(e) => {
        if (consumedClick()) {
          e.preventDefault()
          e.stopPropagation()
        }
      }}
      className={`lg select-none overflow-hidden p-3 transition-transform duration-200 ease-settle [-webkit-touch-callout:none] sm:p-4 ${
        holding ? 'scale-[0.98]' : ''
      }`}
      data-hook="cal-cycle-card"
      data-days={away}
      data-phase={phase ?? ''}
      data-open={open ? '' : undefined}
      data-holding={holding ? '' : undefined}
    >
      {/* Ce qui dit que l'appui a commence: une barre qui se remplit sur la
          duree exacte de l'appui (.hold-bar, index.css). `!absolute`, parce
          que .lg met `relative` a ses enfants directs. */}
      {holding && (
        <span aria-hidden="true" data-hook="cal-cycle-holding" className="hold-bar pointer-events-none !absolute inset-x-0 bottom-0 h-1 bg-mark" />
      )}

      <div className="flex items-center gap-3 sm:gap-4">
        <CycleRing model={ring} size={80} compact className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{t('cycle.title')}</p>
          <p className="text-safe text-body font-semibold text-ink">{head}</p>
          <p className="text-safe text-small text-muted">{t('cycle.expected_on', { date })}</p>
          {phase && (
            <p className="text-safe mt-1 flex items-start gap-2 text-small text-ink" data-hook="cal-cycle-care">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-pill ${PHASE_DOT[phase]}`} aria-hidden="true" />
              <span>
                <span className="font-semibold">{t(`cycle.phase_${phase}`)}.</span> {t(`cycle.care_${phase}`)}
              </span>
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link
              to="/profile"
              className="press inline-block text-small font-semibold text-ink underline decoration-1 underline-offset-2 sm:hidden"
              data-hook="cal-cycle-link"
            >
              {t('cycle.manage')}
            </Link>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls="cal-cycle-more"
              className="press inline-flex items-center gap-1 text-small font-semibold text-ink underline decoration-1 underline-offset-2"
              data-hook="cal-cycle-toggle"
            >
              {open ? t('cal.cycle_less') : t('cal.cycle_more')}
              <svg viewBox="0 0 24 24" aria-hidden="true" className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </div>
        </div>
        <Link
          to="/profile"
          className="goal-action press hidden shrink-0 sm:inline-flex"
          data-hook="cal-cycle-link-wide"
        >
          {t('cycle.manage')}
        </Link>
      </div>

      {more && (
        <div id="cal-cycle-more" data-hook="cal-cycle-more" className="animate-rise mt-4 border-t border-hairline pt-4">
          {more.missed > 0 && (
            <p className="text-safe mb-3 text-small font-semibold text-ink">{t('cycle.stale', { n: more.missed })}</p>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="eyebrow">{t('cal.cycle_upcoming')}</p>
              <ul className="mt-2 space-y-2" data-hook="cal-cycle-upcoming">
                {more.upcoming.map((u) => (
                  <li key={u.kind} className="flex items-start gap-2 text-small text-ink" data-kind={u.kind}>
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-pill ${PHASE_DOT[u.kind === 'ovulation' ? 'fertile' : u.kind]}`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0">
                      <span className="font-semibold">{label(u)}</span>
                      {' · '}
                      {span(u.from, u.to)}
                      {u.kind === 'predicted' && u.window ? `, ${t('cycle.window', { n: u.window })}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="eyebrow">{t('cal.cycle_average')}</p>
              <p className="mt-2 text-body font-semibold text-ink" data-hook="cal-cycle-average">
                {t('cal.cycle_days', { n: more.average.length })}
              </p>
              <p className="text-small text-muted">{t(`cycle.conf_${more.average.confidence}`)}</p>
              {more.day && (
                <p className="mt-1 text-small text-ink">
                  {t('cycle.day_word')} {more.day} {t('cycle.of_len', { n: more.average.length })}
                </p>
              )}
            </div>
          </div>

          {more.recent.length > 0 && (
            <div className="mt-5">
              <p className="eyebrow">{t('cal.cycle_recent')}</p>
              <ul className="mt-2 space-y-1.5" data-hook="cal-cycle-recent">
                {more.recent.map((r) => (
                  <li key={r.from.getTime()} className="flex items-start gap-2 text-small text-ink">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-pill ${PHASE_DOT.period}`} aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="font-semibold">{r.to ? span(r.from, r.to) : short.format(r.from)}</span>
                      {r.days ? ` · ${t('cal.cycle_days', { n: r.days })}` : ''}
                      {r.gap ? <span className="text-muted">{` · ${t('cycle.gap', { n: r.gap })}`}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="measure mt-5 text-small text-muted">
            {t('cycle.private_line')} {t('cycle.disclaimer')}
          </p>
        </div>
      )}
    </section>
  )
}
