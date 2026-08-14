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

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
