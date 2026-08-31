/**
 * node src/lib/push.test.mjs
 *
 * The web push crypto, checked against a reference implementation.
 *
 * WHY THIS TEST IS THE WHOLE REASON THE FEATURE CAN SHIP.
 *
 * Push encryption fails silently in the worst possible way. Get the HKDF info
 * string wrong by one byte, or bind the two public keys in the wrong order,
 * and the push service still answers 201 Created, because the push service
 * cannot read the payload either. The phone receives the message, fails to
 * decrypt it, and shows nothing at all. No error in the function, none in the
 * response, none on the device. It would look exactly like the emails did:
 * "delivered", and nobody saw anything.
 *
 * So the implementation is compared against npm web-push, which is the library
 * everyone else uses, with the salt and the sender key pinned so the two runs
 * are comparable. Identical inputs must give identical bytes. That is why
 * web-push is a devDependency of a project that does not ship it: it is here to
 * be disagreed with, not to be used.
 *
 * A round trip would NOT have been enough. Encrypting and decrypting with the
 * same wrong info string succeeds, and proves only that the code agrees with
 * itself.
 */
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readFileSync } from 'node:fs'
import { transformSync } from '/home/user/Friends-App/node_modules/esbuild/lib/main.js'
import crypto from 'node:crypto'

const here = dirname(fileURLToPath(import.meta.url))
const REF = '/tmp/claude-0/-home-user-Friends-App/a6967461-6e34-5f5f-9257-a65ffd464597/scratchpad/pushref'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}

/* The Deno module, transpiled and loaded here. Same source that deploys, so a
   change to it is checked rather than a copy of it. */
const SRC = join(here, '..', '..', 'supabase', 'functions', 'notify', 'push.ts')
const js = transformSync(readFileSync(SRC, 'utf8'), { loader: 'ts', format: 'esm' }).code
const mod = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)

const b64 = (b) => Buffer.from(b).toString('base64url')

/* --- against the reference ------------------------------------------------ */

{
  const require = createRequire(`${REF}/package.json`)
  let ece
  try {
    ece = require('http_ece')
  } catch {
    ece = null
  }

  if (!ece) {
    ok('the reference implementation is installed', false,
       'npm i web-push in the pushref scratchpad')
  } else {
    /* A subscriber, as a browser would produce one. */
    const ua = crypto.createECDH('prime256v1')
    ua.generateKeys()
    const uaPublic = b64(ua.getPublicKey())
    const authSecret = b64(crypto.randomBytes(16))

    /* The sender, pinned, so both implementations do the same arithmetic. */
    const as = crypto.createECDH('prime256v1')
    as.generateKeys()
    const salt = crypto.randomBytes(16)

    const payload = 'Tout va bien ? YOUNG AND BEAUTIFUL'

    const reference = ece.encrypt(Buffer.from(payload), {
      version: 'aes128gcm',
      dh: uaPublic,
      privateKey: as,
      salt: b64(salt),
      authSecret,
    })

    /* The same sender key, handed to Web Crypto. */
    const senderKeys = {
      privateKey: await crypto.webcrypto.subtle.importKey(
        'jwk',
        {
          kty: 'EC',
          crv: 'P-256',
          d: b64(as.getPrivateKey()),
          x: b64(as.getPublicKey().subarray(1, 33)),
          y: b64(as.getPublicKey().subarray(33, 65)),
          ext: true,
        },
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveBits'],
      ),
      publicKey: await crypto.webcrypto.subtle.importKey(
        'raw',
        as.getPublicKey(),
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        [],
      ),
    }

    const mine = Buffer.from(
      await mod.encryptPayload({ p256dh: uaPublic, auth: authSecret }, payload, {
        salt: new Uint8Array(salt),
        senderKeys,
      }),
    )

    ok('the ciphertext is byte-identical to web-push',
       Buffer.compare(mine, reference) === 0,
       `mine ${mine.length}B, reference ${reference.length}B`)

    /* The header, read back field by field, so a failure above says WHICH part
       disagreed rather than only that something did. */
    ok('the body opens with the salt', Buffer.compare(mine.subarray(0, 16), salt) === 0)
    ok('then the record size, 4096', mine.readUInt32BE(16) === 4096, String(mine.readUInt32BE(16)))
    ok('then the key length, 65', mine[20] === 65, String(mine[20]))
    ok('then the sender public key',
       Buffer.compare(mine.subarray(21, 86), as.getPublicKey()) === 0)

    /* One record, so: plaintext + one delimiter byte + a 16-byte GCM tag. */
    ok('and a single record of ciphertext',
       mine.length === 86 + payload.length + 1 + 16,
       `${mine.length} vs ${86 + payload.length + 1 + 16}`)

    /* An accent survives. The French copy is full of them, and a length taken
       in characters rather than bytes would truncate the tag. */
    const accented = 'Ça fait deux semaines qu’on ne te voit pas'
    const mineAcc = Buffer.from(
      await mod.encryptPayload({ p256dh: uaPublic, auth: authSecret }, accented, {
        salt: new Uint8Array(salt),
        senderKeys,
      }),
    )
    const refAcc = ece.encrypt(Buffer.from(accented), {
      version: 'aes128gcm',
      dh: uaPublic,
      privateKey: as,
      salt: b64(salt),
      authSecret,
    })
    ok('and French with accents is identical too',
       Buffer.compare(mineAcc, refAcc) === 0)
  }
}

