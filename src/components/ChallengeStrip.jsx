import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { CHALLENGE_DAYS } from '../content/challenge'
import { challengeDay, challengeTrack, completeMornings } from '../lib/challenge'

/**
 * "JOUR 3 SUR 21", EN HAUT DU TABLEAU D'UN GROUPE DEFI.
 *
 * Les 21 matins de la personne qui regarde, comptes depuis SON arrivee dans
 * le groupe (voir src/lib/challenge.js pour pourquoi ce n'est pas une date
 * commune). Une case par matin:
 *
 *   fait en entier   pleine, avec une coche
 *   fait en partie   un anneau, avec un point au centre
 *   manque           un trait
 *   aujourd'hui      un anneau epais
 *   a venir          un anneau pale
 *
 * La forme change avec l'etat, pas seulement la couleur (WCAG 1.4.1), et le
 * nombre de matins complets est ecrit en toutes lettres a cote.
 *
 * Lit les points du jour que le tableau a deja charges, filtres aux miens:
 * un tap sur "Marquer fait" fait avancer la case du jour en meme temps que
 * la carte, sans attendre un autre aller-retour.
 */
export default function ChallengeStrip({ group, goals, cycles, checkins, items }) {
  const { user } = useAuth()
  const { t } = useT()
  const [joinedAt, setJoinedAt] = useState(null)

  useEffect(() => {
    let dead = false
    ;(async () => {
      if (!group?.id || !user?.id) return
      const { data } = await supabase
        .from('group_members')
        .select('joined_at')
        .eq('group_id', group.id)
        .eq('user_id', user.id)
        .maybeSingle()
      if (!dead) setJoinedAt(data?.joined_at ?? null)
    })()
    return () => {
      dead = true
    }
  }, [group?.id, user?.id])

  if (!group?.challenge || !joinedAt) return null

  const tz = group.timezone || 'UTC'
  const now = new Date()
  const mine = checkins.filter((c) => c.user_id === user?.id)
  const goalIds = goals.filter((g) => g.kind === 'group' && g.status === 'active').map((g) => g.id)
  const track = challengeTrack({ joinedAt, now, tz, length: CHALLENGE_DAYS, cycles, checkins: mine, items, goalIds })
  const day = challengeDay({ joinedAt, now, tz })
  const finished = day > CHALLENGE_DAYS
  const complete = completeMornings(track)

  return (
    <section data-hook="challenge-strip" data-card="challenge" className="card mt-6 !p-4 sm:!p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-h2 font-semibold tracking-[-0.02em] text-ink">
          {finished ? t('challenge.finished') : t('challenge.day', { n: day, total: CHALLENGE_DAYS })}
        </p>
        <p className="text-small text-muted">{t('challenge.complete', { n: complete, total: CHALLENGE_DAYS })}</p>
      </div>
      <ol className="mt-4 grid max-w-[30rem] grid-cols-7 gap-2" aria-label={t('challenge.track_label')}>
        {track.map((d) => (
          <li key={d.n} data-day={d.n} data-state={d.state} title={t(`challenge.state_${d.state}`, { n: d.n })}>
            <Square state={d.state} />
            <span className="sr-only">{t(`challenge.state_${d.state}`, { n: d.n })}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Square({ state }) {
  const base = 'flex aspect-square w-full items-center justify-center rounded-pill'
  if (state === 'done') {
    return (
      <span aria-hidden="true" className={`${base} bg-accent`}>
        <svg viewBox="0 0 24 24" className="h-3/5 w-3/5 text-on-accent" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
    )
  }
  if (state === 'partial') {
    return (
      <span aria-hidden="true" className={`${base} border-[3px] border-accent`}>
        <span className="h-2 w-2 rounded-pill bg-accent" />
      </span>
    )
  }
  if (state === 'today') return <span aria-hidden="true" className={`${base} border-[3px] border-ink`} />
  if (state === 'missed') {
    return (
      <span aria-hidden="true" className={`${base} border-2 border-ink/45`}>
        <span className="h-0.5 w-2/5 rounded-pill bg-ink/45" />
      </span>
    )
  }
  return <span aria-hidden="true" className={`${base} border-2 border-dashed border-ink/45`} />
}
