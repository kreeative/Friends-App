import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useGroup } from '../context/GroupContext'
import { useT } from '../lib/i18n'
import { STICKERS, stickerFor } from '../lib/art'
import { isMissingColumn } from '../lib/dberr'

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
export default function GroupHeader({ group, canEdit, sub, note = null }) {
  const { reload } = useGroup()
  const { t } = useT()

  const [editing, setEditing] = useState(false)
  const [picking, setPicking] = useState(false)
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

  /**
   * Enregistrer l'image choisie. `null` remet le calcul.
   *
   * La colonne arrive avec la migration 66. Un bundle deploye avant son SQL
   * recevrait PGRST204 et afficherait a quelqu'un une trace Postgres sur une
   * page ou il voulait changer une image; isMissingColumn distingue ce cas
   * d'une vraie panne, comme ailleurs dans ce depot.
   */
  async function saveSticker(name) {
    setBusy(true)
    setError(null)
    const { error: err } = await supabase
      .from('groups')
      .update({ sticker: name })
      .eq('id', group.id)
    setBusy(false)

    if (err) {
      setError(isMissingColumn(err, 'sticker') ? t('settings.sticker_pending') : err.message)
      return
    }
    setPicking(false)
    await reload()
  }

  return (
    <div className="lg p-6 text-center sm:p-7">
      {/**
       * L'IMAGE SE CHANGE EN LA TOUCHANT, COMME LE NOM.
       *
       * Meme raison qu'au-dessus pour le nom: elle est deja a l'ecran, elle
       * est ce qu'on vient regler, et un dialogue avec un voile et deux
       * boutons autour d'une grille d'images est plus de ceremonie que le
       * geste n'en demande. La grille s'ouvre sous elle, dans la carte.
       *
       * Pour les admins seulement, comme le nom, et pour la meme raison: le
       * refus vit dans groups_update de toute facon.
       */}
      <button
        type="button"
        disabled={!canEdit}
        onClick={() => setPicking((v) => !v)}
        aria-expanded={picking}
        data-hook="group-sticker"
        className="press mx-auto block rounded-card p-1 disabled:cursor-default"
      >
        <img
          src={stickerFor(group.id, group.sticker)}
          alt=""
          aria-hidden="true"
          className="h-24 w-24 object-contain"
        />
        {canEdit && (
          <span className="mt-1 block text-label font-semibold uppercase tracking-[0.08em] text-muted">
            {picking ? t('settings.sticker_close') : t('settings.sticker_change')}
          </span>
        )}
      </button>

      {picking && canEdit && (
        <div className="mt-4" data-hook="group-sticker-grid">
          {/* Revenir au calcul, et pas seulement en choisir un autre: une fois
              qu'on a touche a l'image il n'y avait plus aucun chemin de retour
              vers celle que le groupe avait au depart. */}
          <button
            type="button"
            onClick={() => saveSticker(null)}
            data-hook="group-sticker-auto"
            className={`chip-quiet mb-3 ${!group.sticker ? 'ring-2 ring-accent' : ''}`}
          >
            {t('settings.sticker_auto')}
          </button>
          <div className="grid max-h-64 grid-cols-5 gap-1.5 overflow-y-auto sm:grid-cols-7">
            {STICKERS.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => saveSticker(s.name)}
                aria-pressed={group.sticker === s.name}
                aria-label={t('settings.sticker_pick', { name: s.name })}
                data-sticker={s.name}
                className={`press rounded-inner p-1 ${
                  group.sticker === s.name ? 'bg-accent/10 ring-2 ring-accent' : 'hover:bg-ink/[0.05]'
                }`}
              >
                <img src={s.src} alt="" aria-hidden="true" className="h-11 w-11 object-contain" />
              </button>
            ))}
          </div>
        </div>
      )}

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
          className="press mt-4 block max-w-full rounded-inner px-2 py-1 disabled:cursor-default"
        >
          {/**
           * LE NOM PASSE A LA LIGNE, IL NE SE COUPE PLUS.
           *
           * C'etait `truncate`, donc "YOUNG AND BEAUTIFUL" s'affichait
           * "YOUNG AND BEA…" sur un telephone, sur LA page qui existe pour
           * nommer le groupe, et sans aucun moyen de lire la suite. Un nom de
           * soixante caracteres est permis par la base; la carte doit pouvoir
           * en montrer soixante.
           *
           * `break-words` et pas seulement un retour a la ligne: un nom d'un
           * seul mot long n'a nulle part ou passer a la ligne, et il ne se
           * tronque pas, il deborde. C'est le piege note dans le CLAUDE.md.
           */}
          <span className="break-words font-display text-h1 text-ink">
            {group.name}
            {/* Dans le flux du texte, pas a cote en flex: en flex il tombait
                sur une ligne a lui des que le nom passait a la ligne, et un
                crayon seul et centre sous le titre se lit comme une icone
                egaree. Inline, il suit le dernier mot et passe a la ligne
                avec lui. */}
            {canEdit && (
              <span aria-hidden="true" className="ml-2 inline-block align-middle text-muted">
                <PencilIcon />
              </span>
            )}
          </span>
        </button>
      )}

      <p className="mt-2 text-small text-muted" data-hook="group-when">
        {busy ? t('settings.saving') : sub}
      </p>
      {/**
       * LA DEUXIEME PHRASE N'APPARAIT QUE POUR CEUX QUI EN ONT BESOIN.
       *
       * Elle dit deux choses a quelqu'un qui n'est pas dans le fuseau du
       * groupe: que l'heure au-dessus est bien la sienne, et que tout le monde
       * y arrive en meme temps. Chez la personne qui a cree le groupe, les
       * deux fuseaux coincident, il n'y a rien a preciser, et une ligne de
       * plus serait du bruit sur la seule page ou l'on vient changer quelque
       * chose.
       */}
      {!busy && note && (
        <p className="mt-1 max-w-[42ch] text-small text-muted/80" data-hook="group-when-note">
          {note}
        </p>
      )}
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
