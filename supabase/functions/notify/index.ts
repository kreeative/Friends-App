/**
 * Scheduled sender. The piece a static site cannot provide.
 *
 * A Netlify-hosted bundle only runs when someone opens it, and the person the
 * app most needs to reach is the one who has stopped opening it. So the two
 * outbound messages live here, on a schedule, instead of in the client.
 *
 * The ceiling is one email per kind per person per cycle and it is enforced by
 * the database, not by this code: every send first claims a row in
 * notifications_log, whose unique (user_id, cycle_id, kind) constraint makes a
 * duplicate physically impossible even if this function runs twice.
 *
 * A claim is GIVEN BACK when the send does not happen. Taking it first is what
 * makes the ceiling real; keeping it after a failure made the ceiling into a
 * trap, where one refused send cost somebody their only message of the cycle
 * for good. See release().
 *
 *   digest  . A few hours before the window opens: what you committed to
 *   nudge   . A day after somebody goes quiet, addressed TO them. If a friend
 *             volunteered in the app it is sent in that friend's name, which
 *             is the version that has a chance of working
 *   birthday. Three days before a friend's birthday, addressed to everybody
 *             else, because on the day itself it is too late to do anything
 *             but send a message
 *
 * Deploy:  supabase functions deploy notify --no-verify-jwt
 * Secrets: supabase secrets set RESEND_API_KEY=... MAIL_FROM="Friends <hi@yourdomain>"
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { type Block, layout, plain } from './template.ts'

const SITE = Deno.env.get('SITE_URL') ?? 'https://richandfriends.xyz'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const RESEND_KEY = Deno.env.get('RESEND_API_KEY')
const MAIL_FROM = Deno.env.get('MAIL_FROM') ?? 'Friends <onboarding@resend.dev>'

/**
 * THE WORDS, IN BOTH LANGUAGES.
 *
 * These two messages were English only. The app has been bilingual since it
 * shipped, but the language lived in localStorage and this function runs with
 * nobody's browser attached, so it had nothing to read and wrote to everybody
 * in English. On a product whose own survey is 91 % Ivorian, the single
 * message sent to somebody who has gone quiet was arriving in a language they
 * may not read.
 *
 * profiles.locale (migration 46) is what fixed that. It is nullable, so a
 * profile that has never been seen by the client falls back rather than
 * failing, and `fr` is the fallback rather than `en` because that is what most
 * of the people this app is for actually speak.
 *
 * The copy is here rather than in template.ts because template.ts is layout:
 * it knows about tables and preheaders and dark mode, and it should not also
 * be the place two languages are kept in step.
 */
type Loc = 'fr' | 'en'
const localeOf = (raw: unknown): Loc => (raw === 'en' ? 'en' : 'fr')

