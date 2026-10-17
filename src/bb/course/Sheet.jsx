import { useState } from 'react'
import { useT } from '../../lib/i18n'
import { Anchors, PILL } from '../kit'

/**
 * The cheat sheet of each chapter (section 6), in COVER MODE by default:
 * retrieval first (section 3.1). Every definition is hidden behind its name
 * until the student has tried to remember it; reading mode exists, a tap
 * away, and is never the default.
 *
 * Order: what the professor flagged for the exam first, then by weight, so
 * the top of the sheet is what is most likely to be asked. Under the
 * definitions, the quotes ("Ta prof l'a dit") and the traps: the twin
 * concepts of this chapter with the sentence that separates them.
 *
 * Every line carries its anchor. Print gives a clean page (print: classes).
 */
export default function Sheet({ chapters, concepts, signals, twins, maps }) {
  const { t } = useT()
  const [cover, setCover] = useState(true)
  const [shown, setShown] = useState(() => new Set())
  const name = new Map(concepts.map((c) => [c.id, c.name]))
  if (!concepts.length) return <p className="mt-6 text-body text-muted">{t('bb.sheet.empty')}</p>

  const toggle = (id) =>
    setShown((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  return (
    <div className="mt-6" data-hook="bb-sheet">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <div className="flex gap-1 rounded-pill bg-ink/[0.06] p-1" role="group">
          {[true, false].map((on) => (
            <button
              key={String(on)}
              type="button"
              aria-pressed={cover === on}
              onClick={() => setCover(on)}
              className={`press rounded-pill px-4 py-1.5 text-small font-semibold ${cover === on ? 'bg-[#CFC2FF] text-ink' : 'text-muted'}`}
            >
              {on ? t('bb.sheet.cover') : t('bb.sheet.read')}
            </button>
          ))}
        </div>
        <button type="button" className={PILL} onClick={() => window.print()}>
          {t('bb.sheet.print')}
        </button>
      </div>
      {cover && <p className="mt-3 text-small text-muted print:hidden">{t('bb.sheet.cover_hint')}</p>}

      {chapters.map((ch) => {
        const list = concepts.filter((c) => c.chapter_id === ch.id).sort((a, b) => b.weight - a.weight || a.position - b.position)
        if (!list.length) return null
        const ids = new Set(list.map((c) => c.id))
        const quotes = signals.filter((s) => s.concept_id && ids.has(s.concept_id)).sort((a, b) => b.strength - a.strength)
        const traps = twins.filter((tw) => ids.has(tw.a_concept) || ids.has(tw.b_concept))
        return (
          <section key={ch.id} className="lg mt-6 p-5 print:break-inside-avoid print:border-0 print:shadow-none" data-hook="bb-sheet-chapter">
            <h2 className="text-h2 text-ink">{ch.title}</h2>
            <dl className="mt-4 space-y-4">
              {list.map((c) => {
                const open = !cover || shown.has(c.id)
                return (
                  <div key={c.id} className="border-t border-hairline pt-3 first:border-0 first:pt-0">
                    <dt className="flex flex-wrap items-baseline gap-2 text-body font-bold text-ink">
                      {c.weight >= 3 && <span className="marker">{c.name}</span>}
                      {c.weight < 3 && c.name}
                    </dt>
                    <dd className="mt-1">
                      {open ? (
                        <>
                          <p className="text-body text-ink">{c.definition ? `« ${c.definition} »` : <span className="text-muted">{t('bb.sheet.no_def')}</span>}</p>
                          <Anchors ids={c.definition_anchor ? [c.definition_anchor] : (c.anchor_ids ?? []).slice(0, 1)} anchors={maps.anchors} files={maps.files} className="mt-2" />
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggle(c.id)}
                          className="press mt-1 w-full rounded-inner border-2 border-dashed border-ink/20 bg-surface px-3 py-3 text-left text-small font-semibold text-muted"
                          aria-label={t('bb.sheet.reveal', { name: c.name })}
                        >
                          ••••••••••••
                        </button>
                      )}
                    </dd>
                  </div>
                )
              })}
            </dl>
            {quotes.length > 0 && (
              <div className="mt-5">
                <h3 className="eyebrow">{t('bb.sheet.signals')}</h3>
                <ul className="mt-2 space-y-2">
                  {quotes.map((s) => (
                    <li key={s.id} className="text-small text-ink">
                      «&#8239;{s.quote}&#8239;» {s.concept_id && <span className="text-muted">({name.get(s.concept_id)})</span>}
                      <Anchors ids={s.anchor_id ? [s.anchor_id] : []} anchors={maps.anchors} files={maps.files} className="mt-1" />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {traps.length > 0 && (
              <div className="mt-5">
                <h3 className="eyebrow">{t('bb.sheet.traps')}</h3>
                <ul className="mt-2 space-y-2">
                  {traps.map((tw) => (
                    <li key={tw.id} className="text-small text-ink">
                      <strong>{name.get(tw.a_concept)}</strong> {t('bb.twins.vs')} <strong>{name.get(tw.b_concept)}</strong>: {tw.separator}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
