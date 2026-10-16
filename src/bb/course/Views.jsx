import { useMemo, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useT } from '../../lib/i18n'
import { ACCEPT, kindFor, refuse } from '../../lib/bb/formats'
import { call } from '../api'
import { uploadMaterial } from '../data'
import { errorMessage, materialError } from '../errors'
import { Anchors, Note, Outside } from '../kit'
import { Spinner } from './Processing'

/* --- the twin table (section 6) -------------------------------------------- */

export function Twins({ twins, concepts, maps }) {
  const { t } = useT()
  const byId = new Map(concepts.map((c) => [c.id, c]))
  if (!twins.length) return <p className="mt-6 text-body text-muted">{t('bb.twins.empty')}</p>
  return (
    <div className="mt-6" data-hook="bb-twins">
      <p className="lede">{t('bb.twins.lede')}</p>
      <ul className="mt-4 space-y-3">
        {twins.map((tw) => {
          const a = byId.get(tw.a_concept)
          const b = byId.get(tw.b_concept)
          return (
            <li key={tw.id} className="lg p-5">
              <p className="text-body font-bold text-ink">
                {a?.name ?? '?'} <span className="font-normal text-muted">{t('bb.twins.vs')}</span> {b?.name ?? '?'}
              </p>
              <p className="mt-2 text-body text-ink">{tw.separator}</p>
              <Anchors ids={tw.anchor_ids} anchors={maps.anchors} files={maps.files} className="mt-3" />
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* --- the question bank (section 6) ------------------------------------------- */

function ItemCard({ item, maps, flagged }) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const key = item.answer?.index
  return (
    <li className="lg p-5" data-hook="bb-bank-item">
      <div className="flex flex-wrap items-center gap-2 text-[0.8125rem] font-semibold text-ink">
        <span className="rounded-pill bg-ink/[0.06] px-2.5 py-0.5">{t(`bb.type.${item.type}`)}</span>
        <span className="rounded-pill bg-ink/[0.06] px-2.5 py-0.5">{t('bb.bank.bloom', { n: item.bloom })}</span>
        <span className="rounded-pill bg-[#E6F6F9] px-2.5 py-0.5">
          {item.source === 'concept' ? t('bb.bank.from_prof') : item.quality === 'revised' ? t('bb.bank.revised') : t('bb.bank.verified')}
        </span>
        {flagged && <span className="rounded-pill bg-[#FFE3F0] px-2.5 py-0.5">⚑ {t('bb.bank.sure_wrong')}</span>}
      </div>
      <p className="mt-3 whitespace-pre-line text-body text-ink">{item.stem}</p>
      <button type="button" className="press mt-3 text-small font-semibold text-ink underline underline-offset-4" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? t('bb.bank.hide') : t('bb.bank.show')}
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {item.type === 'flash' || item.type === 'cloze' ? (
            <p className="text-body text-ink">«&#8239;{item.answer?.text}&#8239;»</p>
          ) : (
            <ol className="space-y-2">
              {(item.options ?? []).map((o, i) => (
                <li key={i} className={`rounded-inner border px-3 py-2 ${i === key ? 'border-[#009DB9] bg-[#E6F6F9]' : 'border-ink/10 bg-surface'}`}>
                  <p className="text-small font-semibold text-ink">
                    {String.fromCharCode(65 + i)}. {o.text} {i === key && <span>✓ {t('bb.ses.right')}</span>}
                  </p>
                  {o.why && <p className="mt-1 text-small text-ink">{o.why}</p>}
                  {o.outside && <div className="mt-2"><Outside /></div>}
                  {o.anchor && <Anchors ids={[o.anchor]} anchors={maps.anchors} files={maps.files} className="mt-2" />}
                </li>
              ))}
            </ol>
          )}
          {item.explanation && <p className="text-small text-ink">{item.explanation}</p>}
          {item.revision_note && item.quality === 'revised' && <p className="text-small text-muted">{t('bb.bank.revised')}: {item.revision_note}</p>}
          <Anchors ids={item.anchor_ids} anchors={maps.anchors} files={maps.files} />
        </div>
      )}
    </li>
  )
}

export function Bank({ items, chapters, concepts, signals, mistakes, maps }) {
  const { t } = useT()
  const [chapter, setChapter] = useState('')
  const [type, setType] = useState('')
  const [filter, setFilter] = useState('')
  const flagged = useMemo(() => new Set(mistakes.filter((m) => m.confident && !m.resolved_at).map((m) => m.item_id)), [mistakes])
  const weak = useMemo(() => new Set(mistakes.filter((m) => !m.resolved_at).map((m) => m.item_id)), [mistakes])
  const signalled = useMemo(() => {
    const strong = new Set(signals.map((s) => s.concept_id).filter(Boolean))
    for (const c of concepts) if (c.weight >= 3) strong.add(c.id)
    return strong
  }, [signals, concepts])

  const list = items.filter(
    (i) =>
      (!chapter || i.chapter_id === chapter) &&
      (!type || i.type === type) &&
      (filter !== 'weak' || weak.has(i.id)) &&
      (filter !== 'signal' || signalled.has(i.concept_id)) &&
      (filter !== 'sure_wrong' || flagged.has(i.id)),
  )
  const types = [...new Set(items.map((i) => i.type))]

  return (
    <div className="mt-6" data-hook="bb-bank">
      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-2 text-small font-semibold text-ink">
          {t('bb.bank.chapter')}
          <select className="rounded-inner border border-ink/15 bg-surface px-2 py-1.5 text-small text-ink" value={chapter} onChange={(e) => setChapter(e.target.value)}>
            <option value="">{t('bb.bank.all')}</option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-small font-semibold text-ink">
          {t('bb.bank.type')}
          <select className="rounded-inner border border-ink/15 bg-surface px-2 py-1.5 text-small text-ink" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">{t('bb.bank.all')}</option>
            {types.map((ty) => (
              <option key={ty} value={ty}>
                {t(`bb.type.${ty}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2" role="group">
        {['', 'weak', 'signal', 'sure_wrong'].map((f) => (
          <button
            key={f || 'all'}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`press rounded-pill border px-3 py-1.5 text-small font-semibold text-ink ${filter === f ? 'border-[#009DB9] bg-[#DDF3F7]' : 'border-ink/15 bg-surface'}`}
          >
            {filter === f && '✓ '}
            {f === '' ? t('bb.bank.all') : f === 'weak' ? t('bb.bank.weak') : f === 'signal' ? t('bb.bank.signal') : t('bb.bank.sure_wrong')}
          </button>
        ))}
      </div>
      <p className="mt-4 text-small text-muted">{t('bb.bank.count', { n: list.length })}</p>
      {!list.length ? (
        <p className="mt-4 text-body text-muted">{t('bb.bank.empty')}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {list.slice(0, 200).map((i) => (
            <ItemCard key={i.id} item={i} maps={maps} flagged={flagged.has(i.id)} />
          ))}
        </ul>
      )}
    </div>
  )
}

/* --- the mistake log (section 6) --------------------------------------------- */

export function Mistakes({ mistakes, items, maps }) {
  const { t } = useT()
  const byId = new Map(items.map((i) => [i.id, i]))
  const list = [...mistakes].sort((a, b) => Boolean(a.resolved_at) - Boolean(b.resolved_at) || Number(b.confident) - Number(a.confident) || Date.parse(b.created_at) - Date.parse(a.created_at))
  return (
    <div className="mt-6" data-hook="bb-mistakes">
      <p className="lede">{t('bb.mist.lede')}</p>
      {!list.length ? (
        <p className="mt-6 text-body text-muted">{t('bb.mist.empty')}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {list.map((m) => {
            const item = byId.get(m.item_id)
            if (!item) return null
            return (
              <li key={m.id} className={`lg p-5 ${m.resolved_at ? 'opacity-70' : ''}`}>
                <div className="flex flex-wrap items-center gap-2 text-[0.8125rem] font-semibold text-ink">
                  {m.resolved_at ? (
                    <span className="rounded-pill bg-[#E8F5EC] px-2.5 py-0.5">✓ {t('bb.mist.resolved')}</span>
                  ) : m.confident ? (
                    <span className="rounded-pill bg-[#FFE3F0] px-2.5 py-0.5">⚑ {t('bb.mist.confident')}</span>
                  ) : (
                    <span className="rounded-pill bg-ink/[0.06] px-2.5 py-0.5">? {t('bb.mist.unsure')}</span>
                  )}
                  {!m.resolved_at && <span className="rounded-pill bg-ink/[0.06] px-2.5 py-0.5">{t('bb.mist.streak', { n: m.right_streak ?? 0 })}</span>}
                </div>
                <p className="mt-3 text-body text-ink">{item.stem}</p>
                {m.misconception && (
                  <p className="mt-2 text-small text-ink">
                    <strong>{t('bb.mist.why')}: </strong>
                    {m.misconception}
                  </p>
                )}
                <Anchors ids={item.anchor_ids} anchors={maps.anchors} files={maps.files} className="mt-3" />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/* --- the files, and deleting ------------------------------------------------- */

export function Files({ course, materials, proc, onChange, onDeleted }) {
  const { t, locale } = useT()
  const { user } = useAuth()
  const picker = useRef(null)
  const [busy, setBusy] = useState(null)
  const [note, setNote] = useState(null)

  async function add(list) {
    const msgs = []
    setBusy('add')
    for (const file of list) {
      const why = refuse(file)
      if (why) {
        msgs.push(t(`bb.new.${why}`, { name: file.name }))
        continue
      }
      try {
        await uploadMaterial({ userId: user.id, courseId: course.id, file, kind: kindFor(file.name, file.type) })
      } catch {
        msgs.push(`${file.name}: ${t('bb.proc.err.other')}`)
      }
    }
    setBusy(null)
    setNote(msgs.length ? msgs.join(' ') : null)
    await onChange()
  }

  async function removeOne(m) {
    if (!window.confirm(t('bb.files.delete_confirm', { name: m.file_name }))) return
    setBusy(m.id)
    const r = await call('remove', { material_id: m.id })
    setBusy(null)
    if (!r.ok) setNote(errorMessage(t, locale, r.data))
    await onChange()
  }

  async function removeCourse() {
    if (!window.confirm(t('bb.course.delete_confirm', { name: course.name }))) return
    setBusy('course')
    const r = await call('remove', { course_id: course.id })
    if (!r.ok) {
      setBusy(null)
      setNote(errorMessage(t, locale, r.data))
      return
    }
    onDeleted()
  }

  return (
    <div className="mt-6" data-hook="bb-files">
      <input ref={picker} type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => add([...(e.target.files ?? [])])} />
      <button type="button" className="btn-ghost press w-auto px-6" onClick={() => picker.current?.click()} disabled={busy !== null}>
        {busy === 'add' ? <Spinner /> : '+'} {t('bb.files.add')}
      </button>
      <p className="mt-2 text-small text-muted">{t('bb.new.limits')}</p>
      {note && <Note tone="error" className="mt-3">{note}</Note>}
      {!materials.length ? (
        <p className="mt-6 text-body text-muted">{t('bb.files.empty')}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {materials.map((m) => (
            <li key={m.id} className="lg flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-small font-semibold text-ink">{m.file_name}</p>
                <p className="text-small text-muted">
                  {t(`bb.new.kind.${m.kind}`)}
                  {m.pages ? ` · ${t('bb.files.pages', { n: m.pages })}` : ''}
                  {' · '}
                  {m.status === 'failed' ? `${t('bb.proc.failed')}: ${materialError(t, m.error)}` : m.status === 'ready' ? t('bb.proc.ready') : m.status === 'reading' || proc.current === m.id ? t('bb.proc.reading') : t('bb.proc.uploaded')}
                </p>
              </div>
              <button type="button" className="press rounded-pill px-3 py-1.5 text-small font-semibold text-ink underline underline-offset-4" onClick={() => removeOne(m)} disabled={busy !== null} aria-label={t('bb.files.delete', { name: m.file_name })}>
                {busy === m.id ? <Spinner /> : '×'}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-10 border-t border-hairline pt-6">
        <button type="button" className="press text-small font-semibold text-negative underline underline-offset-4" onClick={removeCourse} disabled={busy !== null} data-hook="bb-delete-course">
          {busy === 'course' ? t('bb.course.deleting') : t('bb.course.delete')}
        </button>
      </div>
    </div>
  )
}
