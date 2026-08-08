/**
 * Rich & Friends: the scheduled email sender, as a single file.
 *
 * index.ts and template.ts merged into one module, for pasting straight into
 * the Supabase dashboard's function editor. The two-file version under
 * supabase/functions/notify/ is the one a CLI deploy uses; this exists
 * because adding a second file in the browser editor on a phone is a fight,
 * and an unresolved './template.ts' import fails the bundle outright.
 *
 * Behaviour is identical. Only the module boundary is gone.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * The email shell.
 *
 * Email is not the web. There is no external stylesheet, no flexbox worth
 * relying on, no custom font that Outlook will honour, and a dark-mode client
 * may invert your background without asking. So: tables, inline styles, web-
 * safe fallbacks, and colours chosen to survive being inverted.
 *
 * The brand marks are served from the site itself. They are already public
 * files under /brand, which is what makes them usable here. An inbox cannot
 * see anything that is not on a public URL, and inlining a 70KB PNG as base64
 * is how a message ends up in the promotions tab.
 *
 * One more rule, and it is the one people get wrong: assume images are
 * blocked. Gmail and Outlook both do it by default for a sender you have not
 * written to. So the logo is decoration with alt text, and every word that
 * matters is live text.
 */

const SITE = Deno.env.get('SITE_URL') ?? 'https://richandfriends.xyz'

/* The sun palette, hard-coded. The recipient's theme lives in their browser's
   localStorage and an email has no way to read it, so picking one and being
   consistent is the only honest option. */
const INK = '#A91C54'
const ACCENT = '#DE3578'
const YELLOW = '#F8CB02'
const PAPER = '#FFFFFF'
const WALL = '#FBF7F8'
const MUTED = '#8A6076'

const FONT =
  "'Montserrat','Segoe UI',-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif"

const esc = (s: string) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

type Block =
  | { kind: 'text'; text: string }
  | { kind: 'lead'; text: string }
  | { kind: 'list'; items: { title: string; note?: string }[] }
  | { kind: 'button'; label: string; href: string }
  | { kind: 'rule' }

function renderBlock(b: Block): string {
  switch (b.kind) {
    case 'lead':
      return `<p style="margin:0 0 18px;font-family:${FONT};font-size:18px;line-height:1.5;color:${INK};font-weight:600;">${esc(b.text)}</p>`

    case 'text':
      return `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.62;color:${INK};">${esc(b.text)}</p>`

    case 'rule':
      return `<div style="height:1px;line-height:1px;font-size:0;background:#EFE3E8;margin:26px 0;">&nbsp;</div>`

    /**
     * The commitments. A bordered card per goal rather than bullets: the
     * whole message exists to make these three lines easy to look at, and a
     * dash in front of a sentence is not a design.
     */
    case 'list':
      return b.items
        .map(
          (it) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 10px;">
  <tr>
    <td style="background:${WALL};border-left:3px solid ${YELLOW};border-radius:10px;padding:14px 16px;">
      <div style="font-family:${FONT};font-size:15px;line-height:1.4;color:${INK};font-weight:700;">${esc(it.title)}</div>
      ${
        it.note
          ? `<div style="font-family:${FONT};font-size:13px;line-height:1.45;color:${MUTED};padding-top:5px;">${esc(it.note)}</div>`
          : ''
      }
    </td>
  </tr>
</table>`,
        )
        .join('')

    /**
     * A bulletproof button: the colour is on the table cell, not on the
     * anchor, so a client that strips link styling still shows a filled
     * shape with readable text on it.
     */
    case 'button':
      return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 6px;">
  <tr>
    <td align="center" bgcolor="${ACCENT}" style="border-radius:999px;">
      <a href="${esc(b.href)}" style="display:inline-block;padding:14px 34px;font-family:${FONT};font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:999px;">${esc(b.label)}</a>
    </td>
  </tr>
</table>`
  }
}

/**
 * @param preheader the line inboxes show next to the subject. Left out, they
 *                  scrape the first text they find, which is usually the
 *                  alt text of the logo.
 */
function layout({
  title,
  preheader,
  blocks,
  footnote,
}: {
  title: string
  preheader: string
  blocks: Block[]
  footnote?: string
}): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:${WALL};">

<div style="display:none;font-size:1px;color:${WALL};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(preheader)}</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${WALL};">
  <tr>
    <td align="center" style="padding:32px 16px 44px;">

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:540px;">

        <tr>
          <td align="left" style="padding:0 4px 20px;">
            <img src="${SITE}/brand/wordmark-pink.png" width="132" alt="Rich &amp; Friends"
                 style="display:block;width:132px;max-width:132px;height:auto;border:0;border-radius:14px;">
          </td>
        </tr>

        <tr>
          <td style="background:${PAPER};border-radius:22px;padding:32px 28px;">
            <h1 style="margin:0 0 20px;font-family:${FONT};font-size:24px;line-height:1.2;letter-spacing:-0.4px;color:${INK};font-weight:800;">${esc(title)}</h1>
            ${blocks.map(renderBlock).join('\n')}
          </td>
        </tr>

        ${
          footnote
            ? `<tr><td style="padding:20px 8px 0;font-family:${FONT};font-size:12px;line-height:1.55;color:${MUTED};">${esc(footnote)}</td></tr>`
            : ''
        }

        <tr>
          <td style="padding:22px 8px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};">
            <a href="${SITE}" style="color:${MUTED};text-decoration:underline;">richandfriends.xyz</a>
            &nbsp;·&nbsp; Ambition is contagious.
            <div style="padding-top:8px;">
              You get at most two of these per check-in cycle. Reminders can be
              switched off per goal, in the app.
            </div>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}

/** The plain-text alternative. Not optional. A message with no text part
    scores badly with spam filters and is unreadable in a text-only client. */
function plain(title: string, blocks: Block[], footnote?: string): string {
  const body = blocks
    .map((b) => {
      // A plain-text divider, doing in ASCII what the HTML `rule` case does
      // with a border. Was a literal em-dash; a later cleanup pass that
      // scanned for the character in prose caught this string literal too
      // and left it as a stray ", " with no divider at all.
      if (b.kind === 'rule') return '----------------------------------------'
      if (b.kind === 'list')
        return b.items.map((i) => `· ${i.title}${i.note ? `\n    ${i.note}` : ''}`).join('\n')
      if (b.kind === 'button') return `${b.label}: ${b.href}`
      return b.text
    })
    .join('\n\n')

  return `${title}\n\n${body}\n\n${footnote ? `${footnote}\n\n` : ''}richandfriends.xyz\n`
}


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
