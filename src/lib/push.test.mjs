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

/**
 * THE HOME-PAGE BANNER.
 *
 * Asked for: can notifications not simply be switched on for everybody, with
 * people turning them off if they mind? No, and not as a policy choice. A
 * browser subscribes only after a genuine user gesture with the permission
 * request raised in the same tick. There is no server call and no setting that
 * grants it, and that is the correct design.
 *
 * So the closest honest thing is to put the tap somewhere everyone passes.
 * The button turns them on FROM the banner rather than linking to Settings,
 * because the trip to Settings was the whole complaint and a banner that only
 * points at the real control has added a step rather than removed one.
 *
 * Verified in Chromium in four states: shown and working when not subscribed,
 * dismissed across a reload, absent for somebody already subscribed, and
 * absent when the browser has already refused, since it will never ask again
 * and the button could not work.
 */
{
  const banner = readFileSync(join(here, '..', 'components', 'PushBanner.jsx'), 'utf8')
  const bannerCode = stripped(banner)

  ok('the banner turns them on itself rather than linking to settings',
     /enablePushHere/.test(bannerCode) && !/to="\/settings"/.test(bannerCode),
     'the trip to settings was the complaint')
  ok(
    'both screens share one enable path',
    /export async function enablePushHere/.test(readFileSync(join(here, 'pushClient.js'), 'utf8')) &&
      /enablePushHere/.test(readFileSync(join(here, '..', 'components', 'PushToggle.jsx'), 'utf8')),
    'two copies drift, and the drift is silent: subscribed but no row stored',
  )
  ok(
    'it stays away when there is no key on the build',
    /if \(!VAPID_PUBLIC_KEY\) return/.test(bannerCode),
    'offering a button the deployment cannot honour',
  )
  ok(
    'and when the browser has already refused',
    /support === 'unsupported' \|\| support === 'denied'/.test(bannerCode),
    'a denied browser never asks again, so this would nag forever',
  )
  ok(
    'and when they are already subscribed',
    /if \(dead \|\| sub\) return/.test(bannerCode),
  )
  ok(
    'the dismissal is written down, not just hidden',
    /localStorage\.setItem\(KEY, '1'\)/.test(bannerCode),
    'a cross that lasts until the next page load has dismissed nothing',
  )
  ok(
    'it still shows on an iPhone in a tab, where the reason is fixable',
    /banner\.push_ios/.test(bannerCode),
    'that is the one unavailable state worth explaining rather than hiding',
  )
  for (const key of ['banner.push_title', 'banner.push_sub', 'banner.push_ios',
                     'banner.push_cta', 'banner.push_working', 'banner.push_how']) {
    const hits = i18nSrc.split(`'${key}'`).length - 1
    ok(`${key} exists in both languages (${hits})`, hits === 2)
  }
  ok(
    'the how-to names the home-screen step in both languages',
    /Add to Home Screen/.test(i18nSrc) && /sur l\u2019\u00e9cran d\u2019accueil/i.test(i18nSrc),
  )
}

