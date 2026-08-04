import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useGroup } from '../context/GroupContext'
import { DAYS, localTimezone } from '../lib/time'
import { Field } from '../components/ui'

export default function Start() {
  const { reload, setActiveGroup } = useGroup()
  const [mode, setMode] = useState('create')
  const [name, setName] = useState('')
  const [dow, setDow] = useState(0)
  const [hour, setHour] = useState(18)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

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
    <main className="min-h-dvh bg-black px-5 py-12">
      <h1 className="font-display text-[30px] font-bold uppercase leading-none tracking-tight">
        Start
      </h1>

      <div className="mt-7 grid grid-cols-2 gap-2">
        {[
          ['create', 'New group'],
          ['join', 'Join one'],
        ].map(([v, l]) => (
          <button
            key={v}
            onClick={() => setMode(v)}
            className={`hair py-3 font-mono text-[11px] uppercase tracking-[0.18em] ${
              mode === v ? 'bg-white text-black' : 'text-white/50'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {mode === 'create' ? (
        <form onSubmit={create} className="mt-8 space-y-6">
          <Field label="Group name">
            <input
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sunday Four"
              maxLength={60}
            />
          </Field>

          <Field
            label="Check-in opens"
            hint="Everyone checks in inside the same window. The shared moment is the part that keeps a group alive — staggered check-ins are just a form that's always open."
          >
            <div className="grid grid-cols-2 gap-3">
              <select className="field" value={dow} onChange={(e) => setDow(e.target.value)}>
                {DAYS.map((d, i) => (
                  <option key={d} value={i} className="bg-black">
                    {d}
                  </option>
                ))}
              </select>
              <select className="field" value={hour} onChange={(e) => setHour(e.target.value)}>
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h} className="bg-black">
                    {String(h).padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            </div>
          </Field>

          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/25">
            Window stays open 30 hours · {localTimezone()}
          </p>

          {error && <p className="hair p-3 text-[13px] text-white/70">{error}</p>}
          <button className="btn-solid" disabled={busy || name.trim().length < 2}>
            {busy ? 'Creating' : 'Create group'}
          </button>
        </form>
      ) : (
        <form onSubmit={join} className="mt-8 space-y-6">
          <Field label="Invite code" hint="Six characters, from whoever set the group up.">
            <input
              className="field font-mono uppercase tracking-[0.3em]"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="A1B2C3"
              maxLength={6}
            />
          </Field>
          {error && <p className="hair p-3 text-[13px] text-white/70">{error}</p>}
          <button className="btn-solid" disabled={busy || code.trim().length < 4}>
            {busy ? 'Joining' : 'Join'}
          </button>
        </form>
      )}
    </main>
  )
}
