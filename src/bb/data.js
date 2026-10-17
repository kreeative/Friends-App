import { supabase } from '../lib/supabase'

/**
 * The student's own Beauty & Brain rows, read and written as the student.
 *
 * Row level security (migration 80) is what keeps them private: every table
 * answers only the caller's rows, so nothing here filters on user_id for
 * safety, only for the conflict keys of an upsert. The model calls and the
 * plan go through /api/bb/* (src/bb/api.js); everything a student does to
 * her own data without Claude happens here, directly.
 */
const ITEM_COLUMNS = 'id, course_id, chapter_id, concept_id, type, bloom, stem, options, answer, explanation, anchor_ids, outside, quality, revision_note, source, variant_of, created_at'

const must = ({ data, error }) => {
  if (error) throw error
  return data
}

export async function loadProfile(userId) {
  const { data, error } = await supabase.from('bb_profiles').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data ?? null
}

export async function saveProfile(userId, patch) {
  return must(
    await supabase
      .from('bb_profiles')
      .upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      .select('*')
      .single(),
  )
}

/*
 * Migration 82 adds bb_courses.exams (the midterm and the final). Until it
 * has run, a read that names the column fails (42703) and a write that
 * carries it is refused (PGRST204): the app then reads and writes without
 * it, the one exam_at as before, instead of losing the course list.
 */
const noExams = (error) => Boolean(error) && (error.code === '42703' || error.code === 'PGRST204') && /exams/.test(error.message ?? '')
const COURSE_COLUMNS = 'id, name, code, professor, language, exam_at, exam_format, stats, created_at'

export async function loadCourses() {
  const first = await supabase.from('bb_courses').select(`${COURSE_COLUMNS}, exams`).order('created_at')
  if (noExams(first.error)) return must(await supabase.from('bb_courses').select(COURSE_COLUMNS).order('created_at')) ?? []
  return must(first) ?? []
}

/** Everything a course page shows, in one round of parallel reads. */
export async function loadCourse(id) {
  const [course, chapters, concepts, materials, twins, signals, blueprint, anchors] = await Promise.all([
    supabase.from('bb_courses').select('*').eq('id', id).maybeSingle(),
    supabase.from('bb_chapters').select('*').eq('course_id', id).order('position'),
    supabase.from('bb_concepts').select('*').eq('course_id', id).order('position'),
    supabase.from('bb_materials').select('id, course_id, kind, file_name, mime, size_bytes, storage_path, status, error, pages, created_at, reading_at, processed_at').eq('course_id', id).order('created_at'),
    supabase.from('bb_twins').select('*').eq('course_id', id),
    supabase.from('bb_signals').select('*').eq('course_id', id),
    supabase.from('bb_blueprints').select('*').eq('course_id', id).maybeSingle(),
    /* In the server's order (api/_bb/coach.js), so a short id resolves to the same excerpt on both sides. */
    supabase.from('bb_anchors').select('id, material_id, label, excerpt, created_at').eq('course_id', id).order('created_at').order('id'),
  ])
  const first = [course, chapters, concepts, materials, twins, signals, blueprint, anchors].find((r) => r.error)
  if (first) throw first.error
  return {
    course: course.data ?? null,
    chapters: chapters.data ?? [],
    concepts: concepts.data ?? [],
    materials: materials.data ?? [],
    twins: twins.data ?? [],
    signals: signals.data ?? [],
    blueprint: blueprint.data ?? null,
    anchors: anchors.data ?? [],
  }
}

/** What practice needs: the questions, their schedule, the mistakes, the answers. */
export async function loadStudy(courseId, { days = 120 } = {}) {
  const since = new Date(Date.now() - days * 86400000).toISOString()
  const [items, schedule, mistakes, reviews] = await Promise.all([
    supabase.from('bb_items').select(ITEM_COLUMNS).eq('course_id', courseId).in('quality', ['pass', 'revised']),
    supabase.from('bb_schedule').select('*').eq('course_id', courseId),
    supabase.from('bb_mistakes').select('*').eq('course_id', courseId),
    supabase.from('bb_reviews').select('item_id, concept_id, rating, confidence, correct, bloom, mode, created_at').eq('course_id', courseId).gte('created_at', since).order('created_at'),
  ])
  const first = [items, schedule, mistakes, reviews].find((r) => r.error)
  if (first) throw first.error
  return { items: items.data ?? [], schedule: schedule.data ?? [], mistakes: mistakes.data ?? [], reviews: reviews.data ?? [] }
}

