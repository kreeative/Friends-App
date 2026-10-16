import { client, fail, gate, keyMap, logUsage, model, ownCourse, start, structured } from './common.js'
import { VISUAL_SCHEMA, visualSystem } from './prompts.js'
import { excerptText } from './pipeline.js'

/**
 * POST /api/bb/visual { chapter_id }
 *
 * Dual coding (section 3, technique 6): the chapter's process, sequence,
 * comparison, 2x2 or hierarchy, drawn as a simple visual next to the words,
 * so the student can redraw it from memory. At most three per chapter, and
 * none when the chapter has nothing of that shape.
 *
 * Every node rests on an excerpt. What the model returns is checked in code
 * (visualsFrom): a node with no excerpt that exists is dropped, a visual
 * left too small to mean anything is dropped, a tree must have one root and
 * no cycle, and a 2x2 needs its four axis labels. Made once per chapter;
 * asking again returns the stored ones.
 */
export const KINDS = ['steps', 'table', 'timeline', 'matrix', 'tree']
const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n)

function tree(nodes) {
  const roots = nodes.filter((n) => n.parent == null)
  if (roots.length !== 1) return false
  for (let i = 0; i < nodes.length; i += 1) {
    let depth = 0
    for (let at = i; nodes[at].parent != null; at = nodes[at].parent) {
      depth += 1
      const p = nodes[at].parent
      if (!Number.isInteger(p) || p < 0 || p >= nodes.length || p === at || depth > 3) return false
    }
  }
  return true
}

/** The model's visuals, checked. Returns the rows to store (without ids). */
export function visualsFrom(data, anchors) {
  const out = []
  for (const v of (Array.isArray(data?.visuals) ? data.visuals : []).slice(0, 3)) {
    const kind = String(v?.kind ?? '')
    const title = clip(v?.title, 200)
    if (!KINDS.includes(kind) || !title) continue
    const columns = (Array.isArray(v?.columns) ? v.columns : []).map((c) => clip(c, 60))
    let nodes = (Array.isArray(v?.nodes) ? v.nodes : []).map((n) => ({
      label: clip(n?.label, 120),
      detail: clip(n?.detail, 240),
      cells: (Array.isArray(n?.cells) ? n.cells : []).map((c) => clip(c, 160)),
      when: n?.when ? clip(n.when, 60) : null,
      parent: Number.isInteger(n?.parent) ? n.parent : null,
      x: n?.x === 1 ? 1 : n?.x === 0 ? 0 : null,
      y: n?.y === 1 ? 1 : n?.y === 0 ? 0 : null,
      anchor: n?.anchor && anchors.toId.has(String(n.anchor)) ? anchors.toId.get(String(n.anchor)) : null,
    }))
    if (kind === 'tree') {
      /* Dropping a node would renumber the parents: an unsupported node
         refuses the whole tree instead. */
      if (nodes.length < 3 || nodes.length > 15 || nodes.some((n) => !n.label || !n.anchor) || !tree(nodes)) continue
    } else {
      nodes = nodes.filter((n) => n.label && n.anchor)
      if (kind === 'steps' && (nodes.length < 2 || nodes.length > 10)) continue
      if (kind === 'timeline') {
        nodes = nodes.filter((n) => n.when)
        if (nodes.length < 2 || nodes.length > 10) continue
      }
      if (kind === 'table') {
        if (columns.length < 2 || columns.length > 5 || nodes.length < 2) continue
        nodes = nodes.slice(0, 10).map((n) => ({ ...n, cells: columns.slice(1).map((_, i) => n.cells[i] ?? '') }))
      }
      if (kind === 'matrix') {
        if (columns.length !== 4 || columns.some((c) => !c)) continue
        nodes = nodes.filter((n) => n.x != null && n.y != null).slice(0, 8)
        if (!nodes.length) continue
      }
    }
    const keep = (n) => {
      const base = { label: n.label, detail: n.detail, anchor: n.anchor }
      if (kind === 'table') return { ...base, cells: n.cells }
      if (kind === 'timeline') return { ...base, when: n.when }
      if (kind === 'tree') return { ...base, parent: n.parent }
      if (kind === 'matrix') return { ...base, x: n.x, y: n.y }
      return base
    }
    out.push({
      kind,
      title,
      data: { columns: kind === 'table' || kind === 'matrix' ? columns : [], nodes: nodes.map(keep) },
      anchor_ids: [...new Set(nodes.map((n) => n.anchor))],
    })
  }
  return out
}

export default async function visual(req, res) {
  const ctx = await start(req, res)
  if (!ctx) return
  const { db, user, body } = ctx
  const { data: chapter } = await db.from('bb_chapters').select('*').eq('id', body.chapter_id ?? '').eq('user_id', user.id).maybeSingle()
  if (!chapter) return res.status(404).json({ error: 'not_found' })
  const course = await ownCourse(db, user.id, chapter.course_id)
  if (!course) return res.status(404).json({ error: 'not_found' })
  const { data: stored } = await db.from('bb_visuals').select('*').eq('chapter_id', chapter.id).eq('user_id', user.id).order('created_at')
  if (stored?.length || chapter.visuals_none) return res.status(200).json({ visuals: stored ?? [] })
  if (!(await gate(ctx, res, 'visual'))) return

  const { data: concepts } = await db.from('bb_concepts').select('id, name, definition, anchor_ids, weight, position').eq('chapter_id', chapter.id).eq('user_id', user.id).order('position')
  const anchorIds = [...new Set((concepts ?? []).flatMap((c) => c.anchor_ids ?? []))].slice(0, 45)
  const { data: anchorRows } = anchorIds.length ? await db.from('bb_anchors').select('id, label, excerpt').in('id', anchorIds).eq('user_id', user.id) : { data: [] }
  if (!anchorRows?.length) return res.status(422).json({ error: 'no_anchor' })
  const anchors = keyMap(anchorRows, 'A')
  const brief = [
    `CHAPTER: ${chapter.title}${chapter.summary ? ` - ${chapter.summary}` : ''}`,
    '',
    'CONCEPTS:',
    ...(concepts ?? []).map((c) => `- ${c.name}${c.definition ? `: "${c.definition}"` : ''} (anchors ${(c.anchor_ids ?? []).map((a) => anchors.toKey.get(a)).filter(Boolean).join(', ')})`),
    '',
    'EXCERPTS:',
    excerptText(anchorRows, anchors),
  ].join('\n')
  let out
  try {
    out = await structured(client(), { system: visualSystem({ course, language: course.language ?? 'fr' }), content: [{ type: 'text', text: brief }], schema: VISUAL_SCHEMA, effort: 'low', maxTokens: 10000, model: model() })
  } catch (err) {
    return fail(res, err, 'visual')
  }
  if (out.usage) await logUsage(db, user.id, 'visual', out.model, out.usage)
  if (out.error) return res.status(502).json({ error: out.error })
  const rows = visualsFrom(out.data, anchors).map((v) => ({ ...v, user_id: user.id, course_id: course.id, chapter_id: chapter.id }))
  if (!rows.length) {
    /* Nothing of that shape in the chapter: remembered, so the page says so
       instead of paying for the same answer again. */
    await db.from('bb_chapters').update({ visuals_none: true }).eq('id', chapter.id).eq('user_id', user.id)
    return res.status(200).json({ visuals: [], none: true })
  }
  const { data: saved, error } = await db.from('bb_visuals').insert(rows).select('*')
  if (error) return res.status(500).json({ error: 'write' })
  return res.status(200).json({ visuals: saved ?? [] })
}
