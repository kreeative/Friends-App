import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useGroup } from '../context/GroupContext'
import { useT } from '../lib/i18n'
import { stickerFor } from '../lib/art'

/**
 * The group, as a thing with a name and a face.
 *
 * This screen opened with a completion percentage and a head count, which is
 * the wrong first sentence for a settings page: it is the same figure the
 * board already leads with, and reading it here made this feel like a second
 * dashboard rather than the place you go to change something.
 *
 * A settings page should open by naming what you are settling. So: the
 * group's sticker, its name, and when it opens.
 *
 * RENAMING IS INLINE, NOT A MODAL.
 *
 * It is one short string, the field is already on screen showing the current
 * value, and a dialog for one text box is a scrim, a title and two buttons
 * around an edit that takes four seconds. Tap the name, it becomes a field,
 * Enter or blur saves.
 *
 * Only admins see it as editable. The refusal lives in the groups_update
 * policy either way, so hiding it is courtesy rather than the actual
 * enforcement: a crafted update from a console gets the same answer.
 */
export default function GroupHeader({ group, canEdit, sub }) {
  const { reload } = useGroup()
  const { t } = useT()

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(group.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const input = useRef(null)

  /* The server's value wins whenever it changes underneath, which is what
     happens after a successful save and after somebody else renames it. */
  useEffect(() => setName(group.name), [group.name])

  useEffect(() => {
    if (editing) input.current?.focus()
  }, [editing])

  async function save() {
    const next = name.trim()
    setEditing(false)

    /* Nothing to do, and an empty name is not a name. Both fall back to what
       was there rather than reporting an error about a change nobody meant to
       make. */
    if (!next || next === group.name) return setName(group.name)

    setBusy(true)
    setError(null)
    const { error: err } = await supabase
      .from('groups')
      .update({ name: next.slice(0, 60) })
      .eq('id', group.id)
    setBusy(false)

    if (err) {
      setError(err.message)
      setName(group.name)
      return
    }
    await reload()
  }

  return (
    <div className="lg p-6 text-center sm:p-7">
      <img
        src={stickerFor(group.id)}
        alt=""
        aria-hidden="true"
        className="mx-auto h-24 w-24 object-contain"
      />

      {editing ? (
        <input
          ref={input}
          className="field mt-4 text-center text-h1"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') {
              setName(group.name)
              setEditing(false)
            }
          }}
        />
      ) : (
        <button
          type="button"
          disabled={!canEdit}
          onClick={() => setEditing(true)}
          className="press mt-4 inline-flex max-w-full items-center gap-2 rounded-inner px-2 py-1 disabled:cursor-default"
        >
          <span className="truncate font-display text-h1 text-ink">{group.name}</span>
          {canEdit && (
            <span aria-hidden="true" className="shrink-0 text-muted">
              <PencilIcon />
            </span>
          )}
        </button>
      )}

      <p className="mt-2 text-small text-muted">{busy ? t('settings.saving') : sub}</p>
      {error && <p className="mt-2 text-small text-negative">{error}</p>}
    </div>
  )
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" />
        <path d="M14.5 7.5l3 3" />
      </g>
    </svg>
  )
}
