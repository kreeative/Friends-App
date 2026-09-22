import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { errorText, isMissingTable } from '../lib/dberr'

/**
 * Couper les notifications d'UN groupe.
 *
 *   "Add an option to desactive notification for specific group."
 *
 * POURQUOI ICI ET PAS DANS LES REGLAGES DU COMPTE.
 *
 * Le reglage porte sur CE groupe-la, et l'ecran des reglages de ce groupe est
 * l'endroit ou on arrive quand c'est lui qui fatigue. La variante "une liste de
 * tous mes groupes avec une case chacun" vit ailleurs dans beaucoup de
 * produits; elle demande d'aller a un endroit qui ne parle d'aucun groupe en
 * particulier pour en trouver un dans une liste, et elle double l'etat a tenir
 * d'accord. Un seul endroit, celui ou la personne est deja.
 *
 * COCHEE VEUT DIRE "JE VEUX LES RECEVOIR", ET C'EST L'ABSENCE DE LIGNE.
 *
 * La table est `group_mute`: une ligne veut dire coupe. La case dit l'inverse
 * de la ligne, parce qu'une case a cocher intitulee "Couper les notifications"
 * cochee pour dire que tout va bien est une double negation, et on se trompe
 * dessus une fois sur deux. Ce qui est coche est ce qui arrive.
 *
 * LE COMPTE SUR LE DELETE N'EST PAS DECORATIF.
 *
 * RLS refuse un DELETE en silence: zero ligne, aucune erreur. Sans
 * `{ count: 'exact' }`, rallumer un groupe aurait l'air d'avoir marche et la
 * case reviendrait decochee au prochain chargement, ce qui est la pire forme
 * de panne: celle qu'on ne voit que plus tard.
 *
 * CE QUE LA PHRASE SOUS LA CASE PROMET, ET RIEN DE PLUS.
 *
 * Couper arrete le telephone et les courriels de ce groupe. La cloche dans
 * l'application continue d'etre remplie, et le dire est le seul moyen que
 * "coupe" reste vrai: quelqu'un qui trouve trois lignes dans sa cloche apres
 * avoir coupe un groupe conclurait que le reglage ne marche pas, alors qu'il
 * fait exactement ce qu'il annonce.
 */
export default function GroupNotifyToggle({ groupId }) {
  const { user } = useAuth()
  const { t } = useT()

  /* null tant qu'on ne sait pas. Partir de `true` ferait clignoter la case en
     "allume" une fraction de seconde chez quelqu'un qui a coupe, ce qui est un
     mensonge court mais un mensonge. */
  const [on, setOn] = useState(null)
  const [busy, setBusy] = useState(false)
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let dead = false
    const run = async () => {
      if (!user?.id || !groupId) return
      const { data, error: err } = await supabase
        .from('group_mute')
        .select('group_id')
        .eq('user_id', user.id)
        .eq('group_id', groupId)
        .maybeSingle()
      if (dead) return
      if (err && isMissingTable(err)) {
        setMissing(true)
        return
      }
      /* PGRST116 est "aucune ligne", ce qui est la reponse normale et non une
         erreur: personne n'a de ligne ici tant qu'il n'a rien coupe. */
      if (err && err.code !== 'PGRST116') setError(errorText(err))
      setOn(!data)
    }
    run()
    return () => {
      dead = true
    }
  }, [user?.id, groupId])

  async function change(next) {
    if (!user?.id || !groupId || busy) return
    setBusy(true)
    setError(null)

    /* Optimiste, puis remis en place si la base refuse. Une case qui attend le
       serveur avant de bouger se fait appuyer deux fois. */
    const before = on
    setOn(next)

    if (next) {
      const { error: err, count } = await supabase
        .from('group_mute')
        .delete({ count: 'exact' })
        .eq('user_id', user.id)
        .eq('group_id', groupId)
      if (err || count === 0) {
        setOn(before)
        setError(err ? errorText(err) : t('gnotif.failed'))
      }
    } else {
      /* upsert et pas insert: appuyer deux fois de suite sur une case n'est pas
         une erreur a montrer, et la cle primaire est (user_id, group_id) donc
         un doublon serait une violation de contrainte a l'ecran. */
      const { error: err } = await supabase
        .from('group_mute')
        .upsert({ user_id: user.id, group_id: groupId }, { onConflict: 'user_id,group_id' })
      if (err) {
        setOn(before)
        setError(isMissingTable(err) ? t('gnotif.absent') : errorText(err))
        if (isMissingTable(err)) setMissing(true)
      }
    }

    setBusy(false)
  }

  /* La migration n'a pas ete passee. Le dire plutot que de montrer une case qui
     ne peut rien enregistrer: un commutateur qui ne commute rien apprend a
     quelqu'un que ses reglages ne comptent pas. */
  if (missing) {
    return (
      <p className="text-small text-muted" data-hook="group-notify-absent">
        {t('gnotif.absent')}
      </p>
    )
  }

  return (
    <div data-hook="group-notify">
      <label className="press flex cursor-pointer items-start gap-3 rounded-inner bg-ink/[0.035] p-4">
        <input
          type="checkbox"
          checked={on === true}
          disabled={on === null || busy}
          onChange={(e) => change(e.target.checked)}
          data-hook="group-notify-box"
          className="mt-0.5 h-5 w-5 shrink-0 accent-[rgb(var(--c-accent))]"
        />
        <span>
          <span className="block text-body text-ink" data-hook="group-notify-label">
            {t('gnotif.label')}
          </span>
          {/**
           * UNE PHRASE, ET SEULEMENT QUAND C'EST COUPE.
           *
           *   "The button for notification is hella too long and too
           *    detailed."
           *
           * L'etat allume portait l'enumeration des quatre messages du groupe:
           * mesure a 390px, quatre lignes et 124 caracteres sous une case qui
           * dit deja ce qu'elle fait. Le libelle est la phrase; la liste etait
           * un mode d'emploi pour un interrupteur.
           *
           * Coupe garde la sienne, parce qu'elle porte le seul fait qui
           * manquerait: la cloche continue de se remplir. Sans elle, trois
           * lignes non lues apres avoir coupe se lisent comme un reglage rate.
           * Mais coupee a l'os: 41 caracteres au lieu de 164.
           */}
          {on === false && (
            <span className="mt-1 block text-small text-muted" data-hook="group-notify-help">
              {t('gnotif.off_help')}
            </span>
          )}
        </span>
      </label>
      {error && (
        <p className="mt-3 text-small text-negative" role="alert" data-hook="group-notify-error">
          {error}
        </p>
      )}
    </div>
  )
}
