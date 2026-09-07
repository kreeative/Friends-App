import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { localeTag, useT } from '../lib/i18n'
import { PROOF_TYPES, proofTypeOf } from '../lib/proofKinds'
import { errorText, isMissingColumn, isNetworkError } from '../lib/dberr'
import { goalRow } from '../lib/goalRow'
import { channelKey, toHm } from '../lib/reminders'
import { Field, PickerField } from './ui'
import { Slider, useSlider } from './Segmented'

/**
 * Rough signals that someone has written an outcome ("hit 10k followers")
 * rather than a process ("post 3 videos a week"). Outcomes are not within the
 * person's control, so holding them accountable for one is unfair and. More
 * practically. Unfixable in a bad week, which is when people quit.
 *
 * This only prompts. Hard-blocking would just teach people to phrase around
 * the filter, and some outcome goals are genuinely what someone wants to track.
 */
const OUTCOME_HINTS = [
  /\b\d[\d,.]*\s*(k|m)?\s*(followers?|subs?|subscribers?|users?|customers?|clients?|downloads?|sales?|revenue|mrr|views?|likes?|abonn[ée]s?|vues?)\b/i,
  /\b(reach|hit|get to|grow to|earn|make|atteindre|gagner)\b.*\b\d/i,
  /\blose\b.*\b\d+\s*(kg|lbs?|pounds?)\b/i,
  /\bperdre\b.*\b\d+\s*kg\b/i,
  /\b(get|be|become|devenir|être)\s+(fit|rich|healthy|famous|better|riche|mince|c[ée]l[èe]bre)\b/i,
]

function looksLikeOutcome(text) {
  return OUTCOME_HINTS.some((re) => re.test(text))
}

/**
 * One numbered step of the form.
 *
 * The form used to be nine fields in an undifferentiated column inside a
 * bottom sheet, which is why it read as a wall you had to get through rather
 * than a set of decisions. It is the same nine fields; grouping them into
 * four named steps is the whole change, and it is enough. You can now tell
 * at a glance where you are and how much is left.
 */
function Step({ n, title, hint, children }) {
  return (
    /**
     * No divider rule.
     *
     * This was `border-t border-hairline`, and it is the second line that
     * kept getting reported under the form's inputs. `.field` is an underline
     * by design, so the last field in a step drew one rule and the next
     * step's divider drew another just below it, with only the hint text in
     * between. Measured in a browser: both are real, both 1px hairline, and
     * at reading distance they read as one doubled edge belonging to the
     * input rather than as a boundary between two steps.
     *
     * A step is already separated by a numbered badge, a heading and a good
     * deal of space. The rule was restating a boundary three other things
     * were making, and it was the one causing the confusion, so it goes.
     * Padding grows to carry the separation on its own.
     */
    <section className="pt-10 first:pt-0">
      <div className="flex items-baseline gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-pill bg-ink text-[0.6875rem] font-semibold text-white">
          {n}
        </span>
        <div>
          <h3 className="text-h2 text-ink">{title}</h3>
          {hint && <p className="mt-1.5 max-w-[46ch] text-small text-muted">{hint}</p>}
        </div>
      </div>
      <div className="mt-6 space-y-6 sm:pl-9">{children}</div>
    </section>
  )
}

/**
 * A two-or-three-way choice where the selection travels rather than swapping.
 *
 * Worth the machinery here specifically because these toggles change what the
 * rest of the form asks for. Picking "One-off" replaces two fields with one.
 * When the highlight simply appeared on the other option there was nothing
 * connecting the tap to the fields rearranging underneath it, and it read as
 * the form glitching rather than as an answer being registered.
 */
