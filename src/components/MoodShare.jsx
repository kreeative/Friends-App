import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useGroup } from '../context/GroupContext'
import { useT } from '../lib/i18n'

/**
 * Qui voit mon humeur du jour.
 *
 *   "Humeur du jour, remove l'option qui demande de partager dans les groupes,
 *    bouge la plutot dans les parametres, comme ca chaque personne peut aller
 *    dans ses parametres et choisir avec quel groupe elle veut partager ses
 *    humeurs."
 *
 * CE QUE CA REMPLACE. Une case a cocher dans le formulaire de l'humeur, posee
 * chaque jour, et indivisible: "partager avec mes groupes" etait un seul oui
 * pour tous les groupes a la fois. Quelqu'un qui est dans le groupe de ses
 * amies ET dans celui de son cours n'avait aucun moyen de dire oui a l'une et
 * non a l'autre.
 *
 * ICI C'EST UNE LIGNE PAR GROUPE, ET LA REPONSE TIENT. La question ne revient
 * pas demain: c'est une preference, pas une etape.
 *
 * PAS DE LIGNE, PAS DE PARTAGE. L'absence est le non, donc rien a ecrire pour
 * rester prive et rien a nettoyer en quittant un groupe: la fonction de
 * lecture cote base verifie les deux appartenances a chaque fois.
 *
 * L'ETAT EST PEINT AVANT LA REPONSE DU RESEAU. Un interrupteur qui attend un
 * aller-retour pour bouger se lit comme un interrupteur casse, et celui-ci
 * porte une decision de confidentialite: il doit repondre tout de suite. Si
 * l'ecriture echoue, il revient ou il etait ET le dit, parce qu'un
 * interrupteur qui revient tout seul sans un mot est pire que pas
 * d'interrupteur du tout.
 */
export default function MoodShare() {
  const { user } = useAuth()
  const { groups } = useGroup()
  const { t } = useT()

  const [on, setOn] = useState(null) // null tant que la base n'a pas repondu
  const [busy, setBusy] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase.from('mood_share').select('group_id')
      if (cancelled) return
      /* Une table absente, c'est la migration 71 pas encore passee. On montre
         alors "personne", ce qui est vrai: sans la table, rien n'est partage. */
      if (error) return setOn(new Set())
      setOn(new Set((data ?? []).map((r) => String(r.group_id))))
    })()
    return () => { cancelled = true }
  }, [user?.id])

  async function toggle(groupId) {
    if (!user?.id || busy || !on) return
    const id = String(groupId)
    const avant = on
    const veut = !on.has(id)
    const suite = new Set(avant)
    if (veut) suite.add(id)
    else suite.delete(id)
    setOn(suite)
    setBusy(id)
    setFailed(false)

    try {
      if (veut) {
        const { error } = await supabase
          .from('mood_share')
          .upsert({ user_id: user.id, group_id: groupId }, { onConflict: 'user_id,group_id' })
        if (error) throw error
      } else {
        /**
         * COMPTE EXACT SUR LE DELETE.
         *
         * La RLS refuse un DELETE en SILENCE: zero ligne, aucune erreur. Sans
         * le compte, eteindre un groupe que la politique protege afficherait
         * "eteint" pendant que la ligne reste en base, donc le groupe
         * continuerait de voir l'humeur. C'est la seule erreur de ce fichier
         * qui se paierait en vie privee.
         */
        const { error, count } = await supabase
          .from('mood_share')
          .delete({ count: 'exact' })
          .eq('user_id', user.id)
          .eq('group_id', groupId)
        if (error) throw error
        if (!count) throw new Error('refuse')
      }
    } catch {
      setOn(avant)
      setFailed(true)
    } finally {
      setBusy('')
    }
  }

  if (!groups?.length) {
    return <p className="text-small text-muted" data-hook="moodshare-empty">{t('moodshare.empty')}</p>
  }

  return (
    <div data-hook="moodshare">
      <p className="reading text-small text-muted">{t('moodshare.help')}</p>

      <ul className="mt-4 space-y-2">
        {groups.map((g) => {
          const id = String(g.id)
          const actif = Boolean(on?.has(id))
          return (
            <li key={id}>
              <label className="press flex cursor-pointer items-center gap-3 rounded-inner py-1">
                <input
                  type="checkbox"
                  checked={actif}
                  disabled={on === null || busy === id}
                  onChange={() => toggle(g.id)}
                  data-hook="moodshare-toggle"
                  data-group={id}
                  className="h-5 w-5 shrink-0 accent-[rgb(var(--c-accent))] disabled:opacity-50"
                />
                <span className="min-w-0">
                  <span className="text-safe block text-body text-ink">{g.name}</span>
                  {/* L'etat en toutes lettres sous le nom. La coche seule est
                      une information portee par une forme et une couleur, et
                      1.4.1 demande qu'elle soit dite. */}
                  <span className="block text-small text-muted">
                    {actif ? t('moodshare.on') : t('moodshare.off')}
                  </span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      {failed && (
        <p className="mt-3 text-small font-semibold text-negative" role="alert" data-hook="moodshare-failed">
          {t('moodshare.failed')}
        </p>
      )}
    </div>
  )
}

/**
 * La meme liste, en une phrase, pour la carte de l'humeur.
 *
 * Elle ne demande rien: elle DIT ou va ce qui vient d'etre tape, et emmene aux
 * reglages pour en changer. C'est ce qui remplace la case a cocher, et c'est
 * volontairement une phrase et pas un controle: la decision est prise
 * ailleurs, une fois.
 */
export function useMoodAudience() {
  const { user } = useAuth()
  const { groups } = useGroup()
  const [ids, setIds] = useState(null)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase.from('mood_share').select('group_id')
      if (cancelled) return
      setIds(error ? new Set() : new Set((data ?? []).map((r) => String(r.group_id))))
    })()
    return () => { cancelled = true }
  }, [user?.id])

  if (ids === null) return null
  return (groups ?? []).filter((g) => ids.has(String(g.id))).map((g) => g.name)
}