const COPY = {
  /**
   * DU VRAI FRANCAIS, AVEC LES ACCENTS ET LES APOSTROPHES.
   *
   * Ce bloc etait en ASCII pur, et rendu dans une boite de reception ca donnait
   * "C est une question", "Ouvre l application", "Il n y a pas de retard",
   * "Envoye une fois". Ce n'est pas une contrainte technique qui produisait ca :
   * l'apostrophe est de l'ASCII, elle sautait seulement parce que les chaines
   * etaient entre guillemets simples et que personne ne voulait les echapper.
   * Le resultat ressemblait a du spam mal traduit, dans le seul message que
   * l'application envoie a quelqu'un qui ne l'ouvre plus.
   *
   * La regle ASCII du depot vise le SQL colle dans l'editeur Supabase, ou un
   * octet abime donne "invalid byte sequence" et une erreur qui designe la
   * mauvaise ligne. Ici c'est du TypeScript : un accent abime s'affiche mal,
   * il ne casse rien, et le fichier transporte deja des caracteres accentues.
   *
   * Les guillemets francais sont voulus. Le corps cite un bouton de
   * l'application, et « ... » evite d'echapper des guillemets droits a
   * l'interieur d'une chaine qui en est deja entouree.
   */
  fr: {
    digestSubject: (g: string) => `Le point ouvre ce soir. ${g}`,
    digestTitle: 'Le point ouvre ce soir',
    digestPre: (g: string, n: number) =>
      `${g} · ${n} chose${n === 1 ? '' : 's'} à regarder, environ une minute.`,
    digestLead: 'Ce que tu as dit que tu ferais :',
    digestCta: 'Faire le point',
    digestTail: 'Moins d’une minute. Rien à rattraper si tu le manques.',

    /* SANS PERSONNE À NOMMER. Personne n’a encore touché « Je m’en occupe »,
       donc le message ne peut pas prétendre que quelqu’un demande de tes
       nouvelles : ce serait inventer un ami inquiet pour faire revenir
       quelqu’un. Il pose la question lui-même, ce qui reste vrai. */
    nudgeSubject: (g: string) => `Tout va bien ? ${g}`,
    nudgeTitle: 'Tout va bien ?',
    nudgePre: (g: string) => `Personne ne t’a vu dans ${g} depuis deux semaines.`,
    nudgeLead: (g: string) => `Ça fait deux semaines qu’on ne te voit pas dans ${g}.`,
    /* « Quand tu es prête » est parti d’ici : un accord féminin dans un message
       envoyé à tout le monde se trompe une fois sur deux. */
    nudgeBody:
      'C’est une question, pas un reproche. Ouvre l’application et touche « Je suis toujours là » : ça met en pause tout ce qui traîne et te demande une seule chose. Il n’y a pas de retard à combler et rien à expliquer.',
    nudgeCta: 'Je suis toujours là',
    nudgeFoot: (g: string) => `Envoyé une fois, parce que tu es dans ${g}. Il n’y en aura pas de deuxième.`,

    /* AVEC QUELQU’UN À NOMMER. Quelqu’un a vraiment touché « Je m’en occupe »
       dans le groupe, donc le nom est un fait et pas une tournure. C’est la
       version qui a une chance de marcher : ce qui ramène une personne qui a
       arrêté d’ouvrir une application, c’est un ami, pas une notification. */
    nudgeFromSubject: (who: string) => `${who} veut de tes nouvelles`,
    nudgeFromTitle: (who: string) => `${who} veut de tes nouvelles`,
    nudgeFromLead: (who: string, g: string) =>
      `${who} se demande comment tu vas. Ça fait deux semaines qu’on ne te voit pas dans ${g}.`,

    birthdaySubject: (n: number, first: string) =>
      n === 1 ? `L’anniversaire de ${first}, dans trois jours` : `${n} anniversaires dans trois jours`,
    birthdayTitle: (n: number) =>
      n === 1 ? 'Un anniversaire dans trois jours' : `${n} anniversaires dans trois jours`,
    birthdayPre: (n: number) =>
      n === 1 ? 'Trois jours pour y penser.' : `${n} personnes à qui penser, dans trois jours.`,
    birthdayLead: 'Trois jours, c’est encore le temps de faire quelque chose.',
    birthdayNote:
      'Le jour même il ne reste que le message, et il arrive avec tous les autres. Trois jours avant, on peut encore réserver, commander, écrire quelque chose qui se lit. Ceci est le rappel, pas le geste.',
    birthdayCta: 'Ouvrir le groupe',
    birthdayFoot: (g: string) => `Envoyé une fois par anniversaire, parce que tu es dans ${g}.`,

    smallPrint:
      'Au plus un message de chaque sorte par cycle. Les rappels d’objectif se coupent objectif par objectif, dans l’application.',
  },
  en: {
    digestSubject: (g: string) => `Check-in opens tonight. ${g}`,
    digestTitle: 'Check-in opens tonight',
    digestPre: (g: string, n: number) =>
      `${g} · ${n} thing${n === 1 ? '' : 's'} to look at, about a minute.`,
    digestLead: 'What you said you would do:',
    digestCta: 'Check in',
    digestTail: 'Takes under a minute. Nothing to catch up on if you miss it.',
    nudgeSubject: (g: string) => `Everything all right? ${g}`,
    nudgeTitle: 'Everything all right?',
    nudgePre: (g: string) => `Nobody has seen you in ${g} for two weeks.`,
    nudgeLead: (g: string) => `Nobody has seen you in ${g} for a couple of weeks.`,
    nudgeBody:
      'It is a question, not a complaint. Open the app and tap "I am still in": it parks everything old and asks for one thing. There is no backlog to clear and nothing to explain.',
    nudgeCta: 'I am still in',
    nudgeFoot: (g: string) => `Sent once, because you are in ${g}. There is no second one.`,

    nudgeFromSubject: (who: string) => `${who} is asking after you`,
    nudgeFromTitle: (who: string) => `${who} is asking after you`,
    nudgeFromLead: (who: string, g: string) =>
      `${who} wants to know how you are. Nobody has seen you in ${g} for a couple of weeks.`,

    birthdaySubject: (n: number, first: string) =>
      n === 1 ? `${first}'s birthday, in three days` : `${n} birthdays in three days`,
    birthdayTitle: (n: number) =>
      n === 1 ? 'A birthday in three days' : `${n} birthdays in three days`,
    birthdayPre: (n: number) =>
      n === 1 ? 'Three days to think of something.' : `${n} people to think of, three days out.`,
    birthdayLead: 'Three days is still enough time to do something.',
    birthdayNote:
      'On the day there is only the message left, and it arrives with everyone else’s. Three days out you can still book something, order something, write something worth reading. This is the reminder, not the gesture.',
    birthdayCta: 'Open the group',
    birthdayFoot: (g: string) => `Sent once per birthday, because you are in ${g}.`,

    smallPrint:
      'At most one message of each kind per cycle. Goal reminders can be switched off per goal, in the app.',
  },
} as const

