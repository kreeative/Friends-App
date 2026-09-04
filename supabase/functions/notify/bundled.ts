/**
 * GENERATED FILE. DO NOT EDIT.
 *
 * node scripts/bundle-notify.mjs
 *
 * template.ts and index.ts, concatenated, so the whole function can be pasted
 * into the Supabase dashboard's Edge Function editor in one go. Editing this
 * file is editing a copy: the change would be overwritten the next time the
 * script runs, and notifyCopy.test.mjs fails when the two disagree.
 *
 * Edit supabase/functions/notify/index.ts or template.ts, then re-run the
 * script above.
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

/* SITE comes from the sending half below, which declares it once. */

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
function layout({
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
 * Web Push: VAPID (RFC 8292) and payload encryption (RFC 8291).
 *
 * WHY THIS IS HAND-WRITTEN AND NOT A LIBRARY.
 *
 * The canonical library is npm web-push, which is Node-shaped: it reaches for
 * `crypto.createECDH` and `http_ece`, neither of which exists in the Edge
 * runtime this function runs on. Everything below is Web Crypto, which Deno
 * and browsers both have, so there is one implementation and no shim.
 *
 * WHY YOU SHOULD NOT TRUST THAT ARGUMENT ON ITS OWN.
 *
 * Push encryption fails silently in the worst possible way. Get the HKDF info
 * string wrong by one byte and the push service still answers 201 Created,
 * because the push service cannot read the payload either. The phone receives
 * the message, fails to decrypt it, and shows nothing. There is no error
 * anywhere: not in this function, not in the response, not on the device.
 *
 * So this is checked against npm web-push, byte for byte, in push.test.mjs:
 * the same plaintext with the same salt and the same sender key must produce
 * the identical ciphertext. That is the only test worth having here, and it is
 * why web-push is a devDependency of a project that does not ship it.
 *
 * THE SHAPE OF A MESSAGE, so the code below reads as a description of it:
 *
 *   body   = salt(16) | rs(4) | idlen(1) | as_public(65) | aes128gcm(...)
 *   header = Authorization: vapid t=<signed JWT>, k=<VAPID public key>
 */

/* --- bytes and base64url -------------------------------------------------- */

/** RFC 4648 §5. The web push wire format is base64url everywhere, unpadded. */
function b64urlToBytes(s: string): Uint8Array {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/')
  const full = pad + '='.repeat((4 - (pad.length % 4)) % 4)
  const bin = atob(full)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i)
  return out
}

function bytesToB64url(b: Uint8Array): string {
  let bin = ''
  for (const byte of b) bin += String.fromCharCode(byte)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const utf8 = (s: string) => new TextEncoder().encode(s)

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

/* --- HKDF, written the way the RFC describes it --------------------------- */

/**
 * `as BufferSource` at every Web Crypto boundary, and it is not noise.
 *
 * TypeScript 5.7 made Uint8Array generic over its backing buffer, so a plain
 * `new Uint8Array(n)` is `Uint8Array<ArrayBufferLike>` and no longer satisfies
 * `BufferSource`, which wants `ArrayBuffer` specifically. Deno type-checks an
 * Edge Function when it deploys, and this project has already had one deploy
 * blocked by a type error that nothing in the repo caught, so the casts are
 * here rather than a version of TypeScript being assumed.
 */
async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey(
    'raw',
    key as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data as BufferSource))
}

/**
 * HKDF-Expand for one block, which is all any of these need.
 *
 * Every output here is 32 bytes or fewer, so the counter never leaves 0x01 and
 * the general multi-block loop would be code nothing calls. Extract is just
 * HMAC and is written inline at each use, because RFC 8291 uses the auth
 * secret as the salt in one place and the message salt in another, and hiding
 * that behind one helper made the two look like the same step.
 */
async function expand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const block = await hmac(prk, concat(info, new Uint8Array([1])))
  return block.slice(0, length)
}

/* --- RFC 8291: encrypting the payload ------------------------------------- */

type Subscription = {
  endpoint: string
  /** The subscriber's P-256 public key, base64url, 65 bytes uncompressed. */
  p256dh: string
  /** The subscriber's auth secret, base64url, 16 bytes. */
  auth: string
}

/**
 * The record size. 4096 is what every implementation uses and what browsers
 * expect; the payloads here are a few hundred bytes, so one record is always
 * enough and the multi-record path below does not exist.
 */
const RECORD_SIZE = 4096

/** The most a payload may be, given one record and the 16-byte GCM tag. */
const MAX_PAYLOAD = RECORD_SIZE - 16 - 1

async function encryptPayload(
  sub: Pick<Subscription, 'p256dh' | 'auth'>,
  payload: string,
  /* Both are injectable ONLY so the test can pin them and compare against a
     reference implementation. Production never passes them. */
  fixed?: { salt: Uint8Array; senderKeys: CryptoKeyPair },
): Promise<Uint8Array> {
  const plaintext = utf8(payload)
  if (plaintext.length > MAX_PAYLOAD) {
    throw new Error(`push payload too long: ${plaintext.length} > ${MAX_PAYLOAD}`)
  }

  const uaPublic = b64urlToBytes(sub.p256dh)
  const authSecret = b64urlToBytes(sub.auth)

  const senderKeys =
    fixed?.senderKeys ??
    (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']))
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', senderKeys.publicKey))

  const uaKey = await crypto.subtle.importKey(
    'raw',
    uaPublic as BufferSource,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, senderKeys.privateKey, 256),
  )

  /**
   * The step that is unique to web push, and the one that is easy to get
   * subtly wrong: the auth secret is the HKDF salt here, and the info string
   * binds BOTH public keys into the key material, receiver first. Swap the two
   * and everything still runs, still returns 201, and never decrypts.
   */
  const prkKey = await hmac(authSecret, shared)
  const keyInfo = concat(utf8('WebPush: info'), new Uint8Array([0]), uaPublic, asPublic)
  const ikm = await expand(prkKey, keyInfo, 32)

  const salt = fixed?.salt ?? crypto.getRandomValues(new Uint8Array(16))
  const prk = await hmac(salt, ikm)
  const cek = await expand(prk, utf8('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await expand(prk, utf8('Content-Encoding: nonce\0'), 12)

  const aesKey = await crypto.subtle.importKey('raw', cek as BufferSource, { name: 'AES-GCM' }, false, [
    'encrypt',
  ])
  /* 0x02 is the padding delimiter for the LAST record. A lone record is also
     the last one, so it is always 0x02 here; 0x01 would mean "more follow" and
     the browser would sit waiting for a record that never comes. */
  const withDelimiter = concat(plaintext, new Uint8Array([2]))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce as BufferSource },
      aesKey,
      withDelimiter as BufferSource,
    ),
  )

  const rs = new Uint8Array(4)
  new DataView(rs.buffer).setUint32(0, RECORD_SIZE)

  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, ciphertext)
}