/* --- a payload that will not fit ------------------------------------------ */

{
  const ua = crypto.createECDH('prime256v1')
  ua.generateKeys()
  let threw = null
  try {
    await mod.encryptPayload(
      { p256dh: b64(ua.getPublicKey()), auth: b64(crypto.randomBytes(16)) },
      'x'.repeat(mod.MAX_PAYLOAD + 1),
    )
  } catch (e) {
    threw = e
  }
  /* Refused here rather than sent and silently dropped by the push service,
     which is what a payload over one record would be. */
  ok('an oversized payload is refused, not truncated', threw !== null, String(threw))
  ok('and it says so in bytes', /too long/.test(String(threw)))
}

/* --- VAPID ---------------------------------------------------------------- */

{
  const kp = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const jwk = kp.privateKey.export({ format: 'jwk' })
  const publicKey = b64(
    Buffer.concat([
      Buffer.from([4]),
      Buffer.from(jwk.x, 'base64url'),
      Buffer.from(jwk.y, 'base64url'),
    ]),
  )

  const endpoint = 'https://fcm.googleapis.com/fcm/send/abc123'
  const header = await mod.vapidHeader(
    endpoint,
    { publicKey, privateKey: jwk.d, subject: 'mailto:contact@richandfriends.xyz' },
    1_756_000_000_000,
  )

  ok('the header is a vapid scheme', header.startsWith('vapid t='))
  ok('and carries the public key', header.includes(`k=${publicKey}`))

  const token = header.slice('vapid t='.length).split(',')[0]
  const [h, p, s] = token.split('.')
  const claims = JSON.parse(Buffer.from(p, 'base64url').toString())

  ok('the algorithm is ES256', JSON.parse(Buffer.from(h, 'base64url').toString()).alg === 'ES256')

  /* The audience is the PUSH SERVICE's origin, not ours. Chrome and Firefox
     use different hosts, so one token cannot serve both and a cached header is
     a bug waiting for the second browser. */
  ok('the audience is the push service, not the site',
     claims.aud === 'https://fcm.googleapis.com', claims.aud)
  ok('the subject is a mailto', /^mailto:/.test(claims.sub), claims.sub)

  /* RFC 8292 caps expiry at 24 hours and push services enforce it. */
  const life = claims.exp - Math.floor(1_756_000_000_000 / 1000)
  ok('it expires within a day', life > 0 && life <= 24 * 3600, `${life}s`)

  /* The signature actually verifies, which is the only thing a push service
     checks and the only thing that would reject every send at once. */
  const verified = crypto.verify(
    'sha256',
    Buffer.from(`${h}.${p}`),
    { key: kp.publicKey, dsaEncoding: 'ieee-p1363' },
    Buffer.from(s, 'base64url'),
  )
  ok('and the signature verifies against the public key', verified)

  /* Different endpoints, different audiences. */
  const other = await mod.vapidHeader(
    'https://updates.push.services.mozilla.com/wpush/v2/xyz',
    { publicKey, privateKey: jwk.d, subject: 'mailto:contact@richandfriends.xyz' },
  )
  const otherAud = JSON.parse(
    Buffer.from(other.slice('vapid t='.length).split(',')[0].split('.')[1], 'base64url').toString(),
  ).aud
  ok('a Mozilla endpoint gets its own audience',
     otherAud === 'https://updates.push.services.mozilla.com', otherAud)
}

/* --- base64url, which everything above rides on --------------------------- */