/**
 * Where to write, and in which language.
 *
 * Two reads rather than one because the address lives in auth.users and the
 * language in public.profiles, and there is no join across that boundary from
 * here. Returns null for the whole thing when there is no address, since a
 * language with nowhere to send it is not worth a second query.
 */
async function recipient(userId: string): Promise<{ to: string; loc: Loc } | null> {
  const { data } = await supabase.auth.admin.getUserById(userId)
  const to = data?.user?.email
  if (!to) return null

  const { data: prof } = await supabase
    .from('profiles')
    .select('locale')
    .eq('id', userId)
    .maybeSingle()

  return { to, loc: localeOf(prof?.locale) }
}

/**
 * Both parts, always. A message with an HTML part and no text alternative
 * scores badly with spam filters and is unreadable in a text-only client, and
 * the text part is also what shows if the HTML fails to render.
 */
async function send(
  to: string,
  subject: string,
  { title, preheader, blocks, footnote, loc }: {
    title: string
    preheader: string
    blocks: Block[]
    footnote?: string
    /* The shell has words of its own. Without this they were English on every
       message, including the French ones. */
    loc: Loc
  },
) {
  const smallPrint = COPY[loc].smallPrint
  const html = layout({ title, preheader, blocks, footnote, smallPrint })
  const text = plain(title, blocks, footnote)

  /**
   * NO KEY IS A CONFIGURATION FAULT, NOT A SUCCESS.
   *
   * This returned true here, so a deployment with RESEND_API_KEY unset looked
   * from the outside exactly like one that worked: rows claimed, {"ok":true}
   * returned, and not one message sent. Because the claim is what the ceiling
   * is made of, every person it touched became permanently unmailable for
   * that cycle. One unset secret, silently, forever.
   *
   * It is still a dry run, which is right for running this locally. It is
   * just no longer a lie about having sent something, and the caller releases
   * the claim so the moment the key appears, everything retries.
   */
  if (!RESEND_KEY) {
    console.log('[dry-run]', to, subject, `${html.length} bytes html`)
    return 'dry-run' as const
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: MAIL_FROM, to, subject, html, text }),
  })
  if (!res.ok) {
    /* Read once. The body is a stream, and a second read throws, which would
       turn a reportable send failure into an unhandled exception. */
    const why = await res.text().catch(() => '')
    console.error('send failed', res.status, why.slice(0, 400))
    return 'failed' as const
  }
  return 'sent' as const
}

/**
 * THE THIRD KIND WAS MISSING FROM THIS TYPE.
 *
 * It said 'digest' | 'nudge' while sendBirthdays passed 'birthday', which is a
 * type error, and Supabase type-checks an Edge Function when it deploys. So
 * every deploy since birthdays were added had something to complain about,
 * and a function that does not deploy is indistinguishable from one that
 * deploys and sends nothing.
 */
type Kind = 'digest' | 'nudge' | 'birthday'

/** Claim the right to send. Returns false if this message already went out. */
async function claim(userId: string, cycleId: string, kind: Kind) {
  const { error } = await supabase
    .from('notifications_log')
    .insert({ user_id: userId, cycle_id: cycleId, kind })
  return !error
}

