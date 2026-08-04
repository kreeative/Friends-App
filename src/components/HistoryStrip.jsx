/**
 * Twelve weeks of check-ins at a glance.
 *
 * Amabile's progress principle: seeing accumulated small wins is the strongest
 * sustained motivator there is. So this shows what has been built up, not what
 * is overdue — and a missed week is a hollow square, not a red one. Guilt-
 * coloured UI makes people close the app, which is the opposite of the goal.
 */
export default function HistoryStrip({ rows, count = 12 }) {
  const cells = [...rows]
    .sort((a, b) => a.seq - b.seq)
    .slice(-count)

  const pad = Math.max(0, count - cells.length)

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: pad }).map((_, i) => (
        <span key={`pad-${i}`} className="h-6 flex-1 border border-white/[0.06]" />
      ))}
      {cells.map((c) => (
        <span
          key={c.cycle_id}
          title={`${c.status} · week ${c.seq + 1}`}
          className={
            'h-6 flex-1 border ' +
            (c.status === 'submitted'
              ? 'border-white bg-white'
              : c.status === 'away'
                ? 'border-white/30 bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(255,255,255,0.25)_2px,rgba(255,255,255,0.25)_4px)]'
                : c.status === 'pending'
                  ? 'border-dashed border-white/25'
                  : 'border-white/25')
          }
        />
      ))}
    </div>
  )
}
