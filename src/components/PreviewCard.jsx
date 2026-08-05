import { LANDING } from '../content/landing'
import { useT } from '../lib/i18n'

/**
 * The product, as the illustration.
 *
 * Built from the real interface classes rather than drawn, so it cannot drift
 * away from what people actually get after signing in. It replaces the logo
 * panel that used to sit here: the mark is already in the navigation two
 * inches above, and repeating it said nothing the first one had not.
 */
export default function PreviewCard({ className = '' }) {
  const { locale } = useT()
  const c = (LANDING[locale] ?? LANDING.en).different

  return (
    <div className={`panel p-6 ${className}`}>
      <p className="eyebrow">{c.previewTitle}</p>
      <div className="list mt-4">
        {c.preview.map(([initials, name, chip, label]) => (
          <div key={name} className="flex items-center gap-3.5 py-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-ink/[0.06] text-small text-muted">
              {initials}
            </span>
            <span className="flex-1 text-body text-ink">{name}</span>
            <span className={chip}>{label}</span>
          </div>
        ))}
      </div>
      <div className="mt-5">
        <div className="h-1.5 w-full overflow-hidden rounded-pill bg-ink/[0.07]">
          <div className="h-full w-[62%] rounded-pill bg-accent" />
        </div>
        <p className="mt-2.5 text-small text-muted">{c.previewRate}</p>
      </div>
    </div>
  )
}
