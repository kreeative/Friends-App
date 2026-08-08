/**
 * Consistency maths.
 *
 * The headline number is a rate over a rolling window, never a chain. A bad
 * week moves it a few points; it cannot destroy anything, so there is no
 * moment where starting over looks more appealing than continuing.
 *
 * Declared-away cycles leave the denominator entirely. Being honest about an
 * exam week should cost nothing.
 */
export function completionRate(rows, windowSize = 14) {
  const closed = rows
    .filter((r) => r.status !== 'pending')
    .sort((a, b) => b.seq - a.seq)
    .slice(0, windowSize)

  const counted = closed.filter((r) => r.status !== 'away')
  const done = counted.filter((r) => r.status === 'submitted').length

  return {
    done,
    total: counted.length,
    away: closed.length - counted.length,
    pct: counted.length ? Math.round((done / counted.length) * 100) : null,
  }
}

/**
 * The same rate, computed at every point in time rather than once at the end.
 *
 * The headline figure answers "how am I doing". This answers "which way is it
 * going", which is the only question a chart exists for. Each point is the
 * rate over the `window` cycles ending there, a raw per-cycle series can
 * only ever be 0 or 100, so it draws as a square wave with no trend visible
 * in it at all.
 *
 * Ordered by date rather than by seq: seq restarts per group, so anyone in
 * two groups would otherwise have their history interleaved at random.
 */
export function rollingRate(rows, { window = 4, points = 12 } = {}) {
  const closed = rows
    .filter((r) => r.status !== 'pending')
    .sort((a, b) => new Date(a.opens_at) - new Date(b.opens_at))

  const series = []
  for (let i = 0; i < closed.length; i += 1) {
    const slice = closed.slice(Math.max(0, i - window + 1), i + 1)
    // Away cycles leave the denominator here exactly as they do above. A
    // window of nothing but declared absence has no rate to report at all.
    const counted = slice.filter((r) => r.status !== 'away')
    if (counted.length === 0) continue
    const done = counted.filter((r) => r.status === 'submitted').length
    series.push({ at: closed[i].opens_at, pct: Math.round((done / counted.length) * 100) })
  }

  return series.slice(-points)
}

/** Consecutive missed cycles, most recent first. Drives the quiet-member logic. */
export function consecutiveMisses(rows) {
  const ordered = rows
    .filter((r) => r.status !== 'pending')
    .sort((a, b) => b.seq - a.seq)

  let n = 0
  for (const row of ordered) {
    if (row.status === 'missed') n += 1
    else break
  }
  return n
}

/** Progress on a group goal: how much of the collective target is in. */
export function groupGoalProgress(goal, items, memberCount) {
  const target = (goal.target_per_cycle || 1) * Math.max(1, memberCount)
  const actual = items.reduce((sum, i) => sum + (i.count_done || 0), 0)
  return { actual, target, pct: target ? Math.min(100, Math.round((actual / target) * 100)) : 0 }
}