/** Due counts for every course at once, for the home screen. */
export async function loadDue(now = new Date()) {
  const [due, items, sessions] = await Promise.all([
    supabase.from('bb_schedule').select('course_id, due').lte('due', now.toISOString()),
    supabase.from('bb_items').select('course_id').in('quality', ['pass', 'revised']),
    supabase.from('bb_sessions').select('course_id, started_at, ended_at, answered').gte('started_at', new Date(now.getTime() - 60 * 86400000).toISOString()).order('started_at'),
  ])
  const count = (rows) => {
    const m = new Map()
    for (const r of rows ?? []) m.set(r.course_id, (m.get(r.course_id) ?? 0) + 1)
    return m
  }
  return { due: count(due.data), items: count(items.data), sessions: sessions.data ?? [] }
}

export async function createCourse(fields) {
  const first = await supabase.from('bb_courses').insert(fields).select('*').single()
  if (!noExams(first.error)) return must(first)
  const { exams: _, ...rest } = fields
  return must(await supabase.from('bb_courses').insert(rest).select('*').single())
}

export async function updateCourse(id, patch) {
  const first = await supabase.from('bb_courses').update(patch).eq('id', id).select('*').single()
  if (!noExams(first.error)) return must(first)
  const { exams: _, ...rest } = patch
  return must(await supabase.from('bb_courses').update(rest).eq('id', id).select('*').single())
}

const safeName = (name) =>
  String(name ?? 'fichier')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(-80) || 'fichier'

/**
 * One file: to the private bucket under <user>/<course>/, then its row.
 * The row is what the reader (/api/bb/ingest) is given; the bytes stay in
 * the bucket, readable by their owner only.
 */
export async function uploadMaterial({ userId, courseId, file, kind }) {
  const id = crypto.randomUUID()
  const path = `${userId}/${courseId}/${id}-${safeName(file.name)}`
  const { error: upErr } = await supabase.storage.from('bb-materials').upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })
  if (upErr) throw upErr
  return must(
    await supabase
      .from('bb_materials')
      .insert({ id, course_id: courseId, kind, file_name: String(file.name).slice(0, 200), mime: file.type || null, size_bytes: file.size, storage_path: path })
      .select('*')
      .single(),
  )
}

export async function addPasted({ courseId, text, name, kind = 'notes' }) {
  return must(
    await supabase
      .from('bb_materials')
      .insert({ course_id: courseId, kind, file_name: String(name).slice(0, 200), mime: 'text/plain', size_bytes: text.length, pasted_text: text.slice(0, 400000) })
      .select('*')
      .single(),
  )
}

export async function reloadMaterials(courseId) {
  return must(await supabase.from('bb_materials').select('id, course_id, kind, file_name, mime, size_bytes, storage_path, status, error, pages, created_at, reading_at, processed_at').eq('course_id', courseId).order('created_at')) ?? []
}

/* --- answers, with a queue for when the network drops ---------------------- */

const QUEUE = 'bb.queue'

function readQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE) ?? '[]')
  } catch {
    return []
  }
}

function writeQueue(rows) {
  try {
    if (rows.length) localStorage.setItem(QUEUE, JSON.stringify(rows.slice(-500)))
    else localStorage.removeItem(QUEUE)
  } catch {
    /* storage blocked: the answers of this session are kept in memory only */
  }
}

export const pendingAnswers = () => readQueue().length

async function writeAnswer(userId, { schedule, answer, mistake }) {
  const a = await supabase.from('bb_schedule').upsert({ user_id: userId, ...schedule }, { onConflict: 'user_id,item_id' })
  if (a.error) throw a.error
  const b = await supabase.from('bb_reviews').insert({ user_id: userId, ...answer })
  if (b.error) throw b.error
  if (mistake) {
    const c = await supabase.from('bb_mistakes').upsert({ user_id: userId, ...mistake }, { onConflict: 'user_id,item_id' })
    if (c.error) throw c.error
  }
}

const offline = (err) => !navigator.onLine || /fetch|network|Failed to fetch|Load failed/i.test(String(err?.message ?? err))

/**
 * Save one answer. Offline (or on a network failure) it is queued in this
 * browser and sent by flushAnswers() when the connection comes back, so a
 * session keeps working on the metro (section 10). Returns 'saved' or 'queued'.
 */
