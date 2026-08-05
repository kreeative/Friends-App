/**
 * Die-cut stickers, stuck on top of the page.
 *
 * They sit ABOVE the glass, not behind it. Behind a panel that is only half
 * opaque, a sticker's black outline shows through as a dark patch under the
 * text — which is exactly what it looked like, and what dropped the worst
 * measured contrast to 2.8:1. On top they behave like actual stickers, and
 * the type underneath is unaffected.
 *
 * Placed in the margins so they overlap panel edges rather than words, and
 * the ones that would land on the measure of a narrow screen are not
 * rendered there at all rather than shrunk into specks.
 *
 * Decoration, stated plainly: aria-hidden, pointer-events-none, and nothing
 * depends on seeing them.
 */
const SETS = {
  hero: [
    { src: 'unicorn', top: '-2%', right: '2%', size: 108, tilt: -12, delay: 0 },
    { src: 'pizza', top: '30%', right: '-2%', size: 86, tilt: 14, delay: 1.2 },
    { src: 'cat', bottom: '4%', right: '14%', size: 82, tilt: 8, delay: 2.1 },
    { src: 'cactus', top: '58%', right: '22%', size: 62, tilt: -7, delay: 2.7 },
    // The two that are allowed on a phone, hanging off the panel's corners
    // where there is no text under them.
    { src: 'thumb', bottom: '-3%', left: '-2%', size: 74, tilt: -16, delay: 1.5, phone: true },
    { src: 'skull', top: '-4%', left: '58%', size: 66, tilt: 18, delay: 0.7, phone: true },
  ],
  close: [
    { src: 'lips', top: '-6%', left: '3%', size: 84, tilt: -10, delay: 0.4, phone: true },
    { src: 'koi', bottom: '-5%', right: '5%', size: 92, tilt: 20, delay: 1.8, phone: true },
    { src: 'deer', top: '18%', right: '-2%', size: 70, tilt: 6, delay: 2.4 },
    { src: 'fox', bottom: '20%', left: '-3%', size: 72, tilt: -14, delay: 3.1 },
  ],
}

export default function Stickers({ set = 'hero' }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20" aria-hidden="true">
      {SETS[set].map((s) => (
        <img
          key={s.src}
          src={`/stickers/${s.src}.png`}
          alt=""
          loading="lazy"
          className={`sticker ${s.phone ? '' : 'hidden md:block'}`}
          style={{
            top: s.top,
            left: s.left,
            right: s.right,
            bottom: s.bottom,
            width: s.size,
            '--tilt': `${s.tilt}deg`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  )
}