/* --- RFC 8292: proving who is sending ------------------------------------- */

/** The scheme and host of an endpoint, which is what a VAPID token is for. */
function audienceOf(endpoint: string): string {
  const u = new URL(endpoint)
  return `${u.protocol}//${u.host}`
}

async function importVapidKey(privateB64: string, publicB64: string): Promise<CryptoKey> {
  const d = b64urlToBytes(privateB64)
  const pub = b64urlToBytes(publicB64)
  /* A JWK, because Web Crypto will not take a raw private scalar. x and y are
     the halves of the uncompressed public point, skipping its 0x04 prefix. */
  return crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      d: bytesToB64url(d),
      x: bytesToB64url(pub.slice(1, 33)),
      y: bytesToB64url(pub.slice(33, 65)),
      ext: true,
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
}

/**
 * The Authorization header for one endpoint.
 *
 * `aud` is the push service's origin, not ours, and it is per endpoint: Chrome
 * and Firefox use different hosts, so one cached header cannot serve both.
 * Twelve hours because RFC 8292 caps it at twenty-four and a token that
 * expires while a run is in flight helps nobody.
 */
async function vapidHeader(
  endpoint: string,
  keys: { publicKey: string; privateKey: string; subject: string },
  now = Date.now(),
): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' }
  const body = {
    aud: audienceOf(endpoint),
    exp: Math.floor(now / 1000) + 12 * 60 * 60,
    sub: keys.subject,
  }
  const signing = `${bytesToB64url(utf8(JSON.stringify(header)))}.${bytesToB64url(
    utf8(JSON.stringify(body)),
  )}`

  const key = await importVapidKey(keys.privateKey, keys.publicKey)
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, utf8(signing) as BufferSource),
  )

  return `vapid t=${signing}.${bytesToB64url(sig)}, k=${keys.publicKey}`
}

/* --- putting one message on the wire -------------------------------------- */

type PushResult = 'sent' | 'gone' | 'failed'

/**
 * @returns 'gone' when the push service says this subscription is dead, which
 *          is a 404 or a 410. That is not a failure to retry: the browser has
 *          been uninstalled, or the person revoked permission, and the row
 *          should be deleted rather than tried again every hour forever.
 */
async function sendPush(
  sub: Subscription,
  payload: string,
  keys: { publicKey: string; privateKey: string; subject: string },
): Promise<PushResult> {
  const body = await encryptPayload(sub, payload)
  const auth = await vapidHeader(sub.endpoint, keys)

  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      /* Four hours. A reminder that arrives the next morning is worse than one
         that never arrives: it is about a moment that has passed. */
      TTL: '14400',
      Urgency: 'normal',
    },
    body: body as BodyInit,
  })

  if (res.status === 404 || res.status === 410) return 'gone'
  if (!res.ok) {
    console.error('push failed', res.status, (await res.text().catch(() => '')).slice(0, 200))
    return 'failed'
  }
  return 'sent'
}

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
 * Secrets: supabase secrets set RESEND_API_KEY=...
 *
 * MAIL_FROM is optional and should usually be left alone. See the note on it
 * below: the default is the address the rest of the product already sends from,
 * and using a second one costs deliverability for no gain.
 */


const SITE = Deno.env.get('SITE_URL') ?? 'https://richandfriends.xyz'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const RESEND_KEY = Deno.env.get('RESEND_API_KEY')
/**
 * ONE SENDING ADDRESS FOR THE WHOLE PRODUCT, AND WHY IT MATTERS.
 *
 * This defaulted to Resend's shared sandbox domain, and the deploy note above
 * used to suggest MAIL_FROM="Friends <hi@yourdomain>" as the example to copy.
 * Both were wrong, and the second one caused a real problem: the sign-in codes
 * go out as hello@, because that is what Supabase's own mail settings use, so
 * following the example split the product across two senders.
 *
 * Mailbox providers build reputation per ADDRESS, not only per domain. A
 * verified domain gets the message accepted; it does not decide which folder
 * it lands in. hello@ had weeks of one-to-one sign-in mail behind it, and hi@
 * had never sent anything until nine near-identical messages went out at once,
 * which is the exact profile of a bulk send from a stranger.
 *
 * So the default is the address that already reaches people. Overriding it is
 * still possible and is still the right thing when the domain is different,
 * but it should not be done to pick a nicer word before the @.
 */
const MAIL_FROM = Deno.env.get('MAIL_FROM') ?? 'Rich & Friends <hello@richandfriends.xyz>'

/**
 * A human address, used for two different jobs.
 *
 * As Reply-To, because a message nobody can answer is a message from a robot,
 * and mailbox providers weigh that. It is the same address the settings screen
 * offers for support, so an answer arrives somewhere a person reads.
 *
 * As the List-Unsubscribe target, for the reason below.
 */
const SUPPORT = Deno.env.get('SUPPORT_EMAIL') ?? 'contact@richandfriends.xyz'

