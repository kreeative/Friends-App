import { useEffect, useState } from 'react'
import { useT } from '../lib/i18n'
import { updateProof } from '../lib/proofs'
import { proofFields, proofFilled, proofOf } from '../lib/proofKinds'
import { Sheet } from './ui'
import ProofField from './ProofField'

/**
 * Changing a proof after it went out.
 *
 * The wrong photograph, a link that turned out to be private, a note with a
 * typo in it. All three used to mean living with it: proof was written once by
 * the check-in and there was no path back to it. The gallery is the natural
 * place for the fix, because it is where somebody is standing when they notice.
 *
 * WHAT CHANGED, AND WHY THE OLD RULE WAS WRONG.
 *
 * The kind used to be fixed to whatever was stored, and Save stayed disabled
 * until that one kind was satisfied. So "Retirer la photo" produced a dead
 * end: the photograph was gone from the preview, the only control on offer was
 * a file picker, and the button refused until another image was attached.
 * Removing a photograph was not something the screen would let you finish.
 *
 * The reasoning behind it was real. group_proofs only returns items that have
 * something on them, so saving an empty edit drops the entry out of the
 * gallery, and from the outside that looks like a proof that vanished after
 * being saved. But refusing the action is the wrong answer to that: it is a
 * consequence to be told about, not a decision to be taken away.
 *
 * So the kind is now a choice. Removing the photograph asks what should stand
 * in its place, all three answers are real answers including "nothing", and
 * the one case that removes the entry from the gallery says so in the sentence
 * above the button rather than by greying it out.
 */

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

const NoteIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" {...stroke}>
    <path d="M5 4.5h14v15H5zM8.5 9h7M8.5 13h7M8.5 17h4" />
  </svg>
)

const LinkIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" {...stroke}>
    <path d="M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 1 0-5-5l-1 1" />
    <path d="M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 1 0 5 5l1-1" />
  </svg>
)

const PhotoIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" {...stroke}>
    <path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h2l1-1.5h7L16.5 5h2A1.5 1.5 0 0 1 20 6.5v11A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5z" />
    <circle cx="12" cy="12" r="3.2" />
  </svg>
)

/** The three answers to "what stands in for the photograph". */
const OPTIONS = [
  { kind: 'text', label: 'proof.opt_none', hint: 'proof.opt_none_hint', Icon: NoteIcon },
  { kind: 'link', label: 'proof.opt_link', hint: 'proof.opt_link_hint', Icon: LinkIcon },
  { kind: 'photo', label: 'proof.opt_photo', hint: 'proof.opt_photo_hint', Icon: PhotoIcon },
]

