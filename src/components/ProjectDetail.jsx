import { useEffect, useMemo, useState } from 'react'
import { useT } from '../lib/i18n'
import { money } from '../lib/money'
import { CURRENCIES, currencyName, minorDigits } from '../lib/currency'
import { fromCents, localISO, toCents } from '../lib/txn'
import { errorText } from '../lib/dberr'
import { balances, byCategory, projectProgress, settleUp, totalSpent } from '../lib/project'
import { lineState, openCount, plannedLeft, quickAmounts, sortLines } from '../lib/projectLines'
import {
  addProjectEntry,
  addProjectLine,
  deleteProjectEntry,
  deleteProjectLine,
  inviteErrorKey,
  inviteToProject,
  leaveProject,
  updateProject,
  withdrawProjectInvite,
} from '../lib/projectData'
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
export default function ProjectDetail({
  project,
  members,
  entries,
  lines,
  linesMissing = false,
  profiles,
  friends,
  sentInvites,
  canInvite = true,
  userId,
  locale,
  onBack,
  onChange,
}) {
  const { t } = useT()
  const [sheet, setSheet] = useState(false)
  const [invite, setInvite] = useState(false)
  const [paying, setPaying] = useState(null)
  /* Which ledger row is asking "sure?". One at a time, by id: a confirm that
     is a boolean opens on every row at once the moment two are on screen. */
  const [confirm, setConfirm] = useState(null)
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

  const pending = useMemo(
    () => (sentInvites ?? []).filter((i) => i.project_id === project.id),
    [sentInvites, project.id],
  )

  const plan = useMemo(() => sortLines(lines, entries), [lines, entries])
  /* Resolved here rather than inside the sheet: a line removed on another
     device between the tap and the render must close the sheet, not open it
     onto nothing. */
  const payingLine = useMemo(
    () => (lines ?? []).find((l) => l.id === paying) ?? null,
    [lines, paying],
  )
  const left = useMemo(() => plannedLeft(lines, entries), [lines, entries])
  const open = useMemo(() => openCount(lines, entries), [lines, entries])

  const remove = async (id) => {
    setConfirm(null)
    const { error: err } = await deleteProjectEntry(id)
    if (err) return setError(errorText(err))
    await onChange()
  }

  /**
   * The project's currency, changed after the fact.
   *
   * Nothing is converted, and the sentence under the picker says so. That is
   * not a shortcut: the amounts are the numbers people typed, and the case
   * this exists for is a trip whose figures were euros all along while the
   * label said dollars. Converting them would be the wrong answer to exactly
   * the problem being fixed.
   */
  const setCurrency = async (code) => {
    const { error: err } = await updateProject(project.id, { currency: code })
    if (err) return setError(errorText(err))
    await onChange()
  }

  const removeLine = async (id) => {
    const { error: err } = await deleteProjectLine(id)
    if (err) return setError(errorText(err))
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

      <button className="btn-primary press w-full" onClick={() => setSheet(true)} data-hook="add-line">
        {t('proj.add_line')}
      </button>

      {/**
       * WHAT IS STILL TO PAY, AND A BUTTON ANYBODY CAN PRESS.
       *
       * "Ajouter d'abord un budget et ensuite pouvoir marquer paye... comme ca
       * n'importe qui peut cliquer qu'il a paye."
       *
       * A line is a plan and an entry is a fact, which is why this section and
       * the ledger below it are not the same list. This one is a to-do; that
       * one is the record of money that actually moved. Payer is the door
       * between them.
       *
       * The button is on every open line for everybody, not only for whoever
       * the line is assigned to. Somebody being down as the payer and somebody
       * else actually reaching for their card is the normal case on a trip,
       * not an error to be prevented.
       *
       * Settled lines stay in the list rather than vanishing, because "did we
       * already pay the deposit" is a question people ask and a list that
       * answers it only by omission answers it badly. They say "Paye" in words
       * and carry a tick: colour is never the only signal (WCAG 1.4.1).
       */}
      {!linesMissing && (
        <section className="space-y-2" data-hook="plan">
          <div className="flex items-baseline justify-between gap-3 px-1">
            <h3 className="text-label font-semibold uppercase tracking-wider text-muted">
              {t('proj.to_pay')}
            </h3>
            {left > 0 && (
              <span
                className="text-label text-muted [font-variant-numeric:tabular-nums]"
                data-hook="plan-left"
              >
                {t('proj.left_to_pay', { amount: fmt(left), n: open })}
              </span>
            )}
          </div>

          {plan.length === 0 ? (
            <div className="glass-card rounded-3xl p-5">
              <Empty>{t('proj.no_lines')}</Empty>
            </div>
          ) : (
            <ul className="glass-card divide-y divide-hairline rounded-3xl px-5" data-hook="plan-list">
              {plan.map(({ line, state }) => (
                <li key={line.id} className="py-4" data-line={line.id} data-settled={state.settled ? '' : undefined}>
                  <div className="flex items-baseline gap-3">
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-body ${state.settled ? 'text-muted line-through' : 'text-ink'}`}>
                        {line.label}
                      </span>
                      <span className="block text-small text-muted">
                        {/* Partly paid says both halves, because "400 sur 800"
                            is the only version of this a person can act on. */}
                        {state.started && !state.settled
                          ? t('proj.paid_of', { paid: fmt(state.paid), total: fmt(state.total) })
                          : fmt(state.total)}
                        {line.assigned_to && (
                          <span data-hook="line-for">
                            {` \u00b7 ${t('proj.line_for', {
                              who: line.assigned_to === userId ? t('proj.you_object') : name(line.assigned_to),
                            })}`}
                          </span>
                        )}
                      </span>
                    </span>

                    {state.settled ? (
                      <span
                        className="flex shrink-0 items-center gap-1.5 text-label font-semibold text-green"
                        data-hook="line-paid"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5">
                          <path d="M4 12.5l5 5L20 6.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {t('proj.line_settled')}
                      </span>
                    ) : (
                      <button
                        className="goal-action press shrink-0"
                        data-hook="line-pay"
                        onClick={() => setPaying(line.id)}
                      >
                        {t('proj.pay')}
                      </button>
                    )}
                  </div>

                  {/* Only once somebody has started. A bar at zero under every
                      untouched line is six rules of noise. */}
                  {state.started && !state.settled && state.pct !== null && (
                    <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-pill bg-ink/10">
                      <div className="h-full rounded-pill bg-accent" style={{ width: `${state.pct}%` }} />
                    </div>
                  )}

                  {/* Whoever added it, or the owner. Removing a line never
                      touches what was already paid against it: line_id is
                      `on delete set null`, so the payments survive and every
                      balance stays correct. See migration 42. */}
                  {(line.created_by === userId || project.owner_id === userId) && !state.started && (
                    <button
                      className="press mt-2 text-label text-muted underline"
                      data-hook="line-remove"
                      onClick={() => removeLine(line.id)}
                    >
                      {t('proj.remove')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

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
                {/**
                 * Yours, and the owner's whole project.
                 *
                 * This used to be `e.paid_by === userId` alone, which was
                 * narrower than the policy 38 actually writes:
                 *
                 *   (is_project_member(project_id) and paid_by = auth.uid())
                 *   or is_project_owner(project_id)
                 *
                 * So the person responsible for a trip could not tidy up a row
                 * somebody else fat-fingered, even though the database would
                 * have let them. A screen narrower than its own policy is not
                 * safer, it is just a feature nobody can reach.
                 *
                 * Two taps, because this erases money and there is no undo. The
                 * personal budget's sheet has asked since it shipped; this
                 * deleted on a single tap, which is the more dangerous of the
                 * two because the row sits in a scrolling list under a thumb.
                 */}
                {(e.paid_by === userId || project.owner_id === userId) && (
                  confirm === e.id ? (
                    <span className="flex shrink-0 items-center gap-1.5">
                      <button
                        className="press text-label text-muted underline"
                        data-hook="entry-remove-no"
                        onClick={() => setConfirm(null)}
                      >
                        {t('txn.delete_no')}
                      </button>
                      <button
                        className="chip press bg-negative text-white"
                        data-hook="entry-remove-yes"
                        onClick={() => remove(e.id)}
                      >
                        {t('txn.delete_yes')}
                      </button>
                    </span>
                  ) : (
                    <button
                      className="press shrink-0 text-label text-muted underline"
                      data-hook="entry-remove"
                      aria-label={t('proj.remove_what', { what: e.label || e.category || t('proj.a_spend') })}
                      onClick={() => setConfirm(e.id)}
                    >
                      {t('proj.remove')}
                    </button>
                  )
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

          {/**
           * Two ways in, and the order says which one to reach for.
           *
           * Picking a name is one tap and lands in their app. A code has to be
           * read off one screen, typed into another, and it only works if the
           * person opens the app at all. So the friend picker is the button
           * and the code is the fallback underneath it, for somebody who is
           * not in any of your groups yet.
           *
           * Only the owner sees the picker, because invite_to_project() will
           * refuse anybody else. A button that exists and always fails is a
           * worse way to learn a rule than a button that is not there.
           */}
          {project.owner_id === userId && canInvite && (
            <div className="mt-5 border-t border-hairline pt-4">
              <button
                className="goal-action press w-full"
                data-hook="invite-friend"
                onClick={() => setInvite(true)}
              >
                {t('proj.invite_friend')}
              </button>
              {pending.length > 0 && (
                <p className="mt-2 text-label text-muted" data-hook="invite-pending">
                  {t('proj.inv_waiting', { n: pending.length })}
                </p>
              )}
            </div>
          )}

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

      {/**
       * WHAT THE TRIP IS COUNTED IN.
       *
       * 38 gave a project its own currency column with exactly this in mind, and
       * then nothing ever showed it: every project silently inherited the
       * personal one and could never be corrected. A Greece budget typed in
       * euros and labelled in dollars had no screen anywhere to fix it.
       *
       * Owner only, which is what budget_project_update already enforces, so
       * nobody is offered a control that would be refused.
       *
       * Nothing is converted, and it says so under the picker. The case this
       * exists for is figures that were euros all along; multiplying them by a
       * rate would be the wrong answer to the problem being fixed.
       */}
      {project.owner_id === userId && (
        <section className="space-y-2">
          <h3 className="px-1 text-label font-semibold uppercase tracking-wider text-muted">
            {t('proj.currency')}
          </h3>
          <div className="glass-card rounded-3xl p-5">
            <select
              className="field"
              value={cur}
              data-hook="project-currency"
              onChange={(e) => setCurrency(e.target.value)}
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {`${code} \u00b7 ${currencyName(code, locale === 'fr' ? 'fr-CA' : 'en-CA')}`}
                </option>
              ))}
            </select>
            <p className="mt-2 text-small text-muted">{t('proj.currency_note')}</p>
          </div>
        </section>
      )}

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
        members={members}
        profiles={profiles}
        onDone={onChange}
      />

      <PayLine
        open={Boolean(payingLine)}
        line={payingLine}
        entries={entries}
        onClose={() => setPaying(null)}
        projectId={project.id}
        userId={userId}
        currency={cur}
        locale={locale}
        onDone={onChange}
      />

      <InviteFriends
        open={invite}
        onClose={() => setInvite(false)}
        projectId={project.id}
        friends={friends}
        members={members}
        pending={pending}
        onDone={onChange}
      />
    </div>
  )
}

/**
 * Pick a name.
 *
 * The list is everybody you share a group with, which is exactly what
 * loadInvitableFriends gets back from a plain read of profiles, because that
 * is what profiles_select allows. It is also exactly the set
 * invite_to_project() will accept, so the picker cannot offer a person the
 * database will then refuse.
 *
 * People already in the project are dropped rather than shown greyed out: they
 * are listed by name six inches up the same screen under "Who is in", and a
 * second list of the same faces in a disabled state is a puzzle, not
 * information.
 *
 * An invitation already sent stays in the list, saying so, with a way to take
 * it back. That is the one state you need this screen to tell you: whether you
 * already asked. Without it the only way to find out is to press invite again
 * and read what happens.
 */
function InviteFriends({ open, onClose, projectId, friends, members, pending, onDone }) {
  const { t } = useT()
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')

  const inProject = new Set((members ?? []).map((m) => m.user_id))
  const askedBy = new Map((pending ?? []).map((i) => [i.invited_user, i.id]))
  const list = (friends ?? []).filter((f) => !inProject.has(f.id))

  const run = async (id, fn) => {
    setBusy(id)
    setError('')
    const { error: err } = await fn()
    setBusy(null)
    if (err) {
      const key = inviteErrorKey(err)
      return setError(key ? t(key) : errorText(err))
    }
    await onDone()
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('proj.invite_friend')}>
      <div className="space-y-4">
        <p className="text-small text-muted">{t('proj.invite_who')}</p>

        {list.length === 0 ? (
          <Empty>{t('proj.invite_none')}</Empty>
        ) : (
          <ul className="divide-y divide-hairline" data-hook="invite-list">
            {list.map((f) => {
              const asked = askedBy.get(f.id)
              return (
                <li key={f.id} className="flex items-center gap-3 py-3" data-friend={f.id}>
                  <Avatar profile={f} size={34} />
                  <span className="min-w-0 flex-1 truncate text-body text-ink">
                    {f.display_name || t('proj.someone')}
                  </span>

                  {asked ? (
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-label text-muted">{t('proj.inv_sent')}</span>
                      <button
                        className="press text-label text-muted underline"
                        disabled={busy === f.id}
                        data-hook="invite-withdraw"
                        onClick={() => run(f.id, () => withdrawProjectInvite(asked))}
                      >
                        {t('proj.inv_withdraw')}
                      </button>
                    </span>
                  ) : (
                    <button
                      className="goal-action press shrink-0"
                      disabled={busy === f.id}
                      data-hook="invite-send"
                      onClick={() => run(f.id, () => inviteToProject(projectId, f.id))}
                    >
                      {busy === f.id ? t('common.saving') : t('proj.inv_send')}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {error && <p className="break-words text-small text-negative" role="alert">{error}</p>}
      </div>
    </Sheet>
  )
}

/**
 * Add something the project has to pay.
 *
 * ONE ENTRY POINT, NOT TWO.
 *
 * The obvious shape was a second button: one to plan a cost, one to log a
 * spend. That is the mistake the envelopes made, two doors onto one idea with
 * no way to tell from either which one you wanted, and it is why they were
 * removed. So there is one sheet, and the difference between "we owe this" and
 * "I paid this" is a single switch inside it.
 *
 * With the switch off you get a line, and anybody can press Payer on it later.
 * With it on you get the line AND your payment of the whole thing in one go,
 * which is the fast path for the dinner you have already covered.
 *
 * The paid path is two writes and the second can fail on its own. Unlike the
 * invitation in 41, that is recoverable in place: what you are left with is
 * the line, unpaid, with a Payer button on it. So it is two calls rather than
 * a function, and the failure is shown rather than swallowed.
 */
function AddSpend({ open, onClose, projectId, userId, currency, members, profiles, onDone }) {
  const { t } = useT()
  const [amount, setAmount] = useState('')
  const [label, setLabel] = useState('')
  const [category, setCategory] = useState('')
  const [who, setWho] = useState('')
  const [already, setAlready] = useState(false)
  const [when, setWhen] = useState(localISO(new Date()))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const digits = minorDigits(currency)
  const cents = toCents(amount)
  const ready = Boolean(label.trim()) && Boolean(cents) && cents > 0
  const nameOf = (id) => profiles?.[id]?.display_name ?? t('proj.someone')

  const save = async () => {
    if (!ready || busy) return
    setBusy(true)
    setError('')

    const { line, error: err } = await addProjectLine({
      projectId,
      userId,
      label,
      amountCents: cents,
      category,
      assignedTo: who,
    })
    if (err) { setBusy(false); return setError(errorText(err)) }

    if (already) {
      const paid = await addProjectEntry({
        projectId,
        userId,
        amountCents: cents,
        label,
        category,
        happenedOn: when,
        lineId: line.id,
      })
      if (paid.error) {
        setBusy(false)
        /* The line is there and unpaid. Say what happened rather than pretending
           the whole thing failed, because pressing Add again would add it
           twice. */
        await onDone()
        return setError(t('proj.line_added_not_paid'))
      }
    }

    setBusy(false)
    setAmount(''); setLabel(''); setCategory(''); setWho(''); setAlready(false)
    onClose()
    await onDone()
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('proj.add_line')}>
      <div className="space-y-4">
        <Field label={t('proj.what')}>
          <input
            className="field"
            autoFocus
            value={label}
            maxLength={120}
            placeholder={t('proj.what_ph')}
            onChange={(e) => setLabel(e.target.value)}
          />
        </Field>
        <Field label={t('txn.amount')}>
          <input
            className="field"
            inputMode="decimal"
            value={amount}
            placeholder={digits === 0 ? '0' : `0.${'0'.repeat(digits)}`}
            onChange={(e) => setAmount(e.target.value)}
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

        {/**
         * "Designer qui paye". A suggestion written on the line, never a lock:
         * the Payer button stays on it for everybody. Optional, and it says so,
         * because most lines on a trip are nobody's in particular until
         * somebody reaches for their card.
         */}
        <Field label={t('proj.line_who')} hint={t('proj.line_who_hint')}>
          <div className="flex flex-wrap gap-2" data-hook="assign">
            <button
              type="button"
              aria-pressed={who === ''}
              data-assign=""
              onClick={() => setWho('')}
              className={who === '' ? 'goal-action-done press' : 'goal-action press'}
            >
              {t('proj.line_nobody')}
            </button>
            {(members ?? []).map((m) => (
              <button
                key={m.user_id}
                type="button"
                aria-pressed={who === m.user_id}
                data-assign={m.user_id}
                onClick={() => setWho(m.user_id)}
                className={who === m.user_id ? 'goal-action-done press' : 'goal-action press'}
              >
                {m.user_id === userId ? t('proj.you') : nameOf(m.user_id)}
              </button>
            ))}
          </div>
        </Field>

        {/**
         * A real checkbox rather than a styled div. It gets the platform's own
         * checked state, its keyboard behaviour and its screen-reader role for
         * nothing, and the tick is a second signal beside the colour.
         */}
        <label className="flex cursor-pointer items-center gap-3 text-body text-ink">
          <input
            type="checkbox"
            className="h-5 w-5 accent-accent"
            checked={already}
            data-hook="already-paid"
            onChange={(e) => setAlready(e.target.checked)}
          />
          {t('proj.already_paid')}
        </label>

        {already && (
          <Field label={t('txn.date')}>
            <input type="date" className="field" value={when} onChange={(e) => setWhen(e.target.value)} />
          </Field>
        )}

        {/* Said plainly, because the policy enforces it and a refusal after
            the fact is a worse way to learn it. */}
        {already && <p className="text-small text-muted">{t('proj.paid_by_you')}</p>}

        {error && <p className="break-words text-small text-negative" role="alert">{error}</p>}

        <button className="btn-primary press w-full" disabled={!ready || busy} onClick={save}>
          {busy ? t('common.saving') : t('proj.add')}
        </button>
      </div>
    </Sheet>
  )
}

/**
 * "N'importe qui peut cliquer qu'il a paye. Quoi ? Le full montant, half etc."
 *
 * THE CHIPS FILL THE BOX RATHER THAN BEING A CHOICE OF THEIR OWN.
 *
 * The first shape for this was three selectable chips, Tout / Moitie / Autre,
 * with the third revealing a field. That needs a selected state, and a
 * selected state needs a signal that is not only colour (WCAG 1.4.1), and
 * "Autre" needs to know whether to stay open. All of that to answer a question
 * the amount box already answers by showing the number.
 *
 * So the chips are shortcuts that type into the box. There is no selection to
 * signal, "Autre" is just typing, and the confirm button reads back the exact
 * amount it is about to record.
 *
 * BOTH CHIPS ARE COMPUTED OFF WHAT IS LEFT, NOT OFF THE LINE TOTAL.
 *
 * After somebody covers half of an 800, the next person's "tout" has to mean
 * the remaining 400. See quickAmounts in projectLines.js, and the test that
 * walks every remainder from 1 to 4000 cents proving a half followed by a
 * whole lands on exactly zero.
 */
function PayLine({ open, line, entries, onClose, projectId, userId, currency, locale, onDone }) {
  const { t } = useT()
  const [amount, setAmount] = useState('')
  const [when, setWhen] = useState(localISO(new Date()))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const state = lineState(line, entries)
  const digits = minorDigits(currency)
  const cents = toCents(amount)
  const fmt = (c) => money(c, currency, locale)
  const chips = quickAmounts(state.left)

  /* Reset when a different line is opened, so last time's number does not
     arrive pre-filled against a bill it has nothing to do with. */
  useEffect(() => {
    if (open) { setAmount(''); setError(''); setWhen(localISO(new Date())) }
  }, [open, line?.id])

  const save = async () => {
    if (!cents || cents <= 0 || busy) return
    setBusy(true)
    setError('')
    const { error: err } = await addProjectEntry({
      projectId,
      userId,
      amountCents: cents,
      /* The line's own words, so the ledger below reads as sentences rather
         than as a column of amounts with no subjects. */
      label: line.label,
      category: line.category,
      happenedOn: when,
      lineId: line.id,
    })
    setBusy(false)
    if (err) return setError(errorText(err))
    setAmount('')
    onClose()
    await onDone()
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('proj.pay_title', { what: line?.label ?? '' })}>
      <div className="space-y-4">
        <p className="text-body text-ink [font-variant-numeric:tabular-nums]" data-hook="pay-left">
          {state.started
            ? t('proj.pay_left_partly', { left: fmt(state.left), total: fmt(state.total) })
            : t('proj.pay_left', { left: fmt(state.left) })}
        </p>

        <div className="flex flex-wrap gap-2" data-hook="pay-chips">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              data-chip={c.key}
              className="goal-action press"
              onClick={() => setAmount(fromCents(c.cents, digits))}
            >
              {t(c.key === 'all' ? 'proj.pay_all' : 'proj.pay_half', { amount: fmt(c.cents) })}
            </button>
          ))}
        </div>

        <Field label={t('proj.pay_how_much')}>
          <input
            className="field"
            inputMode="decimal"
            value={amount}
            data-hook="pay-amount"
            placeholder={digits === 0 ? '0' : `0.${'0'.repeat(digits)}`}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>

        <Field label={t('txn.date')}>
          <input type="date" className="field" value={when} onChange={(e) => setWhen(e.target.value)} />
        </Field>

        <p className="text-small text-muted">{t('proj.paid_by_you')}</p>

        {error && <p className="break-words text-small text-negative" role="alert">{error}</p>}

        <button
          className="btn-primary press w-full"
          disabled={!cents || cents <= 0 || busy}
          data-hook="pay-confirm"
          onClick={save}
        >
          {busy
            ? t('common.saving')
            : cents > 0
              ? t('proj.pay_confirm', { amount: fmt(cents) })
              : t('proj.pay')}
        </button>
      </div>
    </Sheet>
  )
}