/**
 * WHY DELIVERED IS NOT THE SAME AS RECEIVED.
 *
 * Resend reporting "Delivered" means the receiving server accepted the message.
 * What Gmail does with it after that is a separate decision, and a bulk sender
 * with no unsubscribe header and no reply address is one it files under
 * Promotions or Spam without telling anybody.
 *
 * List-Unsubscribe is the cheapest signal there is and this had none.
 *
 * A mailto rather than a URL, and no List-Unsubscribe-Post. One-click
 * unsubscribe means a provider will POST to that URL and expect the person to
 * be unsubscribed by the time it answers. Nothing in this app answers such a
 * POST, so declaring it would be promising something that does not exist,
 * which is worse than not declaring it: the provider tries, fails, and now
 * distrusts the sender. A mailto needs no endpoint and is honoured.
 */
const UNSUB = `<mailto:${SUPPORT}?subject=Unsubscribe>`

/**
 * VAPID, which is what lets a push service believe this is us.
 *
 * Generated once with `node scripts/vapid.mjs` and set as secrets. The public
 * half is also compiled into the browser bundle as VITE_VAPID_PUBLIC_KEY and
 * the two MUST be the same pair: a browser subscribes with the public key, and
 * a push signed by a different private key is refused with 403 by every
 * service. That is the one mistake here that produces a clean-looking failure.
 */
const VAPID = {
  publicKey: Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
  privateKey: Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
  subject: Deno.env.get('VAPID_SUBJECT') ?? `mailto:${SUPPORT}`,
}
const PUSH_READY = Boolean(VAPID.publicKey && VAPID.privateKey)

/**
 * The same news, on the lock screen.
 *
 * WHY THIS IS IN ADDITION TO THE EMAIL AND NOT INSTEAD OF IT.
 *
 * The email demonstrably arrives; what it does not do is get noticed, because
 * whether a message lights up a phone is Gmail's decision on the recipient's
 * device. A push is the opposite: it appears on the lock screen, the wording is
 * ours, and nobody has to configure anything. But it only reaches browsers that
 * have subscribed, which is nobody on the first day and never anybody who said
 * no. Dropping the email would trade a channel that reaches everyone quietly
 * for one that reaches some people loudly.
 *
 * Both go out under the SAME claim in notifications_log. One piece of news is
 * one message however many ways it travels, and claiming twice would let
 * somebody get the push this hour and the email next.
 *
 * A dead subscription is deleted rather than retried. 404 and 410 mean the
 * browser is gone or permission was revoked, and a row that will never work
 * again would otherwise be posted to every hour forever.
 */