export default function ProofEditSheet({ proof, onClose, onSaved }) {
  const { t } = useT()
  const [value, setValue] = useState({})
  const [kind, setKind] = useState('text')
  /* Whether the chooser is showing. Opened by removing a photograph, and by
     the button below for anybody who wants to change kind without removing
     anything first. Not open on arrival: somebody who came to fix a typo in a
     caption should meet their caption, not a menu. */
  const [choosing, setChoosing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const open = Boolean(proof)

  useEffect(() => {
    if (!proof) return
    setValue({
      photo_url: proof.photo_url ?? null,
      link_url: proof.link_url ?? '',
      evidence: proof.evidence ?? '',
    })
    /* From what was actually stored, not from what the goal asks for today. A
       goal switched from photo to link in March still has February's
       photographs hanging off it. */
    setKind(proofOf(proof)?.kind ?? 'text')
    setChoosing(false)
    setError(null)
  }, [proof])

  /**
   * Taking the photograph off.
   *
   * Two things at once, and they belong together: the preview clears now, and
   * the question of what replaces it is asked now, while the person is still
   * thinking about it. Dropping them into an empty photo picker instead would
   * be answering the question for them.
   *
   * The kind stays 'photo' until they choose, so backing out of the chooser
   * and attaching another image is still one tap away.
   */
  function removePhoto() {
    setValue((v) => ({ ...v, photo_url: null }))
    setChoosing(true)
  }

  function choose(next) {
    setKind(next)
    setChoosing(false)
    /* Switching to a photograph with none attached lands on the picker, which
       is where somebody who picked "another photo" is trying to get to. */
    if (next !== 'photo') setValue((v) => ({ ...v, photo_url: null }))
  }

  /**
   * What the save will actually leave behind.
   *
   * Not the same question as "is the control filled in". A note-kind proof
   * with an empty note is a legitimate thing to save, it just means the entry
   * has nothing left to show and leaves the gallery. Knowing which of those is
   * about to happen is what the line under the button is for.
   */
  const willBeEmpty = !proofFilled(value, kind)

  async function save() {
    if (busy || !proof) return
    setBusy(true)
    setError(null)

    /**
     * All three fields, every time, from the chosen kind.
     *
     * The old version patched only the field matching the stored kind, which
     * was right when the kind could not change and silently wrong now that it
     * can: switching a photograph to a link would have written link_url and
     * left photo_url sitting there, and proofOf prefers a photograph, so the
     * gallery would have gone on showing the picture that was just replaced.
     *
     * proofFields is the same function the check-in submits through, so a link
     * edited here goes through normaliseLink exactly as one attached there.
     * That matters: migration 28's check constraint requires a scheme, and a
     * typed "strava.com/x" sent verbatim comes back as a constraint violation.
     */
    const patch = proofFields(value, kind)

    const { error: failed } = await updateProof(proof.item_id, patch)
    setBusy(false)
    if (failed) return setError(failed.message ?? String(failed))

    onSaved?.()
    onClose?.()
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('proof.edit_title')}>
      <div className="space-y-6">
        {proof?.goal_title && <p className="text-small text-muted">{proof.goal_title}</p>}

        {choosing ? (
          <div className="animate-rise">
            <p className="text-body font-semibold text-ink">{t('proof.how_validate')}</p>
            <div className="mt-4 space-y-2">
              {OPTIONS.map(({ kind: k, label, hint, Icon }) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => choose(k)}
                  className={`press flex w-full items-center gap-3.5 rounded-inner border px-4 py-3.5 text-left transition-colors duration-200 ease-settle ${
                    kind === k
                      ? 'border-accent bg-accent/[0.1]'
                      : 'border-hairline hover:border-ink/20 hover:bg-ink/[0.03]'
                  }`}
                >
                  <span className="shrink-0 text-ink">
                    <Icon />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-body font-semibold text-ink">{t(label)}</span>
                    <span className="mt-0.5 block text-small text-muted">{t(hint)}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* The same control the check-in draws, so a photograph is replaced
                here exactly the way it was attached there. */}
            <ProofField
              type={kind}
              value={value}
              goalTitle={proof?.goal_title}
              onChange={(patch) => setValue((v) => ({ ...v, ...patch }))}
              onRemovePhoto={removePhoto}
            />

            {/* A way into the chooser that does not require destroying
                something first. Somebody whose proof is a note and who now has
                a link for it had no route at all before this. */}
            <button
              type="button"
              onClick={() => setChoosing(true)}
              className="press text-small font-semibold text-ink underline-offset-4 hover:underline"
            >
              {t('proof.change_kind')}
            </button>
          </>
        )}

        {error && <p className="text-small text-negative">{error}</p>}

        {!choosing && (
          <>
            <button
              onClick={save}
              disabled={busy}
              className="btn-primary press w-full disabled:opacity-50"
            >
              {busy ? '…' : t('ui.save')}
            </button>

            {/**
             * Said, not enforced.
             *
             * Saving nothing is allowed and has a consequence: group_proofs
             * only returns items carrying a photo, a link or a note, so the
             * entry leaves the gallery. That used to be prevented by disabling
             * the button, which stopped the one thing somebody might genuinely
             * want and explained nothing. A sentence costs them one read and
             * leaves the decision where it belongs.
             */}
            {willBeEmpty && (
              <p className="animate-rise text-small text-muted">{t('proof.will_empty')}</p>
            )}
          </>
        )}
      </div>
    </Sheet>
  )
}
