import { Gauge } from './Envelopes'

/**
 * The budget's four sections, as cards that go somewhere.
 *
 * WHAT THIS REPLACED, AND WHY A PILL ROW WAS THE WRONG SHAPE ONCE THEY BECAME
 * PAGES.
 *
 * These were pills in a horizontal strip, and a pill is a tab: it says "the
 * thing below me is about to change", and the thing below it stayed on the
 * same screen. Now each one is a sub-page with its own heading and its own way
 * back, and a pill that navigates is a lie about where you are going to end
 * up. A card that fills half the width and carries its own state reads as a
 * destination, which is what these are.
 *
 * The card is the bento card, deliberately: same 3.5rem tinted well, same
 * gauge in it, same uppercase label, same big figure with a small word under
 * it. That grid was built for the six categories and it is the shape this
 * screen already speaks in, so the sections borrow it rather than inventing a
 * second card style two components apart.
 *
 * EVERY CARD CARRIES A NUMBER, AND THAT IS THE POINT.
 *
 * ActionBar's note is the argument: navigation that hides three quarters of a
 * screen leaves the reader no way to know whether the hidden parts are done,
 * half filled or untouched. It matters more now than it did as tabs, because a
 * sub-page is a whole screen away rather than one tap and a re-render. So each
 * card says how many envelopes are funded, how many charges are paid, how many
 * projects are running and how much has been put aside, and you can decide
 * from the dashboard whether any of them is worth opening.
 *
 * `data-actionbar` rather than a new hook, for the reason CLAUDE.md gives: the
 * hook names what the thing is FOR, and every probe in the suite reaches the
 * budget's sections through it. The label lives in a span of its own so those
 * probes can match it exactly.
 */
export default function BudgetShortcuts({ items, onOpen }) {
  return (
    <div data-actionbar="" data-tabs="" className="grid grid-cols-2 gap-4">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          data-shortcut={item.id}
          onClick={() => onOpen(item.id)}
          /* The whole card as one sentence. Handed over as written, the two
             lines under the label announce a bare number and then a bare
             word, which is why they are aria-hidden below. */
          aria-label={`${item.label}. ${item.value} ${item.word}`}
          className="press glass-card flex flex-col items-start rounded-3xl border p-4 text-left"
        >
          <span
            className={`flex h-[3.5rem] w-[3.5rem] shrink-0 items-center justify-center rounded-2xl ${item.well}`}
          >
            {/**
             * A gauge where there is a real ratio, the section's own mark
             * where there is not.
             *
             * Haut Budget has no denominator: three shared projects is not
             * three out of anything. A ring drawn at some invented fraction
             * would be a chart of a number nobody measured, and the gauge is
             * the one element on this card a reader will believe without
             * reading the label under it.
             */}
            {item.pct == null ? (
              <span className="flex h-6 w-6 items-center justify-center text-mark [&>svg]:h-6 [&>svg]:w-6">
                {item.icon}
              </span>
            ) : (
              <Gauge
                pct={item.pct}
                size={40}
                stroke={6}
                sweep={0.75}
                dim={item.dim}
                arc="stroke-mark"
                /* The mark at low alpha, never the well's own tint: give both
                   the same colour and the unspent part of the arc is painted
                   in exactly the colour behind it, so an untouched section
                   reads as no ring at all. */
                track="stroke-mark/25"
              />
            )}
          </span>

          <span className="mt-3 block truncate text-label font-bold uppercase leading-tight tracking-wide text-ink">
            {item.label}
          </span>

          <span
            aria-hidden="true"
            className={`mt-1.5 block font-display font-bold leading-none [font-variant-numeric:tabular-nums] ${
              item.dim ? 'text-body text-muted' : 'text-h2 text-ink'
            }`}
          >
            {item.value}
          </span>
          <span aria-hidden="true" className="mt-1 block text-label text-muted">
            {item.word}
          </span>
        </button>
      ))}
    </div>
  )
}
