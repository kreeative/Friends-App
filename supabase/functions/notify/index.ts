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

async function emailFor(userId: string): Promise<string | null> {
  const { data } = await supabase.auth.admin.getUserById(userId)
  return data?.user?.email ?? null
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

      const to = await emailFor(m.user_id)
      if (!to) continue

      /**
       * The trigger goes in the email.
       *
       * The app has no idea where anyone is and is never going to have one , 
       * so the "when and where" on a goal is a sentence you wrote to
       * yourself, and the only way it can do any work is for something to
       * read it back to you shortly before the moment it describes. This
       * message is that something. Without it the field was a note nobody
       * ever saw again, which is presumably why it looked like tracking.
       */
      const items = listed.map((g: any) => ({
        title: `${g.commitment}${g.cadence === 'recurring' ? ` · ${g.target_per_cycle}×` : ''}`,
        note: [g.trigger_when, g.trigger_where].filter(Boolean).join(' · ') || undefined,
      }))

      const name = (cycle as any).groups?.name ?? 'your group'

      await send(to, `Check-in opens tonight. ${name}`, {
        title: 'Check-in opens tonight',
        // Shown next to the subject in the inbox. Without one, clients scrape
        // the first text in the message, which would be the logo's alt text.
        preheader: `${name} · ${items.length} thing${items.length === 1 ? '' : 's'} to look at, about a minute.`,
        blocks: [
          { kind: 'lead', text: 'What you said you would do:' },
          { kind: 'list', items },
          { kind: 'button', label: 'Check in', href: `${SITE}/g/${cycle.group_id}/checkin` },
          { kind: 'text', text: 'Takes under a minute. Nothing to catch up on if you miss it.' },
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

    const to = await emailFor(n.subject_id)
    if (!to) continue

    const name = (n as any).groups?.name ?? 'your group'

    /* Deliberately the quiet one: no button colour shouting, no count of what
       was missed, no streak language. The whole design of this message is
       that it must not read as a debt collector. */
    await send(to, `No rush. ${name}`, {
      title: 'No rush',
      preheader: 'Nothing to catch up on. One thing when you are ready.',
      blocks: [
        { kind: 'lead', text: 'You have missed a couple of check-ins. That is genuinely fine.' },
        {
          kind: 'text',
          text:
            'When you are ready, open the app and tap “I’m still in”. It parks everything old and asks for one thing. There is no backlog to clear and nothing to explain.',
        },
        { kind: 'button', label: 'Pick one thing', href: `${SITE}/me` },
      ],
      footnote: `Sent once, because you are in ${name}. There is no second one.`,
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
