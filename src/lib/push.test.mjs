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

/**
 * A source file with its comments removed.
 *
 * An assertion of the form "this text is absent" matches the comment
 * explaining why it is absent, and then fails against a file that is correct.
 * That has now happened four times in this repo; the fourth was here, where
 * the note in pushClient.js says "not `new Notification()`", which is exactly
 * the string being forbidden.
 *
 * AT MODULE SCOPE, not inside the first block that wanted it. Declared in a
 * block it is invisible to every block below, and this file cost a run to
 * exactly that when the generator assertions were added at the bottom. The
 * same mistake has now been made in three separate suites here, which is why
 * every one of them declares its helpers at the top.
 *
 * Copied rather than shared: these suites import nothing of the app's own on
 * purpose, so that a broken app module cannot make the tests stop running.
 */
const stripped = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

/* The copy, read once at module scope. Two blocks below each read this file
   into a local with a different name, and an assertion added to the first
   block referencing the second block's name failed with "i18nSrc is not
   defined". Same lesson as the stripper above: helpers and shared reads go at
   the top, or the next person pays for it again. */
const i18nSrc = readFileSync(join(here, 'i18n.jsx'), 'utf8')

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

/**
 * THE TEST NOTIFICATION, AND THE CAREFUL LIMITS ON WHAT IT CLAIMS.
 *
 * Turning push on produces no visible result. The switch moves, and then
 * nothing happens for hours until a reminder either arrives or does not. If it
 * does not, there is no way from the device to tell a refused permission from
 * an app silenced in system settings from a server that never sent anything.
 *
 * So the toggle now offers one thing to press with an immediate answer. It
 * proves permission, worker registration, and the operating system being
 * willing to paint a notification from this site, which on an iPhone is most
 * of the failure surface.
 *
 * It cannot prove delivery: that is Supabase to push service to browser,
 * signed with the private half of the VAPID pair, and none of it runs here. A
 * mismatched pair subscribes cleanly and then fails with 403 at send time,
 * invisibly from the phone. So the copy has to keep saying so, in both
 * languages, and that is what these assert. A check that implies more than it
 * checked is worse than no check.
 *
 * Verified in Chromium for real: pressed the button, then read the
 * notification back off the service worker registration rather than trusting
 * the button's own success message. Title, body and icon as expected, and a
 * second press replaced it rather than stacking a duplicate.
 */
{
  const toggleSrc = readFileSync(join(here, '..', 'components', 'PushToggle.jsx'), 'utf8')
  const clientSrc = readFileSync(join(here, 'pushClient.js'), 'utf8')
  const clientCode = stripped(clientSrc)

  ok('there is a way to check it on the device',
     /showTestNotification/.test(clientSrc) && /showTestNotification/.test(toggleSrc))
  ok(
    'it goes through the registration, not the Notification constructor',
    /reg\.showNotification\(/.test(clientCode) && !/new Notification\(/.test(clientCode),
    'the constructor does not exist on iOS, the platform this matters most for',
  )
  ok(
    'the test icon is the one the service worker uses',
    /icon: '\/icon-192\.png'/.test(clientSrc) &&
      /icon: '\/icon-192\.png'/.test(readFileSync(join(here, '..', '..', 'public', 'sw.js'), 'utf8')),
    'a guessed path shows a blank default and makes a working test look broken',
  )
  ok(
    'pressing twice replaces rather than stacks',
    /tag: 'rf-test'/.test(clientSrc),
    'no tag means two identical notifications on the lock screen',
  )
  ok(
    'the button only appears once it is actually on',
    /\{on && \(/.test(toggleSrc),
    'offering a test for something switched off tests nothing',
  )

  /* The honesty of the copy is the part worth pinning. Someone shortening this
     to "Notifications are working" would be making a claim the test did not
     earn. */
  for (const key of ['push.test', 'push.testing', 'push.test_sent',
                     'push.test_title', 'push.test_body']) {
    const hits = i18nSrc.split(`'${key}'`).length - 1
    ok(`${key} exists in both languages (${hits})`, hits === 2)
  }
  /**
   * NO NOTIFICATION TITLE IS EVER THE APP'S OWN NAME.
   *
   * iOS prints "from Rich & Friends" on its own line beneath the title, so a
   * notification titled "Rich & Friends" lands on the lock screen reading
   * "Rich & Friends / from Rich & Friends / ...". That is what shipped, and it
   * was reported from a real phone the first time the test button was pressed.
   *
   * The title is for what the notification is ABOUT. Every real push already
   * gets that right, sending a commitment or a person's name; the test title
   * and the service worker's untitled fallback were the two places that did
   * not.
   */
  ok(
    'the test notification is not titled with the app name',
    !/'push\.test_title': 'Rich & Friends'/.test(i18nSrc),
    'iOS already says who it is from, on its own line',
  )
  ok(
    'and an untitled push promotes its body instead of borrowing the name',
    /data\.title \|\| data\.body \|\| 'Rich & Friends'/.test(
      readFileSync(join(here, '..', '..', 'public', 'sw.js'), 'utf8')),
    'the same doubling, in the one path that had no title of its own',
  )

  /**
   * THE HONESTY MOVED, IT DID NOT GO AWAY.
   *
   * The settings screen was asked to be buttons rather than essays, so the
   * paragraph qualifying what the test proves now lives in the help page. That
   * is a fine place for it and a terrible thing to lose, so it is asserted
   * where it went: the button must never come to read as an end-to-end check
   * just because the sentence that said otherwise was deleted from the screen.
   */
  const faq = readFileSync(join(here, '..', 'content', 'faq.js'), 'utf8')
  ok(
    'the help page still says the test does not prove delivery',
    /does not check that a real reminder will arrive/.test(faq) &&
      /ne v\u00e9rifie pas qu\u2019un vrai rappel arrivera/.test(faq),
    'moving the caveat off the screen must not delete it',
  )
  ok(
    'and explains the iPhone home-screen rule, which is where this breaks',
    /Add to Home Screen/.test(faq) && /\u00e9cran d\u2019accueil/.test(faq),
  )
  ok(
    'and says why it cannot be turned on for everybody',
    /gesture from the person/.test(faq) && /geste de la personne/.test(faq),
  )
  ok(
    'the settings screen no longer carries the paragraph',
    !/push\.test_note/.test(toggleSrc) && !/diag\.body/.test(
      readFileSync(join(here, '..', 'components', 'PurchaseCheck.jsx'), 'utf8')),
    'asked for: keep the buttons, move the explanations to help',
  )
}

/**
 * THE IN-BROWSER KEY GENERATOR.
 *
 * scripts/vapid.mjs assumes a computer. This app was built, tested and
 * deployed from a tablet, so "run node scripts/vapid.mjs" was an instruction
 * that could not be followed, and web push was going to stay switched off
 * permanently because of a shell command. The same arithmetic now runs on the
 * device reading the page.
 *
 * What is asserted here is the property that makes that safe rather than
 * reckless: the private key is generated in the browser and goes nowhere. Not
 * to Supabase, not to Vercel, not into localStorage, not into a log. It lives
 * in component state until the tab closes.
 *
 * The alternatives actually available to somebody without a computer are
 * pasting a private key into a chat window, or handing it to one of the "free
 * VAPID generator" sites, each of which is a stranger's server being told a
 * key that can send a notification to every subscriber. This is the only one
 * of the three where the key stays with its owner.
 *
 * Verified in Chromium in both languages, and not merely that two strings
 * appeared: the pair was pulled out of the page, the private half signed a
 * message, and the public half verified that signature. Two well-formed keys
 * that are not a pair pass every length check and fail only that one, and
 * that is precisely the mistake that would paste in cleanly and then fail with
 * 403 at send time.
 */
{
  const page = readFileSync(join(here, '..', 'pages', 'VapidSetup.jsx'), 'utf8')
  const pageCode = stripped(page)

  ok('the generator exists', /crypto\.subtle\.generateKey/.test(pageCode))
  ok(
    'it signs, so the curve and algorithm match what VAPID needs',
    /name: 'ECDSA', namedCurve: 'P-256'/.test(pageCode),
  )
  ok(
    'the public key is exported raw, which is the uncompressed point',
    /exportKey\('raw'/.test(pageCode),
    'applicationServerKey wants 0x04 then x then y',
  )
  ok(
    'the shape is checked before anything is shown',
    /bytes\.length !== 65 \|\| bytes\[0\] !== 4/.test(pageCode),
    'a wrong-shaped key pastes in fine and fails only at send time',
  )

  /**
   * The whole safety argument, as assertions. Any one of these appearing would
   * turn a page that keeps a secret on one device into a page that copies it
   * somewhere.
   */
  ok(
    'the private key is never stored',
    !/localStorage|sessionStorage|indexedDB/i.test(pageCode),
    'a key in storage outlives the tab, which is the one thing that must not happen',
  )
  ok(
    'and never sent anywhere',
    !/fetch\(|supabase\.|axios|XMLHttpRequest|navigator\.sendBeacon/.test(pageCode),
    'this page talks to nothing, and that is the feature',
  )
  ok(
    'and never logged',
    !/console\.(log|warn|error|info)/.test(pageCode),
    'a console is a place a key can be read back later',
  )

  ok(
    'both public fields come from one variable',
    (pageCode.match(/keys\.publicKey/g) ?? []).length === 2,
    'two separately generated halves is the 403 failure',
  )
  ok(
    'the fields are readonly rather than disabled',
    /readOnly/.test(pageCode) && !/disabled\n?\s*value=\{value\}/.test(pageCode),
    'a disabled input cannot be selected, and the clipboard can be refused',
  )
  ok(
    'the generate button disappears once a pair exists',
    /\{!keys && \(/.test(pageCode),
    'pressing it twice silently invalidates every existing subscription',
  )

  /* Unlisted on purpose. If this ever gets linked from the settings screen,
     every tester sees a key generator under the notification card. */
  const app = readFileSync(join(here, '..', 'App.jsx'), 'utf8')
  ok('the route exists', /settings\/push-keys/.test(app))
  const linked = ['components/PushToggle.jsx', 'pages/Account.jsx', 'components/AppShell.jsx']
    .filter((f) => /push-keys/.test(readFileSync(join(here, '..', f), 'utf8')))
  ok('and nothing links to it', linked.length === 0, linked.join(', '))

  for (const key of ['vapid.title', 'vapid.intro', 'vapid.generate', 'vapid.once',
                     'vapid.step_supabase', 'vapid.step_vercel', 'vapid.then_redeploy',
                     'vapid.close_tab', 'vapid.copy', 'vapid.copied', 'vapid.secret',
                     'vapid.done', 'vapid.working', 'vapid.where_supabase',
                     'vapid.where_vercel']) {
    const hits = i18nSrc.split(`'${key}'`).length - 1
    ok(`${key} exists in both languages (${hits})`, hits === 2)
  }
  ok(
    'the one-time warning survives translation',
    /never again/.test(i18nSrc) && /une seule fois/.test(i18nSrc),
    'regenerating is the destructive mistake and both languages must say so',
  )
}

console.log(`\npush\n\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
