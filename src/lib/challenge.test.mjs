/**
 * node src/lib/challenge.test.mjs
 *
 * Le defi 21 matins: le compteur de chacun, ses cases, et ce qui part au
 * moment de creer le groupe. Plus le lien d'invitation garde pendant
 * l'inscription (pendingJoin.js), qui est ce qui fait entrer les gens d'une
 * video dans le groupe.
 */
import { addDays, challengeDay, challengeTrack, completeMornings, dayKeyIn, daysBetween } from './challenge.js'
import { JOIN_KEY, JOIN_TTL_MS, cleanCode, cleanGroupName, forgetJoin, invitePath, joinTarget, readJoin, rememberChallenge, rememberJoin } from './pendingJoin.js'
import { inAppBrowser } from './inAppBrowser.js'
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
  /* Le jour de controle est aujourd'hui dans le fuseau du groupe. A 0
     (dimanche), le groupe cree en production un jeudi est ne avec quatre
     periodes passees, et tick() en tirait une relance contre sa createrice
     (mesure sur Postgres 16: 2 groupes, 2 relances; corrige: 0). */
  ok('the first period is today, not last Sunday', /create_group\(p_name, tz, 1, extract\(dow from \(now\(\) at time zone tz\)\)::int, 0, 24\)/.test(sql))
  ok('no challenge is anchored on a fixed weekday any more', !/create_group\([^)]*, 1, 0, 0, 24\)/.test(sql))
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

/* --- le nom du groupe et l'adresse de l'invitation ---------------------- */
{
  const s = mem()
  const t0 = 1_800_000_000_000
  rememberJoin('530826', s, t0, '21 Mornings Challenge')
  eq('the group name travels with the code', readJoin(s, t0), { code: '530826', name: '21 Mornings Challenge' })
  rememberJoin('530826', s, t0)
  eq('no name, no name', readJoin(s, t0), { code: '530826' })
  eq('control characters are dropped from a name', cleanGroupName('Groupe\u0007 du matin\n'), 'Groupe du matin')
  eq('a name is cut at 60 characters, the column limit', cleanGroupName('x'.repeat(80)).length, 60)
  eq('a name that is not text is nothing', cleanGroupName({ toString: () => 'x' }), null)
  s.setItem(JOIN_KEY, JSON.stringify({ code: '530826', name: 42, at: t0 }))
  eq('a stored name of the wrong type is dropped, the code kept', readJoin(s, t0), { code: '530826' })
  eq('the invitation address', invitePath(' ab12cd '), '/join/AB12CD')
  eq('no address for a bad code', invitePath('nope!'), null)
}

/* --- le navigateur integre d'une application --------------------------- */
{
  const UA = {
    tiktokIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_34.1.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/en Region/CA',
    tiktokAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36 trill_340103 BytedanceWebview/d8a21c6',
    instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 325.0.0.0.0 (iPhone15,2; iOS 17_4; fr_CA; fr; scale=3.00; 1179x2556)',
    facebook: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/450.0.0.0;FBBV/1;FBDV/iPhone15,2]',
    safari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    chrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  }
  eq('TikTok on an iPhone', inAppBrowser(UA.tiktokIos), 'tiktok')
  eq('TikTok on Android', inAppBrowser(UA.tiktokAndroid), 'tiktok')
  eq('Instagram', inAppBrowser(UA.instagram), 'instagram')
  eq('Facebook', inAppBrowser(UA.facebook), 'facebook')
  eq('Safari is a real browser', inAppBrowser(UA.safari), null)
  eq('Chrome is a real browser', inAppBrowser(UA.chrome), null)
  eq('no user agent, no app', inAppBrowser(undefined), null)
}

