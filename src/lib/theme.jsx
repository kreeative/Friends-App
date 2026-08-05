import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

/**
 * Theme: two independent choices, stored separately.
 *
 *   mode    system | light | dark
 *   accent  pink | yellow | blue
 *
 * Splitting them is what keeps a theme coherent. One accent is on screen at
 * a time; the mode only decides the ground it sits on. Anything that would
 * put two accents in the same view is a bug, not a style.
 *
 * The values are stamped onto <html> as data attributes, which is also what
 * the inline script in index.html does before first paint — so a reload
 * lands on the chosen theme rather than flashing the default and correcting
 * itself. Keep the keys and the fallbacks here in step with that script.
 */

export const MODES = ['system', 'light', 'dark']
export const ACCENTS = ['pink', 'yellow', 'blue']

const KEY_MODE = 'rf.mode'
const KEY_ACCENT = 'rf.accent'

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
  const [accent, setAccentState] = useState(() => read(KEY_ACCENT, ACCENTS, 'pink'))
  // Held as state rather than read on each render, so that following the OS
  // mid-session actually re-renders. Reading matchMedia inline would compute
  // the right answer and never tell React about it.
  const [sysMode, setSysMode] = useState(systemMode)

  const resolved = mode === 'system' ? sysMode : mode

  useEffect(() => {
    const el = document.documentElement
    el.dataset.mode = resolved
    el.dataset.accent = accent
    // The browser chrome around the page is part of the theme; leaving it on
    // the media-query defaults makes an explicit choice look half-applied.
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', resolved === 'light' ? '#FFFFFF' : '#000000')
  }, [resolved, accent])

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

  const setAccent = useCallback((next) => {
    if (!ACCENTS.includes(next)) return
    setAccentState(next)
    write(KEY_ACCENT, next)
  }, [])

  const value = useMemo(
    () => ({ mode, accent, resolved, setMode, setAccent }),
    [mode, accent, resolved, setMode, setAccent]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
