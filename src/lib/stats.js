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

/**
 * A group's rows collapsed to one per cycle.
 *
 * member_cycle_status is one row per member per cycle, which is right for a
 * rate and wrong for a chart: the bars are one per period, so handing them the
 * raw group rows drew the last twelve *rows*, four days of a three-person
 * group, as if they were twelve days.
 *
 * The rule is the one the board already uses at the top of the page: a day is
 * in when everybody who was expected is in. Nobody expected means the whole
 * group declared itself away, which is not a failure and is not drawn as one.
 */
export function groupCycles(rows) {
  const byCycle = new Map()

  for (const r of rows) {
    const cur = byCycle.get(r.cycle_id) ?? {
      cycle_id: r.cycle_id,
      seq: r.seq,
      opens_at: r.opens_at,
      submitted: 0,
      away: 0,
      missed: 0,
      pending: 0,
    }
    cur[r.status] = (cur[r.status] ?? 0) + 1
    byCycle.set(r.cycle_id, cur)
  }

  return [...byCycle.values()].map((c) => {
    const expected = c.submitted + c.missed + c.pending
    const status =
      expected === 0
        ? 'away'
        : c.pending === expected
          ? 'pending'
          : c.missed > 0
            ? 'missed'
            : 'submitted'
    return { cycle_id: c.cycle_id, seq: c.seq, opens_at: c.opens_at, status }
  })
}

/**
 * How many cycles in a row, counting back from the most recent settled one.
 *
 * A declared absence neither extends the streak nor breaks it. That is the
 * same rule the rate uses, and it is the only one that does not punish
 * honesty: saying "I am away next week" must never cost more than saying
 * nothing and taking the miss.
 *
 * Pending cycles are dropped before counting, so the day you are currently in
 * does not read as a break at nine in the morning.
 */
export function currentStreak(rows) {
  const ordered = rows
    .filter((r) => r.status !== 'pending')
    .sort((a, b) => b.seq - a.seq)

  let n = 0
  for (const row of ordered) {
    if (row.status === 'submitted') n += 1
    else if (row.status === 'away') continue
    else break
  }
  return n
}

/**
 * The share of recorded goals that were actually done.
 *
 * Deliberately separate from the completion rate. That one answers "did they
 * turn up", which is about the habit of reporting; this one answers "did the
 * thing happen", which is about the work. A group can be at 100% on the first
 * and 40% on the second, and knowing that is the whole point of asking twice.
 *
 * `partial` is counted as its own thing rather than folded into either side.
 * Half a point would be a number nobody can check, and calling it a failure is
 * wrong when the goal was three of something and two of them happened.
 */
export function goalSuccessRate(items) {
  const done = items.filter((i) => i.outcome === 'done').length
  const partial = items.filter((i) => i.outcome === 'partial').length
  const total = items.length

  return {
    done,
    partial,
    total,
    pct: total ? Math.round((done / total) * 100) : null,
  }
}

/** Progress on a group goal: how much of the collective target is in. */
export function groupGoalProgress(goal, items, memberCount) {
  const target = (goal.target_per_cycle || 1) * Math.max(1, memberCount)
  const actual = items.reduce((sum, i) => sum + (i.count_done || 0), 0)
  return { actual, target, pct: target ? Math.min(100, Math.round((actual / target) * 100)) : 0 }
}
