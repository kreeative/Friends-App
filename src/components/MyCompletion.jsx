import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { DEFAULT_PERIOD, memberRates } from '../lib/completion'
import { useT } from '../lib/i18n'
import PeriodBar from './PeriodBar'
import { Hint } from './ui'

/**
 * The same question the group table answers, asked about one person.
 *
 * The dashboard and the account screen carried the two saturated panels: a
 * dark card of fourteen status dots and a twelve-point curve beside it. On a
 * young account they filled most of the screen with a wall of the brand
 * colour to report "-%" and "no cycles", which is a great deal of ink spent
 * on the absence of data, and it is most of what "the Toi menu has a pink
 * background" was.
 *
 * This replaces both with one figure over a window you pick, computed by the
 * same lib the group table uses so the two screens cannot come to disagree
 * about what a percentage means.
 *
 * WHY IT DOES ITS OWN FETCHING.
 *
 * GroupContext holds one group at a time, and this number is about the person
 * across all of them. Two queries, once, reaching back as far as the oldest
 * goal, and then every period is computed from what is already in memory:
 * switching from all-time to today does not touch the network.
 *
 * Solo goals are deliberately not counted. A goal with no group has no cycles
 * to be checked in against, so it can only ever sit in the denominator and
 * never in the numerator, and a number that falls every time you add a goal
 * you cannot record against is worse than no number.
 */
