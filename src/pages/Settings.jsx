import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { completionRate } from '../lib/stats'
import { DAYS } from '../lib/time'
import { useT } from '../lib/i18n'
import { Avatar, Screen, Section, Stat, TopBar } from '../components/ui'
import HistoryStrip from '../components/HistoryStrip'
import ThemePicker from '../components/ThemePicker'
import DangerZone from '../components/DangerZone'
import { LegalLinks } from './Legal'

const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

export default function Settings() {
  const { user } = useAuth()
  const { group, members, statuses, groups, activeId } = useGroup()
  const { t, locale, setLocale } = useT()

  /**
   * Collective progress, deliberately not a ranking.
   *
   * In a friend group a leaderboard mostly teaches whoever is last to stop
   * opening the app, and they are the person the group most needs to keep.
   * So the shared number is the group's, and individual histories sit next to
   * each other unsorted rather than in rank order.
   */
  const together = useMemo(() => {
    const done = statuses.filter((s) => s.status === 'submitted').length
    const counted = statuses.filter((s) => s.status !== 'pending' && s.status !== 'away').length
    return { done, counted, pct: counted ? Math.round((done / counted) * 100) : null }
  }, [statuses])

  if (!group) return null

  const dayName = (locale === 'fr' ? DAYS_FR : DAYS)[group.checkin_dow]
  const shareText = `${group.name}. Rich & Friends. ${t('start.invite_code')}: ${group.invite_code}`

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
        sub={`${dayName} ${String(group.opens_hour).padStart(2, '0')}:00 · ${group.timezone}`}
      />

      <Section title={t('board.together')}>
        <div className="flex gap-6">
          {/* '-', not '0%'. A blind em-dash removal pass turned the "no data
              yet" glyph into a literal zero percent, which asserts a measured
              rate for a group that has not had a cycle yet. */}
          <Stat
            value={together.pct === null ? '-' : `${together.pct}%`}
            label={t('settings.group_rate')}
            hint={`${together.done} / ${together.counted}`}
          />
          <Stat
            value={members.length}
            label={t('settings.people')}
            hint={t('settings.people_hint')}
          />
        </div>
      </Section>

      <Section title={t('settings.everyone')}>
        <div className="list">
          {members.map((m) => {
            const rows = statuses.filter((s) => s.user_id === m.user_id)
            const r = completionRate(rows, 14)
            return (
              <div key={m.user_id} className="py-5">
                <div className="flex items-center gap-4">
                  <Avatar profile={m.profile} />
                  <span className="flex-1 text-body text-ink">
                    {m.profile?.display_name}
                    {m.user_id === user?.id && (
                      <span className="text-muted"> · {t('board.you')}</span>
                    )}
                  </span>
                  {/* '-', not '0/0'. "0 of 0" reads as attempted-and-failed
                      rather than as nobody having had a cycle yet. */}
                  <span className="text-small text-muted">
                    {r.total ? `${r.done}/${r.total}` : '-'}
                  </span>
                </div>
                <div className="mt-4 pl-[3.5rem]">
                  <HistoryStrip rows={rows} count={10} />
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      <Section title={t('board.invite')}>
        <div className="card">
          <p className="font-display text-metric tracking-[0.12em] text-ink">
            {group.invite_code}
          </p>
          <button onClick={share} className="btn-primary press mt-6">
            {t('settings.send_to_friend')}
          </button>
          <p className="mt-4 text-small text-muted">{t('settings.invite_note')}</p>
        </div>
      </Section>

      <Section title={t('theme.title')}>
        <ThemePicker />
      </Section>

      <Section title={t('settings.language')}>
        <div className="flex gap-2">
          {[
            ['en', 'English'],
            ['fr', 'Français'],
          ].map(([code, label]) => (
            <button
              key={code}
              onClick={() => setLocale(code)}
              className={locale === code ? 'chip-accent press' : 'chip-quiet press'}
            >
              {label}
            </button>
          ))}
        </div>
      </Section>

      {groups.length > 1 && (
        <Section title={t('settings.switch_group')}>
          <div className="space-y-2">
            {groups.map((g) => (
              <Link
                key={g.id}
                to={`/g/${g.id}`}
                className={`press block w-full rounded-card px-5 py-4 text-left text-body ${
                  g.id === activeId ? 'bg-accent text-on-accent' : 'bg-raised text-ink'
                }`}
              >
                {g.name}
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* Last, and under its own heading. Leaving was previously impossible
          without signing out of the product, which is why people were signing
          out of the product. */}
      <Section title={t('settings.leaving')}>
        <DangerZone />
      </Section>

      <Section>
        <LegalLinks />
      </Section>
    </Screen>
  )
}