/**
 * Give the claim back, when the message did not actually go.
 *
 * The claim is taken BEFORE the send, and that ordering is right: it is what
 * makes a duplicate physically impossible even if this function runs twice at
 * once. What was missing is the other half. A send that fails left its row
 * behind, so the unique constraint then refused every retry, and one bad
 * minute at Resend or one unverified sending domain cost somebody their only
 * message of the cycle, permanently and with nothing written down.
 *
 * Releasing narrows the guarantee from "at most once, ever" to "at most once
 * per successful send", which is the guarantee actually wanted. The window
 * where two runs could overlap is the length of one HTTP call, and losing that
 * race sends one duplicate; not releasing loses the message every time.
 */
async function release(userId: string, cycleId: string, kind: Kind) {
  const { error } = await supabase
    .from('notifications_log')
    .delete()
    .eq('user_id', userId)
    .eq('cycle_id', cycleId)
    .eq('kind', kind)
  if (error) console.error('release failed', kind, error.message)
}

/**
 * What this run did, returned in the response body.
 *
 * net._http_response is the only window into this function from the SQL
 * editor, and it was showing {"ok":true} whether the run sent four messages or
 * silently sent none. Counting them is the difference between "the pipeline is
 * fine, nobody was due" and "it tried and Resend refused", which are the two
 * answers somebody debugging this actually needs to tell apart.
 */
const tally = { digest: 0, nudge: 0, birthday: 0, failed: 0, dryRun: 0 }

/** Record the outcome, and hand the claim back if nothing was sent. */
async function settle(
  result: 'sent' | 'failed' | 'dry-run',
  kind: Kind,
  userId: string,
  cycleId: string,
) {
  if (result === 'sent') {
    tally[kind] += 1
    return
  }
  tally[result === 'failed' ? 'failed' : 'dryRun'] += 1
  await release(userId, cycleId, kind)
}

async function sendDigests() {
  // Cycles opening in the next three hours.
  const { data: cycles } = await supabase
    .from('cycles')
    .select('id, group_id, opens_at, closes_at, groups(name)')
    .eq('state', 'upcoming')
    .gt('opens_at', new Date().toISOString())
    .lt('opens_at', new Date(Date.now() + 3 * 3600_000).toISOString())

  for (const cycle of cycles ?? []) {
    const { data: members } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', cycle.group_id)

    for (const m of members ?? []) {
      const { data: goals } = await supabase
        .from('goals')
        .select('commitment, target_per_cycle, cadence, trigger_when, trigger_where, remind')
        .eq('group_id', cycle.group_id)
        .eq('status', 'active')
        .or(`owner_id.eq.${m.user_id},kind.eq.group`)

      // `remind` is per goal and opt-out. A muted goal should not be the
      // reason an email goes out at all, so filter before deciding to send.
      const listed = (goals ?? []).filter((g: any) => g.remind !== false)
      if (!listed.length) continue
      if (!(await claim(m.user_id, cycle.id, 'digest'))) continue

      const who = await recipient(m.user_id)
      if (!who) continue
      const c = COPY[who.loc]

      /**
       * The trigger goes in the email.
       *
       * The app has no idea where anyone is and is never going to have one.
       * So the "when and where" on a goal is a sentence you wrote to
       * yourself, and the only way it can do any work is for something to
       * read it back to you shortly before the moment it describes. This
       * message is that something. Without it the field was a note nobody
       * ever saw again, which is presumably why it looked like tracking.
       */
      const items = listed.map((g: any) => ({
        title: `${g.commitment}${g.cadence === 'recurring' ? ` · ${g.target_per_cycle}×` : ''}`,
        note: [g.trigger_when, g.trigger_where].filter(Boolean).join(' · ') || undefined,
      }))

      const name = (cycle as any).groups?.name ?? (who.loc === 'fr' ? 'ton groupe' : 'your group')

      const outcome = await send(who.to, c.digestSubject(name), {
        title: c.digestTitle,
        // Shown next to the subject in the inbox. Without one, clients scrape
        // the first text in the message, which would be the logo's alt text.
        preheader: c.digestPre(name, items.length),
        blocks: [
          { kind: 'lead', text: c.digestLead },
          { kind: 'list', items },
          { kind: 'button', label: c.digestCta, href: `${SITE}/g/${cycle.group_id}/checkin` },
          { kind: 'text', text: c.digestTail },
        ],
        loc: who.loc,
      })
      await settle(outcome, 'digest', m.user_id, cycle.id)
    }
  }
}

