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
/**
 * One of the two ways in.
 *
 * A label wrapping its own input rather than a button that forwards a click to
 * a hidden one: the label is already the control, so it keeps the keyboard
 * behaviour, the focus ring and the tap target a button would have to rebuild,
 * and there is no click-forwarding to be blocked by a popup heuristic.
 */
function PickOption({ icon, label, capture, onFile, disabled }) {
  return (
    <label
      className={`press flex flex-1 cursor-pointer flex-col items-center gap-2 rounded-inner bg-ink/[0.04] px-3 py-4 text-center transition-colors hover:bg-ink/[0.07] ${
        disabled ? 'pointer-events-none opacity-60' : ''
      }`}
    >
      <span className="text-muted">{icon}</span>
      <span className="text-small font-semibold text-ink">{label}</span>
      <input
        type="file"
        accept="image/*"
        /* Only the camera option carries `capture`, and it carries it as a
           request rather than as a rule: a device with no camera falls back to
           its own picker, which is the correct behaviour and the reason not to
           try to detect one. */
        {...(capture ? { capture: 'environment' } : {})}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          onFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </label>
  )
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
        <path d="M3 8.5h3.2L8 6h8l1.8 2.5H21v11H3z" strokeLinecap="round" />
        <circle cx="12" cy="13.5" r="3.6" />
      </g>
    </svg>
  )
}

function LibraryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2.5" />
        <path d="M3 15.5l4.5-4 3.5 3 3.5-4 6 6" strokeLinecap="round" />
        <circle cx="8.5" cy="9.5" r="1.4" />
      </g>
    </svg>
  )
}

export default function ProofPicker({ url, onChange }) {
  const { user } = useAuth()
  const { t } = useT()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(null)
  const [choosing, setChoosing] = useState(false)

  async function pick(file) {
    if (!file || !user) return
    setBusy(true)
    setFailed(null)
    setChoosing(false)

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

  /**
   * WHY THERE ARE TWO OPTIONS AND NOT ONE INPUT.
   *
   * The button used to be a single input carrying `capture="environment"`,
   * which on a phone does not mean "prefer the camera", it means "the camera
   * and nothing else". Anybody who photographed their run at seven in the
   * morning and opened the app at nine had no way to attach it, and the app
   * gave no hint that the picture they already had was unusable.
   *
   * Dropping `capture` alone would fix it: iOS and Android then offer their
   * own Take Photo / Photo Library sheet. This goes one further and asks
   * plainly, for two reasons. The native sheet is three items on iOS and its
   * wording differs by version, so the promise "you can use a photo you
   * already have" is only kept if the OS happens to say so; and on desktop
   * there is no sheet at all, so a lone camera button was simply a file
   * dialog wearing the wrong label.
   */
  return (
    <div className="mt-4">
      {!choosing ? (
        <button
          type="button"
          onClick={() => setChoosing(true)}
          disabled={busy}
          className={`goal-action press inline-flex ${busy ? 'opacity-60' : ''}`}
        >
          {busy ? '…' : t('proof.add')}
        </button>
      ) : (
        <div className="rounded-inner bg-ink/[0.025] p-3">
          <div className="flex gap-2">
            <PickOption
              icon={<CameraIcon />}
              label={t('proof.take')}
              capture
              onFile={pick}
              disabled={busy}
            />
            <PickOption
              icon={<LibraryIcon />}
              label={t('proof.library')}
              onFile={pick}
              disabled={busy}
            />
          </div>
          <button
            type="button"
            onClick={() => setChoosing(false)}
            className="press mt-3 w-full rounded-inner py-2 text-small font-semibold text-muted transition-colors hover:text-ink"
          >
            {t('ui.close')}
          </button>
        </div>
      )}

      {failed && (
        <p className="mt-2 text-small text-negative">
          {failed === 'missing' ? t('proof.not_installed') : t('proof.failed')}
        </p>
      )}
    </div>
  )
}
