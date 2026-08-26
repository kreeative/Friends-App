import { useMemo, useState } from 'react'
import { useT } from '../lib/i18n'
import { money } from '../lib/money'
import { minorDigits } from '../lib/currency'
import { localISO, toCents } from '../lib/txn'
import { errorText } from '../lib/dberr'
import { balances, byCategory, projectProgress, settleUp, totalSpent } from '../lib/project'
import { addProjectEntry, deleteProjectEntry, leaveProject } from '../lib/projectData'
import { Avatar, Empty, Field, Sheet } from './ui'

/**
 * One shared project: what it cost, who paid, and who owes whom.
 *
 * The order is deliberate. Total first, because that is the question. Then
 * settle-up, because that is the argument. Then the ledger, because that is
 * the evidence. Members and the invite code last, because you set those once.
 *
 * "Qui doit quoi" is computed, never stored. A stored balance is a balance
 * that can disagree with the entries it came from, and the moment those two
 * disagree the feature is worse than a group chat.
 */
export default function ProjectDetail({ project, members, entries, profiles, userId, locale, onBack, onChange }) {
  const { t } = useT()
  const [sheet, setSheet] = useState(false)
  const [error, setError] = useState('')

  const cur = project.currency
  const fmt = (c) => money(c, cur, locale)
  const name = (id) => profiles?.[id]?.display_name ?? t('proj.someone')

  const progress = useMemo(
    () => projectProgress({ entries, target_cents: project.target_cents }),
    [entries, project.target_cents],
  )
  const bal = useMemo(() => balances(members, entries), [members, entries])
  const owing = useMemo(() => settleUp(members, entries), [members, entries])
  const cats = useMemo(() => byCategory(entries), [entries])
  const mine = bal.find((b) => b.user_id === userId)

  const remove = async (id) => {
    const { error: err } = await deleteProjectEntry(id)
    if (err) return setError(errorText(err, t))
    await onChange()
  }

  const leave = async () => {
    const { error: err } = await leaveProject({ projectId: project.id, userId })
    if (err) return setError(errorText(err, t))
    onBack()
    await onChange()
  }

  return (
    <div className="space-y-5" data-project-detail={project.id}>
      <button className="goal-action press" onClick={onBack}>
        {t('proj.back')}
      </button>

      {/* What it has cost, against what it was meant to. */}
      <div className="glass-card rounded-3xl p-5" data-hook="project-total">
        <p className="text-label font-semibold uppercase tracking-wider text-muted">
          {project.name}
        </p>
        <p className="mt-1.5 font-display text-hero leading-none text-ink [font-variant-numeric:tabular-nums]">
          {fmt(totalSpent(entries))}
        </p>

        {progress.funded && (
          <>
            <div className="mt-4 h-2.5 w-full overflow-hidden rounded-pill bg-ink/10">
              <div
                className={`h-full rounded-pill transition-[width] duration-500 ease-settle ${
                  progress.over > 0 ? 'bg-negative' : 'bg-accent'
                }`}
                style={{ width: `${progress.pct}%` }}
              />
            </div>
            <p className="mt-2 text-small text-muted">
              {progress.over > 0
                ? t('proj.over_target', { over: fmt(progress.over) })
                : t('proj.of_target', { target: fmt(progress.target) })}
            </p>
          </>
        )}

        {(project.starts_on || project.ends_on) && (
          <p className="mt-2 text-label text-muted">
            {[project.starts_on, project.ends_on].filter(Boolean).join(' - ')}
          </p>
        )}
      </div>

      <button className="btn-primary press w-full" onClick={() => setSheet(true)}>
        {t('proj.add_spend')}
      </button>

      {/**
       * Who owes whom.
       *
       * Named in words, not just arrows: "Anna doit 800 $ a Tino" is a
       * sentence somebody can act on, and it survives being screenshotted
       * into a group chat, which is what will actually happen to it.
       */}
      <section className="space-y-2">
        <h3 className="px-1 text-label font-semibold uppercase tracking-wider text-muted">
          {t('proj.settle')}
        </h3>
        <div className="glass-card rounded-3xl p-5" data-hook="settle">
          {owing.length === 0 ? (
            <p className="text-small text-muted">{t('proj.all_square')}</p>
          ) : (
            <ul className="space-y-2.5">
              {owing.map((x, i) => (
                <li
                  key={`${x.from}-${x.to}-${i}`}
                  className={`text-body ${
                    x.from === userId || x.to === userId ? 'font-semibold text-ink' : 'text-muted'
                  }`}
                >
                  {x.from === userId
                    ? t('proj.owes_line_you', { to: name(x.to), amount: fmt(x.amount_cents) })
                    : x.to === userId
                      ? t('proj.owed_line_you', { from: name(x.from), amount: fmt(x.amount_cents) })
                      : t('proj.owes_line', {
                          from: name(x.from),
                          to: name(x.to),
                          amount: fmt(x.amount_cents),
                        })}
                </li>
              ))}
            </ul>
          )}

          {mine && (
            <p className="mt-4 border-t border-hairline pt-3 text-small text-muted [font-variant-numeric:tabular-nums]">
              {t('proj.your_split', { paid: fmt(mine.paid), owed: fmt(mine.owed) })}
            </p>
          )}
        </div>
      </section>

      {/* Where it went. Only when there is more than one bucket to compare. */}
      {cats.length > 1 && (
        <section className="space-y-2">
          <h3 className="px-1 text-label font-semibold uppercase tracking-wider text-muted">
            {t('money.where')}
          </h3>
          <dl className="glass-card divide-y divide-hairline rounded-3xl px-5">
            {cats.map((c) => (
              <div key={c.category} className="flex items-baseline justify-between gap-4 py-3">
                <dt className="min-w-0 flex-1 truncate text-body text-muted">{c.category}</dt>
                <dd className="text-body font-semibold text-ink [font-variant-numeric:tabular-nums]">
                  {fmt(c.cents)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* The evidence: every line, and who paid it. */}
      <section className="space-y-2">
        <h3 className="px-1 text-label font-semibold uppercase tracking-wider text-muted">
          {t('money.recent')}
        </h3>
        {entries.length === 0 ? (
          <div className="glass-card rounded-3xl p-5">
            <Empty>{t('proj.no_spend')}</Empty>
          </div>
        ) : (
          <ul className="glass-card divide-y divide-hairline rounded-3xl px-5" data-hook="project-ledger">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-3.5">
                <Avatar profile={profiles?.[e.paid_by]} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body text-ink">
                    {e.label || e.category || t('proj.a_spend')}
                  </span>
                  <span className="block text-small text-muted">
                    {t('proj.paid_by', { who: e.paid_by === userId ? t('proj.you_object') : name(e.paid_by) })}
                    {` · ${e.happened_on}`}
                  </span>
                </span>
                <span className="shrink-0 text-body font-semibold text-ink [font-variant-numeric:tabular-nums]">
                  {fmt(e.amount_cents)}
                </span>
                {/* Only your own, which is also what the policy allows. */}
                {e.paid_by === userId && (
                  <button
                    className="press shrink-0 text-label text-muted underline"
                    onClick={() => remove(e.id)}
                  >
                    {t('proj.remove')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Who is in it, and how to add somebody. */}
      <section className="space-y-2">
        <h3 className="px-1 text-label font-semibold uppercase tracking-wider text-muted">
          {t('proj.members')}
        </h3>
        <div className="glass-card rounded-3xl p-5">
          <ul className="space-y-3">
            {members.map((m) => {
              const b = bal.find((x) => x.user_id === m.user_id)
              return (
                <li key={m.user_id} className="flex items-center gap-3">
                  <Avatar profile={profiles?.[m.user_id]} size={34} />
                  <span className="min-w-0 flex-1 truncate text-body text-ink">
                    {m.user_id === userId ? t('proj.you') : name(m.user_id)}
                    {m.share !== 1 && (
                      <span className="ml-1.5 text-label text-muted">
                        {t('proj.shares', { n: m.share })}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-small text-muted [font-variant-numeric:tabular-nums]">
                    {fmt(b?.paid ?? 0)}
                  </span>
                </li>
              )
            })}
          </ul>

          <div className="mt-5 border-t border-hairline pt-4">
            <p className="text-label text-muted">{t('proj.invite_with')}</p>
            <p
              data-hook="invite-code"
              className="mt-1 font-display text-h2 tracking-[0.3em] text-ink"
            >
              {project.invite_code}
            </p>
          </div>
        </div>
      </section>

      {error && (
        <p className="break-words px-1 text-small text-negative" role="alert">
          {error}
        </p>
      )}

      {/* Leaving is always yours to do; the policy allows it for anybody. */}
      {project.owner_id !== userId && (
        <button className="press w-full text-small text-muted underline" onClick={leave}>
          {t('proj.leave')}
        </button>
      )}

      <AddSpend
        open={sheet}
        onClose={() => setSheet(false)}
        projectId={project.id}
        userId={userId}
        currency={cur}
        onDone={onChange}
      />
    </div>
  )
}

function AddSpend({ open, onClose, projectId, userId, currency, onDone }) {
  const { t } = useT()
  const [amount, setAmount] = useState('')
  const [label, setLabel] = useState('')
  const [category, setCategory] = useState('')
  const [when, setWhen] = useState(localISO(new Date()))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const digits = minorDigits(currency)
  const cents = toCents(amount)

  const save = async () => {
    if (!cents || cents <= 0 || busy) return
    setBusy(true)
    setError('')
    const { error: err } = await addProjectEntry({
      projectId,
      userId,
      amountCents: cents,
      label,
      category,
      happenedOn: when,
    })
    setBusy(false)
    if (err) return setError(errorText(err, t))
    setAmount(''); setLabel(''); setCategory('')
    onClose()
    await onDone()
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('proj.add_spend')}>
      <div className="space-y-4">
        <Field label={t('txn.amount')}>
          <input
            className="field"
            inputMode="decimal"
            autoFocus
            value={amount}
            placeholder={digits === 0 ? '0' : `0.${'0'.repeat(digits)}`}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label={t('proj.what')}>
          <input
            className="field"
            value={label}
            maxLength={120}
            placeholder={t('proj.what_ph')}
            onChange={(e) => setLabel(e.target.value)}
          />
        </Field>
        <Field label={t('proj.category')} hint={t('proj.category_hint')}>
          <input
            className="field"
            value={category}
            maxLength={40}
            placeholder={t('proj.category_ph')}
            onChange={(e) => setCategory(e.target.value)}
          />
        </Field>
        <Field label={t('txn.date')}>
          <input type="date" className="field" value={when} onChange={(e) => setWhen(e.target.value)} />
        </Field>

        {/* Said plainly, because the policy enforces it and a refusal after
            the fact is a worse way to learn it. */}
        <p className="text-small text-muted">{t('proj.paid_by_you')}</p>

        {error && <p className="break-words text-small text-negative" role="alert">{error}</p>}

        <button className="btn-primary press w-full" disabled={!cents || cents <= 0 || busy} onClick={save}>
          {busy ? t('common.saving') : t('proj.add')}
        </button>
      </div>
    </Sheet>
  )
}
