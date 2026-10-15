/**
 * LE NAVIGATEUR INTEGRE D'UNE APPLICATION.
 *
 * Un lien touche dans TikTok, Instagram ou Facebook ne s'ouvre pas dans
 * Safari ou Chrome mais dans une fenetre de l'application elle-meme. Google
 * y refuse sa propre connexion depuis 2021 (erreur 403 "disallowed_useragent"):
 * le bouton "Continuer avec Google" mene a une page d'erreur de Google, et la
 * personne venue d'une video n'a aucun moyen de comprendre pourquoi.
 *
 * Le code par e-mail, lui, marche partout. Les ecrans d'invitation et de
 * connexion s'en servent pour le proposer d'abord, et dire en une phrase
 * comment passer par Google si on y tient: ouvrir la page dans le vrai
 * navigateur.
 *
 * Reconnu a l'agent utilisateur, faute de mieux: ces fenetres n'ont pas
 * d'autre signe. Pur et sans import, pour `npm test`.
 */

const APPS = [
  /* TikTok: musical_ly sur iPhone, trill ou BytedanceWebview sur Android.
     Pas de \b apres musical_ly: la version suit, "musical_ly_34.1.0", et le
     tiret bas fait partie du mot, donc la frontiere n'existe pas. */
  ['tiktok', /\bmusical_ly|\bBytedanceWebview\b|\btrill_\d|\bTikTok\b/i],
  ['instagram', /\bInstagram\b/i],
  ['facebook', /\bFBAN\/|\bFBAV\/|\bFB_IAB\b|\bFBIOS\b/i],
  ['snapchat', /\bSnapchat\b/i],
  ['linkedin', /\bLinkedInApp\b/i],
  ['line', /\bLine\/\d/i],
]

/** Le nom de l'application qui affiche la page, ou null pour un vrai navigateur. */
export function inAppBrowser(userAgent) {
  const ua = String(userAgent ?? '')
  if (!ua) return null
  for (const [name, re] of APPS) if (re.test(ua)) return name
  return null
}

/** Le meme, pour la page en cours. Null hors d'un navigateur. */
export function currentInAppBrowser() {
  try {
    return inAppBrowser(globalThis.navigator?.userAgent)
  } catch {
    return null
  }
}
