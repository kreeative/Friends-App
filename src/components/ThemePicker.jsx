import { ACCENTS, MODES, useTheme } from '../lib/theme'
import { useT } from '../lib/i18n'

/**
 * Two rows, because the two choices are independent: the ground, and the one
 * colour that appears on it.
 *
 * The accent swatches are shown in their own colour, which is the only honest
 * way to preview a colour — but each is a filled circle rather than coloured
 * text, so nothing here depends on being able to tell yellow from blue. The
 * selected one is named in the label as well as ringed.
 */
export default function ThemePicker({ className = '' }) {
  const { mode, accent, setMode, setAccent } = useTheme()
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
        <legend className="eyebrow">{t('theme.accent')}</legend>
        <div className="mt-4 flex flex-wrap gap-3">
          {ACCENTS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAccent(a)}
              aria-pressed={accent === a}
              aria-label={t(`theme.accent_${a}`)}
              title={t(`theme.accent_${a}`)}
              className="press flex items-center gap-2 rounded-pill py-1.5 pl-1.5 pr-4 transition-colors"
              style={{
                // The ring has to be drawn in ink rather than in the swatch's
                // own colour, or selecting yellow on white marks nothing.
                boxShadow:
                  accent === a
                    ? 'inset 0 0 0 2px rgb(var(--c-ink) / 0.85)'
                    : 'inset 0 0 0 1px rgb(var(--c-ink) / 0.14)',
              }}
            >
              <span
                aria-hidden="true"
                className="h-6 w-6 rounded-pill"
                style={{ background: SWATCH[a] }}
              />
              <span className="text-small font-semibold text-ink">{t(`theme.accent_${a}`)}</span>
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  )
}

/* Literal values, not tokens: these previews must show the colour they name,
   not the colour currently selected. */
const SWATCH = {
  pink: '#DE3578',
  yellow: '#F8CB02',
  blue: '#009DB9',
}