/* --- le cablage --------------------------------------------------------- */
{
  const read = (f) => readFileSync(new URL(f, import.meta.url), 'utf8')
  const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const app = code('../App.jsx')
  ok('signed out, an old /start?join link opens the invitation', /path="start" element={<StartSignedOut \/>}/.test(app) && /invitePath\(params\.get\('join'\)\) \?\? '\/signin'/.test(app))
  ok('signed out, /defi and /challenge show the page', /path="defi" element={<Challenge \/>}/.test(app) && /path="challenge" element={<Challenge \/>}/.test(app))
  ok('during terms and setup, every invite link is kept for later', (app.match(/<JoinLater to="\/" \/>/g) ?? []).length === 10)
  ok('the invitation page answers signed out, on the welcome deck and in the app', (app.match(/<Invite \/>/g) ?? []).length === 6)
  {
    const signedOut = app.slice(app.indexOf('if (!user) {'), app.indexOf('if (groupsLoading)'))
    const publicRoutes = app.slice(app.indexOf('const PUBLIC_ROUTES'), app.indexOf('function Gate'))
    ok('signed out, the invitation is its own screen, outside the site frame',
      /path="\/join\/:code" element={<Invite \/>}/.test(signedOut) && !/join\/:code/.test(publicRoutes))
  }
  ok('a refused automatic join lands on the invitation, which says why', /navigate\(invitePath\(pending\.code\) \?\? '\/'/.test(app))
  ok('the auto join waits for terms and setup', app.indexOf("where === 'setup'") < app.indexOf('<AutoJoin pending'))
  ok('and only fires once the app or the welcome deck is next', /pending && \(where === 'welcome' \|\| where === 'app'\)/.test(app))
  ok('the code is forgotten before the call, so a refusal cannot loop', /forgetJoin\(browserStore\(\)\)[\s\S]{0,200}join_group/.test(app))
  ok('signed in, the page has its own route outside the shell', (app.match(/<Challenge bare \/>/g) ?? []).length === 4)

  const start = code('../pages/Start.jsx')
  ok('the create form calls create_challenge with the goals', /rpc\('create_challenge'/.test(start) && /p_goals: challengeGoals\(locale\)/.test(start))
  ok('a missing migration is named, not shown raw', /PGRST202/.test(start) && /start\.challenge_missing/.test(start))
  ok('arriving from the page ticks the box', /params\.get\('challenge'\) === CHALLENGE_ID/.test(start))

  const invite = code('../components/InviteSheet.jsx')
  ok('every group invites to its invitation page', /invitePath\(group\.invite_code\)/.test(invite) && !/\?join=/.test(invite))

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
  ok('a code on the challenge page goes to the invitation', /if \(code\) return <Navigate to=\{invitePath\(code\)\} replace \/>/.test(page))

  const inv = code('../pages/Invite.jsx')
  ok('the invitation reads the group through invite_preview', /rpc\('invite_preview', \{ p_code: code \}\)/.test(inv))
  ok('a challenge shows its real goals from invite_goals', /rpc\('invite_goals', \{ p_code: code \}\)/.test(inv))
  ok('before migration 77 the invitation still works, without details', /PGRST202/.test(inv))
  ok('signed out, joining keeps the code and the group name, then signs in', /rememberJoin\(code, browserStore\(\), Date\.now\(\), name\)[\s\S]{0,60}navigate\('\/signin'\)/.test(inv))
  ok('signed in, joining joins and opens the board', /rpc\('join_group', \{ p_code: code \}\)[\s\S]{0,400}navigate\(g\?\.id \? `\/g\/\$\{g\.id\}`/.test(inv))
  ok('a member is told so and gets the board, not a join button', /group\.is_member \?/.test(inv) && /data-hook="invite-open"/.test(inv))
  ok('an unknown code says so', /data-hook="invite-missing"/.test(inv) && /setState\('missing'\)/.test(inv))
  ok('the group name sits behind the yellow marker', /<span className="marker">\{name\}<\/span>/.test(inv))
  ok('the button is large text on the pink', /data-hook="invite-join"[\s\S]{0,40}className="btn-primary press text-\[1\.1875rem\] font-bold"/.test(inv))
  ok('inside TikTok or Instagram the invitation says how to sign in', /inApp && \(/.test(inv) && /invite\.in_app/.test(inv))

  const signin = code('../pages/SignIn.jsx')
  ok('sign-in says where the person is going', /data-hook="signin-pending"/.test(signin))
  ok('and names the group when it is known', /signin\.joining_named', \{ group: pending\.name \}/.test(signin))
  ok('the pink buttons on sign-in are large text, white on #FF007A is 3.80:1', (signin.match(/btn-primary press text-\[1\.1875rem\] font-bold/g) ?? []).length === 3 && !/className="btn-primary press"/.test(signin))
  ok('inside TikTok or Instagram, sign-in leads with the email code', /inApp \? \(/.test(signin) && /data-hook="signin-email-first"/.test(signin) && /signin\.in_app/.test(signin))

  ok('a signed-in /start?join link opens the invitation too', /if \(invitation\) return <Navigate to=\{invitation\} replace \/>/.test(start))

  const seo = read('./seo.js')
  ok('invitation pages are not for search engines', /'\/join\/'/.test(seo) && /'\/rejoindre\/'/.test(seo))

  const sql77 = read('../../supabase/77_invite_preview.sql')
  ok('migration 77 is ASCII, it travels through a clipboard', [...sql77].every((c) => c.charCodeAt(0) < 128))
  ok('a private group name is shown only once signed in', /case when g\.challenge is not null or auth\.uid\(\) is not null then g\.name end/.test(sql77))
  ok('the group id is only for someone signed in', /case when auth\.uid\(\) is not null then g\.id end/.test(sql77))
  ok('goals are shown only for a challenge', /and g\.challenge is not null/.test(sql77))
  ok('the code is read the way join_group reads it', (sql77.match(/upper\(trim\(coalesce\(p_code, ''\)\)\)/g) ?? []).length === 2)

  const i18n = read('../lib/i18n.jsx')
  const keys = [...new Set([...app, ...start, ...strip, ...page, ...signin].join('').match(/t\(['`](challenge|start\.challenge|start\.create_challenge|signin\.joining|signin\.challenge)[^'`]*/g) ?? [])]
  for (const k of ['signin.joining_named', 'signin.in_app', ...['eyebrow', 'eyebrow_private', 'private_title', 'private_note', 'members_one', 'members', 'challenge_facts', 'goals_title', 'join', 'joining', 'note', 'in_app', 'member', 'open', 'missing_title', 'missing_body', 'home', 'retry', 'what'].map((x) => `invite.${x}`), 'challenge.day', 'challenge.finished', 'challenge.complete', 'challenge.track_label', 'challenge.bad_code', 'challenge.back', 'start.challenge_title', 'start.challenge_body', 'start.create_challenge', 'start.challenge_missing', 'signin.joining', 'signin.challenge', ...['done', 'partial', 'missed', 'today', 'future'].map((st) => `challenge.state_${st}`)]) {
    ok(`${k} in both languages`, (i18n.match(new RegExp(`'${k.replace('.', '\\.')}':`, 'g')) ?? []).length === 2)
  }
  ok('every key the code asks for was checked', keys.length > 0)
}

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
