import { useCallback, useEffect, useRef, useState } from 'react'
import { call } from '../api'

/**
 * Getting a course ready, shown honestly (section 9.5): each file is read
 * one after the other, then the questions of chapter 1 are prepared, a few
 * concepts per call, until the server answers { done: true }.
 *
 * DRIVEN FROM THE PAGE, ON PURPOSE. Each call is one Vercel function run of
 * at most five minutes; a loop on the server would need a queue the Hobby
 * plan does not have. So the page drives: while it is open, it reads the
 * next file and prepares the next batch; closed, nothing is lost, the files
 * keep their status in bb_materials and the loop picks up where it stopped
 * the next time the course is opened.
 *
 * A file stuck in "reading" for more than six minutes was abandoned (the
 * tab closed mid-read): it counts as waiting again.
 *
 * It stops, and says why, on a daily limit, on the free plan's chapter
 * limit, and when the server has no model key. Any other failure is shown
 * on the file it belongs to, with a retry, and the loop moves on.
 */
export const STALE_MS = 6 * 60000

export const isWaiting = (m, now = Date.now()) =>
  m.status === 'uploaded' || (m.status === 'reading' && (!m.reading_at || now - Date.parse(m.reading_at) > STALE_MS))

const STOP = new Set(['limit', 'paused', 'no_key', 'key_format', 'no_workspace', 'setup', 'plan_chapters', 'unauthorized', 'offline'])

export function useProcessing({ courseId, materials, chapters, onChange, auto = true }) {
  const [state, setState] = useState({ running: false, current: null, generating: null, added: 0, rejected: 0, stopped: null, errors: {}, firstReady: false })
  const running = useRef(false)
  const startedFor = useRef(null)

  const patch = (p) => setState((s) => ({ ...s, ...p }))

  const readOne = useCallback(
    async (material) => {
      patch({ current: material.id })
      const r = await call('ingest', { material_id: material.id })
      patch({ current: null })
      if (!r.ok) {
        setState((s) => ({ ...s, errors: { ...s.errors, [material.id]: r.data } }))
        if (STOP.has(r.data?.error)) {
          patch({ stopped: r.data })
          return false
        }
      }
      await onChange?.()
      return true
    },
    [onChange],
  )

  const prepare = useCallback(
    async (chapter) => {
      patch({ generating: chapter.id, added: 0, rejected: 0 })
      let added = 0
      let rejected = 0
      for (let guard = 0; guard < 40; guard += 1) {
        const r = await call('generate', { course_id: courseId, chapter_id: chapter.id })
        if (!r.ok) {
          patch({ generating: null })
          if (STOP.has(r.data?.error)) patch({ stopped: r.data })
          else setState((s) => ({ ...s, errors: { ...s.errors, [chapter.id]: r.data } }))
          await onChange?.()
          return false
        }
        added += r.data.added ?? 0
        rejected += r.data.rejected ?? 0
        patch({ added, rejected })
        if (r.data.done) break
      }
      patch({ generating: null })
      await onChange?.()
      return true
    },
    [courseId, onChange],
  )

  const run = useCallback(
    async (mats, chaps) => {
      if (running.current) return
      running.current = true
      patch({ running: true, stopped: null })
      try {
        for (const m of mats.filter((x) => isWaiting(x))) {
          const go = await readOne(m)
          if (!go) return
        }
        const first = [...chaps].sort((a, b) => a.position - b.position).find((c) => !c.items_ready)
        const anyReady = chaps.some((c) => c.items_ready)
        if (first && !anyReady) {
          const ok = await prepare(first)
          if (ok) patch({ firstReady: true })
        }
      } finally {
        running.current = false
        patch({ running: false })
      }
    },
    [readOne, prepare],
  )

  /* Once per course and per new batch of waiting files. */
  useEffect(() => {
    if (!auto || !materials || !chapters) return
    const waiting = materials.filter((m) => isWaiting(m)).map((m) => m.id).join(',')
    const needFirst = !chapters.some((c) => c.items_ready) && chapters.length > 0
    const key = `${courseId}:${waiting}:${needFirst}`
    if (!waiting && !needFirst) return
    if (startedFor.current === key) return
    startedFor.current = key
    run(materials, chapters)
  }, [auto, courseId, materials, chapters, run])

  const retry = useCallback(
    async (material) => {
      setState((s) => {
        const errors = { ...s.errors }
        delete errors[material.id]
        return { ...s, errors, stopped: null }
      })
      if (running.current) return
      running.current = true
      patch({ running: true })
      try {
        await readOne(material)
      } finally {
        running.current = false
        patch({ running: false })
      }
    },
    [readOne],
  )

  const prepareChapter = useCallback(
    async (chapter) => {
      if (running.current) return
      running.current = true
      patch({ running: true, stopped: null })
      try {
        await prepare(chapter)
      } finally {
        running.current = false
        patch({ running: false })
      }
    },
    [prepare],
  )

  return { ...state, retry, prepareChapter }
}
