import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useT } from '../lib/i18n'
import { toHm } from '../lib/reminders'
import { useWaterToday } from '../lib/useWater'
import { formatAmount, parseAmount, toUnit, unitLabel } from '../lib/units'

/**
 * L'eau du jour, sur l'accueil, avec le bouton a portee de pouce.
 *
 * CE QUI A ETE DEMANDE
 *
 *   "Ajouter une petite option sur l'ecran home pour rentrer rapidement les
 *    verres d'eau qu'on a bu, et quand tu recois la notification 'drink
 *    water' ca te renvoie sur ce truc-la dans la page d'accueil, parce que
 *    j'ai vu que c'est accessible seulement dans les reglages et c'est trop
 *    long d'aller jusque la pour acceder a ca."
 *
 * Le bouton vivait au fond de l'ecran des reglages, sous la fenetre eveillee
 * et le curseur de cible. C'est le bon endroit pour REGLER l'eau et le pire
 * possible pour la NOTER: le geste arrive huit fois par jour et il etait a
 * quatre gestes de distance. Regler est rare, noter est constant, et les deux
 * ne vont pas sur le meme ecran.
 *
 * IL N'APPARAIT QUE SI L'EAU EST ALLUMEE.
 *
 * Sinon c'est une carte de plus sur un tableau de bord, pour une
 * fonctionnalite que la personne n'a pas demandee. Le reglage reste la porte.
 *
 * LA BARRE DIT LA MEME CHOSE QUE LE CHIFFRE.
 *
 * La couleur n'est jamais le seul signal (1.4.1): "750 ml sur 2 L" est ecrit
 * au-dessus, donc la barre est une redite visuelle et pas l'information
 * elle-meme.
 */

/**
 * LA BARRE, REDESSINEE.
 *
 *   "Can you improve the drink water bar as well?"
 *
 * Avant: un filet de 8px, une rangee de pastilles en dessous qui repetait le
 * filet en pointille, et le chiffre en petit gris a droite du titre. Trois
 * rangees pour dire une chose, et la plus lisible des trois etait la moins
 * mise en avant.
 *
 * Maintenant: UNE jauge de 14px, decoupee en autant de cases que de
 * contenances quand ca se compte d'un coup d'oeil (de 4 a 16), pleine d'un
 * seul tenant sinon. La case en cours se remplit en proportion, donc la
 * jauge dit a la fois "combien" et "ou j'en suis dans ce verre-ci". Les
 * pastilles n'ont plus rien a dire et sont parties.
 *
 * Et le chiffre est devenu LE chiffre: la quantite bue en grand, la cible en
 * petit a cote, comme un compteur. C'est ce qu'on vient lire.
 *
 * DEUX MOUVEMENTS, PETITS, ET SEULEMENT QUAND ON A BU.
 *
 *   - le chiffre ROULE de l'ancienne valeur a la nouvelle en 480ms, plutot que
 *     de sauter: on voit ce que le geste a ajoute;
 *   - un reflet traverse la jauge une fois, de gauche a droite. C'est l'eau
 *     qui bouge, et ca dure 650ms.
 *
 * Les deux s'eteignent sous prefers-reduced-motion. La largeur de la jauge
 * garde sa transition de 500ms, qui existait deja.
 */

/**
 * Un nombre qui roule vers sa valeur au lieu de sauter.
 *
 * Part de ce qui est AFFICHE et pas de la valeur precedente: deux taps
 * rapproches relancent le roulement depuis la position en cours, sans saut en
 * arriere. Sous prefers-reduced-motion, le nombre change d'un coup.
 */
function useRolled(value, ms = 480) {
  const [shown, setShown] = useState(value)
  const at = useRef(value)

  useEffect(() => {
    const start = at.current
    if (start === value) return undefined
    const still =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    if (still) {
      at.current = value
      setShown(value)
      return undefined
    }
    const t0 = performance.now()
    let raf = 0
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / ms)
      const eased = 1 - (1 - p) ** 3
      const v = Math.round(start + (value - start) * eased)
      at.current = v
      setShown(v)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, ms])

  return shown
}

