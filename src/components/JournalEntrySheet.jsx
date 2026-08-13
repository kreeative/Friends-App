import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { emptyInk, isBlank } from '../lib/ink'
import { entryKind, isEmptyEntry } from '../lib/entries'
import { deleteEntry, saveEntry } from '../lib/journal'
import { dayKey } from '../lib/time'
import { Sheet } from './ui'
import MoodBoard, { MoodBadge } from './MoodBoard'
import InkCanvas from './InkCanvas'

/**
 * Writing one entry.
 *
 * TWO MODES, ONE ENTRY.
 *
 * Typing and handwriting are tabs rather than two different kinds of thing you
 * choose between at the start, because the choice is about the moment and not
 * about the entry: the same Tuesday might be three typed paragraphs on the bus
 * and a drawing at home. Switching tabs does not throw the other one away, so
 * a handwritten page can carry a typed line above it and changing your mind
 * costs nothing.
 *
 * `kind` records which one the entry is *about*, which is what the grid uses
 * to decide whether to show a thumbnail or a snippet. It follows the tab
 * you were last on when there is something in it, rather than being a third
 * control asking you to classify your own diary.
 *
 * THE DATE IS A FIELD, NOT A TIMESTAMP.
 *
 * Sunday written up on Tuesday evening is the normal case for a journal, not
 * an edge case, so the date sits at the top of the form and defaults to today.
 * See `day` in supabase/27_journal.sql for why it is separate from created_at.
 */
export default function JournalEntrySheet({ open, entry, seedText, onClose, onSaved }) {
  const { user } = useAuth()
  const { t } = useT()

  const [mode, setMode] = useState('text')
  const [day, setDay] = useState(dayKey())
  const [body, setBody] = useState('')
  const [ink, setInk] = useState(() => emptyInk())
  const [mood, setMood] = useState(null)
  const [moodOpen, setMoodOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  /**
   * Seeded when the sheet opens, and only then.
   *
   * Keyed on `open` as well as on the entry, because closing and reopening on
   * the same entry has to start from what is stored rather than from whatever
   * was half-typed and abandoned last time.
   */
  useEffect(() => {
    if (!open) return
    setMode(entry?.kind === 'ink' ? 'ink' : 'text')
    setDay(entry?.day ?? dayKey())
    setBody(entry?.body ?? seedText ?? '')
    setInk(entry?.ink ?? emptyInk())
    setMood(entry?.mood ?? null)
    setMoodOpen(false)
    setError(null)
    setConfirmDelete(false)
  }, [open, entry, seedText])

  const hasText = body.trim().length > 0
  const hasInk = !isBlank(ink)
  const canSave = !isEmptyEntry({ body, ink })

  async function save() {
    if (!canSave || busy || !user) return
    setBusy(true)
    setError(null)

    /* Which of the two this entry is. The rule lives in entries.js with its
       own tests, because "drawn page with a typed title" and "typed page with
       a doodle" are the same row seen from two sides and the grid has to pick
       one to show. */
    const kind = entryKind({ body, ink, mode })

    const { row, error: failed } = await saveEntry({
      id: entry?.id,
      userId: user.id,
      day,
      kind,
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
    /* Two taps, no dialog on top of a dialog. The button becomes the
       confirmation, which is one fewer layer to escape from and makes the
       destructive press deliberate without a scrim over a scrim. */
    if (!confirmDelete) return setConfirmDelete(true)

    setBusy(true)
    const { error: failed } = await deleteEntry(entry.id)
    setBusy(false)
    if (failed) return setError(failed.message ?? String(failed))
    onSaved?.(null, entry.id)
    onClose?.()
  }

  return (
    <Sheet open={open} onClose={onClose} title={entry ? t('journal.edit_entry') : t('journal.new_entry')}>
      <div className="space-y-6">
        {/* The date first, because a journal entry is about a day and the
            whole point of having the field is that it is not always today. */}
        <label className="block">
          <span className="field-label">{t('journal.about_day')}</span>
          <input
            type="date"
            className="field"
            value={day}
            /* No future entries. A journal is a record of what happened, and
               a card dated next Thursday sitting at the top of the grid is a
               plan that has wandered into the wrong feature. */
            max={dayKey()}
            onChange={(e) => setDay(e.target.value || dayKey())}
          />
        </label>

        {/**
         * Two tabs.
         *
         * A dot on the one that has something in it, so switching away from a
         * half-drawn page and forgetting it is there cannot happen quietly.
         */}
        <div role="tablist" aria-label={t('journal.mode')} className="flex gap-2">
          {[
            { id: 'text', label: t('journal.mode_text'), filled: hasText },
            { id: 'ink', label: t('journal.mode_ink'), filled: hasInk },
          ].map((tab) => (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={mode === tab.id}
              onClick={() => setMode(tab.id)}
              className={`press flex flex-1 items-center justify-center gap-2 rounded-pill py-2.5 text-small font-semibold transition-colors ${
                mode === tab.id ? 'bg-ink text-surface' : 'bg-ink/[0.06] text-ink hover:bg-ink/[0.1]'
              }`}
            >
              {tab.label}
              {tab.filled && (
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 rounded-pill ${mode === tab.id ? 'bg-surface' : 'bg-accent'}`}
                />
              )}
            </button>
          ))}
        </div>

        {mode === 'text' ? (
          <label className="block">
            <span className="sr-only">{t('journal.mode_text')}</span>
            <textarea
              className="field min-h-[13rem] resize-y leading-relaxed"
              value={body}
              placeholder={t('journal.text_ph')}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
        ) : (
          <InkCanvas value={ink} onChange={setInk} />
        )}

        {/**
         * The mood, folded away.
         *
         * Twelve faces is a lot of screen to spend on an optional question
         * sitting under the thing somebody came here to write, so at rest it
         * is one line. Same component as the dashboard, so a mood means the
         * same thing in both places.
         */}
        <div>
          <button
            type="button"
            onClick={() => setMoodOpen((v) => !v)}
            className="press flex w-full items-center gap-3 rounded-inner py-2 text-left"
          >
            <span className="flex-1 text-small font-semibold text-ink">{t('journal.mood')}</span>
            {mood ? <MoodBadge id={mood} size={24} withLabel /> : (
              <span className="text-small text-muted">{t('journal.mood_add')}</span>
            )}
            <span aria-hidden="true" className="text-small text-muted">
              {moodOpen ? '−' : '+'}
            </span>
          </button>

          {/* grid-rows 0fr to 1fr: animates to the real height with nobody
              measuring anything, and degrades to an instant open. Same trick
              as MoodToday. */}
          <div
            className={`grid transition-[grid-template-rows] duration-300 ease-settle ${
              moodOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
            }`}
          >
            <div className="overflow-hidden">
              <div className="pt-4">
                <MoodBoard value={mood} onChange={setMood} />
              </div>
            </div>
          </div>
        </div>

        {error && <p className="text-small text-negative">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={!canSave || busy}
            className="btn-primary press flex-1 disabled:opacity-50"
          >
            {busy ? '…' : t('ui.save')}
          </button>

          {entry?.id && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className={`press rounded-pill px-4 py-2.5 text-small font-semibold transition-colors ${
                confirmDelete ? 'bg-negative text-surface' : 'text-muted hover:text-negative'
              }`}
            >
              {confirmDelete ? t('journal.delete_sure') : t('journal.delete')}
            </button>
          )}
        </div>

        {!canSave && (
          <p className="text-small text-muted">{t('journal.need_something')}</p>
        )}
      </div>
    </Sheet>
  )
}
