import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from '../context/AuthContext'
import { dayKey } from './time'
import { prefOf, waterPlan } from './reminders'
import { glassesFor } from './water'

/**
 * Une minute du jour, aujourd'hui, dans le fuseau du navigateur.
 *
 * new Date(y, m, d, 0, min) et pas une arithmetique sur un timestamp: le
 * constructeur local traverse un changement d'heure correctement, alors
 * qu'ajouter des millisecondes a minuit rend 09:00 ou 11:00 selon le sens du
 * changement, deux dimanches par an.
 */
export function atLocalMinute(min, now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, min, 0, 0)
}

/**
 * L'eau d'aujourd'hui: les reglages, ce qui a ete bu, et les deux gestes.
 *
 * POURQUOI CECI EST UN HOOK PLUTOT QUE DU CODE DANS L'ECRAN DES REGLAGES.
 *
 * Demande: "ajouter une petite option sur l'ecran home pour rentrer
 * rapidement les verres d'eau qu'on a bu [...] c'est accessible seulement
 * dans les reglages et c'est trop long d'aller jusque la pour acceder a ca".
 *
 * Le bouton doit donc exister a deux endroits. Deux copies de "insere une
 * ligne, recalcule le prochain rappel, reecris water_next_at" derivent: on en
 * corrige une, l'autre continue de decaler les rappels de travers, et rien ne
 * le signale parce que les deux ecrans ont l'air de marcher. Une seule
 * implementation, deux vues.
 *
 * water_next_at est ecrit ICI, par le client, pour la raison notee dans la
 * migration 57: le calcul de l'intervalle vit dans src/lib/water.js et une
 * deuxieme implementation en SQL finirait par ne plus etre d'accord avec
 * celle-la. La fonction planifiee ne fait que comparer un timestamp.
 */