async function pushTo(
  userId: string,
  note: { title: string; body: string; url: string; tag: string },
): Promise<{ devices: number; delivered: number }> {
  if (!PUSH_READY) return { devices: 0, delivered: 0 }

  const { data: subs } = await supabase
    .from('push_subscription')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)

  /**
   * COUNTED, AND HANDED BACK.
   *
   * This returned nothing, so deliverNudge answered sent: true whether it had
   * reached five phones or none at all. Somebody who has never turned
   * notifications on has no rows here, the loop below runs zero times, and the
   * card in the app then said "they have just been told, on their phone"
   * about a phone that was never contacted.
   *
   * That is the same mistake as claiming a delivery from the old function's
   * truthy tally, made one layer further down. A send is not a delivery, and
   * zero devices is not a failure either: it is a fact about the other person
   * that the sender should simply be told.
   */
  let delivered = 0
  const devices = (subs ?? []).length

  for (const sub of subs ?? []) {
    let result: string
    try {
      result = await sendPush(sub as any, JSON.stringify(note), VAPID)
    } catch (err) {
      /* One unreachable push service must not take the run down with it: the
         email for this person has already gone, and the next person's has not. */
      console.error('push threw', String(err).slice(0, 200))
      tally.pushFailed += 1
      continue
    }

    if (result === 'sent') {
      tally.pushed += 1
      delivered += 1
      await supabase
        .from('push_subscription')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('endpoint', sub.endpoint)
    } else if (result === 'gone') {
      tally.pushDropped += 1
      await supabase.from('push_subscription').delete().eq('endpoint', sub.endpoint)
    } else {
      tally.pushFailed += 1
    }
  }

  return { devices, delivered }
}

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
    /**
     * Her sentence, with the participle agreed rather than guessed.
     *
     * "se demande ou tu es passe" is what was asked for. The participle agrees
     * with the person reading it, so it is "passee" for a woman, and the only
     * thing the app may consult for that is what somebody put in the pronouns
     * box. See isFeminine: set to she/her means "passee", everything else
     * including an empty box takes the masculine, which is French's default
     * for an unknown subject. A name is never read.
     *
     * An earlier version dropped the participle to sidestep this. That was the
     * safe sentence rather than the right one, and it was overruled.
     */
    nudgeFromSubject: (who: string, fem?: boolean) =>
      `${who} se demande où tu es pass${fem ? 'ée' : 'é'}`,
    nudgeFromTitle: (who: string, fem?: boolean) =>
      `${who} se demande où tu es pass${fem ? 'ée' : 'é'}`,
    nudgeFromLead: (who: string, g: string) =>
      `${who} se demande comment tu vas. Ça fait deux semaines qu’on ne te voit pas dans ${g}.`,
    /**
     * The body of the instant push, which used to be nudgeCta.
     *
     * That is a button label, "Je suis toujours là", and as the second line of
     * a lock screen notification it read as something the recipient had said
     * rather than something being offered to them. A body has to be a sentence
     * about why the phone lit up.
     *
     * No obligation in it, deliberately. Somebody who has gone quiet for two
     * weeks does not need a task, and a message that arrives as one is the
     * message that gets swiped away.
     */
    nudgeNowBody: 'Rien à faire. C’est juste pour prendre de tes nouvelles.',
    /* The self test. Says what it is, so that a notification arriving out of
       nowhere on somebody's lock screen is never a mystery. */
    selfTestTitle: 'Test des notifications',
    selfTestBody: 'Si tu vois ceci, tout marche : le serveur, les clés, et cet appareil.',

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

    /**
     * QUELQU’UN A AJOUTÉ UN OBJECTIF COMMUN.
     *
     * Le nom est un fait quand on l’a : created_by est la personne qui a tapé
     * l’objectif. Il peut manquer, pour tout objectif commun créé avant la
     * migration 50, et dans ce cas la phrase ne nomme personne plutôt que
     * d’inventer un auteur. Même règle que pour le rappel d’ami absent.
     */
    goalSubject: (who: string | null, g: string) =>
      who ? `${who} a ajouté un objectif commun dans ${g}` : `Un nouvel objectif commun dans ${g}`,
    goalSubjectMany: (n: number, g: string) => `${n} nouveaux objectifs communs dans ${g}`,
    goalTitle: (n: number) =>
      n === 1 ? 'Un nouvel objectif commun' : `${n} nouveaux objectifs communs`,
    goalPre: (n: number, g: string) =>
      n === 1 ? `Quelque chose de nouveau dans ${g}.` : `${n} choses nouvelles dans ${g}.`,
    goalLead: (who: string | null, g: string) =>
      who
        ? `${who} a ajouté un nouvel objectif commun dans ${g}.`
        : `Un nouvel objectif commun vient d’arriver dans ${g}.`,
    goalLeadMany: (g: string) => `Voici ce qui a été ajouté dans ${g}.`,
    /* Qui a ajouté quoi, sous chaque ligne, parce que dans un groupe la
       question suivante est toujours celle-là. */
    goalBy: (who: string) => `ajouté par ${who}`,
    goalCta: 'Ouvrir le groupe',
    goalFoot: (g: string) =>
      `Envoyé une fois par cycle au plus, parce que tu es dans ${g}. Les objectifs ajoutés ensuite arrivent dans le même message.`,

    /**
     * LE RAPPEL DE CYCLE. LE SEUL MESSAGE QUI TOUCHE A CES DONNEES.
     *
     * Adresse a la personne elle-meme et a personne d'autre. Rien dans ce
     * message ne nomme un groupe, et il ne part que si elle a coche la case.
     * La migration 51 dit pourquoi : ce sont les donnees les plus sensibles du
     * produit, et ce rappel est l'unique exception prevue.
     *
     * Le mot « regles » n'est pas dans l'objet. Un objet s'affiche sur un
     * ecran verrouille, dans une salle de cours, a cote de quelqu'un.
     */
    cycleSubject: 'Un petit rappel',
    cycleTitle: 'Un petit rappel',
    cyclePre: (n: number) =>
      n === 1 ? 'Pour demain.' : `Pour dans ${n} jours.`,
    cycleLead: (n: number) =>
      n === 1
        ? 'Tes regles sont prevues demain, d\u2019apres tes propres dates.'
        : `Tes regles sont prevues dans ${n} jours, d\u2019apres tes propres dates.`,
    cycleNote:
      'Une estimation, pas une certitude. Trois choses qui aident, si tu veux les preparer aujourd\u2019hui.',
    cycleCta: 'Ouvrir le calendrier',
    cycleFoot:
      'Tu recois ceci parce que tu l\u2019as active. Personne d\u2019autre ne le voit, et tu peux le couper dans le calendrier.',
    prepWater: 'Bois plus d\u2019eau aujourd\u2019hui.',
    prepWarmth: 'Prepare quelque chose de chaud, une infusion ou une bouillotte.',
    prepGentle: 'Prevois quelque chose de plus doux que d\u2019habitude.',

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

    /* English has no agreement to make, so the flag is accepted and ignored
       rather than the two locales having different shapes. */
    nudgeFromSubject: (who: string, _fem?: boolean) => `${who} is wondering where you got to`,
    nudgeFromTitle: (who: string, _fem?: boolean) => `${who} is wondering where you got to`,
    nudgeFromLead: (who: string, g: string) =>
      `${who} wants to know how you are. Nobody has seen you in ${g} for a couple of weeks.`,
    nudgeNowBody: 'Nothing to do. They just wanted to hear from you.',
    selfTestTitle: 'Notification test',
    selfTestBody: 'If you can see this, the whole chain works: the server, the keys, and this device.',

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

    goalSubject: (who: string | null, g: string) =>
      who ? `${who} added a shared goal in ${g}` : `A new shared goal in ${g}`,
    goalSubjectMany: (n: number, g: string) => `${n} new shared goals in ${g}`,
    goalTitle: (n: number) => (n === 1 ? 'A new shared goal' : `${n} new shared goals`),
    goalPre: (n: number, g: string) =>
      n === 1 ? `Something new in ${g}.` : `${n} new things in ${g}.`,
    goalLead: (who: string | null, g: string) =>
      who ? `${who} added a new shared goal in ${g}.` : `A new shared goal has appeared in ${g}.`,
    goalLeadMany: (g: string) => `Here is what was added in ${g}.`,
    goalBy: (who: string) => `added by ${who}`,
    goalCta: 'Open the group',
    goalFoot: (g: string) =>
      `Sent at most once per cycle, because you are in ${g}. Goals added after this arrive in the same message.`,

    cycleSubject: 'A small heads-up',
    cycleTitle: 'A small heads-up',
    cyclePre: (n: number) => (n === 1 ? 'For tomorrow.' : `For ${n} days from now.`),
    cycleLead: (n: number) =>
      n === 1
        ? 'Your period is expected tomorrow, going by your own dates.'
        : `Your period is expected in ${n} days, going by your own dates.`,
    cycleNote:
      'An estimate, not a certainty. Three things that help, if you want to get them ready today.',
    cycleCta: 'Open the calendar',
    cycleFoot:
      'You get this because you turned it on. Nobody else sees it, and you can switch it off in the calendar.',
    prepWater: 'Drink more water today.',
    prepWarmth: 'Get something warm ready, a tea or a bottle.',
    prepGentle: 'Plan something gentler than usual.',

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
async function recipient(userId: string): Promise<{ to: string; loc: Loc; fem: boolean } | null> {
  const { data } = await supabase.auth.admin.getUserById(userId)
  const to = data?.user?.email
  if (!to) return null

  const { data: prof } = await supabase
    .from('profiles')
    .select('locale, pronouns')
    .eq('id', userId)
    .maybeSingle()

  return { to, loc: localeOf(prof?.locale), fem: isFeminine(prof?.pronouns) }
}

