import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { useT } from '../lib/i18n'
import { errorText } from '../lib/dberr'
import { Sheet } from './ui'
import { Spot } from './StickerKit'
import { changed } from '../lib/dirty'

/**
 * CE QUE TU PARTAGES AVEC CE GROUPE.
 *
 *   "If you don't want to share your picture, it's okay because it's
 *    privacy. Well, we still need to have your name. [...] it doesn't share
 *    your email anyways. [...] you can ask to not share your picture or your
 *    mood."
 *
 * Posee une fois en arrivant (ShareSheet, sur le tableau du groupe) et
 * modifiable ensuite dans les reglages du groupe (ShareChoices seul):
 *
 *   ton nom              toujours visible, donc une ligne et pas une case
 *   ta photo de profil   une case (group_sharing.name, voir la 79)
 *   tes photos de preuve une case, seulement si le groupe demande des photos
 *                        en preuve; sinon elle suit la photo de profil
 *   ton humeur           une case (mood_share)
 *
 * L'e-mail n'est plus demande: il n'est partage avec personne.
 *
 * CHAQUE "NON" EST TENU PAR LA BASE, PAS PAR CET ECRAN. Voir
 * supabase/75_group_sharing.sql et 79_name_always.sql: sans la photo, le
 * groupe ne lit plus ta ligne de profil et te voit sous ton nom (alias, une
 * copie tenue a jour); la photo d'un point du jour y est retiree; l'humeur
 * passe par mood_share. set_group_sharing() ignore un pseudo ou un e-mail
 * qu'on lui passerait quand meme.
 *
 * Les sous-titres montrent CE qui est partage (ton nom), pas un mode
 * d'emploi: "le bouton est beaucoup trop long et detaille" a deja ete dit
 * d'un interrupteur de cette page.
 */
export default function ShareChoices({ groupId, current, onSaved, submitLabel }) {
  const { user, profile } = useAuth()
  const { goals } = useGroup()
  const { t } = useT()

  /* Les photos de preuve ne se demandent que la ou elles servent. */
  const asksProofs = (goals ?? []).some((g) => g.status === 'active' && g.proof_type === 'photo')

  /* Pas de reponse encore: les photos cochees, l'humeur non. Ce sont des
     propositions; rien n'est partage tant que le bouton n'est pas appuye
     (pas de ligne, pas de photo). */
  const [photo, setPhoto] = useState(current ? current.name : true)
  const [proofs, setProofs] = useState(current ? current.photos : true)
  const [mood, setMood] = useState(false)
  /* L'humeur telle qu'elle est enregistree: avec le nom et les photos de
     `current`, ce a quoi le bouton se compare. Rien de change, il reste gris
     ("si rien n'a change, le bouton enregistrer reste grise", src/lib/dirty.js).
     Une premiere reponse (current null) se valide telle quelle. */
  const [moodSaved, setMoodSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  /* L'humeur se lit dans mood_share (migration 71), qui la tient deja groupe
     par groupe depuis les reglages du compte. */
  useEffect(() => {
    let dead = false
    ;(async () => {
      if (!user?.id || !groupId) return
      const { data } = await supabase
        .from('mood_share')
        .select('group_id')
        .eq('user_id', user.id)
        .eq('group_id', groupId)
        .maybeSingle()
      if (!dead && data) {
        setMood(true)
        setMoodSaved(true)
      }
    })()
    return () => {
      dead = true
    }
  }, [user?.id, groupId])

  async function save(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { error: err } = await supabase.rpc('set_group_sharing', {
      p_group: groupId,
      p_name: photo,
      p_alias: null,
      p_photos: asksProofs ? proofs : photo,
      p_email: false,
      p_mood: mood,
    })
    setBusy(false)
    if (err) {
      setError(errorText(err))
      return
    }
    await onSaved?.()
  }

  const rows = [
    ['photo', photo, setPhoto, t('share.photo'), t('share.photo_sub')],
    ...(asksProofs ? [['photos', proofs, setProofs, t('share.photos'), t('share.photos_sub')]] : []),
    ['mood', mood, setMood, t('share.mood'), t('share.mood_sub')],
  ]

  return (
    <form onSubmit={save} className="measure-form space-y-3" data-hook="share-choices">
      {/* Le nom n'est pas une question: une ligne, sans case. */}
      <div className="flex items-start gap-3 rounded-inner bg-ink/[0.035] p-4" data-hook="share-name">
        <span className="min-w-0">
          <span className="block text-body text-ink">{t('share.name')}</span>
          <span className="mt-0.5 block break-words text-small text-muted">
            {profile?.display_name ? t('share.name_sub', { name: profile.display_name }) : t('share.name_always')}
          </span>
        </span>
      </div>
      {rows.map(([key, on, set, label, sub]) => (
        <label key={key} className="press flex cursor-pointer items-start gap-3 rounded-inner bg-ink/[0.035] p-4">
          <input
            type="checkbox"
            checked={on}
            onChange={(e) => set(e.target.checked)}
            data-hook={`share-${key}`}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[rgb(var(--c-accent))]"
          />
          <span className="min-w-0">
            <span className="block text-body text-ink">{label}</span>
            {sub && <span className="mt-0.5 block break-words text-small text-muted">{sub}</span>}
          </span>
        </label>
      ))}

      {error && (
        <p className="text-small text-negative" role="alert" data-hook="share-error">
          {error}
        </p>
      )}

      <button className="btn-primary press mt-3 text-[1.1875rem] font-bold" disabled={busy || (current != null && !changed({ photo: current.name, proofs: current.photos, mood: moodSaved }, { photo, proofs, mood }))} data-hook="share-save">
        {busy ? t('share.saving') : submitLabel ?? t('share.save')}
      </button>
    </form>
  )
}

/**
 * La question, a l'arrivee dans un groupe.
 *
 * S'ouvre seule sur le tableau du groupe tant qu'il n'y a pas de reponse
 * (mySharing === null), donc quelle que soit la facon d'etre entre: code,
 * lien d'invitation, defi. Fermer sans repondre ne partage rien, et la
 * question revient a la prochaine visite. Avant la migration 75, mySharing
 * vaut undefined et rien ne s'ouvre.
 */
export function ShareSheet() {
  const { group, activeId, mySharing, reloadGroup } = useGroup()
  const { t } = useT()
  const [closed, setClosed] = useState(false)

  if (!group || mySharing !== null || closed) return null

  return (
    <Sheet open onClose={() => setClosed(true)} title={t('share.title', { group: group.name })}>
      <div data-hook="share-sheet">
        {/* Le sticker est dans le flux, a cote de la phrase. Pose en absolu
            au-dessus, il cachait le bouton Fermer des 820 px: la sonde le
            trouvait sur 50 x 20 px du mot. */}
        <div className="mb-6 flex items-start gap-4">
          <p className="max-w-[40ch] text-body text-muted">{t('share.intro')}</p>
          <Spot name="homie" tilt={10} eager className="ml-auto w-14 shrink-0" />
        </div>
        <ShareChoices
          groupId={activeId}
          current={null}
          submitLabel={t('share.go')}
          onSaved={async () => {
            await reloadGroup()
            setClosed(true)
          }}
        />
      </div>
    </Sheet>
  )
}
