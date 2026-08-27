import { MAX_SPAN_DAYS, PERIODS, firstName, groupRate, memberRates, windowDays, rank } from './completion.js'
let pass = 0, fail = 0
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  ok ? pass++ : fail++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`)
}

const wed = new Date(2026, 7, 12)   // Wednesday 12 August 2026

// ---- the windows -----------------------------------------------------------
eq('six periods', PERIODS.map((p) => p.id), ['day', 'week', 'month', 'quarter', 'half', 'all'])
eq('a day is today',      windowDays('day', wed).length, 1)
eq('a week is seven',     windowDays('week', wed).length, 7)
eq('six months is 180',   windowDays('half', wed).length, 180)
eq('today is last',       windowDays('week', wed)[6].getDate(), 12)
eq('and six days back',   windowDays('week', wed)[0].getDate(), 6)
eq('an unknown period falls back to the week', windowDays('nope', wed).length, 7)

// Crossing a month boundary is the case that breaks a naive subtraction.
eq('a window crosses months', windowDays('week', new Date(2026, 8, 2))[0].getMonth(), 7)

// ---- the open-ended window -------------------------------------------------
eq('all time spans from the date given', windowDays('all', wed, '2026-08-06T00:00:00').length, 7)
eq('all time includes both ends',        windowDays('all', wed, '2026-08-12T00:00:00').length, 1)
eq('all time with nothing is one day',   windowDays('all', wed, null).length, 1)
eq('all time with rubbish is one day',   windowDays('all', wed, 'not a date').length, 1)
// A goal dated in the future cannot open a negative window.
eq('all time never runs backwards', windowDays('all', wed, '2027-01-01T00:00:00').length, 1)
eq('all time is bounded', windowDays('all', wed, '2001-01-01T00:00:00').length, MAX_SPAN_DAYS)

// ---- the shape of the maths ------------------------------------------------
const members = [
  { user_id: 'a', profile: { display_name: 'Anne-Kelly Nguema' } },
  { user_id: 'b', profile: { display_name: 'Rich' } },
]

/* One cycle per day for the week ending Wednesday, which is what the app
   actually creates: since migration 18 a cycle is a day. */
const cycles = windowDays('week', wed).map((d, i) => ({
  id: `c${i}`,
  opens_at: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 6).toISOString(),
}))

const daily = {
  id: 'g1',
  kind: 'personal',
  owner_id: 'a',
  status: 'active',
  cadence: 'recurring',
  target_per_cycle: 2,
  created_at: '2026-01-01',
}

const base = { members, goals: [daily], cycles, period: 'week', today: wed }

eq('nothing done is zero of fourteen', memberRates(base)[0], {
  id: 'a', profile: members[0].profile, done: 0, target: 14, pct: 0,
})

// A member with no goals has not failed at anything.
eq('no goals means no percentage', memberRates(base)[1], {
  id: 'b', profile: members[1].profile, done: 0, target: 0, pct: null,
})

const checkins = cycles.map((c, i) => ({ id: `k${i}`, cycle_id: c.id, user_id: 'a' }))
const item = (i, count) => ({ checkin_id: `k${i}`, goal_id: 'g1', count_done: count })

eq('half the week done', memberRates({
  ...base,
  checkins,
  items: [item(0, 2), item(1, 2), item(2, 2), item(3, 1)],
}).find((r) => r.id === 'a').pct, 50)

eq('every day done is a hundred', memberRates({
  ...base,
  checkins,
  items: cycles.map((_, i) => item(i, 2)),
}).find((r) => r.id === 'a').pct, 100)

// ---- the ways a count can lie ----------------------------------------------
eq('a count over the target is capped', memberRates({
  ...base, checkins, items: [item(0, 99)],
}).find((r) => r.id === 'a').done, 2)

eq('an outcome with no count means the target', memberRates({
  ...base, checkins, items: [{ checkin_id: 'k0', goal_id: 'g1', outcome: 'done' }],
}).find((r) => r.id === 'a').done, 2)

eq('a partial with no count is worth one', memberRates({
  ...base, checkins, items: [{ checkin_id: 'k0', goal_id: 'g1', outcome: 'partial' }],
}).find((r) => r.id === 'a').done, 1)

eq('a missed outcome is worth nothing', memberRates({
  ...base, checkins, items: [{ checkin_id: 'k0', goal_id: 'g1', outcome: 'missed' }],
}).find((r) => r.id === 'a').done, 0)

// ---- what falls outside the window -----------------------------------------
eq('a check-in on an older cycle does not count', memberRates({
  ...base,
  cycles: [...cycles, { id: 'old', opens_at: new Date(2026, 6, 1, 6).toISOString() }],
  checkins: [...checkins, { id: 'kold', cycle_id: 'old', user_id: 'a' }],
  items: [{ checkin_id: 'kold', goal_id: 'g1', count_done: 2 }],
}).find((r) => r.id === 'a').done, 0)

eq('an item for a stranger is ignored', memberRates({
  ...base,
  checkins: [{ id: 'kx', cycle_id: 'c0', user_id: 'zzz' }],
  items: [{ checkin_id: 'kx', goal_id: 'g1', count_done: 2 }],
}).find((r) => r.id === 'a').done, 0)

// ---- which goals are in the denominator ------------------------------------
eq('a paused goal is in neither side', memberRates({
  ...base, goals: [{ ...daily, status: 'paused' }], checkins, items: [item(0, 2)],
}).find((r) => r.id === 'a'), {
  id: 'a', profile: members[0].profile, done: 0, target: 0, pct: null,
})

eq('a goal born mid-window only counts from then', memberRates({
  ...base, goals: [{ ...daily, created_at: '2026-08-11' }],
}).find((r) => r.id === 'a').target, 4)

const twiceAWeek = { ...daily, id: 'g2', target_per_cycle: 1, active_days: [1, 3] }
eq('monday and wednesday is two occurrences', memberRates({
  ...base, goals: [twiceAWeek],
}).find((r) => r.id === 'a').target, 2)

const shared = { ...daily, id: 'g3', kind: 'group', owner_id: 'a', target_per_cycle: 1 }
eq('a group goal lands on everybody', memberRates({ ...base, goals: [shared] }).map((r) => r.target), [7, 7])

// A one-off with a far deadline is not yet asking to be ticked, so it is not
// yet something anybody is behind on.
eq('a distant one-off is scheduled nowhere', memberRates({
  ...base,
  goals: [{ ...daily, cadence: 'once', due_on: '2026-12-25' }],
}).find((r) => r.id === 'a').target, 0)

// All time reaches back to the oldest goal, so a goal born on 11 August has
// a two-day denominator on the 12th however far back the account goes.
eq('all time starts at the oldest goal', memberRates({
  ...base, period: 'all', goals: [{ ...daily, created_at: '2026-08-11' }],
}).find((r) => r.id === 'a').target, 4)

// ---- the group's own figure ------------------------------------------------
eq('the group total is the two sums', groupRate([
  { done: 3, target: 6 }, { done: 5, target: 6 },
]), { done: 8, target: 12, pct: 67 })
eq('an empty group has no rate', groupRate([]), { done: 0, target: 0, pct: null })
eq('nothing scheduled has no rate', groupRate([{ done: 0, target: 0 }]), { done: 0, target: 0, pct: null })

// ---- names ------------------------------------------------------------------
eq('a first name is the first word', firstName({ display_name: 'Meliane Marie-sarah Lasm' }), 'Meliane')
eq('a single name survives',        firstName({ display_name: 'Rich' }), 'Rich')
eq('padding is trimmed',            firstName({ display_name: '  Anne-Kelly  Nguema ' }), 'Anne-Kelly')
eq('nobody is empty',               firstName(null), '')
eq('no name is empty',              firstName({}), '')


/* ------------------------------------------------------------------ rank --- */
{
  const p = (name) => ({ display_name: name })
  const row = (name, done, target) => ({
    id: name, profile: p(name), done, target,
    pct: target > 0 ? Math.round((done / target) * 100) : null,
  })

  /* The screenshot that prompted this: one person on 7 %, everybody else on 0,
     and the 7 % sitting third in roster order. */
  const board = rank([
    row('Kee', 0, 28), row('usernamnh', 0, 7), row('Aya', 1, 14),
    row('Harrisso', 0, 7), row('Aline', 0, 7),
  ])
  eq('the one who did something is first', board[0].profile.display_name, 'Aya')
  eq('and carries position 1', board[0].position, 1)
  eq('everybody else is behind', board.slice(1).every((r) => r.pct === 0), true)

  /* pct before raw count: a finished small week beats an unfinished big one. */
  const fair = rank([row('Big', 10, 40), row('Small', 1, 1)])
  eq('one out of one beats ten out of forty', fair[0].profile.display_name, 'Small')
  eq('because the share is what is compared', fair[0].pct, 100)

  /* done breaks a tie on pct, so carrying more is worth something. */
  const load = rank([row('Light', 1, 1), row('Heavy', 8, 8)])
  eq('between two perfect weeks the bigger load is first', load[0].profile.display_name, 'Heavy')
  eq('and they share the position', load[0].position, 1)
  eq('the lighter one is second', load[1].position, 2)

  /* A true tie shares a place, and the next is third, not second. */
  const tied = rank([row('A', 5, 10), row('B', 5, 10), row('C', 1, 10)])
  eq('both halves are first', tied[0].position, 1)
  eq('really both', tied[1].position, 1)
  eq('and both are marked as tied', tied[0].tied && tied[1].tied, true)
  eq('the next is third, not second', tied[2].position, 3)
  eq('and is not marked tied', tied[2].tied, false)

  /* NOBODY WITH NOTHING SCHEDULED IS RANKED LAST. They are not ranked at all. */
  const idle = rank([row('None', 0, 0), row('Tried', 0, 7)])
  eq('a person with a figure comes first', idle[0].profile.display_name, 'Tried')
  eq('the one with nothing scheduled has no position', idle[1].position, null)
  eq('and is not called zero', idle[1].pct, null)

  /* Stability: identical rows must not swap on re-sort. */
  const same = [row('Zoe', 3, 10), row('Ana', 3, 10)]
  eq('ties are ordered by name, not by luck', rank(same)[0].profile.display_name, 'Ana')
  eq('and again the same way', rank([...same].reverse())[0].profile.display_name, 'Ana')

  eq('an empty roster ranks to nothing', rank([]).length, 0)
  eq('and no argument at all does not throw', rank().length, 0)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
