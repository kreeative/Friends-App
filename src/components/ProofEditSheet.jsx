import { useEffect, useState } from 'react'
import { useT } from '../lib/i18n'
import { updateProof } from '../lib/proofs'
import { normaliseLink, proofFilled, proofOf } from '../lib/proofKinds'
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
 * The kind is taken from what was actually stored rather than from what the
 * goal asks for today. A goal switched from photo to link in March still has
 * February's photographs hanging off it, and offering a URL box for one of
 * those would be offering to replace a picture with a link.
 *
 * Only the proof fields are written. See updateProof for why this does not go
 * back through submit_checkin.
 */
export default function ProofEditSheet({ proof, onClose, onSaved }) {
  const { t } = useT()
  const [value, setValue] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const open = Boolean(proof)
  const kind = proofOf(proof)?.kind ?? 'text'

  useEffect(() => {
    if (!proof) return
    setValue({
      photo_url: proof.photo_url ?? null,
      link_url: proof.link_url ?? '',
      evidence: proof.evidence ?? '',
    })
    setError(null)
  }, [proof])

  async function save() {
    if (busy || !proof) return
    setBusy(true)
    setError(null)

    /* Only the field this proof is, plus the note, which is the caption on a
       photograph and the proof itself on a text entry. Sending all three would
       let an edit to a photograph quietly write a link column that the goal
       never asked for.

       The link goes through normaliseLink, exactly as the check-in does. It
       did not, briefly, and the difference was invisible in the browser and
       fatal at the database: a typed "strava.com/x" was sent verbatim and the
       check constraint in migration 28 requires a scheme, so every edited link
       would have come back as a constraint violation. */
    const patch = { evidence: String(value.evidence ?? '').trim() || null }
    if (kind === 'photo') patch.photo_url = value.photo_url || null
    if (kind === 'link') patch.link_url = normaliseLink(value.link_url)

    const { error: failed } = await updateProof(proof.item_id, patch)
    setBusy(false)
    if (failed) return setError(failed.message ?? String(failed))

    onSaved?.()
    onClose?.()
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('proof.edit_title')}>
      <div className="space-y-6">
        {proof?.goal_title && (
          <p className="text-small text-muted">{proof.goal_title}</p>
        )}

        {/* The same control the check-in draws, so a photograph is replaced
            here exactly the way it was attached there. */}
        <ProofField
          type={kind}
          value={value}
          goalTitle={proof?.goal_title}
          onChange={(patch) => setValue((v) => ({ ...v, ...patch }))}
        />

        {error && <p className="text-small text-negative">{error}</p>}

        {/**
         * Replace, not delete.
         *
         * Saving an edit that leaves nothing behind would drop the entry out
         * of the gallery entirely, because the view in migration 28 only
         * returns items that have something on them. From the outside that is
         * a proof that silently disappeared after being "saved". So the button
         * waits until there is something to save, and removing a photograph
         * becomes a step on the way to attaching another one.
         */}
        <button
          onClick={save}
          disabled={busy || !proofFilled(value, kind)}
          className="btn-primary press w-full disabled:opacity-50"
        >
          {busy ? '…' : t('ui.save')}
        </button>

        {!proofFilled(value, kind) && (
          <p className="text-small text-muted">{t('proof.edit_needs')}</p>
        )}
      </div>
    </Sheet>
  )
}
