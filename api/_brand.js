/**
 * How a Stripe Checkout page looks, per app.
 *
 * "When I want to try to pay for something, it says Stripe checkout sandbox,
 * and it doesn't even have the logo", then "can we personalize the checkout
 * with our own design?" (Kee). One Stripe account sells for two apps, so the
 * account's own branding can only ever be one of them. Since API version
 * 2025-09-30.clover a Checkout Session carries its own: the name at the top,
 * an icon, the background and button colours, a font and the corners. Only
 * the session creation asks for that version (a per-request option); every
 * other call keeps the version the client is pinned to.
 *
 * The images are given by URL on the production site, which Stripe can
 * always fetch: a localhost or preview origin it could not. Stripe's fonts do
 * not include Poppins; Be Vietnam Pro is the nearest of its list.
 *
 * Hakkilo: its H, the soft lilac of the app, the black button of every
 * Hakkilo screen. Rich & Friends: its tile, the rose pastel of its calendar
 * (--c-ev-cours), and the deep pink that exists to carry small white words
 * (CLAUDE.md: white on the logo pink is 3.80:1, under the 4.5 a button's
 * label needs; on #D6006B it passes).
 *
 * The first grounds were white and a blush at 98% white: "you just add the
 * logo, what about our colors?" (Kee). Both read as Stripe's own page. The
 * ground is the one colour Stripe paints across the page, so it is the
 * app's, and still pale enough for the dark words Stripe puts on it.
 *
 * Stickers cannot go on this page: Stripe's hosted Checkout takes a logo, an
 * icon, these two colours, a font from its list and a corner style, nothing
 * else.
 *
 * "Sandbox" at the top of the page is not branding: it is the key. It goes
 * once STRIPE_SECRET_KEY on Vercel is the live key, and that is set in
 * Vercel, never here.
 */
export const BRANDING_API_VERSION = '2025-09-30.clover'

const SITE = 'https://richandfriends.xyz'

export const CHECKOUT_BRANDING = {
  hakkilo: {
    display_name: 'Hakkilo',
    icon: { type: 'url', url: `${SITE}/brand/hakkilo-icon-512.png` },
    background_color: '#E6DFFF',
    button_color: '#111111',
    font_family: 'be_vietnam_pro',
    border_style: 'rounded',
  },
  rf: {
    display_name: 'Rich & Friends',
    icon: { type: 'url', url: `${SITE}/icon-512.png` },
    background_color: '#FFCDE2',
    button_color: '#D6006B',
    font_family: 'be_vietnam_pro',
    border_style: 'rounded',
  },
}
