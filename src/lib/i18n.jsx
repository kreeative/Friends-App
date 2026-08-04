import { createContext, useContext, useMemo, useState } from 'react'

/**
 * Two locales, one flat dictionary, no dependency.
 *
 * The copy is translated rather than transliterated — French keeps the same
 * voice the English has (short, plain, warm, second person singular). "Faire
 * le point" carries what "check in" actually means here far better than
 * "s'enregistrer" would.
 *
 * Plurals are handled per-string with a count, because the two languages
 * disagree about them: French treats 0 as singular, English does not.
 */
const STRINGS = {
  en: {
    'nav.home': 'Home',
    'nav.goals': 'Goals',
    'nav.you': 'You',
    'nav.group': 'Group',

    'sync.queued_one': 'Saved. It will send as soon as you’re back online.',
    'sync.queued_other': 'Saved. They will send as soon as you’re back online.',
    'sync.offline': 'You’re offline — anything you write will send itself later.',

    'board.open_for': 'Open for another {t}',
    'board.opens_in': 'Opens in {t}',
    'board.next_opens_in': 'Next one opens in {t}',
    'board.closed': 'Closed for now',
    'board.getting_ready': 'Getting things ready',
    'board.ready': 'Ready when you are',
    'board.nothing_listed': 'Nothing on your list yet — add something first.',
    'board.things_to_look_at_one': '{n} thing to look at. Takes about a minute.',
    'board.things_to_look_at_other': '{n} things to look at. Takes about a minute.',
    'board.check_in': 'Check in',
    'board.this_week': 'This week',
    'board.checked_in_count_one': '{n} of {total} has checked in',
    'board.checked_in_count_other': '{n} of {total} have checked in',
    'board.you': 'you',
    'board.state_away': 'Away this week',
    'board.state_in': 'Checked in',
    'board.state_quiet': 'Didn’t check in',
    'board.state_waiting': 'Not yet',
    'board.next': 'Next: {text}',
    'board.together': 'Together',
    'board.invite': 'Invite someone',
    'board.invite_body': 'It’s just you so far. Send this code to a friend — two to six people works best.',
    'board.did_it': 'Did it',
    'board.partly': 'Got part of the way',
    'board.not_this_week': 'Not this week',

    'goal.times_a_week_one': '{n} time a week',
    'goal.times_a_week_other': '{n} times a week',
    'goal.by_date': 'by {date}',
    'goal.paused': 'paused',
    'goal.proof': 'Proof: {text}',
    'goal.progress': '{done} of {total} so far this week',
    'goal.everyone': 'Everyone',
    'goal.pause': 'Pause',
    'goal.resume': 'Pick it back up',
    'goal.mark_done': 'Mark done',

    'nudge.quiet': '{name} has been quiet for a couple of weeks.',
    'nudge.claimed_by_me': 'You’ve got this one. Send them a message — about them, not about the app.',
    'nudge.claimed_by_other': '{name} is checking in on them.',
    'nudge.assigned': 'Nobody picked this one up, so it came to you. A text is plenty.',
    'nudge.open': 'Someone should say hello — wherever you actually talk, not in here.',
    'nudge.claim': 'I’ll check on them',
    'nudge.close': 'Done — we spoke',
    'nudge.busy': 'One moment',

    'signin.pitch':
      'One check-in a week, at the same time, with the same people. Sixty seconds. That’s the whole thing.',
    'signin.google': 'Continue with Google',
    'signin.use_email': 'Use email instead',
    'signin.email': 'Email',
    'signin.send_link': 'Send me a link',
    'signin.sending': 'Sending',
    'signin.link_sent':
      'Link sent to {email}. Open it on this device — if it opens in a different browser you’ll need to sign in again there.',

    'ui.close': 'Close',
  },

  fr: {
    'nav.home': 'Accueil',
    'nav.goals': 'Objectifs',
    'nav.you': 'Toi',
    'nav.group': 'Groupe',

    'sync.queued_one': 'Enregistré. Ça partira dès que tu seras reconnecté.',
    'sync.queued_other': 'Enregistrés. Ils partiront dès que tu seras reconnecté.',
    'sync.offline': 'Tu es hors ligne — ce que tu écris partira tout seul plus tard.',

    'board.open_for': 'Encore ouvert {t}',
    'board.opens_in': 'Ouvre dans {t}',
    'board.next_opens_in': 'Le prochain ouvre dans {t}',
    'board.closed': 'Fermé pour l’instant',
    'board.getting_ready': 'On prépare tout',
    'board.ready': 'Quand tu veux',
    'board.nothing_listed': 'Rien sur ta liste — commence par ajouter quelque chose.',
    'board.things_to_look_at_one': '{n} chose à regarder. Une minute suffit.',
    'board.things_to_look_at_other': '{n} choses à regarder. Une minute suffit.',
    'board.check_in': 'Faire le point',
    'board.this_week': 'Cette semaine',
    'board.checked_in_count_one': '{n} sur {total} a fait le point',
    'board.checked_in_count_other': '{n} sur {total} ont fait le point',
    'board.you': 'toi',
    'board.state_away': 'Absent cette semaine',
    'board.state_in': 'Fait',
    'board.state_quiet': 'Rien cette semaine',
    'board.state_waiting': 'Pas encore',
    'board.next': 'Ensuite : {text}',
    'board.together': 'Ensemble',
    'board.invite': 'Inviter quelqu’un',
    'board.invite_body':
      'Tu es seul pour l’instant. Envoie ce code à un ami — de deux à six, c’est l’idéal.',
    'board.did_it': 'Fait',
    'board.partly': 'En partie',
    'board.not_this_week': 'Pas cette semaine',

    'goal.times_a_week_one': '{n} fois par semaine',
    'goal.times_a_week_other': '{n} fois par semaine',
    'goal.by_date': 'avant le {date}',
    'goal.paused': 'en pause',
    'goal.proof': 'Preuve : {text}',
    'goal.progress': '{done} sur {total} cette semaine',
    'goal.everyone': 'Tout le monde',
    'goal.pause': 'Mettre en pause',
    'goal.resume': 'Reprendre',
    'goal.mark_done': 'Terminer',

    'nudge.quiet': '{name} n’a rien dit depuis deux semaines.',
    'nudge.claimed_by_me':
      'C’est toi qui t’en occupes. Écris-lui — parle de lui, pas de l’appli.',
    'nudge.claimed_by_other': '{name} prend de ses nouvelles.',
    'nudge.assigned': 'Personne ne s’en est chargé, alors ça te revient. Un message suffit.',
    'nudge.open': 'Quelqu’un devrait lui écrire — là où vous parlez vraiment, pas ici.',
    'nudge.claim': 'Je m’en occupe',
    'nudge.close': 'C’est fait — on s’est parlé',
    'nudge.busy': 'Un instant',

    'signin.pitch':
      'Un point par semaine, au même moment, avec les mêmes personnes. Une minute. C’est tout.',
    'signin.google': 'Continuer avec Google',
    'signin.use_email': 'Utiliser mon e-mail',
    'signin.email': 'E-mail',
    'signin.send_link': 'Envoyez-moi un lien',
    'signin.sending': 'Envoi',
    'signin.link_sent':
      'Lien envoyé à {email}. Ouvrez-le sur cet appareil — s’il s’ouvre dans un autre navigateur, il faudra vous reconnecter là-bas.',

    'ui.close': 'Fermer',
  },
}

