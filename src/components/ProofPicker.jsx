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
    if (error) setFailed(isMissingProofs(error) ? 'missing' : 'failed')
    else onChange(next)

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
      {/* The label is the control, so it keeps the keyboard behaviour and the
          focus ring a button wired to a hidden input would have to rebuild. */}
      <label
        className={`goal-action press inline-flex cursor-pointer ${
          busy ? 'pointer-events-none opacity-60' : ''
        }`}
      >
        {busy ? '…' : t('proof.add')}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            pick(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </label>

      {failed && (
        <p className="mt-2 text-small text-negative">
          {failed === 'missing' ? t('proof.not_installed') : t('proof.failed')}
        </p>
      )}
    </div>
  )
}
