import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
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
  const { group, members, statuses, groups, activeId, myRole, reload } = useGroup()
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

  const [roleBusy, setRoleBusy] = useState(null)
  const [roleError, setRoleError] = useState(null)

  /**
   * Promote or demote, through the database function.
   *
   * Every rule about who may do this lives in set_member_role, not here.
   * Hiding the button from a non-creator is courtesy; the refusal is enforced
   * server-side, so a crafted call from a console gets the same answer.
   */
  async function changeRole(userId, role) {
    setRoleBusy(userId)
    setRoleError(null)
    const { error } = await supabase.rpc('set_member_role', {
      p_group: activeId,
      p_user: userId,
      p_role: role,
    })
    if (error) {
      /* The likely failure is that 18_daily_roles_and_feed.sql has not been
         run, which PostgREST reports as a missing function: a message about a
         schema cache, which reads like an application bug rather than an
         unrun migration. */
      const raw = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase()
      const notInstalled =
        raw.includes('pgrst202') || raw.includes('could not find the function')
      setRoleError(notInstalled ? t('settings.roles_not_installed') : error.message)
    } else {
      await reload()
    }
    setRoleBusy(null)
  }

  async function setAdminsCanDelete(next) {
    setRoleError(null)
    const { error } = await supabase
      .from('groups')
      .update({ admins_can_delete: next })
      .eq('id', activeId)
    if (error) setRoleError(error.message)
    else await reload()
  }

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
          {/* No hint. It read "2 to 6 works best", which stopped being true
              when the cap was lifted, and telling a group of nine it is the
              wrong size is worse than saying nothing. */}
          <Stat value={members.length} label={t('settings.people')} />
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
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body text-ink">
                      {m.profile?.display_name}
                      {m.user_id === user?.id && (
                        <span className="text-muted"> · {t('board.you')}</span>
                      )}
                    </span>
                    {/* Under the name rather than beside it: inline, a long
                        name and a badge compete for one row and something
                        truncates, and roles are scanned down a column rather
                        than read in a sentence. */}
                    {m.role !== 'member' && (
                      <span
                        className={`mt-1 inline-flex items-center rounded-pill px-2.5 py-0.5 text-label font-bold uppercase tracking-[0.08em] ${
                          m.role === 'creator'
                            ? 'bg-accent text-on-accent'
                            : 'bg-ink/[0.08] text-ink'
                        }`}
                      >
                        {m.role === 'creator'
                          ? t('settings.role_creator')
                          : t('settings.role_admin')}
                      </span>
                    )}
                  </span>
                  {/* '-', not '0/0'. "0 of 0" reads as attempted-and-failed
                      rather than as nobody having had a cycle yet. */}
                  <span className="text-small text-muted">
                    {r.total ? `${r.done}/${r.total}` : '-'}
                  </span>
                </div>
                {/* Only the creator sees these, because only the creator can
                    act on them. A control that always errors reads as a bug
                    rather than as a permission. */}
                {myRole === 'creator' && m.user_id !== user?.id && (
                  <div className="mt-3 pl-[3.5rem]">
                    <button
                      onClick={() => changeRole(m.user_id, m.role === 'admin' ? 'member' : 'admin')}
                      disabled={roleBusy === m.user_id}
                      className="goal-action press disabled:opacity-60"
                    >
                      {roleBusy === m.user_id
                        ? '…'
                        : m.role === 'admin'
                          ? t('settings.demote')
                          : t('settings.promote')}
                    </button>
                  </div>
                )}

                <div className="mt-4 pl-[3.5rem]">
                  <HistoryStrip rows={rows} count={10} />
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      {/**
       * The delete permission, and only the creator can see it.
       *
       * Off by default in the schema. Deleting a group destroys everybody's
       * history, so whether that power is shared is the creator's call, which
       * is also why an admin cannot reach this switch to grant it to
       * themselves.
       */}
      {myRole === 'creator' && (
        <Section title={t('settings.permissions')}>
          <label className="press flex cursor-pointer items-start gap-3 rounded-inner bg-ink/[0.035] p-4">
            <input
              type="checkbox"
              checked={Boolean(group.admins_can_delete)}
              onChange={(e) => setAdminsCanDelete(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[rgb(var(--c-accent))]"
            />
            <span>
              <span className="block text-body text-ink">{t('settings.admins_can_delete')}</span>
              <span className="mt-1 block text-small text-muted">
                {group.admins_can_delete
                  ? t('settings.admins_can_delete_on')
                  : t('settings.admins_can_delete_off')}
              </span>
            </span>
          </label>
          {roleError && <p className="mt-4 text-small text-negative">{roleError}</p>}
        </Section>
      )}

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
