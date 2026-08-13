import { useEffect, useState } from 'react'
import { useT } from '../lib/i18n'
import { PIN_LENGTH, isWeakPin, normalisePin } from '../lib/lock'

/**
 * Four digits.
 *
 * ITS OWN KEYPAD RATHER THAN AN INPUT.
 *
 * `<input type="number">` was the obvious answer and it is wrong in three
 * separate ways at once. It eats leading zeros, so 0042 becomes 42 and a
 * perfectly ordinary passcode cannot be typed. It shows spinner arrows on
 * desktop, on a passcode. And on Android it opens a keyboard with a decimal
 * point and a minus sign on it. `inputMode="numeric"` on a text input fixes
 * the first two and still gives a phone keyboard whose layout is nobody's idea
 * of a lock screen.
 *
 * A drawn keypad is the thing people already know, it is the same on every
 * device, and the keys are big enough to hit without looking. The hardware
 * keyboard still works, because a laptop has no touchscreen and typing 1234
 * has to do something.
 *
 * SUBMISSION IS AUTOMATIC.
 *
 * There is no OK button. The fourth digit is the whole gesture, as on a phone
 * lock screen, and a passcode that needs five taps for four digits reads as a
 * form rather than a lock.
 */
export default function PasscodePad({
  title,
  hint,
  error,
  busy = false,
  disabled = false,
  onComplete,
  onCancel,
  cancelLabel,
}) {
  const { t } = useT()
  const [pin, setPin] = useState('')

  /* The passcode clears whenever the caller reports a failure, so the next
     attempt starts from an empty row of dots rather than from four filled ones
     that have to be deleted first. */
  useEffect(() => {
    if (error) setPin('')
  }, [error])

  /**
   * A full row of dots accepts nothing more.
   *
   * Without this, `normalisePin` silently truncated back to four and fired
   * onComplete again with the same passcode. On the "type it again" step, where
   * the pad was still holding the first passcode, that meant the very first key
   * press confirmed the code you had just chosen: any digit at all, and the
   * passcode was set without ever being typed twice. The parent also gives each
   * step its own `key` so the dots start empty, and this is the belt to that
   * pair of braces.
   */
  function push(digit) {
    if (busy || disabled || pin.length >= PIN_LENGTH) return
    const next = normalisePin(pin + digit)
    setPin(next)
    if (next.length === PIN_LENGTH) {
      /* A frame, so the fourth dot is painted filled before the screen changes
         underneath it. Without it the last key looks like it did nothing. */
      requestAnimationFrame(() => onComplete?.(next))
    }
  }

  function back() {
    if (busy || disabled) return
    setPin((p) => p.slice(0, -1))
  }

  /* A hardware keyboard, for the laptops. Digits type, backspace deletes,
     Escape is the way out, which is what every one of these does everywhere
     else. */
  useEffect(() => {
    function onKey(e) {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault()
        push(e.key)
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        back()
      } else if (e.key === 'Escape' && onCancel) {
        onCancel()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

  return (
    <div className="mx-auto w-full max-w-[19rem] text-center">
      <h2 className="text-h2 text-ink">{title}</h2>
      {hint && <p className="mt-2 text-small text-muted">{hint}</p>}

      {/* The dots. Filled as you go, and the row is the only feedback there
          is, so it is the largest thing after the heading. */}
      <div className="mt-7 flex items-center justify-center gap-4" aria-hidden="true">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-pill transition-all ${
              i < pin.length ? 'scale-110 bg-ink' : 'bg-ink/15'
            }`}
          />
        ))}
      </div>
      {/* The same information, for anybody who cannot see the dots. Polite, so
          it does not interrupt on every keypress. */}
      <p className="sr-only" aria-live="polite">
        {t('journal.pin_entered', { n: pin.length })}
      </p>

      <p className={`mt-4 min-h-[1.25rem] text-small ${error ? 'text-negative' : 'text-muted'}`}>
        {busy ? t('journal.checking') : error || (isWeakPin(pin) && pin.length === PIN_LENGTH ? t('journal.pin_weak') : '')}
      </p>

      <div className="mt-2 grid grid-cols-3 gap-3">
        {keys.map((k) => (
          <Key key={k} onClick={() => push(k)} disabled={busy || disabled}>
            {k}
          </Key>
        ))}

        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="press rounded-card py-4 text-small font-semibold text-muted transition-colors hover:text-ink"
          >
            {cancelLabel ?? t('ui.close')}
          </button>
        ) : (
          <span />
        )}

        <Key onClick={() => push('0')} disabled={busy || disabled}>
          0
        </Key>

        <button
          type="button"
          onClick={back}
          disabled={busy || disabled || pin.length === 0}
          aria-label={t('journal.pin_delete')}
          className="press flex items-center justify-center rounded-card py-4 text-muted transition-colors hover:text-ink disabled:opacity-30"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7 6-7Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path d="m12 10 4 4m0-4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function Key({ children, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      /* font-display and text-h2: a keypad digit is a target, not body copy,
         and at body size the keys read as a table of numbers. */
      className="press rounded-card bg-ink/[0.05] py-4 font-display text-h2 text-ink transition-colors hover:bg-ink/[0.1] disabled:opacity-40"
    >
      {children}
    </button>
  )
}
