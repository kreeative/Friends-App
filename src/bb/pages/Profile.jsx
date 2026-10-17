import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useT, localeTag } from '../../lib/i18n'
import { usePageMeta } from '../../lib/pageMeta'
import { Field } from '../../components/ui'
import { Mark } from '../../components/Wordmark'
import { supabase } from '../../lib/supabase'
import { studyGoal } from '../../lib/bb/checkin'
import { call } from '../api'
import { saveProfile } from '../data'
import { errorMessage } from '../errors'
import { useBB } from '../BBApp'
import { Page, PageHead } from '../BBShell'
import { BigButton, Note } from '../kit'
import { Choice, GOALS, LANGS, LEVELS } from './Onboarding'

/* The study goal's title under the app's earlier names. */
const OLD_GOAL_TITLES = ['Étudier avec Beauty & Brain', 'Study with Beauty & Brain', 'Étudier avec Nerd', 'Study with Nerd']

/**
 * /hakkilo/profil: the study profile (editable, section 9), the plan and what is
 * left of today's allowances (section 13: "a student who reaches one sees
 * when it resets"), and for the owner the week's cost (section 7).
 *
 * The Rich & Friends link: a finished session can tick a personal study goal
 * in Rich & Friends (src/lib/bb/checkin.js). Switching it on finds the goal
 * this account made before, or makes it; switching it off unlinks it and
 * leaves the goal where it is, with its history.
 *
 * Coming back from Stripe with ?plus=ok&session_id=..., the page asks the
 * server to read the subscription back from Stripe (/api/bb/sync), so Plus
 * shows at once even if the webhook is late or was never told about
 * subscriptions.
 */
