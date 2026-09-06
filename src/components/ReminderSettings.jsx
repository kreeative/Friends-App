import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { dayKey } from '../lib/time'
import {
  DEFAULTS,
  LEAD_CHOICES,
  fromHm,
  isMuted,
  prefOf,
  toHm,
  waterPlan,
} from '../lib/reminders'
import {
  MAX_TARGET,
  MIN_TARGET,
  defaultTarget,
  everyLabel,
  glassesFor,
} from '../lib/water'
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
  const { user } = useAuth()
  const { t } = useT()

  const [row, setRow] = useState(null)
  const [drunk, setDrunk] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  /* Vrai quand 57_reminders.sql n'a pas encore ete passe. Un ecran qui rend
     une trace d'erreur Postgres a quelqu'un qui voulait regler ses
     notifications ne l'aide pas; celui-ci dit ce qu'il manque. */
  const [pending, setPending] = useState(false)

  const today = dayKey(new Date())

  async function load() {
    setLoading(true)
    const [{ data: pref, error: e1 }, { data: logs }] = await Promise.all([
      supabase.from('notify_pref').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('water_log').select('ml').eq('user_id', user.id).eq('on_day', today),
    ])
    /* 42P01: la table n'existe pas. C'est la migration, pas une panne. */
    if (e1?.code === '42P01') setPending(true)
    else if (e1) setError(e1.message)
    setRow(pref ?? null)
    setDrunk((logs ?? []).reduce((n, l) => n + (l.ml ?? 0), 0))
    setLoading(false)
  }

  useEffect(() => {
    if (user?.id) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const pref = useMemo(() => prefOf(row), [row])

  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()

  /**
   * L'ETAT REEL D'AUJOURD'HUI, ET LE RYTHME D'UNE JOURNEE ORDINAIRE. DEUX
   * CHOSES.
   *
   * Ecrit d'abord avec un seul plan, celui de maintenant, pour les deux
   * usages. Mesure dans Chromium a 20h29: la phrase sous le curseur annoncait
   * "environ un toutes les 30 min" pour une cible de 2 litres. Le calcul etait
   * juste, c'est la phrase qui mentait: il restait 151 minutes de journee et
   * huit verres a boire, donc le plancher. Mais lue sous un curseur de
   * reglage, elle dit "ton reglage est toutes les 30 minutes", ce qui est
   * exactement le chiffre que ce calcul existe pour ne pas produire.
   *
   * Donc deux plans. `typical` part du reveil avec rien de bu: c'est le rythme
   * d'une journee ordinaire, il ne bouge pas selon l'heure a laquelle on ouvre
   * les reglages, et c'est lui qui explique le reglage. `today` est l'etat
   * reel et sert au reste: le compteur, et le fait de dire qu'il est trop tard.
   */
  const typical = useMemo(
    () => waterPlan(row, { drunkMl: 0, nowMin: prefOf(row).wake_min }),
    [row],
  )
  const plan = useMemo(
    () => waterPlan(row, { drunkMl: drunk, nowMin }),
    [row, drunk, nowMin],
  )

  /**
   * Ecrire, et recalculer le prochain rappel dans le meme mouvement.
   *
   * water_next_at est ecrit ICI, par le client, parce que le calcul de
   * l'intervalle vit dans src/lib/water.js et qu'une deuxieme implementation
   * en SQL finirait par ne plus etre d'accord avec celle-la. La fonction
   * planifiee ne fait que comparer un timestamp.
   */
  async function save(patch) {
    const next = { ...pref, ...patch }
    const p = waterPlan(next, { drunkMl: drunk, nowMin })

    /* Quand l'eau est eteinte, ou la cible atteinte, il n'y a rien de prevu:
       null plutot qu'une date passee, pour que la fonction planifiee n'ait
       meme pas la ligne a regarder. */
    const water_next_at =
      next.water_on && p.nextMin !== null ? atLocalMinute(p.nextMin).toISOString() : null

    setRow({ ...next, water_next_at })
    const { error: err } = await supabase
      .from('notify_pref')
      .upsert({ user_id: user.id, ...next, water_next_at }, { onConflict: 'user_id' })
    if (err) {
      setError(err.message)
      /* Remettre ce que la base a vraiment, plutot que de laisser l'ecran
         montrer un reglage qui n'a pas ete enregistre. */
      load()
    }
  }

  async function drink() {
    const ml = pref.water_glass_ml
    setDrunk((n) => n + ml)
    const { error: err } = await supabase
      .from('water_log')
      .insert({ user_id: user.id, on_day: today, ml })
    if (err) return setError(err.message)
    /* Le verre change le plan: on reecrit le prochain rappel tout de suite.
       C'est la partie qui rattrape, et elle ne marche que si elle part du
       nouveau total. */
    const p = waterPlan(pref, { drunkMl: drunk + ml, nowMin })
    await supabase
      .from('notify_pref')
      .upsert(
        {
          user_id: user.id,
          ...pref,
          water_next_at:
            pref.water_on && p.nextMin !== null ? atLocalMinute(p.nextMin).toISOString() : null,
        },
        { onConflict: 'user_id' },
      )
  }

  async function undo() {
    /* Le dernier verre, pas n'importe lequel. Une ligne par verre existe
       precisement pour ca: un compteur ne se defait pas, et appuyer deux fois
       par accident laisserait la journee fausse sans rien a faire. */
    const { data } = await supabase
      .from('water_log')
      .select('id, ml')
      .eq('user_id', user.id)
      .eq('on_day', today)
      .order('at', { ascending: false })
      .limit(1)
    const last = data?.[0]
    if (!last) return
    /* count: 'exact'. RLS refuse un DELETE en silence, zero ligne et pas
       d'erreur, et sans le compte l'ecran afficherait un retrait qui n'a pas
       eu lieu. */
    const { count } = await supabase
      .from('water_log')
      .delete({ count: 'exact' })
      .eq('id', last.id)
    if (count) setDrunk((n) => Math.max(0, n - last.ml))
  }

  if (loading) return <p className="text-small text-muted">{t('err.loading')}</p>

  if (pending) {
    return (
      <p className="text-small text-muted" data-hook="reminders-pending">
        {t('remind.migration')}
      </p>
    )
  }

  const glasses = glassesFor(pref.water_target_ml, pref.water_glass_ml)

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

      {/**
       * LA FENETRE, PARCE QUE TOUT CE QUI SUIT EN DEPEND.
       *
       * Elle traverse minuit sans rien de special a faire: 22:00 - 06:00 est
       * la journee de quelqu'un qui travaille de nuit, et isAwake() sait la
       * lire. Ecrit naivement, ce reglage-la produit le silence complet, et un
       * silence ne se signale pas.
       */}
      <div>
        <p className="text-body font-semibold text-ink">{t('remind.window')}</p>
        <p className="mt-1 max-w-[46ch] text-small text-muted">{t('remind.window_hint')}</p>
        <div className="mt-4 flex flex-wrap gap-4">
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

      {/* --- l'eau ---------------------------------------------------------- */}

      <div className="border-t border-hairline pt-8">
        <Switch
          hook="water-on"
          label={t('remind.water')}
          hint={t('remind.water_hint')}
          on={pref.water_on}
          onChange={(v) => save({ water_on: v, water_target_ml: pref.water_target_ml })}
        />

        {pref.water_on && (
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
                litres: (pref.water_target_ml / 1000).toFixed(1),
                glasses,
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

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button type="button" onClick={drink} data-hook="water-drink" className="goal-action press">
                {t('remind.drink')}
              </button>
              {drunk > 0 && (
                <button
                  type="button"
                  onClick={undo}
                  data-hook="water-undo"
                  className="press rounded-pill px-4 py-2 text-small font-semibold text-muted hover:bg-ink/[0.06]"
                >
                  {t('remind.undo')}
                </button>
              )}
              <span className="text-small text-muted" data-hook="water-today">
                {t('remind.today', {
                  done: Math.round(drunk / pref.water_glass_ml),
                  total: glasses,
                })}
              </span>
            </div>
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

/**
 * Une minute du jour, aujourd'hui, dans le fuseau du navigateur.
 *
 * new Date(y, m, d, 0, min) et pas une arithmetique sur un timestamp: le
 * constructeur local traverse un changement d'heure correctement, alors
 * qu'ajouter des millisecondes a minuit rend 09:00 ou 11:00 selon le sens du
 * changement, deux dimanches par an.
 */
function atLocalMinute(min) {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, min, 0, 0)
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
        className={`press mt-0.5 flex h-7 w-12 shrink-0 items-center rounded-pill p-1 transition-colors ${
          on ? 'bg-accent-pressed' : 'bg-ink/[0.18]'
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
          on ? 'border-accent-pressed bg-accent-pressed text-on-accent' : 'border-ink/30 bg-transparent'
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
