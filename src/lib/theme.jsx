import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

/**
 * Theme: two independent choices, stored separately.
 *
 *   mode   system | light | dark
 *   theme  sun | sea
 *
 * A theme is a PAIR now, not a single accent: a field colour for large
 * blocks, and an accent for the things you click.
 *
 *   sun   yellow field, pink accent
 *   sea   blue field, yellow accent
 *
 * Yellow is in both, because it is the one colour in the palette that cannot
 * do the accent job alone — 1.4:1 on white, so as a small mark it vanishes —
 * while being the strongest field there is: black on yellow is 13.5:1, the
 * highest contrast in the set. It leads as a surface; pink or blue leads as
 * an action. The rule that keeps it safe is that fields and accents always
 * carry black type, never white and never coloured type.
 *
 * The values are stamped onto <html> as data attributes, which is also what
 * the inline script in index.html does before first paint — so a reload
 * lands on the chosen theme rather than flashing the default and correcting
 * itself. Keep the keys and the fallbacks here in step with that script.
 */

export const MODES = ['system', 'light', 'dark']
export const THEMES = ['sun', 'sea']

const KEY_MODE = 'rf.mode'
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

function systemMode() {
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function resolveMode(mode) {
  return mode === 'system' ? systemMode() : mode
}

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(() => read(KEY_MODE, MODES, 'system'))
  const [theme, setThemeState] = useState(() => {
    const stored = read(KEY_THEME, THEMES, null)
    if (stored) return stored
    // Migrate the three-accent scheme. Blue was the only cool one, so it
    // becomes sea; pink and yellow both fold into sun.
    return read('rf.accent', ['pink', 'yellow', 'blue'], 'pink') === 'blue' ? 'sea' : 'sun'
  })
  // Held as state rather than read on each render, so that following the OS
  // mid-session actually re-renders. Reading matchMedia inline would compute
  // the right answer and never tell React about it.
  const [sysMode, setSysMode] = useState(systemMode)

  const resolved = mode === 'system' ? sysMode : mode

  useEffect(() => {
    const el = document.documentElement
    el.dataset.mode = resolved
    el.dataset.theme = theme
    // The browser chrome around the page is part of the theme; leaving it on
    // the media-query defaults makes an explicit choice look half-applied.
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', resolved === 'light' ? '#FFFFFF' : '#000000')
  }, [resolved, theme])

  // Attached once, regardless of the current mode: following the OS
  // mid-session is the whole promise of `system`, and the value is ignored
  // while an explicit mode is set.
  useEffect(() => {
    let mq
    try {
      mq = window.matchMedia('(prefers-color-scheme: light)')
    } catch {
      return undefined
    }
    const handler = (e) => setSysMode(e.matches ? 'light' : 'dark')
    mq.addEventListener?.('change', handler)
    return () => mq.removeEventListener?.('change', handler)
  }, [])

  const setMode = useCallback((next) => {
    if (!MODES.includes(next)) return
    setModeState(next)
    write(KEY_MODE, next)
  }, [])

  const setTheme = useCallback((next) => {
    if (!THEMES.includes(next)) return
    setThemeState(next)
    write(KEY_THEME, next)
  }, [])

  const value = useMemo(
    () => ({ mode, theme, resolved, setMode, setTheme }),
    [mode, theme, resolved, setMode, setTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
