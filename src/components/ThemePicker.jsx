import { THEMES, useTheme } from '../lib/theme'
import { useT } from '../lib/i18n'
import { useAuth } from '../context/AuthContext'

/**
 * One row now, the ground is no longer a choice, so a theme is just the pair
 * of colours.
 *
 * A theme is a pair now, so each option previews BOTH of its colours, the
 * field as the larger block and the accent as the smaller one, in the same
 * proportion they appear at on a page. Showing one swatch would be a preview
 * of half the choice.
 *
 * The selected one is named as well as ringed, and the ring is drawn in ink
 * rather than in the theme's own colour, a yellow ring on a white ground
 * marks nothing.
 */
/**
 * `variant="chips"` is the footer's version.
 *
 *   "la bannière pour le thème de couleur, je trouve que c'est bizarre par
 *    rapport au reste du design."
 *
 * In the footer the swatches sat in a white card of their own under the
 * columns: a box of app settings dropped onto a page of white pills and bold
 * links, with nothing else on the panel shaped like it. The chips are the
 * language toggle's shape exactly, under a pill label like every column's:
 * the choice is black, the other is white, and the dots show the pair. Same
 * pick(), same aria-pressed; only the drawing changes, and the app's screens
 * keep the swatches.
 */
export default function ThemePicker({ className = '', variant = 'swatches' }) {
  const { theme, setTheme } = useTheme()
  const { t } = useT()
  const { updateProfile } = useAuth() ?? {}

  /**
   * The device decides what you see; the account remembers what you chose.
   *
   * Same shape as LanguagePicker, and for a related reason. setTheme is what
   * repaints the page, instantly and with no round trip, and it stays the thing
   * that does that. The profile write is so the choice survives being made on
   * one device: this app is used from a phone and a tablet by the same person
   * on the same day, and picking Sea on the phone used to leave the tablet
   * pink forever.
   *
   * Not awaited, and its failure is swallowed on purpose. On a database where
   * migration 56 has not been run there is no theme column, so this write comes
   * back with an error and nothing else happens: the page has already changed
   * colour, which is the part anybody asked for.
   */
  const pick = (name) => {
    setTheme(name)
    updateProfile?.({ theme: name })?.catch?.(() => {})
  }

  if (variant === 'chips') {
    return (
      <div className={className} role="group" aria-labelledby="theme-chips-label" data-hook="theme-chips">
        <p id="theme-chips-label" className="tag tag-flat">
          {t('theme.colour')}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {THEMES.map((name) => {
            const on = theme === name
            return (
              <button
                key={name}
                type="button"
                onClick={() => pick(name)}
                aria-pressed={on}
                className={`press flex items-center gap-2 rounded-pill py-1.5 pl-1.5 pr-4 text-small font-bold ${
                  on ? 'bg-[#111111] text-white' : 'bg-white text-[#111111]'
                }`}
              >
                <span aria-hidden="true" className="flex items-center">
                  <span className="h-5 w-5 rounded-pill" style={{ background: SWATCH[name].field }} />
                  <span
                    className="-ml-2 h-4 w-4 rounded-pill ring-2"
                    style={{ background: SWATCH[name].accent, '--tw-ring-color': on ? '#111111' : '#ffffff' }}
                  />
                </span>
                {t(`theme.name_${name}`)}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <fieldset>
        <legend className="eyebrow">{t('theme.colour')}</legend>
        <div className="mt-4 flex flex-wrap gap-3">
          {THEMES.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => pick(name)}
              aria-pressed={theme === name}
              aria-label={t(`theme.name_${name}`)}
              className="press flex items-center gap-2.5 rounded-pill py-1.5 pl-1.5 pr-4 transition-shadow"
              style={{
                boxShadow:
                  theme === name
                    ? 'inset 0 0 0 2px rgb(var(--c-ink) / 0.85)'
                    : 'inset 0 0 0 1px rgb(var(--c-ink) / 0.14)',
              }}
            >
              <span aria-hidden="true" className="flex items-center">
                <span
                  className="h-7 w-7 rounded-pill"
                  style={{ background: SWATCH[name].field }}
                />
                <span
                  className="-ml-2.5 h-5 w-5 rounded-pill ring-2"
                  style={{
                    background: SWATCH[name].accent,
                    '--tw-ring-color': 'rgb(var(--c-bg))',
                  }}
                />
              </span>
              <span className="text-small font-semibold text-ink">
                {t(`theme.name_${name}`)}
              </span>
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  )
}

/* Literal values, not tokens: a preview has to show the colour it names, not
   the colour currently selected.

   The sun pink was #DE3578, the ground the logo PNGs were drawn on before
   scripts/brand-icons.py moved every pink to #FF007A ("three pinks" is the
   note there). This was the last copy of the old one. */
const SWATCH = {
  sun: { field: '#F8CB02', accent: '#FF007A' },
  sea: { field: '#009DB9', accent: '#F8CB02' },
}
