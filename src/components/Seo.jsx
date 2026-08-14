import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { seoFor } from '../lib/seo'

/**
 * Tells each URL what it is.
 *
 * Renders nothing. Mounted once, inside the router, and rewrites the four
 * tags in the head that are per page and were per site: the canonical link,
 * og:url, the title and the description.
 *
 * WHAT THIS DOES NOT DO.
 *
 * Titles and descriptions. Those belong to the page, because they come from
 * its own content and its own language: About takes them from the essay it is
 * showing, a chapter from the book. usePageMeta in src/lib/pageMeta.js has
 * done that since before this file existed, and a second writer setting the
 * same two tags from a table of English strings would fight it and win or
 * lose depending on effect order. This sets only what is a fact about the
 * URL rather than about the words on it.
 *
 * WHY THE HEAD IS EDITED BY HAND HERE.
 *
 * React 19 hoists <title> and <meta> rendered anywhere in the tree. This is
 * React 18, which does not, and a helmet library is a dependency for three
 * setAttribute calls. See src/lib/seo.js for the decision it is carrying out
 * and why it mattered enough to do at all.
 *
 * HOW MUCH THIS IS WORTH, HONESTLY.
 *
 * Googlebot renders JavaScript and does read a canonical set this way, but on
 * a second pass, queued, and some crawlers never run the script at all. The
 * strong version of this fix is serving the right HTML per URL, which needs
 * prerendering or a framework this project does not use. What this does is
 * turn an active instruction to de-index six pages into a correct one, which
 * is the whole of the difference between the sitemap being submitted into a
 * site that contradicts it and one that agrees with it.
 */

/** Set or create one meta tag, keyed the way that tag is normally keyed. */
function meta(attr, name, content) {
  if (content == null) return
  let el = document.head.querySelector(`meta[${attr}="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

export default function Seo() {
  const { pathname } = useLocation()

  useEffect(() => {
    const s = seoFor(pathname)

    let link = document.head.querySelector('link[rel="canonical"]')
    if (!link) {
      link = document.createElement('link')
      link.setAttribute('rel', 'canonical')
      document.head.appendChild(link)
    }
    link.setAttribute('href', s.canonical)

    meta('property', 'og:url', s.canonical)

    /**
     * The signed-in screens, said out loud.
     *
     * robots.txt asks crawlers not to fetch these. This is the second half of
     * that: a URL found some other way, in a shared link or a browser's
     * history sync, is told not to be indexed by the page itself. The tag is
     * removed again rather than left behind on the way back out to a public
     * page, or one navigation would poison the rest of the session.
     */
    const robots = document.head.querySelector('meta[name="robots"]')
    if (s.noindex) {
      meta('name', 'robots', 'noindex, nofollow')
    } else if (robots) {
      robots.remove()
    }
  }, [pathname])

  return null
}
