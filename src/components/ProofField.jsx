import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { isMissingProofs, uploadProof } from '../lib/proofs'
import { NOTE_MAX, isValidLink, linkHost } from '../lib/proofKinds'

/**
 * The one proof control a goal actually asked for, on the goal's own card.
 *
 * WHY THIS REPLACED A TAB.
 *
 * Proof used to live on its own pane: you counted your goals on one screen,
 * then went to a second screen listing the same goals again to attach
 * photographs to them. Two lists of the same things, and the second one shared
 * a tab with the group's gallery, so the same screen was both "put something
 * in" and "look at what everyone did". People read it as the second thing and
 * never found the first. Proof belongs next to the answer it is proof of.
 *
 * WHY THE CONTROL VARIES.
 *
 * Because the evidence does. Asking for a photograph of "read twenty pages"
 * gets you a picture of a book, which proves a book exists. A link proves the
 * landing page shipped. A sentence is the only possible evidence of ten
 * minutes sat with a difficult feeling, and a camera button on that goal is
 * the app misunderstanding what was promised.
 *
 * The photograph still uploads on pick rather than on submit, for the reason
 * in proofs.js: a check-in goes out through the offline queue, which replays
 * JSON and cannot carry a File.
 */
/**
 * @param onRemovePhoto  What "remove the photo" should do beyond clearing it.
 *   The check-in passes nothing and gets the old behaviour, which is right
 *   there: the goal asked for a photograph and the next step is another one.
 *   The edit sheet passes a handler so it can ask what should stand in its
 *   place, because there removing one is a thing somebody may want to finish
 *   rather than a step on the way to attaching another.
 */
