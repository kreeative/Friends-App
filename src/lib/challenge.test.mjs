/**
 * node src/lib/challenge.test.mjs
 *
 * Le defi 21 matins: le compteur de chacun, ses cases, et ce qui part au
 * moment de creer le groupe. Plus le lien d'invitation garde pendant
 * l'inscription (pendingJoin.js), qui est ce qui fait entrer les gens d'une
 * video dans le groupe.
 */
import { addDays, challengeDay, challengeTrack, completeMornings, dayKeyIn, daysBetween } from './challenge.js'
import { JOIN_KEY, JOIN_TTL_MS, cleanCode, cleanGroupName, codeFromText, forgetJoin, invitePath, joinTarget, readJoin, rememberChallenge, rememberJoin, signinPath } from './pendingJoin.js'
import { cleanCode as apiCleanCode, escapeHtml, previewHtml, previewLocale, previewText } from '../../api/invite-preview.js'
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
  ok('signed out, joining keeps the code and the group name, then signs in', /rememberJoin\(code, browserStore\(\), Date\.now\(\), name\)[\s\S]{0,60}navigate\(signinPath\(code\)\)/.test(inv))
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

  /* Dans TikTok, l'ecran de connexion s'ouvre sur le bouton du code par e-mail.
     Il disait "Envoyez-moi un code", vouvoye sous "Connecte-toi pour
     rejoindre": l'app tutoie partout, ce bouton compris. */
  const fr = i18n.slice(i18n.indexOf('\n  fr: {'))
  const vous = [...fr.matchAll(/'((?:signin|invite)\.[a-z_]+)': '([^']*)'/g)].filter(([, , v]) => /(^|[\s(])([A-Z\u00C0-\u00DD][a-z\u00E0-\u00FF]+ez\b|vous\b|votre\b|vos\b)/.test(v)).map(([, k]) => k)
  ok(`the French sign-in and invitation say tu, not vous (${vous.join(', ') || 'none'})`, vous.length === 0)
  ok('the sign-in code button says tu', /'signin\.send_code': 'Envoie-moi un code'/.test(fr))

  /* Migration 78. Le groupe du defi avait des periodes finies avant que
     quiconque y entre: la personne arrivee le 15 avait 4 jours rates des son
     premier jour, et tick() l'aurait relancee a minuit. */
  const sql78 = read('../../supabase/78_late_joiners.sql')
  ok('migration 78 is ASCII, it travels through a clipboard', [...sql78].every((c) => c.charCodeAt(0) < 128))
  ok('migration 78 drops nothing and writes no row', !/\b(drop|delete|update|insert|truncate|revoke)\b/i.test(sql78.replace(/--.*$/gm, '')))
  ok('a period that closed before you joined is not one you missed', /gm\.joined_at < c\.closes_at/.test(sql78.slice(sql78.indexOf('function missed_cycle'), sql78.indexOf('create or replace view'))))
  ok('nor a row of your history, unless you checked in on it', /where gm\.joined_at < c\.closes_at\s+or ci\.id is not null;/.test(sql78))
  ok('the view keeps its columns and security_invoker', /with \(security_invoker = on\)/.test(sql78) && /end as status,\s+ci\.mood\s+from cycles c/.test(sql78))
  const ctx = code('../context/GroupContext.jsx')
  ok('the roster brings joined_at, for the standing', /select\('user_id, role, nudge_order, joined_at, profiles\(/.test(ctx))
}

/* --- un lien de groupe qui mene quelque part ---------------------------
   "The link is not intelligent [...] you have to enter the code manually."
   Le tableau n'affichait que le code, le champ du code coupait un lien colle
   a six caracteres, et l'apercu dans une messagerie etait celui de l'accueil. */
console.log('\nintelligent links')
{
  eq('a bare code is a code', codeFromText(' 530826 '), '530826')
  eq('the invitation link gives its code', codeFromText('https://richandfriends.xyz/join/530826'), '530826')
  eq('the French spelling too', codeFromText('richandfriends.xyz/rejoindre/ab12cd'), 'AB12CD')
  eq('the old ?join= links too', codeFromText('https://richandfriends.xyz/defi?join=530826&utm=tt'), '530826')
  eq('and the whole shared message', codeFromText('Rejoins mon groupe Défi 21 matins sur Rich & Friends : https://richandfriends.xyz/join/530826'), '530826')
  eq('a code glued to more letters is not cut out of them', codeFromText('https://x.y/join/ABCDEFGHIJKLMNOP'), null)
  eq('a sentence without a link is nothing', codeFromText('rejoins mon groupe'), null)
  eq('nothing is nothing', codeFromText(null), null)
  eq('sign-in carries the code', signinPath('530826'), '/signin?join=530826')
  eq('and nothing when there is none', signinPath('??'), '/signin')

  const read = (f) => readFileSync(new URL(f, import.meta.url), 'utf8')
  const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const board = code('../pages/Board.jsx')
  ok('alone in a group, the board shows the link button, not only the code', /<InviteButton group=\{group\}/.test(board) && /data-hook="board-invite"/.test(board) && /board\.invite_code/.test(board))
  ok('with others, the board still has an invite action', /data-hook="board-invite-open"/.test(board) && /<InviteSheet group=\{group\} open=\{inviting\}/.test(board))
  const sheet = code('../components/InviteSheet.jsx')
  ok('the board button and the sheet share the same link the same way', /export function useInvite\(group\)/.test(sheet) && (sheet.match(/useInvite\(group\)/g) ?? []).length === 3)
  ok('white on the pink is large text on both', (sheet.match(/btn-primary press[^"]*text-\[1\.1875rem\] font-bold/g) ?? []).length === 2)
  const start = code('../pages/Start.jsx')
  ok('the code field takes a pasted link', /onChange=\{\(e\) => setCode\(codeFromText\(e\.target\.value\)/.test(start) && !/maxLength=\{6\}/.test(start))
  ok('and joins with the code inside it', /p_code: codeFromText\(code\) \?\? code\.trim\(\)/.test(start))
  ok('the invitation sends people to sign in with the code in the address', /navigate\(signinPath\(code\)\)/.test(code('../pages/Invite.jsx')))
  ok('sign-in remembers a code from its address', /new URLSearchParams\(window\.location\.search\)\.get\('join'\)/.test(code('../pages/SignIn.jsx')))

  /* L'apercu des messageries. */
  eq('the API cleans codes like the app', [apiCleanCode(' ab12cd '), apiCleanCode('a'), apiCleanCode('<x>')], ['AB12CD', null, null])
  eq('French unless the robot asks for English first', [previewLocale('en-GB,en;q=0.9'), previewLocale('fr-CA'), previewLocale(undefined)], ['en', 'fr', 'fr'])
  const fr = previewText({ name: 'Défi 21 matins', members: 2, challenge: 'morning21' }, ['Me lever à l’heure prévue', 'Boire un grand verre d’eau'], 'fr')
  eq('a challenge preview names the group', fr.title, 'Rejoins « Défi 21 matins » sur Rich & Friends')
  ok('and says who is in, for how long, and what is asked', /^2 personnes déjà dedans · un point par jour pendant 21 jours\. Chaque matin : Me lever/.test(fr.description), fr.description)
  const priv = previewText({ name: null, members: 3, challenge: null }, [], 'fr')
  eq('a private group is an invitation without its name', priv.title, 'Une invitation à rejoindre un groupe sur Rich & Friends')
  ok('with the count and the idea', /^3 personnes déjà dedans\. Un point par jour/.test(priv.description))
  eq('a dead code says so', previewText(null, [], 'en').title, 'This invitation link no longer works')
  const long = previewText({ name: 'X', members: 9, challenge: 'morning21' }, Array.from({ length: 20 }, (_, i) => `Objectif numero ${i} assez long`), 'fr')
  ok('a long list is cut to 300 characters', long.description.length <= 300 && long.description.endsWith('…'))
  const html = previewHtml({ code: 'AB12CD', title: 'Rejoins « <script> » & co', description: 'a "b" \'c\'', locale: 'fr' })
  ok('what comes from the database is escaped', html.includes('Rejoins « &lt;script&gt; » &amp; co') && !html.includes('<script> »') && html.includes('a &quot;b&quot; &#39;c&#39;'))
  ok('the preview points at the invitation and is not indexed', html.includes('<meta property="og:url" content="https://richandfriends.xyz/join/AB12CD" />') && html.includes('<meta name="robots" content="noindex" />'))
  ok('a person who lands on it is sent into the app', html.includes('location.replace("/start?join=AB12CD")'))
  eq('escapeHtml covers the five', escapeHtml(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;')

  const vercel = JSON.parse(read('../../vercel.json'))
  const rw = vercel.rewrites
  const at = (src) => rw.findIndex((r) => r.source === src)
  ok('robots on /join and /rejoindre go to the preview, before the app catches everything',
     at('/join/:code') >= 0 && at('/rejoindre/:code') >= 0 && at('/join/:code') < at('/((?!api/).*)') && at('/rejoindre/:code') < at('/((?!api/).*)')
       && rw[at('/join/:code')].destination === '/api/invite-preview?code=:code')
  const bots = new RegExp(rw[at('/join/:code')].has[0].value)
  const ua = {
    imessage: 'facebookexternalhit/1.1 Facebot Twitterbot/1.0',
    whatsapp: 'WhatsApp/2.23.20.0 A',
    telegram: 'TelegramBot (like TwitterBot)',
    discord: 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
    safari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.3.12.235',
    tiktok: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_34.1.0 JsSdk/2.0',
    facebookApp: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/450.0.0.0]',
    snapchat: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Snapchat/12.80.0.40',
    chrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  }
  eq('preview robots are recognised', ['imessage', 'whatsapp', 'telegram', 'discord'].map((k) => bots.test(ua[k])), [true, true, true, true])
  eq('people, in a browser or inside an app, are not', ['safari', 'instagram', 'tiktok', 'facebookApp', 'snapchat', 'chrome'].map((k) => bots.test(ua[k])), [false, false, false, false, false, false])

  /* La question du partage, 79. */
  const share = code('../components/ShareChoices.jsx')
  ok('the name is a line, not a box', /data-hook="share-name"/.test(share) && !/data-hook="share-alias"/.test(share) && !/share-\$\{key\}[\s\S]*'name'/.test(share.slice(share.indexOf('const rows'))))
  ok('photo and mood are asked; email is not', /\['photo', photo, setPhoto/.test(share) && /\['mood', mood, setMood/.test(share) && !/'email'/.test(share) && /p_email: false/.test(share))
  ok('proof photos only where the group asks for photos', /g\.proof_type === 'photo'/.test(share) && /p_photos: asksProofs \? proofs : photo/.test(share))
  ok('the save button is large text on the pink', /btn-primary press mt-3 text-\[1\.1875rem\] font-bold/.test(share))
  const sql79 = read('../../supabase/79_name_always.sql')
  const rules79 = sql79.replace(/--.*$/gm, '')
  ok('migration 79 is ASCII', [...sql79].every((c) => c.charCodeAt(0) < 128))
  ok('the name is set when you join and follows a rename', /before insert on group_members/.test(rules79) && /after update of display_name on profiles/.test(rules79))
  ok('set_group_sharing ignores a pseudo and never shares an email', /set alias = real_name/.test(rules79) && /email\s+= false/.test(rules79) && !/pseudo/.test(rules79.slice(rules79.indexOf('function set_group_sharing'))))
  ok('a name copy fits the 30 characters of 75', (rules79.match(/left\(trim\([a-z.]*display_name\), 30\)/g) ?? []).length >= 4)
  const i18n = read('./i18n.jsx')
  for (const k of ['share.name_sub', 'share.name_always', 'share.photo', 'share.photo_sub', 'board.invite_code', 'board.invite_short']) {
    ok(`${k} in both languages`, (i18n.match(new RegExp(`'${k.replace('.', '\\.')}':`, 'g')) ?? []).length === 2)
  }
  ok('no pseudo or email strings left behind', !/'share\.(alias_label|alias_ph|alias_required|email)':/.test(i18n))
}

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
