import { useRef, useState } from 'react'
import { useT } from '../lib/i18n'
import { DEFAULTS, LEAD_CHOICES, fromHm, isMuted, toHm } from '../lib/reminders'
import { MAX_TARGET, MIN_TARGET, everyLabel } from '../lib/water'
import { MAX_SERVING_ML, MIN_SERVING_ML, UNITS, formatAmount, parseAmount, safeServing, toUnit, unitLabel } from '../lib/units'
import { useWaterToday } from '../lib/useWater'
import { Field } from './ui'

/**
 * Choisir quand l'application a le droit de faire vibrer un telephone.
 *
 * "Chaque personne peut choisir a quelle heure ou a quelle frequence dans la
 * journee il veut recevoir une notification."
 *
 * UN SEUL REGLAGE D'HORAIRE, PAS UN PAR SORTE DE RAPPEL.
 *
 * La tentation etait une heure par fonctionnalite: l'heure de l'eau, l'heure
 * des objectifs, l'heure de l'agenda. Ca fait cinq champs a remplir avant que
 * quoi que ce soit marche, et personne ne les remplit. La fenetre eveillee est
 * une seule question, on sait y repondre sur soi, et elle suffit: rien ne part
 * en dehors, et c'est sur cette duree que les verres d'eau se repartissent.
 *
 * LE CHIFFRE CALCULE EST AFFICHE PENDANT QU'ON BOUGE LE CURSEUR.
 *
 * C'est la reponse a "comment tu peux calculer pour que tout le monde
 * remplisse ses objectifs", montree plutot que racontee: on change la cible,
 * la phrase en dessous dit tout de suite combien de verres et a quel rythme.
 * Sans ca, "2 litres" est un nombre abstrait et le premier rappel est une
 * surprise.
 */
