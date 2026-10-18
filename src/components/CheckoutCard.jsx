import { useEffect, useRef, useState } from 'react'
import { mountCheckout } from '../lib/stripeEmbed'
import { Spot } from './StickerKit'

/**
 * Stripe's form in a card of the app's colour, with real stickers stuck on
 * its edges: the middle of our checkout pages (src/bb/pages/Checkout.jsx,
 * src/pages/Checkout.jsx).
 *
 * The card is the colour Stripe paints behind its form (`ground`, the
 * branding_settings background in api/_brand.js), so the two read as one
 * piece. The stickers are the PNGs of src/assets/stickers, never a badge
 * drawn in code (CLAUDE.md), and they stick to the card's top and bottom
 * bands. Those bands are ours and hold no words; the form between them is an
 * iframe of Stripe's whose text cannot be measured from here, so no sticker
 * may reach it. A band is 3.5rem and a sticker hangs at most 2.5rem into it
 * (STICKERS below; measured by the probe at every width).
 *
 * On a phone the card is a band from one edge of the screen to the other:
 * "le design du checkout n'est pas bien ajuste sur le telephone" (Kee).
 * Inside the page's 24px and the card's 8px, Stripe's form had 326px of a
 * 390 screen and laid its own margins inside that. Edge to edge it has the
 * screen, and its margins line up with our words. Both pages that use it
 * have 24px sides (px-6), which -mx-6 undoes; from sm it is the rounded
 * card again.
 *
 * `onFail` runs when the form cannot open (Stripe.js blocked, the network
 * gone): the page then sends the buyer to Stripe's own page instead.
 */
export default function CheckoutCard({ clientSecret, ground, stickers = [], loading, onFail }) {
  const host = useRef(null)
  const [ready, setReady] = useState(false)
  const fail = useRef(onFail)
  fail.current = onFail

  useEffect(() => {
    if (!clientSecret || !host.current) return undefined
    setReady(false)
    let live = true
    const form = mountCheckout(clientSecret, host.current)
    form.ready.then(() => live && setReady(true)).catch(() => live && fail.current?.())
    return () => {
      live = false
      form.destroy()
    }
  }, [clientSecret])

  return (
    <div className="relative -mx-6 mt-12 sm:mx-0" data-hook="checkout-card">
      <div className="px-0 py-14 sm:rounded-card sm:px-4" style={{ background: ground }} data-hook="checkout-ground">
        {!ready && (
          <p role="status" className="py-20 text-center text-small font-semibold text-ink" data-hook="checkout-loading">
            {loading}
          </p>
        )}
        <div ref={host} data-hook="checkout-form" />
      </div>
      {stickers.map((s, i) => (
        <Spot key={s.name} name={s.name} tilt={s.tilt} delay={150 + i * 120} eager className={`absolute z-10 ${s.className}`} />
      ))}
    </div>
  )
}

/**
 * Where a sticker may sit: half off the card, the rest on its top or bottom
 * band, in the corners, where no words of ours or Stripe's are. Widths in
 * rem, so each hangs 2rem off the card and at most 2.5rem into the band.
 */
export const CORNERS = {
  topLeft: '-top-8 left-5 w-[4.5rem] sm:left-3 sm:w-20',
  topRight: '-top-8 right-5 w-24 sm:right-4 sm:w-28',
  bottomRight: '-bottom-8 right-6 w-[4.5rem] sm:right-8 sm:w-20',
}