export default function ProofField({ type, value, onChange, goalTitle, onRemovePhoto }) {
  const { user } = useAuth()
  const { t } = useT()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(null)

  if (type === 'none') return null

  async function pick(file) {
    if (!file || !user) return
    setBusy(true)
    setFailed(null)

    const { url, error } = await uploadProof(user.id, file)
    if (error) {
      /* The reason, verbatim, under the friendly line. "That did not upload"
         is right for somebody who wants to try again and useless to anybody
         trying to find out why: a missing bucket, a missing storage policy and
         an oversized file are three different jobs and were previously the
         same six words. */
      setFailed({
        kind: isMissingProofs(error) ? 'missing' : 'failed',
        detail: error?.message ?? String(error),
      })
    } else {
      onChange({ photo_url: url })
    }
    setBusy(false)
  }

  // ---- photo ----------------------------------------------------------------

  if (type === 'photo') {
    if (value?.photo_url) {
      return (
        <div className="mt-5">
          <div className="flex items-center gap-3">
            <img
              src={value.photo_url}
              alt=""
              className="h-20 w-20 shrink-0 rounded-inner object-cover ring-1 ring-inset ring-ink/[0.08]"
            />
            <div className="min-w-0 flex-1">
              <p className="text-small font-semibold text-green">{t('proof.attached')}</p>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                {/* Replace is a second file input rather than remove-then-add,
                    because changing a photograph is one intention and making
                    it two steps means the card spends a moment claiming there
                    is no proof when there is. */}
                <label className="press cursor-pointer text-small font-semibold text-ink underline-offset-4 hover:underline">
                  {busy ? '…' : t('proof.replace')}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={busy}
                    onChange={(e) => {
                      pick(e.target.files?.[0])
                      e.target.value = ''
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => (onRemovePhoto ? onRemovePhoto() : onChange({ photo_url: null }))}
                  className="text-small text-muted underline-offset-4 hover:underline"
                >
                  {t('proof.remove')}
                </button>
              </div>
            </div>
          </div>
          <Caption value={value} onChange={onChange} />
        </div>
      )
    }

    return (
      <div className="mt-5">
        {/**
         * Full width, and a label rather than a button driving a hidden input.
         * The label is already the control, so it keeps the keyboard
         * behaviour, the focus ring and the tap target for free, and there is
         * no synthetic click for a popup heuristic to swallow.
         *
         * No `capture` attribute. On a phone that does not mean "prefer the
         * camera", it means the camera and nothing else, which is how this
         * ended up refusing the camera roll once already.
         */}
        <label
          className={`press flex w-full cursor-pointer items-center justify-center gap-2 rounded-pill bg-ink/[0.06] py-3.5 text-small font-semibold text-ink transition-colors hover:bg-ink/[0.1] ${
            busy ? 'pointer-events-none opacity-60' : ''
          }`}
        >
          <CameraGlyph />
          {busy ? t('proof.uploading') : t('proof.add_photo')}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              pick(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </label>

        {failed && <Failure failed={failed} />}
      </div>
    )
  }

  // ---- link -----------------------------------------------------------------

  if (type === 'link') {
    const raw = value?.link_url ?? ''
    /* Only complained about once there is enough typed to be wrong. Marking a
       field red on the first keystroke of a URL is an app telling somebody off
       for not having finished. */
    const bad = raw.trim().length > 3 && !isValidLink(raw)
    const host = linkHost(raw)

    return (
      <div className="mt-5">
        <input
          type="url"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          className={`field ${bad ? 'ring-1 ring-negative' : ''}`}
          value={raw}
          placeholder={t('proof.link_ph')}
          aria-label={t('proof.link_label', { goal: goalTitle ?? '' })}
          onChange={(e) => onChange({ link_url: e.target.value })}
        />
        {bad ? (
          <p className="mt-1.5 text-small text-negative">{t('proof.link_bad')}</p>
        ) : (
          host && <p className="mt-1.5 text-small text-green">{t('proof.link_ok', { host })}</p>
        )}
      </div>
    )
  }

  // ---- text -----------------------------------------------------------------

  const note = value?.evidence ?? ''
  return (
    <div className="mt-5">
      <textarea
        rows={3}
        maxLength={NOTE_MAX}
        className="field resize-y leading-relaxed"
        value={note}
        placeholder={t('proof.note_ph')}
        aria-label={t('proof.note_label', { goal: goalTitle ?? '' })}
        onChange={(e) => onChange({ evidence: e.target.value })}
      />
      {/* Only near the end. A counter that is always on turns a reflection
          into a form field with a budget. */}
      {note.length > NOTE_MAX - 60 && (
        <p className="mt-1 text-right text-label text-muted">
          {NOTE_MAX - note.length}
        </p>
      )}
    </div>
  )
}

/**
 * A line about the photograph, folded away until asked for.
 *
 * evidence_def has always prompted for this and it is genuinely useful ("the
 * whiteboard after, not before"), but an always-open second box under every
 * photo makes the card twice as tall for something most people skip.
 */
function Caption({ value, onChange }) {
  const { t } = useT()
  const note = value?.evidence ?? ''
  const [open, setOpen] = useState(Boolean(note))

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press mt-3 text-small text-muted underline-offset-4 hover:text-ink hover:underline"
      >
        {t('proof.add_caption')}
      </button>
    )
  }

  return (
    <input
      className="field mt-3"
      value={note}
      maxLength={NOTE_MAX}
      placeholder={t('proof.caption_ph')}
      aria-label={t('proof.caption_ph')}
      onChange={(e) => onChange({ evidence: e.target.value })}
    />
  )
}

function Failure({ failed }) {
  const { t } = useT()
  return (
    <div className="mt-2">
      <p className="text-small text-negative">
        {failed.kind === 'missing' ? t('proof.not_installed') : t('proof.failed')}
      </p>
      {failed.detail && <p className="mt-1 break-words text-label text-muted">{failed.detail}</p>}
    </div>
  )
}

function CameraGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M2.5 6.5A1.5 1.5 0 0 1 4 5h1.4l.9-1.5h5.4L12.6 5H14a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 14 14H4a1.5 1.5 0 0 1-1.5-1.5v-6Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="9.5" r="2.6" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}
