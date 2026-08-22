/**
 * The price, in the currency it is actually charged in, formatted the way the
 * reader's own device would write it.
 *
 * Two halves that are easy to confuse. The **currency** comes from the book
 * and is not negotiable: it is what Stripe will take off the card, so showing
 * anything else would be a quoted price the checkout then disagrees with. The
 * **formatting** follows the browser, which is where "display it in the user's
 * country" can honestly be met.
 *
 * The difference is visible and worth having. Twelve Canadian dollars is
 * "CA$12.00" to someone in London, "$12.00" to someone in Toronto whose
 * device already knows the local currency is CAD, and "12,00 $" to someone in
 * Montréal reading in French. Same money, same charge, three correct ways to
 * write it.
 *
 * navigator.languages is preferred over the app's own language toggle: a
 * Canadian reading the site in English still wants Canadian conventions, and
 * those are two different settings.
 *
 * Lives here rather than in the Library page because there are two shops now.
 * The public preview sells the same book at the same price, and two copies of
 * this function is exactly how they would come to disagree.
 */
import { formatCurrency, splitAmount } from './currency'

/**
 * The formatting itself lives in currency.js, which is pure and tested. This
 * is the half that reads the browser, kept apart so the arithmetic can be
 * checked without one.
 */
export function money(cents, currency, locale) {
  const tags = [
    ...(typeof navigator !== 'undefined' ? (navigator.languages ?? [navigator.language]) : []),
    locale === 'fr' ? 'fr-CA' : 'en-CA',
  ].filter(Boolean)

  return formatCurrency(cents, currency, tags)
}

/**
 * The same amount, split so the cents can be set smaller than the dollars.
 *
 * Reads the browser exactly the way money() does, so the two can never
 * disagree about how a figure is written. See splitAmount in currency.js for
 * why it returns three parts rather than two.
 */
export function moneyParts(cents, currency, locale) {
  const tags = [
    ...(typeof navigator !== 'undefined' ? (navigator.languages ?? [navigator.language]) : []),
    locale === 'fr' ? 'fr-CA' : 'en-CA',
  ].filter(Boolean)

  return splitAmount(cents, currency, tags)
}
