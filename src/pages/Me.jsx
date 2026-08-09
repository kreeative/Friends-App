import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { completionRate, consecutiveMisses, rollingRate } from '../lib/stats'
import { dayKey } from '../lib/time'
import { ACCEPT, isMissingBucket, removeAvatar, uploadAvatar } from '../lib/avatar'
import { CURRENCIES, FALLBACK, currencyName } from '../lib/currency'
import { localeTag, useT } from '../lib/i18n'
import { Avatar, Field, Screen, Section, TopBar } from '../components/ui'
import ConsistencyPanel from '../components/ConsistencyPanel'

export default function Me() {
  const { user, profile, signOut, updateProfile } = useAuth()
  const { statusesFor, myGoals, soloGoals, groups, reloadGroup } = useGroup()
  const { t, locale } = useT()
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

  /**
   * Date of birth, saved the moment a whole date is in the box.
   *
   * No Save button, because a date input only fires a change when the value is
   * complete, so there is no half-typed state to protect anybody from. The
   * field is seeded from the profile and then owned locally, otherwise every
   * keystroke would fight the value coming back from the round trip.
   *
   * The year is stored because Postgres has no date-without-year, and it is
   * never shown: see supabase/20_quiet_and_birthdays.sql, and record_birthdays,
   * which compares the month and the day only.
   */
  const [birthday, setBirthday] = useState('')
  const [birthdayError, setBirthdayError] = useState(false)

  useEffect(() => {
    setBirthday(profile?.birthday ?? '')
  }, [profile?.birthday])

  async function saveBirthday(value) {
    setBirthday(value)
    setBirthdayError(false)
    const { error } = (await updateProfile?.({ birthday: value || null })) ?? {}
    if (error) setBirthdayError(true)
  }

  /**
   * Your name, saved when you leave the field.
   *
   * Not on every keystroke, which would be a write per letter, and not behind
   * a Save button either: a form with one text box and a button under it makes
   * a two second edit feel like filling something in. Blur is the moment you
   * have finished typing, and Enter is the same moment for anyone who does not
   * think to tap away.
   *
   * An empty name is refused rather than saved. display_name is `not null` and
   * is the only thing identifying a row in every roster in the app, so a blank
   * one is an unreadable board for everybody in the group, not just for the
   * person who cleared it. The box reverts to what it was.
   */
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState(false)

  useEffect(() => {
    setName(profile?.display_name ?? '')
  }, [profile?.display_name])

  async function saveName() {
    const next = name.trim().slice(0, 60)
    if (!next) return setName(profile?.display_name ?? '')
    if (next === profile?.display_name) return

    setNameError(false)
    const { error } = (await updateProfile?.({ display_name: next })) ?? {}
    if (error) setNameError(true)
    else setName(next)
  }

  /**
   * A photo, shrunk on this device before it is sent anywhere.
   *
   * See src/lib/avatar.js for why the resize happens in the browser. The two
   * failures worth telling apart are a missing bucket, which is an unrun
   * migration and has an instruction, and everything else, which does not.
   */
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState(null)

  async function pickPhoto(file) {
    if (!file || !user) return
    setPhotoBusy(true)
    setPhotoError(null)

    const { url, error } = await uploadAvatar(user.id, file)
    if (error) {
      setPhotoError(isMissingBucket(error) ? 'missing' : 'failed')
      setPhotoBusy(false)
      return
    }

    const { error: saveError } = (await updateProfile?.({ avatar_url: url })) ?? {}
    if (saveError) setPhotoError('failed')
    setPhotoBusy(false)
  }

  async function clearPhoto() {
    if (!user) return
    setPhotoBusy(true)
    setPhotoError(null)
    await removeAvatar(user.id)
    const { error } = (await updateProfile?.({ avatar_url: null })) ?? {}
    if (error) setPhotoError('failed')
    setPhotoBusy(false)
  }

  /**
   * The currency the budget is counted in.
   *
   * Saved straight from the select, because a dropdown has no half-chosen
   * state to protect anybody from. Nothing is converted: the amounts are the
   * numbers the person typed, and switching the label from dollars to francs
   * does not move any money. Anyone who genuinely relocates is retyping their
   * plan anyway, and an app that silently multiplied their rent by six hundred
   * because it looked up a rate would be far worse than one that does nothing.
   */
  const [currencyError, setCurrencyError] = useState(false)

  async function saveCurrency(code) {
    setCurrencyError(false)
    const { error } = (await updateProfile?.({ currency: code })) ?? {}
    if (error) setCurrencyError(true)
  }

  /**
   * Play the budget intro again.
   *
   * The flag is the whole mechanism: Money renders the carousel whenever it is
   * false, so putting it back is the entire feature. Navigating afterwards is
   * the difference between a switch and an action, a control that appears to
   * do nothing until you happen to visit another screen is one people press
   * twice.
   */
  async function rewatchIntro() {
    setBusy(true)
    await updateProfile?.({ has_seen_budget_intro: false })
    setBusy(false)
    navigate('/money')
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

      {/* The only thing on this screen that is about who you are rather than
          about how you are doing, which is why it is its own section and not a
          row in the account list underneath. */}
      <Section title={t('me.profile')}>
        <div className="lg space-y-6 p-6">
          {/* The picture first, and shown at the size it is actually used at
              plus a bit. A 40px preview cannot tell you whether the crop took
              your head off. */}
          <div className="flex items-center gap-4">
            <Avatar profile={profile} size={64} />
            <div className="min-w-0">
              {/* A file input styled as a button rather than a button that
                  clicks a hidden input: the label is the control, so it keeps
                  the keyboard behaviour and the focus ring for free. */}
              <label
                className={`goal-action press inline-flex cursor-pointer ${
                  photoBusy ? 'pointer-events-none opacity-60' : ''
                }`}
              >
                {photoBusy ? '…' : profile?.avatar_url ? t('me.photo_change') : t('me.photo_add')}
                <input
                  type="file"
                  accept={ACCEPT}
                  className="sr-only"
                  disabled={photoBusy}
                  onChange={(e) => {
                    pickPhoto(e.target.files?.[0])
                    // Cleared so choosing the same file twice fires again.
                    e.target.value = ''
                  }}
                />
              </label>
              {profile?.avatar_url && (
                <button
                  onClick={clearPhoto}
                  disabled={photoBusy}
                  className="ml-2 text-small text-muted underline-offset-4 hover:underline disabled:opacity-60"
                >
                  {t('me.photo_remove')}
                </button>
              )}
            </div>
          </div>

          {photoError && (
            <p className="text-small text-negative">
              {photoError === 'missing' ? t('me.photo_not_installed') : t('me.photo_failed')}
            </p>
          )}

          <Field label={t('me.name')} hint={t('me.name_hint')}>
            <input
              type="text"
              className="field"
              value={name}
              maxLength={60}
              autoComplete="name"
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
          </Field>
          {nameError && <p className="text-small text-negative">{t('me.name_failed')}</p>}

          <Field label={t('me.birthday')} hint={t('me.birthday_hint')}>
            <input
              type="date"
              className="field"
              value={birthday}
              max={dayKey()}
              onChange={(e) => saveBirthday(e.target.value)}
            />
          </Field>
          {birthdayError && <p className="text-small text-negative">{t('me.birthday_failed')}</p>}

          <Field label={t('me.currency')} hint={t('me.currency_hint')}>
            {/* The code and the name together. "XOF" alone is a lookup, and
                "franc CFA (BCEAO)" alone does not tell somebody scanning for
                the three letters their bank app shows them. */}
            <select
              className="field"
              value={profile?.currency ?? FALLBACK}
              onChange={(e) => saveCurrency(e.target.value)}
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {`${code} · ${currencyName(code, localeTag(locale))}`}
                </option>
              ))}
            </select>
          </Field>
          {currencyError && <p className="text-small text-negative">{t('me.currency_failed')}</p>}
        </div>
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
              onClick={rewatchIntro}
              disabled={busy}
              className="press flex w-full items-center gap-4 py-5 text-left"
            >
              <span className="flex-1 text-body text-ink">{t('settings.rewatch_intro')}</span>
              <span className="text-small text-muted">→</span>
            </button>
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
