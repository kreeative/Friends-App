/**
 * node src/lib/webhookBody.test.mjs
 *
 * The bytes a Stripe webhook verifies against.
 *
 * WHY THIS FILE EXISTS.
 *
 * A completed purchase did nothing. The buyer was charged, came back to the
 * library, and the book was not there. The cause was three lines long and
 * looked correct: the handler carried
 *
 *   export const config = { api: { bodyParser: false } }
 *
 * which is a NEXT.JS setting. This project is Vite, so /api/*.js runs on
 * Vercel's plain Node runtime, which ignores api.bodyParser and parses the
 * body anyway. A parsed body is a consumed stream, so attaching a `data`
 * listener produced zero chunks, constructEvent got an empty Buffer, every
 * delivery failed verification with a 400, and no entitlement was ever
 * written.
 *
 * Nothing about that is visible in a screenshot, in a type error, or in a
 * local dev server, and it stayed broken through several deployments. So the
 * body reader is now a function with a stated contract and this is that
 * contract, exercised against the four shapes a request can actually arrive
 * in.
 *
 * The reader is loaded from api/stripe-webhook.js rather than copied, so a
 * change to the handler is a change to what this tests. That import pulls in
 * the Stripe and Supabase clients at module scope, which is fine: both are
 * constructed with empty strings and neither makes a request until called.
 */
import { Readable } from 'node:stream'

/**
 * The handler builds its Supabase client at module scope, and supabase-js
 * throws on an empty URL, so the import needs these present. They are
 * deliberately obvious rubbish: nothing in this file makes a request, and a
 * value that looks real would invite somebody to think it is.
 */
process.env.SUPABASE_URL ||= 'http://webhook-body-test.invalid'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'not-a-key'
process.env.STRIPE_SECRET_KEY ||= 'not-a-key'
const { rawBody } = await import('../../api/stripe-webhook.js')

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}

console.log('\nwebhook body')

const PAYLOAD = '{"id":"evt_1","type":"checkout.session.completed"}'

/* A request whose stream is still readable, which is what the handler assumed
   and what it will get if Vercel ever stops parsing. */
const streamed = Readable.from([Buffer.from(PAYLOAD, 'utf8')])
const a = await rawBody(streamed)
ok('a live stream is read', a.body.toString('utf8') === PAYLOAD, a.body.toString('utf8'))
ok('and is reported as the stream', a.from === 'stream', a.from)

/**
 * The one that was broken. `Readable.from([])` has already ended, so
 * `readable` is false and the old reader silently resolved to zero bytes.
 * There is nothing else on the object here, so this is the honest "the runtime
 * ate it and kept nothing" case and it must report that rather than pretend.
 */
const eaten = Readable.from([])
eaten.readable = false
const b = await rawBody(eaten)
ok('a consumed stream with nothing else is not silently empty-but-fine', b.from === 'nothing', b.from)
ok('and yields no bytes rather than throwing', b.body.length === 0)

/* Runtimes that parse but keep the original bytes. */
const withRaw = Object.assign(Readable.from([]), { rawBody: Buffer.from(PAYLOAD, 'utf8') })
withRaw.readable = false
const c = await rawBody(withRaw)
ok('rawBody as a Buffer is preferred over the dead stream', c.from === 'rawBody', c.from)
ok('and comes back byte for byte', c.body.toString('utf8') === PAYLOAD)

const withRawStr = Object.assign(Readable.from([]), { rawBody: PAYLOAD })
withRawStr.readable = false
const d = await rawBody(withRawStr)
ok('rawBody as a string works too', d.from === 'rawBody' && d.body.toString('utf8') === PAYLOAD, d.from)

/* A content-type the runtime did not recognise leaves the body untouched. */
const asBuffer = Object.assign(Readable.from([]), { body: Buffer.from(PAYLOAD, 'utf8') })
asBuffer.readable = false
const e = await rawBody(asBuffer)
ok('an unparsed Buffer body is used', e.from === 'body-buffer' && e.body.toString('utf8') === PAYLOAD, e.from)

const asString = Object.assign(Readable.from([]), { body: PAYLOAD })
asString.readable = false
const f = await rawBody(asString)
ok('a string body is used', f.from === 'body-string' && f.body.toString('utf8') === PAYLOAD, f.from)

/**
 * The last resort, and the one that needs its reasoning restated where
 * somebody changing it will read it.
 *
 * Re-serialising a parsed object is not guaranteed to reproduce Stripe's exact
 * bytes, which is why it is last. It is not a security hole: the signature is
 * an HMAC over exact bytes and it is still the thing deciding. A reconstruction
 * that differs by one byte FAILS verification and the delivery is rejected. A
 * forged payload cannot be made to pass through this path. The only risk is a
 * genuine delivery being rejected, never a fake one accepted.
 */
const parsed = Object.assign(Readable.from([]), { body: JSON.parse(PAYLOAD) })
parsed.readable = false
const g = await rawBody(parsed)
ok('a parsed object is re-serialised as a last resort', g.from === 'reserialised', g.from)
ok(
  'and for a compact payload that round-trips exactly',
  g.body.toString('utf8') === PAYLOAD,
  g.body.toString('utf8'),
)

/* The ordering that matters: a runtime that gives BOTH must not use the
   reconstruction, because only one of the two is the bytes Stripe signed. */
const both = Object.assign(Readable.from([]), {
  rawBody: Buffer.from(PAYLOAD, 'utf8'),
  body: { id: 'evt_1', type: 'checkout.session.completed' },
})
both.readable = false
const h = await rawBody(both)
ok('real bytes beat a reconstruction when both are available', h.from === 'rawBody', h.from)

/* The handler must still refuse to act without a secret, or every delivery
   fails verification for a reason the log blames on Stripe. */
const src = (await import('node:fs')).readFileSync(
  new URL('../../api/stripe-webhook.js', import.meta.url),
  'utf8',
)
ok(
  'a missing webhook secret is reported as a deployment problem',
  /if \(!env\('stripeWebhook'\)\)/.test(src),
  'otherwise it looks identical to a forged request',
)
ok(
  'and the source of the body is logged on failure',
  /body from: \$\{from\}/.test(src),
  '"somebody is poking the endpoint" and "the runtime ate the body" look the same without it',
)

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
