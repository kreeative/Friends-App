/**
 * node src/lib/challenge.test.mjs
 *
 * Le defi 21 matins: le compteur de chacun, ses cases, et ce qui part au
 * moment de creer le groupe. Plus le lien d'invitation garde pendant
 * l'inscription (pendingJoin.js), qui est ce qui fait entrer les gens d'une
 * video dans le groupe.
 */
import { addDays, challengeDay, challengeTrack, completeMornings, dayKeyIn, daysBetween } from './challenge.js'
import { JOIN_KEY, JOIN_TTL_MS, cleanCode, forgetJoin, joinTarget, readJoin, rememberChallenge, rememberJoin } from './pendingJoin.js'
import { CHALLENGE, CHALLENGE_DAYS, CHALLENGE_ID, challengeGoals } from '../content/challenge.js'
import { readFileSync } from 'node:fs'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}
const eq = (name, a, b) => ok(name, JSON.stringify(a) === JSON.stringify(b), `got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`)

console.log('\nchallenge')

/* --- les jours ---------------------------------------------------------- */
eq('a date seen from Toronto in the evening is still that day', dayKeyIn('2026-10-16T02:30:00Z', 'America/Toronto'), '2026-10-15')
eq('and from UTC it is already the next', dayKeyIn('2026-10-16T02:30:00Z', 'UTC'), '2026-10-16')
eq('a broken time zone falls back to UTC', dayKeyIn('2026-10-16T02:30:00Z', 'Not/AZone'), '2026-10-16')
eq('an unreadable instant is nothing', dayKeyIn('nope', 'UTC'), null)
eq('days between, across the clocks going back', daysBetween('2026-10-31', '2026-11-02'), 2)
eq('add days across a month', addDays('2026-10-30', 3), '2026-11-02')

eq('the day you join is day 1', challengeDay({ joinedAt: '2026-10-15T13:00:00Z', now: '2026-10-15T23:00:00Z', tz: 'America/Toronto' }), 1)
eq('joining late at night in Toronto: still day 1 that night', challengeDay({ joinedAt: '2026-10-16T03:00:00Z', now: '2026-10-16T03:30:00Z', tz: 'America/Toronto' }), 1)
eq('the next local morning is day 2', challengeDay({ joinedAt: '2026-10-16T03:00:00Z', now: '2026-10-16T12:00:00Z', tz: 'America/Toronto' }), 2)
eq('three weeks on is day 22, past the end', challengeDay({ joinedAt: '2026-10-01T12:00:00Z', now: '2026-10-22T12:00:00Z', tz: 'UTC' }), 22)
eq('a clock behind the join never gives day 0', challengeDay({ joinedAt: '2026-10-15T12:00:00Z', now: '2026-10-14T12:00:00Z', tz: 'UTC' }), 1)

/* --- les cases ---------------------------------------------------------- */
{
  const tz = 'America/Toronto'
  /* Periods open at local midnight: 04:00Z in EDT. */
  const cycles = ['13', '14', '15', '16'].map((d) => ({ id: `c${d}`, opens_at: `2026-10-${d}T04:00:00Z` }))
  const checkins = [
    { id: 'k13', cycle_id: 'c13' },
    { id: 'k14', cycle_id: 'c14' },
    { id: 'k16', cycle_id: 'c16' },
  ]
  const items = [
    { checkin_id: 'k13', goal_id: 'a', outcome: 'done' },
    { checkin_id: 'k13', goal_id: 'b', outcome: 'done' },
    { checkin_id: 'k13', goal_id: 'b', outcome: 'done' },
    { checkin_id: 'k14', goal_id: 'a', outcome: 'partial' },
    { checkin_id: 'k14', goal_id: 'x', outcome: 'done' },
    { checkin_id: 'k16', goal_id: 'a', outcome: 'done' },
  ]
  const track = challengeTrack({
    joinedAt: '2026-10-13T15:00:00Z',
    now: '2026-10-16T14:00:00Z',
    tz,
    cycles,
    checkins,
    items,
    goalIds: ['a', 'b'],
  })
  eq('twenty-one squares', track.length, 21)
  eq('numbered from 1', [track[0].n, track[20].n], [1, 21])
  eq('day 1 has every goal done, counted once each', [track[0].state, track[0].done], ['done', 2])
  eq('day 2 is partial, and a goal outside the challenge does not count', [track[1].state, track[1].done], ['partial', 0])
  eq('day 3 had nothing', track[2].state, 'missed')
  eq('day 4 is today, half done', [track[3].state, track[3].done, track[3].total], ['today', 1, 2])
  eq('then the future', track[4].state, 'future')
  eq('one complete morning', completeMornings(track), 1)
  eq('dates run on from the join day', [track[0].date, track[3].date], ['2026-10-13', '2026-10-16'])

  const allToday = challengeTrack({
    joinedAt: '2026-10-16T12:00:00Z',
    now: '2026-10-16T14:00:00Z',
    tz,
    cycles,
    checkins,
    items: [...items, { checkin_id: 'k16', goal_id: 'b', outcome: 'done' }],
    goalIds: ['a', 'b'],
  })
  eq('finishing today turns today done', allToday[0].state, 'done')
  eq('no goals: nothing is ever complete', challengeTrack({ joinedAt: '2026-10-16T12:00:00Z', now: '2026-10-17T12:00:00Z', goalIds: [] })[0].state, 'missed')
  eq('no join date: no squares', challengeTrack({ joinedAt: null }), [])
}