export async function saveAnswer(userId, rows) {
  if (readQueue().length) await flushAnswers(userId)
  try {
    await writeAnswer(userId, rows)
    return 'saved'
  } catch (err) {
    if (!offline(err)) throw err
    writeQueue([...readQueue(), { userId, ...rows }])
    return 'queued'
  }
}

export async function flushAnswers(userId) {
  const queue = readQueue()
  if (!queue.length) return 0
  const left = []
  let sent = 0
  for (const row of queue) {
    if (row.userId !== userId) {
      left.push(row)
      continue
    }
    try {
      await writeAnswer(userId, row)
      sent += 1
    } catch {
      left.push(row)
    }
  }
  writeQueue(left)
  return sent
}

export async function startSession(courseId, minutes) {
  const { data, error } = await supabase.from('bb_sessions').insert({ course_id: courseId, minutes }).select('id').single()
  if (error) return null
  return data.id
}

export async function endSession(id, { answered, correct }) {
  if (!id) return
  await supabase.from('bb_sessions').update({ ended_at: new Date().toISOString(), answered, correct }).eq('id', id)
}

export async function loadCoachHistory(courseId) {
  const { data } = await supabase.from('bb_coach_messages').select('role, content, created_at').eq('course_id', courseId).order('created_at', { ascending: false }).limit(30)
  return (data ?? []).reverse()
}

/** "Turn this into cards": the student's question and the coach's grounded answer. */
export async function keepAsCard({ courseId, chapterId, conceptId, stem, answer, anchorIds }) {
  return must(
    await supabase
      .from('bb_items')
      .insert({ course_id: courseId, chapter_id: chapterId ?? null, concept_id: conceptId ?? null, type: 'flash', bloom: 1, stem: stem.slice(0, 400), answer: { text: answer.slice(0, 1200) }, anchor_ids: anchorIds, quality: 'pass', source: 'ai' })
      .select('id')
      .single(),
  )
}

/* --- mock exams, cases, visuals, the plan (migration 81) ------------------ */

export async function loadExams(courseId) {
  const { data, error } = await supabase.from('bb_exams').select('*').eq('course_id', courseId).order('started_at', { ascending: false }).limit(20)
  if (error) throw error
  return data ?? []
}

export async function startExam({ courseId, minutes, itemIds }) {
  return must(await supabase.from('bb_exams').insert({ course_id: courseId, minutes, item_ids: itemIds }).select('*').single())
}

export async function saveExamAnswers(id, answers) {
  await supabase.from('bb_exams').update({ answers }).eq('id', id)
}

export async function endExam(id, patch) {
  return must(await supabase.from('bb_exams').update({ ...patch, ended_at: new Date().toISOString() }).eq('id', id).select('*').single())
}

export async function loadCases(courseId) {
  const [cases, attempts] = await Promise.all([
    supabase.from('bb_cases').select('*').eq('course_id', courseId).order('created_at', { ascending: false }),
    supabase.from('bb_case_attempts').select('*').eq('course_id', courseId).order('created_at'),
  ])
  if (cases.error) throw cases.error
  return { cases: cases.data ?? [], attempts: attempts.data ?? [] }
}

export async function loadVisuals(courseId) {
  const { data, error } = await supabase.from('bb_visuals').select('*').eq('course_id', courseId).order('created_at')
  if (error) throw error
  return data ?? []
}

/** The sure-and-wrong answers of the last seven days, with what names them. */
export async function loadWeek(now = new Date()) {
  const since = new Date(now.getTime() - 7 * 86400000).toISOString()
  const { data: reviews } = await supabase.from('bb_reviews').select('course_id, concept_id, confidence, correct, mode, created_at').eq('confidence', 'sure').eq('correct', false).gte('created_at', since)
  const courseIds = [...new Set((reviews ?? []).map((r) => r.course_id))]
  if (!courseIds.length) return { reviews: [], concepts: [], chapters: [], twins: [] }
  const [concepts, chapters, twins] = await Promise.all([
    supabase.from('bb_concepts').select('id, chapter_id, name').in('course_id', courseIds),
    supabase.from('bb_chapters').select('id, course_id, title').in('course_id', courseIds),
    supabase.from('bb_twins').select('a_concept, b_concept').in('course_id', courseIds),
  ])
  return { reviews: reviews ?? [], concepts: concepts.data ?? [], chapters: chapters.data ?? [], twins: twins.data ?? [] }
}