/**
 * Whether to write "passee" rather than "passe" about this person.
 *
 * French past participles agree with the person the sentence is about, and
 * "se demande ou tu es passe" is addressed to the recipient, so the app has to
 * know something about them to write it. It knows exactly one thing: what they
 * put in the pronouns box, if they put anything.
 *
 * TRUE ONLY FOR SOMEBODY WHO SAID SO. Anything else, including an empty box,
 * a set this does not recognise, and "prefer not to say", falls to the
 * masculine, which is French's grammatical default for an unknown subject.
 * That is a real limitation of the language and not a judgement about anybody.
 * A name is never consulted: guessing gender from a name is how an app
 * misgenders a real person in a way a default never does.
 */
function isFeminine(pronouns?: string | null): boolean {
  const p = (pronouns ?? '').trim().toLowerCase()
  return p === 'she/her' || p === 'elle' || p === 'elle/elle'
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
    body: JSON.stringify({
      from: MAIL_FROM,
      to,
      subject,
      html,
      text,
      reply_to: SUPPORT,
      headers: { 'List-Unsubscribe': UNSUB },
    }),
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
type Kind = 'digest' | 'nudge' | 'birthday' | 'group_goal'

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
const tally = {
  digest: 0, nudge: 0, birthday: 0, group_goal: 0, cycle: 0, failed: 0, dryRun: 0,
  /* The other channel, counted separately: a run can send every email and no
     push, which is the normal state until somebody turns push on. */
  pushed: 0, pushFailed: 0, pushDropped: 0,
}

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
      if (outcome === 'sent') {
        await pushTo(m.user_id, {
          title: c.digestTitle,
          body: c.digestPre(name, items.length),
          url: `${SITE}/g/${cycle.group_id}/checkin`,
          tag: 'digest',
        })
      }
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
    const outcome = await send(who.to, from ? c.nudgeFromSubject(from, who.fem) : c.nudgeSubject(name), {
      title: from ? c.nudgeFromTitle(from, who.fem) : c.nudgeTitle,
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
    if (outcome === 'sent') {
      await pushTo(n.subject_id, {
        title: from ? c.nudgeFromTitle(from, who.fem) : c.nudgeTitle,
        body: from ? c.nudgeFromLead(from, name) : c.nudgeLead(name),
        url: `${SITE}/profile`,
        tag: 'nudge',
      })
    }
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
      if (outcome === 'sent') {
        await pushTo(m.user_id, {
          title: c.birthdayTitle(names.length),
          body: c.birthdaySubject(names.length, names[0]),
          url: `${SITE}/g/${g.id}`,
          tag: 'birthday',
        })
      }
    }
  }
}

/**
 * Shared goals somebody added, emailed once and then left alone.
 *
 * THE IN-APP ROW IS WRITTEN BY THE DATABASE, NOT BY THIS FUNCTION.
 *
 * A trigger on goals fans the notification out to every member the moment the
 * goal is inserted, inside the same transaction, so the app shows it
 * immediately and it exists whether or not this function ever runs. See
 * migration 50 for why that is a trigger and not a client insert.
 *
 * What is left for this to do is the other channel. It picks up the rows that
 * have not been emailed, groups them per person, sends one message, and stamps
 * emailed_at so they are never picked up again. emailed_at is the thing that
 * stops the same news going out twice; the notifications_log claim is what
 * stops two overlapping runs both sending it once.
 *
 * ONE MESSAGE PER PERSON PER CYCLE, LISTING EVERYTHING.
 *
 * Four people adding a shared goal on the same evening is four rows in the app
 * and one email. The alternative is a group being able to generate four emails
 * for one person in an hour by doing something entirely reasonable, which is
 * how a product teaches people to filter it.
 *
 * That does mean a goal added later in the same cycle gets no email of its
 * own. It still arrives in the app, and the footer says so rather than leaving
 * somebody to work out why the second one was quiet.
 */
