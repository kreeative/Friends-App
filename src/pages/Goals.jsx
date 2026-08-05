import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { useT } from '../lib/i18n'
import { Empty, Screen, Section, Sheet, TopBar } from '../components/ui'
import GoalCard from '../components/GoalCard'
import GoalForm from '../components/GoalForm'

export default function Goals() {
  const { user } = useAuth()
  const { goals, members } = useGroup()
  const { t } = useT()
  const [open, setOpen] = useState(false)

  const mine = goals.filter((g) => g.owner_id === user?.id)
  const shared = goals.filter((g) => g.kind === 'group')
  const others = goals.filter((g) => g.kind === 'personal' && g.owner_id !== user?.id)

  const ownerOf = (id) => members.find((m) => m.user_id === id)?.profile

  return (
    <Screen>
      <TopBar
        title={t('nav.goals')}
        right={
          <button onClick={() => setOpen(true)} className="chip-accent press">
            {t('goals.add')}
          </button>
        }
      />

      <Section title={t('goals.yours')}>
        {mine.length === 0 ? (
          <Empty>{t('goals.empty')}</Empty>
        ) : (
          <div className="space-y-4">
            {mine.map((g) => (
              <GoalCard key={g.id} goal={g} owner={ownerOf(g.owner_id)} showControls />
            ))}
          </div>
        )}
      </Section>

      {shared.length > 0 && (
        <Section title={t('board.together')}>
          <div className="space-y-4">
            {shared.map((g) => (
              <GoalCard key={g.id} goal={g} showControls />
            ))}
          </div>
        </Section>
      )}

      {others.length > 0 && (
        <Section title={t('goals.everyone_else')}>
          <div className="space-y-4">
            {others.map((g) => (
              <GoalCard key={g.id} goal={g} owner={ownerOf(g.owner_id)} />
            ))}
          </div>
        </Section>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title={t('goals.new_goal')}>
        <GoalForm onDone={() => setOpen(false)} />
      </Sheet>
    </Screen>
  )
}
