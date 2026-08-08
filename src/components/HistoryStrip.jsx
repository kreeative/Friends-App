import { useT } from '../lib/i18n'

/**
 * Twelve weeks of check-ins at a glance.
 *
 * Amabile's progress principle: seeing accumulated small wins is the strongest
 * sustained motivator there is. So this shows what has been built up, not what
 * is overdue, a done week is a filled green block and a missed one is a quiet
 * empty slot, never a red one. Guilt-coloured UI makes people close the app,
 * which is the opposite of the goal.
 *
 * Every state also has a word for it in the legend beside this, so the strip
 * never communicates by colour alone.
 */
export default function HistoryStrip({ rows, count = 12 }) {
  const cells = [...rows].sort((a, b) => a.seq - b.seq).slice(-count)
  const pad = Math.max(0, count - cells.length)

  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: pad }).map((_, i) => (
        <span key={`pad-${i}`} className="h-7 flex-1 rounded-inner bg-ink/[0.04]" />
      ))}

      {cells.map((c) => (
        <span
          key={c.cycle_id}
          title={`${c.status} · ${c.seq + 1}`}
          className={
            'h-7 flex-1 rounded-inner ' +
            (c.status === 'submitted'
              ? 'bg-green'
              : c.status === 'away'
                ? 'bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,rgb(var(--c-muted)/0.45)_3px,rgb(var(--c-muted)/0.45)_6px)]'
                : c.status === 'pending'
                  ? 'border border-dashed border-hairline'
                  : 'bg-ink/[0.08]')
          }
        />
      ))}
    </div>
  )
}

export function HistoryLegend() {
  const { t } = useT()
  return (
    <div className="mt-3 flex flex-wrap gap-4 text-small text-muted">
      <span className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-[4px] bg-green" />
        {t('me.legend_in')}
      </span>
      <span className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-[4px] bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgb(var(--c-muted)/0.45)_2px,rgb(var(--c-muted)/0.45)_4px)]" />
        {t('me.legend_away')}
      </span>
      <span className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-[4px] bg-ink/[0.08]" />
        {t('me.legend_missed')}
      </span>
    </div>
  )
}