export default function ReminderSettings() {
  const { t, locale } = useT()

  /* Toute la logique de l'eau vit dans useWaterToday: l'ecran d'accueil a
     maintenant le meme bouton, et deux copies de "insere une ligne, recalcule
     le prochain rappel" auraient derive. */
  const { loading, pending, error, pref, drunk, glasses, done, plan, typical, save } =
    useWaterToday()

  const servingRef = useRef(null)
  const [savedServing, setSavedServing] = useState(false)

  /**
   * Enregistrer la contenance, bornee.
   *
   * L'ECRAN N'ENVOYAIT PAS CE QU'IL AFFICHAIT COMME LIMITES.
   *
   * Il montrait "50 ml - 2 L" sous le champ et envoyait tel quel ce qui etait
   * tape. Taper 40 pendant que l'unite etait encore en millilitres envoyait
   * donc 40 ml, sous le plancher, et la base repondait:
   *
   *   new row for relation "notify_pref" violates check constraint
   *   "notify_pref_water_glass_ml_check"
   *
   * Une contrainte de base de donnees affichee en rouge a quelqu'un qui
   * reglait sa bouteille. safeServing ramene la valeur dans les bornes avant
   * l'envoi, et la migration 64 remonte le plafond de la base a 2000 pour
   * qu'une bouteille de 40 oz (1183 ml) y entre.
   */
  function commitServing(raw) {
    const parsed = parseAmount(raw, pref.water_unit)
    /* Une saisie illisible ne change rien plutot que de remettre un defaut:
       effacer la contenance de quelqu'un parce qu'il a tape une lettre serait
       pire que de ne rien faire. */
    if (!parsed) return
    const ml = safeServing(parsed, pref.water_glass_ml)
    if (ml !== pref.water_glass_ml) save({ water_glass_ml: ml })
    /* Ramene ce qui est affiche sur ce qui a ete garde: quelqu'un qui tape
       9999 doit voir la valeur retenue, pas la sienne. */
    if (servingRef.current) servingRef.current.value = toUnit(ml, pref.water_unit)
    setSavedServing(true)
    window.setTimeout(() => setSavedServing(false), 1600)
  }

  if (loading) return <p className="text-small text-muted">{t('err.loading')}</p>

  if (pending) {
    return (
      <p className="text-small text-muted" data-hook="reminders-pending">
        {t('remind.migration')}
      </p>
    )
  }


  return (
    <div className="space-y-8" data-hook="reminder-settings">
      {error && (
        <p className="text-small text-negative" role="alert" data-hook="reminders-error">
          {error}
        </p>
      )}

      {/**
       * OU ARRIVENT LES MESSAGES, AVANT LE RESTE.
       *
       * Demande mot pour mot: "est-ce que c'est un app notification seulement
       * ou email ou les deux, bref la personne pourra cocher".
       *
       * En premier parce que c'est la question qui conditionne toutes les
       * autres: regler l'heure des rappels avant d'avoir dit par ou ils
       * arrivent, c'est meubler une piece dont on n'a pas encore de cle.
       *
       * Deux cases plutot qu'un choix a trois. Les trois cas nommes en
       * sortent, et le quatrieme, les deux decochees, existe alors
       * gratuitement. Il est permis: refuser de decocher la derniere
       * obligerait a couper les notifications au niveau du telephone, ce qui
       * couperait aussi celles qu'on voulait garder. Mais il est DIT, juste
       * en dessous, plutot que de laisser croire que quelque chose arrivera
       * encore.
       */}
      <div>
        <p className="text-body font-semibold text-ink">{t('remind.how')}</p>
        <p className="mt-1 max-w-[46ch] text-small text-muted">{t('remind.how_hint')}</p>
        <div className="mt-4 space-y-3">
          <Check
            hook="channel-push"
            label={t('remind.push')}
            on={pref.push_on}
            onChange={(v) => save({ push_on: v })}
          />
          <Check
            hook="channel-email"
            label={t('remind.email')}
            on={pref.email_on}
            onChange={(v) => save({ email_on: v })}
          />
        </div>
        {isMuted(pref) && (
          <p
            className="mt-4 max-w-[46ch] rounded-inner border-l-[3px] border-accent bg-accent/[0.13] px-4 py-3 text-small text-ink"
            role="status"
            data-hook="channel-none"
          >
            {t('remind.none')}
          </p>
        )}
      </div>

      {/* --- l'eau, dans son propre rectangle -------------------------------- */}

      {/**
       * L'EAU EST UNE SECTION A ELLE, SOUS LES NOTIFICATIONS.
       *
       * "On va faire une section pour boire de l'eau en bas du groupe
       *  notifications, mais dans un autre rectangle."
       *
       * Elle etait separee par un simple filet, au milieu d'une colonne de
       * reglages qui se lisaient tous pareil. Un rectangle dit que c'est un
       * sujet, pas une case de plus: l'eau a son interrupteur, sa cible, son
       * rythme et ses heures, et rien de tout ca ne concerne le reste.
       */}
      <div className="lg p-5">
        <Switch
          hook="water-on"
          label={t('remind.water')}
          hint={t('remind.water_hint')}
          on={pref.water_on}
          onChange={(v) => save({ water_on: v, water_target_ml: pref.water_target_ml })}
        />

        {pref.water_on && (
          <div className="mt-6">
            {/**
             * L'UNITE, AVANT TOUT LE RESTE.
             *
             * "Je ne bois pas de verre d'eau, j'ai une bouteille qui fait
             * 40 oz." Elle est en tete parce qu'elle decide comment se lisent
             * les deux reglages en dessous: regler une cible en millilitres
             * quand on pense en onces, c'est deja la calculatrice.
             *
             * Rien n'est reecrit en base: water_log reste en millilitres et
             * l'historique est CONVERTI, pas reinterprete. Voir units.js.
             */}
            <Field label={t('remind.unit')} hint={t('remind.unit_hint')}>
              <div className="flex gap-2" data-hook="water-unit">
                {UNITS.map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => save({ water_unit: u })}
                    data-hook={`water-unit-${u}`}
                    aria-pressed={pref.water_unit === u}
                    className={`press rounded-pill px-4 py-2 text-small font-semibold transition-colors ${
                      pref.water_unit === u
                        ? 'bg-accent text-on-accent'
                        : 'bg-ink/[0.06] text-muted hover:bg-ink/[0.12] hover:text-ink'
                    }`}
                  >
                    {u === 'oz' ? 'oz' : 'ml'}
                  </button>
                ))}
              </div>
            </Field>

            <div className="mt-6">
            <Field label={t('remind.target')}>
              <input
                type="range"
                data-hook="water-target"
                min={MIN_TARGET}
                max={MAX_TARGET}
                step={100}
                value={pref.water_target_ml}
                onChange={(e) => save({ water_target_ml: Number(e.target.value) })}
                className="w-full accent-accent"
              />
            </Field>
            {/* La cible en toutes lettres sous le curseur: un curseur sans son
                chiffre est un reglage qu'on regle au hasard. */}
            <p className="mt-1 text-small text-muted" data-hook="water-target-value">
              {formatAmount(pref.water_target_ml, pref.water_unit, locale)}
            </p>
            </div>

            {/**
             * CE DANS QUOI ON BOIT.
             *
             * La colonne s'appelle encore water_glass_ml et contient une
             * bouteille aussi souvent qu'un verre. Le champ est en unite
             * affichee, la valeur part en millilitres: 40 oz s'enregistre en
             * 1183 ml et se relit 40 oz, verifie sur toute la plage dans
             * units.test.mjs.
             */}
            <div className="mt-6">
              <Field label={t('remind.serving')} hint={t('remind.serving_hint')}>
                <span className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    data-hook="water-serving"
                    ref={servingRef}
                    /* Un nombre a deux ou trois chiffres. Une boite large comme
                       l'ecran pour ecrire "40" est ce qui deséquilibrait la
                       rangee: le champ prenait tout et le bouton se serrait au
                       bout. */
                    className="field w-28 shrink-0"
                    defaultValue={toUnit(pref.water_glass_ml, pref.water_unit)}
                    key={`${pref.water_unit}-${pref.water_glass_ml}`}
                    onBlur={(e) => commitServing(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        e.currentTarget.blur()
                      }
                    }}
                  />
                  <span className="shrink-0 text-small text-muted">{unitLabel(pref.water_unit)}</span>
                  {/* CE QUI MANQUAIT: DE QUOI VOIR QUE C'EST ENREGISTRE.
                      "There is no save button." Le reste de cet ecran
                      s'enregistre au geste, un interrupteur ou un curseur, et
                      on VOIT le resultat bouger. Un champ de texte ne bouge
                      pas: on tape, on quitte, et rien ne dit si c'est parti.
                      Donc un bouton, qui confirme quand il n'y a plus rien a
                      enregistrer. */}
                  <button
                    type="button"
                    onClick={() => commitServing(servingRef.current?.value)}
                    data-hook="water-serving-save"
                    className="press shrink-0 rounded-pill bg-ink/[0.06] px-4 py-2 text-small font-semibold text-ink hover:bg-ink/[0.12]"
                  >
                    {savedServing ? t('remind.saved') : t('remind.save')}
                  </button>
                </span>
              </Field>
              <p className="mt-1 text-small text-muted" data-hook="water-serving-bounds">
                {formatAmount(MIN_SERVING_ML, pref.water_unit, locale)}
                {' – '}
                {formatAmount(MAX_SERVING_ML, pref.water_unit, locale)}
              </p>
            </div>

            {/**
             * LE CALCUL, MONTRE PENDANT QU'ON BOUGE LE CURSEUR.
             *
             * C'est la reponse a la question posee, affichee plutot que
             * racontee. Sans cette ligne, "2 litres" est un nombre abstrait et
             * le rythme des rappels est une surprise au premier rappel.
             */}
            {/* L'eau ne passe pas par courriel, et le dire ici evite de le
                decouvrir en ne recevant rien. Huit courriels par jour n'est
                pas un rappel, c'est une raison de se desabonner. */}
            {!pref.push_on && (
              <p className="mt-3 text-small text-muted" data-hook="water-push-only">
                {t('remind.water_push_only')}
              </p>
            )}
            <p className="mt-3 text-body text-ink" data-hook="water-plan">
              {t('remind.plan', {
                total: formatAmount(pref.water_target_ml, pref.water_unit, locale),
                every: everyLabel(typical.gapMin, t),
              })}
            </p>

            {/* Le retard est dit, pas corrige en silence: promettre une cible
                qu'on ne peut plus atteindre est pire que de le dire. */}
            {plan.late && (
              <p className="mt-2 text-small text-muted" data-hook="water-late">
                {t('remind.late')}
              </p>
            )}

            {/**
             * LES HEURES, ICI, ET SEULEMENT POUR L'EAU.
             *
             * "Cette option choisir les heures auxquelles tu es reveille pour
             *  recevoir des notifications, on va changer ca parce que ca
             *  bloque toutes les notifications. [...] mais qui impacte
             *  uniquement comment le systeme va repartir le nombre de verres
             *  d'eau que tu dois boire, ca n'impacte aucune autre
             *  notification."
             *
             * Elle etait en tete des reglages, sous le titre "Tes heures
             * eveillees", avec une phrase qui promettait "rien ne part en
             * dehors". Cette phrase etait fausse: aucun courriel, aucun
             * message de groupe, aucun anniversaire n'a jamais consulte cette
             * fenetre. Elle ne servait qu'a deux choses, le rythme de l'eau et
             * la borne de la repetition d'un objectif, et la seconde vient de
             * lui etre retiree (migration 61).
             *
             * Une promesse plus large que ce qu'un reglage fait est pire qu'un
             * reglage manquant: on croit avoir coupe quelque chose, on
             * n'ose plus rien allumer, et on se demande pourquoi le telephone
             * sonne quand meme. Donc elle descend ici, dans la section qui
             * l'utilise vraiment, et la phrase dit exactement ce qu'elle fait.
             *
             * Elle traverse minuit sans rien de special: 22:00 - 06:00 est la
             * journee de quelqu'un qui travaille de nuit, et le calcul sait la
             * lire.
             */}
            <div className="mt-6 rounded-inner border border-hairline p-4" data-hook="water-window">
              <p className="text-small font-semibold text-ink">{t('remind.window')}</p>
              <p className="mt-1 max-w-[42ch] text-small text-muted">{t('remind.window_hint')}</p>
              <div className="mt-3 flex flex-wrap gap-4">
                <Field label={t('remind.wake')}>
                  <input
                    type="time"
                    data-hook="wake"
                    className="field"
                    value={toHm(pref.wake_min)}
                    onChange={(e) => save({ wake_min: fromHm(e.target.value, DEFAULTS.wake_min) })}
                  />
                </Field>
                <Field label={t('remind.sleep')}>
                  <input
                    type="time"
                    data-hook="sleep"
                    className="field"
                    value={toHm(pref.sleep_min)}
                    onChange={(e) => save({ sleep_min: fromHm(e.target.value, DEFAULTS.sleep_min) })}
                  />
                </Field>
              </div>
            </div>

            {/**
             * NOTER L'EAU N'EST PLUS ICI.
             *
             * "Why is the button to add water even there? It should not be on
             * the settings."
             *
             * C'est juste, et c'est l'argument que cet ecran-ci utilisait deja
             * contre lui-meme: regler est rare, noter arrive huit fois par
             * jour, et les deux ne vont pas sur le meme ecran. Le bouton avait
             * ete ajoute ici avant que la carte d'accueil existe, et il y est
             * reste apres. Deux endroits pour le meme geste, dont un que
             * personne n'atteint sans traverser ses reglages.
             *
             * Ce qui reste ici, c'est ce que cet ecran est: l'unite, la cible,
             * la contenance, la fenetre eveillee. Le compte du jour se lit sur
             * l'accueil, ou il se note.
             */}
            <p className="mt-5 text-small text-muted" data-hook="water-today">
              {t('remind.today', {
                done: formatAmount(drunk, pref.water_unit, locale),
                total: formatAmount(pref.water_target_ml, pref.water_unit, locale),
              })}
            </p>
          </div>
        )}
      </div>

      {/* --- l'agenda -------------------------------------------------------- */}

      <div className="border-t border-hairline pt-8">
        <Switch
          hook="events-on"
          label={t('remind.events')}
          hint={t('remind.events_hint')}
          on={pref.events_on}
          onChange={(v) => save({ events_on: v })}
        />

        {pref.events_on && (
          <div className="mt-6">
            <Field label={t('remind.lead')}>
              <select
                data-hook="events-lead"
                className="field"
                value={pref.events_lead_min}
                onChange={(e) => save({ events_lead_min: Number(e.target.value) })}
              >
                {LEAD_CHOICES.map((n) => (
                  <option key={n} value={n}>
                    {leadLabel(n, t)}
                  </option>
                ))}
              </select>
            </Field>
            <p className="mt-2 max-w-[46ch] text-small text-muted">{t('remind.lead_hint')}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function leadLabel(n, t) {
  if (n === 0) return t('remind.lead_0')
  if (n === 1440) return t('remind.lead_day')
  if (n < 60) return t('water.every_m', { m: n })
  return t('water.every_h', { h: n / 60 })
}

/**
 * Un interrupteur dont l'etat n'est pas porte par la couleur seule (1.4.1).
 *
 * La pastille se deplace, le fond change, et aria-checked l'annonce. Les trois
 * ensemble, parce qu'un seul des trois laisse quelqu'un dehors: la position
 * pour qui ne distingue pas les couleurs, l'attribut pour qui ne voit pas
 * l'ecran.
 */
function Switch({ label, hint, on, onChange, hook }) {
  return (
    <label className="flex cursor-pointer items-start gap-4">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        data-hook={hook}
        data-on={on ? 'yes' : 'no'}
        onClick={() => onChange(!on)}
        /* Le rose pop, pas le cran plus fonce: "plus jamais ce rose". La
           piste est un graphique, donc le plancher est 3:1 (1.4.11), et
           #FF007A sur le fond de carte mesure 3,80:1. */
        className={`press mt-0.5 flex h-7 w-12 shrink-0 items-center rounded-pill p-1 transition-colors ${
          on ? 'bg-accent' : 'bg-ink/[0.18]'
        }`}
      >
        <span
          aria-hidden="true"
          className={`h-5 w-5 rounded-pill bg-white shadow-sm transition-transform ${
            on ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
      <span className="min-w-0 flex-1">
        <span className="block text-body font-semibold text-ink">{label}</span>
        {hint && <span className="mt-1 block max-w-[46ch] text-small text-muted">{hint}</span>}
      </span>
    </label>
  )
}

/**
 * Une case a cocher, dont l'etat n'est pas porte par la couleur seule (1.4.1).
 *
 * Une vraie coche dessinee dans la case, pas seulement un fond qui change: la
 * forme est le signal, la couleur l'accompagne. aria-checked et role dits par
 * l'element natif, parce qu'un input[type=checkbox] visuellement masque et un
 * carre dessine a cote font ce travail mieux qu'un div avec des attributs.
 */
function Check({ label, on, onChange, hook }) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => onChange(e.target.checked)}
        data-hook={hook}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[0.5rem] border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 ${
          on ? 'border-accent bg-accent text-on-accent' : 'border-ink/30 bg-transparent'
        }`}
      >
        {on && (
          <svg viewBox="0 0 24 24" className="h-4 w-4">
            <path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" strokeWidth="3"
                  strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="text-body text-ink">{label}</span>
    </label>
  )
}
