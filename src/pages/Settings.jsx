import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { DAYS } from '../lib/time'
import { useT } from '../lib/i18n'
import { Avatar, Screen, Section } from '../components/ui'
import GroupHeader from '../components/GroupHeader'
import InviteSheet from '../components/InviteSheet'
import MemberSheet from '../components/MemberSheet'
import ThemePicker from '../components/ThemePicker'
import LanguagePicker from '../components/LanguagePicker'
import DangerZone from '../components/DangerZone'
import PurchaseCheck from '../components/PurchaseCheck'
import { LegalLinks } from './Legal'

const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

/** A row in the quick actions card. One line, one icon, one job. */
function ActionRow({ icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press flex w-full items-center gap-4 py-4 text-left"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-ink/[0.06] text-ink">
        {icon}
      </span>
      <span className="flex-1 text-body text-ink">{label}</span>
      <span aria-hidden="true" className="shrink-0 text-muted/60">
        <Chevron />
      </span>
    </button>
  )
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        d="M9 5l7 7-7 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="M12 5v14M5 12h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.3-2.3a4 4 0 0 0-5.7-5.7l-1.3 1.3" />
        <path d="M13.5 10.5a4 4 0 0 0-5.7 0l-2.3 2.3a4 4 0 0 0 5.7 5.7l1.3-1.3" />
      </g>
    </svg>
  )
}

export default function Settings() {
  const { user } = useAuth()
  const { group, members, groups, activeId, myRole, reload } = useGroup()
  const { t, locale } = useT()

  const [inviting, setInviting] = useState(false)
  const [tapped, setTapped] = useState(null)
  const [error, setError] = useState(null)

  if (!group) return null

  /**
   * When the day turns, said only when it is actually known.
   *
   * These three columns arrive with the group row, and a render between the
   * route resolving and that row landing, or a group written before one of
   * them existed, produced the literal string "undefined undefined:00 ·
   * undefined" under the group's name. A missing schedule is a state; a line
   * of the word "undefined" is a bug wearing a sentence.
   */
  const dayName = (locale === 'fr' ? DAYS_FR : DAYS)[group.checkin_dow]
  const hour = Number.isFinite(group.opens_hour) ? String(group.opens_hour).padStart(2, '0') : null
  const when = dayName && hour ? `${dayName} ${hour}:00` : null
  const sub = [when, group.timezone].filter(Boolean).join(' · ') || null

  const isAdmin = myRole === 'creator' || myRole === 'admin'

  async function setAdminsCanDelete(next) {
    setError(null)
    const { error: err } = await supabase
      .from('groups')
      .update({ admins_can_delete: next })
      .eq('id', activeId)
    if (err) setError(err.message)
    else await reload()
  }

  return (
    <Screen>
      {/**
       * No TopBar, and no numbers.
       *
       * This screen used to open with the group name in the chrome, then a
       * completion percentage and a head count, then a roster carrying a
       * fourteen-day history strip and an "X/Y" per person. That is three
       * different reports of the same thing the board already leads with, on
       * the one page in the app whose job is not reporting but changing.
       *
       * It is a settings page now: what this group is called, how somebody
       * else gets in, who is in it, and the switches. Every metric has gone
       * back to the board, which is where a metric belongs.
       */}
      <GroupHeader
        group={group}
        canEdit={isAdmin}
        sub={sub}
      />

      <Section>
        <div className="lg divide-y divide-hairline px-5">
          <ActionRow
            icon={<PlusIcon />}
            label={t('settings.add_members')}
            onClick={() => setInviting(true)}
          />
          <ActionRow
            icon={<LinkIcon />}
            label={t('settings.invite_link')}
            onClick={() => setInviting(true)}
          />
        </div>
      </Section>

      {/**
       * The roster, as a contact list.
       *
       * Avatar, name, role. Nothing else: no rate, no strip of the last ten
       * days, no controls sitting under every row waiting to be used twice in
       * the life of the group. Tapping somebody opens what you can do about
       * them, which is where those controls went.
       */}
      <Section title={t('settings.members_count', { n: members.length })}>
        <div className="lg divide-y divide-hairline px-5">
          {members.map((m) => (
            <button
              key={m.user_id}
              type="button"
              onClick={() => setTapped(m)}
              className="press flex w-full items-center gap-4 py-4 text-left"
            >
              <Avatar profile={m.profile} size={44} />

              <span className="min-w-0 flex-1">
                <span className="block truncate text-body text-ink">
                  {m.profile?.display_name}
                  {m.user_id === user?.id && (
                    <span className="text-muted"> · {t('board.you')}</span>
                  )}
                </span>
              </span>

              {m.role !== 'member' && (
                <span
                  className={`shrink-0 rounded-pill px-2.5 py-0.5 text-label font-semibold uppercase tracking-[0.06em] ${
                    m.role === 'creator' ? 'bg-accent text-on-accent' : 'bg-ink/[0.08] text-ink'
                  }`}
                >
                  {/* The short form. "Créateur du groupe" beside a name in a
                      44px row eats the name, and the row's job is the name.
                      The sheet says it in full. */}
                  {m.role === 'creator'
                    ? t('settings.role_creator_short')
                    : t('settings.role_admin')}
                </span>
              )}

              <span aria-hidden="true" className="shrink-0 text-muted/60">
                <Chevron />
              </span>
            </button>
          ))}
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
          {error && <p className="mt-4 text-small text-negative">{error}</p>}
        </Section>
      )}

      <Section title={t('theme.title')}>
        <ThemePicker />
      </Section>

      <Section title={t('settings.language')}>
        <LanguagePicker />
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

      {/* Above Leaving, because it is a thing that helps rather than a thing
          that removes. Under its own heading so nobody presses it by accident
          while looking for something else. */}
      <Section title={t('diag.title')}>
        <PurchaseCheck />
      </Section>

      {/* Last, and under its own heading. Leaving was previously impossible
          without signing out of the product, which is why people were signing
          out of the product. */}
      <Section title={t('settings.leaving')}>
        <DangerZone />
      </Section>

      <Section>
        <LegalLinks />
      </Section>

      <InviteSheet group={group} open={inviting} onClose={() => setInviting(false)} />
      {tapped && (
        <MemberSheet
          member={tapped}
          myRole={myRole}
          meId={user?.id}
          onClose={() => setTapped(null)}
        />
      )}
    </Screen>
  )
}
