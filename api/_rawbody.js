/**
 * Le corps brut d'une requete, partage par les webhooks.
 *
 * ICI ET PAS DANS stripe-webhook.js, ou il vivait. Cal.com signe le corps brut
 * exactement comme Stripe, donc /api/cal-webhook avait besoin de la meme
 * lecture; l'importer depuis le webhook Stripe fabriquait un client Stripe et
 * un client Supabase a chaque reservation, et faisait dependre l'arrivee d'un
 * rendez-vous sur le calendrier d'une cle de paiement configuree.
 *
 * Le commentaire ci-dessous a coute une matinee et un achat qui n'a rien
 * livre. Il est garde en entier, parce qu'il vaut pour les deux.
 */

/**
 * The bytes the sender signed, whatever the runtime already did to them.
 *
 * THIS IS THE BUG THAT MADE A COMPLETED PURCHASE DO NOTHING.
 *
 * `export const config = { api: { bodyParser: false } }` above is a NEXT.JS
 * setting. This project is Vite, so `/api/*.js` runs on Vercel's plain Node
 * runtime, which reads that config for runtime, memory and maxDuration and
 * ignores `api.bodyParser` entirely. The proof is next door: api/checkout.js
 * reads `req.body` and works, so the runtime is parsing bodies.
 *
 * A parsed body is a consumed stream. So the old reader attached a `data`
 * listener to a stream that had already ended, got zero chunks, and handed
 * the verifier an empty Buffer. Every delivery failed signature
 * verification, every one returned 400, Stripe retried and got 400 again, and
 * no entitlement was ever written. The buyer was charged, came back to the
 * library, and the book was not there.
 *
 * FOUR SOURCES, IN ORDER OF HOW MUCH THEY CAN BE TRUSTED.
 *
 * WHY THE LAST ONE IS SAFE, WHICH IS THE ONLY PART THAT NEEDS AN ARGUMENT.
 *
 * Re-serialising a parsed object cannot reproduce arbitrary bytes: key order
 * survives JSON.parse then JSON.stringify, but whitespace and unicode escaping
 * are not guaranteed to. That is a reason for it to be last, not a reason for
 * it to be absent, because the signature is an HMAC over exact bytes and it is
 * still the thing deciding. If the reconstruction differs by one byte the
 * check FAILS and the delivery is rejected. A forged payload cannot be made to
 * pass by this path; the only thing that can happen is a genuine one being
 * rejected. So it is a false-negative risk, never a false-positive one.
 *
 * Each source is logged, because "which of these fired" is the first question
 * anybody debugging this will have and the Vercel log is the only place to
 * answer it.
 */
export async function rawBody(req) {
  /* 1. The stream, if the runtime left it alone. `readable` is false once it
        has been consumed, so this is asked rather than assumed: attaching to a
        dead stream is what silently returned an empty buffer before. */
  if (req.readable) {
    const chunks = []
    for await (const c of req) chunks.push(Buffer.from(c))
    const body = Buffer.concat(chunks)
    if (body.length) return { body, from: 'stream' }
  }

  /* 2. Some runtimes keep the original bytes alongside the parsed value. */
  if (Buffer.isBuffer(req.rawBody)) return { body: req.rawBody, from: 'rawBody' }
  if (typeof req.rawBody === 'string') return { body: Buffer.from(req.rawBody, 'utf8'), from: 'rawBody' }

  /* 3. A body the runtime did not know how to parse arrives untouched. */
  if (Buffer.isBuffer(req.body)) return { body: req.body, from: 'body-buffer' }
  if (typeof req.body === 'string') return { body: Buffer.from(req.body, 'utf8'), from: 'body-string' }

  /* 4. Last resort, per the note above. */
  if (req.body && typeof req.body === 'object') {
    return { body: Buffer.from(JSON.stringify(req.body), 'utf8'), from: 'reserialised' }
  }

  return { body: Buffer.alloc(0), from: 'nothing' }
}
