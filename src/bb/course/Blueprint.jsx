import { useState } from 'react'
import { useT } from '../../lib/i18n'
import { supabase } from '../../lib/supabase'
import { Choice } from '../pages/Onboarding'
import { changed } from '../../lib/dirty'

/**
 * "Here is what your exam looks like. Fix anything that's off." (section 2.5)
 *
 * What the files said about the exam (bb_blueprints, written by the reader,
 * never confirmed by itself) over what the student typed when creating the
 * course. Shown until she confirms it, and editable: the types, how many
 * questions, how long. In the form, Save stays grey until a value differs
 * from what was shown (src/lib/dirty.js), and Cancel goes back to the
 * summary, where "C'est bon" confirms it as it is: a grey Save alone would
 * leave no way out of a form opened to find nothing wrong.
 */
const TYPES = ['mcq', 'tf', 'short', 'calc', 'case']
const norm = (x) => (x === 'calculation' ? 'calc' : x)

export default function Blueprint({ course, blueprint, onSaved }) {
  const { t } = useT()
  const read = blueprint?.data ?? {}
  const typed = course.exam_format ?? {}
  const types = [...new Set([...(read.types ?? []), ...(typed.types ?? [])].map(norm))].filter((x) => TYPES.includes(x))
  const count = read.count ?? typed.count ?? null
  const minutes = read.minutes ?? typed.minutes ?? null
  const hasCase = read.has_case ?? typed.has_case ?? types.includes('case')
  const [edit, setEdit] = useState(false)
  const [form, setForm] = useState({ types, count: count ?? '', minutes: minutes ?? '' })
  const [busy, setBusy] = useState(false)
  const fromFiles = Boolean((read.types ?? []).length || read.count || read.minutes)

  if (!fromFiles && !types.length && !count && !minutes) return null
  if (blueprint?.confirmed_at && !edit) return null

  async function save(data) {
    setBusy(true)
    const now = new Date().toISOString()
    await supabase.from('bb_blueprints').upsert({ course_id: course.id, data: { ...read, ...data }, confirmed_at: now, updated_at: now }, { onConflict: 'course_id' })
    setBusy(false)
    setEdit(false)
    onSaved?.()
  }

  return (
    <section className="lg mt-6 p-5" data-hook="bb-blueprint">
      <h2 className="text-body font-bold text-ink">{t('bb.bp.title')}</h2>
      <p className="mt-1 text-small text-muted">{fromFiles ? t('bb.bp.lede_files') : t('bb.bp.lede_typed')}</p>
      {!edit ? (
        <>
          <ul className="mt-3 flex flex-wrap gap-2 text-small font-semibold text-ink">
            {types.map((ty) => (
              <li key={ty} className="rounded-pill bg-ink/[0.06] px-3 py-1">
                {t(`bb.new.type.${ty}`)}
              </li>
            ))}
            {count && <li className="rounded-pill bg-ink/[0.06] px-3 py-1">{t('bb.bp.count', { n: count })}</li>}
            {minutes && <li className="rounded-pill bg-ink/[0.06] px-3 py-1">{t('bb.bp.minutes', { n: minutes })}</li>}
            {hasCase && !types.includes('case') && <li className="rounded-pill bg-ink/[0.06] px-3 py-1">{t('bb.new.type.case')}</li>}
          </ul>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" className="btn-ghost press w-auto px-6" onClick={() => save({ types, count, minutes, has_case: hasCase })} disabled={busy} data-hook="bb-bp-ok">
              ✓ {t('bb.bp.ok')}
            </button>
            <button type="button" className="press text-small font-semibold text-ink underline underline-offset-4" onClick={() => setEdit(true)} data-hook="bb-bp-fix">
              {t('bb.bp.fix')}
            </button>
          </div>
        </>
      ) : (
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            save({ types: form.types, count: Number(form.count) || null, minutes: Number(form.minutes) || null, has_case: form.types.includes('case') })
          }}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {TYPES.map((ty) => (
              <Choice key={ty} on={form.types.includes(ty)} onClick={() => setForm((f) => ({ ...f, types: f.types.includes(ty) ? f.types.filter((x) => x !== ty) : [...f.types, ty] }))}>
                {t(`bb.new.type.${ty}`)}
              </Choice>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-small font-semibold text-ink">
              {t('bb.new.count')}
              <input type="number" inputMode="numeric" min={1} max={300} className="field mt-1" value={form.count} onChange={(e) => setForm((f) => ({ ...f, count: e.target.value }))} />
            </label>
            <label className="block text-small font-semibold text-ink">
              {t('bb.new.minutes')}
              <input type="number" inputMode="numeric" min={5} max={600} className="field mt-1" value={form.minutes} onChange={(e) => setForm((f) => ({ ...f, minutes: e.target.value }))} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-ghost press w-auto px-6" disabled={busy || !changed({ types, count: count ?? '', minutes: minutes ?? '' }, form)} data-hook="bb-bp-save">
              {t('bb.course.save')}
            </button>
            <button
              type="button"
              className="press px-2 text-small font-semibold text-ink underline underline-offset-4"
              onClick={() => {
                setForm({ types, count: count ?? '', minutes: minutes ?? '' })
                setEdit(false)
              }}
              data-hook="bb-bp-cancel"
            >
              {t('bb.ex.cancel')}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