export default function WaterToday() {
  const { t, locale } = useT()
  const { loading, pending, pref, glasses, done, drunk, plan, drink, undo } = useWaterToday()
  const [params, setParams] = useSearchParams()
  const box = useRef(null)
  const [lit, setLit] = useState(false)
  /* La saisie libre, fermee par defaut. Le geste courant reste un tap sur la
     contenance; ceci est pour les fois ou ce n'est pas ca. */
  const [other, setOther] = useState(false)
  const [amount, setAmount] = useState('')
  /* Compte les gestes "j'ai bu". Sert de cle au reflet qui traverse la jauge:
     une cle qui change remonte l'element, donc l'animation repart du debut a
     chaque tap au lieu de rester bloquee a sa fin. */
  const [pours, setPours] = useState(0)
  const rolled = useRolled(drunk)

  /**
   * La notification atterrit ICI, et le dit.
   *
   * La notification d'eau ouvre `/?boire=1`. Sans ce bloc elle ouvrirait
   * l'accueil et laisserait chercher, ce qui n'est pas une reponse quand on
   * vient d'etre interrompu. On l'amene a l'ecran et on l'allume deux
   * secondes.
   *
   * C'est ce bloc qui rend la place de la carte dans la page sans importance,
   * et c'est pourquoi elle a pu descendre sous le calendrier sans rien
   * couter: on ne la cherche pas, elle vient.
   *
   * Le parametre est retire de l'URL tout de suite apres, avec replace: true,
   * pour que le bouton retour ne rejoue pas l'animation et qu'un
   * rafraichissement n'allume pas une carte que personne n'a demandee.
   */
  useEffect(() => {
    if (!params.get('boire') || loading || pending || !pref.water_on) return undefined
    box.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setLit(true)
    const next = new URLSearchParams(params)
    next.delete('boire')
    setParams(next, { replace: true })
    const timer = setTimeout(() => setLit(false), 2200)
    return () => clearTimeout(timer)
  }, [params, loading, pending, pref.water_on, setParams])

  if (loading || pending || !pref.water_on) return null

  const unit = pref.water_unit
  const target = pref.water_target_ml
  const serving = pref.water_glass_ml
  const full = drunk >= target
  const left = Math.max(0, target - drunk)
  const pct = Math.round(Math.min(100, (drunk / target) * 100))

  /**
   * Les cases, seulement quand elles veulent dire quelque chose.
   *
   * Une case par contenance marche pour des verres de 250 ml: huit cases se
   * comptent d'un coup d'oeil. Avec une bouteille de 40 oz et une cible de
   * 2 L, ca fait DEUX cases, ce qui n'est plus une jauge, c'est un
   * interrupteur. Au-dela de seize c'est l'inverse: des fentes que personne ne
   * compte. Dans les deux cas la jauge reste d'un seul tenant.
   */
  const segments = glasses >= 4 && glasses <= 16 ? glasses : 1
  const per = target / segments

  function pour(ml) {
    drink(ml)
    setPours((n) => n + 1)
  }

  function addOther(e) {
    e.preventDefault()
    const ml = parseAmount(amount, unit)
    if (!ml) return
    pour(ml)
    setAmount('')
    setOther(false)
  }

  const sentence = t('remind.today', {
    done: formatAmount(drunk, unit, locale),
    total: formatAmount(target, unit, locale),
  })

  return (
    <div className="pt-6">
      <div
        ref={box}
        data-hook="water-card"
        data-done={done}
        data-total={glasses}
        className={`lg p-5 transition-shadow duration-500 ${
          lit ? 'ring-2 ring-accent ring-offset-2 ring-offset-transparent' : ''
        }`}
      >
        <p className="eyebrow">{t('water.card')}</p>

        {/* LE CHIFFRE, EN GRAND. Une quantite et pas un nombre de verres,
            c'est toute la demande: "je ne bois pas de verre d'eau, j'ai une
            bouteille de 40 oz". La phrase complete reste pour les lecteurs
            d'ecran, en une seule fois et sans les valeurs intermediaires du
            roulement, qui sont un effet et pas une information. */}
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2" data-hook="water-card-count">
          <span className="sr-only" aria-live="polite">
            {sentence}
          </span>
          <span aria-hidden="true" className="text-h2 font-semibold tabular-nums text-ink" data-hook="water-card-done">
            {formatAmount(rolled, unit, locale)}
          </span>
          <span aria-hidden="true" className="text-small text-muted">
            {t('water.of', { total: formatAmount(target, unit, locale) })}
          </span>
        </p>

        {/* LA JAUGE. Elle lit une quantite et pas un compte, donc elle marche
            aussi bien pour huit verres que pour une bouteille et demie.
            aria-hidden: la phrase au-dessus le dit deja en mots. */}
        <div
          aria-hidden="true"
          className="water-track mt-3"
          data-hook="water-bar"
          data-pct={pct}
          data-segments={segments}
        >
          {Array.from({ length: segments }, (_, i) => {
            const fill = Math.max(0, Math.min(1, (drunk - i * per) / per))
            return (
              <span
                key={i}
                className="water-seg"
                data-hook="water-seg"
                data-fill={fill >= 1 ? 'full' : fill > 0 ? 'part' : 'none'}
              >
                <span className="water-fill" style={{ width: `${fill * 100}%` }} />
              </span>
            )
          })}
          {/* Le reflet qui traverse quand on vient de boire. Remonte a chaque
              geste par sa cle, donc il repart a chaque fois. */}
          {pours > 0 && <span key={pours} className="water-sweep" data-hook="water-sweep" />}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {/* Le bouton DIT ce qu'il ajoute. "J'ai bu un verre" demandait de se
              rappeler ce qu'un verre valait ici; "+40 oz" n'a rien a retenir,
              et c'est le chiffre imprime sur la bouteille. */}
          <button
            type="button"
            onClick={() => pour(serving)}
            data-hook="water-card-drink"
            className="goal-action press"
          >
            {t('remind.drink', { amount: formatAmount(serving, unit, locale) })}
          </button>
          <button
            type="button"
            onClick={() => setOther((v) => !v)}
            aria-expanded={other}
            data-hook="water-card-other"
            className="press rounded-pill px-4 py-2 text-small font-semibold text-muted hover:bg-ink/[0.06]"
          >
            {t('remind.other')}
          </button>
          {drunk > 0 && (
            <button
              type="button"
              onClick={undo}
              data-hook="water-card-undo"
              className="press rounded-pill px-4 py-2 text-small font-semibold text-muted hover:bg-ink/[0.06]"
            >
              {t('remind.undo')}
            </button>
          )}
        </div>

        {/**
         * LA QUANTITE LIBRE, ET C'EST ELLE QUI REMPLACE LA CALCULATRICE.
         *
         * Une bouteille de 40 oz ne se boit pas d'un coup: on y boit AU FIL de
         * la journee. Sans ce champ, noter trois gorgees demandait de mentir
         * au bouton ou de faire la soustraction ailleurs, ce qui est
         * exactement ce qui a ete rapporte.
         */}
        {other && (
          <form onSubmit={addOther} className="mt-3 flex flex-wrap items-end gap-2">
            {/**
             * UNE RANGEE EQUILIBREE, ET UNE SEULE FOIS L'UNITE.
             *
             * Ce bloc portait "ml" DEUX fois: en texte de substitution dans le
             * champ et en suffixe a cote. Et le champ etait `flex-1`, donc il
             * prenait toute la largeur pour accueillir deux chiffres pendant
             * que le bouton Ajouter se serrait au bout. C'est le desequilibre
             * qui a ete montre.
             *
             * Le champ fait maintenant la largeur d'un nombre, l'unite est dite
             * une fois, apres le champ, et le bouton a la place qui reste.
             */}
            <label className="min-w-0">
              <span className="field-label">{t('remind.other_hint')}</span>
              <span className="mt-1 flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  autoFocus
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  data-hook="water-card-amount"
                  className="field w-24 shrink-0"
                  /* Un exemple, pas le nom de l'unite: celui-ci est deja dit
                     juste a cote, et un champ dont le texte de substitution
                     repete son propre suffixe n'aide personne. */
                  placeholder={String(toUnit(serving, unit))}
                />
                <span className="shrink-0 text-small text-muted">{unitLabel(unit)}</span>
              </span>
            </label>
            <button
              type="submit"
              disabled={!parseAmount(amount, unit)}
              data-hook="water-card-add"
              className="goal-action press shrink-0 disabled:opacity-40"
            >
              {t('remind.add')}
            </button>
          </form>
        )}

        {/* Une ligne, et une seule: quand arrive le prochain, ou que c'est
            fini. Le raisonnement complet (le rythme, le retard) reste dans les
            reglages, ou on regle; ici on note. */}
        <p className="mt-3 text-small text-muted" data-hook="water-card-next">
          {full ? (
            t('water.full')
          ) : (
            <>
              {/* Ce qu'il RESTE, en toutes lettres. C'est la soustraction qui
                  se faisait a la calculatrice. */}
              {t('water.left', { amount: formatAmount(left, unit, locale) })}{' '}
              {plan.nextMin !== null ? t('water.next_at', { time: toHm(plan.nextMin) }) : t('water.none_left')}
            </>
          )}{' '}
          <Link to="/settings" className="underline underline-offset-4">
            {t('water.settings')}
          </Link>
        </p>
      </div>
    </div>
  )
}
