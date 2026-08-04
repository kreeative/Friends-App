/**
 * Scheduled sender — the piece a static site cannot provide.
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
 *   digest — a few hours before the window opens: what you committed to
 *   nudge  — after a missed cycle: one message, no escalation, no streak talk
 *
 * Deploy:  supabase functions deploy notify --no-verify-jwt
 * Secrets: supabase secrets set RESEND_API_KEY=... MAIL_FROM="Friends <hi@yourdomain>"
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

async function send(to: string, subject: string, text: string) {
  if (!RESEND_KEY) {
    console.log('[dry-run]', to, subject)
    return true
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: MAIL_FROM, to, subject, text }),
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
        .select('commitment, target_per_cycle, cadence')
        .eq('group_id', cycle.group_id)
        .eq('status', 'active')
        .or(`owner_id.eq.${m.user_id},kind.eq.group`)

      if (!goals?.length) continue
      if (!(await claim(m.user_id, cycle.id, 'digest'))) continue

      const to = await emailFor(m.user_id)
      if (!to) continue

      const lines = goals
        .map((g) => `· ${g.commitment}${g.cadence === 'recurring' ? ` (${g.target_per_cycle}×)` : ''}`)
        .join('\n')

      await send(
        to,
        `Check-in opens tonight — ${(cycle as any).groups?.name ?? 'your group'}`,
        `What you committed to:\n\n${lines}\n\nTakes under a minute.\n`,
      )
    }
  }
}

async function sendNudges() {
  // One message to the person who went quiet — never a second.
  const { data: nudges } = await supabase
    .from('nudges')
    .select('id, cycle_id, subject_id, group_id, groups(name)')
    .in('state', ['pending', 'claimed'])

  for (const n of nudges ?? []) {
    if (!(await claim(n.subject_id, n.cycle_id, 'nudge'))) continue

    const to = await emailFor(n.subject_id)
    if (!to) continue

    await send(
      to,
      `No rush — ${(n as any).groups?.name ?? 'your group'}`,
      [
        "You've missed a couple of check-ins. That's genuinely fine.",
        '',
        "When you're ready, open the app and tap \"I'm still in\" — it parks everything",
        'old and asks for one thing. There is no backlog to clear.',
        '',
      ].join('\n'),
    )
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
