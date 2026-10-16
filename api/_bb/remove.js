import { ownCourse, start } from './common.js'

/**
 * POST /api/bb/remove { course_id } or { material_id }
 *
 * Deleting means deleting (section 10): the rows AND the stored files.
 *
 * A COURSE: every file under <user>/<course>/ in the private bucket, then the
 * course row, which takes its chapters, excerpts, concepts, questions,
 * schedule, answers, mistakes and coach messages with it (on delete cascade,
 * migration 80).
 *
 * ONE FILE: its stored copy, its row and its excerpts (cascade). What was
 * learnt from it goes too, but only what rested on it alone: a concept keeps
 * living if another file also quotes it, minus the excerpts that are gone; a
 * question loses its dead excerpts and goes only when none is left; a chapter
 * with no concept left goes. The rule is "nothing is taught from a file that
 * no longer exists", and a concept two files agree on is still taught.
 *
 * The service role is used because storage removal and the clean-up span
 * several tables, but every query is filtered on the caller's id as well: the
 * id in the body is never trusted alone.
 */
async function removeFolder(db, prefix) {
  const bucket = db.storage.from('bb-materials')
  let removed = 0
  for (let round = 0; round < 20; round += 1) {
    const { data, error } = await bucket.list(prefix, { limit: 100 })
    if (error || !data?.length) break
    const paths = data.filter((f) => f.name && f.id !== null).map((f) => `${prefix}/${f.name}`)
    if (!paths.length) break
    const { error: rmErr } = await bucket.remove(paths)
    if (rmErr) break
    removed += paths.length
  }
  return removed
}

export default async function remove(req, res) {
  const ctx = await start(req, res, { needsModel: false })
  if (!ctx) return
  const { db, user, body } = ctx

  if (body.course_id) {
    const course = await ownCourse(db, user.id, body.course_id)
    if (!course) return res.status(404).json({ error: 'not_found' })
    const files = await removeFolder(db, `${user.id}/${course.id}`)
    const { error, count } = await db.from('bb_courses').delete({ count: 'exact' }).eq('id', course.id).eq('user_id', user.id)
    if (error || count !== 1) return res.status(500).json({ error: 'delete' })
    return res.status(200).json({ removed: 'course', files })
  }

  const { data: material } = await db.from('bb_materials').select('*').eq('id', body.material_id ?? '').eq('user_id', user.id).maybeSingle()
  if (!material) return res.status(404).json({ error: 'not_found' })

  const { data: gone } = await db.from('bb_anchors').select('id').eq('material_id', material.id).eq('user_id', user.id)
  const dead = new Set((gone ?? []).map((a) => a.id))

  if (material.storage_path?.startsWith(`${user.id}/`)) await db.storage.from('bb-materials').remove([material.storage_path])
  const { error, count } = await db.from('bb_materials').delete({ count: 'exact' }).eq('id', material.id).eq('user_id', user.id)
  if (error || count !== 1) return res.status(500).json({ error: 'delete' })

  let concepts = 0
  let items = 0
  let chapters = 0
  if (dead.size) {
    const live = (ids) => (ids ?? []).filter((id) => !dead.has(id))
    const [{ data: conceptRows }, { data: itemRows }] = await Promise.all([
      db.from('bb_concepts').select('id, anchor_ids').eq('course_id', material.course_id).eq('user_id', user.id),
      db.from('bb_items').select('id, anchor_ids').eq('course_id', material.course_id).eq('user_id', user.id),
    ])
    for (const c of conceptRows ?? []) {
      if (!(c.anchor_ids ?? []).some((id) => dead.has(id))) continue
      const keep = live(c.anchor_ids)
      if (keep.length) await db.from('bb_concepts').update({ anchor_ids: keep }).eq('id', c.id).eq('user_id', user.id)
      else {
        await db.from('bb_concepts').delete().eq('id', c.id).eq('user_id', user.id)
        concepts += 1
      }
    }
    for (const it of itemRows ?? []) {
      if (!(it.anchor_ids ?? []).some((id) => dead.has(id))) continue
      const keep = live(it.anchor_ids)
      if (keep.length) await db.from('bb_items').update({ anchor_ids: keep }).eq('id', it.id).eq('user_id', user.id)
      else {
        await db.from('bb_items').delete().eq('id', it.id).eq('user_id', user.id)
        items += 1
      }
    }
  }
  const [{ data: chapterRows }, { data: left }] = await Promise.all([
    db.from('bb_chapters').select('id').eq('course_id', material.course_id).eq('user_id', user.id),
    db.from('bb_concepts').select('chapter_id').eq('course_id', material.course_id).eq('user_id', user.id),
  ])
  const used = new Set((left ?? []).map((c) => c.chapter_id))
  for (const ch of chapterRows ?? []) {
    if (used.has(ch.id)) continue
    await db.from('bb_chapters').delete().eq('id', ch.id).eq('user_id', user.id)
    chapters += 1
  }
  return res.status(200).json({ removed: 'material', concepts, items, chapters })
}