/**
 * INSTANT PUSH, AND THE ONE RULE THAT MAKES IT SAFE TO EXPOSE.
 *
 * Somebody in your group deciding to reach out because you have gone quiet is
 * the one message worth being immediate. An hour late it is a form letter; in
 * the same minute it is a person. So claiming a nudge now asks Supabase to
 * push, rather than waiting for the next scheduled run.
 *
 * It lives in the edge function because a push is signed with the VAPID
 * private key, and that key is in Supabase and nowhere else. A Vercel route
 * could not send one without moving it.
 *
 * THE REQUEST NEVER NAMES A RECIPIENT.
 *
 * It names a NUDGE. The row already records who it is about, which group it
 * belongs to and who claimed it, all written by the database under policies
 * that had already decided who may do what. The caller cannot choose a target:
 * they point at a row and the row says where the message goes.
 *
 * The obvious API, { user_id, title, body }, would let anybody with an account
 * write anything to anybody's lock screen. That shape is what these assertions
 * exist to keep out.
 *
 * Verified in Chromium by capturing the bytes the browser actually sends on a
 * real click: {"nudge_id":"..."} and nothing else, with a bearer token.
 */
{
  const fn = readFileSync(join(here, '..', '..', 'supabase', 'functions', 'notify', 'index.ts'), 'utf8')
  const fnCode = stripped(fn)

  ok('the function answers a POST as an instant push',
     /if \(req\.method === 'POST'\)/.test(fnCode) && /deliverNudge/.test(fnCode))
  ok('and still runs the scheduled job otherwise',
     /await sendDigests\(\)/.test(fnCode) && /await sendNudges\(\)/.test(fnCode),
     'adding a mode must not remove the one it already had')

  ok(
    'the recipient comes from the nudge row, never from the request',
    /\.from\('nudges'\)/.test(fnCode) && /nudge\.subject_id/.test(fnCode) &&
      !/body\.user_id|body\.title|body\.body/.test(fnCode),
    'taking a target from the body is the shape that must never exist here',
  )
  ok(
    'only the person who claimed it can fire it',
    /nudge\.claimed_by !== caller\.id/.test(fnCode),
    'membership alone would let anybody send about somebody else\u2019s gesture',
  )
  ok(
    'the caller is a verified token, not an id in the body',
    /supabase\.auth\.getUser\(token\)/.test(fnCode) && /'bad_session'/.test(fnCode),
  )
  ok(
    'and it will not push somebody to themselves',
    /nudge\.subject_id === caller\.id/.test(fnCode),
  )
  ok(
    'a second call within the hour sends nothing',
    /recentlyNudged/.test(fnCode) && /60 \* 60 \* 1000/.test(fnCode),
    'a double tap or a retry must not buzz somebody twice',
  )
  ok(
    'the inbox row is written before the push',
    fnCode.indexOf("kind: 'nudge'") < fnCode.indexOf('await pushTo(nudge.subject_id'),
    'a push that is the only copy of a message can be lost silently',
  )
  ok(
    'the preflight is answered',
    /req\.method === 'OPTIONS'/.test(fnCode) && /Access-Control-Allow-Headers/.test(fn),
    'an unanswered preflight makes the real request never happen, with nothing in the logs',
  )
  ok(
    'the words are the recipient\u2019s language, not the sender\u2019s',
    /COPY\[to\?\.loc \?\? 'fr'\]/.test(fnCode),
  )

  /* The browser half. */
  const cli = readFileSync(join(here, 'notifications.js'), 'utf8')
  /* The shape of the body, not the literal that used to build it. Both calls
     now go through one callNotify(), and this assertion was written against
     the inline JSON.stringify it replaced: it failed on a file that is
     correct. What matters is what is IN the body, and the bytes on the wire
     are checked end to end by probe/nudge.mjs. */
  ok('the nudge call names a nudge and nothing else',
     /callNotify\(\{ nudge_id: nudgeId \}\)/.test(cli))
  ok('the self test names nobody at all',
     /callNotify\(\{ self_test: true \}\)/.test(cli),
     'it pushes to the id in the verified token, so it cannot target anyone else')
  ok('neither one carries a recipient or any words',
     !/user_id:/.test(cli) && !/title:/.test(cli) && !/body: '/.test(cli),
     'the server writes the message, in the recipient\u2019s language')
  ok('the self test leaves no inbox row behind',
     !/self_test[\s\S]{0,400}from\('notification'\)\.insert/.test(
       readFileSync(join(here, '..', '..', 'supabase', 'functions', 'notify', 'index.ts'), 'utf8')),
     'a diagnostic should leave nothing behind')
  ok('and never throws at the person who claimed',
     /catch \(e\)/.test(cli) && /export async function pushNudge/.test(cli),
     'the claim already succeeded; the other phone is not their problem')

  /**
   * THE BUTTON SAYS WHAT IT DOES, AND THE LINE AFTER IT DOES NOT OVERCLAIM.
   *
   * It said "I will check on them", which described a private intention back
   * when claiming only told the group. It notifies somebody now, so it says
   * so.
   *
   * The obvious next step is a standing line under a claimed card reading
   * "they have been told", and that would be wrong twice. Until the updated
   * function is deployed the POST reaches the old handler, which ignores the
   * body and runs its scheduled job: nothing is written and nobody is told. A
   * dropped request does the same. And on the next page load nothing in the
   * nudge row records whether a push went out, so a standing sentence would
   * have to be guessed at.
   *
   * So the confirmation is transient and comes from the RESULT.
   *
   * `=== true`, NOT MERELY TRUTHY, AND THAT IS NOT PEDANTRY. The old function
   * answers { ok, sent: tally }, where tally is an object and therefore
   * truthy. The first version used `res?.sent` and claimed delivery against
   * the currently deployed function. Caught by driving that exact response in
   * Chromium.
   */
  ok('the claim button names the action',
     /'nudge\.claim': 'Notify them'/.test(i18nSrc) &&
       /'nudge\.claim': 'Pr\u00e9venir'/.test(i18nSrc))
  ok(
    'the standing line under a claimed card claims no delivery',
    !/have been told/.test((i18nSrc.match(/'nudge\.claimed_by_me': '[^']*'/g) ?? []).join(' ')) &&
      !/est pr\u00e9venue/.test((i18nSrc.match(/'nudge\.claimed_by_me': '[^']*'/g) ?? []).join(' ')),
    'it survives a reload, when nothing records whether a push went out',
  )
  {
    /* Whitespace collapsed first. The condition grew from one expression to a
       five-clause const spread over as many lines, and both assertions here
       were written against the single-line form: they failed on a file that
       is correct, which is the same shape of mistake as matching a comment. */
    const flat = readFileSync(join(here, '..', 'components', 'NudgeBanner.jsx'), 'utf8')
      .replace(/\s+/g, ' ')
    ok(
      'the confirmation is gated on an exact true, not a truthy value',
      /res\?\.ok === true && res\?\.sent === true/.test(flat),
      'the old function returns sent: tally, an object, which is truthy',
    )
  }
  for (const key of ['nudge.notified', 'nudge.hide_failed']) {
    const hits = i18nSrc.split(`'${key}'`).length - 1
    ok(`${key} exists in both languages (${hits})`, hits === 2)
  }

  /**
   * THE CROSS MUST NOT UPSERT.
   *
   * This is the bug that made the cross do nothing at all. supabase-js
   * .upsert() becomes INSERT ... ON CONFLICT DO UPDATE at PostgREST, and
   * migration 40 gave nudge_hidden a select, an insert and a delete policy and
   * granted exactly those three verbs. No update, in either place.
   *
   * Reproduced against a real Postgres 16 with migration 40 loaded, both ways:
   * with the grant as written every cross fails with "permission denied for
   * table nudge_hidden", because ON CONFLICT DO UPDATE needs the update
   * privilege whether or not anything conflicts; and with the update privilege
   * present anyway, which is what Supabase's default privileges hand a new
   * public table, the first cross succeeds and every one after it fails with
   * "new row violates row-level security policy (USING expression)".
   *
   * So the shape of the write is the fix, and it is worth pinning. A future
   * edit reaching for .upsert() here would look tidier and would silently
   * break the cross again.
   */
  {
    const nudge = readFileSync(join(here, '..', 'components', 'NudgeBanner.jsx'), 'utf8')
    /* Comments stripped first. The doc comment above hide() explains the bug
       by naming .upsert(), and the first run of this check failed on that
       sentence: the test was reading the explanation as the code. Same
       stripper the card overflow suite needs, for the same reason. */
    const code = nudge.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    const hide = code.slice(code.indexOf('async function hide('))
    ok(
      'the cross never upserts, whatever else it does',
      !/\.upsert\(/.test(code),
      'nudge_hidden has no update policy and no update grant',
    )
    ok(
      'it deletes the old row first, so a fresh hidden_at restarts the week',
      /\.from\('nudge_hidden'\)\s*\.delete\(\)/.test(hide.replace(/\n\s*/g, '\n')) ||
        /from\('nudge_hidden'\)\.delete\(\)/.test(hide),
      'an insert that swallowed the duplicate would keep the expired timestamp',
    )
    ok(
      'and then inserts, which is a verb migration 40 actually granted',
      /\.insert\(\{ nudge_id: id, user_id: user\.id \}\)/.test(hide),
    )
    ok(
      'hidden_at is never sent from the browser',
      !/hidden_at/.test(hide),
      'the column defaults to now() server-side, and a phone clock is not a clock',
    )
    ok(
      'a refused cross is shown to the person, not swallowed',
      /setHideFailed/.test(hide) && /data-hook="nudge-hide-failed"/.test(nudge),
      'it restored the card in silence, so the only symptom was tapping twice',
    )

    /**
     * THE CROSS HAS AN UNDO, AND IT SURVIVES EVERYTHING BEING HIDDEN.
     *
     * The early return was `if (visible.length === 0) return null`, so crossing
     * off every card removed the whole section from the board. Nine open nudges
     * and nothing on screen about any of them: no count, no button, no hint
     * that anything had been put away. The only way back was a DELETE run by
     * hand against the database.
     *
     * The condition is the assertion. A restore button that only renders when
     * a card is already visible is a button for the case that does not need it.
     */
    ok(
      'the rail still renders when every card is put away',
      /visible\.length === 0 && putAway\.length === 0/.test(code),
      'otherwise the board goes silent and there is no way back',
    )
    ok(
      'and it offers them back',
      /data-hook="nudge-restore"/.test(nudge) && /restoreAll/.test(code),
    )
    const restore = code.slice(code.indexOf('async function restoreAll('))
    ok(
      'the restore asks for an exact count',
      /\.delete\(\{ count: 'exact' \}\)/.test(restore),
      'RLS refuses a delete with zero rows and no error, so no error is not success',
    )
    ok(
      'and checks it before saying anything happened',
      /count !== 0/.test(restore),
    )
    ok(
      'it is scoped to this reader and to the cards actually put away',
      /\.eq\('user_id', user\.id\)/.test(restore) && /\.in\('nudge_id'/.test(restore),
    )
    ok(
      'the optimistic set is cleared too',
      /setHidden\(\(\) => new Set\(\)\)/.test(restore),
      'a card crossed off a moment ago would otherwise stay gone on a rail that just said everything is back',
    )
  }

  for (const key of ['nudge.put_away_one', 'nudge.put_away_other', 'nudge.restore']) {
    const hits = i18nSrc.split(`'${key}'`).length - 1
    ok(`${key} exists in both languages (${hits})`, hits === 2)
  }

  /**
   * WHY THE MESSAGE DID NOT GO, RATHER THAN SILENCE.
   *
   * Pressing the button wrote the claim, reloaded the board and left the other
   * phone dark, with the app saying nothing. From outside that is exactly what
   * a broken app looks like, and the app knew which of five reasons it was
   * every single time.
   *
   * The one that matters is `stale`: the Supabase function has not been
   * redeployed, so a POST reaches the old handler, which ignores the body,
   * runs its scheduled job and answers { ok: true, sent: <tally object> }.
   * That is also the response that once made the card claim a delivery which
   * never happened, so it is checked before ok.
   */
  {
    /* Read as text, not imported: this file is JSX and node will not load it.
       The five outcomes themselves are driven end to end in Chromium against
       the exact bodies the server sends; what is pinned here is the shape of
       the decision, because the ordering inside it is the part that was wrong
       twice. */
    const nudge = readFileSync(join(here, '..', 'components', 'NudgeBanner.jsx'), 'utf8')
    const code = nudge.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    const fn = code.slice(code.indexOf('export function why('))

    ok('the old function is detected by sent being an object',
       /typeof res\.sent === 'object'/.test(fn),
       'an object is truthy, which is how it once passed for a delivery')
    ok('and that check comes before the ok check',
       fn.indexOf("typeof res.sent === 'object'") < fn.indexOf('res.ok !== true'),
       'the old function answers ok: true while doing nothing')
    ok('a send with no push keys is its own outcome',
       /res\.push === false/.test(fn) && /inbox_only/.test(fn))
    ok('the hour-long ledger is not reported as a failure',
       /already_sent_recently/.test(fn) && /'recent'/.test(fn))

    /* The success branch has to exclude push: false too, or it swallows the
       half-success and the card says "told, on their phone" about a phone
       that never lit up. Found in Chromium: that case produced no line at all. */
    const flat = code.replace(/\s+/g, ' ')
    ok('the success branch excludes a send that reached no phone',
       /res\?\.sent === true && res\?\.push !== false/.test(flat),
       'otherwise inbox_only never reaches why()')

    /**
     * push: true IS NOT A DELIVERY.
     *
     * It only means the server holds VAPID signing keys. Somebody who has
     * never turned notifications on has no rows in push_subscription, the
     * send loop runs zero times, and this answered sent: true anyway, so the
     * card said "they have just been told, on their phone" about a phone that
     * was never contacted. On an iPhone that is the NORMAL state until the
     * site is added to the home screen, because Safari refuses push to a page
     * in a tab, so it is the likeliest outcome of all rather than an edge.
     */
    const fnSrc = readFileSync(
      join(here, '..', '..', 'supabase', 'functions', 'notify', 'index.ts'), 'utf8')
    ok('the server counts the devices it actually reached',
       /Promise<\{ devices: number; delivered: number \}>/.test(fnSrc),
       'pushTo returned nothing, so sent: true meant nothing')
    ok('and hands both numbers back to the caller',
       /devices: reach\.devices/.test(fnSrc) && /delivered: reach\.delivered/.test(fnSrc))
    ok('delivered is only incremented on a real send',
       /result === 'sent'[\s\S]{0,120}delivered \+= 1/.test(fnSrc))

    ok('zero devices is its own outcome, not a delivery',
       /res\.devices === 0/.test(fn) && /no_device/.test(fn))
    ok('and zero delivered is another',
       /res\.delivered === 0/.test(fn) && /push_refused/.test(fn))
    ok('the told branch requires both numbers to be non-zero',
       /res\?\.devices !== 0/.test(flat) && /res\?\.delivered !== 0/.test(flat))
    ok('using !== 0 so an older deployment that omits them still counts as told',
       !/res\?\.devices > 0/.test(flat) && !/res\?\.delivered > 0/.test(flat),
       'undefined means not reported, and > 0 would read that as a failure')

    for (const w of ['stale', 'inbox_only', 'no_device', 'push_refused', 'recent', 'signed_out', 'failed']) {
      const hits = i18nSrc.split(`'nudge.not_sent_${w}'`).length - 1
      ok(`nudge.not_sent_${w} exists in both languages (${hits})`, hits === 2)
    }
    ok('the stale message says exactly what to paste and where',
       /bundled\.ts/.test(i18nSrc) && /Edge Functions/.test(i18nSrc),
       'a reason nobody can act on is only a nicer silence')
  }

  /**
   * BUNDLE FRESHNESS IS NOT CHECKED HERE, DELIBERATELY.
   *
   * bundled.ts is what gets pasted into the dashboard, so a stale one means
   * the deployed function is the old one and everything above is theatre. The
   * first version of this block guarded that with
   * /deliverNudge/.test(bundled), which is a substring test: renaming the
   * function to deliverNudgeOLD passed it. A weaker copy of a check that
   * already exists is worse than no copy, because it reads like coverage.
   *
   * notifyCopy.test.mjs owns this properly. It regenerates the bundle in
   * memory and compares, so any divergence at all fails. Confirmed by deleting
   * the whole instant-push handler from bundled.ts: that suite failed with
   * "bundled.ts matches what the script would write now", and this one did
   * not notice.
   */
  ok(
    'something still checks the bundle is regenerated',
    /bundled\.ts matches what the script would write now/.test(
      readFileSync(join(here, 'notifyCopy.test.mjs'), 'utf8')),
    'if that check is ever removed, a stale paste deploys silently',
  )
}

/**
 * A NUDGE IN THE INBOX MUST NOT READ AS A GOAL.
 *
 * Migration 54 widened the kind constraint so the edge function could write
 * kind = 'nudge', and the notifications page had no case for it. Those rows
 * fell through to the goal wording and rendered as "X a ajoute un objectif
 * commun".
 *
 * That is worse than an unstyled row. The one message in this app most worth
 * reading is somebody saying they noticed you had gone quiet, and it was being
 * described as a piece of admin about a shared goal.
 *
 * Found by asking what happens after 54 rather than by a report, which is the
 * uncomfortable part: the constraint and the writer shipped in one change and
 * the reader was never taught the new word.
 */
{
  const page = readFileSync(join(here, '..', 'pages', 'Notifications.jsx'), 'utf8')
  ok('the inbox draws a nudge as a nudge',
     /r\.kind === 'nudge'/.test(page),
     'without this it falls through to the shared-goal wording')
  ok('and gives it a second line of its own',
     /notif\.nudge_sub/.test(page),
     'a nudge points at no row, so the subject line has nothing to show')
  for (const key of ['notif.nudge_by', 'notif.nudge_anon', 'notif.nudge_sub']) {
    const hits = i18nSrc.split(`'${key}'`).length - 1
    ok(`${key} exists in both languages (${hits})`, hits === 2)
  }
  ok(
    'every kind the constraint allows has a case',
    ['group_goal', 'book', 'nudge'].every(
      (k) => k === 'group_goal' || new RegExp(`r\\.kind === '${k}'`).test(page)),
    'a kind the database can write and the page cannot draw is a silent wrong answer',
  )
}

console.log(`\npush\n\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
