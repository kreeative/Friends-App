import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { Empty, Screen, Section, Sheet, TopBar } from '../components/ui'
import GoalCard from '../components/GoalCard'
import GoalForm from '../components/GoalForm'

export default function Goals() {
  const { user } = useAuth()
  const { goals, members } = useGroup()
  const [open, setOpen] = useState(false)

  const mine = goals.filter((g) => g.owner_id === user?.id)
  const shared = goals.filter((g) => g.kind === 'group')
  const others = goals.filter((g) => g.kind === 'personal' && g.owner_id !== user?.id)

  const ownerOf = (id) => members.find((m) => m.user_id === id)?.profile

  return (
    <Screen>
      <TopBar
        title="Goals"
        right={
          <button onClick={() => setOpen(true)} className="label px-2 py-1 text-white">
            + Add
          </button>
        }
      />

      <Section title="Yours">
        {mine.length === 0 ? (
          <Empty>Nothing yet. A goal needs a trigger and a proof to be checkable.</Empty>
        ) : (
          <div className="space-y-2">
            {mine.map((g) => (
              <GoalCard key={g.id} goal={g} owner={ownerOf(g.owner_id)} showControls />
            ))}
          </div>
        )}
      </Section>

      {shared.length > 0 && (
        <Section title="Together">
          <div className="space-y-2">
            {shared.map((g) => (
              <GoalCard key={g.id} goal={g} showControls />
            ))}
          </div>
        </Section>
      )}

      {others.length > 0 && (
        <Section title="Everyone else">
          <div className="space-y-2">
            {others.map((g) => (
              <GoalCard key={g.id} goal={g} owner={ownerOf(g.owner_id)} />
            ))}
          </div>
        </Section>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="New goal">
        <GoalForm onDone={() => setOpen(false)} />
      </Sheet>
    </Screen>
  )
}
