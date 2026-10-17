/**
 * The colours of a checkout, per app, in one place for both sides of it.
 *
 * Stripe paints its form on `ground` and its button in `button`
 * (branding_settings in api/_brand.js), and our checkout page puts that form
 * in a card of the same `ground` (src/components/CheckoutCard.jsx), so the
 * form and the card read as one piece. Written once, here, so the two can
 * never drift apart.
 *
 * Hakkilo: the soft lilac Hakkilo keeps for what you picked, and its black
 * button. Rich & Friends: the rose pastel of its calendar (--c-ev-cours), and
 * the deep pink that exists to carry small white words (CLAUDE.md: white on
 * the logo pink is 3.80:1, under the 4.5 a button's label needs; on #D6006B
 * it passes). Measured in src/lib/checkoutBrand.test.mjs.
 */
export const CHECKOUT_LOOK = {
  hakkilo: { ground: '#E6DFFF', button: '#111111' },
  rf: { ground: '#FFCDE2', button: '#D6006B' },
}