export default function Profile() {
  const { t, locale, setLocale } = useT()
  const { user, signOut } = useAuth()
  const { bb, setBB, status, reloadStatus } = useBB()
  const [params, setParams] = useSearchParams()
  usePageMeta({ title: `${t('bb.prof.title')} · Hakkilo` })
  const [form, setForm] = useState(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(null)
  const [note, setNote] = useState(null)

  useEffect(() => {
    if (bb && !form) {
      setForm({
        first_name: bb.first_name ?? '',
        school: bb.school ?? '',
        country: bb.country ?? '',
        level: bb.level ?? null,
        program: bb.program ?? '',
        language: bb.language ?? null,
        term_start: bb.term_start ?? '',
        term_end: bb.term_end ?? '',
        weekly_hours: bb.weekly_hours ?? 6,
        goal: bb.goal ?? null,
      })
    }
  }, [bb, form])

  /* Back from Stripe Checkout. */
  useEffect(() => {
    if (params.get('plus') !== 'ok') return
    const sessionId = params.get('session_id')
    ;(async () => {
      setBusy('sync')
      const r = await call('sync', { session_id: sessionId })
      setBusy(null)
      if (r.ok && r.data.tier === 'plus') setNote({ tone: 'good', text: t('bb.prof.welcome_plus') })
      await reloadStatus()
      setParams({}, { replace: true })
    })()
  }, [])

  const set = (k) => (v) => {
    setSaved(false)
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function save(e) {
    e.preventDefault()
    setBusy('save')
    try {
      const row = await saveProfile(user.id, {
        first_name: form.first_name.trim().slice(0, 60) || null,
        school: form.school.trim().slice(0, 160) || null,
        country: form.country.trim().slice(0, 60) || null,
        level: form.level,
        program: form.program.trim().slice(0, 160) || null,
        language: form.language,
        term_start: form.term_start || null,
        term_end: form.term_end || null,
        weekly_hours: Math.min(80, Math.max(1, Number(form.weekly_hours) || 6)),
        goal: form.goal,
      })
      setBB(row)
      setSaved(true)
    } catch {
      setNote({ tone: 'error', text: t('bb.err.generic') })
    }
    setBusy(null)
  }

  async function linkGoal(on) {
    setBusy('checkin')
    setNote(null)
    try {
      if (!on) {
        setBB(await saveProfile(user.id, { rf_goal_id: null }))
      } else {
        const title = t('bb.prof.checkin_goal')
        let goalId = null
        if (bb?.rf_goal_id) {
          const { data } = await supabase.from('goals').select('id, status').eq('id', bb.rf_goal_id).maybeSingle()
          if (data?.status === 'active') goalId = data.id
        }
        if (!goalId) {
          /* The goal made before a rename has an earlier name: found under any
             of them, so switching back on never makes a second one. */
          const { data } = await supabase.from('goals').select('id').eq('owner_id', user.id).in('commitment', [title, ...OLD_GOAL_TITLES]).eq('status', 'active').limit(1)
          goalId = data?.[0]?.id ?? null
        }
        if (!goalId) {
          const { data, error } = await supabase.from('goals').insert(studyGoal({ userId: user.id, title })).select('id').single()
          if (error) throw error
          goalId = data.id
        }
        setBB(await saveProfile(user.id, { rf_goal_id: goalId }))
      }
    } catch {
      setNote({ tone: 'error', text: t('bb.prof.checkin_failed') })
    }
    setBusy(null)
  }

  async function billing(action) {
    setBusy(action)
    setNote(null)
    const r = await call(action)
    setBusy(null)
    if (action === 'portal') {
      if (r.ok && r.data.url) return window.location.assign(r.data.url)
      return setNote({ tone: 'info', text: t('bb.prof.portal_off') })
    }
    if (!r.ok) setNote({ tone: 'error', text: errorMessage(t, locale, r.data) })
    await reloadStatus()
  }

  const tier = status?.tier ?? 'free'
  const end = status?.current_period_end ? new Date(status.current_period_end).toLocaleDateString(localeTag(locale), { day: 'numeric', month: 'long', year: 'numeric' }) : null
  const buckets = ['ingest', 'generate', 'coach', 'grade']

  return (
    <Page>
      <PageHead title={t('bb.prof.title')} />
      {note && <Note tone={note.tone} className="mt-4">{note.text}</Note>}
      {busy === 'sync' && <Note className="mt-4">{t('bb.prof.syncing')}</Note>}

      <section className="lg mt-6 p-5" data-hook="bb-plan-card">
        <h2 className="eyebrow">{t('bb.prof.plan')}</h2>
        <p className="mt-2 text-[1.5rem] font-bold text-ink">{t(`bb.prof.tier.${tier}`)}</p>
        {tier === 'plus' && end && <p className="mt-1 text-small text-ink">{status.cancel_at_period_end ? t('bb.prof.ends', { date: end }) : t('bb.prof.renews', { date: end })}</p>}
        {tier === 'owner' && <p className="mt-1 text-small text-ink">{t('bb.price.owner')}</p>}
        <div className="mt-4 flex flex-wrap gap-3">
          {tier === 'free' && (
            <Link to="/hakkilo/tarifs" className="btn press w-auto bg-ink px-8 font-bold text-white hover:opacity-90" data-hook="bb-upgrade">
              {t('bb.courses.upgrade')}
            </Link>
          )}
          {tier === 'plus' && !status.cancel_at_period_end && (
            <button type="button" className="btn-ghost press w-auto px-6" onClick={() => billing('cancel')} disabled={busy !== null}>
              {t('bb.prof.cancel')}
            </button>
          )}
          {tier === 'plus' && status.cancel_at_period_end && (
            <BigButton className="w-auto px-8" onClick={() => billing('resume')} disabled={busy !== null}>
              {t('bb.prof.resume')}
            </BigButton>
          )}
          {tier === 'plus' && (
            <button type="button" className="btn-outline press w-auto px-6" onClick={() => billing('portal')} disabled={busy !== null}>
              {t('bb.prof.manage')}
            </button>
          )}
        </div>

        <h3 className="eyebrow mt-6">{t('bb.prof.usage')}</h3>
        <ul className="mt-2 space-y-1.5">
          {buckets.map((b) => {
            const used = status?.used?.[b] ?? 0
            const limit = status?.limits?.[b]
            return (
              <li key={b} className="flex items-baseline justify-between gap-4 text-small text-ink">
                <span>{t(`bb.prof.use.${b}`)}</span>
                <span className="font-semibold tabular-nums">{limit == null ? t('bb.prof.no_limit', { used }) : t('bb.prof.of', { used, limit })}</span>
              </li>
            )
          })}
        </ul>
        {status?.cost && (
          <p className="mt-4 text-small text-ink" data-hook="bb-cost">
            <strong>{t('bb.prof.cost')}: </strong>
            {t('bb.prof.cost_line', { usd: status.cost.week_usd.toFixed(2), calls: status.cost.calls, cached: status.cost.cached_calls })}
          </p>
        )}
      </section>

      {form && (
        <form onSubmit={save} className="lg mt-6 space-y-5 p-5" data-hook="bb-study-profile">
          <h2 className="eyebrow">{t('bb.prof.study')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('bb.onb.name_label')}>
              <input className="field" value={form.first_name} onChange={(e) => set('first_name')(e.target.value)} maxLength={60} />
            </Field>
            <Field label={t('bb.onb.school_label')}>
              <input className="field" value={form.school} onChange={(e) => set('school')(e.target.value)} maxLength={160} />
            </Field>
            <Field label={t('bb.onb.country_label')}>
              <input className="field" value={form.country} onChange={(e) => set('country')(e.target.value)} maxLength={60} />
            </Field>
            <Field label={t('bb.onb.program_label')}>
              <input className="field" value={form.program} onChange={(e) => set('program')(e.target.value)} maxLength={160} />
            </Field>
          </div>
          <fieldset>
            <legend className="text-small font-semibold text-ink">{t('bb.onb.level_title')}</legend>
            <select className="field mt-2" value={form.level ?? ''} onChange={(e) => set('level')(e.target.value || null)}>
              <option value="">…</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {t(`bb.onb.level.${l}`)}
                </option>
              ))}
            </select>
          </fieldset>
          <fieldset>
            <legend className="text-small font-semibold text-ink">{t('bb.onb.lang_label')}</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {LANGS.map((l) => (
                <Choice key={l} on={form.language === l} onClick={() => set('language')(l)}>
                  {t(`bb.onb.lang.${l}`)}
                </Choice>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('bb.onb.term_start')}>
              <input type="date" className="field" value={form.term_start ?? ''} onChange={(e) => set('term_start')(e.target.value)} />
            </Field>
            <Field label={t('bb.onb.term_end')}>
              <input type="date" className="field" value={form.term_end ?? ''} onChange={(e) => set('term_end')(e.target.value)} />
            </Field>
          </div>
          <Field label={t('bb.onb.hours_label')}>
            <div className="flex items-center gap-4">
              <input type="range" min={1} max={40} value={form.weekly_hours} onChange={(e) => set('weekly_hours')(Number(e.target.value))} className="w-full max-w-[24rem] accent-[#F8CB02]" aria-valuetext={t('bb.onb.hours_value', { n: form.weekly_hours })} />
              <span className="w-14 shrink-0 text-right text-body font-bold tabular-nums text-ink">{t('bb.onb.hours_value', { n: form.weekly_hours })}</span>
            </div>
          </Field>
          <fieldset>
            <legend className="text-small font-semibold text-ink">{t('bb.onb.goal_label')}</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {GOALS.map((g) => (
                <Choice key={g} on={form.goal === g} onClick={() => set('goal')(g)}>
                  {t(`bb.onb.goal.${g}`)}
                </Choice>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-ghost press w-auto px-8" disabled={busy !== null}>
              {t('bb.prof.save')}
            </button>
            {saved && <span className="text-small font-semibold text-ink" role="status">✓ {t('bb.prof.saved')}</span>}
          </div>
          <p className="text-small text-muted">{t('bb.prof.privacy')}</p>
        </form>
      )}

      <section className="lg mt-6 p-5" data-hook="bb-checkin">
        <h2 className="eyebrow">{t('bb.prof.rf')}</h2>
        <label className="press mt-3 flex cursor-pointer items-start gap-3 rounded-inner bg-ink/[0.035] p-4">
          <input type="checkbox" checked={Boolean(bb?.rf_goal_id)} disabled={busy !== null || !bb} onChange={(e) => linkGoal(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#F8CB02]" data-hook="bb-checkin-toggle" />
          <span className="min-w-0">
            <span className="block text-body text-ink">{t('bb.prof.checkin')}</span>
            <span className="mt-0.5 block text-small text-muted">{t('bb.prof.checkin_sub', { goal: t('bb.prof.checkin_goal') })}</span>
          </span>
        </label>
      </section>

      <section className="lg mt-6 space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-small font-semibold text-ink">{t('bb.prof.language')}</span>
          <div className="flex gap-1 rounded-pill bg-ink/[0.06] p-1" role="group">
            {['fr', 'en'].map((l) => (
              <button key={l} type="button" aria-pressed={locale === l} onClick={() => setLocale(l)} className={`press rounded-pill px-4 py-1.5 text-small font-semibold ${locale === l ? 'bg-[#CFC2FF] text-ink' : 'text-muted'}`}>
                {l === 'fr' ? 'Français' : 'English'}
              </button>
            ))}
          </div>
        </div>
        <Link to="/" className="press flex items-center gap-3 rounded-inner bg-surface px-4 py-3 text-body font-semibold text-ink" data-hook="bb-open-rf">
          <Mark size={28} />
          {t('bb.prof.switch')}
        </Link>
        <button type="button" className="btn-outline press" onClick={signOut}>
          {t('bb.prof.sign_out')}
        </button>
      </section>
    </Page>
  )
}
