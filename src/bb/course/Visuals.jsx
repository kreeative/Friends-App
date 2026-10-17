import { useCallback, useEffect, useState } from 'react'
import { useT } from '../../lib/i18n'
import { call } from '../api'
import { loadVisuals } from '../data'
import { errorMessage } from '../errors'
import { Anchor, Note } from '../kit'
import { Spinner } from './Processing'

/**
 * The chapter's visuals, a tab of the course (section 3, technique 6, dual
 * coding).
 *
 *   Processes, sequences, comparisons and hierarchies become simple
 *   visuals: steps, a 2x2 matrix, a tree, a timeline, a comparison table.
 *   Generated as structured data and drawn with app components, in Rich &
 *   Friends style. Every node cites its anchor.
 *
 * Drawn here with plain HTML (lists, a table, a grid), so they read on a
 * phone, wrap instead of overflowing, are spoken in order by a screen
 * reader and print. Pastels and ink, the turquoise for structure: no colour
 * carries meaning a word does not also carry.
 *
 * One call per chapter, when the student asks for it; a chapter with
 * nothing of that shape says so once and is not asked again (api/_bb/visual.js).
 */
export default function Visuals({ chapters, maps }) {
  const { t, locale } = useT()
  const [visuals, setVisuals] = useState(null)
  const [busy, setBusy] = useState(null)
  const [errors, setErrors] = useState({})
  const [none, setNone] = useState(() => new Set(chapters.filter((c) => c.visuals_none).map((c) => c.id)))
  const courseId = chapters[0]?.course_id

  const reload = useCallback(async () => {
    if (!courseId) return setVisuals([])
    try {
      setVisuals(await loadVisuals(courseId))
    } catch {
      setVisuals([])
    }
  }, [courseId])

  useEffect(() => {
    reload()
  }, [reload])

  async function draw(chapter) {
    setBusy(chapter.id)
    setErrors((e) => ({ ...e, [chapter.id]: null }))
    const r = await call('visual', { chapter_id: chapter.id })
    setBusy(null)
    if (!r.ok) return setErrors((e) => ({ ...e, [chapter.id]: errorMessage(t, locale, r.data) }))
    if (r.data.none) setNone((s) => new Set([...s, chapter.id]))
    await reload()
  }

  if (!visuals) {
    return (
      <div className="mt-6 flex justify-center">
        <Spinner />
      </div>
    )
  }
  if (!chapters.length) return <p className="mt-6 text-body text-muted">{t('bb.course.no_chapters')}</p>

  const chip = (id, compact = false) => {
    const a = id ? maps.anchors.get(id) : null
    return a ? <Anchor anchor={a} fileName={maps.files.get(a.material_id)} compact={compact} /> : null
  }

  return (
    <div className="mt-6 space-y-6" data-hook="bb-visuals">
      <p className="text-body text-ink">{t('bb.vis.lede')}</p>
      {chapters.map((ch) => {
        const mine = visuals.filter((v) => v.chapter_id === ch.id)
        return (
          <section key={ch.id} className="lg p-5 sm:p-6" data-hook="bb-visual-chapter">
            <h2 className="text-body font-bold text-ink">{ch.title}</h2>
            {mine.length > 0 ? (
              <div className="mt-4 space-y-8">
                {mine.map((v) => (
                  <figure key={v.id} data-hook="bb-visual" data-kind={v.kind}>
                    <figcaption className="text-small font-bold uppercase tracking-[0.02em] text-ink">
                      {t(`bb.vis.kind.${v.kind}`)} · <span className="normal-case tracking-normal">{v.title}</span>
                    </figcaption>
                    <div className="mt-3">
                      <Drawing visual={v} chip={chip} t={t} />
                    </div>
                  </figure>
                ))}
                <p className="text-small text-muted">{t('bb.vis.redraw')}</p>
              </div>
            ) : none.has(ch.id) ? (
              <p className="mt-2 text-small text-ink">{t('bb.vis.none')}</p>
            ) : (
              <div className="mt-3">
                <button type="button" className="btn-ghost press w-auto px-5" onClick={() => draw(ch)} disabled={busy !== null} data-hook="bb-visual-draw">
                  {busy === ch.id ? t('bb.vis.drawing') : t('bb.vis.draw')}
                </button>
                {busy === ch.id && (
                  <p className="mt-2 flex items-center gap-2 text-small text-ink">
                    <Spinner />
                    {t('bb.vis.drawing_hint')}
                  </p>
                )}
              </div>
            )}
            {errors[ch.id] && <Note tone="error" className="mt-3">{errors[ch.id]}</Note>}
          </section>
        )
      })}
    </div>
  )
}

