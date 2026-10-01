import { useT } from '../lib/i18n'
import { ESTIMATES, arcPath, dayAngle, polar } from '../lib/cycleRing'

/**
 * L'anneau du cycle, dessine. La geometrie est dans src/lib/cycleRing.js.
 *
 * DEUX COULEURS ET UNE FORME, LES MEMES QUE LE CALENDRIER.
 *
 * Les pastilles du calendrier ont fixe la regle (voir PHASE_DOT dans
 * Calendar.jsx): les regles en --c-negative, les phases douces en --c-mark,
 * et dans chaque paire le FAIT est plein et l'ESTIMATION est un anneau. Ici
 * c'est la meme chose a l'echelle d'un cercle: trait plein pour les regles
 * enregistrees, trait pointille pour ce qui est prevu. Un cycle lu en gris
 * se lit encore (1.4.1), et le tiroir et la grille ne peuvent pas dire deux
 * couleurs differentes pour le meme jour.
 *
 * Les couleurs passent par style={{ stroke }} et pas par l'attribut: un
 * attribut de presentation SVG ne resout pas var().
 *
 * Le point du jour est blanc cercle d'encre, sur l'anneau, au milieu du jour.
 * Il arrive avec un petit rebond (ring-pop), l'anneau avec un fondu
 * (ring-in); les deux s'arretent sous prefers-reduced-motion.
 */

/* Les memes chaines entieres que Calendar.jsx, parce que Tailwind lit le
   texte source et ne construit pas `bg-${token}`. */
export const PHASE_DOT = {
  period: 'bg-negative',
  predicted: 'border-2 border-negative bg-transparent',
  pms: 'bg-mark',
  fertile: 'border-2 border-mark bg-transparent',
  today: 'border-2 border-ink bg-surface',
}

const STROKE = {
  period: 'rgb(var(--c-negative))',
  predicted: 'rgb(var(--c-negative))',
  pms: 'rgb(var(--c-mark))',
  fertile: 'rgb(var(--c-mark))',
}

const LEGEND_ORDER = ['period', 'fertile', 'pms', 'predicted']

export default function CycleRing({ model, size = 220, compact = false, legend = false, className = '' }) {
  const { t } = useT()
  if (!model) return null
  const { length, day, marker, segments } = model
  const C = 100
  const R = 82
  const W = compact ? 11 : 13
  const dot = polar(C, C, R, dayAngle(marker, length))
  const kinds = new Set(segments.map((s) => s.kind))
  const aria = t('cycle.ring_aria', { n: day, len: length })

  return (
    <div className={`flex flex-col items-center ${className}`} data-hook="cycle-ring" data-day={day} data-length={length}>
      <div className="ring-in relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 200 200" role="img" aria-label={aria} className="absolute inset-0 h-full w-full">
          <circle cx={C} cy={C} r={R} fill="none" strokeWidth={W} style={{ stroke: 'rgb(var(--c-ink) / 0.08)' }} />
          {segments.map((s) => (
            <path
              key={`${s.kind}-${s.from}`}
              d={arcPath(C, C, R, s.from, s.to, length)}
              fill="none"
              strokeWidth={W}
              strokeLinecap={ESTIMATES.has(s.kind) ? 'butt' : 'round'}
              strokeDasharray={ESTIMATES.has(s.kind) ? '3.5 4.5' : undefined}
              data-segment={s.kind}
              style={{ stroke: STROKE[s.kind] }}
            />
          ))}
          <circle
            className="ring-marker"
            cx={dot.x}
            cy={dot.y}
            r={compact ? 6 : 7.5}
            strokeWidth={compact ? 2.4 : 3}
            style={{ fill: 'rgb(var(--c-surface))', stroke: 'rgb(var(--c-ink))' }}
            data-hook="cycle-marker"
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center" aria-hidden="true">
          <div>
            <span className={`block font-semibold uppercase tracking-[0.06em] text-muted ${compact ? 'text-label' : 'text-label'}`}>
              {t('cycle.day_word')}
            </span>
            <span className={`block font-semibold leading-none text-ink ${compact ? 'text-h1' : 'text-metric'}`}>{day}</span>
            <span className={`block text-muted ${compact ? 'text-label' : 'text-small'}`}>{t('cycle.of_len', { n: length })}</span>
          </div>
        </div>
      </div>

      {legend && (
        <>
          <ul className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1.5" data-hook="cycle-legend">
            {LEGEND_ORDER.filter((k) => kinds.has(k)).map((k) => (
              <li key={k} className="flex items-center gap-1.5 text-small text-ink">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-pill ${PHASE_DOT[k]}`} aria-hidden="true" />
                {t(`cycle.phase_${k}`)}
              </li>
            ))}
            <li className="flex items-center gap-1.5 text-small text-ink">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-pill ${PHASE_DOT.today}`} aria-hidden="true" />
              {t('cycle.today_label')}
            </li>
          </ul>
          <p className="mt-1.5 text-label text-muted">{t('cycle.legend_note')}</p>
        </>
      )}
    </div>
  )
}
