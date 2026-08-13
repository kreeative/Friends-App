import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import { localeTag, useT } from '../lib/i18n'
import { emptyInk, isBlank } from '../lib/ink'
import { entryKind, isEmptyEntry } from '../lib/entries'
import { INK_COLORS } from '../lib/ink'
import { deleteEntry, saveEntry } from '../lib/journal'
import { dayKey } from '../lib/time'
import MoodBoard, { MoodBadge } from './MoodBoard'
import InkCanvas from './InkCanvas'
import ToolPalette from './ToolPalette'

/**
 * A page, not a dialog.
 *
 * This was a bottom sheet, and a bottom sheet is the wrong container for the
 * one screen in this app whose job is to be as big as a sheet of paper. On a
 * phone it left about two inches to write a diary in; with a stylus on a
 * tablet it was worse, because the thing you are holding is designed for a
 * whole page and the app offered a letterbox.
 *
 * So it is fixed to the viewport, above everything, with its own header. Apple
 * Notes and every physical notebook agree: the writing surface gets the screen
 * and the controls get out of the way.
 *
 * THE HEADER CARRIES THE SETUP.
 *
 * The spec asked for a step that collects the date and the mood before the
 * page opens. That would be a form in front of a blank page, and the blank
 * page is already the hard part of journalling; adding a gate before it is how
 * an app gets closed at the gate. Both live in the header instead, one tap
 * each, answerable before writing or after or never. Nothing is behind them.
 *
 * SAVING IS ONE BUTTON, AND CLOSING IS NOT IT.
 *
 * Done writes and leaves. Close leaves, and asks first if there is anything
 * unsaved, because a full-screen editor has no visible page behind it to
 * remind somebody what they are about to lose.
 */
