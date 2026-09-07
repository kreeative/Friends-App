import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useT } from '../lib/i18n'
import { toHm } from '../lib/reminders'
import { useWaterToday } from '../lib/useWater'

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
  const { t } = useT()
  const { loading, pending, pref, glasses, done, plan, drink, undo } = useWaterToday()
  const [params, setParams] = useSearchParams()
  const box = useRef(null)
  const [lit, setLit] = useState(false)

  /**
   * La notification atterrit ICI, et le dit.
   *
   * La notification d'eau ouvre `/?boire=1`. Sans ce bloc elle ouvrirait
   * l'accueil et laisserait chercher: la carte est en haut, mais "en haut"
   * n'est pas une reponse quand on vient d'etre interrompu. On l'amene a
   * l'ecran et on l'allume deux secondes.
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

  const full = done >= glasses

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
          <p className="text-small text-muted" data-hook="water-card-count">
            {t('remind.today', { done, total: glasses })}
          </p>
        </div>

        {/* Une pastille par verre. Pleine pour ce qui est bu, vide pour le
            reste; aria-hidden parce que le compte a cote le dit deja en
            mots et qu'un lecteur d'ecran n'a pas besoin de douze puces. */}
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

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={drink}
            data-hook="water-card-drink"
            className="goal-action press"
          >
            {t('remind.drink')}
          </button>
          {done > 0 && (
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

        {/* Une ligne, et une seule: quand arrive le prochain, ou que c'est
            fini. Le raisonnement complet (le rythme, le retard) reste dans les
            reglages, ou on regle; ici on note. */}
        <p className="mt-3 text-small text-muted" data-hook="water-card-next">
          {full ? (
            t('water.full')
          ) : plan.nextMin !== null ? (
            t('water.next_at', { time: toHm(plan.nextMin) })
          ) : (
            t('water.none_left')
          )}{' '}
          <Link to="/settings" className="underline underline-offset-4">
            {t('water.settings')}
          </Link>
        </p>
      </div>
    </div>
  )
}
