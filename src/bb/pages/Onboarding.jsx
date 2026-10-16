import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useT } from '../../lib/i18n'
import { needsTerms } from '../../lib/setup'
import { LAST_UPDATED } from '../../legal/content'
import { Field } from '../../components/ui'
import { Spot } from '../../components/StickerKit'
import { saveProfile } from '../data'
import { useBB, useProfileSettled } from '../BBApp'
import { Splash } from '../boot'
import { BBLogo, BigButton, Note } from '../kit'

/**
 * The study profile, once per student (section 9), before anything else.
 *
 *   1. the terms, only if this account never accepted them (a Rich & Friends
 *      user already did, and is not asked twice: same document, same
 *      column);
 *   2. the first name, prefilled from the Rich & Friends profile;
 *   3. where: school and country;
 *   4. the level;
 *   5. the program and the language of instruction;
 *   6. the term: dates, hours a week, the goal.
 *
 * The app uses it in four places: the level sets the difficulty, the
 * program the examples, the dates and hours the plan, the level and school
 * the default exam formats. It is stored in bb_profiles, private, and
 * editable in Profile.
 */
export const LEVELS = ['high_school', 'cegep', 'uni_1', 'uni_2', 'uni_3', 'uni_4', 'masters', 'phd', 'pro']
export const GOALS = ['pass', 'b', 'a', 'scholarship']
export const LANGS = ['fr', 'en', 'both']

