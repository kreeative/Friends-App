/**
 * Scheduled sender. The piece a static site cannot provide.
 *
 * A Netlify-hosted bundle only runs when someone opens it, and the person the
 * app most needs to reach is the one who has stopped opening it. So the two
 * outbound messages live here, on a schedule, instead of in the client.
 *
 * The ceiling is two emails per person per cycle and it is enforced by the
 * database, not by this code: every send first claims a row in
 * notifications_log, whose unique (user_id, cycle_id, kind) constraint makes a
 * duplicate physically impossible even if this function runs twice.
 *
 *   digest. A few hours before the window opens: what you committed to
 *   nudge . After a missed cycle: one message, no escalation, no streak talk
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
  fr: {
    digestSubject: (g: string) => `Le point ouvre ce soir. ${g}`,
    digestTitle: 'Le point ouvre ce soir',
    digestPre: (g: string, n: number) =>
      `${g} · ${n} chose${n === 1 ? '' : 's'} a regarder, environ une minute.`,
    digestLead: 'Ce que tu as dit que tu ferais :',
    digestCta: 'Faire le point',
    digestTail: 'Moins d une minute. Rien a rattraper si tu le manques.',
    nudgeSubject: (g: string) => `Rien ne presse. ${g}`,
    nudgeTitle: 'Rien ne presse',
    nudgePre: 'Rien a rattraper. Une seule chose, quand tu veux.',
    /* Ouvre sur ce qu il y a a faire, pas sur ce qui a ete manque. La version
       d avant commencait par "Tu as manque quelques points", ce qui apprend a
       la personne quelque chose qu elle sait deja et le lui apprend en premier.
       Ce message est la seule chose que l application envoie a quelqu un qui a
       arrete de l ouvrir : il ne doit pas commencer par un reproche.

       "Quand tu es prete" a aussi disparu. C est un accord feminin dans un
       message envoye a tout le monde, donc il se trompait une fois sur deux. */
    nudgeLead: 'Reviens quand tu veux. Une seule chose suffit.',
    nudgeBody:
      'Ouvre l application et touche "Je suis toujours la". Ca met en pause tout ce qui traine et te demande une seule chose. Il n y a pas de retard a combler et rien a expliquer.',
    nudgeCta: 'Choisir une chose',
    nudgeFoot: (g: string) => `Envoye une fois, parce que tu es dans ${g}. Il n y en aura pas de deuxieme.`,
  },
  en: {
    digestSubject: (g: string) => `Check-in opens tonight. ${g}`,
    digestTitle: 'Check-in opens tonight',
    digestPre: (g: string, n: number) =>
      `${g} · ${n} thing${n === 1 ? '' : 's'} to look at, about a minute.`,
    digestLead: 'What you said you would do:',
    digestCta: 'Check in',
    digestTail: 'Takes under a minute. Nothing to catch up on if you miss it.',
    nudgeSubject: (g: string) => `No rush. ${g}`,
    nudgeTitle: 'No rush',
    nudgePre: 'Nothing to catch up on. One thing when you are ready.',
    nudgeLead: 'Come back whenever you want. One thing is enough.',
    nudgeBody:
      'Open the app and tap "I am still in". It parks everything old and asks for one thing. There is no backlog to clear and nothing to explain.',
    nudgeCta: 'Pick one thing',
    nudgeFoot: (g: string) => `Sent once, because you are in ${g}. There is no second one.`,
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
  { title, preheader, blocks, footnote }: {
    title: string
    preheader: string
    blocks: Block[]
    footnote?: string
  },
) {
  const html = layout({ title, preheader, blocks, footnote })
  const text = plain(title, blocks, footnote)

  if (!RESEND_KEY) {
    console.log('[dry-run]', to, subject, `${html.length} bytes html`)
    return true
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: MAIL_FROM, to, subject, html, text }),
  })
  if (!res.ok) console.error('send failed', await res.text())
  return res.ok
}

/** Claim the right to send. Returns false if this message already went out. */
async function claim(userId: string, cycleId: string, kind: 'digest' | 'nudge') {
  const { error } = await supabase
    .from('notifications_log')
    .insert({ user_id: userId, cycle_id: cycleId, kind })
  return !error
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

      await send(who.to, c.digestSubject(name), {
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
      })
    }
  }
}

async function sendNudges() {
  // One message to the person who went quiet. Never a second.
  const { data: nudges } = await supabase
    .from('nudges')
    .select('id, cycle_id, subject_id, group_id, groups(name)')
    .in('state', ['pending', 'claimed'])

  for (const n of nudges ?? []) {
    if (!(await claim(n.subject_id, n.cycle_id, 'nudge'))) continue

    const who = await recipient(n.subject_id)
    if (!who) continue
    const c = COPY[who.loc]

    const name = (n as any).groups?.name ?? (who.loc === 'fr' ? 'ton groupe' : 'your group')

    /* Deliberately the quiet one: no button colour shouting, no count of what
       was missed, no streak language. The whole design of this message is
       that it must not read as a debt collector. */
    await send(who.to, c.nudgeSubject(name), {
      title: c.nudgeTitle,
      preheader: c.nudgePre,
      blocks: [
        { kind: 'lead', text: c.nudgeLead },
        { kind: 'text', text: c.nudgeBody },
        /* /profile, not /me. Both still serve the page, but /profile is the
           canonical address now and a link in an email outlives the deploy
           that renamed it. */
        { kind: 'button', label: c.nudgeCta, href: `${SITE}/profile` },
      ],
      footnote: c.nudgeFoot(name),
    })
  }
}

Deno.serve(async () => {
  try {
    // Advance cycles first so the digests and nudges below see current state.
    await supabase.rpc('tick')
    await sendDigests()
    await sendNudges()
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 })
  }
})