async function sendGroupGoals() {
  /* Everything unsent, newest information last so the list reads in the order
     things happened. The join pulls the goal and the group in one go: without
     the goal there is nothing to name, and a goal deleted since the
     notification was written takes the row with it by cascade. */
  const { data: pending } = await supabase
    .from('notification')
    .select('id, user_id, group_id, created_at, goals(commitment, status), profiles!notification_actor_id_fkey(display_name), groups(name)')
    .eq('kind', 'group_goal')
    .is('emailed_at', null)
    .order('created_at', { ascending: true })

  if (!pending?.length) return

  /* Per person, then per group. Somebody in two groups who got a goal in each
     gets two messages, because one message spanning two groups would have to
     explain which line came from where and the subject could name neither. */
  const byPerson = new Map<string, typeof pending>()
  for (const row of pending) {
    const key = `${row.user_id}|${row.group_id}`
    const list = byPerson.get(key) ?? []
    list.push(row)
    byPerson.set(key, list)
  }

  for (const [key, rows] of byPerson) {
    const userId = key.split('|')[0]

    /* A goal that was paused or finished between being added and this run is
       not news any more. If that empties the batch, the rows are still stamped
       below so they are not reconsidered every hour forever. */
    const live = rows.filter((r: any) => r.goals && r.goals.status === 'active')

    const stamp = async () => {
      await supabase
        .from('notification')
        .update({ emailed_at: new Date().toISOString() })
        .in('id', rows.map((r: any) => r.id))
    }

    if (!live.length) {
      await stamp()
      continue
    }

    /* The anchor for the ceiling, same as birthdays: the group's newest cycle.
       A group with no cycles has nothing to claim against. */
    const { data: cyc } = await supabase
      .from('cycles')
      .select('id')
      .eq('group_id', rows[0].group_id)
      .order('opens_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!cyc) continue

    if (!(await claim(userId, cyc.id, 'group_goal'))) {
      /* Already had one this cycle. The rows are stamped rather than left
         pending, because leaving them would mean the next cycle emails goals
         that are by then weeks old. They are in the app, which is where a
         thing that is no longer news belongs. */
      await stamp()
      continue
    }

    const who = await recipient(userId)
    if (!who) {
      await release(userId, cyc.id, 'group_goal')
      continue
    }
    const c = COPY[who.loc]

    const group = (rows[0] as any).groups?.name ?? (who.loc === 'fr' ? 'ton groupe' : 'your group')
    const names = live.map((r: any) => r.profiles?.display_name?.trim() || null)
    const only = live.length === 1

    const outcome = await send(
      who.to,
      only ? c.goalSubject(names[0], group) : c.goalSubjectMany(live.length, group),
      {
        title: c.goalTitle(live.length),
        preheader: c.goalPre(live.length, group),
        blocks: [
          {
            kind: 'lead',
            text: only ? c.goalLead(names[0], group) : c.goalLeadMany(group),
          },
          {
            kind: 'list',
            items: live.map((r: any, i: number) => ({
              title: r.goals.commitment,
              /* Named only when the name is a fact. A shared goal created
                 before migration 50 has no author recorded, and guessing one
                 would put words in somebody's mouth. */
              note: names[i] ? c.goalBy(names[i]) : undefined,
            })),
          },
          { kind: 'button', label: c.goalCta, href: `${SITE}/g/${rows[0].group_id}` },
        ],
        footnote: c.goalFoot(group),
        loc: who.loc,
      },
    )

    await settle(outcome, 'group_goal', userId, cyc.id)

    if (outcome === 'sent') {
      await stamp()
      await pushTo(userId, {
        title: c.goalTitle(live.length),
        body: only ? c.goalLead(names[0], group) : c.goalLeadMany(group),
        url: `${SITE}/g/${rows[0].group_id}`,
        tag: 'group_goal',
      })
    }
    /* Not stamped when the send failed. settle() has already given the claim
       back, so the next run retries both halves together rather than marking
       something as emailed that was not. */
  }
}

/**
 * The cycle reminder. The one message in this function that touches those
 * tables, and it goes to the person themselves and to nobody else.
 *
 * WHY THE ARITHMETIC IS HERE AND NOT IMPORTED.
 *
 * src/lib/cycle.js has all of it, under 67 assertions, and this runs in Deno
 * from a bundled file with no access to the app's source tree. So the two
 * rules that matter are restated: drop gaps outside 21 to 45 days, because a
 * short one is two entries for one period and a long one is a period that went
 * unrecorded, and roll the prediction forward rather than pointing at a date
 * in the past. Everything else the client does, the window, the confidence,
 * the fertile span, is for drawing and is not needed to decide whether today
 * is the day.
 *
 * WHAT STOPS IT SENDING TWICE.
 *
 * notification_preference.cycle_reminded_for, holding the predicted date the
 * last reminder was about. Deliberately not a notifications_log claim: that
 * table keys on a group's cycle_id, and this feature works for somebody with
 * no group, so anchoring to one would mean the reminder silently never fires
 * for exactly the people using the app alone.
 */
const MIN_CYCLE = 21
const MAX_CYCLE = 45
const DAY_MS = 86400000

const asDay = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}
const dayString = (ms: number) => new Date(ms).toISOString().slice(0, 10)

async function sendCycleReminders() {
  const { data: people } = await supabase
    .from('notification_preference')
    .select('user_id, cycle_remind, cycle_remind_days, stated_cycle, cycle_reminded_for')
    .eq('cycle_remind', true)

  if (!people?.length) return

  const now = new Date()
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())

  for (const person of people) {
    const { data: logs } = await supabase
      .from('cycle_log')
      .select('started_on')
      .eq('user_id', person.user_id)
      .order('started_on', { ascending: true })

    /* The annotation on the predicate is not decoration. Deno type-checks this
       file when it deploys, and `(d): d is number` leaves `d` implicitly any
       under noImplicitAny, which is an error and a blocked deploy. This repo
       has lost a deploy to exactly that class of thing before. */
    const starts = (logs ?? [])
      .map((l: { started_on: string }) => asDay(l.started_on))
      .filter((d: number | null): d is number => d !== null)
    if (!starts.length) continue

    const gaps: number[] = []
    for (let i = 1; i < starts.length; i += 1) {
      const gap = Math.round((starts[i] - starts[i - 1]) / DAY_MS)
      if (gap >= MIN_CYCLE && gap <= MAX_CYCLE) gaps.push(gap)
    }
    const recent = gaps.slice(-6)
    const length =
      recent.length > 0
        ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length)
        : person.stated_cycle && person.stated_cycle >= MIN_CYCLE && person.stated_cycle <= MAX_CYCLE
          ? person.stated_cycle
          : 28

    let next = starts[starts.length - 1] + length * DAY_MS
    let guard = 0
    while (next < today && guard < 24) {
      next += length * DAY_MS
      guard += 1
    }

    const ahead = Math.round((next - today) / DAY_MS)
    const wanted = person.cycle_remind_days ?? 2

    /* Exactly the day, not "within N". Firing on each of the three days before
       is three notifications about one event, which is how somebody turns the
       feature off. */
    if (ahead !== wanted) continue

    const forDate = dayString(next)
    if (person.cycle_reminded_for === forDate) continue

    const who = await recipient(person.user_id)
    if (!who) continue
    const c = COPY[who.loc]

    /* Stamped BEFORE the send, so two overlapping runs cannot both pass the
       check above. A failed send loses this one reminder rather than
       repeating it, which is the right way round for a message that is only
       useful on one specific day: retrying it tomorrow would be a reminder
       about the wrong number of days. */
    await supabase
      .from('notification_preference')
      .update({ cycle_reminded_for: forDate })
      .eq('user_id', person.user_id)

    const outcome = await send(who.to, c.cycleSubject, {
      title: c.cycleTitle,
      preheader: c.cyclePre(ahead),
      blocks: [
        { kind: 'lead', text: c.cycleLead(ahead) },
        { kind: 'text', text: c.cycleNote },
        {
          kind: 'list',
          items: [
            { title: c.prepWater },
            { title: c.prepWarmth },
            { title: c.prepGentle },
          ],
        },
        { kind: 'button', label: c.cycleCta, href: `${SITE}/calendar` },
      ],
      footnote: c.cycleFoot,
      loc: who.loc,
    })

    if (outcome === 'sent') {
      tally.cycle += 1
      await pushTo(person.user_id, {
        title: c.cycleTitle,
        body: c.cycleLead(ahead),
        url: `${SITE}/calendar`,
        tag: 'cycle',
      })
    } else {
      tally[outcome === 'failed' ? 'failed' : 'dryRun'] += 1
    }
  }
}

