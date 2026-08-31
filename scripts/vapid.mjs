/**
 * node scripts/vapid.mjs
 *
 * Generates the one key pair web push needs, and prints where each half goes.
 *
 * Run it ONCE. The keys are an identity, not a secret to be rotated on a
 * schedule: every browser that has subscribed did so against this public key,
 * and a new pair invalidates every existing subscription silently. Push
 * services answer 403 for a token signed by a key the subscription was not
 * made with, so a rotation looks exactly like the feature breaking, one device
 * at a time, with no way to tell which.
 *
 * Nothing here is written to disk on purpose. A private key in a file in a
 * repository is a private key in the repository the moment somebody runs
 * `git add -A`.
 */
import { generateKeyPairSync } from 'node:crypto'

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const jwk = privateKey.export({ format: 'jwk' })

const b64 = (b) => Buffer.from(b).toString('base64url')

/* The uncompressed P-256 point: 0x04 then the two 32-byte halves. That is the
   form the browser's applicationServerKey wants and the form a push service
   expects in the `k=` parameter. */
const publicB64 = b64(
  Buffer.concat([
    Buffer.from([4]),
    Buffer.from(jwk.x, 'base64url'),
    Buffer.from(jwk.y, 'base64url'),
  ]),
)

/* Sanity, before anybody pastes anything anywhere: the pair has to be usable. */
const bytes = Buffer.from(publicB64, 'base64url')
if (bytes.length !== 65 || bytes[0] !== 4) {
  throw new Error(`generated a public key of the wrong shape: ${bytes.length} bytes`)
}

console.log(`
VAPID key pair. Generated once, then never again.

  1. Supabase -> Project Settings -> Edge Functions -> Secrets

     VAPID_PUBLIC_KEY   ${publicB64}
     VAPID_PRIVATE_KEY  ${jwk.d}
     VAPID_SUBJECT      mailto:contact@richandfriends.xyz

  2. Vercel -> the project -> Settings -> Environment Variables

     VITE_VAPID_PUBLIC_KEY   ${publicB64}

     The same public key, and it must be the SAME PAIR as above. A browser
     subscribes with this key and the push is signed with the private half;
     mismatched halves are refused with 403 by every push service, which looks
     like the feature simply not working rather than like a configuration
     error. Then redeploy the site, because Vite compiles this in at build time.

  The private key goes in Supabase and nowhere else. Not in the repository, not
  in Vercel, not in a message. Anybody holding it can send a notification to
  every person who has turned this on.
`)