export function useWaterToday() {
  const { user } = useAuth()

  const [row, setRow] = useState(null)
  const [drunk, setDrunk] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  /* Vrai quand 57_reminders.sql n'a pas encore ete passe. Un ecran qui rend
     une trace d'erreur Postgres a quelqu'un qui voulait regler ses
     notifications ne l'aide pas. */
  const [pending, setPending] = useState(false)

  const today = dayKey(new Date())

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    const [{ data: pref, error: e1 }, { data: logs }] = await Promise.all([
      supabase.from('notify_pref').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('water_log').select('ml').eq('user_id', user.id).eq('on_day', today),
    ])
    /* 42P01: la table n'existe pas. C'est la migration, pas une panne. */
    if (e1?.code === '42P01') setPending(true)
    else if (e1) setError(e1.message)
    setRow(pref ?? null)
    setDrunk((logs ?? []).reduce((n, l) => n + (l.ml ?? 0), 0))
    setLoading(false)
  }, [user?.id, today])

  useEffect(() => {
    load()
  }, [load])

  const pref = useMemo(() => prefOf(row), [row])
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()

  /**
   * L'ETAT REEL D'AUJOURD'HUI, ET LE RYTHME D'UNE JOURNEE ORDINAIRE. DEUX
   * CHOSES.
   *
   * Ecrit d'abord avec un seul plan, celui de maintenant, pour les deux
   * usages. Mesure dans Chromium a 20h29: la phrase sous le curseur annoncait
   * "environ un toutes les 30 min" pour une cible de 2 litres. Le calcul etait
   * juste, c'est la phrase qui mentait: il restait 151 minutes de journee et
   * huit verres a boire, donc le plancher. Mais lue sous un curseur de
   * reglage, elle dit "ton reglage est toutes les 30 minutes", ce qui est
   * exactement le chiffre que ce calcul existe pour ne pas produire.
   *
   * Donc deux plans. `typical` part du reveil avec rien de bu: c'est le rythme
   * d'une journee ordinaire. `plan` est l'etat reel et sert au reste.
   */
  const typical = useMemo(
    () => waterPlan(row, { drunkMl: 0, nowMin: prefOf(row).wake_min }),
    [row],
  )
  const plan = useMemo(() => waterPlan(row, { drunkMl: drunk, nowMin }), [row, drunk, nowMin])

  const nextAtFor = (p, next) =>
    next.water_on && p.nextMin !== null ? atLocalMinute(p.nextMin).toISOString() : null

  async function save(patch) {
    const next = { ...pref, ...patch }
    const p = waterPlan(next, { drunkMl: drunk, nowMin })
    const water_next_at = nextAtFor(p, next)

    setRow({ ...next, water_next_at })
    const { error: err } = await supabase
      .from('notify_pref')
      .upsert({ user_id: user.id, ...next, water_next_at }, { onConflict: 'user_id' })
    if (err) {
      setError(err.message)
      /* Remettre ce que la base a vraiment, plutot que de laisser l'ecran
         montrer un reglage qui n'a pas ete enregistre. */
      load()
    }
  }

  /**
   * Noter ce qu'on vient de boire.
   *
   * PREND UNE QUANTITE, PARCE QUE PERSONNE NE BOIT PAR PORTIONS EGALES.
   *
   * "J'ai une bouteille d'eau qui fait 40 oz [...] j'ai ouvert ma calculatrice
   * et j'ai fait le calcul de ma cible moins l'eau que je bois dans ma
   * bouteille."
   *
   * Le bouton envoyait toujours exactement une contenance. C'est juste pour
   * quelqu'un qui vide un verre d'un coup, et faux pour quelqu'un qui boit AU
   * FIL de la journee dans une bouteille de 40 oz: pour noter trois gorgees il
   * fallait soit mentir, soit faire la soustraction ailleurs. D'ou la
   * calculatrice.
   *
   * Sans argument, c'est une contenance, donc le geste d'avant n'a pas change
   * pour qui buvait deja par verres.
   */
  async function drink(ml = pref.water_glass_ml) {
    /* Les parametres par defaut ne se declenchent que sur undefined: un appel
       venu d'un onClick recoit l'evenement en argument, et `null` passerait
       tout droit. Les deux sont ramenes ici plutot que chez l'appelant. */
    const amount = Math.round(Number(ml) > 0 ? Number(ml) : pref.water_glass_ml)

    setDrunk((n) => n + amount)
    const { error: err } = await supabase
      .from('water_log')
      .insert({ user_id: user.id, on_day: today, ml: amount })
    if (err) return setError(err.message)
    /* Ce qui vient d'etre bu change le plan: on reecrit le prochain rappel
       tout de suite. C'est la partie qui rattrape, et elle ne marche que si
       elle part du nouveau total. */
    const p = waterPlan(pref, { drunkMl: drunk + amount, nowMin })
    await supabase
      .from('notify_pref')
      .upsert({ user_id: user.id, ...pref, water_next_at: nextAtFor(p, pref) }, { onConflict: 'user_id' })
    return undefined
  }

  async function undo() {
    /* La derniere quantite notee, pas n'importe laquelle. Une ligne par geste
       existe precisement pour ca: un compteur ne se defait pas, et appuyer
       deux fois par accident laisserait la journee fausse sans rien a faire.
       Defaire une gorgee de 200 ml doit retirer 200 ml, pas une contenance. */
    const { data } = await supabase
      .from('water_log')
      .select('id, ml')
      .eq('user_id', user.id)
      .eq('on_day', today)
      .order('at', { ascending: false })
      .limit(1)
    const last = data?.[0]
    if (!last) return
    /* count: 'exact'. RLS refuse un DELETE en silence, zero ligne et pas
       d'erreur, et sans le compte l'ecran afficherait un retrait qui n'a pas
       eu lieu. */
    const { count } = await supabase.from('water_log').delete({ count: 'exact' }).eq('id', last.id)
    if (count) setDrunk((n) => Math.max(0, n - last.ml))
  }

  const glasses = glassesFor(pref.water_target_ml, pref.water_glass_ml)

  return {
    loading,
    pending,
    error,
    setError,
    row,
    pref,
    drunk,
    glasses,
    /* Combien de contenances, arrondi comme les pastilles l'affichent. Ce
       n'est plus le chiffre principal: l'ecran dit une QUANTITE, parce qu'une
       personne qui boit dans une bouteille de 40 oz ne compte pas en
       bouteilles. Garde pour les pastilles et pour l'ancien libelle. */
    done: Math.round(drunk / pref.water_glass_ml),
    plan,
    typical,
    nowMin,
    save,
    drink,
    undo,
    reload: load,
  }
}
