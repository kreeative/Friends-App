import { MODES, THEMES, useTheme } from '../lib/theme'
import { useT } from '../lib/i18n'

/**
 * Two rows, because the two choices are independent: the ground, and the pair
 * of colours that appears on it.
 *
 * A theme is a pair now, so each option previews BOTH of its colours — the
 * field as the larger block and the accent as the smaller one, in the same
 * proportion they appear at on a page. Showing one swatch would be a preview
 * of half the choice.
 *
 * The selected one is named as well as ringed, and the ring is drawn in ink
 * rather than in the theme's own colour — a yellow ring on a white ground
 * marks nothing.
 */
export default function ThemePicker({ className = '' }) {
  const { mode, theme, setMode, setTheme } = useTheme()
  const { t } = useT()

  return (
    <div className={className}>
      <fieldset>
        <legend className="eyebrow">{t('theme.appearance')}</legend>
        <div className="mt-4 flex flex-wrap gap-2">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={mode === m ? 'chip-accent press' : 'chip-quiet press'}
            >
              {t(`theme.mode_${m}`)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-7">
        <legend className="eyebrow">{t('theme.colour')}</legend>
        <div className="mt-4 flex flex-wrap gap-3">
          {THEMES.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setTheme(name)}
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
   the colour currently selected. */
const SWATCH = {
  sun: { field: '#F8CB02', accent: '#DE3578' },
  sea: { field: '#009DB9', accent: '#F8CB02' },
}