/**
 * ============================================================================
 * INSTANT PUSH, ON DEMAND.
 * ============================================================================
 *
 * Everything above this line is a scheduled job: cron calls the function, it
 * looks at who is due, and it sends. That is right for a digest and wrong for
 * the one message that is worth being immediate, which is somebody in your
 * group deciding to reach out to you because you have gone quiet. An hour late
 * that is a form letter; in the same minute it is a person.
 *
 * WHY THIS LIVES HERE AND NOT IN /api.
 *
 * A push has to be signed with the VAPID private key, and that key is in
 * Supabase and nowhere else. Not in the repository, not in Vercel, not in a
 * message. A Vercel route could not send one without moving it, so the send
 * happens where the key already is.
 *
 * THE REQUEST NEVER NAMES A RECIPIENT, AND THAT IS THE WHOLE SECURITY MODEL.
 *
 * It names a NUDGE. The nudge row already records who it is about, which group
 * it belongs to and who claimed it, and every one of those was written by the
 * database under policies that had already decided who may do what. So the
 * caller cannot choose a target: they can only point at a row, and the row
 * says where the message goes.
 *
 * An endpoint shaped the other way, taking { user_id, title, body }, would let
 * anybody with an account write anything to anybody's lock screen. That is the
 * obvious API and it is the wrong one.
 *
 * Four things are checked before anything is sent, and all four are about the
 * row rather than about the request:
 *
 *   the caller is signed in                    a verified JWT, not a claim
 *   the nudge exists                           and is loaded server-side
 *   the caller claimed it                      claimed_by is the caller
 *   it has not just been sent                  see the ledger below
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })

/**
 * One push per nudge per hour, whoever asks and however often.
 *
 * The notification table is the ledger rather than a new column, because a row
 * has to be written anyway: the person being reached out to should find it in
 * their inbox whether or not their phone was reachable at that moment. Reusing
 * it means the guard and the record are the same fact, and cannot disagree.
 *
 * An hour rather than forever. Claiming a nudge twice in a week is two real
 * gestures a fortnight apart; twice in a minute is a double tap or a retry.
 */
async function recentlyNudged(subjectId: string, groupId: string): Promise<boolean> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('notification')
    .select('id')
    .eq('user_id', subjectId)
    .eq('group_id', groupId)
    .eq('kind', 'nudge')
    .gte('created_at', since)
    .limit(1)
  return (data ?? []).length > 0
}

