import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { useT } from '../lib/i18n'
import { errorText } from '../lib/dberr'
import { Sheet } from './ui'
import { Spot } from './StickerKit'

/**
 * CE QUE TU PARTAGES AVEC CE GROUPE.
 *
 *   "When someone join a group, let's add a feature that directly asks them
 *    whether they want to share their name, their pictures, email, or their
 *    mood with the group."
 *
 * Quatre cases, posees une fois en arrivant (ShareSheet, sur le tableau du
 * groupe) et modifiables ensuite dans les reglages du groupe (ShareChoices
 * seul). Une seule ecriture, set_group_sharing(), qui enregistre les quatre
 * d'un coup.
 *
 * CHAQUE "NON" EST TENU PAR LA BASE, PAS PAR CET ECRAN. Voir
 * supabase/75_group_sharing.sql: le profil n'est plus lisible a travers ce
 * groupe, la photo d'un point du jour y est retiree, l'e-mail n'y est donne
 * qu'a ceux qui ont dit oui, l'humeur passe par mood_share. Cacher une case
 * ici sans la base derriere serait une promesse que rien ne tient.
 *
 * Les sous-titres montrent CE qui est partage (ton nom, ton adresse), pas un
 * mode d'emploi: "le bouton est beaucoup trop long et detaille" a deja ete dit
 * d'un interrupteur de cette page.
 */
export default function ShareChoices({ groupId, current, alias: currentAlias, onSaved, submitLabel }) {
  const { user, profile } = useAuth()
  const { t } = useT()

  /* Pas de reponse encore: nom et photos coches, e-mail et humeur non. Ce
     sont des propositions; rien n'est partage tant que le bouton n'est pas
     appuye (pas de ligne, pas de partage). */
  const [name, setName] = useState(current ? current.name : true)
  const [photos, setPhotos] = useState(current ? current.photos : true)
  const [email, setEmail] = useState(current ? current.email : false)
  const [mood, setMood] = useState(false)
  const [pseudo, setPseudo] = useState(currentAlias ?? '')
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
      if (!dead && data) setMood(true)
    })()
    return () => {
      dead = true
    }
  }, [user?.id, groupId])

  async function save(e) {
    e.preventDefault()
    setError(null)
    if (!name && !pseudo.trim()) {
      setError(t('share.alias_required'))
      return
    }
    setBusy(true)
    const { error: err } = await supabase.rpc('set_group_sharing', {
      p_group: groupId,
      p_name: name,
      p_alias: name ? null : pseudo.trim().slice(0, 30),
      p_photos: photos,
      p_email: email,
      p_mood: mood,
    })
    setBusy(false)
    if (err) {
      setError(/alias_required/.test(err.message ?? '') ? t('share.alias_required') : errorText(err))
      return
    }
    await onSaved?.()
  }

  const rows = [
    ['name', name, setName, t('share.name'), profile?.display_name],
    ['photos', photos, setPhotos, t('share.photos'), t('share.photos_sub')],
    ['email', email, setEmail, t('share.email'), user?.email],
    ['mood', mood, setMood, t('share.mood'), t('share.mood_sub')],
  ]

  return (
    <form onSubmit={save} className="measure-form space-y-3" data-hook="share-choices">
      {rows.map(([key, on, set, label, sub]) => (
        <div key={key}>
          <label className="press flex cursor-pointer items-start gap-3 rounded-inner bg-ink/[0.035] p-4">
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
          {/* Le pseudo n'existe que quand le nom est garde. */}
          {key === 'name' && !name && (
            <div className="mt-2 rounded-inner bg-ink/[0.035] p-4">
              <label className="block text-small text-muted" htmlFor="share-alias">
                {t('share.alias_label')}
              </label>
              <input
                id="share-alias"
                className="field mt-2"
                value={pseudo}
                maxLength={30}
                onChange={(e) => {
                  setPseudo(e.target.value)
                  if (error) setError(null)
                }}
                placeholder={t('share.alias_ph')}
                data-hook="share-alias"
              />
            </div>
          )}
        </div>
      ))}

      {error && (
        <p className="text-small text-negative" role="alert" data-hook="share-error">
          {error}
        </p>
      )}

      <button className="btn-primary press mt-3" disabled={busy} data-hook="share-save">
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
  const { group, activeId, mySharing, members, reloadGroup } = useGroup()
  const { user } = useAuth()
  const { t } = useT()
  const [closed, setClosed] = useState(false)

  if (!group || mySharing !== null || closed) return null
  const me = members.find((m) => m.user_id === user?.id)

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
          alias={me?.alias}
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
