import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useT } from '../lib/i18n'
import { toHm } from '../lib/reminders'
import { useWaterToday } from '../lib/useWater'
import { formatAmount, parseAmount, toUnit, unitLabel } from '../lib/units'
import GearIcon from './GearIcon'
import WaterDrop from './WaterDrop'

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
 * LA GOUTTE DIT LA MEME CHOSE QUE LE CHIFFRE.
 *
 * La couleur n'est jamais le seul signal (1.4.1): "250 ml sur 2,6 L" est
 * ecrit a cote, donc la goutte est une redite visuelle et pas l'information
 * elle-meme.
 */

/**
 * LA CARTE, TROISIEME DESSIN.
 *
 *   "I really don't like what I highlighted, and I don't really like the
 *    water bar too."
 *
 * Ce qu'elle avait surligne: la phrase grise du bas, "2,4 L to go. Next
 * reminder around 11:59. Settings", avec son lien souligne qui passait a la
 * ligne. Trois informations dans une phrase de journal, sous les boutons, la
 * ou l'oeil finit sa lecture: on quittait la carte sur une note
 * administrative.
 *
 * Et la barre a cases: 2,6 L par 250 ml font onze cases de 236 ml, donc un
 * verre remplissait une case et six pour cent de la suivante. Une jauge qui
 * a l'air fausse quand on vient de faire le geste juste n'est pas une jauge.
 *
 * MAINTENANT
 *
 *   - la phrase est partie. Le prochain rappel est un mot dans l'en-tete, a
 *     droite du titre ("Next at 11:59"), et les reglages sont l'engrenage a
 *     cote, le meme que sur le profil. Ce qu'il reste a boire se lit dans
 *     "250 ml / sur 2,6 L", qui etait deja la;
 *   - la barre est une GOUTTE qui se remplit (WaterDrop). Le niveau est la
 *     quantite, il n'y a rien a compter, et elle se lit "eau" avant le titre;
 *   - le chiffre a grossi d'un cran pour tenir tete a la goutte, et "Annuler"
 *     est monte a cote de lui: il defait ce chiffre-la, et la rangee des
 *     boutons ne passe plus a la ligne sur un iPhone.
 *
 * Quand on boit: le chiffre roule (useRolled), l'eau monte, et une vaguelette
 * glisse. Les trois s'eteignent sous prefers-reduced-motion.
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
  /* Compte les gestes "j'ai bu". C'est la cle de la vaguelette: une cle qui
     change remonte l'element, donc elle repart a chaque tap. */
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

  /* Un mot dans l'en-tete, pas une phrase sous les boutons. */
  const next = full
    ? t('water.done_short')
    : plan.nextMin !== null
      ? t('water.next_short', { time: toHm(plan.nextMin) })
      : t('water.none_left')

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
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="eyebrow">{t('water.card')}</p>
          {/* Le prochain rappel et l'engrenage forment UN groupe, pour qu'ils
              passent a la ligne ensemble: en francais le titre est long, et
              l'engrenage se retrouvait seul sous lui, colle a gauche. */}
          <span className="ml-auto flex items-center gap-x-3">
            <p className="text-small text-muted" data-hook="water-card-next">
              {next}
            </p>
            {/* L'engrenage du profil, le meme glyphe: c'est la que l'eau se
                regle, et une icone nommee vaut un mot souligne qui passe a la
                ligne. Le nom est dans aria-label, pas dans la couleur. */}
            <Link
              to="/settings"
              aria-label={t('water.settings_aria')}
              data-hook="water-card-settings"
              className="press -my-1.5 -mr-2 flex h-9 w-9 items-center justify-center rounded-pill text-muted hover:bg-ink/[0.06]"
            >
              <GearIcon className="h-[18px] w-[18px]" />
            </Link>
          </span>
        </div>

        <div className="mt-3 flex items-center gap-4">
          <WaterDrop level={drunk / target} pours={pours} />

          {/* LE CHIFFRE, EN GRAND. Une quantite et pas un nombre de verres,
              c'est toute la demande: "je ne bois pas de verre d'eau, j'ai une
              bouteille de 40 oz". La phrase complete reste pour les lecteurs
              d'ecran, en une seule fois et sans les valeurs intermediaires du
              roulement, qui sont un effet et pas une information. */}
          <p className="min-w-0 flex-1" data-hook="water-card-count">
            <span className="sr-only" aria-live="polite">
              {sentence}
            </span>
            <span
              aria-hidden="true"
              className="block text-h1 font-semibold tabular-nums leading-none text-ink"
              data-hook="water-card-done"
            >
              {formatAmount(rolled, unit, locale)}
            </span>
            <span aria-hidden="true" className="mt-1.5 block text-small text-muted">
              {t('water.of', { total: formatAmount(target, unit, locale) })}
            </span>
          </p>

          {drunk > 0 && (
            <button
              type="button"
              onClick={undo}
              data-hook="water-card-undo"
              className="press self-start rounded-pill px-3 py-1.5 text-small font-semibold text-muted hover:bg-ink/[0.06]"
            >
              {t('remind.undo')}
            </button>
          )}
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
      </div>
    </div>
  )
}
