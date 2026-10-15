import { Fragment, useLayoutEffect } from 'react'

/*
 * Sorti de Home.jsx pour servir aussi a la page de connexion: "Pareil pour la
 * page que les gens trouvent quand ils s'inscrivent". Les deux titres
 * portent leurs stickers de la meme facon, avec le meme plafond.
 */

/**
 * LE TITRE, AVEC SES STICKERS ACCROCHES AUX MOTS.
 *
 *   "à la place, t'ajoutes des stickers autour du texte, un peu sur le
 *    texte, etc. Comme ce que j'avais montré."
 *
 * Les references posent une couronne de stickers autour du titre, et
 * certains mordent sur les lettres. Ici aussi, et c'est la seule exception a
 * la regle "rien ne couvre un mot" du kit.
 *
 * ACCROCHES A UN MOT, PAS A LA PAGE. Le titre ne tombe pas pareil d'une
 * largeur a l'autre: mesure, il fait trois a cinq lignes et ses coupures
 * changent avec la langue ("Change your" / "Change your life." / "Change"
 * seul a 320 px). Un sticker pose en pourcentages de la colonne finissait
 * sur un mot ou un autre selon la largeur. Accroche au mot, il le suit:
 * `pins.first` au premier mot, `pins.last` au dernier, en em, donc a la
 * taille du titre a toutes les largeurs. Le mot accroche est un <span> en
 * ligne (.pin dans index.css), donc le titre passe a la ligne exactement
 * comme sans lui.
 *
 * "UN PEU" SUR LE TEXTE, MESURE. Le plafond a ete fixe avant de poser quoi
 * que ce soit: 30 % de l'encre d'une lettre, 12 % de celle d'un mot, sur la
 * page peinte avec et sans le decor. Mesure de 320 a 1440 px, dans les deux
 * langues: le FIRE prend 13 a 15 % du C, le pouce au plus 24 % de la
 * derniere lettre de la premiere ligne, CHACHING au plus 8 % du point, et
 * aucun mot ne perd plus de 4 %.
 *
 * Les mots derriere lesquels passe le surligneur sont `mark`, s'ils sont dans
 * le titre. Une traduction qui change le titre sans changer `mark` perd le
 * surlignage et rien d'autre.
 */
export function headline(title, mark, pins) {
  const at = mark ? title.indexOf(mark) : -1
  const runs = at < 0
    ? [[title, false]]
    : [[title.slice(0, at), false], [mark, true], [title.slice(at + mark.length), false]]
  const words = runs.flatMap(([text]) => text.split(/\s+/).filter(Boolean))
  const pinFor = { 0: pins.first, [words.length - 1]: pins.last }
  let k = 0
  return runs.map(([text, marked], r) => {
    const parts = text.split(/(\s+)/).map((part, j) => {
      if (!part || /^\s+$/.test(part)) return part
      const pin = pinFor[k++]
      return pin ? (
        <span key={j} className="pin">
          {part}
          {pin}
        </span>
      ) : (
        part
      )
    })
    return marked ? (
      <span key={r} className="marker">
        {parts}
      </span>
    ) : (
      <Fragment key={r}>{parts}</Fragment>
    )
  })
}

/**
 * Ou finit la premiere ligne du titre, en variable CSS sur le titre.
 *
 * Le pouce se colle au bout de la premiere ligne, et ce bout n'est jamais le
 * meme mot: "Change" seul a 320 px en anglais, "Change your" a 390, "Change
 * your life." a 414, "Change de vie." en francais. CSS ne sait pas ou une
 * ligne finit, donc on le mesure, mot par mot (les espaces de fin de ligne
 * n'ont pas d'encre), a chaque changement de taille et quand la police est
 * chargee. Divise par l'echelle du titre, parce que son entree joue un
 * scale(0.994) et que la mesure peut tomber pendant.
 *
 * Avant la premiere mesure, le pouce est au coin droit du bloc: juste aussi,
 * moins precis.
 */
export function useLineEnd(ref, text) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const measure = () => {
      const box = el.getBoundingClientRect()
      if (!box.width) return
      const range = document.createRange()
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      let top = Infinity
      let end = 0
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        for (const m of n.textContent.matchAll(/\S+/g)) {
          range.setStart(n, m.index)
          range.setEnd(n, m.index + m[0].length)
          for (const r of range.getClientRects()) {
            if (r.top < top - 2) {
              top = r.top
              end = r.right
            } else if (r.top <= top + 2) end = Math.max(end, r.right)
          }
        }
      }
      if (end) el.style.setProperty('--line-end', `${((end - box.left) * el.offsetWidth) / box.width}px`)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    document.fonts?.ready.then(measure)
    return () => ro.disconnect()
  }, [ref, text])
}