export function Choice({ on, onClick, children, hook }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      data-hook={hook}
      className={`press flex min-h-[3rem] items-center gap-2 rounded-inner border px-4 py-2.5 text-left text-body font-semibold text-ink transition-colors ${
        on ? 'border-[#009DB9] bg-[#DDF3F7]' : 'border-ink/15 bg-surface hover:border-ink/30'
      }`}
    >
      <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-pill border-2 ${on ? 'border-[#007A90] bg-[#007A90]' : 'border-ink/30'}`}>
        {on && (
          <svg viewBox="0 0 16 16" className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8.5 6.5 12 13 4.5" />
          </svg>
        )}
      </span>
      <span className="min-w-0">{children}</span>
    </button>
  )
}

/* The form starts from the profiles as they are, so it waits for both. */
export default function Onboarding() {
  const settled = useProfileSettled()
  const { bb } = useBB()
  if (!settled || bb === undefined) return <Splash />
  return <OnboardingForm />
}

function OnboardingForm() {
  const { t } = useT()
  const { user, profile, updateProfile } = useAuth()
  const { bb, setBB, courses } = useBB()
  const navigate = useNavigate()
  const askTerms = needsTerms(profile)
  const steps = [...(askTerms ? ['terms'] : []), 'name', 'school', 'level', 'program', 'term']
  const [at, setAt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(() => ({
    first_name: bb?.first_name ?? (profile?.display_name ?? '').trim().split(/\s+/)[0] ?? '',
    school: bb?.school ?? '',
    country: bb?.country ?? '',
    level: bb?.level ?? null,
    program: bb?.program ?? '',
    language: bb?.language ?? null,
    term_start: bb?.term_start ?? '',
    term_end: bb?.term_end ?? '',
    weekly_hours: bb?.weekly_hours ?? 6,
    goal: bb?.goal ?? null,
  }))
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))
  const step = steps[at]

  /* The first name, from the Rich & Friends profile once it has arrived. */
  useEffect(() => {
    const first = (profile?.display_name ?? '').trim().split(/\s+/)[0]
    if (first) setForm((f) => (f.first_name ? f : { ...f, first_name: first.slice(0, 60) }))
  }, [profile?.display_name])

  async function next() {
    setError(null)
    if (step === 'terms') {
      setBusy(true)
      const { error: err } = await updateProfile({ terms_accepted_at: new Date().toISOString(), terms_version: LAST_UPDATED })
      setBusy(false)
      if (err) return setError(t('bb.err.generic'))
    }
    if (at < steps.length - 1) return setAt(at + 1)
    setBusy(true)
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
        onboarded_at: bb?.onboarded_at ?? new Date().toISOString(),
      })
      setBB(row)
      navigate(courses?.length ? '/bb/app' : '/bb/cours/nouveau', { replace: true })
    } catch {
      setBusy(false)
      setError(t('bb.err.generic'))
    }
  }

  const canGo = step === 'name' ? form.first_name.trim().length > 0 : step === 'level' ? Boolean(form.level) : true

  return (
    <div className="ground relative min-h-dvh overflow-hidden" data-hook="app-shell" data-page="bb-onboarding">
      <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[38rem] flex-col px-6 pb-14 pt-8">
        <div className="flex items-center justify-between gap-3">
          <BBLogo layout="mono" tile="pink" className="h-10 w-auto" pad={0.2} />
          <p className="text-small font-semibold text-muted" data-hook="onb-step">
            {t('bb.onb.step', { n: at + 1, total: steps.length })}
          </p>
        </div>
        <div className="mt-3 flex gap-1.5" aria-hidden="true">
          {steps.map((s, i) => (
            <span key={s} className={`h-1.5 flex-1 rounded-pill ${i <= at ? 'bg-[#FF007A]' : 'bg-ink/15'}`} />
          ))}
        </div>

        <form
          className="mt-10 flex flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault()
            if (canGo && !busy) next()
          }}
          data-hook={`onb-${step}`}
        >
          {step === 'terms' && (
            <>
              <h1 className="text-h1 text-ink">{t('bb.onb.terms_title')}</h1>
              <p className="lede mt-3">{t('bb.onb.terms_body')}</p>
              <ul className="mt-6 space-y-2">
                {['terms', 'privacy', 'notice'].map((doc) => (
                  <li key={doc}>
                    <Link to={`/legal/${doc}`} className="lg flex items-center justify-between px-4 py-3 text-body font-semibold text-ink">
                      {t(`terms.doc_${doc}`)}
                      <span aria-hidden="true">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          {step === 'name' && (
            <>
              <h1 className="text-h1 text-ink">{t('bb.onb.name_title')}</h1>
              <div className="mt-6">
                <Field label={t('bb.onb.name_label')}>
                  <input className="field" autoFocus autoComplete="given-name" value={form.first_name} onChange={(e) => set('first_name')(e.target.value)} maxLength={60} />
                </Field>
              </div>
            </>
          )}

          {step === 'school' && (
            <>
              <h1 className="text-h1 text-ink">{t('bb.onb.school_title')}</h1>
              <div className="mt-6 space-y-5">
                <Field label={t('bb.onb.school_label')} hint={t('bb.onb.school_hint')}>
                  <input className="field" autoFocus value={form.school} onChange={(e) => set('school')(e.target.value)} maxLength={160} placeholder="Université de Montréal" />
                </Field>
                <Field label={t('bb.onb.country_label')}>
                  <input className="field" autoComplete="country-name" value={form.country} onChange={(e) => set('country')(e.target.value)} maxLength={60} placeholder="Canada" />
                </Field>
              </div>
            </>
          )}

          {step === 'level' && (
            <>
              <h1 className="text-h1 text-ink">{t('bb.onb.level_title')}</h1>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {LEVELS.map((l) => (
                  <Choice key={l} on={form.level === l} onClick={() => set('level')(l)} hook={`level-${l}`}>
                    {t(`bb.onb.level.${l}`)}
                  </Choice>
                ))}
              </div>
            </>
          )}

          {step === 'program' && (
            <>
              <h1 className="text-h1 text-ink">{t('bb.onb.program_title')}</h1>
              <div className="mt-6 space-y-6">
                <Field label={t('bb.onb.program_label')} hint={t('bb.onb.program_hint')}>
                  <input className="field" autoFocus value={form.program} onChange={(e) => set('program')(e.target.value)} maxLength={160} />
                </Field>
                <fieldset>
                  <legend className="text-small font-semibold text-ink">{t('bb.onb.lang_label')}</legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    {LANGS.map((l) => (
                      <Choice key={l} on={form.language === l} onClick={() => set('language')(l)} hook={`lang-${l}`}>
                        {t(`bb.onb.lang.${l}`)}
                      </Choice>
                    ))}
                  </div>
                </fieldset>
              </div>
            </>
          )}

          {step === 'term' && (
            <>
              <h1 className="text-h1 text-ink">{t('bb.onb.term_title')}</h1>
              <div className="mt-6 space-y-6">
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
                    <input
                      type="range"
                      min={1}
                      max={40}
                      value={form.weekly_hours}
                      onChange={(e) => set('weekly_hours')(Number(e.target.value))}
                      className="w-full max-w-[24rem] accent-[#FF007A]"
                      aria-valuetext={t('bb.onb.hours_value', { n: form.weekly_hours })}
                    />
                    <span className="w-14 shrink-0 text-right text-body font-bold tabular-nums text-ink">{t('bb.onb.hours_value', { n: form.weekly_hours })}</span>
                  </div>
                </Field>
                <fieldset>
                  <legend className="text-small font-semibold text-ink">{t('bb.onb.goal_label')}</legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {GOALS.map((g) => (
                      <Choice key={g} on={form.goal === g} onClick={() => set('goal')(g)} hook={`goal-${g}`}>
                        {t(`bb.onb.goal.${g}`)}
                      </Choice>
                    ))}
                  </div>
                </fieldset>
              </div>
            </>
          )}

          {step !== 'terms' && <p className="mt-6 text-small text-muted">{t('bb.onb.why')}</p>}
          {error && <Note tone="error" className="mt-4">{error}</Note>}

          <div className="mt-auto flex flex-col gap-3 pt-10 sm:flex-row-reverse sm:items-center">
            <BigButton type="submit" disabled={!canGo || busy} data-hook="onb-next" className="sm:w-auto sm:px-10">
              {busy ? t('bb.onb.saving') : step === 'terms' ? t('bb.onb.terms_accept') : at === steps.length - 1 ? t('bb.onb.finish') : t('bb.onb.next')}
            </BigButton>
            {at > 0 && (
              <button type="button" className="btn-ghost press sm:w-auto sm:px-8" onClick={() => setAt(at - 1)}>
                {t('bb.onb.back')}
              </button>
            )}
          </div>
        </form>
      </main>
      <Spot name="daisy" tilt={-10} delay={400} className="pointer-events-none absolute -right-6 bottom-28 hidden w-24 md:block lg:right-[8%]" />
      <Spot name="cloudguy" tilt={8} delay={520} className="pointer-events-none absolute left-[6%] top-[22%] hidden w-24 lg:block" />
    </div>
  )
}
