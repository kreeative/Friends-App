import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { completionRate, consecutiveMisses, rollingRate } from '../lib/stats'
import { useT } from '../lib/i18n'
import { Screen, Section, TopBar } from '../components/ui'
import ConsistencyPanel from '../components/ConsistencyPanel'

export default function Me() {
  const { user, profile, signOut } = useAuth()
  const { statusesFor, myGoals, soloGoals, groups, reloadGroup } = useGroup()
  const { t } = useT()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  const rows = statusesFor(user?.id)
  const rate = completionRate(rows, 14)
  const quiet = consecutiveMisses(rows)
  const trend = useMemo(() => rollingRate(rows, { window: 3, points: 12 }), [rows])

  /* Both kinds count. Someone running three solo goals and none in a group is
     not a person with no goals, which is what this said before. */
  const liveGoals =
    myGoals.filter((g) => g.status === 'active').length +
    soloGoals.filter((g) => g.status === 'active').length

  /**
   * Frictionless re-entry.
   *
   * Someone coming back after a gap should not have to face a wall of overdue
   * items, that backlog is precisely what makes people close the app and not
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
    // Straight to the form, on its own page. This used to open a sheet on top
    // of this screen, which is the container the goal form has just left.
    navigate('/goals/new')
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

      {/* The same two cards as the dashboard. This screen was still three
          plain numbers with a yellow rule under each and a bare strip of
          circles, the old design, left behind when the dashboard moved. */}
      <Section title={t('me.consistency')}>
        <ConsistencyPanel
          rate={rate}
          trend={trend}
          cycles={rows}
          goalCount={liveGoals}
          groupCount={groups.length}
        />
        <p className="mt-4 text-small text-muted">{t('me.rate_note')}</p>
      </Section>

      <Section title={t('me.account')}>
        <div className="lg px-5">
          <div className="list">
            <Link to="/goals" className="press flex items-center gap-4 py-5 no-underline">
              <span className="flex-1 text-body text-ink">{t('me.your_goals')}</span>
              <span className="text-small text-muted">{soloGoals.length || ''} →</span>
            </Link>
            <Link to="/library" className="press flex items-center gap-4 py-5 no-underline">
              <span className="flex-1 text-body text-ink">{t('nav.library')}</span>
              <span className="text-small text-muted">→</span>
            </Link>
            <button
              onClick={signOut}
              className="press flex w-full items-center gap-4 py-5 text-left"
            >
              <span className="flex-1 text-body text-ink">{t('me.sign_out')}</span>
            </button>
          </div>
        </div>
      </Section>
    </Screen>
  )
}
