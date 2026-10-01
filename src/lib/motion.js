/**
 * LE GESTE SOUS LE DOIGT, PARTOUT.
 *
 *   "why is there zero motion design on the app ? i need it right now
 *    everywhere at every button"
 *
 * Il y avait un appui en CSS (.press:active, scale .97 en 90 ms) et il
 * n'etait pas partout: seulement sur les elements qui portaient la classe,
 * jamais sur une case a cocher, un onglet, un lien-carte sans la classe, un
 * menu deroulant. Et sur un iPhone, :active ne s'allume pas toujours au
 * toucher, donc meme la ou la classe etait, le doigt ne voyait rien. Ca se
 * resume bien en "zero motion design".
 *
 * Ici: UN ecouteur sur le document. pointerdown trouve l'element le plus
 * proche qui se presse et l'enfonce; pointerup le relache. L'aller est court
 * (90 ms, le doigt doit sentir la reponse) et le retour est un ressort qui
 * depasse un peu avant de se poser (380 ms sur la courbe de la maison).
 *
 * C'est la propriete `scale` qui est animee, pas `transform`. Elle se
 * compose avec tout ce que l'element porte deja: un bouton centre par
 * translate ne saute pas, une carte inclinee par `rotate` reste inclinee,
 * un sticker qui tourne au survol continue de tourner. Et comme c'est une
 * animation Web Animations, aucune classe Tailwind `transition-colors` ne
 * peut lui retirer sa transition en route, ce qui arrivait a la version CSS.
 *
 * Un petit bouton s'enfonce plus qu'une grande carte: 6 % pour un bouton de
 * 48 px, 1,5 % pour une carte de 390. Le meme nombre de pixels, a peu pres,
 * et c'est ce qui donne la meme sensation.
 *
 * prefers-reduced-motion: rien ne bouge. Lu a chaque appui, pas une fois au
 * demarrage, pour suivre le reglage sans recharger la page.
 */

/** Ce qui se presse. Un lien n'en fait partie que s'il est un bloc (voir pressTarget). */
export const PRESSABLE =
  'button, [role="button"], [role="tab"], [role="switch"], summary, a[href], label, select, input[type="checkbox"], input[type="radio"]'

/** La courbe de la maison: le gros du chemin au debut, les derniers pixels prennent le reste. */
export const SETTLE = 'cubic-bezier(0.32, 0.72, 0, 1)'

export const DOWN_MS = 90
export const UP_MS = 380

/**
 * De combien ca s'enfonce: 8 px de bord perdus, bornes entre 6 % et 1,5 %.
 * Sans taille connue, un bouton moyen.
 */
export function pressScale(width, height) {
  const size = Math.max(Number(width) || 0, Number(height) || 0)
  if (!size) return 0.96
  return Math.min(0.985, Math.max(0.94, 1 - 8 / size))
}

/**
 * L'element qui doit bouger pour ce qui vient d'etre touche, ou null.
 *
 * - une case a cocher dans son etiquette: l'etiquette entiere, c'est elle
 *   que le doigt a visee;
 * - une etiquette sans case dedans: du texte, rien;
 * - un lien en ligne dans une phrase: un mot, rien. Un lien en bloc (une
 *   carte, un onglet) est un bouton;
 * - desactive, ou marque data-still: rien.
 */
export function pressTarget(el, win) {
  let node = typeof el?.closest === 'function' ? el.closest(PRESSABLE) : null
  if (!node) return null
  const tag = String(node.tagName ?? '').toUpperCase()
  if (tag === 'INPUT') {
    const label = node.closest('label')
    if (label) node = label
  }
  const nodeTag = String(node.tagName ?? '').toUpperCase()
  if (nodeTag === 'LABEL' && !node.querySelector?.('input[type="checkbox"], input[type="radio"]')) return null
  if (node.disabled || node.getAttribute?.('aria-disabled') === 'true') return null
  if (node.hasAttribute?.('data-still')) return null
  if (nodeTag === 'A') {
    const display = win?.getComputedStyle?.(node)?.display
    if (!display || display === 'inline') return null
  }
  return node
}

export function downFrames(s) {
  return [{ scale: 1 }, { scale: s }]
}

/** Le ressort: on repasse un peu au-dessus de 1 avant de se poser. */
export function upFrames(s) {
  const over = 1 + (1 - s) * 0.55
  return [{ scale: s }, { scale: over, offset: 0.45 }, { scale: 1 }]
}

/**
 * Branche le geste. Rend la fonction qui le debranche.
 *
 * Sans Web Animations (un navigateur qui n'a pas element.animate) ou sans
 * document, ne fait rien: l'application marche, elle ne bouge pas.
 */
export function installPress(doc = globalThis.document, win = globalThis.window) {
  if (!doc?.addEventListener || !win?.addEventListener) return () => {}
  const still = () => win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true
  let held = null

  const release = () => {
    if (!held) return
    const { el, s, anim } = held
    held = null
    anim?.cancel?.()
    if (typeof el.animate === 'function') el.animate(upFrames(s), { duration: UP_MS, easing: SETTLE })
  }

  const press = (target) => {
    if (still()) return
    const el = pressTarget(target, win)
    if (!el || typeof el.animate !== 'function') return
    release()
    const r = el.getBoundingClientRect?.() ?? {}
    const s = pressScale(r.width, r.height)
    const anim = el.animate(downFrames(s), { duration: DOWN_MS, easing: 'ease-out', fill: 'forwards' })
    held = { el, s, anim }
  }

  const onDown = (e) => {
    /* Le bouton principal ou un doigt. Un clic droit ouvre un menu, il n'appuie pas. */
    if (e.button != null && e.button !== 0) return
    press(e.target)
  }
  const onKey = (e) => {
    if (e.repeat || (e.key !== ' ' && e.key !== 'Enter')) return
    press(e.target)
  }

  const opts = { capture: true, passive: true }
  doc.addEventListener('pointerdown', onDown, opts)
  win.addEventListener('pointerup', release, opts)
  win.addEventListener('pointercancel', release, opts)
  win.addEventListener('blur', release)
  doc.addEventListener('keydown', onKey, opts)
  doc.addEventListener('keyup', release, opts)

  return () => {
    doc.removeEventListener('pointerdown', onDown, opts)
    win.removeEventListener('pointerup', release, opts)
    win.removeEventListener('pointercancel', release, opts)
    win.removeEventListener('blur', release)
    doc.removeEventListener('keydown', onKey, opts)
    doc.removeEventListener('keyup', release, opts)
    release()
  }
}