{
  ok('base64url round trips', mod.bytesToB64url(mod.b64urlToBytes('a-_b')) === 'a-_b')
  ok('and never pads', !mod.bytesToB64url(new Uint8Array([1, 2, 3, 4, 5])).includes('='))
  ok('and uses the url alphabet',
     !/[+/]/.test(mod.bytesToB64url(new Uint8Array([251, 255, 190, 255]))))
  ok('a 65 byte key survives',
     mod.b64urlToBytes(mod.bytesToB64url(new Uint8Array(65).fill(7))).length === 65)
}


/* --- the browser half ----------------------------------------------------- */

{
  const client = await import('./pushClient.js')

  /**
   * THE SAFARI RULE IS THE ONE THAT WILL CONFUSE PEOPLE.
   *
   * On iPhone, web push works only once the site is on the home screen. In a
   * Safari tab PushManager does not exist at all, so a naive check reports
   * "your browser cannot do this", the person tries another browser, and every
   * browser on iOS is Safari underneath. They need different words, so the two
   * cases are different answers.
   */
  const win = ({ ua = '', push = true, perm = 'default', standalone, touch = 0, platform = '' }) => ({
    navigator: { userAgent: ua, standalone, maxTouchPoints: touch, platform,
                 ...(push ? { serviceWorker: {} } : {}) },
    ...(push ? { PushManager: function () {} } : {}),
    Notification: function () {},
    matchMedia: () => ({ matches: standalone === true }),
  })
  /* Notification has to be a property of the window object being probed. */
  const withNotif = (w) => { w.Notification = { permission: w.__perm ?? 'default' }; return w }
  const mk = (o) => { const w = win(o); w.__perm = o.perm ?? 'default'; return withNotif(w) }

  const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
  const ANDROID = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120'

  ok('a normal browser is ready', client.pushSupport(mk({ ua: ANDROID })) === 'ready')
  ok('a refused browser says so, not "unsupported"',
     client.pushSupport(mk({ ua: ANDROID, perm: 'denied' })) === 'denied')

  ok('an iPhone in a Safari TAB is told to add to the home screen',
     client.pushSupport(mk({ ua: IOS, push: false })) === 'ios-needs-home-screen')
  ok('and the same iPhone once installed is ready',
     client.pushSupport(mk({ ua: IOS, push: true, standalone: true })) === 'ready')

  /* iPadOS reports itself as a Mac. Without the touch-points check an iPad in
     a tab is told its browser cannot do push, which is wrong AND unactionable. */
  ok('an iPad, which claims to be a Mac, is recognised',
     client.pushSupport(mk({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
                            platform: 'MacIntel', touch: 5, push: false }))
       === 'ios-needs-home-screen')
  /* A real desktop Mac has no touch points, and genuinely cannot. */
  ok('a desktop Mac without push is simply unsupported',
     client.pushSupport(mk({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
                            platform: 'MacIntel', touch: 0, push: false }))
       === 'unsupported')
  ok('and no window at all is unsupported', client.pushSupport(undefined) === 'unsupported')

  /* The key the push service is given, and the keys it hands back. */
  const key = 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8'
  const bytes = client.urlBase64ToUint8Array(key)
  ok('the VAPID key decodes to a 65 byte point', bytes.length === 65, String(bytes.length))
  ok('and it is uncompressed, so it starts with 0x04', bytes[0] === 4, String(bytes[0]))

  ok('a buffer round trips back to the same base64url',
     client.bufferToBase64Url(bytes.buffer) === key)

  /* The row that gets stored, built from what the browser actually gives. */
  const row = client.subscriptionRow(
    { toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/x/1',
                       keys: { p256dh: 'PK', auth: 'AU' } }) },
    'user-1',
  )
  ok('the stored row carries the endpoint', row.endpoint === 'https://fcm.googleapis.com/x/1')
  ok('and both keys, without which nothing can be decrypted',
     row.p256dh === 'PK' && row.auth === 'AU')
  ok('and the owner, which is what the policy checks', row.user_id === 'user-1')

  /* Some browsers hand back a plain object rather than something with
     toJSON. Losing the keys there would store a row that can never be sent to
     and would fail only on the device, weeks later. */
  const plain = client.subscriptionRow(
    { endpoint: 'https://e/2', keys: { p256dh: 'A', auth: 'B' } }, 'user-2')
  ok('a plain object subscription works too',
     plain.endpoint === 'https://e/2' && plain.p256dh === 'A' && plain.auth === 'B')
}

console.log(`\npush\n\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
