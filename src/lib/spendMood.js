/**
 * Le sticker de la carte "Reste a depenser", selon ou en est le mois.
 *
 *   "The budget section should be actually funny and responsive."
 *
 * La carte disait la meme chose de la meme facon a chaque etat, un chiffre et
 * une phrase grise. Le sticker repond: pas encore de paie, le portefeuille;
 * tout va bien, CHACHING; 85 % ou plus depense, le feu; depasse, le crane en
 * feu. Decoratif seulement: la phrase sous la barre dit deja l'etat en mots,
 * donc rien ne depend de l'image (WCAG 1.4.1).
 *
 * `bar` est la sortie de spendable() dans envelope.js. Ici et pas dans
 * Envelopes.jsx pour que npm test le lise sans bundler.
 */
export const HOT_PCT = 85

export function spendMood(bar) {
  if (!bar?.funded) return 'wallet'
  if (bar.over > 0) return 'skullfire'
  if (bar.pct >= HOT_PCT) return 'fire'
  return 'chaching'
}
