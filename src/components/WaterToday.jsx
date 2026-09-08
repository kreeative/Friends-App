import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useT } from '../lib/i18n'
import { toHm } from '../lib/reminders'
import { useWaterToday } from '../lib/useWater'
import { formatAmount, parseAmount, unitLabel } from '../lib/units'

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
 * LES PASTILLES DISENT LA MEME CHOSE QUE LE CHIFFRE.
 *
 * La couleur n'est jamais le seul signal (1.4.1): "3 sur 12" est ecrit a cote,
 * donc les pastilles sont une redite visuelle et pas l'information elle-meme.
 */
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

  /**
   * Les pastilles, seulement quand elles veulent dire quelque chose.
   *
   * Une pastille par contenance marche pour des verres de 250 ml: huit
   * pastilles se comptent d'un coup d'oeil. Avec une bouteille de 40 oz et une
   * cible de 2 L, ca fait DEUX pastilles, ce qui n'est plus une jauge, c'est
   * un interrupteur. Au-dela de seize c'est l'inverse: un nuage de points que
   * personne ne compte.
   *
   * Dans les deux cas la barre dit mieux la meme chose, et le chiffre au-dessus
   * la dit en toutes lettres, donc la couleur n'est jamais le seul signal.
   */
  const pips = glasses >= 4 && glasses <= 16

  function addOther(e) {
    e.preventDefault()
    const ml = parseAmount(amount, unit)
    if (!ml) return
    drink(ml)
    setAmount('')
    setOther(false)
  }

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
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="eyebrow">{t('water.card')}</p>
          {/* UNE QUANTITE, PAS UN NOMBRE DE VERRES. C'est toute la demande:
              "je ne bois pas de verre d'eau, j'ai une bouteille de 40 oz, donc
              je ne suivais pas vraiment avec la notation en verres combien je
              bois". */}
          <p className="text-small text-muted" data-hook="water-card-count">
            {t('remind.today', {
              done: formatAmount(drunk, unit, locale),
              total: formatAmount(target, unit, locale),
            })}
          </p>
        </div>

        {/* La barre, toujours. Elle lit une quantite et pas un compte, donc
            elle marche aussi bien pour huit verres que pour une bouteille et
            demie. aria-hidden: le chiffre au-dessus le dit deja en mots. */}
        <div aria-hidden="true" className="mt-3 h-2 overflow-hidden rounded-pill bg-ink/[0.07]">
          <div
            data-hook="water-bar"
            data-pct={Math.round(Math.min(100, (drunk / target) * 100))}
            className="h-full rounded-pill bg-accent transition-[width] duration-500 ease-out"
            style={{ width: `${Math.min(100, (drunk / target) * 100)}%` }}
          />
        </div>

        {/* Les pastilles en plus, quand leur nombre se compte d'un coup
            d'oeil. Voir `pips`. */}
        {pips && (
          <div aria-hidden="true" className="mt-3 flex flex-wrap gap-1.5">
            {Array.from({ length: glasses }, (_, i) => (
              <span
                key={i}
                data-hook="water-pip"
                data-filled={i < done ? 'yes' : 'no'}
                className={`h-2.5 w-2.5 rounded-pill ${i < done ? 'bg-accent' : 'bg-ink/[0.14]'}`}
              />
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {/* Le bouton DIT ce qu'il ajoute. "J'ai bu un verre" demandait de se
              rappeler ce qu'un verre valait ici; "+40 oz" n'a rien a retenir,
              et c'est le chiffre imprime sur la bouteille. */}
          <button
            type="button"
            onClick={() => drink(serving)}
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
            <label className="flex-1">
              <span className="field-label">{t('remind.other_hint')}</span>
              <span className="mt-1 flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  autoFocus
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  data-hook="water-card-amount"
                  className="field min-w-0 flex-1"
                  placeholder={unitLabel(unit)}
                />
                <span className="shrink-0 text-small text-muted">{unitLabel(unit)}</span>
              </span>
            </label>
            <button
              type="submit"
              disabled={!parseAmount(amount, unit)}
              data-hook="water-card-add"
              className="goal-action press disabled:opacity-40"
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
