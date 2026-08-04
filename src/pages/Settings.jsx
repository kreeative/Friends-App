import { useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { completionRate } from '../lib/stats'
import { DAYS } from '../lib/time'
import { Avatar, Screen, Section, Stat, TopBar } from '../components/ui'
import HistoryStrip from '../components/HistoryStrip'

export default function Settings() {
  const { user } = useAuth()
  const { group, members, statuses, groups, setActiveGroup, activeId } = useGroup()

  /**
   * Collective progress, deliberately not a ranking.
   *
   * In a friend group a leaderboard mostly teaches whoever is last to stop
   * opening the app — and they are the person the group most needs to keep.
   * So the shared number is the group's, and individual histories sit next to
   * each other unsorted rather than in rank order.
   */
  const together = useMemo(() => {
    const done = statuses.filter((s) => s.status === 'submitted').length
    const counted = statuses.filter((s) => s.status !== 'pending' && s.status !== 'away').length
    return { done, counted, pct: counted ? Math.round((done / counted) * 100) : null }
  }, [statuses])

  if (!group) return null

  const shareText = `${group.name} — join us on Friends. Code: ${group.invite_code}`

  async function share() {
    if (navigator.share) {
      await navigator.share({ text: shareText }).catch(() => {})
    } else {
      await navigator.clipboard.writeText(shareText).catch(() => {})
    }
  }

  return (
    <Screen>
      <TopBar
        title={group.name}
        sub={`${DAYS[group.checkin_dow]} ${String(group.opens_hour).padStart(2, '0')}:00 · ${group.timezone}`}
      />

      <Section title="Together">
        <div className="flex gap-2">
          <Stat
            value={together.pct === null ? '—' : `${together.pct}%`}
            label="Group check-in rate"
            hint={`${together.done} of ${together.counted}`}
          />
          <Stat value={members.length} label="People" hint="2–6 works best" />
        </div>
      </Section>

      <Section title="Everyone">
        <div className="divide-y divide-white/[0.14] hair">
          {members.map((m) => {
            const rows = statuses.filter((s) => s.user_id === m.user_id)
            const r = completionRate(rows, 14)
            return (
              <div key={m.user_id} className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar profile={m.profile} />
                  <span className="flex-1 font-display text-[15px]">
                    {m.profile?.display_name}
                    {m.user_id === user?.id && <span className="text-white/30"> · you</span>}
                  </span>
                  <span className="label">{r.total ? `${r.done}/${r.total}` : '—'}</span>
                </div>
                <div className="mt-3 pl-10">
                  <HistoryStrip rows={rows} count={10} />
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="Invite">
        <div className="hair p-4">
          <p className="font-mono text-[24px] tracking-[0.3em]">{group.invite_code}</p>
          <button onClick={share} className="btn mt-3">
            Send to a friend
          </button>
          <p className="mt-3 text-[12px] leading-snug text-white/30">
            Conversation lives in your group chat, not here. This app only holds the check-in.
          </p>
        </div>
      </Section>

      {groups.length > 1 && (
        <Section title="Switch group">
          <div className="space-y-2">
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => setActiveGroup(g.id)}
                className={`hair w-full px-4 py-3 text-left font-display text-[15px] ${
                  g.id === activeId ? 'bg-white text-black' : ''
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>
        </Section>
      )}
    </Screen>
  )
}