export default function MyCompletion() {
  const { user, profile } = useAuth()
  const { t } = useT()
  const [period, setPeriod] = useState(DEFAULT_PERIOD)
  const [data, setData] = useState(null)

  useEffect(() => {
    if (!user) return
    let dead = false

    ;(async () => {
      try {
        /* Every goal in every group I am in that is either mine or the whole
           group's. RLS already limits this to my groups, so there is no group
           id to pass and nothing here can reach somebody else's. */
        const g = await supabase
          .from('goals')
          .select('*')
          .not('group_id', 'is', null)
          .or(`owner_id.eq.${user.id},kind.eq.group`)

        if (dead) return
        const goals = g.data ?? []

        /**
         * The check-ins go back exactly as far as the goals do.
         *
         * Deliberately sequential rather than a parallel pair, which is one
         * extra round trip and buys the thing that matters: "all time" means
         * all of it. Fetching a fixed six months in parallel would have made
         * ALL a second copy of 6M on any account older than that, and pulling
         * everything unbounded grows without limit on an account that keeps
         * going. The oldest goal is the real floor, because a day before the
         * first goal existed is a day nothing was scheduled on.
         */
        const born = goals
          .map((x) => x.created_at)
          .filter(Boolean)
          .sort()[0]

        let q = supabase
          .from('checkins')
          .select('id, cycle_id, submitted_at, cycles(opens_at), checkin_items(goal_id, outcome, count_done)')
          .eq('user_id', user.id)
        if (born) q = q.gte('submitted_at', born)

        const c = await q
        if (dead) return

        const rows = c.data ?? []
        setData({
          goals,
          /* Anchored on the cycle the check-in was filed against, not on when
             it was typed. Something recorded at ten past midnight belongs to
             the day it was about. submitted_at is the fallback for a row whose
             cycle has since been deleted. */
          cycles: rows.map((r) => ({
            id: r.cycle_id,
            opens_at: r.cycles?.opens_at ?? r.submitted_at,
          })),
          checkins: rows.map((r) => ({ id: r.id, cycle_id: r.cycle_id, user_id: user.id })),
          items: rows.flatMap((r) =>
            (r.checkin_items ?? []).map((i) => ({ ...i, checkin_id: r.id })),
          ),
        })
      } catch {
        /* Offline. The card says it has nothing rather than showing a zero. */
        if (!dead) setData({ goals: [], cycles: [], checkins: [], items: [] })
      }
    })()

    return () => {
      dead = true
    }
  }, [user?.id])

  const me = useMemo(
    () =>
      memberRates({
        members: [{ user_id: user?.id, profile }],
        goals: data?.goals ?? [],
        cycles: data?.cycles ?? [],
        checkins: data?.checkins ?? [],
        items: data?.items ?? [],
        period,
      })[0],
    [data, period, user?.id, profile],
  )

  const has = me?.pct !== null && me?.pct !== undefined

  return (
    /**
     * `relative`, et c'est l'ancre du panneau de l'infobulle.
     *
     * Hint est volontairement non positionne: son panneau se cale sur la boite
     * de contenu qui le contient, ici la carte. left-0 right-0 contre la carte
     * veut dire qu'il ne peut sortir de l'ecran ni d'un cote ni de l'autre,
     * dans les deux langues, a toutes les largeurs. La note sur Hint raconte
     * ce que l'ancrage sur le point d'interrogation lui-meme avait coute:
     * "Nobody else can see the", coupe en plein mot sur un telephone.
     */
    <div className="lg relative p-5 sm:p-6">
      {/**
       * LE TITRE DE SECTION EST ENTRE DANS LA CARTE, ET LA PHRASE EST PASSEE
       * DERRIERE UN POINT D'INTERROGATION.
       *
       * Demande telle quelle: "move the section title to sit inline next to
       * CE QUI A ETE FAIT or replace it with a small info icon; remove the
       * long paragraph block at the bottom; keep the card compact, focusing
       * strictly on the percentage, the progress bar and the count".
       *
       * Il y avait deux etiquettes empilees pour une seule carte, "TOI, TOUS
       * GROUPES CONFONDUS" au-dessus et "CE QUI A ETE FAIT" dedans, puis trois
       * lignes de methodologie sous le chiffre. Sur un tableau de bord, la
       * methodologie est ce qu'on lit une fois et qu'on relit jamais: elle
       * n'est pas supprimee, elle est rangee. Le "tous groupes confondus" est
       * entre dans la phrase de l'infobulle, ou il est une precision utile
       * plutot qu'un titre de plus.
       *
       * Le panneau s'ouvre au clic et pas au survol: c'est un <details>, donc
       * ca marche au doigt, au clavier et au lecteur d'ecran sans une ligne de
       * JavaScript, et un survol ne veut rien dire sur l'appareil ou cette
       * application est utilisee.
       */}
      {/**
       * LE POINT D'INTERROGATION EST A COTE DU SUR-TITRE, PAS DEDANS.
       *
       * Ecrit d'abord dans le <span className="eyebrow">. La sonde passait:
       * le panneau s'ouvrait, tenait 17:1, ne sortait pas de l'ecran. La
       * capture, elle, montrait une colonne de texte EN MAJUSCULES, large de
       * six mots, posee en travers de la barre de periodes. Deux raisons, et
       * les deux viennent du parent: .eyebrow met text-transform: uppercase
       * et letter-spacing, dont le panneau heritait; et Hint s'ancre sur la
       * boite qui le contient, donc sur un span aussi large que trois mots.
       *
       * C'est la regle du depot en entier: regarder la capture, ne pas
       * raisonner sur ce que le CSS devrait produire.
       *
       * Une ligne flex a la largeur de la carte: le sur-titre garde son style
       * et ne le prete a personne, et le panneau s'ancre sur la carte.
       */}
      {/**
       * `!z-30`, ET C'EST LE SEUL ENDROIT OU CE `!` EST LE BON OUTIL.
       *
       * Deuxieme capture: le panneau ouvert, avec la pastille "1S" de la barre
       * de periodes et le "14 %" peints PAR-DESSUS la phrase. Ce n'est pas une
       * question de transparence, c'est l'ordre d'empilement.
       *
       * `.lg > *` pose `relative z-[2]` sur chaque enfant direct de la carte:
       * cette ligne d'en-tete et la barre de periodes ont donc le meme
       * z-index, et entre egaux c'est l'ordre du DOM qui gagne, donc la barre.
       * Le `z-30` du panneau ne sert a rien: il ne le classe qu'a l'interieur
       * du contexte d'empilement cree par son propre parent.
       *
       * Une utilitaire `z-30` nue ne suffit pas non plus: `.lg > *` vaut 0,1,1
       * et la battrait. Le `!` est la pour depasser une regle de composant, ce
       * qui est exactement le cas que la note de .lg-modal decrit deja
       * ailleurs dans index.css.
       */}
      <div className="relative !z-30 flex items-center gap-1" data-hook="analytics-title">
        <span className="eyebrow">{t('analytics.title')}</span>
        <Hint text={t('analytics.note_mine')} />
      </div>

      <div className="mt-4">
        <PeriodBar value={period} onChange={setPeriod} />
      </div>

      <div className="mt-6 flex items-baseline gap-1">
        {/* A dash, not a zero. Nothing scheduled in the window is not a
            measured failure, and a big 0% is the app telling somebody they
            failed at something it never asked them to do. */}
        <span className="font-display text-[3.25rem] font-bold leading-none tracking-[-0.03em] text-ink [font-variant-numeric:tabular-nums]">
          {has ? me.pct : '-'}
        </span>
        <span className="font-display text-h1 font-bold leading-none text-accent">%</span>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-pill bg-ink/[0.07]">
        <div
          className="h-full rounded-pill bg-accent transition-[width] duration-500 ease-out"
          style={{ width: `${has ? me.pct : 0}%` }}
        />
      </div>

      <p className="mt-3 text-small text-muted [font-variant-numeric:tabular-nums]">
        {has
          ? t('analytics.of_scheduled', { done: me.done, total: me.target })
          : t('analytics.nothing_yet')}
      </p>
    </div>
  )
}
