import { useEffect } from 'react'

/**
 * Per-page title and description, for a site that has one HTML file.
 *
 * A single-page app serves the same <head> for every route, so without this
 * every page in a search result carries the home page's title and every link
 * shared in a message previews as the home page. Google runs the JavaScript
 * and reads what it finds afterwards, so setting these on mount is enough for
 * search; it is not enough for the crawlers that do not execute scripts —
 * Facebook's and Slack's among them — which is a real limitation and the
 * reason the important ones are also hard-coded in index.html.
 *
 * Kept deliberately small: no library, no context, no <head> manager. Two tags
 * and an og:title, restored on unmount so a page cannot leak its title into
 * the next one.
 */
function setMeta(selector, attr, value) {
  const el = document.head.querySelector(selector)
  if (el) el.setAttribute(attr, value)
  return el
}

export function usePageMeta({ title, description }) {
  useEffect(() => {
    const previousTitle = document.title
    const descEl = document.head.querySelector('meta[name="description"]')
    const ogTitleEl = document.head.querySelector('meta[property="og:title"]')
    const ogDescEl = document.head.querySelector('meta[property="og:description"]')

    const previousDesc = descEl?.getAttribute('content')
    const previousOgTitle = ogTitleEl?.getAttribute('content')
    const previousOgDesc = ogDescEl?.getAttribute('content')

    if (title) {
      document.title = title
      setMeta('meta[property="og:title"]', 'content', title)
    }
    if (description) {
      setMeta('meta[name="description"]', 'content', description)
      setMeta('meta[property="og:description"]', 'content', description)
    }

    return () => {
      document.title = previousTitle
      if (descEl && previousDesc != null) descEl.setAttribute('content', previousDesc)
      if (ogTitleEl && previousOgTitle != null) ogTitleEl.setAttribute('content', previousOgTitle)
      if (ogDescEl && previousOgDesc != null) ogDescEl.setAttribute('content', previousOgDesc)
    }
  }, [title, description])
}
