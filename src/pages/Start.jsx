import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useGroup } from '../context/GroupContext'
import { DAYS, localTimezone } from '../lib/time'
import { Field } from '../components/ui'
import Wordmark from '../components/Wordmark'
import { useT } from '../lib/i18n'

export default function Start() {
  const { reload, setActiveGroup } = useGroup()
  const { t, locale } = useT()
  const [mode, setMode] = useState('create')
  const [name, setName] = useState('')
  const [dow, setDow] = useState(0)
  const [hour, setHour] = useState(18)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const dayNames =
    locale === 'fr'
      ? ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
      : DAYS

  async function create(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { data, error: err } = await supabase.rpc('create_group', {
      p_name: name.trim(),
      p_timezone: localTimezone(),
      p_cadence_days: 7,
      p_checkin_dow: Number(dow),
      p_opens_hour: Number(hour),
      p_window_hours: 30,
    })
    setBusy(false)
    if (err) return setError(err.message)
    const g = Array.isArray(data) ? data[0] : data
    if (g?.id) setActiveGroup(g.id)
    await reload()
  }

  async function join(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { data, error: err } = await supabase.rpc('join_group', { p_code: code.trim() })
    setBusy(false)
    if (err) return setError(err.message)
    const g = Array.isArray(data) ? data[0] : data
    if (g?.id) setActiveGroup(g.id)
    await reload()
  }

  return (
    <div className="relative min-h-dvh bg-bg">
      <main className="relative z-10 mx-auto w-full max-w-content animate-rise px-6 pb-20 pt-14">
        <Wordmark size={140} />

        <div className="mt-10 flex gap-2">
          {[
            ['create', t('start.new_group')],
            ['join', t('start.join_one')],
          ].map(([v, label]) => (
            <button
              key={v}
              onClick={() => setMode(v)}
              className={mode === v ? 'chip-accent press' : 'chip-quiet press'}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'create' ? (
          <form onSubmit={create} className="mt-10 space-y-8">
            <Field label={t('start.group_name')}>
              <input
                className="field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('start.group_name_ph')}
                maxLength={60}
              />
            </Field>

            <Field label={t('start.checkin_opens')} hint={t('start.checkin_hint')}>
              <div className="grid grid-cols-2 gap-4">
                <select className="field-soft" value={dow} onChange={(e) => setDow(e.target.value)}>
                  {dayNames.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
                <select className="field-soft" value={hour} onChange={(e) => setHour(e.target.value)}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
              </div>
            </Field>

            <p className="text-small text-muted">
              {t('start.window_note', { tz: localTimezone() })}
            </p>

            {error && <p className="card text-small text-negative">{error}</p>}

            <button className="btn-primary press" disabled={busy || name.trim().length < 2}>
              {busy ? t('start.creating') : t('start.create')}
            </button>
          </form>
        ) : (
          <form onSubmit={join} className="mt-10 space-y-8">
            <Field label={t('start.invite_code')} hint={t('start.invite_hint')}>
              <input
                className="field text-center text-h2 uppercase tracking-[0.3em]"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="A1B2C3"
                maxLength={6}
              />
            </Field>

            {error && <p className="card text-small text-negative">{error}</p>}

            <button className="btn-primary press" disabled={busy || code.trim().length < 4}>
              {busy ? t('start.joining') : t('start.join')}
            </button>
          </form>
        )}
      </main>
    </div>
  )
}
