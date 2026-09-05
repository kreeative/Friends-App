import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

/**
 * Theme: one choice.
 *
 *   theme  sun | sea   [data-theme]
 *
 *   sun   pink type, yellow field
 *   sea   blue type, yellow field
 *
 * The light/dark split is gone. It was a second complete set of contrast
 * decisions for a surface that is now white and saturated colour throughout,
 * and a dark ground makes the yellow field either glow or turn to mud.
 *
 * The value is stamped onto <html> as a data attribute, which the inline
 * script in index.html also does before first paint, so a reload lands on
 * the chosen theme rather than flashing the default. Keep the key and the
 * fallback here in step with that script.
 */
export const THEMES = ['sun', 'sea']

/**
 * The ground each theme paints, as a literal hex.
 *
 * The same two values as --c-bg in index.css, and the duplication is not an
 * oversight: this one is read by JavaScript to write a `theme-color` meta tag,
 * and a meta tag cannot hold `rgb(var(--c-bg))`. It wants a colour.
 *
 * WHAT theme-color ACTUALLY DOES, AND WHY IT WAS WRONG.
 *
 * It colours the browser toolbar on Android and the status bar of an installed
 * app. It was hard-coded to #FFFFFF in index.html while the manifest declared
 * #DE3578, which is neither of these and is not a colour the app paints
 * anywhere. Three values, two of them wrong: an installed app opened with a
 * white bar above a blush page, and a saturated pink one the moment anything
 * read the manifest instead.
 *
 * The right answer is the top of the page, so the bar and the page are one
 * surface and the seam disappears. That is --c-bg, and it changes with the
 * theme, which is why this is set from JavaScript rather than left in the HTML.
 *
 * KEEP IN STEP WITH: the inline script in index.html, which does the same
 * thing before React exists, and the two --c-bg declarations in index.css.
 */
export const GROUND = { sun: '#FFF5F7', sea: '#F0F9FF' }

/**
 * The brand tile's own ground, per theme.
 *
 * Sampled from the corner pixel of public/brand/wordmark-pink.png and
 * wordmark-blue.png, so it is the artwork's colour rather than a guess at it.
 * Used by the welcome deck, which paints the whole screen this colour so the
 * logo tile dissolves into it and only the yellow lettering floats.
 *
 * NOT the app's ground. --c-bg is the near-white the product is read on all
 * day; this is the poster colour, and it is used on exactly one screen.
 *
 * Text cannot sit on it unaided: white measures 4.30:1 on the pink and
 * 3.22:1 on the teal, both under the 4.5 body copy needs. The deck puts its
 * words on a white card for that reason and keeps to white only where the
 * type is large enough for the 3:1 bar.
 */
/**
 * The poster colour, and it has to BE the colour inside the logo artwork.
 *
 * THIS IS WHAT MADE THE LOGO LOOK LIKE A STICKER STUCK ON THE PAGE.
 *
 * sun was #DE3578, which is the pink the brand PNGs were drawn on. The
 * artwork moved to #FF007A when the palette was unified and this did not,
 * because it lives in a different file and nothing connects them. The splash
 * and the onboarding deck then painted a #FF007A rounded square in the middle
 * of a #DE3578 page: two pinks a few units apart, with a rounded edge between
 * them, which is exactly the patch effect that was reported.
 *
 * One value now. The tile's own ground and the page behind it are the same
 * colour, so the square has no edge to show and the lettering reads as being
 * set directly on the background. No wrapper had to be removed and no logotype
 * had to be replaced with type; there was only ever one colour too many.
 *
 * If the artwork colour changes again, scripts/brand-icons.py and this line
 * move together or the patch comes back.
 */
export const BRAND = { sun: '#FF007A', sea: '#009DB9' }

/**
 * Stamp the theme onto the document.
 *
 * Both halves together, because they are one fact about the page and splitting
 * them is how they came to disagree in the first place.
 */
export function applyTheme(theme) {
  const key = THEMES.includes(theme) ? theme : 'sun'
  document.documentElement.dataset.theme = key

  const meta = document.head.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', GROUND[key])
}

const KEY_THEME = 'rf.theme'

/* localStorage throws outright in a few privacy configurations rather than
   returning null, and this runs at mount on every screen. */
function read(key, allowed, fallback) {
  try {
    const v = localStorage.getItem(key)
    return allowed.includes(v) ? v : fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* Nothing to do, the choice just will not survive a reload. */
  }
}

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    const stored = read(KEY_THEME, THEMES, null)
    if (stored) return stored
    // Migrate the older schemes. Blue was the only cool one, so it becomes
    // sea; pink and yellow both fold into sun.
    return read('rf.accent', ['pink', 'yellow', 'blue'], 'pink') === 'blue' ? 'sea' : 'sun'
  })

  /* The status bar follows the theme too, so switching from sun to sea in
     Settings changes the bar with the page rather than leaving a pink strip
     above a blue app until the next reload. */
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setTheme = useCallback((next) => {
    if (!THEMES.includes(next)) return
    setThemeState(next)
    write(KEY_THEME, next)
  }, [])

  /**
   * Take the account's theme, but only on a device that has never chosen one.
   *
   * The theme has always been per device, which is right: it is what the screen
   * in your hand looks like and it has to be applied before the first paint, so
   * localStorage is the only place it can live. It is also why choosing Sea on
   * a phone left a tablet on the default, and this product is used from a phone
   * and a tablet by the same person on the same day.
   *
   * So the account carries the answer too, and this is the rule for reconciling
   * them: a device with something stored keeps it, always. Whoever last pressed
   * the picker ON THIS DEVICE outranks a row written from another one, because
   * they were looking at this screen when they decided.
   *
   * DELIBERATELY DOES NOT WRITE localStorage. Adopting is not choosing. If this
   * stored the adopted value, this device would immediately have an opinion of
   * its own and would stop following the account, so changing the theme on the
   * phone would never again reach the tablet. Re-adopting on every load is
   * free: it is one string comparison against state that is already correct.
   */
  const adopt = useCallback((next) => {
    if (!THEMES.includes(next)) return
    if (read(KEY_THEME, THEMES, null)) return
    setThemeState(next)
  }, [])

  const value = useMemo(() => ({ theme, setTheme, adopt }), [theme, setTheme, adopt])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