function Toggle({ options, value, onChange }) {
  const { ref, box } = useSlider(value)

  return (
    <div ref={ref} className="relative inline-flex gap-1 rounded-pill bg-ink/[0.05] p-1">
      <Slider box={box} className="rounded-pill bg-accent" />
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          data-active={value === v}
          onClick={() => onChange(v)}
          className={`relative z-10 rounded-pill px-4 py-1.5 text-small font-semibold transition-colors duration-200 ease-settle ${
            value === v ? 'text-on-accent' : 'text-muted hover:text-ink'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/**
 * @param groupId  the group this goal belongs to, or null for a solo goal.
 *                 Null is a real value here, not a missing one, a goal with
 *                 no group is private to you and is the whole point of being
 *                 able to use this without joining anybody.
 */
/**
 * Which days of the week a routine runs on.
 *
 * Seven toggles rather than a multi-select, because the answer is looked at as
 * a shape ("weekdays", "Mon and Thu") rather than read as a list, and a shape
 * is what a row of seven pills gives you.
 *
 * The last day cannot be turned off. A goal due on no day is due never, which
 * renders as a goal that has quietly disappeared from the check-in with no
 * explanation, and "I do not want this any more" is what pausing is for.
 */
function DayPicker({ value, onChange }) {
  const { t, locale } = useT()
  const tag = localeTag(locale)

  /* 7 January 2024 was a Sunday, so this walks the week in getDay() order and
     the labels come out in the reader's own language. */
  const labels = Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, 7 + i).toLocaleDateString(tag, { weekday: 'narrow' }),
  )

  const toggle = (day) => {
    const on = value.includes(day)
    if (on && value.length === 1) return
    onChange(on ? value.filter((d) => d !== day) : [...value, day])
  }

  return (
    <div>
      <span className="field-label">{t('form.on_days')}</span>
      <div className="mt-2 flex gap-1.5">
        {labels.map((label, day) => {
          const on = value.includes(day)
          return (
            <button
              key={day}
              type="button"
              onClick={() => toggle(day)}
              aria-pressed={on}
              className={`press h-11 flex-1 rounded-pill text-small font-semibold transition-colors ${
                on ? 'bg-accent text-on-accent' : 'bg-ink/[0.06] text-muted'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>
      <span className="field-note">
        {value.length === 7 ? t('form.every_day') : t('form.on_days_hint')}
      </span>
    </div>
  )
}

/**
 * A date you can actually take back.
 *
 * `<input type="date">` has a clear control of its own in exactly one browser
 * family and nowhere else: Chrome puts a small cross in the field, Safari and
 * Firefox on a phone give you a wheel with no way out of it once a date is
 * on it. So "stop after (optional)" was optional only until you touched it,
 * and the way back was to select the text and delete it, which on a native
 * date wheel is not a thing you can do.
 *
 * Hence an explicit button, drawn by us, present exactly when there is
 * something to clear. It sets the value to the empty string, which is what the
 * payload turns into `null`, so "no end date" is one value in the database
 * rather than an empty string in some rows and a null in others.
 *
 * BESIDE THE FIELD, NOT FLOATING INSIDE IT.
 *
 * Inside was the first version and it does not survive contact with the three
 * browsers. `::-webkit-calendar-picker-indicator` sits at the end of the
 * input's content box, so where it lands depends on padding-right, and an
 * absolutely positioned cross measured from the border box either overlapped
 * it or left forty pixels of dead air to clear it. Firefox puts nothing there
 * at all, so the same padding that fits Chrome's glyph is just a hole. A
 * sibling button in a flex row is the same gesture, one tap, immediately to
 * the right of the value, and it is in the same place in every browser.
 */
function DateField(props) {
  return <PickerField type="date" {...props} />
}

export default function GoalForm({ onDone, onCancel, initial = null, groupId = null }) {
  const { user } = useAuth()
  const { reloadGroup } = useGroup()
  const { t } = useT()

  const [kind, setKind] = useState(initial?.kind ?? 'personal')
  const [commitment, setCommitment] = useState(initial?.commitment ?? '')
  const [cadence, setCadence] = useState(initial?.cadence ?? 'recurring')
  const [target, setTarget] = useState(initial?.target_per_cycle ?? 3)
  /* Null means every day, which is what every goal written before this field
     existed is. An empty set is refused below rather than stored, because a
     goal due on no day at all looks exactly like a goal that vanished. */
  const [days, setDays] = useState(() =>
    Array.isArray(initial?.active_days) && initial.active_days.length
      ? initial.active_days
      : [0, 1, 2, 3, 4, 5, 6],
  )
  const [dueOn, setDueOn] = useState(initial?.due_on ?? '')
  const [endsOn, setEndsOn] = useState(initial?.ends_on ?? '')
  /**
   * WHEN IT STARTS ASKING, WHICH IS NOT THE SAME AS WHEN IT IS DUE.
   *
   * Asked for with a real case: a goal set now for something that opens in
   * January 2027. Writing it down today is the point, being asked about it
   * every evening for sixteen months is not, and there was no way to say so.
   *
   * The gating already existed. isDueOn has honoured starts_on since it was
   * written, and a one-off with a deadline already stays out of the list until
   * a week before. The column was simply never on the form, so the only way to
   * set it was by hand in the database.
   */
  const [startsOn, setStartsOn] = useState(initial?.starts_on ?? '')
  const [when, setWhen] = useState(initial?.trigger_when ?? '')
  const [where, setWhere] = useState(initial?.trigger_where ?? '')
  const [evidence, setEvidence] = useState(initial?.evidence_def ?? '')
  /* What the check-in will draw on this goal's card. proofTypeOf rather than a
     bare read, so a goal written before migration 28 opens on the photograph
     it has always offered instead of on an empty select. */
  const [proofType, setProofType] = useState(() => proofTypeOf(initial))
  const [stake, setStake] = useState(initial?.stake_text ?? '')
  const [remind, setRemind] = useState(initial?.remind ?? true)
  /* "HH:MM" pour l'input, converti en minutes dans goalRow. Vide veut dire
     pas de notification horaire, seulement le recap. */
  const [remindAt, setRemindAt] = useState(
    initial?.remind_at_min != null ? toHm(initial.remind_at_min) : '',
  )
  /* "An option for the frequency of the notification?" En minutes, en
     chaine pour le select; vide veut dire une seule fois. */
  const [remindEvery, setRemindEvery] = useState(
    initial?.remind_every_min != null ? String(initial.remind_every_min) : '',
  )
  const [goalType, setGoalType] = useState(initial?.goal_type ?? 'process')
  const [dismissedHint, setDismissedHint] = useState(false)
  /**
   * Les canaux de cette personne, pour que la phrase sous la case dise la
   * verite plutot qu'une promesse.
   *
   * Null tant que la lecture n'est pas revenue, et channelKey() traite null
   * comme "les deux", qui est le defaut et ce que faisait le produit avant
   * que ce reglage existe. Un chargement en cours ne doit pas afficher
   * "nulle part" pendant une demi-seconde.
   */
  const [channels, setChannels] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user?.id) return
    let live = true
    supabase
      .from('notify_pref')
      .select('push_on, email_on')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        /* Une table absente ou une ligne absente laissent `data` a null, et
           c'est le bon repli: personne n'a rien coupe. */
        if (live && data) setChannels(data)
      })
    return () => {
      live = false
    }
  }, [user?.id])

  const showOutcomeHint = useMemo(
    () => !dismissedHint && goalType === 'process' && looksLikeOutcome(commitment),
    [commitment, dismissedHint, goalType],
  )

  /**
   * One required field, and it is the goal itself.
   *
   * Evidence went first: it is the right thing to write when other people are
   * going to see it, and on a goal only you can read it was a gate with
   * nothing behind it. "When" follows for the same reason and a worse one. It
   * is a sentence you write to yourself about your own Tuesday, nothing in the
   * app reads it, and blocking Save on it meant somebody who knew exactly what
   * they wanted to commit to could not write it down until they had also
   * decided what time of day they would do it.
   *
   * A deadline on a one-off is no longer required either. isDueOn already
   * treats a milestone with no date as always due, which is the honest reading
   * of "at some point", and demanding a date invites a made-up one.
   */
  const canSave = commitment.trim().length > 2

  async function save(e) {
    e.preventDefault()
    if (!canSave || saving) return
    setSaving(true)
    setError(null)

    /* Le contenu de la ligne vit dans goalRow(), qui est pur et teste. Il y
       etait au complet ici et une seule de ses vingt lignes s'est trompee de
       colonne nullable, ce qui a rendu la creation d'objectif impossible pour
       tout le monde sans qu'aucun test le remarque. */
    const payload = goalRow({
      groupId,
      kind,
      userId: user.id,
      commitment,
      goalType,
      when,
      where,
      evidence,
      proofType,
      cadence,
      target,
      days,
      dueOn,
      endsOn,
      startsOn,
      stake,
      remind,
      remindAt,
      remindEvery,
    })

    const write = (row) =>
      initial
        ? supabase.from('goals').update(row).eq('id', initial.id)
        : supabase.from('goals').insert(row)

    let { error: err } = await write(payload)

    /**
     * A goal must not depend on a migration having been run.
     *
     * proof_type arrived with migration 28, and this form started sending it
     * on every save the moment the field existed in the code. On a project
     * where 28 has not landed, that made *every* goal unsavable: the whole
     * form, correctly filled in, refused because of one column nobody had
     * asked for. Adding a feature is not a reason to break the screen that
     * existed before it.
     *
     * So a save that fails specifically because the database has no such
     * column goes again without it. Everything else the person typed is
     * still good, the goal is created, and it behaves exactly as goals did
     * before 28: proofTypeOf() falls back to a photograph.
     *
     * Narrow on purpose. Only a missing-column error retries, and only after
     * checking the name, so a constraint violation or a permission error is
     * still reported rather than being silently retried into a second
     * identical failure.
     */
    if (err && isMissingColumn(err, 'proof_type')) {
      const { proof_type: _dropped, ...withoutProof } = payload
      ;({ error: err } = await write(withoutProof))
    }

    /* One retry on a connection that dropped. A phone on a lift or a train
       loses a request and gets it back a second later, and asking somebody to
       refill a five-step form because of that is the app blaming them for
       their signal. Only once: a second failure is a real one. */
    if (err && isNetworkError(err)) {
      await new Promise((r) => setTimeout(r, 700))
      ;({ error: err } = await write(payload))
    }

    setSaving(false)

    if (err) {
      /* The whole error, code included. "TypeError: Load failed" on its own
         is a sentence nobody can act on; with the code and the hint beside it
         there is something to search for and something to tell somebody. */
      setError(errorText(err))
      return
    }
    await reloadGroup()
    onDone?.()
  }

  return (
    /* measure-form: sur un iPad en paysage ce formulaire faisait 1720 px de
       large, chaque champ un horizon. La limite va sur le bloc, pas sur la
       page (voir .shell dans index.css). */
    <form onSubmit={save} className="measure-form space-y-8">
      <Step n={1} title={t('form.step_what')} hint={t('form.commitment_hint')}>
        {/* Only meaningful inside a group. On a solo goal there is no "whole
            group" to pick, and offering the choice invited a save that the
            database would then refuse. */}
        {groupId && (
          <Toggle
            value={kind}
            onChange={setKind}
            options={[
              ['personal', t('form.mine')],
              ['group', t('form.whole_group')],
            ]}
          />
        )}

        <Field label={t('form.commitment')}>
          <input
            className="field"
            value={commitment}
            onChange={(e) => setCommitment(e.target.value)}
            placeholder={t('form.commitment_ph')}
            maxLength={200}
            autoFocus
          />
        </Field>

        {showOutcomeHint && (
          <div className="card space-y-4">
            <p className="text-body text-muted">{t('form.outcome_1')}</p>
            <p className="text-body text-muted">{t('form.outcome_2')}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="chip-quiet press"
                onClick={() => {
                  setDismissedHint(true)
                  setGoalType('outcome')
                }}
              >
                {t('form.keep_as_is')}
              </button>
              <button
                type="button"
                className="chip-accent press"
                onClick={() => setDismissedHint(true)}
              >
                {t('form.rewrite')}
              </button>
            </div>
          </div>
        )}
      </Step>

      <Step n={2} title={t('form.step_often')} hint={t('form.cadence_hint')}>
        <Toggle
          value={cadence}
          onChange={setCadence}
          options={[
            ['recurring', t('form.routine')],
            ['once', t('form.milestone')],
          ]}
        />

        {/* Said in words under the switch, because "recurring" and "one-off"
            are the app's vocabulary and not anybody else's. */}
        <p className="text-small text-muted">
          {cadence === 'recurring' ? t('form.routine_hint') : t('form.milestone_hint')}
        </p>

        {cadence === 'recurring' ? (
          <>
            <DayPicker value={days} onChange={setDays} />

            <div className="grid gap-6 sm:grid-cols-2">
            <Field label={t('form.times_per_day')} hint={t('form.times_hint')}>
              <input
                type="number"
                min={1}
                max={50}
                inputMode="numeric"
                className="field"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </Field>
            <Field label={t('form.until')} hint={t('form.until_hint')}>
              <DateField hook="ends-on" value={endsOn} onChange={setEndsOn} />
            </Field>
            </div>
            <Field label={t('form.starts')} hint={t('form.starts_hint')}>
              <DateField hook="starts-on" value={startsOn} onChange={setStartsOn} />
            </Field>
          </>
        ) : (
          <>
            <Field label={t('form.due_by')} hint={t('form.due_by_hint')}>
              <DateField hook="due-on" value={dueOn} onChange={setDueOn} />
            </Field>
            {/* Offered here too. A deadline already buys a week of silence on
                its own, which is right for something a week away and useless
                for something sixteen months out. */}
            <Field label={t('form.starts')} hint={t('form.starts_hint')}>
              <DateField hook="starts-on" value={startsOn} onChange={setStartsOn} />
            </Field>
          </>
        )}
      </Step>

      <Step n={3} title={t('form.step_when')} hint={t('form.when_hint')}>
        <Field label={t('form.when')}>
          <input
            className="field"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            placeholder={t('form.when_ph')}
          />
        </Field>

        {/* Relabelled and re-explained. "The trigger, where" read as though
            the app were going to check, which it has no way of doing and no
            intention of doing. It is a sentence you write to yourself, and
            saying so removes the only genuinely alarming field in the form. */}
        <Field label={t('form.where')} hint={t('form.where_hint')}>
          <input
            className="field"
            value={where}
            onChange={(e) => setWhere(e.target.value)}
            placeholder={t('form.where_ph')}
          />
        </Field>

        {/**
         * "Me le rappeler", et plus "me l'envoyer par e-mail".
         *
         * Le canal n'est pas l'affaire de cette case. Elle dit si on veut
         * etre rappele; ou le rappel atterrit est UN reglage, a UN endroit,
         * pour tous les messages de l'application. Nommer le canal ici
         * obligeait quelqu'un qui ne veut que des notifications a laisser
         * cochee une case intitulee "e-mail", c'est-a-dire a repondre a une
         * question que l'application n'avait aucun moyen d'honorer.
         *
         * La phrase en dessous nomme le canal REELLEMENT choisi, lu depuis
         * notify_pref. Elle reste donc vraie quand il change, au lieu de
         * promettre un courriel a quelqu'un qui les a coupes.
         */}
        <label
          className="flex cursor-pointer items-start gap-3 rounded-inner bg-ink/[0.035] p-4"
          data-hook="goal-remind"
        >
          <input
            type="checkbox"
            checked={remind}
            onChange={(e) => setRemind(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[rgb(var(--c-accent))]"
          />
          <span>
            <span className="block text-body text-ink">{t('form.remind')}</span>
            <span className="mt-1 block text-small text-muted" data-hook="goal-remind-hint">
              {t('form.remind_hint', { by: t(channelKey(channels)) })}{' '}
              <Link to="/settings" className="underline underline-offset-4 hover:text-ink">
                {t('form.remind_where')}
              </Link>
            </span>
          </span>
        </label>

        {/**
         * L'HEURE, DERRIERE LA CASE, ET PAS UNE FREQUENCE.
         *
         * Demande: par objectif, une frequence et une heure. L'objectif a deja
         * sa frequence: sa cadence, ses jours, sa cible. Un rappel qui aurait
         * un calendrier a lui contredirait celui de l'objectif ("rappelle-moi
         * le lundi" sur un objectif du mardi). Donc la seule question neuve
         * est l'heure, et le rappel part les jours ou l'objectif est du.
         *
         * onBlur en plus de onChange: meme garde que les champs de date, le
         * selecteur natif peut vider le champ sans prevenir React.
         */}
        {remind && (
          <Field label={t('form.remind_at')} hint={t('form.remind_at_hint')}>
            {/* Le meme champ que les dates, avec sa croix: une heure tapee par
                erreur s'efface ici, sans repasser par le selecteur du
                telephone et sans recommencer le formulaire. */}
            <PickerField
              type="time"
              value={remindAt}
              onChange={setRemindAt}
              hook="goal-remind-at-field"
              inputHook="goal-remind-at"
              clearLabel="form.clear_time"
            />
          </Field>
        )}
        {/**
         * La frequence, derriere l'heure et seulement derriere elle.
         *
         * "An option for the frequency of the notification?" C'est la
         * deuxieme moitie de la toute premiere demande: "a quelle heure OU a
         * quelle frequence dans la journee". Pas un calendrier a part (les
         * jours restent ceux de l'objectif), une repetition de l'heure
         * choisie jusqu'a ce que l'objectif soit coche, et jamais apres le
         * coucher des reglages. Sans heure il n'y a rien a repeter, donc le
         * champ n'existe pas.
         */}
        {remind && remindAt && (
          <Field label={t('form.remind_every')} hint={t('form.remind_every_hint')}>
            <select
              data-hook="goal-remind-every"
              className="field"
              value={remindEvery}
              onChange={(e) => setRemindEvery(e.target.value)}
            >
              <option value="">{t('form.remind_once')}</option>
              <option value="30">{t('form.remind_every_30')}</option>
              <option value="60">{t('form.remind_every_60')}</option>
              <option value="120">{t('form.remind_every_120')}</option>
              <option value="180">{t('form.remind_every_180')}</option>
            </select>
          </Field>
        )}
      </Step>

      <Step n={4} title={t('form.step_proof')} hint={t('form.optional_step')}>
        {/**
         * What the check-in will ask for.
         *
         * Four buttons rather than a select, because this decides what control
         * appears on the card every single day and it is worth seeing all the
         * options at once rather than opening a menu to find out what they are.
         *
         * The evidence sentence underneath stays, and the two are not the same
         * question. This one is the widget; that one is the note you leave
         * yourself about what would actually count.
         */}
        <Field label={t('form.proof_type')} hint={t('form.proof_type_hint')}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PROOF_TYPES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setProofType(p)}
                aria-pressed={proofType === p}
                className={`press rounded-inner px-3 py-3 text-small font-semibold transition-colors ${
                  proofType === p
                    ? 'bg-ink text-surface'
                    : 'bg-ink/[0.06] text-ink hover:bg-ink/[0.1]'
                }`}
              >
                {t(`form.proof_${p}`)}
              </button>
            ))}
          </div>
        </Field>

        {proofType !== 'none' && (
          <Field label={t('form.evidence')} hint={t('form.evidence_hint')}>
            <input
              className="field"
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              placeholder={t('form.evidence_ph')}
            />
          </Field>
        )}

        {groupId && (
          <Field label={t('form.stake')} hint={t('form.stake_hint')}>
            <input
              className="field"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              placeholder={t('form.stake_ph')}
            />
          </Field>
        )}
      </Step>

      {error && <p className="card text-small text-negative">{error}</p>}

      <div className="flex flex-col gap-3 border-t border-hairline pt-7 sm:flex-row-reverse">
        <button data-hook="goal-save" className="btn-primary press sm:w-auto sm:px-10" disabled={!canSave || saving}>
          {saving ? t('form.saving') : initial ? t('form.save_changes') : t('form.add_goal')}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-ghost press sm:w-auto sm:px-8">
            {t('ui.close')}
          </button>
        )}
      </div>
      {!canSave && <p className="text-small text-muted">{t('form.required')}</p>}
    </form>
  )
}