async function deliverNudge(req: Request): Promise<Response> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return json({ ok: false, error: 'signed_out' }, 401)

  const { data: who } = await supabase.auth.getUser(token)
  const caller = who?.user
  if (!caller) return json({ ok: false, error: 'bad_session' }, 401)

  let body: { nudge_id?: string; self_test?: boolean } = {}
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: 'bad_body' }, 400)
  }

  /**
   * A real push, from this server, to the person asking for it. Nobody else.
   *
   * WHY THIS EXISTS.
   *
   * There was no way to test the chain alone. You cannot nudge yourself: the
   * check below refuses it, and the card about you is never shown to you
   * anyway, so verifying that push works at all took two people and two
   * phones and a lot of guessing about which link had broken. The button in
   * Settings only calls showNotification in the browser, which proves the
   * device can paint one and proves nothing about the server.
   *
   * This is the whole chain in one tap: the function is the new one, it has
   * VAPID keys, this device is subscribed, and the push arrives. The answer
   * says which of those failed.
   *
   * WHY IT IS SAFE.
   *
   * The request names no recipient and cannot. The push goes to caller.id,
   * taken from the verified token, so the worst anybody can do with this
   * endpoint is send themselves a notification. It writes no inbox row: this
   * is a diagnostic, not a message, and it should leave nothing behind.
   */
  if (body.self_test === true) {
    const me = await recipient(caller.id)
    const c = COPY[me?.loc ?? 'fr']
    const reach = await pushTo(caller.id, {
      title: c.selfTestTitle,
      body: c.selfTestBody,
      url: `${SITE}/settings`,
      tag: 'rf-self-test',
    })
    return json({
      ok: true,
      self_test: true,
      push: PUSH_READY,
      devices: reach.devices,
      delivered: reach.delivered,
    })
  }

  if (!body.nudge_id) return json({ ok: false, error: 'no_nudge' }, 400)

  const { data: nudge } = await supabase
    .from('nudges')
    .select('id, group_id, subject_id, claimed_by, state')
    .eq('id', body.nudge_id)
    .maybeSingle()

  if (!nudge) return json({ ok: false, error: 'no_such_nudge' }, 404)

  /* The caller has to be the one who claimed it. Membership alone would let
     any member of the group fire a message about somebody else's gesture. */
  if (nudge.claimed_by !== caller.id) return json({ ok: false, error: 'not_yours' }, 403)
  if (nudge.subject_id === caller.id) return json({ ok: false, error: 'self' }, 400)

  if (await recentlyNudged(nudge.subject_id, nudge.group_id)) {
    return json({ ok: true, sent: false, reason: 'already_sent_recently' })
  }

  /* The words, in the recipient's language rather than the sender's. This
     function runs with nobody's browser attached, so the only source is the
     profile, which is exactly why sendNudges reads it too. */
  const to = await recipient(nudge.subject_id)
  const c = COPY[to?.loc ?? 'fr']

  const { data: actor } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', caller.id)
    .maybeSingle()
  const from = actor?.display_name?.trim()

  /* The inbox row first. If the push fails, is refused, or the phone is off,
     the message still exists somewhere they will find it. A push that is the
     only copy of something is a message that can be lost silently. */
  await supabase.from('notification').insert({
    user_id: nudge.subject_id,
    kind: 'nudge',
    href: `/g/${nudge.group_id}`,
    actor_id: caller.id,
    group_id: nudge.group_id,
  })

  const reach = await pushTo(nudge.subject_id, {
    title: from ? c.nudgeFromTitle(from, to?.fem) : c.nudgeTitle,
    /* Was nudgeCta, which is the label on a button in an email. On a lock
       screen "Je suis toujours la" reads as something the recipient said. */
    body: c.nudgeNowBody,
    url: `${SITE}/g/${nudge.group_id}`,
    tag: 'nudge',
  })

  /**
   * devices AND delivered, not just "sent".
   *
   * This answered { sent: true, push: PUSH_READY } whatever happened, and
   * PUSH_READY only says whether this server holds VAPID keys. It says nothing
   * about whether the other person has ever turned notifications on, and
   * somebody who has not has no rows in push_subscription at all: the loop in
   * pushTo runs zero times and the app then told the sender "they have just
   * been told, on their phone".
   *
   * Three different facts, and the sender deserves all three:
   *   push      this server can sign a push at all
   *   devices   how many of their devices are subscribed
   *   delivered how many actually accepted it just now
   *
   * The inbox row above is written either way, so nothing is lost when the
   * number is zero. It is simply not a delivery, and must not be reported as
   * one.
   */
  /**
   * NO PHONE REACHED MEANS SEND THE EMAIL, NOW.
   *
   * "She will see it next time she opens the app" was the answer here, and it
   * is not an answer. The whole point of this feature is that somebody who has
   * stopped opening the app gets reached; telling the sender that the message
   * is sitting where the quiet person is not looking is the failure written
   * politely.
   *
   * Push cannot always work and never will: it needs the recipient to have
   * subscribed on a device, which on an iPhone means adding the site to the
   * home screen first. Email needs nothing. It is the channel that reaches
   * everybody, it is already built, and the scheduled sender was going to use
   * it for this exact nudge on its next run anyway. Doing it now is the only
   * part that is new.
   *
   * Under the SAME claim in notifications_log, so this cannot become a second
   * message: one piece of news is one message however many ways it travels. If
   * the claim is refused, this person has already been written to for this
   * cycle and nothing more is owed. If the send fails, the claim goes back, or
   * one refused email would cost them their only message of the cycle.
   */
  let mailed = false
  if (reach.delivered === 0) {
    if (await claim(nudge.subject_id, nudge.cycle_id, 'nudge')) {
      const { data: g } = await supabase
        .from('groups').select('name').eq('id', nudge.group_id).maybeSingle()
      const name = g?.name ?? (to?.loc === 'fr' ? 'ton groupe' : 'your group')
      const outcome = to?.to
        ? await send(to.to, from ? c.nudgeFromSubject(from, to.fem) : c.nudgeSubject(name), {
            title: from ? c.nudgeFromTitle(from, to.fem) : c.nudgeTitle,
            preheader: c.nudgePre(name),
            blocks: [
              { kind: 'lead', text: from ? c.nudgeFromLead(from, name) : c.nudgeLead(name) },
              { kind: 'text', text: c.nudgeBody },
              { kind: 'button', label: c.nudgeCta, href: `${SITE}/profile` },
            ],
            footnote: c.nudgeFoot(name),
            loc: to.loc,
          })
        : 'failed'
      mailed = outcome === 'sent'
      if (!mailed) await release(nudge.subject_id, nudge.cycle_id, 'nudge')
    }
  }

  return json({
    ok: true,
    sent: true,
    push: PUSH_READY,
    devices: reach.devices,
    delivered: reach.delivered,
    mailed,
  })
}

Deno.serve(async (req) => {
  /* The browser asks first, and a preflight that is not answered makes the
     real request never happen, with nothing in the function's logs to say so:
     the failure is entirely on the other side. */
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  /* A POST is somebody in the app asking for one message now. Anything else is
     cron asking for the scheduled run, which is what this function was before
     and still is by default. */
  if (req.method === 'POST') {
    try {
      return await deliverNudge(req)
    } catch (err) {
      console.error('instant push failed', err)
      return json({ ok: false, error: String(err) }, 500)
    }
  }

  try {
    // Advance cycles first so the digests and nudges below see current state.
    await supabase.rpc('tick')
    await sendDigests()
    await sendNudges()
    await sendBirthdays()
    await sendGroupGoals()
    await sendCycleReminders()

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
      JSON.stringify({
        ok: true,
        resend: Boolean(RESEND_KEY),
        from: MAIL_FROM,
        /* Resend's shared sandbox domain. Mail from it is accepted and then
           filed under Promotions or Spam by most providers, because it is a
           domain thousands of unrelated senders share and none of them has
           authenticated. If this is true, deliverability is the problem and no
           amount of looking at this function will fix it: the answer is a
           verified domain in Resend and MAIL_FROM pointed at it. */
        sandboxDomain: MAIL_FROM.includes('resend.dev'),
        /* False means VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY is not set on this
           deployment, so every push was skipped without trying. */
        push: PUSH_READY,
        sent: tally,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 })
  }
})
