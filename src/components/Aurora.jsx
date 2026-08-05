import { useTheme } from '../lib/theme'

/**
 * The public site's background.
 *
 * The artwork runs full-bleed and fixed, blurred hard, under a veil of the
 * page's own colour and three drifting blobs of the accent. It is not there
 * to be looked at — it is there to give the glass something worth blurring,
 * and to make the page feel like a place rather than a document.
 *
 * One picture per accent, same rule as everything else: the interface stays
 * one colour, and the multi-hue richness comes from the picture underneath.
 */
const ART = {
  pink: 'bg-pink',
  yellow: 'bg-yellow',
  blue: 'bg-blue',
  // Also in public/photos: bg-purple. One word swaps it in.
}

export default function Aurora() {
  const { accent } = useTheme()
  const name = ART[accent] ?? ART.pink

  return (
    <div className="aurora" aria-hidden="true">
      <picture>
        <source media="(min-width: 768px)" srcSet={`/photos/${name}-wide.webp`} />
        <img src={`/photos/${name}-tall.webp`} alt="" className="aurora-art" />
      </picture>
      <div className="aurora-veil" />
      <span className="aurora-blob aurora-blob-1" />
      <span className="aurora-blob aurora-blob-2" />
      <span className="aurora-blob aurora-blob-3" />
    </div>
  )
}