/**
 * How long the group gets before the app writes instead.
 *
 * The component that shows these cards says it plainly: the one thing that
 * reliably reaches somebody who has stopped opening an app is a message from a
 * friend, not another notification. So the friends go first. tick() raises the
 * nudge, the card appears for everybody except the quiet person, and this waits
 * a day to see whether anyone taps "I'll check on them".
 *
 * If somebody does, the email can name them, and that is a completely
 * different message: a person is asking after you, rather than software
 * noticing you are gone. If nobody does, the app asks the question itself, and
 * it asks as itself rather than inventing a concerned friend.
 *
 * A day, matching the fallback rotation in tick() that assigns an unclaimed
 * nudge after the same interval. Two clocks measuring the same patience should
 * not disagree.
 */
const GROUP_HEAD_START_HOURS = 24

async function sendNudges() {
  // One message to the person who went quiet. Never a second.
  const { data: nudges } = await supabase
    .from('nudges')
    .select('id, cycle_id, subject_id, group_id, claimed_by, created_at, groups(name)')
    .in('state', ['pending', 'claimed'])

  for (const n of nudges ?? []) {
    /* Not yet. Nobody has volunteered and the card has not been up long
       enough to say nobody is going to. Claiming the log row here would burn
       the one send on the weakest version of the message. */
    const old = Date.parse((n as any).created_at) < Date.now() - GROUP_HEAD_START_HOURS * 3600_000
    if (!n.claimed_by && !old) continue

    if (!(await claim(n.subject_id, n.cycle_id, 'nudge'))) continue

    const who = await recipient(n.subject_id)
    if (!who) continue
    const c = COPY[who.loc]

    const name = (n as any).groups?.name ?? (who.loc === 'fr' ? 'ton groupe' : 'your group')

    /**
     * The name of whoever volunteered, and only if they really did.
     *
     * claimed_by is somebody pressing a button, so it is a fact. assigned_to
     * is the rotation in tick() handing the card to whoever is next, which is
     * the app's decision and not that person's, so it is NOT usable here:
     * "Fatim is asking after you" when Fatim has done nothing is the app
     * fabricating concern to get somebody to come back. A missing profile
     * falls back to the unnamed version for the same reason.
     */
    let from: string | null = null
    if (n.claimed_by) {
      const { data: p } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', n.claimed_by)
        .maybeSingle()
      from = p?.display_name?.trim() || null
    }

    /* Deliberately the quiet one: no button colour shouting, no count of what
       was missed, no streak language. The whole design of this message is
       that it must not read as a debt collector. */
    const outcome = await send(who.to, from ? c.nudgeFromSubject(from) : c.nudgeSubject(name), {
      title: from ? c.nudgeFromTitle(from) : c.nudgeTitle,
      preheader: c.nudgePre(name),
      blocks: [
        { kind: 'lead', text: from ? c.nudgeFromLead(from, name) : c.nudgeLead(name) },
        { kind: 'text', text: c.nudgeBody },
        /* /profile, not /me. Both still serve the page, but /profile is the
           canonical address now and a link in an email outlives the deploy
           that renamed it. */
        { kind: 'button', label: c.nudgeCta, href: `${SITE}/profile` },
      ],
      footnote: c.nudgeFoot(name),
      loc: who.loc,
    })
    await settle(outcome, 'nudge', n.subject_id, n.cycle_id)
  }
}

/**
 * Birthdays, three days out.
 *
 * WHY THREE DAYS AND NOT ON THE DAY.
 *
 * The same argument BirthdayBanner makes on screen. On the morning of, the
 * only thing left is a message, and it lands in a pile of identical ones. Three
 * days is the difference between remembering and being able to do something
 * about it: a table can still be booked, a thing can still arrive, a paragraph
 * can still be written by somebody who is not in a hurry.
 *
 * The in-app banner starts a week out and counts down, because a banner costs
 * nothing to look past. An email is not free, so it fires once, on one day.
 *
 * WHY ONE MESSAGE FOR EVERYBODY WHOSE BIRTHDAY IT IS.
 *
 * The ceiling is one row per recipient per cycle per kind, so two friends
 * sharing a date would otherwise mean the second one silently never sends.
 * Listing them is both the fix and the better message, and it is the shape the
 * digest already uses for goals.
 */
const BIRTHDAY_LEAD_DAYS = 3

/**
 * The month and day it will be in `tz`, `ahead` days from now.
 *
 * Resolve the local calendar date first, then do the arithmetic on it in UTC.
 * Adding 3 * 86400000 to an instant and reading it back in a timezone crosses
 * DST wrong twice a year, and this is the kind of bug that produces one wrong
 * email in March and none anybody can reproduce in June.
 */