/* --- ce qui part a la creation ----------------------------------------- */
eq('one challenge, the one the migration allows', CHALLENGE_ID, 'morning21')
eq('twenty-one mornings', CHALLENGE_DAYS, 21)
{
  const sql = readFileSync(new URL('../../supabase/76_challenge.sql', import.meta.url), 'utf8')
  ok('the migration names the same id', sql.includes("challenge in ('morning21')"))
  ok('the migration is ASCII, it travels through a clipboard', [...sql].every((c) => c.charCodeAt(0) < 128))
  ok('create_challenge exists and anon cannot run it', /create or replace function create_challenge/.test(sql) && /from anon/.test(sql))
  ok('goals go in paused, then active: no notification for each one', /'paused'/.test(sql) && /set status = 'active'/.test(sql))
  ok('order is kept with created_at', /e\.ord \* interval '1 millisecond'/.test(sql))
}
for (const loc of ['en', 'fr']) {
  const goals = challengeGoals(loc)
  eq(`${loc}: eight goals`, goals.length, 8)
  ok(`${loc}: each fits the goals column (1 to 200)`, goals.every((g) => g.commitment.trim().length >= 1 && g.commitment.length <= 200))
  ok(`${loc}: proof types the database accepts`, goals.every((g) => ['photo', 'link', 'text', 'none'].includes(g.proof_type)))
  ok(`${loc}: wake up first, water second`, /wake|lever/i.test(goals[0].commitment) && /water|eau/i.test(goals[1].commitment))
  ok(`${loc}: the mark is inside the title`, CHALLENGE[loc].page.title.includes(CHALLENGE[loc].page.mark))
  ok(`${loc}: the method is credited, the author not claimed`, /Hal Elrod/.test(CHALLENGE[loc].page.credit) && /affili/.test(CHALLENGE[loc].page.credit))
  ok(`${loc}: no em dash`, !JSON.stringify(CHALLENGE[loc]).includes('—'))
  ok(`${loc}: three steps`, CHALLENGE[loc].page.steps.length === 3)
}
ok('the challenge is not called Miracle Morning', !/miracle/i.test(CHALLENGE.en.name + CHALLENGE.fr.name + CHALLENGE.en.page.title + CHALLENGE.fr.page.title))
{
  /* Rien de personnel: pas d'heure de lever, pas de trajet, pas de bureau. */
  const all = JSON.stringify(CHALLENGE)
  ok('no clock times in the challenge', !/\b\d{1,2}[:h]\d{2}\b/.test(all))
  ok('no commute, office or class day', !/commute|trajet|bureau|office|class day|jour de cours/i.test(all))
  ok('French punctuation keeps its space on the line', !/ [?:]/.test(JSON.stringify(CHALLENGE.fr)))
}

/* --- le lien garde pendant l'inscription -------------------------------- */
const mem = () => {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }
}
eq('a code is uppercased and trimmed', cleanCode('  ab12cd '), 'AB12CD')
eq('too short is no code', cleanCode('ab1'), null)
eq('punctuation is no code', cleanCode('AB12CD"><script>'), null)
eq('null is no code', cleanCode(null), null)
{
  const s = mem()
  const t0 = 1_800_000_000_000
  eq('remembered', rememberJoin('ab12cd', s, t0), 'AB12CD')
  eq('read back', readJoin(s, t0 + 1000), { code: 'AB12CD' })
  eq('still there after the Google round trip, a minute later', readJoin(s, t0 + 60_000), { code: 'AB12CD' })
  eq('gone after two weeks', readJoin(s, t0 + JOIN_TTL_MS + 1), null)
  eq('a bad code is not remembered', rememberJoin('x', s, t0), null)
  forgetJoin(s)
  eq('forgotten', readJoin(s, t0), null)
  eq('a challenge to start', (rememberChallenge('morning21', s, t0), readJoin(s, t0)), { challenge: 'morning21' })
  eq('which opens the create form on it', joinTarget(readJoin(s, t0)), '/start?challenge=morning21')
  eq('a code has no form to open: it joins', joinTarget({ code: 'AB12CD' }), null)
  eq('an unknown challenge is refused', rememberChallenge('other', s, t0), null)
  s.setItem(JOIN_KEY, '{not json')
  eq('garbage in storage is nothing', readJoin(s, t0), null)
  s.setItem(JOIN_KEY, JSON.stringify({ code: 'AB12CD', at: t0 + 10 * 60_000 }))
  eq('a date from the future is nothing', readJoin(s, t0), null)
  s.setItem(JOIN_KEY, JSON.stringify({ code: 'drop table', at: t0 }))
  eq('a code that fails the shape is nothing', readJoin(s, t0), null)
  const broken = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') }, removeItem() { throw new Error('blocked') } }
  eq('blocked storage: remembering fails quietly', rememberJoin('AB12CD', broken, t0), null)
  eq('blocked storage: reading fails quietly', readJoin(broken, t0), null)
  forgetJoin(broken)
  ok('blocked storage: forgetting does not throw', true)
}