function Drawing({ visual, chip, t }) {
  const { kind, data } = visual
  const nodes = data?.nodes ?? []
  const columns = data?.columns ?? []

  if (kind === 'steps') {
    return (
      <ol className="space-y-3" data-hook="bb-steps">
        {nodes.map((n, i) => (
          <li key={i} className="flex gap-3">
            <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill border-2 border-[#009DB9] bg-[#E6F6F9] text-small font-bold tabular-nums text-ink">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <p className="text-body font-semibold text-ink">{n.label}</p>
              {n.detail && <p className="mt-0.5 text-small text-ink">{n.detail}</p>}
              <div className="mt-1.5">{chip(n.anchor)}</div>
            </div>
          </li>
        ))}
      </ol>
    )
  }

  if (kind === 'timeline') {
    return (
      <ol className="relative ml-2 space-y-4 border-l-2 border-[#009DB9] pl-5" data-hook="bb-timeline">
        {nodes.map((n, i) => (
          <li key={i} className="relative">
            <span aria-hidden="true" className="absolute -left-[1.6rem] top-1.5 h-3 w-3 rounded-pill border-2 border-[#009DB9] bg-surface" />
            <p className="text-small font-bold tabular-nums text-ink">{n.when}</p>
            <p className="text-body font-semibold text-ink">{n.label}</p>
            {n.detail && <p className="mt-0.5 text-small text-ink">{n.detail}</p>}
            <div className="mt-1.5">{chip(n.anchor)}</div>
          </li>
        ))}
      </ol>
    )
  }

  if (kind === 'table') {
    /* A phone gets one card per row (a table of three columns would have to
       scroll sideways inside its box); from sm, the real table. */
    return (
      <div data-hook="bb-table">
        <ul className="space-y-2 sm:hidden">
          {nodes.map((n, i) => (
            <li key={i} className="rounded-inner bg-surface p-3">
              <p className="text-small font-bold text-ink">{n.label}</p>
              <dl className="mt-1.5 space-y-1">
                {(n.cells ?? []).map((c, j) => (
                  <div key={j} className="flex gap-2 text-small text-ink">
                    <dt className="shrink-0 font-semibold">{columns[j + 1]}</dt>
                    <dd className="min-w-0">{c}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-1.5">{chip(n.anchor)}</div>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto rounded-inner border border-hairline sm:block">
          <table className="w-full border-collapse text-left text-small text-ink">
            <thead className="bg-[#E6F6F9]">
              <tr>
                {columns.map((c, i) => (
                  <th key={i} scope="col" className="px-3 py-2 font-bold">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {nodes.map((n, i) => (
                <tr key={i} className="border-t border-hairline align-top">
                  <th scope="row" className="px-3 py-2 font-semibold">
                    {n.label}
                    <div className="mt-1.5 font-normal">{chip(n.anchor)}</div>
                  </th>
                  {(n.cells ?? []).map((c, j) => (
                    <td key={j} className="px-3 py-2">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (kind === 'matrix') {
    const [xLow, xHigh, yLow, yHigh] = columns
    const cell = (x, y) => nodes.filter((n) => n.x === x && n.y === y)
    const quad = (x, y) => (
      <div className="min-h-[6.5rem] rounded-inner bg-surface p-3" aria-label={`${y ? yHigh : yLow} · ${x ? xHigh : xLow}`} role="group">
        <p className="text-[0.75rem] font-semibold text-muted">
          {y ? yHigh : yLow} · {x ? xHigh : xLow}
        </p>
        <ul className="mt-1.5 space-y-2">
          {cell(x, y).map((n, i) => (
            <li key={i}>
              <p className="text-small font-semibold text-ink">{n.label}</p>
              {n.detail && <p className="text-[0.8125rem] text-ink">{n.detail}</p>}
              <div className="mt-1">{chip(n.anchor, true)}</div>
            </li>
          ))}
        </ul>
      </div>
    )
    return (
      <div data-hook="bb-matrix">
        <div className="grid grid-cols-2 gap-2 rounded-card bg-[#E6F6F9] p-2">
          {quad(0, 1)}
          {quad(1, 1)}
          {quad(0, 0)}
          {quad(1, 0)}
        </div>
        <p className="mt-2 text-[0.8125rem] text-ink">
          ↔ {xLow} / {xHigh} · ↕ {yLow} / {yHigh}
        </p>
      </div>
    )
  }

  if (kind === 'tree') {
    const kids = (i) => nodes.map((n, k) => [n, k]).filter(([n]) => n.parent === i)
    const root = nodes.findIndex((n) => n.parent == null)
    const branch = (i, depth) => (
      <li key={i} className={depth ? 'border-l-2 border-[#009DB9]/60 pl-4' : ''}>
        <div className={`rounded-inner px-3 py-2 ${depth === 0 ? 'bg-[#FFE3F0]' : 'bg-surface'}`}>
          <p className="text-small font-bold text-ink">{nodes[i].label}</p>
          {nodes[i].detail && <p className="text-[0.8125rem] text-ink">{nodes[i].detail}</p>}
          <div className="mt-1">{chip(nodes[i].anchor, depth > 0)}</div>
        </div>
        {kids(i).length > 0 && <ul className="mt-2 space-y-2 pl-3">{kids(i).map(([, k]) => branch(k, depth + 1))}</ul>}
      </li>
    )
    return root < 0 ? null : (
      <ul className="space-y-2" data-hook="bb-tree" aria-label={t('bb.vis.kind.tree')}>
        {branch(root, 0)}
      </ul>
    )
  }
  return null
}
