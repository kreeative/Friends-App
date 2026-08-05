import { useTheme } from '../lib/theme'

/**
 * The cover: a canopy photographed from underneath, running full width behind
 * the navigation, with the opening words on a sheet of glass over it.
 *
 * One photograph per accent, and the pairing is not arbitrary — each image is
 * already dominated by the colour it is shown with, so choosing a theme
 * repaints the whole page rather than putting a second hue next to the first.
 * That is the same rule the interface follows.
 *
 * Two crops of each, because a wide band cropped into a tall phone-shaped box
 * loses the canopy entirely and leaves you looking at bark.
 */
const PHOTO = {
  pink: 'canopy-pink',
  yellow: 'canopy-yellow',
  blue: 'canopy-blue',
  // Also in public/photos: canopy-pink-painted, the illustrated one. Swapping
  // it in is a one-word change here — it is left out by default only because
  // mixing a painting with three photographs reads as an accident.
}

export default function Cover({ children }) {
  const { accent } = useTheme()
  const name = PHOTO[accent] ?? PHOTO.pink

  return (
    /* Pulled up under the floating nav so the photograph starts at the very
       top of the page, and padded back down by the same amount. */
    <section className="relative isolate -mt-24 overflow-hidden pt-24">
      <picture>
        <source media="(min-width: 768px)" srcSet={`/photos/${name}-wide.webp`} />
        <img
          src={`/photos/${name}-tall.webp`}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 -z-10 h-full w-full object-cover"
          fetchPriority="high"
        />
      </picture>
      {/* Sits between the photograph and the glass. Without it the panel's
          own translucency has nothing to separate it from a bright sky. */}
      <div className="cover-scrim absolute inset-0 -z-10" aria-hidden="true" />

      <div className="mx-auto flex w-full max-w-5xl items-end px-6 pb-14 pt-24 md:min-h-[34rem] md:pb-20">
        {children}
      </div>
    </section>
  )
}
