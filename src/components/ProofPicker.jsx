import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { isMissingProofs, uploadProof } from '../lib/proofs'

/**
 * Attach a photograph to one goal's outcome.
 *
 * Uploaded on pick rather than on submit. Two reasons, and the second is the
 * one that decides it: a check-in goes out through the offline queue, which
 * replays a JSON payload and cannot carry a File, so the file has to become an
 * URL before it joins the queue. And uploading while somebody is still filling
 * in the rest of the form is the only moment the wait is free.
 *
 * The consequence is an orphan when a check-in is abandoned after a photo was
 * picked: a file in the bucket with nothing pointing at it. That is the right
 * trade against losing the picture, and it is bounded by the per-file size cap
 * in migration 23.
 *
 * ONE BUTTON, AND THE OPERATING SYSTEM DOES THE ASKING.
 *
 * There were briefly two buttons here, Take a photo and Choose from library,
 * because the original input carried `capture="environment"`, which on a phone
 * does not mean "prefer the camera", it means the camera and nothing else.
 * Two buttons fixed that and cost more than it was worth: a card inside a card
 * on every goal, for a question iOS and Android already ask better than we can.
 *
 * A plain `accept="image/*"` input with no `capture` is the whole fix. Tapping
 * it raises the native sheet, Photo Library / Take Photo / Choose File, which
 * is one tap deep, drawn by the platform, and already familiar. The custom
 * version was a second sheet in front of the first.
 *
 * The label wraps its own input rather than a button forwarding a click to a
 * hidden one. The label is already the control, so it keeps the keyboard
 * behaviour, the focus ring and the tap target a button would have to rebuild,
 * and there is no synthetic click to be swallowed by a popup heuristic.
 */
export default function ProofPicker({ url, onChange }) {
  const { user } = useAuth()
  const { t } = useT()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(null)

  async function pick(file) {
    if (!file || !user) return
    setBusy(true)
    setFailed(null)

    const { url: next, error } = await uploadProof(user.id, file)
    if (error) {
      /**
       * The reason, verbatim, under the friendly line.
       *
       * "That did not upload" is the right sentence for somebody who wants to
       * try again and the wrong one for anybody trying to find out why. Every
       * failure mode here is something a person can act on once they can read
       * it: "Bucket not found" is a migration that has not been run, "new row
       * violates row-level security policy" is the storage policies missing,
       * "exceeded the maximum allowed size" is a photograph the client failed
       * to downscale. All three were previously the same six words.
       */
      setFailed({
        kind: isMissingProofs(error) ? 'missing' : 'failed',
        detail: error?.message ?? String(error),
      })
    } else {
      onChange(next)
    }

    setBusy(false)
  }

  if (url) {
    return (
      <div className="mt-4">
        <div className="relative inline-block">
          <img
            src={url}
            alt=""
            className="h-24 w-24 rounded-inner object-cover ring-1 ring-inset ring-ink/[0.08]"
          />
          {/* On the corner of the thumbnail rather than beside it, because it
              acts on the picture and there may be several down the form. */}
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={t('proof.remove')}
            className="press absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-pill bg-ink text-white shadow-raised"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <p className="mt-2 text-small text-muted">{t('proof.visible')}</p>
      </div>
    )
  }

  return (
    <div className="mt-4">
      <label
        className={`goal-action press inline-flex cursor-pointer ${
          busy ? 'pointer-events-none opacity-60' : ''
        }`}
      >
        {busy ? '…' : t('proof.add')}
        <input
          type="file"
          accept="image/*"
          /* No `capture`. Deliberate, and the whole point of this control: with
             it, the phone offers the camera and refuses the camera roll. See
             the note above. */
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            pick(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </label>

      {failed && (
        <div className="mt-2">
          <p className="text-small text-negative">
            {failed.kind === 'missing' ? t('proof.not_installed') : t('proof.failed')}
          </p>
          {failed.detail && (
            <p className="mt-1 break-words text-label text-muted">{failed.detail}</p>
          )}
        </div>
      )}
    </div>
  )
}
