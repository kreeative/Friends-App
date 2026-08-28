import { useEffect, useMemo, useState } from 'react'
import { useT } from '../lib/i18n'
import { money } from '../lib/money'
import { CURRENCIES, currencyName, minorDigits } from '../lib/currency'
import { toCents } from '../lib/txn'
import { errorText } from '../lib/dberr'
import { cardClass } from '../lib/amount'
import { balances, projectProgress, totalSpent } from '../lib/project'
import { createProject, joinProject } from '../lib/projectData'
import ProjectInvites from './ProjectInvites'
import { Empty, Field, Sheet } from './ui'

/**
 * The list of shared, ephemeral budgets.
 *
 * A project is a budget with a beginning, an end and a total, and then it is
 * over. That is a different shape from the personal budget, which is a
 * standing arrangement that resets every payday, so none of the period
 * arithmetic applies and none of it is reused here.
 *
 * The card leads with the money and the balance, not the name. You already
 * know you have a Greece trip; what you open this for is how much has gone
 * and whether you are up or down.
 */
export default function Projects({ userId, projects, members, entries, profiles, invites, currency, locale, onOpen, onChange }) {
  const { t } = useT()
  const [sheet, setSheet] = useState(null) // 'new' | 'join' | null

  const rows = useMemo(() => (
    (projects ?? []).map((p) => {
      const mine = (members ?? []).filter((m) => m.project_id === p.id)
      const ents = (entries ?? []).filter((e) => e.project_id === p.id)
      const bal = balances(mine, ents).find((b) => b.user_id === userId)
      return {
        project: p,
        members: mine,
        entries: ents,
        progress: projectProgress({ entries: ents, target_cents: p.target_cents }),
        net: bal?.net ?? 0,
      }
    })
  ), [projects, members, entries, userId])

  return (
    <div className="space-y-4">
      {/* Above the buttons, because it is a question somebody asked you and
          everything below it is something you might do instead. */}
      <ProjectInvites invites={invites} profiles={profiles} onDone={onChange} />

      <div className="flex gap-2">
        <button className="btn-primary press flex-1" onClick={() => setSheet('new')}>
          {t('proj.new')}
        </button>
        <button className="goal-action press shrink-0" onClick={() => setSheet('join')}>
          {t('proj.join')}
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="glass-card rounded-3xl p-5">
          <Empty>{t('proj.empty')}</Empty>
        </div>
      ) : (
        <ul className="space-y-3" data-projects="">
          {rows.map(({ project, members: mem, entries: ents, progress, net }) => (
            <li key={project.id}>
              <button
                type="button"
                data-project={project.id}
                onClick={() => onOpen(project.id)}
                className="press glass-card w-full rounded-3xl p-5 text-left"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 flex-1 truncate text-body font-semibold text-ink">
                    {project.name}
                  </span>
                  <span className="shrink-0 text-label text-muted [font-variant-numeric:tabular-nums]">
                    {t('proj.people', { n: mem.length })}
                  </span>
                </div>

                <p className={`mt-2 font-display leading-none text-ink [font-variant-numeric:tabular-nums] ${cardClass(money(totalSpent(ents), project.currency, locale))}`}>
                  {money(totalSpent(ents), project.currency, locale)}
                </p>

                {/* Only when a target was set. A bar that reads full because
                    nobody set a budget is worse than no bar. */}
                {progress.funded && (
                  <>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-pill bg-ink/10">
                      <div
                        className={`h-full rounded-pill ${progress.over > 0 ? 'bg-over' : 'bg-progress'}`}
                        style={{ width: `${progress.pct}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-label text-muted [font-variant-numeric:tabular-nums]">
                      {progress.over > 0
                        ? t('proj.over_target', { over: money(progress.over, project.currency, locale) })
                        : t('proj.of_target', { target: money(progress.target, project.currency, locale) })}
                    </p>
                  </>
                )}

                {/* Your position, in words as well as colour: colour is never
                    the only signal (WCAG 1.4.1). */}
                {net !== 0 && (
                  <p className={`mt-2.5 text-small font-semibold ${net > 0 ? 'text-green' : 'text-negative'}`}>
                    {net > 0
                      ? t('proj.you_are_owed', { amount: money(net, project.currency, locale) })
                      : t('proj.you_owe', { amount: money(-net, project.currency, locale) })}
                  </p>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <NewProject
        open={sheet === 'new'}
        onClose={() => setSheet(null)}
        userId={userId}
        currency={currency}
        locale={locale}
        onDone={onChange}
      />
      <JoinProject open={sheet === 'join'} onClose={() => setSheet(null)} onDone={onChange} />
    </div>
  )
}

function NewProject({ open, onClose, userId, currency, locale, onDone }) {
  const { t } = useT()
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [starts, setStarts] = useState('')
  const [ends, setEnds] = useState('')
  /**
   * ITS OWN CURRENCY, ASKED FOR RATHER THAN ASSUMED.
   *
   * 38 gave a project a currency column and this form never showed it, so
   * every project silently inherited whatever the personal budget was counted
   * in. That is right most of the time and wrong in exactly the case the
   * feature exists for: a trip is very often not in the currency you are paid
   * in, and there was no way to say so. The result was a Greece budget typed
   * in euros and labelled in dollars, with no screen anywhere to correct it.
   *
   * The personal currency is still the default, because it is the right guess.
   * It is now a guess somebody can overrule.
   */
  const [cur, setCur] = useState(currency)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  /* Follows the personal currency until the sheet is opened, so somebody who
     changes it on their profile does not find last month's default here. */
  useEffect(() => { if (open) setCur(currency) }, [open, currency])

  const digits = minorDigits(cur)

  const save = async () => {
    if (!name.trim() || busy) return
    setBusy(true)
    setError('')
    const { error: err } = await createProject({
      userId,
      name,
      currency: cur,
      targetCents: target ? (toCents(target) ?? 0) : 0,
      startsOn: starts,
      endsOn: ends,
    })
    setBusy(false)
    if (err) return setError(errorText(err, t))
    setName(''); setTarget(''); setStarts(''); setEnds('')
    onClose()
    await onDone()
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('proj.new')}>
      <div className="space-y-4">
        <Field label={t('proj.name')}>
          <input
            className="field"
            value={name}
            maxLength={60}
            placeholder={t('proj.name_ph')}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <Field label={t('proj.currency')} hint={t('proj.currency_hint')}>
          {/* The code and the name together. "XOF" alone is a lookup, and
              "franc CFA (BCEAO)" alone does not tell somebody scanning for the
              three letters their bank app shows them. Same reasoning as the
              profile picker in Me.jsx. */}
          <select
            className="field"
            value={cur}
            data-hook="project-currency"
            onChange={(e) => setCur(e.target.value)}
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {`${code} \u00b7 ${currencyName(code, locale === 'fr' ? 'fr-CA' : 'en-CA')}`}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('proj.target')} hint={t('proj.target_hint')}>
          <input
            className="field"
            inputMode="decimal"
            value={target}
            placeholder={digits === 0 ? '0' : `0.${'0'.repeat(digits)}`}
            onChange={(e) => setTarget(e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('proj.starts')}>
            <input type="date" className="field" value={starts} onChange={(e) => setStarts(e.target.value)} />
          </Field>
          <Field label={t('proj.ends')}>
            <input type="date" className="field" value={ends} onChange={(e) => setEnds(e.target.value)} />
          </Field>
        </div>

        {error && <p className="break-words text-small text-negative" role="alert">{error}</p>}

        <button className="btn-primary press w-full" disabled={!name.trim() || busy} onClick={save}>
          {busy ? t('common.saving') : t('proj.create')}
        </button>
      </div>
    </Sheet>
  )
}

function JoinProject({ open, onClose, onDone }) {
  const { t } = useT()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const go = async () => {
    if (!code.trim() || busy) return
    setBusy(true)
    setError('')
    const { error: err } = await joinProject(code)
    setBusy(false)
    /* "no such project" comes back from the function as a raised exception,
       which is the same thing a typo produces. Say that, rather than the
       Postgres text. */
    if (err) return setError(t('proj.bad_code'))
    setCode('')
    onClose()
    await onDone()
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('proj.join')}>
      <div className="space-y-4">
        <Field label={t('proj.code')} hint={t('proj.code_hint')}>
          <input
            className="field text-center text-h2 uppercase tracking-[0.3em]"
            value={code}
            maxLength={8}
            autoCapitalize="characters"
            autoComplete="off"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
        </Field>
        {error && <p className="break-words text-small text-negative" role="alert">{error}</p>}
        <button className="btn-primary press w-full" disabled={!code.trim() || busy} onClick={go}>
          {busy ? t('common.saving') : t('proj.join_go')}
        </button>
      </div>
    </Sheet>
  )
}