const STORE_KEY = 'friends.locale'

export function detectLocale() {
  const saved = localStorage.getItem(STORE_KEY)
  if (saved && STRINGS[saved]) return saved
  const nav = (navigator.languages?.[0] || navigator.language || 'en').toLowerCase()
  return nav.startsWith('fr') ? 'fr' : 'en'
}

const I18nCtx = createContext(null)

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(detectLocale)

  const value = useMemo(() => {
    const dict = STRINGS[locale] ?? STRINGS.en

    /**
     * t('board.check_in')
     * t('goal.progress', { done: 5, total: 8 })
     * t('board.things_to_look_at', { n: 3 })   -> picks _one / _other by n
     */
    const t = (key, vars = {}) => {
      let k = key
      if ('n' in vars && !dict[key]) {
        // French counts 0 as singular; English does not.
        const one = locale === 'fr' ? Math.abs(vars.n) < 2 : Math.abs(vars.n) === 1
        k = `${key}_${one ? 'one' : 'other'}`
      }
      const raw = dict[k] ?? STRINGS.en[k] ?? key
      return raw.replace(/\{(\w+)\}/g, (_, name) => (name in vars ? String(vars[name]) : `{${name}}`))
    }

    const setLocale = (next) => {
      localStorage.setItem(STORE_KEY, next)
      setLocaleState(next)
      document.documentElement.lang = next
    }

    return { locale, t, setLocale }
  }, [locale])

  document.documentElement.lang = locale

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>
}

export function useT() {
  const ctx = useContext(I18nCtx)
  if (!ctx) throw new Error('useT must be used inside I18nProvider')
  return ctx
}

/** For date and number formatting that should follow the chosen locale. */
export const localeTag = (locale) => (locale === 'fr' ? 'fr-FR' : 'en-GB')
