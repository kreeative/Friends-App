import { useCallback, useEffect, useMemo, useState } from 'react'
import { useT, localeTag } from '../../lib/i18n'
import { shortMap } from '../../lib/bb/cite'
import { call } from '../api'
import { loadCases } from '../data'
import { errorMessage } from '../errors'
import { Anchor, Anchors, Bar, BigButton, Note, Outside, PILL, Rich } from '../kit'
import { Spinner } from './Processing'

/**
 * The case lab, a tab of the course (section 6, phase 2).
 *
 *   A case in the professor's format; the student types an answer. Claude
 *   grades it against the rubric. Each criterion gets a score, a quote from
 *   the student's answer, and a specific improvement tied to a rubric line
 *   and a source. The model answer is shown afterwards.
 *
 * The rubric is there to read before writing, folded: knowing what earns
 * the points is part of learning to answer a case, and every line says
 * which page of the course it rests on. The model answer stays locked until
 * a first answer has been marked.
 *
 * Two AI calls per case at most per attempt: one to write it (the
 * "preparations" allowance), one per correction (the "corrections" one).
 */
const MAX_CHAPTERS = 3

export default function Cases({ course, chapters, anchors, maps }) {
  const { t, locale } = useT()
  const [state, setState] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [picked, setPicked] = useState(() => new Set())
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const [draft, setDraft] = useState('')
  const byShort = useMemo(() => shortMap(anchors), [anchors])

  const reload = useCallback(async () => {
    try {
      setState(await loadCases(course.id))
    } catch {
      setState({ cases: [], attempts: [] })
    }
  }, [course.id])

  useEffect(() => {
    reload()
  }, [reload])

  const open = state?.cases.find((c) => c.id === openId) ?? null
  const attempts = (state?.attempts ?? []).filter((a) => a.case_id === openId)
  const last = attempts.at(-1) ?? null

  async function create() {
    setBusy('case')
    setError(null)
    const r = await call('case', { course_id: course.id, chapter_ids: [...picked] })
    setBusy(null)
    if (!r.ok) return setError(errorMessage(t, locale, r.data))
    await reload()
    setOpenId(r.data.case.id)
    setDraft('')
  }

  async function grade() {
    setBusy('grade')
    setError(null)
    const r = await call('grade', { case_id: open.id, answer: draft.trim() })
    setBusy(null)
    if (!r.ok) return setError(errorMessage(t, locale, r.data))
    setState((s) => ({ ...s, attempts: [...s.attempts, r.data.attempt] }))
  }

  if (!state) {
    return (
      <div className="mt-6 flex justify-center">
        <Spinner />
      </div>
    )
  }

  const toggle = (id) =>
    setPicked((p) => {
      const next = new Set(p)
      if (next.has(id)) next.delete(id)
      else if (next.size < MAX_CHAPTERS) next.add(id)
      return next
    })
  const best = (id) => {
    const mine = state.attempts.filter((a) => a.case_id === id && a.out_of)
    if (!mine.length) return null
    return mine.reduce((b, a) => (Number(a.points) / Number(a.out_of) > Number(b.points) / Number(b.out_of) ? a : b))
  }
  const num = (v) => Number(v).toLocaleString(localeTag(locale), { maximumFractionDigits: 1 })

  if (open) {
    const marked = last?.grade ?? null
    return (
      <div className="mt-6 space-y-4" data-hook="bb-case">
        <button type="button" className={PILL} onClick={() => setOpenId(null)}>
          ← {t('bb.case.all')}
        </button>
        <article className="lg p-5 sm:p-6">
          <h2 className="text-h2 text-ink">{open.title}</h2>
          {open.outside_note && (
            <div className="mt-3">
              <Outside>{open.outside_note}</Outside>
            </div>
          )}
          <div className="mt-4 space-y-3 text-body leading-[1.65] text-ink">
            {String(open.body)
              .split(/\n{2,}/)
              .map((para, i) => (
                <p key={i} className="whitespace-pre-line">
                  {para}
                </p>
              ))}
          </div>
          {(open.exhibits ?? []).map((x, i) => (
            <figure key={i} className="mt-5">
              <figcaption className="text-small font-bold text-ink">{x.title}</figcaption>
              <div className="mt-2 overflow-x-auto rounded-inner border border-hairline">
                <table className="w-full border-collapse text-left text-small text-ink">
                  <thead className="bg-[#F4F4F5]">
                    <tr>
                      {x.columns.map((c, k) => (
                        <th key={k} scope="col" className="px-3 py-2 font-bold">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {x.rows.map((r, k) => (
                      <tr key={k} className="border-t border-hairline">
                        {r.map((cell, j) => (
                          <td key={j} className="px-3 py-2 tabular-nums">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </figure>
          ))}
          <h3 className="eyebrow mt-6">{t('bb.case.questions')}</h3>
          <ol className="mt-2 list-decimal space-y-2 pl-5 text-body text-ink">
            {(open.questions ?? []).map((q, i) => (
              <li key={i}>
                {q.prompt} <span className="whitespace-nowrap text-small font-semibold">({t('bb.case.points', { n: q.points })})</span>
              </li>
            ))}
          </ol>
          <details className="mt-5 rounded-inner bg-surface px-4 py-3" data-hook="bb-case-rubric">
            <summary className="cursor-pointer text-small font-bold text-ink">{t('bb.case.rubric')}</summary>
            <ul className="mt-3 space-y-3">
              {(open.rubric ?? []).map((r, i) => (
                <li key={i} className="text-small text-ink">
                  <p className="font-bold">
                    {r.criterion} · {t('bb.case.points', { n: r.points })}
                  </p>
                  {r.looks_for && <p className="mt-0.5">{r.looks_for}</p>}
                  <Anchors className="mt-1.5" ids={r.anchor_ids} anchors={maps.anchors} files={maps.files} />
                </li>
              ))}
            </ul>
          </details>
        </article>

        <section className="lg p-5 sm:p-6">
          <label className="block">
            <span className="text-body font-bold text-ink">{t('bb.case.your_answer')}</span>
            <span className="mt-1 block text-small text-muted">{t('bb.case.answer_hint')}</span>
            <textarea className="field mt-3 min-h-[14rem]" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={20000} disabled={busy === 'grade'} data-hook="bb-case-answer" />
          </label>
          <p className="mt-1 text-right text-[0.8125rem] tabular-nums text-muted">{t('bb.case.chars', { n: draft.trim().length })}</p>
          <BigButton className="mt-3 sm:w-auto sm:px-8" onClick={grade} disabled={busy !== null || draft.trim().length < 20} data-hook="bb-case-grade">
            {busy === 'grade' ? t('bb.case.grading') : t('bb.case.grade')}
          </BigButton>
          {busy === 'grade' && (
            <p className="mt-3 flex items-center gap-2 text-small text-ink">
              <Spinner />
              {t('bb.case.grading_hint')}
            </p>
          )}
          {error && <Note tone="error" className="mt-3">{error}</Note>}
        </section>

        {marked && (
          <section className="lg p-5 sm:p-6" data-hook="bb-case-grade-result" aria-live="polite">
            <p className="eyebrow">{t('bb.case.marked')}</p>
            <p className="mt-2 text-[2rem] font-bold leading-none tabular-nums text-ink">
              {num(marked.points)}
              <span className="text-[1.25rem] text-muted"> / {num(marked.out_of)}</span>
            </p>
            {marked.summary && <p className="mt-2 text-body text-ink">{marked.summary}</p>}
            <ul className="mt-5 space-y-5">
              {marked.criteria.map((c) => (
                <li key={c.index} className="border-t border-hairline pt-4 first:border-0 first:pt-0">
                  <Bar pct={c.out_of ? (c.points / c.out_of) * 100 : 0} label={`${c.criterion} · ${num(c.points)} / ${num(c.out_of)}`} />
                  {c.quote && <blockquote className="mt-2 rounded-inner border-l-4 border-ink bg-[#F4F4F5] px-3 py-2 text-small italic text-ink">«&#8239;{c.quote}&#8239;»</blockquote>}
                  {c.why && <p className="mt-2 text-small text-ink">{c.why}</p>}
                </li>
              ))}
            </ul>
            {marked.improvements.length > 0 && (
              <>
                <h3 className="eyebrow mt-6">{t('bb.case.improve')}</h3>
                <ol className="mt-2 space-y-3">
                  {marked.improvements.map((m, i) => {
                    const a = m.anchor_id ? maps.anchors.get(m.anchor_id) : null
                    return (
                      <li key={i} className="rounded-inner bg-[#F4F4F5] px-4 py-3 text-small text-ink">
                        {m.rubric_index != null && marked.criteria[m.rubric_index] && <p className="font-bold">{marked.criteria[m.rubric_index].criterion}</p>}
                        <p className="mt-0.5">{m.text}</p>
                        {a && (
                          <div className="mt-2">
                            <Anchor anchor={a} fileName={maps.files.get(a.material_id)} />
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ol>
              </>
            )}
            {attempts.length > 1 && <p className="mt-5 text-small text-muted">{t('bb.case.attempts', { n: attempts.length })}</p>}
          </section>
        )}

        {marked && open.model_answer && (
          <details className="lg p-5 sm:p-6" data-hook="bb-case-model">
            <summary className="cursor-pointer text-body font-bold text-ink">{t('bb.case.model')}</summary>
            <div className="mt-4 space-y-3 text-body leading-[1.65] text-ink">
              <Rich text={open.model_answer} byShort={byShort} files={maps.files} />
            </div>
          </details>
        )}
      </div>
    )
  }

  return (
    <div className="mt-6 space-y-6" data-hook="bb-cases">
      <section className="lg p-5 sm:p-6">
        <h2 className="text-h2 text-ink">{t('bb.case.title')}</h2>
        <p className="mt-2 text-body text-ink">{t('bb.case.lede')}</p>
        {chapters.length > 1 && (
          <fieldset className="mt-5">
            <legend className="text-small font-semibold text-ink">{t('bb.case.pick', { n: MAX_CHAPTERS })}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {chapters.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  aria-pressed={picked.has(ch.id)}
                  onClick={() => toggle(ch.id)}
                  className={`press max-w-full rounded-pill border-2 px-3 py-1.5 text-left text-small font-semibold text-ink ${picked.has(ch.id) ? 'border-ink bg-[#E6DFFF]' : 'border-ink/15 bg-surface'}`}
                >
                  {picked.has(ch.id) && '✓ '}
                  {ch.title}
                </button>
              ))}
            </div>
            <p className="mt-2 text-small text-muted">{picked.size ? t('bb.case.picked', { n: picked.size }) : t('bb.case.pick_none')}</p>
          </fieldset>
        )}
        <BigButton className="mt-5 sm:w-auto sm:px-8" onClick={create} disabled={busy !== null || !chapters.length} data-hook="bb-case-new">
          {busy === 'case' ? t('bb.case.writing') : t('bb.case.new')}
        </BigButton>
        {busy === 'case' && (
          <p className="mt-3 flex items-center gap-2 text-small text-ink">
            <Spinner />
            {t('bb.case.writing_hint')}
          </p>
        )}
        {error && <Note tone="error" className="mt-3">{error}</Note>}
      </section>

      {state.cases.length > 0 && (
        <section>
          <h2 className="eyebrow">{t('bb.case.yours')}</h2>
          <ul className="card-grid mt-3">
            {state.cases.map((c) => {
              const b = best(c.id)
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => setOpenId(c.id)} className="lg press flex h-full w-full flex-col p-5 text-left" data-hook="bb-case-card">
                    <span className="text-body font-bold text-ink">{c.title}</span>
                    <span className="mt-1 text-small text-muted">{new Date(c.created_at).toLocaleDateString(localeTag(locale), { day: 'numeric', month: 'long' })}</span>
                    <span className="mt-3 text-small font-semibold text-ink">{b ? t('bb.case.best', { points: num(b.points), out_of: num(b.out_of) }) : t('bb.case.not_tried')}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
