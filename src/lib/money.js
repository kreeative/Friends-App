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
export function money(cents, currency, locale) {
  const tags = [
    ...(typeof navigator !== 'undefined' ? (navigator.languages ?? [navigator.language]) : []),
    locale === 'fr' ? 'fr-CA' : 'en-CA',
  ].filter(Boolean)

  const code = currency || 'CAD'
  try {
    return new Intl.NumberFormat(tags, { style: 'currency', currency: code }).format(
      (cents ?? 0) / 100,
    )
  } catch {
    return `${((cents ?? 0) / 100).toFixed(2)} ${code}`
  }
}
