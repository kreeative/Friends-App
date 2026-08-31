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
export function b64urlToBytes(s: string): Uint8Array {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/')
  const full = pad + '='.repeat((4 - (pad.length % 4)) % 4)
  const bin = atob(full)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i)
  return out
}

export function bytesToB64url(b: Uint8Array): string {
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

export type Subscription = {
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
export const MAX_PAYLOAD = RECORD_SIZE - 16 - 1

export async function encryptPayload(
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
export function audienceOf(endpoint: string): string {
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
export async function vapidHeader(
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

export type PushResult = 'sent' | 'gone' | 'failed'

/**
 * @returns 'gone' when the push service says this subscription is dead, which
 *          is a 404 or a 410. That is not a failure to retry: the browser has
 *          been uninstalled, or the person revoked permission, and the row
 *          should be deleted rather than tried again every hour forever.
 */
export async function sendPush(
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
