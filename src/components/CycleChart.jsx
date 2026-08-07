import { useT } from '../lib/i18n'

/**
 * Consistency as capsule bars, one per cycle, oldest to newest.
 *
 * The dashboard used to say "11/14" and stop. A number is a fact; a shape is
 * a trend, and the thing worth knowing is whether the last month went better
 * or worse than the one before it — which a single figure cannot say.
 *
 * A check-in is not a quantity, so the bars do not encode one. They encode a
 * state, at three heights: in, away, missed. Away is drawn at mid height and
 * hatched rather than short, because it is explicitly not a failure and
 * drawing it like one would be the app arguing against its own rule.
 *
 * Nothing here communicates by colour alone — the heights differ, the hatch
 * differs, and the legend names all three.
 */
const BAR = {
  submitted: { h: '100%', cls: 'bg-green' },
  away: {
    h: '52%',
    cls: 'bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,rgb(var(--c-muted)/0.5)_3px,rgb(var(--c-muted)/0.5)_6px)] ring-1 ring-inset ring-ink/10',
  },
  pending: { h: '24%', cls: 'border border-dashed border-ink/25' },
  missed: { h: '24%', cls: 'bg-ink/[0.10]' },
}

export default function CycleChart({ rows, count = 12, className = '' }) {
  const { t } = useT()
  const cells = [...rows].sort((a, b) => a.seq - b.seq).slice(-count)
  const pad = Math.max(0, count - cells.length)

  return (
    <div className={className}>
      <div className="flex h-24 items-end gap-1.5" role="img" aria-label={t('me.last12')}>
        {Array.from({ length: pad }).map((_, i) => (
          <span key={`p${i}`} className="h-[24%] flex-1 rounded-pill bg-ink/[0.05]" />
        ))}
        {cells.map((c) => {
          const b = BAR[c.status] ?? BAR.missed
          return (
            <span
              key={c.cycle_id}
              title={`#${c.seq + 1} · ${c.status}`}
              style={{ height: b.h }}
              className={`flex-1 rounded-pill transition-[height] duration-500 ease-settle ${b.cls}`}
            />
          )
        })}
      </div>
    </div>
  )
}
