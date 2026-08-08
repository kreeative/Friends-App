import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Page-to-page motion.
 *
 * `key` on the wrapper is the whole mechanism: React tears the old subtree
 * out and mounts a new one, so the CSS enter animation replays on every
 * navigation without anything having to orchestrate it.
 *
 * There is no exit animation, deliberately. Playing one means holding the
 * screen you have already left in the tree while the next one mounts, and a
 * couple of hundred milliseconds of a page you are done with reads as lag
 * rather than as polish. Everything arrives; nothing lingers.
 *
 * Only the path is keyed on. Query strings change underneath a page that is
 * staying put. /library?purchase=success is the same screen polling for its
 * entitlement, and remounting there would restart the poll on every tick.
 */
export default function PageTransition({ children }) {
  const { pathname } = useLocation()
  const first = useRef(true)

  /**
   * Land at the top of the new page.
   *
   * The browser keeps the scroll offset across a client-side navigation, so a
   * tall page followed by a short one opens already scrolled, which looks
   * like the transition broke rather than like a position was preserved. Not
   * on first paint though: that would fight a deep link to an anchor.
   */
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  )
}