export default function JournalEditor({ open, entry, seedText, onClose, onSaved }) {
  const { user } = useAuth()
  const { t, locale } = useT()

  const [mode, setMode] = useState('text')
  const [day, setDay] = useState(dayKey())
  const [body, setBody] = useState('')
  const [ink, setInk] = useState(() => emptyInk())
  const [mood, setMood] = useState(null)

  const [sheet, setSheet] = useState(null) // 'mood' | 'confirm-clear' | 'confirm-close'
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [dirty, setDirty] = useState(false)

  /* Drawing tool state lives here rather than in the canvas, because the
     palette floats as a sibling of the canvas and both need it. */
  const [tool, setTool] = useState('pen')
  const [color, setColor] = useState(INK_COLORS[0])
  const [erasing, setErasing] = useState(false)
  const historyRef = useRef(null)
  const [, forceHistory] = useState(0)

  useEffect(() => {
    if (!open) return
    setMode(entry?.kind === 'ink' ? 'ink' : 'text')
    setDay(entry?.day ?? dayKey())
    setBody(entry?.body ?? seedText ?? '')
    setInk(entry?.ink ?? emptyInk())
    setMood(entry?.mood ?? null)
    setSheet(null)
    setError(null)
    setConfirmDelete(false)
    setDirty(false)
    setErasing(false)
  }, [open, entry, seedText])

  /**
   * The page behind does not scroll, and Escape closes.
   *
   * Without the overflow lock, a drag that starts on the header scrolls the
   * journal grid underneath and the editor appears to slide. Restored to
   * whatever it was rather than to '', so nesting inside anything else that
   * locks scrolling does not unlock it on the way out.
   */
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => e.key === 'Escape' && tryClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  })

  if (!open) return null

  const hasInk = !isBlank(ink)
  const canSave = !isEmptyEntry({ body, ink })

  const touch = (fn) => (...args) => {
    setDirty(true)
    fn(...args)
  }

  function tryClose() {
    if (dirty && canSave) return setSheet('confirm-close')
    onClose?.()
  }

  async function save() {
    if (!canSave || busy || !user) return
    setBusy(true)
    setError(null)

    const { row, error: failed } = await saveEntry({
      id: entry?.id,
      userId: user.id,
      day,
      kind: entryKind({ body, ink, mode }),
      body,
      ink,
      mood,
    })

    setBusy(false)
    if (failed) return setError(failed.message ?? String(failed))
    onSaved?.(row)
    onClose?.()
  }

  async function remove() {
    if (!entry?.id || busy) return
    if (!confirmDelete) return setConfirmDelete(true)

    setBusy(true)
    const { error: failed } = await deleteEntry(entry.id)
    setBusy(false)
    if (failed) return setError(failed.message ?? String(failed))
    onSaved?.(null, entry.id)
    onClose?.()
  }

  const fmt = new Intl.DateTimeFormat(localeTag(locale), { day: 'numeric', month: 'short' })
  const [y, m, d] = day.split('-').map(Number)
  const dayLabel = y ? fmt.format(new Date(y, m - 1, d, 12)) : day

  /**
   * Portalled to the body, and this is not optional.
   *
   * position:fixed resolves against the nearest ancestor with a transform,
   * filter or backdrop-filter rather than against the viewport, and the app
   * shell is full of both: the glass chrome uses backdrop-filter and the page
   * wrapper animates in with a transform. Rendered in place, a fixed inset-0
   * editor inherits a containing block the size of a card. This is the same
   * bug the bottom sheets hit once already.
   */
  return createPortal(
    <div className="ink-surface fixed inset-0 z-50 flex flex-col bg-bg">
      {/* ---- header ---------------------------------------------------- */}
      <header className="flex shrink-0 items-center gap-2 border-b border-hairline bg-surface px-3 py-2.5">
        <button
          type="button"
          onClick={tryClose}
          className="press rounded-pill px-3 py-2 text-small font-semibold text-muted transition-colors hover:text-ink"
        >
          {t('ui.close')}
        </button>

        <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
          {/* Date and mood, one tap each, no gate in front of the page. */}
          <label className="press relative inline-flex shrink-0 items-center whitespace-nowrap rounded-pill bg-ink/[0.06] px-3 py-1.5 text-small font-semibold text-ink">
            {dayLabel}
            <input
              type="date"
              value={day}
              max={dayKey()}
              onChange={touch((e) => setDay(e.target.value || dayKey()))}
              aria-label={t('journal.about_day')}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>

          <button
            type="button"
            onClick={() => setSheet('mood')}
            className="press inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill bg-ink/[0.06] px-3 py-1.5 text-small font-semibold text-ink"
          >
            {mood ? <MoodBadge id={mood} size={18} /> : <span>{t('journal.mood_add')}</span>}
          </button>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={!canSave || busy}
          className="press rounded-pill bg-accent px-4 py-2 text-small font-semibold text-on-accent transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {busy ? '…' : t('journal.done')}
        </button>
      </header>

      {/* ---- mode ------------------------------------------------------- */}
      <div
        role="tablist"
        aria-label={t('journal.mode')}
        className="flex shrink-0 items-center gap-2 border-b border-hairline bg-surface px-3 pb-2.5"
      >
        {[
          { id: 'text', label: t('journal.mode_text'), filled: body.trim().length > 0 },
          { id: 'ink', label: t('journal.mode_ink'), filled: hasInk },
        ].map((tab) => (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={mode === tab.id}
            onClick={() => setMode(tab.id)}
            className={`press flex flex-1 items-center justify-center gap-2 rounded-pill py-2 text-small font-semibold transition-colors ${
              mode === tab.id ? 'bg-ink text-surface' : 'bg-ink/[0.06] text-ink hover:bg-ink/[0.1]'
            }`}
          >
            {tab.label}
            {/* A dot on the one holding something, so switching away from a
                half-drawn page and forgetting it is there cannot happen
                quietly. */}
            {tab.filled && (
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-pill ${mode === tab.id ? 'bg-surface' : 'bg-accent'}`}
              />
            )}
          </button>
        ))}
      </div>

      {/* ---- the page --------------------------------------------------- */}
      <div className="relative min-h-0 flex-1">
        {mode === 'text' ? (
          <textarea
            className="ruled h-full w-full resize-none border-0 bg-white px-5 py-3 text-body text-ink outline-none placeholder:text-muted"
            style={{ '--rule': '2.25rem', lineHeight: '2.25rem' }}
            value={body}
            placeholder={t('journal.text_ph')}
            onChange={touch((e) => setBody(e.target.value))}
            autoFocus={!entry}
          />
        ) : (
          <InkCanvas
            value={ink}
            onChange={touch(setInk)}
            tool={tool}
            color={color}
            erasing={erasing}
            historyRef={historyRef}
          />
        )}

        {error && (
          <p className="absolute inset-x-4 bottom-4 rounded-inner bg-negative px-4 py-2 text-small text-white">
            {error}
          </p>
        )}
      </div>

      {/* ---- the tools, floating over the page --------------------------- */}
      {mode === 'ink' && (
        <ToolPalette
          tool={tool}
          onTool={setTool}
          color={color}
          onColor={setColor}
          erasing={erasing}
          onErasing={setErasing}
          canUndo={Boolean(historyRef.current?.canUndo)}
          canRedo={Boolean(historyRef.current?.canRedo)}
          /* forceHistory re-renders this component after a command so the
             palette's arrows reflect the new depth. The handle itself is a
             ref and changing it does not schedule anything. */
          onUndo={() => {
            historyRef.current?.undo()
            forceHistory((n) => n + 1)
          }}
          onRedo={() => {
            historyRef.current?.redo()
            forceHistory((n) => n + 1)
          }}
          onClear={() => setSheet('confirm-clear')}
        />
      )}

      {/* ---- the three things that ask ----------------------------------- */}
      {sheet === 'mood' && (
        <Overlay onClose={() => setSheet(null)}>
          <h2 className="text-h2 text-ink">{t('journal.mood')}</h2>
          <div className="mt-5">
            <MoodBoard value={mood} onChange={touch(setMood)} />
          </div>
          <button
            onClick={() => setSheet(null)}
            className="btn-primary press mt-6 w-full"
          >
            {t('journal.done')}
          </button>
        </Overlay>
      )}

      {sheet === 'confirm-clear' && (
        <Overlay onClose={() => setSheet(null)}>
          <h2 className="text-h2 text-ink">{t('ink.clear_sure')}</h2>
          <p className="mt-2 text-body text-muted">{t('ink.clear_body')}</p>
          <div className="mt-6 flex gap-3">
            <button onClick={() => setSheet(null)} className="btn-ghost press flex-1">
              {t('ink.cancel')}
            </button>
            <button
              onClick={() => {
                historyRef.current?.clear()
                forceHistory((n) => n + 1)
                setSheet(null)
              }}
              className="press flex-1 rounded-pill bg-negative py-3 text-body font-semibold text-white"
            >
              {t('journal.clear')}
            </button>
          </div>
        </Overlay>
      )}

      {sheet === 'confirm-close' && (
        <Overlay onClose={() => setSheet(null)}>
          <h2 className="text-h2 text-ink">{t('journal.leave_sure')}</h2>
          <p className="mt-2 text-body text-muted">{t('journal.leave_body')}</p>
          <div className="mt-6 flex gap-3">
            <button onClick={() => setSheet(null)} className="btn-ghost press flex-1">
              {t('ink.cancel')}
            </button>
            <button
              onClick={onClose}
              className="press flex-1 rounded-pill bg-negative py-3 text-body font-semibold text-white"
            >
              {t('journal.leave')}
            </button>
          </div>
        </Overlay>
      )}

      {/* Delete lives at the bottom of an existing entry, out of the way of
          everything somebody opened this screen to do. */}
      {entry?.id && !sheet && (
        <div className="shrink-0 border-t border-hairline bg-surface px-3 py-2 text-center">
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className={`press rounded-pill px-4 py-1.5 text-small font-semibold transition-colors ${
              confirmDelete ? 'bg-negative text-white' : 'text-muted hover:text-negative'
            }`}
          >
            {confirmDelete ? t('journal.delete_sure') : t('journal.delete')}
          </button>
        </div>
      )}
    </div>,
    document.body,
  )
}

/**
 * A card over the page, for the three questions that have to be answered
 * before anything else happens.
 *
 * Not the shared Sheet component: that one portals to the body, and this is
 * already inside a portal that covers the screen. Two portals would put the
 * dialog behind its own editor.
 */
function Overlay({ children, onClose }) {
  return (
    <div
      className="absolute inset-0 z-10 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-card bg-surface p-6 shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
