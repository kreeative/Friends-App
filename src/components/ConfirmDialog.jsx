import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

/**
 * The one question before something that does not come back.
 *
 * PORTALLED, AND THAT IS NOT A DETAIL. `position: fixed` resolves against the
 * nearest transformed ancestor, not the viewport, and a goal card sits inside a
 * page wrapper that animates on entry. Declared in place, this dialog would be
 * fixed to the card and could open below the fold, which is the same bug the
 * member sheet had. See the note on Sheet in ui.jsx.
 *
 * A dialog rather than an inline expander, unlike DeleteAccount, which asks
 * you to type a word. The difference is what is at stake: an account is
 * everything and is closed once, so it is worth six letters of friction; a
 * goal is one row on a list somebody may be tidying four of, and making them
 * type SUPPRIMER four times would train them to stop reading it. The modal is
 * the right weight, and the important part is that the destructive button is
 * not where the tap that opened it landed.
 */
export default function ConfirmDialog({
  open,
  title,
  body,
  cancelLabel,
  confirmLabel,
  busy = false,
  error = null,
  onCancel,
  onConfirm,
}) {
  const cancelRef = useRef(null)

  /**
   * Focus lands on Cancel, not on Confirm.
   *
   * Something has to be focused or the dialog is unreachable by keyboard and
   * invisible to a screen reader. Confirm would be the conventional pick and
   * is wrong here: Enter is still held down often enough after the keystroke
   * that opened this, and the whole purpose of the screen is to not delete
   * something by accident.
   */
  useEffect(() => {
    if (open) cancelRef.current?.focus()
  }, [open])

  /* Escape is the way out, and it is the way out from anywhere in the dialog
     rather than only from the button that happens to hold focus. Ignored while
     the delete is in flight: closing then would leave the request running with
     nothing on screen to report what it did. */
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onCancel?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onCancel])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/35 px-6 backdrop-blur-[2px]"
      /* The scrim dismisses, which is the same safe answer as Cancel. It does
         not confirm, so a stray tap outside can only ever be harmless. */
      onClick={() => !busy && onCancel?.()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        onClick={(e) => e.stopPropagation()}
        className="animate-rise w-full max-w-[26rem] rounded-card bg-surface p-6 shadow-float"
      >
        <h2 id="confirm-title" className="text-h2 font-semibold text-ink">
          {title}
        </h2>
        {/* Ink rather than muted. This is a sentence read once, immediately
            before something irreversible, and it is the wrong paragraph in the
            app to make anybody squint at. */}
        <p id="confirm-body" className="mt-3 text-small text-ink">
          {body}
        </p>

        {error && (
          <p className="mt-4 break-words text-small text-negative" role="alert">
            {error}
          </p>
        )}

        {/**
         * Cancel first, and it is the one that looks like an ordinary button.
         * On the screen whose only job is to prevent an accident, the safe
         * choice should be the one a hand reaches for without deciding to.
         */}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="btn-ghost press"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="btn press bg-negative text-white hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
