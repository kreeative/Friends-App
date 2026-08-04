/**
 * Consistency maths.
 *
 * The headline number is a rate over a rolling window, never a chain. A bad
 * week moves it a few points; it cannot destroy anything, so there is no
 * moment where starting over looks more appealing than continuing.
 *
 * Declared-away cycles leave the denominator entirely — being honest about an
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

/** Consecutive missed cycles, most recent first — drives the quiet-member logic. */
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
