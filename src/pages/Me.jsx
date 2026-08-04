import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { completionRate, consecutiveMisses } from '../lib/stats'
import { useT } from '../lib/i18n'
import { Screen, Section, Sheet, Stat, TopBar } from '../components/ui'
import HistoryStrip, { HistoryLegend } from '../components/HistoryStrip'
import GoalForm from '../components/GoalForm'

export default function Me() {
  const { user, profile, signOut } = useAuth()
  const { statusesFor, myGoals, reloadGroup } = useGroup()
  const { t } = useT()
  const [resetOpen, setResetOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const rows = statusesFor(user?.id)
  const rate = completionRate(rows, 14)
  const quiet = consecutiveMisses(rows)

  /**
   * Frictionless re-entry.
   *
   * Someone coming back after a gap should not have to face a wall of overdue
   * items — that backlog is precisely what makes people close the app and not
   * return. So coming back parks everything old (paused, not failed) and asks
   * for exactly one new thing.
   */
  async function restart() {
    setBusy(true)
    await supabase
      .from('goals')
      .update({ status: 'paused' })
      .eq('owner_id', user.id)
      .eq('status', 'active')
    await reloadGroup()
    setBusy(false)
    setResetOpen(true)
  }

  return (
    <Screen>
      <TopBar title={profile?.display_name ?? t('nav.you')} sub={t('me.consistency')} />

      {quiet >= 2 && (
        <div className="pt-8">
          <div className="card">
            <p className="eyebrow">{t('me.quiet_label')}</p>
            <h3 className="mt-2 text-h2 text-ink">{t('me.still_in')}</h3>
            <p className="mt-2 text-body text-muted">{t('me.still_in_body')}</p>
            <button onClick={restart} disabled={busy} className="btn-primary press mt-6">
              {busy ? '…' : t('me.reset')}
            </button>
          </div>
        </div>
      )}

      <Section title={t('me.last14')}>
        <div className="flex gap-6">
          <Stat
            value={rate.total ? `${rate.done}/${rate.total}` : '—'}
            label={t('me.checked_in')}
            hint={rate.pct !== null ? `${rate.pct}%` : t('me.no_cycles')}
          />
          <Stat
            value={myGoals.filter((g) => g.status === 'active').length}
            label={t('me.live_goals')}
          />
          <Stat value={rate.away} label={t('me.away')} hint={t('me.not_counted')} />
        </div>
        <p className="mt-6 text-small text-muted">{t('me.rate_note')}</p>
      </Section>

      <Section title={t('me.last12')}>
        <HistoryStrip rows={rows} count={12} />
        <HistoryLegend />
      </Section>

      <Section>
        <button onClick={signOut} className="btn-ghost press">
          {t('me.sign_out')}
        </button>
      </Section>

      <Sheet open={resetOpen} onClose={() => setResetOpen(false)} title={t('me.one_thing')}>
        <GoalForm onDone={() => setResetOpen(false)} />
      </Sheet>
    </Screen>
  )
}
