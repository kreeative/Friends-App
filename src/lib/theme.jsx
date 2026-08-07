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
 * script in index.html also does before first paint — so a reload lands on
 * the chosen theme rather than flashing the default. Keep the key and the
 * fallback here in step with that script.
 */
export const THEMES = ['sun', 'sea']

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
    /* Nothing to do — the choice just will not survive a reload. */
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

  useEffect(() => {
    document.documentElement.dataset.theme = theme
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