/* --- le cablage --------------------------------------------------------- */
{
  const read = (f) => readFileSync(new URL(f, import.meta.url), 'utf8')
  const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const app = code('../App.jsx')
  ok('signed out, /start keeps the code and opens sign-in', /path="start" element={<JoinLater \/>}/.test(app))
  ok('signed out, /defi and /challenge show the page', /path="defi" element={<Challenge \/>}/.test(app) && /path="challenge" element={<Challenge \/>}/.test(app))
  ok('during terms and setup, the link is kept for later', (app.match(/<JoinLater to="\/" \/>/g) ?? []).length === 6)
  ok('the auto join waits for terms and setup', app.indexOf("where === 'setup'") < app.indexOf('<AutoJoin pending'))
  ok('and only fires once the app or the welcome deck is next', /pending && \(where === 'welcome' \|\| where === 'app'\)/.test(app))
  ok('the code is forgotten before the call, so a refusal cannot loop', /forgetJoin\(browserStore\(\)\)[\s\S]{0,200}join_group/.test(app))
  ok('signed in, the page has its own route outside the shell', (app.match(/<Challenge bare \/>/g) ?? []).length === 4)

  const start = code('../pages/Start.jsx')
  ok('the create form calls create_challenge with the goals', /rpc\('create_challenge'/.test(start) && /p_goals: challengeGoals\(locale\)/.test(start))
  ok('a missing migration is named, not shown raw', /PGRST202/.test(start) && /start\.challenge_missing/.test(start))
  ok('arriving from the page ticks the box', /params\.get\('challenge'\) === CHALLENGE_ID/.test(start))

  const invite = code('../components/InviteSheet.jsx')
  ok('a challenge group invites to its page', /group\.challenge \? '\/defi' : '\/start'/.test(invite))

  const board = code('../pages/Board.jsx')
  ok('the strip sits on the board of a challenge group only', /group\.challenge && \(\s*<ChallengeStrip/.test(board))
  ok('check-in rows are read page by page', /\.range\(from, from \+ PAGE - 1\)/.test(board))
  ok('and their ids go in batches, not one long address', /ids\.slice\(i, i \+ ID_BATCH\)/.test(board) && /const ID_BATCH = 100/.test(board))
  ok('pages are ordered, so they cannot overlap', (board.match(/\.order\('id'\)/g) ?? []).length === 2)
  ok('no single request carries every check-in id any more', !/\.in\('checkin_id', ids\)/.test(board))

  const strip = code('../components/ChallengeStrip.jsx')
  ok('the strip counts my own check-ins only', /c\.user_id === user\?\.id/.test(strip))
  ok('each state has its own shape, not only a colour', ['done', 'partial', 'today', 'missed'].every((st) => strip.includes(`state === '${st}'`)) && /border-dashed/.test(strip))
  ok('and a name for a screen reader', /sr-only/.test(strip))

  const page = code('../pages/public/Challenge.jsx')
  ok('the page hooks its title for the ink probe', /data-hook="challenge-title"/.test(page))
  ok('the page buttons are large text on the pink', /text-\[1\.1875rem\] font-bold/.test(page))
  ok('signed out, the button keeps the code before sign-in', /rememberJoin\(code, browserStore\(\)\)[\s\S]{0,120}navigate\('\/signin'\)/.test(page))

  const signin = code('../pages/SignIn.jsx')
  ok('sign-in says where the person is going', /data-hook="signin-pending"/.test(signin))

  const i18n = read('../lib/i18n.jsx')
  const keys = [...new Set([...app, ...start, ...strip, ...page, ...signin].join('').match(/t\(['`](challenge|start\.challenge|start\.create_challenge|signin\.joining|signin\.challenge)[^'`]*/g) ?? [])]
  for (const k of ['challenge.day', 'challenge.finished', 'challenge.complete', 'challenge.track_label', 'challenge.bad_code', 'challenge.back', 'start.challenge_title', 'start.challenge_body', 'start.create_challenge', 'start.challenge_missing', 'signin.joining', 'signin.challenge', ...['done', 'partial', 'missed', 'today', 'future'].map((st) => `challenge.state_${st}`)]) {
    ok(`${k} in both languages`, (i18n.match(new RegExp(`'${k.replace('.', '\\.')}':`, 'g')) ?? []).length === 2)
  }
  ok('every key the code asks for was checked', keys.length > 0)
}

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
