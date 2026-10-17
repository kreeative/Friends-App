/**
 * Dictation in the coach's box ("un bouton pour parler, genre dicter"), with
 * the speech recognition the browser already has: the Web Speech API. Pure
 * and without React, for `npm test`; the button is in src/bb/Composer.jsx.
 *
 * Who has it: Chrome, Edge and Safari. Firefox does not, nor the Android
 * WebView that TikTok and Instagram open links in, and there the mic is not
 * drawn at all rather than drawn and dead.
 *
 * Two places have the API and still do nothing when it starts: an app added
 * to the home screen of an iPhone or iPad, and the windows other apps open
 * pages in (Maximiliano Firtman, firt.dev/ios-14.5; WebKit bug 225298). The
 * mic is hidden there too. The keyboard's own mic works in any box, and so
 * does a dictation keyboard such as Wispr Flow's, which has no web SDK to
 * build in: its keyboard is how it reaches a web page.
 *
 * On a phone it listens for one sentence and stops by itself when the
 * student stops talking; a second tap carries on after what is there.
 * Chrome on Android repeats words when it listens continuously, and on an
 * iPhone continuous listening is not proven. On a computer it listens until
 * the second tap.
 */
import { inAppBrowser } from '../inAppBrowser.js'

/** The recognition to use on this page and how, or null for no mic. */
export function dictationSupport(win = typeof window === 'undefined' ? undefined : window) {
  const Recognition = win?.SpeechRecognition ?? win?.webkitSpeechRecognition
  if (!Recognition) return null
  const nav = win.navigator ?? {}
  const ua = String(nav.userAgent ?? '')
  if (inAppBrowser(ua)) return null
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    /* iPadOS says it is a Mac; the touch points give it away. */
    ((nav.platform === 'MacIntel' || /Macintosh/.test(ua)) && (nav.maxTouchPoints ?? 0) > 1)
  const standalone = nav.standalone === true || win.matchMedia?.('(display-mode: standalone)')?.matches === true
  if (iOS && standalone) return null
  return { Recognition, continuous: !iOS && !/Android|Mobi/i.test(ua) }
}

/* The variants Apple's and Google's recognition both know. Any other one
   (fr-SN, en-NG) listens in the main variant rather than risk an error. */
const VARIANTS = {
  fr: ['fr-FR', 'fr-CA', 'fr-BE', 'fr-CH'],
  en: ['en-US', 'en-GB', 'en-CA', 'en-AU', 'en-IN', 'en-IE', 'en-NZ', 'en-ZA'],
}

/** The language to listen in: the app's, in the phone's own variant when it is a known one. */
export function speechLang(locale, navLang) {
  const list = VARIANTS[locale === 'en' ? 'en' : 'fr']
  const asked = String(navLang ?? '').toLowerCase()
  return list.find((v) => v.toLowerCase() === asked) ?? list[0]
}

/** What was said so far: the finished sentences and the one still being heard. */
export function heard(results) {
  const parts = []
  for (let i = 0; i < (results?.length ?? 0); i += 1) parts.push(String(results[i]?.[0]?.transcript ?? '').trim())
  return parts.filter(Boolean).join(' ')
}

/** The box: what was typed, then what was said, a capital when it opens the question. */
export function withSpeech(base, said) {
  const text = String(said ?? '').trim()
  const typed = String(base ?? '')
  if (!text) return typed
  if (!typed.trim()) return text.charAt(0).toLocaleUpperCase() + text.slice(1)
  return /\s$/.test(typed) ? typed + text : `${typed} ${text}`
}

/** The line to show when listening stops on an error, or null to say nothing. */
export function dictationNote(error) {
  if (error === 'no-speech' || error === 'aborted') return null
  if (error === 'not-allowed') return 'denied'
  if (error === 'network') return 'offline'
  return 'off'
}
