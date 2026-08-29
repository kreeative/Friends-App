import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { errorText } from '../lib/dberr'
import { AlertIcon } from './ui'

/**
 * Closing the account, from inside the app.
 *
 * Apple's guideline 5.1.1(v) is the occasion: an app that lets you make an
 * account has to let you delete it here, not by writing to somebody and
 * waiting. It is the right thing with or without a store. An account you can
 * open and cannot close is not really yours.
 *
 * WHAT IT ASKS FOR, AND WHY IT IS NOT A SECOND BUTTON.
 *
 * Typing a word. Not "are you sure", which people click through, and not a
 * hold-to-confirm, which is a gesture rather than a decision. Typing six
 * letters is the smallest thing that cannot be done by a thumb landing in the
 * wrong place, and it is the only action in this app that nothing can undo.
 *
 * The word is translated. Asking a French speaker to type DELETE is asking
 * them to copy a string they do not read, which tests their transcription
 * rather than their intent, and intent is the entire point of the gate.
 *
 * WHAT IT DOES NOT DO.
 *
 * It does not decide anything. delete_account() in supabase/31_delete_account
 * .sql owns all of it: which groups are handed on and to whom, what is wound
 * up, what cascades. Duplicating any of that here would be a second copy of a
 * policy to get out of step with the first.
 */
export default function DeleteAccount() {
  const { t } = useT()
  const { deleteAccount } = useAuth()

  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const word = t('danger.word')
  const ready = typed.trim().toUpperCase() === word.toUpperCase()

  async function run() {
    if (!ready || busy) return
    setBusy(true)
    setError(null)

    const { error: failed } = await deleteAccount()

    if (failed) {
      /* Left on screen with the reason, and nothing has gone: the function
         runs in one transaction, so a failure means the account is exactly as
         it was. Saying so matters more here than anywhere else in the app,
         because the alternative reading is that it half worked. */
      setBusy(false)
      setError(errorText(failed))
      return
    }

    /* Deliberately not navigating. deleteAccount signs out, the auth context
       drops the session, and the app renders the signed-out routes on its
       own. A navigate() here would race that and land on a route that is
       about to stop existing. */
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press w-full rounded-inner py-3 text-small font-semibold text-negative transition-colors hover:bg-negative/[0.07]"
      >
        {t('danger.start')}
      </button>
    )
  }

  /**
   * THE LEFT RULE IS GONE, AND HERE IT WAS DOING REAL WORK.
   *
   * The wash is negative at 5%, which on a blush page is very nearly white.
   * The 4px stripe was the only thing making this read as a panel at all, so
   * deleting it and stopping there would have left a paragraph floating on the
   * page immediately before the one action in the app that nothing undoes.
   *
   * A hairline all the way round replaces it. It closes the shape instead of
   * hanging off one side, which is what every current destructive-zone pattern
   * does, and AlertIcon carries the "this is a warning" signal that the
   * stripe's colour used to carry on its own.
   */
  return (
    <div className="animate-rise rounded-card border border-negative/30 bg-negative/[0.05] p-5">
      <div className="flex items-start gap-3">
        <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-negative" />
        <div className="min-w-0">
          <h3 className="text-body font-semibold text-ink">{t('danger.title')}</h3>
          {/* Ink, not muted. On the panel's tinted ground muted measures 4.16:1,
              under the bar, and this is the wrong paragraph in the app to make
              people squint at: it is the list of what they are about to lose,
              read once, immediately before an action nothing undoes. */}
          <p className="mt-2 max-w-[46ch] text-small text-ink">{t('danger.body')}</p>
        </div>
      </div>

      <label className="mt-5 block">
        <span className="field-label">{t('danger.confirm_label', { word })}</span>
        <input
          className="field"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck="false"
          aria-label={t('danger.confirm_label', { word })}
        />
      </label>

      {error && (
        <p className="mt-4 break-words text-small text-negative" role="alert">
          {t('danger.failed')} {error}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        {/* The way out is first and is the ordinary-looking one. On the one
            screen in the app that destroys something, the safe choice should
            be the one a hand reaches for without deciding to. */}
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setTyped('')
            setError(null)
          }}
          disabled={busy}
          className="btn-ghost press"
        >
          {t('danger.cancel')}
        </button>
        <button
          type="button"
          onClick={run}
          disabled={!ready || busy}
          className="btn press bg-negative text-white hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
        >
          {busy ? t('danger.working') : t('danger.go')}
        </button>
      </div>
    </div>
  )
}
