/**
 * UN LIEN D'INVITATION QUI SURVIT A L'INSCRIPTION.
 *
 * Le lien /start?join=CODE marchait pour quelqu'un deja connecte. Pour tous
 * les autres, c'est-a-dire tout le monde qui arrive d'une video, il menait a
 * l'accueil public et le code etait perdu: /start n'existait pas hors
 * connexion, et la route attrape-tout renvoyait a /. Il fallait ensuite
 * s'inscrire, accepter les conditions, repondre aux cinq questions, et
 * retrouver le code tout seul.
 *
 * Le code est donc pose ici avant la connexion et repris apres. Dans le
 * stockage du navigateur et pas dans l'adresse: la connexion Google repart de
 * l'origine du site (redirectTo), donc tout ce qui etait dans l'adresse
 * disparait au retour, et les conditions puis les cinq questions sont d'autres
 * ecrans encore.
 *
 * Deux intentions possibles, jamais les deux:
 *   { code }       rejoindre ce groupe
 *   { challenge }  lancer son propre defi (la page /defi sans code)
 *
 * Pur et sans import, comme onboarding.js: le stockage est passe en argument,
 * pour que `npm test` le fasse tourner sous node.
 */

export const JOIN_KEY = 'friends.join'

/** Deux semaines: assez pour s'inscrire un autre jour, pas assez pour qu'un
    vieux lien oublie fasse entrer quelqu'un dans un groupe un mois plus tard. */
export const JOIN_TTL_MS = 14 * 24 * 60 * 60 * 1000

/**
 * Un code tel qu'on le recoit: dans une adresse, colle, en minuscules.
 *
 * create_group en fabrique de six caracteres hexadecimaux en majuscules. On
 * accepte de 4 a 12 lettres et chiffres, comme le formulaire, et on refuse
 * tout le reste: ce texte vient d'une adresse que n'importe qui peut ecrire.
 */
export function cleanCode(raw) {
  const code = String(raw ?? '').trim().toUpperCase()
  return /^[A-Z0-9]{4,12}$/.test(code) ? code : null
}

/** Le seul defi connu. La meme liste que le check de la migration 76. */
const CHALLENGES = ['morning21']

function safe(fn, fallback = null) {
  try {
    return fn()
  } catch {
    /* Navigation privee, stockage plein ou bloque. Sans stockage, le lien
       retombe sur le formulaire, ce qui etait le comportement d'avant. */
    return fallback
  }
}

/** Retient un code a rejoindre. Rend le code retenu, ou null. */
export function rememberJoin(raw, store, now = Date.now()) {
  const code = cleanCode(raw)
  if (!code || !store) return null
  return safe(() => {
    store.setItem(JOIN_KEY, JSON.stringify({ code, at: now }))
    return code
  })
}

/** Retient l'envie de lancer son propre defi. */
export function rememberChallenge(id, store, now = Date.now()) {
  if (!CHALLENGES.includes(id) || !store) return null
  return safe(() => {
    store.setItem(JOIN_KEY, JSON.stringify({ challenge: id, at: now }))
    return id
  })
}

/**
 * Ce qui attend, ou null.
 *
 * Tout ce qui n'a pas exactement la bonne forme compte pour rien: une valeur
 * ecrite a la main dans le stockage ne doit pas devenir un code envoye a la
 * base, ni faire planter l'ecran de demarrage.
 */
export function readJoin(store, now = Date.now()) {
  if (!store) return null
  const raw = safe(() => store.getItem(JOIN_KEY))
  if (!raw) return null
  const value = safe(() => JSON.parse(raw))
  if (!value || typeof value !== 'object') return null
  const at = Number(value.at)
  if (!Number.isFinite(at) || now - at > JOIN_TTL_MS || at - now > 60_000) return null
  const code = cleanCode(value.code)
  if (code) return { code }
  if (CHALLENGES.includes(value.challenge)) return { challenge: value.challenge }
  return null
}

export function forgetJoin(store) {
  if (store) safe(() => store.removeItem(JOIN_KEY))
}

/**
 * Ou envoyer quelqu'un une fois connecte et arrive au bout de l'accueil.
 *
 * Le code se rejoint tout seul (voir AutoJoin dans App.jsx); un defi a lancer
 * ouvre le formulaire de creation deja regle sur le defi.
 */
export function joinTarget(pending) {
  if (pending?.challenge) return `/start?challenge=${encodeURIComponent(pending.challenge)}`
  return null
}
