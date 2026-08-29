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
/* The yellow that used to stripe the left edge of every list card went with
   the stripe. Left as a comment rather than an unused constant, because a
   colour sitting in a palette that nothing paints is an invitation to paint
   something with it. */
const PAPER = '#FFFFFF'
const WALL = '#FBF7F8'
const MUTED = '#8A6076'
/* The site's own --c-hairline. A closed 1px outline is what marks a card here
   now, replacing a stripe hanging off its left edge. */
const HAIR = '#F0E2E7'

const FONT =
  "'Montserrat','Segoe UI',-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif"

const esc = (s: string) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export type Block =
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
     * The commitments. A card per item rather than bullets: the whole message
     * exists to make these lines easy to look at, and a dash in front of a
     * sentence is not a design.
     *
     * A CLOSED OUTLINE, NOT A STRIPE.
     *
     * Each of these used to be a pale fill with a 3px yellow bar down the left
     * edge. The bar was load-bearing: WALL on PAPER is #FBF7F8 on white, which
     * is very nearly nothing, so without it the cards would have dissolved
     * into the message. Rather than keep the stripe, the card now carries a 1px
     * outline the whole way round, which is what marks a card everywhere else
     * and does not leave a coloured tab hanging off one side.
     *
     * Kept simple on purpose. This renders in Outlook, where a border on a td
     * is one of the few things that behaves; anything cleverer degrades into
     * exactly the artefact it was trying to avoid.
     */
    case 'list':
      return b.items
        .map(
          (it) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 10px;">
  <tr>
    <td style="background:${PAPER};border:1px solid ${HAIR};border-radius:12px;padding:15px 17px;">
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
 * @param smallPrint the grey line under the card, in the reader's language.
 *                  It used to be an English string literal down in the markup,
 *                  which meant every French message ended in an English
 *                  sentence about a ceiling. The copy table caught none of it,
 *                  because the copy table only ever knew about the words the
 *                  senders pass in and this one lived in the layout.
 */
export function layout({
  title,
  preheader,
  blocks,
  footnote,
  smallPrint,
}: {
  title: string
  preheader: string
  blocks: Block[]
  footnote?: string
  smallPrint: string
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
            <div style="padding-top:8px;">${esc(smallPrint)}</div>
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
export function plain(title: string, blocks: Block[], footnote?: string): string {
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