function monthDayAhead(tz: string, ahead: number): { month: number; day: number } {
  let iso: string
  try {
    iso = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
  } catch {
    // A group carrying a timezone Deno does not know should not stop every
    // other group's birthdays from going out.
    iso = new Date().toISOString().slice(0, 10)
  }
  const [y, m, d] = iso.split('-').map(Number)
  const at = new Date(Date.UTC(y, m - 1, d) + ahead * 86400_000)
  return { month: at.getUTCMonth() + 1, day: at.getUTCDate() }
}

/* profiles.birthday is a date, so it arrives as "1998-04-12" and the month and
   day are already right there. Parsing it into a Date would reinterpret it in
   whatever zone the runtime is in and move the 1st of a month to the last of
   the one before, for everybody west of UTC. */
const monthDayOf = (iso: string) => ({
  month: Number(iso.slice(5, 7)),
  day: Number(iso.slice(8, 10)),
})

async function sendBirthdays() {
  const { data: groups } = await supabase.from('groups').select('id, name, timezone')

  for (const g of groups ?? []) {
    // Every group agrees with itself about what day it is, the same way cycles
    // do. A group in Abidjan should not get its reminders on Montreal's clock.
    const target = monthDayAhead((g as any).timezone ?? 'UTC', BIRTHDAY_LEAD_DAYS)

    const { data: members } = await supabase
      .from('group_members')
      .select('user_id, profiles(display_name, birthday)')
      .eq('group_id', g.id)

    /* Whose birthday it is. A 29 February birthday only matches in a leap
       year, which is the same thing every calendar does with it and better
       than picking the 28th or the 1st on somebody's behalf. */
    const celebrating = (members ?? []).filter((m: any) => {
      const b = m.profiles?.birthday
      if (!b) return false
      const md = monthDayOf(b)
      return md.month === target.month && md.day === target.day
    })
    if (!celebrating.length) continue

    // The anchor for the ceiling. A group always has cycles; if it somehow has
    // none there is nothing to claim against and nothing to send.
    const { data: cyc } = await supabase
      .from('cycles')
      .select('id')
      .eq('group_id', g.id)
      .order('opens_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!cyc) continue

    for (const m of members ?? []) {
      /* Never your own. Being told your birthday is in three days is the app
         reminding you of the one date you did not need reminding of, and it
         would also tell you that everybody else just got an email about it. */
      const others = celebrating.filter((c: any) => c.user_id !== m.user_id)
      if (!others.length) continue

      if (!(await claim(m.user_id, cyc.id, 'birthday'))) continue

      const who = await recipient(m.user_id)
      if (!who) continue
      const c = COPY[who.loc]

      const names = others.map(
        (o: any) => o.profiles?.display_name?.trim() || (who.loc === 'fr' ? 'Quelqu un' : 'Someone'),
      )
      const group = (g as any).name ?? (who.loc === 'fr' ? 'ton groupe' : 'your group')

      const outcome = await send(who.to, c.birthdaySubject(names.length, names[0]), {
        title: c.birthdayTitle(names.length),
        preheader: c.birthdayPre(names.length),
        blocks: [
          { kind: 'lead', text: c.birthdayLead },
          { kind: 'list', items: names.map((n: string) => ({ title: n })) },
          { kind: 'text', text: c.birthdayNote },
          { kind: 'button', label: c.birthdayCta, href: `${SITE}/g/${g.id}` },
        ],
        footnote: c.birthdayFoot(group),
        loc: who.loc,
      })
      await settle(outcome, 'birthday', m.user_id, cyc.id)
    }
  }
}

Deno.serve(async () => {
  try {
    // Advance cycles first so the digests and nudges below see current state.
    await supabase.rpc('tick')
    await sendDigests()
    await sendNudges()
    await sendBirthdays()

    /**
     * SAY WHAT HAPPENED, NOT MERELY THAT NOTHING THREW.
     *
     * This returned {"ok":true} whether the run sent four messages, sent none
     * because nobody was due, or tried and had every one refused. From the SQL
     * editor, net._http_response is the only window into this function, and
     * all three looked identical through it.
     *
     * `resend` is the one to read first. False means RESEND_API_KEY is not set
     * on this deployment, which is a configuration fault that used to look
     * exactly like success.
     */
    return new Response(
      JSON.stringify({ ok: true, resend: Boolean(RESEND_KEY), from: MAIL_FROM, sent: tally }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 })
  }
})
