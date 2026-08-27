import { stickerSrc } from '../../lib/art'

/**
 * The app, in a phone, on the front page.
 *
 * WHY A DRAWN MOCKUP AND NOT A SCREENSHOT.
 *
 * A screenshot is a picture of one build on one day. It goes stale silently:
 * the palette changed twice this month and the budget's sections became
 * sub-pages, and a PNG would still be showing the old one with nobody the
 * wiser. This is markup, so when the app's shape changes the mismatch is at
 * least visible to whoever changes it.
 *
 * It also weighs nothing, stays sharp at any density, and does not need a
 * second copy for the other theme.
 *
 * WHY IT IS PINK INSIDE A NEUTRAL PAGE.
 *
 * The shell around it is off-white on purpose: a stranger has not chosen a
 * theme yet. But this is a picture OF the app, and the app is pink, so the
 * frame carries explicit colours rather than the page's tokens. That contrast
 * is the point: the neutral page holds a coloured object, which is how you
 * show somebody what they are about to get.
 *
 * ONE IMAGE TO ANYTHING THAT READS RATHER THAN LOOKS.
 *
 * Every figure inside is illustrative, so read out one by one they would be a
 * stream of numbers nobody can assemble into a screen. The frame is role="img"
 * with a sentence describing what it shows, and everything inside is hidden.
 */
export default function PhoneMockup({ label, screen }) {
  return (
    <div className="relative mx-auto w-full max-w-[19rem]">
      {/* Two stickers, and only two. The page already floats a set down both
          margins; a crowd around the frame is what the brief called cluttering
          the text, and the frame is the one thing here that should be looked
          at rather than scanned past. */}
      <img
        src={stickerSrc('coin')}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -left-8 top-16 w-16 -rotate-12 drop-shadow-md sm:-left-12 sm:w-20"
      />
      <img
        src={stickerSrc('bass')}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -right-7 bottom-24 w-16 rotate-12 drop-shadow-md sm:-right-11 sm:w-20"
      />

      <div
        role="img"
        aria-label={label}
        data-hook="mockup"
        /* The bezel. A real border rather than a shadow, because on the
           off-white ground a shadow alone gave the phone no edge at all: the
           same 1.10:1 problem the cards had when the gradient ground went. */
        className="relative rounded-[2.5rem] border-[3px] border-[#111111] bg-[#111111] p-2 shadow-2xl"
      >
        {/* The notch. Purely a signal that this is a phone, so it is small and
            does not pretend to be any particular handset. */}
        <div className="absolute left-1/2 top-3 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-[#111111]" />

        <div
          aria-hidden="true"
          className="overflow-hidden rounded-[2rem] bg-[#FFF5F7] px-4 pb-5 pt-9 text-left"
        >
          <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-[#5E5057]">
            {screen.eyebrow}
          </p>
          <p className="mt-1 font-display text-[1.4rem] font-bold leading-none text-[#1E181B]">
            {screen.title}
          </p>

          {/* The hero: what is left, and how much of the month has gone. */}
          <div className="mt-3 rounded-2xl border border-[#1E181B]/[0.18] bg-white p-3.5">
            <p className="text-[0.55rem] font-bold uppercase tracking-[0.1em] text-[#5E5057]">
              {screen.left}
            </p>
            <p className="mt-1 font-display text-[1.75rem] font-bold leading-none text-[#1E181B] [font-variant-numeric:tabular-nums]">
              {screen.amount}
            </p>
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[#1E181B]/[0.08]">
              <div className="h-full w-[68%] rounded-full bg-[#FF007A]" />
            </div>
          </div>

          <div className="mt-3 rounded-full bg-[#FF007A] py-2 text-center text-[0.7rem] font-bold text-[#111111]">
            {screen.cta}
          </div>

          {/* The bento. Four sections, two of them named in the brief, drawn as
              the app draws them: a tinted well, a name, a figure. */}
          <p className="mt-4 text-[0.55rem] font-bold uppercase tracking-[0.12em] text-[#5E5057]">
            {screen.sections}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {screen.cards.map((card) => (
              <div
                key={card.name}
                className="rounded-2xl border border-[#1E181B]/[0.18] bg-white p-2.5"
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-xl"
                  style={{ backgroundColor: card.well }}
                >
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: card.dot }} />
                </span>
                <p className="mt-2 truncate text-[0.55rem] font-bold uppercase tracking-wide text-[#1E181B]">
                  {card.name}
                </p>
                <p className="mt-0.5 font-display text-[0.95rem] font-bold leading-none text-[#1E181B] [font-variant-numeric:tabular-nums]">
                  {card.value}
                </p>
                <p className="mt-0.5 truncate text-[0.5rem] text-[#5E5057]">{card.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
