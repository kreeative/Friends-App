import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { localeTag, useT } from '../lib/i18n'
import { addDays, dayKey, daysBetween, phaseOn } from '../lib/cycle'
import { reconcile, selectedFrom } from '../lib/periodPick'
import { cycleOn } from '../lib/setup'
import {
  CATEGORIES,
  CATEGORY_COLOUR,
  LAYERS,
  LAYER_COLOUR,
  agendaFor,
  birthdayEntries,
  blockStyle,
  clockOf,
  dayBounds,
  minutesOf,
  visibleEvents,
  weekdayName,
} from '../lib/agenda'
import CyclePanel from '../components/CyclePanel'
import TimetableWizard from '../components/TimetableWizard'

/**
 * The whole timetable, on one screen.
 *
 * WHY THREE VIEWS AND NOT ONE.
 *
 * They answer different questions and none of them answers the other two.
 * Month is "when is the exam"; week is "what does Tuesday look like against
 * Thursday", which is the one a timetable is actually for; day is "what is
 * next", which is the only one that works at 360px with six overlapping
 * things on it.
 *
 * The dashboard's WeekStrip is not replaced by any of this. It is a glance at
 * the current week inside a page about something else, and it stays.
 *
 * WHY THE CYCLE OVERLAY IS TINTS ON TILES AND NOT ROWS IN THE GRID.
 *
 * A period is not an appointment. It has no start time, it is frequently a
 * prediction rather than a fact, and putting it in the same column as a
 * lecture would say it is the same kind of thing. It also has to be possible
 * to look at this screen in a lecture theatre without the person beside you
 * learning something. So it is a small mark in the corner of a date, and the
 * words are behind a tap.
 */

/**
 * The palette tokens an event may paint in.
 *
 * THESE ARE THE ONES THAT EXIST, WHICH IS NOT WHAT THE FIRST VERSION USED.
 *
 * It reached for `bg-blue`, `bg-violet` and `bg-yellow`. None of those is a
 * token in this project: tailwind.config.js builds every colour as
 * var(--c-<name>), so an invented name resolves to nothing and paints
 * transparent. The chips looked plausible in a screenshot and a probe that
 * sampled painted pixels found them at 1:1 against the tile behind them.
 *
 * cat-1 to cat-6 are the envelope shades. They are one ramp per theme rather
 * than six independent hues, which is the thing that made the sea theme hard:
 * see agenda.js for why only three of the six steps are spent. Migration 53
 * lets an event store all six, plus ink, negative and the three named tokens.
 *
 * THE CHIP IS THE ORIGINAL CHIP AGAIN. THE COLOURS ARE THE NEW COLOURS.
 *
 * These grew a 3px left rule at full strength for one round, on the argument
 * that a wash at 18 per cent cannot carry a category. The rule was rejected on
 * sight and the shape of the chip was asked back exactly as it was, so it is
 * back: same wash, same ring, same padding, same corners, no edge.
 *
 * THE ARGUMENT FOR THE RULE WAS ABOUT THE OLD PALETTE, AND IT NO LONGER
 * APPLIES, WHICH IS WHY REMOVING IT COSTS NOTHING.
 *
 * The measurement behind it was cat-1 at #FFE5F1 against cat-3 at #FFE7E4,
 * fourteen units apart in one channel. Both of those were magenta, because the
 * old mapping spent accent, cat-1 and cat-2 on three colours inside fifteen
 * degrees of hue. No wash of three magentas is ever going to read as three
 * things, and the rule was compensating for a mapping rather than for an
 * opacity.
 *
 * agenda.js fixed the mapping, and most of what the rule was doing came back
 * for free. The wash goes 0.18 to 0.24, which is the same soft pill and not a
 * new shape: this table has always carried a different alpha per token, and
 * yellow needs 0.62 to register at all while grey needs 0.06 to stay quiet.
 *
 * MEASURED WITH THE RULE GONE, CIE76 on the composited fills, closest pair:
 *
 *   sun   14.6   perso / sante
 *   sea    5.4   cours / etude
 *
 * SUN IS FINE AND SEA IS NOT, AND PRETENDING OTHERWISE WOULD BE THE EASY LIE
 * HERE.
 *
 * Under about 10 two colours read as one. In sun every pair clears it. In sea
 * they do not, and no amount of styling fixes it: that theme's whole ramp is
 * one blue gradient, so cours and etude are both blue whichever steps they
 * take, and a wash of 0.46 is where they finally separate. That is a heavy
 * tint, well past the chip anybody asked for.
 *
 * So this is the best a plain wash does, and the residue is one pair in the
 * theme that is not the default. The fix if it is ever wanted is a small
 * full-strength dot inside the chip, the same device the category pills in the
 * event form already use: full-strength colour, no change to the chip's
 * padding, corners or height. It is not here because it was not asked for.
 *
 * Whole class strings, because Tailwind scans source text and `bg-cat-${n}`
 * produces no class at build time.
 */
const SWATCH = {
  /**
   * LES SEPT, OPAQUES, ET PLUS UN LAVIS PAR CATEGORIE.
   *
   * Ce qui suit dans l'ancienne table etait trois alphas differents regles a
   * la main: 0,62 pour le jaune parce qu'un quart de jaune sur blanc est
   * encore blanc, 0,30 pour le noir parce qu'a 0,12 un examen et une entree de
   * sante etaient deux gris a 5,0 l'un de l'autre, 0,24 pour le reste. Trois
   * reglages pour un seul rang de pastilles, et chacun avait sa note.
   *
   * Un pastel est deja clair. Pose tel quel il donne la meme couleur partout,
   * sans dependre de ce qu'il y a dessous, et l'encre par-dessus se mesure une
   * fois pour toutes au lieu d'une fois par alpha.
   *
   * L'anneau est la version foncee de la meme couleur: c'est ce qui donne un
   * bord a une pastille claire posee sur une case blanche, et il tient 3:1.
   */
  'ev-cours': 'bg-ev-cours text-ink ring-ev-cours-deep/40',
  'ev-examen': 'bg-ev-examen text-ink ring-ev-examen-deep/40',
  'ev-etude': 'bg-ev-etude text-ink ring-ev-etude-deep/40',
  'ev-travail': 'bg-ev-travail text-ink ring-ev-travail-deep/40',
  'ev-evenement': 'bg-ev-evenement text-ink ring-ev-evenement-deep/40',
  'ev-perso': 'bg-ev-perso text-ink ring-ev-perso-deep/40',
  'ev-sante': 'bg-ev-sante text-ink ring-ev-sante-deep/40',
  'ev-anniv': 'bg-ev-anniv text-ink ring-ev-anniv-deep/40',

  /* LES ANCIENS NOMS RESTENT, ET C'EST LA RAISON POUR LAQUELLE LA MIGRATION
     N'EST PAS URGENTE. `colour` est une colonne, donc une ligne ecrite avant
     la migration 70 porte encore 'field' ou 'ink'. Sans ces entrees-la elle
     se peindrait transparente, ce qui est exactement la faute que la note de
     CATEGORY_COLOUR dans agenda.js raconte: une pastille plausible sur une
     capture, mesuree a 1:1 contre la case derriere elle. */
  'cat-1': 'bg-cat-1/[0.24] text-ink ring-cat-1/40',
  'cat-2': 'bg-cat-2/[0.24] text-ink ring-cat-2/40',
  'cat-3': 'bg-cat-3/[0.24] text-ink ring-cat-3/40',
  'cat-4': 'bg-cat-4/[0.24] text-ink ring-cat-4/40',
  'cat-5': 'bg-cat-5/[0.24] text-ink ring-cat-5/40',
  'cat-6': 'bg-cat-6/[0.24] text-ink ring-cat-6/40',
  accent: 'bg-accent/[0.24] text-ink ring-accent/30',
  green: 'bg-green/[0.24] text-ink ring-green/30',
  field: 'bg-field/[0.62] text-ink ring-field-deep/50',
  ink: 'bg-ink/[0.30] text-ink ring-ink/35',
  negative: 'bg-negative/[0.24] text-ink ring-negative/35',
  quiet: 'bg-ink/[0.06] text-ink ring-ink/15',
}

/* The bar down the left of a row in the day list, which needs the colour at
   full strength rather than as a wash. Same reason the palette has
   `field-deep` alongside `field`: a 4px rule cannot be a tint. */
const SWATCH_BAR = {
  /* La version foncee des sept, parce qu'un filet de 4px et une pastille de
     8px portent de l'information et doivent tenir 3:1 (1.4.11). Un pastel a
     90 de clarte fait 1,3:1 sur blanc; c'est une couleur de fond, pas une
     couleur de marque. */
  'ev-cours': 'bg-ev-cours-deep',
  'ev-examen': 'bg-ev-examen-deep',
  'ev-etude': 'bg-ev-etude-deep',
  'ev-travail': 'bg-ev-travail-deep',
  'ev-evenement': 'bg-ev-evenement-deep',
  'ev-perso': 'bg-ev-perso-deep',
  'ev-sante': 'bg-ev-sante-deep',
  'ev-anniv': 'bg-ev-anniv-deep',

  /* Les anciens noms, pour les lignes ecrites avant la migration 70. */
  'cat-1': 'bg-cat-1', 'cat-2': 'bg-cat-2', 'cat-3': 'bg-cat-3',
  'cat-4': 'bg-cat-4', 'cat-5': 'bg-cat-5', 'cat-6': 'bg-cat-6',
  accent: 'bg-accent', green: 'bg-green', ink: 'bg-ink',
  field: 'bg-field-deep', negative: 'bg-negative', quiet: 'bg-ink/30',
}

/**
 * The cycle marks. A dot, not a fill: a tinted tile competes with the event
 * blocks on it, and this has to be readable without being announced.
 *
 * SOLID, AND NOT ONLY A COLOUR.
 *
 * The first version drew these at 45 to 60 per cent opacity, which put a 6px
 * graphic well under the 3:1 that WCAG 1.4.11 asks of anything carrying
 * meaning. Worse, the four states differed by hue alone, which 1.4.1 forbids
 * outright and which is useless to the roughly one person in twelve who
 * cannot separate these particular hues.
 *
 * TWO COLOURS AND TWO SHAPES, NOT FOUR HUES.
 *
 * The second attempt used cat-3 and cat-5 for the soft phases. Measured on the
 * painted pixels, cat-5 came out at 1.83:1 against the sun theme's white, well
 * under the 3:1 that 1.4.11 asks. tailwind.config.js already answers this: it
 * declares `mark` as "the one colour a small mark may be" and says explicitly
 * that there is one of these and not six.
 *
 * So there are two colours, both of which carry at that size, and the pairs
 * within each are told apart by SHAPE: a fact is filled, an estimate is a
 * ring. Four states, no hue doing work on its own, which is what 1.4.1 asks
 * and what survives a greyscale screenshot. The accessible name on every tile
 * carries the whole answer regardless.
 */
const PHASE_DOT = {
  period: 'bg-negative',
  predicted: 'border-2 border-negative bg-transparent',
  pms: 'bg-mark',
  fertile: 'border-2 border-mark bg-transparent',
}

/* The layer toggle's dot, filled when the layer is on and a ring when it is
   off. Whole class strings, because Tailwind scans source text and
   `bg-${token}` produces no class at build time. */
const LAYER_DOT = {
  scolaire: 'bg-cat-1',
  perso: 'bg-green',
  objectifs: 'bg-cat-3',
  /* La version foncee: une pastille de 10px porte de l'information, donc 3:1
     (1.4.11), et le pastel est une couleur de fond. */
  anniversaires: 'bg-ev-anniv-deep',
  cycle: 'bg-negative',
}
const LAYER_RING = {
  scolaire: 'border-cat-1',
  perso: 'border-green',
  objectifs: 'border-cat-3',
  anniversaires: 'border-ev-anniv-deep',
  cycle: 'border-negative',
}

const VIEWS = ['month', 'week', 'day']

/* A character no event title can contain, used to find where the title went in
   a translated sentence. U+0000 rather than something typeable: a title with a
   "|" or a "@" in it is ordinary and would split the sentence in the wrong
   place. See ScopeChoice for why this is a split and not three strings. */
const SPLIT = '\u0000'

/* Which layers are switched OFF, remembered per browser. Off rather than on,
   so a layer added by a later version is visible by default: somebody who has
   never opened this toolbar should not have new things silently hidden from
   them by a stored list that predates the feature. */
const HIDDEN_KEY = 'friends.cal.hidden'

const readHidden = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]')
    return new Set(Array.isArray(raw) ? raw.filter((l) => LAYERS.includes(l)) : [])
  } catch {
    return new Set()
  }
}

export default function Calendar() {
  const { user, profile } = useAuth()
  const { t, locale } = useT()

  /**
   * Whether this calendar has a cycle in it at all.
   *
   * Three things follow from it and all three are needed. The layer chip is not
   * offered, so the row of toggles has three entries rather than a fourth that
   * governs nothing. The drawer button is gone, so there is no way in. And
   * CyclePanel is not mounted, which is what actually stops the reading: it is
   * the component that fetches cycle_log, so leaving it out means a man's
   * period history is never queried rather than queried and then hidden.
   */
  const periodTracking = cycleOn(profile)

  /**
   * Enregistrer ce qui a ete coche sur le mois.
   *
   *   "Look the way you can just coche the case number on flo. Our app doesn't
   *    show the day as little round and I don't want it too, so adapt to the
   *    full month view only."
   *
   * Avant, ce bouton ouvrait un champ date: une regle de trois jours demandait
   * donc trois passages, et il n'y avait aucun moyen d'en corriger une.
   *
   * Le calcul de ce qu'il faut ecrire et retirer vit dans src/lib/periodPick.js
   * avec ses tests, parce que c'est le seul endroit de cet ecran ou une erreur
   * EFFACE des donnees. La regle qui compte y est expliquee: seules les series
   * touchees peuvent bouger.
   *
   * L'ecriture reste dans cycle_log, dont la politique est
   * `user_id = auth.uid()`: pas de chemin vers le groupe, comme partout
   * ailleurs dans le cycle.
   */
  const savePeriod = async () => {
    if (!user?.id || !picking) return
    const { add, remove } = reconcile({
      rows: cycle.starts,
      selected: picked,
      touched: touchedDays,
    })

    if (!add.length && !remove.length) {
      setPicking(false)
      return
    }

    /* Retirer d'abord. `unique (user_id, started_on)` refuserait sinon une
       serie qui commence le meme jour que celle qu'on remplace, ce qui est
       exactement ce qui arrive quand on allonge une regle d'un jour. */
    if (remove.length) {
      const { error, count } = await supabase
        .from('cycle_log')
        .delete({ count: 'exact' })
        .in('id', remove)
      /* RLS refuse un DELETE en silence: zero ligne, aucune erreur. Continuer
         apres un refus ecrirait la nouvelle serie a cote de l'ancienne. */
      if (error) return setNotice(error.message)
      if (count === 0) return setNotice(t('cycle.save_failed'))
    }

    if (add.length) {
      const { error } = await supabase
        .from('cycle_log')
        .upsert(
          add.map((r) => ({ user_id: user.id, ...r })),
          { onConflict: 'user_id,started_on' },
        )
      if (error) return setNotice(error.message)
    }

    setPicking(false)
    setPeriodSaved({ add: add.length, remove: remove.length })

    /* Le panneau tient l'etat du cycle et sait le relire; le calendrier n'a
       qu'a le lui demander, sinon la pastille du jour ne bougerait qu'au
       prochain chargement. */
    const { data } = await supabase
      .from('cycle_log')
      .select('id, started_on, ended_on')
      .order('started_on', { ascending: true })
    setCycle((c) => ({ ...c, starts: data ?? c.starts }))
  }

  /**
   * Entrer dans le mode "coche les jours".
   *
   * Bascule en vue MOIS, parce que c'est la seule ou un mois entier est
   * visible: cocher trois jours de suite dans la vue jour demanderait trois
   * navigations, et la demande dit "full month view only".
   *
   * La selection part de ce qui est DEJA enregistre, comme chez Flo, sinon les
   * jours deja notes s'afficheraient decoches sur une grille qui les colorie.
   * `touched` part vide: c'est lui qui garantit qu'enregistrer sans rien taper
   * ne reecrit rien. Voir periodPick.js.
   */
  const startPicking = () => {
    setPeriodSaved(null)
    setView('month')
    setPicked(selectedFrom(cycle.starts))
    setTouchedDays(new Set())
    setPicking(true)
  }

  const togglePeriodDay = (d) => {
    const k = dayKey(d)
    /* Le futur est refuse ici comme il l'etait dans le champ date. Une regle
       qu'on n'a pas encore eue n'est pas une donnee. */
    if (k > dayKey(new Date())) return
    setPicked((s) => {
      const next = new Set(s)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
    setTouchedDays((s) => new Set(s).add(k))
  }

  const [view, setView] = useState('week')
  const [anchor, setAnchor] = useState(() => {
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth(), n.getDate())
  })
  const [events, setEvents] = useState([])
  const [goals, setGoals] = useState([])
  const [cycle, setCycle] = useState({ starts: [], prediction: null })
  const [editing, setEditing] = useState(null)
  const [hidden, setHidden] = useState(readHidden)
  const [drawer, setDrawer] = useState(false)
  const [wizard, setWizard] = useState(false)
  const [added, setAdded] = useState(0)
  /**
   * LE MODE "COCHE LES JOURS", ET SES TROIS ETATS.
   *
   * `picking`     on est dedans, donc la grille coche au lieu d'ouvrir un jour
   * `picked`      ce qui est coche a l'ecran, jours en YYYY-MM-DD
   * `touchedDays` ce qu'elle a REELLEMENT tape pendant cette session
   *
   * Le troisieme n'est pas une commodite. Toutes les lignes existantes ont
   * `ended_on` a null, et le calendrier en dessine cinq jours par defaut; sans
   * lui, enregistrer apres avoir coche un jour de septembre inventerait une
   * duree sur chaque regle de l'annee derniere. La demonstration est dans
   * src/lib/periodPick.test.mjs.
   */
  const [picking, setPicking] = useState(false)
  const [picked, setPicked] = useState(() => new Set())
  const [touchedDays, setTouchedDays] = useState(() => new Set())
  /**
   * Ce que le dernier enregistrement a fait, pour le dire.
   *
   * Sans ca l'ecriture est muette quand elle reussit. La grille change de
   * couleur, ce qui est deja une reponse; mais retirer une regle entiere ne
   * laisse rien a l'ecran, et rien ne distinguerait "enregistre" de "le bouton
   * n'a pas pris". */
  const [periodSaved, setPeriodSaved] = useState(null)
  /* The occurrence somebody asked to delete, or null. It carries the whole
     entry rather than an id, because the dialog has to know the title to name
     it and the day to skip. */
  const [deleting, setDeleting] = useState(null)
  /* L'occurrence dont on vient de demander la modification, tant qu'on ne sait
     pas si c'est celle-la ou toute la serie. Null le reste du temps. */
  const [editingScope, setEditingScope] = useState(null)
  /* Whatever the last write said when it did not work. Null the rest of the
     time, which is nearly always. */
  const [notice, setNotice] = useState(null)
  /* Les gens de tes groupes, pour leurs anniversaires. Rien d'autre n'est lu
     de ces profils ici: un nom et une date. */
  const [friends, setFriends] = useState([])

  const load = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('calendar_event').select('*')
    setEvents(data ?? [])

    /**
     * LES GENS AVEC QUI TU ES DANS UN GROUPE, POUR LEURS ANNIVERSAIRES.
     *
     *   "It should automatically pull up your friends, the people you are in a
     *    group with, in your calendar, your bday as well."
     *
     * Pas de filtre de groupe, et c'est la meme requete que le tableau de bord
     * pour la banniere: `group_members_select` est `is_member(group_id)`, donc
     * ceci rend deja exactement les listes dont tu fais partie, et le profil
     * embarque est filtre une deuxieme fois par `profiles_select`. Nommer les
     * groupes ici repeterait une regle que la base applique deja, et se
     * tromperait la premiere fois que quelqu'un en rejoint un en cours de
     * session.
     *
     * L'annee de naissance descend avec le reste et n'est jamais affichee:
     * seuls le jour et le mois servent, ici comme dans la banniere.
     */
    const { data: fr } = await supabase
      .from('group_members')
      .select('profiles(id, display_name, birthday)')
    setFriends((fr ?? []).map((r) => r.profiles).filter(Boolean))

    /**
     * Goals with a deadline, as calendar entries.
     *
     * Only `once` goals have a due_on; a recurring goal has a cadence rather
     * than a date and there is nothing to draw. Only active ones, because a
     * completed goal's deadline is a fact about the past and putting it on
     * next week would be a lie.
     *
     * These are read-only here. They carry goalId, which is what stops the
     * grid opening the event form on one: see openEditor below.
     */
    const { data: g } = await supabase
      .from('goals')
      .select('id, commitment, due_on, group_id')
      .eq('status', 'active')
      .not('due_on', 'is', null)
    setGoals(g ?? [])
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const toggleLayer = (layer) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(layer)) next.delete(layer)
      else next.add(layer)
      try {
        localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next]))
      } catch {
        /* A browser refusing storage is not a reason to refuse the toggle. */
      }
      return next
    })
  }

  /* The span being drawn. Month is padded to whole weeks so the grid is
     rectangular; week runs Monday to Sunday, which is what a European
     timetable looks like even though getDay() calls Sunday zero. */
  const range = useMemo(() => {
    if (view === 'day') return { from: anchor, to: anchor }
    if (view === 'week') {
      const back = (anchor.getDay() + 6) % 7
      const from = addDays(anchor, -back)
      return { from, to: addDays(from, 6) }
    }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
    return { from: addDays(first, -((first.getDay() + 6) % 7)), to: addDays(last, 6 - ((last.getDay() + 6) % 7)) }
  }, [view, anchor])

  /**
   * Everything drawn on the grid: stored events plus goals with a deadline,
   * minus whatever the toolbar has switched off.
   *
   * The goals are mapped into the event shape rather than drawn by a second
   * code path, so recurrence expansion, sorting, the month chips, the week
   * blocks and the day list all treat them as what they are on a calendar: an
   * all-day entry on one date. `weekdays: []` makes occurrencesOf take the
   * one-off branch and never walk.
   */
  const drawn = useMemo(() => {
    const asEvents = goals.map((g) => ({
      id: `goal:${g.id}`,
      goalId: g.id,
      title: g.commitment,
      category: 'objectif',
      colour: LAYER_COLOUR.objectifs,
      starts_on: g.due_on,
      start_min: null,
      end_min: null,
      weekdays: [],
      until_on: null,
      location: null,
    }))
    /**
     * LES ANNIVERSAIRES, FABRIQUES POUR LA PLAGE AFFICHEE.
     *
     * Le tien est dedans, annonce comme le tien plutot que par ton nom, et il
     * arrive par la meme porte que les autres: ton profil est ajoute a la
     * liste plutot que traite a part. Un deuxieme chemin pour une seule
     * personne est un deuxieme endroit ou la date peut etre fausse.
     *
     * Ils passent ensuite par `visibleEvents` comme tout le reste, ce qui est
     * ce qui rend la puce "Anniversaires" de la barre capable de les enlever.
     */
    const gens = profile?.birthday ? [...friends, { id: user?.id, display_name: profile.display_name, birthday: profile.birthday }] : friends
    const anniversaires = birthdayEntries(gens, range.from, range.to, {
      mine: user?.id,
      mineLabel: t('cal.bday_mine'),
    })
    return visibleEvents([...events, ...asEvents, ...anniversaires], hidden)
  }, [events, goals, hidden, friends, profile, user?.id, range, t])

  const agenda = useMemo(() => agendaFor(drawn, range.from, range.to), [drawn, range])

  /* The cycle overlay is a layer too, so switching it off has to empty what
     the grids read rather than just hiding a panel. The same emptying answers
     both questions: the layer turned off for now, and the tracker not being
     part of this person's app at all. */
  const shownCycle =
    !periodTracking || hidden.has('cycle') ? { starts: [], prediction: null } : cycle

  /* A goal is drawn here and edited on the goals screen. Without this guard
     the form would open on one and then insert a brand new calendar_event
     carrying the goal's text, which is a duplicate nobody asked for. */
  const openEditor = (entry) => {
    /* Un anniversaire est derive d'un profil, exactement comme un objectif est
       derive de sa ligne: ouvrir le formulaire dessus insererait un vrai
       evenement portant le meme texte, donc un doublon que personne n'a
       demande et que l'annee suivante ne fera pas disparaitre. */
    if (entry?.goalId || entry?.birthdayOf) return
    setEditing(entry)
  }

  /**
   * MODIFIER QUOI: CE MERCREDI-LA, OU TOUS LES MERCREDIS.
   *
   *   "Quand je fais un programme et que je clique sur edit un jour, je veux
   *    que ca me demande si je veux editer tous les mercredis de ce programme
   *    ou juste ce mercredi."
   *
   * La suppression posait deja la question, depuis que supprimer un mardi
   * effacait tout le trimestre. La modification, elle, ne la posait pas: une
   * ligne est une REGLE, donc changer l'heure parce qu'un cours est deplace
   * une fois deplacait les quinze suivants, en silence.
   *
   * Meme decoupe et meme mots que la suppression, jusqu'a la phrase qui nomme
   * le jour: deux dialogues qui posent la meme question sur le meme ecran ne
   * doivent pas la poser differemment.
   *
   * Un evenement unique saute le dialogue. "Celui-ci" et "toute la serie" sont
   * la meme chose quand la serie dure un jour, et une question a deux reponses
   * identiques est une question qu'on apprend a cliquer sans lire.
   */
  const askEdit = (entry) => {
    if (entry?.goalId || entry?.birthdayOf) return
    const recurring = Array.isArray(entry?.weekdays) && entry.weekdays.length > 0
    if (!recurring) return openEditor(entry)
    setEditingScope(entry)
  }

  /**
   * DETACHER UNE OCCURRENCE, C'EST UNE INSERTION PLUS UNE EXCEPTION.
   *
   * Il n'y a pas de "modifier juste ce jour-la" dans le schema, et il ne doit
   * pas y en avoir: une ligne est une regle, et une regle qui porterait des
   * exceptions valuees serait un deuxieme calendrier dans une colonne.
   *
   * Donc le meme mecanisme que "supprimer juste celui-ci", plus une ligne: le
   * jour entre dans excluded_on de la regle, et une NOUVELLE ligne d'un seul
   * jour porte ce que la personne vient de taper.
   *
   * `id` est retire de ce qui est passe au formulaire, et c'est ce qui decide:
   * EventForm insere quand il n'y a pas d'id, et met a jour quand il y en a
   * un. Le garder aurait modifie la regle, c'est-a-dire exactement ce qu'on
   * essaie d'eviter.
   *
   * L'exception est posee APRES l'enregistrement, pas avant. Avant, annuler le
   * formulaire aurait supprime l'occurrence sans rien mettre a la place.
   */
  const editOnlyThis = (entry) => {
    const key = dayKey(entry.day)
    setEditingScope(null)
    setEditing({
      ...entry,
      id: undefined,
      occurrenceId: undefined,
      starts_on: key,
      until_on: key,
      weekdays: [],
      detachFrom: { id: entry.id, day: key, excluded_on: entry.excluded_on ?? [] },
    })
  }

  const editWholeSeries = (entry) => {
    setEditingScope(null)
    openEditor(entry)
  }

  /**
   * Le jour retire de la regle, une fois la nouvelle ligne ecrite.
   *
   * Meme forme que removeOne, et pour les memes raisons: lecture-modification-
   * ecriture parce que postgrest n'a pas d'array_append, et `count` demande
   * parce que RLS refuse un UPDATE en silence. Un refus ici laisserait DEUX
   * evenements ce jour-la, l'ancien et le nouveau.
   */
  const detachDay = async ({ id, day, excluded_on }) => {
    const next = [...new Set([...(excluded_on ?? []), day])]
    const { error, count } = await supabase
      .from('calendar_event')
      .update({ excluded_on: next }, { count: 'exact' })
      .eq('id', id)
    if (error || count === 0) setNotice(error?.message ?? t('cal.err_gone'))
  }

  const step = (n) => {
    if (view === 'month') setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + n, 1))
    else setAnchor(addDays(anchor, n * (view === 'week' ? 7 : 1)))
  }

  const fmt = new Intl.DateTimeFormat(localeTag(locale), {
    month: 'long',
    year: 'numeric',
    ...(view === 'day' ? { day: 'numeric', weekday: 'long' } : {}),
  })

  /**
   * Deleting, and the question that has to be asked first.
   *
   * A row is a RULE. Deleting the row for "Biochimie, Tuesdays and Thursdays
   * until December" because somebody wanted to cancel one Tuesday removes the
   * whole term, silently, with no undo. That was the behaviour and it is the
   * bug this pair of functions exists to fix.
   *
   * A one-off skips the dialog entirely: "only this one" and "the whole
   * series" are the same choice when the series is one day long, and a
   * confirmation that offers two identical options is a confirmation people
   * learn to click through.
   */
  const askRemove = (entry) => {
    const recurring = Array.isArray(entry?.weekdays) && entry.weekdays.length > 0
    if (!recurring) return removeSeries(entry.id)
    setDeleting(entry)
  }

  /**
   * BOTH OF THESE PUT THE ROW BACK IF THE WRITE DID NOT HAPPEN.
   *
   * The optimistic update is what makes the dialog feel instant, and it is
   * also what makes a failed write invisible: the row leaves the screen either
   * way and comes back on the next reload with no explanation. Two ways that
   * happens here, and neither is hypothetical:
   *
   *   * RLS refuses an UPDATE or a DELETE by matching zero rows. No error, no
   *     exception, an empty result. That is the documented behaviour and it is
   *     why `count` is asked for rather than trusted.
   *   * excluded_on does not exist until migration 52 has been run, and until
   *     it has, every "only this one" is a postgrest 400 that nothing reads.
   *
   * Both were made to happen against the running app rather than argued about:
   * the 400 puts the row back and prints what postgrest said, and a 200 whose
   * Content-Range reports zero rows puts it back and prints cal.err_gone.
   */
  const removeSeries = async (id) => {
    setDeleting(null)
    const before = events
    setEvents((e) => e.filter((x) => x.id !== id))
    const { error, count } = await supabase
      .from('calendar_event')
      .delete({ count: 'exact' })
      .eq('id', id)
    if (error || count === 0) {
      setEvents(before)
      setNotice(error?.message ?? t('cal.err_gone'))
    }
  }

  /**
   * One occurrence: the rule stays, the day is added to its exception list.
   *
   * Read-modify-write rather than an array append in SQL, because the client
   * already holds the row and postgrest has no `array_append` in its update
   * syntax. The race is two tabs skipping two different days of the same rule
   * within the same second, which loses one exception; the cost of that is one
   * class reappearing, and the alternative is an RPC for a feature used a
   * handful of times a term.
   */
  const removeOne = async (entry) => {
    const key = dayKey(entry.day)
    const next = [...new Set([...(entry.excluded_on ?? []), key])]
    setDeleting(null)
    const before = events
    setEvents((list) => list.map((x) => (x.id === entry.id ? { ...x, excluded_on: next } : x)))
    const { error, count } = await supabase
      .from('calendar_event')
      .update({ excluded_on: next }, { count: 'exact' })
      .eq('id', entry.id)
    if (error || count === 0) {
      setEvents(before)
      setNotice(error?.message ?? t('cal.err_gone'))
    }
  }

  return (
    /**
     * The one page with no width cap above the tablet breakpoint.
     *
     * max-w-content is 40rem, which is right for the pages that are columns of
     * text and forms: a 1200px-wide settings form is worse, not better. A grid
     * is the exception. Seven day columns at 40rem are 80px each, which is why
     * the week view needed a horizontal scroller on a phone and still felt
     * cramped on an iPad that had 700px of empty margin either side.
     *
     * It was 68rem for a while and that was still a cap. A timetable is the
     * one thing here that gets better with every pixel: the hour rows stay the
     * same height and the columns get wider, so a 90-minute block goes from
     * holding an abbreviation to holding the course name and the room. The
     * rail's 7.5rem is already taken out by the shell, so `none` here means
     * the window minus the rail, not the window.
     */
    <div className="mx-auto w-full max-w-content space-y-4 px-4 pb-28 pt-4 md:flex md:h-dvh md:max-w-none md:flex-col md:pb-8">
      {/**
       * THREE CONTAINERS, NOT ONE HEADER.
       *
       * This was a single card carrying the title, three buttons, the view
       * switch, the pager, the month and four filter chips: nine controls of
       * five different kinds in one box, which is a box that says nothing
       * about what belongs with what.
       *
       * The split is by WHAT A CONTROL DOES rather than by how it looks.
       * Row one opens things and turns layers on and off. Row two moves
       * around inside what is already on screen. Row three is the screen.
       *
       * Row one is a flex row of separate pills rather than a card, so it
       * wraps to two lines on a phone without the box growing a second row of
       * empty space, and so nothing in it looks like a section heading.
       */}
      <div className="flex flex-wrap items-center gap-2" data-hook="cal-actions">
        {/* A term is transcribed from a printout, not composed. Doing it
            through the single-event form means retyping the term dates once
            per class and counting how many are left. */}
        <button type="button" onClick={() => setWizard(true)} className="goal-action press" data-hook="cal-wiz-open">
          {t('wiz.open')}
        </button>

        {/* The way in to everything about the cycle: the tracker, the recorded
            periods and the reminder settings. Absent, rather than disabled, for
            somebody whose app does not have the tracker in it: a greyed-out
            button is still an advertisement for a feature they said no to. */}
        {periodTracking && (
          <button type="button" onClick={() => setDrawer(true)} className="goal-action press" data-hook="cal-cycle-open">
            {t('cycle.manage')}
          </button>
        )}

        {/**
         * The layers, as pressed-in toggles, beside the things that open.
         *
         * aria-pressed rather than a checkbox, because these do not submit
         * anything and a checkbox in a toolbar implies a form. The state is
         * carried three ways so it is never colour alone, per 1.4.1: the
         * button's fill, the dot going hollow, and the strikethrough on the
         * word. A greyscale screenshot still says which are off.
         */}
        <span aria-hidden="true" className="mx-1 hidden h-6 w-px bg-hairline sm:block" />

        <div className="flex flex-wrap items-center gap-2" data-hook="cal-layers">
          {/* Three toggles rather than four when there is no cycle to overlay.
              A switch that governs nothing is worse than a missing one: it
              invites a tap and answers with no visible change. */}
          {LAYERS.filter((l) => l !== 'cycle' || periodTracking).map((layer) => {
            const on = !hidden.has(layer)
            return (
              <button
                key={layer}
                type="button"
                aria-pressed={on}
                data-layer={layer}
                data-on={on}
                onClick={() => toggleLayer(layer)}
                className={`press flex items-center gap-1.5 rounded-pill px-3 py-2 text-small font-semibold transition-colors ${
                  on ? 'bg-ink/[0.06] text-ink' : 'text-muted hover:bg-ink/[0.04]'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`h-2.5 w-2.5 shrink-0 rounded-pill ${
                    on ? LAYER_DOT[layer] : `border-2 ${LAYER_RING[layer]}`
                  }`}
                />
                <span className={on ? '' : 'line-through decoration-1'}>{t(`cal.layer_${layer}`)}</span>
              </button>
            )
          })}
        </div>

        {/**
         * DEUX BOUTONS COTE A COTE, PAS UNE QUESTION.
         *
         *   "A cote du bouton ajouter, ajouter une option ajouter
         *    menstruation."
         *
         * La version precedente faisait demander a "+ Ajouter" ce qu'on
         * ajoutait. Le choix etait juste, mais il coutait une touche DANS LES
         * DEUX SENS: ajouter un cours passait lui aussi par la question. Une
         * question dont on connait deja la reponse en arrivant n'est pas un
         * choix, c'est un peage.
         *
         * Les deux gestes sont donc deux boutons, epingles ensemble au bout de
         * la rangee.
         *
         * UN SEUL EST REMPLI. Deux boutons pleins cote a cote se disputent la
         * meme place dans l'oeil, et personne ne sait lequel est le geste
         * courant. Le rempli reste l'horaire, qui sert tous les jours; les
         * regles prennent la meme forme que "Mon cycle" a cote, ce qui est
         * aussi ce qui les distingue autrement que par la couleur (1.4.1).
         *
         * Et celui des regles n'existe que s'il y a un cycle a noter. Absent
         * plutot que grise, comme "Mon cycle" plus haut: un bouton eteint reste
         * la publicite d'une fonction a laquelle la personne a dit non.
         */}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {periodTracking && (
            <button
              type="button"
              onClick={startPicking}
              aria-expanded={picking}
              className="goal-action press shrink-0"
              data-hook="cal-add-period"
            >
              <span aria-hidden="true" className="mr-1 text-body leading-none">
                +
              </span>
              {t('cal.add_period')}
            </button>
          )}

          {/* The + is the icon and the word is the label. */}
          <button
            type="button"
            onClick={() => setEditing({ starts_on: dayKey(anchor), category: 'cours', weekdays: [] })}
            className="goal-action-done press shrink-0"
            data-hook="cal-add"
          >
            <span aria-hidden="true" className="mr-1 text-body leading-none">
              +
            </span>
            {t('cal.add')}
          </button>
        </div>
      </div>

      {/**
       * LA BARRE DU MODE "COCHE LES JOURS".
       *
       *   "Look the way you can just coche the case number on flo."
       *
       * Ce panneau etait un champ date. Une regle de trois jours demandait donc
       * trois passages, et corriger une regle deja notee etait impossible: il
       * fallait ouvrir le tiroir du cycle, trouver la ligne, la supprimer, et
       * recommencer.
       *
       * Ce qu'il y a ici tient en une phrase et deux boutons, parce que le
       * geste est sur la grille en dessous et que tout ce qui s'ajoute ici la
       * repousse hors de l'ecran. Le compte est la pour que "trois jours
       * coches" soit verifiable sans recompter les tuiles.
       */}
      {picking && (
        <div className="lg w-full p-4" data-hook="cal-pick-bar">
          <p className="text-small font-semibold text-ink">{t('cal.pick_how')}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-small text-muted" data-hook="cal-pick-count">
              {t(picked.size === 1 ? 'cal.pick_n_one' : 'cal.pick_n_other', { n: picked.size })}
            </span>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={savePeriod}
                className="goal-action-done press"
                data-hook="cal-period-save"
              >
                {t('cal.add_period_save')}
              </button>
              <button
                type="button"
                onClick={() => setPicking(false)}
                className="press rounded-pill px-4 py-2 text-small font-semibold text-muted hover:bg-ink/[0.06]"
                data-hook="cal-period-cancel"
              >
                {t('ui.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/**
       * Ce que l'enregistrement a fait, en toutes lettres.
       *
       * Retirer une regle entiere ne laisse RIEN a l'ecran: la grille perd une
       * couleur qui n'etait peut-etre pas visible depuis le mois affiche, et
       * sans un mot rien ne distingue "enregistre" de "le bouton n'a pas pris".
       */}
      {periodSaved && (
        <p className="text-small font-semibold text-ink" role="status" data-hook="cal-period-saved">
          {periodSaved.remove > 0 && periodSaved.add === 0
            ? t(periodSaved.remove === 1 ? 'cal.pick_removed_one' : 'cal.pick_removed_other',
                { n: periodSaved.remove })
            : t(periodSaved.add === 1 ? 'cal.pick_saved_one' : 'cal.pick_saved_other',
                { n: periodSaved.add })}{' '}
          <button
            type="button"
            onClick={() => setPeriodSaved(null)}
            className="press font-normal underline decoration-1 underline-offset-2"
          >
            {t('wiz.close')}
          </button>
        </p>
      )}

      {/* Eight rows landing at once is a big change to a grid somebody was
          just looking at, and without a word it reads as the page having done
          something on its own. Dismissible, and it says how many. */}
      {added > 0 && (
        <p className="text-small font-semibold text-ink" role="status" data-hook="wiz-done">
          {t(added === 1 ? 'wiz.done_one' : 'wiz.done_other', { n: added })}{' '}
          {/* "Fermer", not "Annuler". Cancel on a notice that something was
              added reads as an offer to undo the add, which this is not. */}
          <button
            type="button"
            onClick={() => setAdded(0)}
            className="press underline decoration-1 underline-offset-2"
          >
            {t('wiz.close')}
          </button>
        </p>
      )}

      {/* A write that did not happen. role="alert" and not "status", because
          the thing that was on screen a second ago has just come back and the
          reason is the only way to make sense of that. */}
      {notice && (
        <p className="text-safe text-small font-semibold text-negative" role="alert" data-hook="cal-notice">
          {notice}{' '}
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="press font-normal underline decoration-1 underline-offset-2"
          >
            {t('wiz.close')}
          </button>
        </p>
      )}

      {/**
       * Row two: moving around, and nothing else.
       *
       * No filters in here, deliberately. A toolbar that both changes what is
       * drawn and changes where you are looking is one where a person cannot
       * tell which of the two they just did.
       */}
      <header className="lg w-full overflow-hidden px-4 py-3" data-hook="cal-toolbar">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* The month is the heading of this screen now that the h1 has gone
              up into the page. first-letter:uppercase because Intl gives
              "septembre 2026" in French and "September 2026" in English. */}
          <h1 className="text-safe text-h2 font-semibold text-ink first-letter:uppercase">
            {fmt.format(anchor)}
          </h1>

          <div className="flex gap-1 rounded-pill bg-ink/[0.06] p-1" role="tablist" data-hook="cal-views">
            {VIEWS.map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`press rounded-pill px-3 py-1.5 text-small font-semibold transition-colors ${
                  view === v ? 'bg-surface text-ink shadow-raised' : 'text-muted hover:text-ink'
                }`}
              >
                {t(`cal.${v}`)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button type="button" onClick={() => step(-1)} aria-label={t('cal.prev')} className="press h-9 w-9 rounded-pill hover:bg-ink/[0.06]">
              &#8249;
            </button>
            <button
              type="button"
              onClick={() => setAnchor(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()))}
              className="press rounded-pill px-3 py-1.5 text-small font-semibold text-ink hover:bg-ink/[0.06]"
            >
              {t('cal.today')}
            </button>
            <button type="button" onClick={() => step(1)} aria-label={t('cal.next')} className="press h-9 w-9 rounded-pill hover:bg-ink/[0.06]">
              &#8250;
            </button>
          </div>
        </div>
      </header>

      {/**
       * THE GRID GETS THE WHOLE WIDTH AT EVERY SIZE NOW.
       *
       * This was a two-column split with the cycle panel beside the grid from
       * xl up, and the measurement that produced xl is the same one that
       * eventually killed the column: at lg an iPad in landscape gave the grid
       * 572px, seven columns of 82px, on the device with the most room. Moving
       * the split to xl fixed the iPad and left a laptop paying 20rem for a
       * panel that is mostly a summary of four dates.
       *
       * A drawer costs one press and gives every screen the full seven
       * columns, and it is also where the editing this panel never had can
       * actually fit.
       */}
      {/**
       * The canvas takes whatever the two rows above it did not.
       *
       * The month grid was a fixed 6.5rem per row, so on a laptop the card
       * stopped about 220px short of the bottom of the window and left a band
       * of empty ground under it. A calendar is the one screen where the grid
       * IS the page, so it should end where the page does.
       *
       * min-h-0 is the part that is easy to miss: a flex child defaults to
       * min-height:auto, which means it refuses to shrink below its content
       * and flex-1 cannot do anything. Without it the grid would push the page
       * taller than the window instead of fitting inside it.
       *
       * overflow-y-auto so the views that genuinely can be longer than the
       * window, the day list with a full timetable on it, scroll INSIDE the
       * canvas rather than making the whole page scroll and taking the
       * toolbars off the top with them.
       */}
      <div className="min-w-0 space-y-4 md:flex md:min-h-0 md:flex-1 md:flex-col md:overflow-y-auto">
        {view === 'month' && (
          <MonthGrid
            range={range}
            anchor={anchor}
            agenda={agenda}
            cycle={shownCycle}
            /* En mode coche, la tuile coche. Sinon elle ouvre le jour, comme
               avant: un seul composant, deux gestes, et pas une deuxieme
               grille a garder d'accord avec celle-ci. */
            picking={picking}
            picked={picked}
            onPick={picking ? togglePeriodDay : (d) => { setAnchor(d); setView('day') }}
          />
        )}
        {view === 'week' && <WeekGrid range={range} agenda={agenda} cycle={shownCycle} locale={locale} onEdit={askEdit} />}
        {view === 'day' && <DayList day={anchor} agenda={agenda} cycle={shownCycle} onEdit={askEdit} onRemove={askRemove} t={t} />}
      </div>

      {/* Mounted always, so the tracker's own load runs and the overlay is
          there before anybody opens the drawer. `open` only draws it. */}
      {/* Not mounted at all, which is the line that stops the reading: this is
          the component that queries cycle_log. */}
      {periodTracking && (
        <CyclePanel onChange={setCycle} open={drawer} onClose={() => setDrawer(false)} />
      )}

      {/**
       * The choice, before anything is lost.
       *
       * Three buttons and no default. "Toute la serie" is the destructive one
       * and is styled as such rather than being the primary: the safe answer
       * should be the easy one to hit, and on a phone this is a sheet where
       * the first button is under the thumb.
       */}
      {deleting && (
        <ScopeChoice
          danger
          hook="cal-delete"
          entry={deleting}
          onOne={() => removeOne(deleting)}
          onAll={() => removeSeries(deleting.id)}
          onCancel={() => setDeleting(null)}
          locale={locale}
          t={t}
          titleKey="cal.del_title"
          oneKey="cal.del_one"
          allKey="cal.del_all"
        />
      )}

      <TimetableWizard
        open={wizard}
        startsOn={dayKey(anchor)}
        onClose={() => setWizard(false)}
        onSaved={async (n) => {
          setWizard(false)
          setAdded(n)
          await load()
        }}
      />

      {/* Meme dialogue que pour la suppression, et le meme composant: deux
          boites qui posent la meme question sur le meme ecran ne doivent pas
          la poser avec deux mises en page. `danger` decide seulement de la
          couleur du second bouton, parce que modifier une serie n'efface
          rien. */}
      {editingScope && (
        <ScopeChoice
          entry={editingScope}
          onOne={() => editOnlyThis(editingScope)}
          onAll={() => editWholeSeries(editingScope)}
          onCancel={() => setEditingScope(null)}
          locale={locale}
          t={t}
          titleKey="cal.edit_title"
          oneKey="cal.edit_one"
          allKey="cal.edit_all"
          hook="cal-edit-scope"
        />
      )}

      {editing && (
        <EventForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            /* L'exception APRES l'ecriture: la nouvelle ligne existe, donc
               retirer le jour de la regle ne peut plus laisser un trou. */
            const detach = editing.detachFrom
            setEditing(null)
            if (detach) await detachDay(detach)
            await load()
          }}
        />
      )}
    </div>
  )
}

/* --- month --------------------------------------------------------------- */

/**
 * A media query React can act on.
 *
 * Needed because how many chips fit in a tile is a number passed to slice(),
 * and a class cannot change a number. The alternative is rendering three and
 * hiding the last with `hidden md:block`, which leaves the "+1 more" count
 * lying on a phone: it would say there is one hidden when there are two.
 *
 * Guarded for the server and for older Safari, which had addListener and not
 * addEventListener on a MediaQueryList until 14.
 */
function useWide(query = '(min-width: 768px)') {
  const [wide, setWide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.(query).matches === true,
  )
  useEffect(() => {
    const mq = window.matchMedia?.(query)
    if (!mq) return
    const on = () => setWide(mq.matches)
    on()
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [query])
  return wide
}

function MonthGrid({ range, anchor, agenda, cycle, onPick, picking = false, picked }) {
  const { t, locale } = useT()
  /* Two chips on a phone tile, three once the tile is 6.5rem tall. */
  const shown = useWide() ? 3 : 2
  const days = []
  for (let i = 0; i <= daysBetween(range.from, range.to); i += 1) days.push(addDays(range.from, i))

  const dow = new Intl.DateTimeFormat(localeTag(locale), { weekday: 'short' })
  const today = dayKey(new Date())

  return (
    <section
      /* Le mois est le meme pendant le pointage qu'en dehors: meme hauteur de
         carte, meme hauteur de tuile. Il a rapetisse un temps, pour eviter les
         dalles; la capture qui a tranche montre les dalles et dit "je prefere
         ca". Voir la note sur la tuile plus bas. */
      className="lg w-full overflow-hidden p-3 md:flex md:min-h-0 md:flex-1 md:flex-col"
      data-hook="cal-month"
    >
      {/**
       * The rows share whatever height the card has, instead of being 6.5rem
       * each and leaving the rest of the window empty.
       *
       * The row count is not fixed: a month is five or six weeks depending on
       * where the first lands, so it is passed in as a custom property rather
       * than written into a class. An inline grid-template-rows would apply on
       * a phone too, where the tiles SHOULD be their natural height and the
       * page should scroll; --weeks plus a class means the fill only happens
       * above md. See .month-fill in index.css.
       *
       * `auto` for the first row is the weekday header, which wants its own
       * height and not a seventh of the card.
       */}
      <div
        className="grid grid-cols-7 gap-1 month-fill md:min-h-0 md:flex-1"
        style={{ '--weeks': Math.max(1, Math.round(days.length / 7)) }}
      >
        {days.slice(0, 7).map((d) => (
          <div key={`h${dayKey(d)}`} className="truncate px-1 pb-1 text-center text-label font-semibold uppercase text-muted">
            {dow.format(d)}
          </div>
        ))}

        {days.map((d) => {
          const k = dayKey(d)
          const list = agenda.get(k) ?? []
          const phase = phaseOn(d, cycle.starts, cycle.prediction)
          const outside = d.getMonth() !== anchor.getMonth()
          /**
           * EN MODE COCHE: LA TUILE EST LA CASE A COCHER.
           *
           *   "Our app doesn't show the day as little round and I don't want
           *    it too."
           *
           * Donc pas de pastille a cocher sous le chiffre comme chez Flo. La
           * tuile se remplit, ce qui n'ajoute aucune forme a une grille qui en
           * a deja quatre par case: le chiffre, la marque de phase, les
           * pastilles d'evenement et le cadre d'aujourd'hui.
           *
           * aria-checked et role="checkbox" pour que ce soit une case a cocher
           * pour un lecteur d'ecran aussi, ou la tuile remplie ne dit rien.
           */
          const on = picking && picked?.has(k)
          const future = picking && k > today
          return (
            <button
              key={k}
              type="button"
              onClick={() => onPick(d)}
              data-hook="cal-day"
              data-phase={phase ?? ''}
              data-picked={on ? 'yes' : undefined}
              role={picking ? 'checkbox' : undefined}
              aria-checked={picking ? Boolean(on) : undefined}
              /* Le futur est refuse, et il est DIT plutot que simplement inerte:
                 une tuile qui ne repond pas se lit comme un bogue. */
              disabled={future}
              /* The phase belongs in the name, not only in the mark. A screen
                 reader gets "12 September, fertile window" rather than a
                 number and a decorative span it is told to ignore. */
              aria-label={phase ? `${d.getDate()} · ${t(`cycle.phase_${phase}`)}` : String(d.getDate())}
              /* Taller once there is room, which is what lets a third chip
                 show instead of collapsing into "+2 autres". The count line is
                 information about what is hidden; three visible entries is
                 information about the day. */
              /**
               * ROSE, ET LA GRILLE SE VIDE PENDANT QU'ON COCHE.
               *
               *   "No, the black is not prettier, make it pink. Remove the
               *    information when we are selecting the period day, just so
               *    it's not overwhelming, and fix the UI."
               *
               * Trois demandes qui n'en font qu'une, et la capture le montre
               * mieux que la mesure: cinq dalles noires couvertes de pastilles
               * jaunes. Le raisonnement du noir tenait, la page ne tenait pas.
               *
               * LE ROSE EST DECLARE UNE FOIS, PAS PAR THEME. `--c-pick`, a
               * cote de `negative` et `green`, pour la raison qu'elles
               * donnent deja: prendre --c-accent aurait rendu du bleu en mer,
               * ou "fais-le rose" ne veut plus dire grand-chose.
               *
               * ET C'EST L'ENCRE DESSUS, PAS LE BLANC. Le blanc sur ce rose
               * fait 3,80:1, ce que index.css documente deja: assez pour du
               * grand texte, pas pour du texte normal, et un chiffre de jour a
               * 14px est du texte normal. L'encre mesure 4,60:1 en soleil et 4,54:1
               * en mer, sur les pixels peints.
               *
               * LA GRILLE SE VIDE, MAIS ELLE NE SE TASSE PLUS.
               *
               * Pendant le pointage, la seule question posee par cette grille
               * est "ce jour-la ou pas": les pastilles d'evenement et la ligne
               * "+N autres" ne repondent a rien et c'est elles qui faisaient le
               * fouillis. Elles partent, et tout revient a la fermeture.
               *
               * LE RESTE A ETE REPRIS, PARCE QUE LA CAPTURE A TRANCHE.
               *
               *   "Je prefere ca." (capture: le mois a sa taille normale, cinq
               *    tuiles entierement roses, le chiffre a l'encre au milieu)
               *
               * Ce qui avait ete fait a la place: la tuile ramenee a 3rem, la
               * carte qui ne s'etirait plus, et la marque reduite a un rond de
               * la taille du chiffre, au motif qu'une tuile pleine large de
               * 250px est une dalle. C'etait un raisonnement, pas une demande,
               * et il repondait a une plainte qui visait le NOIR: "the black is
               * not prettier". Une fois roses, les dalles sont ce qu'elle veut.
               *
               * Donc le mois pendant le pointage est exactement le mois hors
               * pointage: meme carte etiree, meme tuile de 6,5rem au-dessus de
               * md, la tuile cochee remplie de rose et son chiffre centre. La
               * seule difference reste la grille videe de ses pastilles.
               *
               * ET C'EST TOUJOURS L'ENCRE SUR LE ROSE: 4,60:1 en soleil et
               * 4,54:1 en mer sur la tuile pleine, mesure en pixels peints. La
               * mesure ne change pas avec la taille de la tuile, seulement avec
               * les deux couleurs.
               *
               * La pastille de phase reste: c'est un point, et pendant qu'on
               * coche ses jours c'est le seul repere qui dise ce qui est deja
               * enregistre.
               */
              className={`press relative flex overflow-hidden rounded-inner text-left transition-colors ${
                picking
                  ? 'min-h-[3.4rem] items-center justify-center p-1 md:min-h-[6.5rem] md:p-1.5'
                  : 'min-h-[3.4rem] flex-col items-stretch p-1 md:min-h-[6.5rem] md:p-1.5'
              } ${on ? 'bg-pick' : ''} ${
                on || future ? '' : 'hover:bg-ink/[0.04]'
              } ${outside ? 'opacity-40' : ''} ${
                future ? 'cursor-not-allowed opacity-30' : ''
              } ${k === today && !picking ? 'ring-1 ring-inset ring-accent/50' : ''}`}
            >
              {/**
               * Le rose est sur la TUILE, pas derriere le chiffre.
               *
               * "Our app doesn't show the day as little round and I don't want
               * it too" l'avait deja dit une fois, et la capture le redit: la
               * marque n'est pas un rond de selecteur de dates, c'est la case
               * entiere qui se remplit. Ce span ne porte donc plus de fond du
               * tout; il ne sert qu'a placer le chiffre et son point.
               */}
              <span
                className={`relative flex items-center justify-center ${
                  picking ? '' : 'w-full justify-between'
                }`}
              >
                {/**
                 * PENDANT LE POINTAGE, LE CHIFFRE EST GRAND, GRAS ET BLANC SUR
                 * LE ROSE.
                 *
                 *   "Regles rose carre, la date a l'interieur blanche."
                 *
                 * Le blanc sur ce rose fait 3,80:1. En 14px semibold c'est du
                 * texte normal, il en faut 4,5, et c'est pour ca que l'encre
                 * avait ete choisie. En 19px gras c'est du GRAND texte au sens
                 * de 1.4.3, il en faut 3,0, et 3,80 passe.
                 *
                 * La place existe parce que la grille s'est videe: pendant le
                 * pointage la tuile ne porte plus que ce chiffre. Hors
                 * pointage elle partage sa place avec les pastilles
                 * d'evenement, donc le chiffre y reste petit et a l'encre.
                 */}
                <span
                  className={
                    picking
                      ? `text-[1.1875rem] font-bold leading-none ${on ? 'text-on-pick' : 'text-ink'}`
                      : 'text-small font-semibold text-ink'
                  }
                >
                  {d.getDate()}
                </span>
                {/* The cycle mark. A dot in the corner, never a word, and
                    never a fill that would fight the event chips below. */}
                {/* Pas sur une tuile cochee: la marque EST deja la, et un point
                    de plus dessus est une forme qui ne repond a aucune
                    question. En pointage il passe SOUS le chiffre plutot qu'a
                    cote: le chiffre est centre, et un point pose a sa droite
                    decale le chiffre d'autant vers la gauche, donc une colonne
                    de chiffres qui ne s'alignent plus. */}
                {phase && !on && (
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 shrink-0 rounded-pill ${PHASE_DOT[phase]} ${
                      picking ? 'absolute -bottom-3 left-1/2 -translate-x-1/2' : ''
                    }`}
                  />
                )}
              </span>

              {/* Two, then a count. Four chips in a 48px tile is a smear. */}
              {/* Rien de tout ca pendant le pointage: voir la note ci-dessus.
                  C'est ce qui faisait le fouillis, et c'est aussi ce qui rend
                  inutile la plaque blanche qu'une pastille posee sur une tuile
                  pleine avait demandee. */}
              {!picking && list.slice(0, shown).map((e) => (
                <span
                  key={e.occurrenceId}
                  className={`mt-0.5 truncate rounded-[0.35rem] px-1 py-px text-[10px] font-semibold md:px-1.5 md:py-0.5 md:text-[11px] ${
                    SWATCH[e.colour] ?? SWATCH.accent
                  }`}
                >
                  {e.title}
                </span>
              ))}
              {!picking && list.length > shown && (
                <span className="mt-0.5 px-1 text-[10px] font-semibold text-muted">
                  {t('cal.more', { n: list.length - shown })}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}

/* --- week ---------------------------------------------------------------- */

function WeekGrid({ range, agenda, cycle, locale, onEdit }) {
  const { t } = useT()
  const days = Array.from({ length: 7 }, (_, i) => addDays(range.from, i))
  const all = days.flatMap((d) => agenda.get(dayKey(d)) ?? [])
  const bounds = dayBounds(all)
  const hours = []
  for (let m = Math.ceil(bounds.from / 60) * 60; m <= bounds.to; m += 60) hours.push(m)

  const dow = new Intl.DateTimeFormat(localeTag(locale), { weekday: 'short' })
  const today = dayKey(new Date())

  return (
    <section
      className="lg w-full overflow-hidden p-3 md:flex md:min-h-0 md:flex-1 md:flex-col"
      data-hook="cal-week"
    >
      {/* The grid scrolls sideways rather than squeezing seven columns into
          360px, where each would be 40px and hold no word at all.

          Three levels of flex plumbing to get the hour column to fill: every
          ancestor between the card and the grid has to be a flex column with
          min-h-0, or flex-1 on the grid has nothing to grow inside. */}
      <div className="overflow-x-auto md:flex md:min-h-0 md:flex-1 md:flex-col">
        <div className="min-w-[38rem] md:flex md:min-h-0 md:flex-1 md:flex-col">
          <div className="grid grid-cols-[3rem_repeat(7,1fr)] gap-1">
            <div />
            {days.map((d) => {
              const phase = phaseOn(d, cycle.starts, cycle.prediction)
              return (
                <div key={dayKey(d)} className="pb-1 text-center">
                  <div className="truncate text-label font-semibold uppercase text-muted">{dow.format(d)}</div>
                  <div className="flex items-center justify-center gap-1">
                    <span className={`text-small font-semibold ${dayKey(d) === today ? 'text-accent' : 'text-ink'}`}>
                      {d.getDate()}
                    </span>
                    {phase && (
                      <span
                        className={`h-2 w-2 rounded-pill ${PHASE_DOT[phase]}`}
                        role="img"
                        aria-label={t(`cycle.phase_${phase}`)}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/**
           * The hours fill the card above md, and are 3rem each below it.
           *
           * The height cannot stay inline: an inline style beats every class,
           * so there would be no way to release it at one breakpoint and not
           * the other. It is a custom property read by .week-hours instead.
           *
           * min-height keeps the 3rem-per-hour floor, so a short window makes
           * the canvas scroll rather than crushing a nine-hour day into 200px.
           * blockStyle positions everything as a percentage of the span, so a
           * taller column makes every block taller in proportion, which is
           * what was actually asked for.
           */}
          <div
            className="week-hours relative grid grid-cols-[3rem_repeat(7,1fr)] gap-1"
            style={{ '--hours': hours.length }}
          >
            <div className="relative">
              {hours.map((m, i) => (
                <span
                  key={m}
                  className="absolute right-1 -translate-y-1/2 text-[10px] font-semibold text-muted"
                  style={{ top: `${(i / (hours.length - 1 || 1)) * 100}%` }}
                >
                  {clockOf(m)}
                </span>
              ))}
            </div>

            {days.map((d) => (
              <div key={`c${dayKey(d)}`} className="relative rounded-inner bg-ink/[0.025]">
                {(agenda.get(dayKey(d)) ?? []).map((e) => (
                  <button
                    key={e.occurrenceId}
                    type="button"
                    onClick={() => onEdit(e)}
                    style={blockStyle(e, bounds.from, bounds.to)}
                    data-hook="cal-block"
                    className={`press absolute inset-x-0.5 overflow-hidden rounded-[0.4rem] px-1 py-0.5 text-left ring-1 ring-inset ${
                      SWATCH[e.colour] ?? SWATCH.accent
                    }`}
                  >
                    <span className="block truncate text-[10px] font-bold leading-tight">{e.title}</span>
                    {e.start_min != null && (
                      <span className="block truncate text-[9px] leading-tight opacity-70">{clockOf(e.start_min)}</span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {all.length === 0 && <p className="px-1 pt-3 text-small text-muted">{t('cal.empty_week')}</p>}
    </section>
  )
}

/* --- day ----------------------------------------------------------------- */

/**
 * "Just this one, or all of them?"
 *
 * Only ever shown for a rule that recurs. See askRemove for why a one-off
 * skips it: two options that do the same thing teach people to stop reading.
 *
 * A dialog rather than a window.confirm, because confirm() cannot offer three
 * answers and cannot say which day it is about. Naming the date is most of the
 * value here: "Supprimer le cours du jeudi 3 septembre" is a different
 * question from "Supprimer Biochimie".
 */
/**
 * UN SEUL COMPOSANT POUR LES DEUX QUESTIONS.
 *
 * Supprimer et modifier posent la MEME question: ce jour-la, ou toute la
 * serie. Ecrire un deuxieme dialogue aurait donne deux boites a 90 pour cent
 * identiques sur le meme ecran, et c'est exactement ce que la note d'EventForm
 * refuse deja pour lui et le wizard.
 *
 * Ce qui change tient en trois chaines et une couleur. `danger` teinte le
 * second bouton en rouge pour la suppression et le laisse neutre pour la
 * modification, parce que modifier toute une serie se defait et l'effacer ne
 * se defait pas.
 */
function ScopeChoice({
  entry, onOne, onAll, onCancel, locale, t,
  titleKey, oneKey, allKey, hook, danger = false,
}) {
  const when = entry.day.toLocaleDateString(localeTag(locale), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  /**
   * The title, set apart from the sentence it is inside.
   *
   * "Biochimie avancee et metabolisme se repete" is one run of grey text in
   * which the part naming what is about to be deleted is indistinguishable
   * from the part explaining the question. On a destructive dialog that is the
   * one word that has to land.
   *
   * SPLIT ON A SENTINEL RATHER THAN CONCATENATING THREE STRINGS.
   *
   * The obvious version is `pre + <strong>{title}</strong> + post`, which
   * hard-codes the title coming before the date and after nothing. That is
   * true in French and English and is not a property of translation: any
   * locale that fronts the date, or that needs a particle attached to the
   * name, would have to break the sentence to fit the markup. Interpolating a
   * character that cannot appear in a title and splitting on it keeps the
   * whole sentence in the string file where it belongs, and works whatever
   * order a translator puts the two parts in.
   *
   * The quotes live in the template, not here, because which marks a language
   * quotes with is part of the language.
   */
  const [before, after = ''] = t('cal.del_body', { what: SPLIT, when }).split(SPLIT)

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" data-hook={hook}>
      <button
        type="button"
        aria-label={t('cal.cancel')}
        onClick={onCancel}
        className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-label={t(titleKey)}
        className="lg lg-modal relative m-2 w-[min(26rem,calc(100vw-1rem))] p-5"
      >
        <h2 className="text-safe text-h2 font-semibold text-ink">{t(titleKey)}</h2>
        <p className="text-safe mt-1.5 text-small text-muted" data-hook="del-body">
          {before}
          <strong className="font-semibold text-ink">{entry.title}</strong>
          {after}
        </p>

        <div className="mt-5 flex flex-col gap-2">
          {/* The safe answer first, and it is the one under the thumb on a
              phone where this is a sheet rising from the bottom. */}
          <button type="button" onClick={onOne} className="goal-action press justify-center" data-hook="del-one">
            {t(oneKey)}
          </button>
          <button
            type="button"
            onClick={onAll}
            data-hook="del-all"
            className={`press inline-flex items-center justify-center rounded-pill px-4 py-2 text-small font-semibold transition-colors ${
              danger
                ? 'bg-negative/[0.10] text-negative hover:bg-negative/[0.18]'
                : 'bg-ink/[0.06] text-ink hover:bg-ink/[0.11]'
            }`}
          >
            {t(allKey)}
          </button>
          <button type="button" onClick={onCancel} className="press rounded-pill px-4 py-2 text-small font-semibold text-muted hover:bg-ink/[0.06]">
            {t('cal.cancel')}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  )
}

function DayList({ day, agenda, cycle, onEdit, onRemove, t }) {
  const list = agenda.get(dayKey(day)) ?? []
  const phase = phaseOn(day, cycle.starts, cycle.prediction)

  return (
    <section className="lg w-full overflow-hidden p-4" data-hook="cal-day-list" data-phase={phase ?? ''}>
      {phase && (
        <p className="mb-3 flex items-center gap-2 text-small font-semibold text-muted">
          <span className={`h-2 w-2 shrink-0 rounded-pill ${PHASE_DOT[phase]}`} aria-hidden="true" />
          {t(`cycle.phase_${phase}`)}
        </p>
      )}

      {list.length === 0 ? (
        <p className="text-small text-muted">{t('cal.empty_day')}</p>
      ) : (
        <ul className="divide-y divide-hairline">
          {list.map((e) => (
            <li key={e.occurrenceId} className="flex items-start gap-3 py-3">
              <span className={`mt-0.5 h-8 w-1 shrink-0 rounded-pill ${SWATCH_BAR[e.colour] ?? SWATCH_BAR.accent}`} />
              <span className="min-w-0 flex-1">
                <span className="text-safe block text-body font-semibold text-ink">{e.title}</span>
                <span className="block text-small text-muted">
                  {e.start_min != null ? `${clockOf(e.start_min)} - ${clockOf(e.end_min)}` : t('cal.all_day')}
                  {e.location ? ` · ${e.location}` : ''}
                </span>
              </span>
              <span className="flex shrink-0 gap-1">
                <button type="button" onClick={() => onEdit(e)} className="goal-action press">
                  {t('cal.edit')}
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(e)}
                  className="press rounded-pill px-3 py-2 text-small font-semibold text-negative hover:bg-negative/[0.09]"
                >
                  {t('cal.delete')}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/* --- the form ------------------------------------------------------------ */

function EventForm({ initial, onClose, onSaved }) {
  const { user } = useAuth()
  const { t, locale } = useT()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const [f, setF] = useState({
    title: initial.title ?? '',
    category: initial.category ?? 'cours',
    location: initial.location ?? '',
    starts_on: initial.starts_on ?? dayKey(new Date()),
    until_on: initial.until_on ?? '',
    start: clockOf(initial.start_min) ?? '',
    end: clockOf(initial.end_min) ?? '',
    weekdays: initial.weekdays ?? [],
    /**
     * LE RAPPEL DE CET EVENEMENT-LA, EN MINUTES AVANT.
     *
     * "Mon frere il oublie tout le temps qu'il a soccer. Une option comme ca
     * l'app peut lui renvoyer des notifications tous les jours pour le
     * prevenir que a telle heure il a ca dans le calendrier."
     *
     * Par evenement et pas global, parce que c'est ce qui a ete demande: il
     * oublie le soccer, pas tout son agenda. Un rappel sur chaque cours de la
     * semaine ferait une notification toutes les deux heures et la fonction
     * serait coupee dans la journee.
     *
     * Chaine vide plutot que null dans l'etat du formulaire, parce que c'est
     * ce qu'un <select> rend, et '' devient null au moment d'ecrire. Une
     * colonne qui accepte null ne doit pas recevoir '', et une colonne qui le
     * refuse ne doit pas recevoir null: ce depot a deja perdu la creation
     * d'objectif sur exactement cette confusion.
     */
    remind_min: initial.remind_min ?? '',
  })

  const toggleDay = (n) =>
    setF((s) => ({
      ...s,
      weekdays: s.weekdays.includes(n) ? s.weekdays.filter((x) => x !== n) : [...s.weekdays, n].sort(),
    }))

  const save = async (e) => {
    e.preventDefault()
    setError(null)

    const start = minutesOf(f.start)
    const end = minutesOf(f.end)

    /* The same rule as the check constraint, checked here so the message is
       about the form rather than about a constraint name. Both empty is an
       all-day entry and is allowed; one of the two is a half-filled form. */
    if ((start == null) !== (end == null)) return setError(t('cal.err_times'))
    if (start != null && end != null && end <= start) return setError(t('cal.err_order'))
    if (!f.title.trim()) return setError(t('cal.err_title'))

    setBusy(true)
    const row = {
      user_id: user.id,
      title: f.title.trim().slice(0, 120),
      category: f.category,
      location: f.location.trim() ? f.location.trim().slice(0, 160) : null,
      starts_on: f.starts_on,
      until_on: f.until_on || null,
      start_min: start,
      end_min: end,
      weekdays: f.weekdays,
      colour: CATEGORY_COLOUR[f.category] ?? 'accent',
      /* Null veut dire aucun rappel, et remind_min accepte null. Un rappel sur
         un evenement sans heure n'a pas de sens non plus: "trente minutes
         avant" un truc qui dure toute la journee se calculerait depuis minuit
         et partirait a 23h30 la veille. */
      remind_min: start != null && f.remind_min !== '' ? Number(f.remind_min) : null,
    }

    const { error: err } = initial.id
      ? await supabase.from('calendar_event').update(row).eq('id', initial.id)
      : await supabase.from('calendar_event').insert(row)

    setBusy(false)
    if (err) return setError(err.message)
    await onSaved()
  }

  /**
   * A centred dialog, not a card at the bottom of the page.
   *
   * It was a section appended below the grid, which meant "+ Ajouter" scrolled
   * the calendar away and opened a long form where the month had been. The
   * wizard next door was already a modal, so pressing one button gave you a
   * dialog and pressing the other gave you a page: two answers to the same
   * kind of question.
   *
   * Same shell as TimetableWizard, deliberately down to the class list. Two
   * dialogs on one screen that are 90 per cent alike and 10 per cent different
   * is worse than either being wrong on its own. That now includes the footer,
   * which the wizard pinned under the scroll and this form did not.
   *
   * WHAT WAS WRONG WITH IT, MEASURED BEFORE IT WAS TOUCHED.
   *
   *   "Ameliorate the design."
   *
   * A probe opened the dialog at 390, 820, 1290 and 1728 and read it back:
   *
   *   six etiquettes en CAPITALES grises pour un seul formulaire
   *   "What" large de 608px et vide, "Where" pareil, sans rien dedans
   *   "Starts" et "Ends" larges de 309px chacun, pour cinq caracteres
   *   sept puces de categorie qui retombent, une seule orpheline au bout
   *   un dialogue haut de 725px, avec Enregistrer au fond du defilement
   *
   * Aucun de ces points n'est une question de gout, ils sortent tous de la
   * mesure, et chacun a sa reponse ci-dessous.
   *
   * LES ETIQUETTES.
   *
   * `.field-label` existe depuis que le formulaire d'objectif a ete repris, et
   * la note qui l'accompagne dit pourquoi: l'etiquette, l'indice et le
   * placeholder etaient trois lignes du meme gris et il fallait lire les trois
   * pour trouver la question. Ce formulaire-ci avait rate ce passage et
   * gardait des capitales grises, qui sont le style des entetes de carte, pas
   * celui d'un champ. Six entetes de carte empiles font une table des
   * matieres, pas un formulaire.
   *
   * LES BOITES VIDES.
   *
   * Un rectangle de 608 sur 74 sans une lettre dedans ne dit pas ce qu'on
   * attend. Les deux champs libres ont un exemple en placeholder maintenant,
   * et les quatre champs d'heure et de date sont bornes a la largeur de ce
   * qu'ils contiennent: une heure fait cinq caracteres, pas trente-huit rem.
   *
   * LE TRAIT AU MILIEU.
   *
   * Neuf reglages a la suite, tous espaces pareil, se lisent comme neuf
   * questions sans rapport. Ils sont deux groupes: ce que c'est, puis quand
   * ca arrive. Un trait coute une ligne et remplace deux entetes.
   */
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" data-hook="cal-form">
      <button
        type="button"
        aria-label={t('cal.cancel')}
        onClick={onClose}
        className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-label={initial.id ? t('cal.edit_title') : t('cal.new_title')}
        className="lg lg-modal relative m-2 flex max-h-[92dvh] w-[min(42rem,calc(100vw-1rem))] flex-col overflow-hidden p-0"
      >
        <div className="flex items-start justify-between gap-3 border-b border-hairline px-5 py-4">
          <h2 className="text-safe text-h2 font-semibold text-ink">
            {initial.id ? t('cal.edit_title') : t('cal.new_title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('cal.cancel')}
            data-hook="cal-form-close"
            className="press -mr-1 h-9 w-9 shrink-0 rounded-pill text-muted hover:bg-ink/[0.06] hover:text-ink"
          >
            &#215;
          </button>
        </div>

      <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <label className="block">
          <span className="field-label">{t('cal.f_title')}</span>
          {/* Un data-hook plutot qu'un selecteur sur le type: cet input n'en
              declare pas, donc input[type="text"] ne le trouve pas, et le
              chercher par sa classe est ce que CLAUDE.md interdit parce que ca
              a casse a chaque restylage. */}
          <input data-hook="cal-f-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={120} placeholder={t('cal.ph_title')} className="field" />
        </label>

        <label className="mt-4 block">
          <span className="field-label">{t('cal.f_where')}</span>
          <input data-hook="cal-f-where" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} maxLength={160} placeholder={t('cal.ph_where')} className="field" />
        </label>

        {/**
         * The seven, each carrying the colour it will paint in.
         *
         * The dot is not decoration. Picking "Examen" here is the act that
         * decides what the entry looks like on the month grid for the rest of
         * the term, and without it the connection between the word and the
         * black chip that appears afterwards has to be learned by surprise.
         * SWATCH_BAR is reused rather than a second table, so a category whose
         * colour changes changes in both places or in neither.
         *
         * The active pill lifts one pixel with a tinted shadow under it. The
         * fill is still the thing that says "selected" and the lift is a
         * second signal on top of it, per 1.4.1, alongside the dot going white
         * so it stays visible on the accent.
         *
         * UNE GRILLE, ET PLUS UNE RANGEE QUI RETOMBE.
         *
         * Sept puces de largeurs inegales lachees dans un flex-wrap finissaient
         * a six et une: une puce seule sur sa ligne se lit comme un oubli.
         * Dans une grille les cellules font toutes la meme largeur, la
         * derniere rangee est courte comme une derniere rangee de grille, et
         * on voit que c'est la fin d'un ensemble.
         *
         * Pour que ca tienne il a fallu que les noms tiennent en un mot.
         * "Evenement / Fete" mesurait 146px dans une cellule de 146: deux mots
         * pour une puce, c'etait la vraie cause de la rangee ragged.
         *
         * Et la rangee porte enfin une etiquette. Elle flottait sous le titre
         * sans nom, donc rien ne disait que c'etait une question.
         */}
        <div className="mt-4">
          <span className="field-label">{t('cal.f_kind')}</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CATEGORIES.map((c) => {
              const on = f.category === c
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setF({ ...f, category: c })}
                  aria-pressed={on}
                  data-cat={c}
                  className={`press inline-flex items-center justify-center gap-1.5 rounded-pill px-3 py-2 text-small font-semibold transition-all duration-200 ease-settle ${
                    on
                      ? '-translate-y-px bg-accent text-on-accent shadow-[0_4px_12px_-2px_rgb(var(--c-accent)/0.45)]'
                      : 'bg-ink/[0.06] text-ink hover:bg-ink/[0.11]'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 shrink-0 rounded-pill ${
                      on ? 'bg-on-accent' : SWATCH_BAR[CATEGORY_COLOUR[c]] ?? SWATCH_BAR.accent
                    }`}
                  />
                  {t(`cal.cat_${c}`)}
                </button>
              )
            })}
          </div>
        </div>

        {/* Ce que c'est, puis quand ca arrive. Le trait porte la separation que
            deux entetes en capitales auraient portee, pour une ligne au lieu
            de deux blocs, et sans rajouter les majuscules qu'on vient
            d'enlever. */}
        <hr className="my-4 border-0 border-t border-hairline" data-hook="cal-f-split" />

        {/* Bornes a 24rem: une heure fait cinq caracteres et le champ en
            faisait 309px. Le plafond de .field est 38rem, ce qui est la mesure
            d'une ligne de texte et n'a jamais voulu dire quoi que ce soit pour
            une horloge. */}
        <div className="grid grid-cols-2 gap-3 sm:max-w-[24rem]">
          <label className="block">
            <span className="field-label">{t('cal.f_start')}</span>
            <input type="time" data-hook="cal-f-start" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} className="field" />
          </label>
          <label className="block">
            <span className="field-label">{t('cal.f_end')}</span>
            <input type="time" data-hook="cal-f-end" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} className="field" />
          </label>
        </div>

        <div className="mt-4">
          <span className="field-label">{t('cal.f_repeat')}</span>
          {/* Monday first, because that is what a timetable looks like, while
              the stored numbers are getDay()'s, where Sunday is 0. The mapping
              lives here and nowhere else. */}
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5, 6, 0].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => toggleDay(n)}
                aria-pressed={f.weekdays.includes(n)}
                /* Un data-* pour que la repetition se mesure sans compter les
                   puces de categorie, qui portent aussi aria-pressed. Une
                   sonde branchee sur aria-pressed seul a rendu "1 jour coche"
                   sur un formulaire ou aucun ne l'etait: c'etait la categorie,
                   et le CLAUDE.md dit de viser un data-* plutot qu'une forme
                   partagee. */
                data-dow={n}
                /* The visible text cannot be the accessible name here: mardi
                   and mercredi share an initial, so a screen reader would hear
                   "M" twice with nothing to tell them apart, and a 36px chip
                   has no room for a second letter. */
                aria-label={weekdayName(n, localeTag(locale))}
                className={`press h-9 w-9 rounded-pill text-small font-semibold transition-colors ${
                  f.weekdays.includes(n) ? 'bg-accent text-on-accent' : 'bg-ink/[0.06] text-ink hover:bg-ink/[0.11]'
                }`}
              >
                {t(`cal.dow_${n}`)}
              </button>
            ))}
          </div>
          <p className="field-note">
            {f.weekdays.length ? t('cal.repeats') : t('cal.once')}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-[28rem]">
          <label className="block">
            <span className="field-label">{t('cal.f_from')}</span>
            {/* onBlur en plus de onChange: le selecteur de date natif peut
                vider le champ sans qu'aucun evenement n'atteigne React, ce qui
                laisse une case vide a l'ecran et l'ancienne valeur dans
                l'etat. Voir la note complete sur DateField dans GoalForm.jsx;
                c'est la meme faute et elle a coute un objectif enregistre avec
                une date que la personne croyait avoir effacee. */}
            <input type="date" data-hook="cal-f-from" value={f.starts_on}
                   onChange={(e) => setF({ ...f, starts_on: e.target.value })}
                   onBlur={(e) => { if (e.target.value !== f.starts_on) setF({ ...f, starts_on: e.target.value }) }}
                   className="field" />
          </label>
          {f.weekdays.length > 0 && (
            <label className="block">
              <span className="field-label">{t('cal.f_until')}</span>
              <input type="date" data-hook="cal-f-until" value={f.until_on} min={f.starts_on}
                     onChange={(e) => setF({ ...f, until_on: e.target.value })}
                     onBlur={(e) => { if (e.target.value !== f.until_on) setF({ ...f, until_on: e.target.value }) }}
                     className="field" />
            </label>
          )}
        </div>

        {/**
         * PREVIENS-MOI, SUR CET EVENEMENT-LA.
         *
         * Demande avec le cas: "mon frere il oublie tout le temps qu'il a
         * soccer". Un rappel par evenement plutot qu'un reglage global, parce
         * que ce n'est pas tout l'agenda qu'on oublie, c'est une chose.
         *
         * Offert seulement quand l'evenement a une heure. "Trente minutes
         * avant" un truc qui dure toute la journee se calculerait depuis
         * minuit et partirait a 23h30 la veille, donc le champ disparait
         * plutot que de proposer un reglage qui ment.
         */}
        {minutesOf(f.start) != null && (
          <label className="mt-4 block sm:max-w-[22rem]" data-hook="event-remind">
            <span className="field-label">{t('cal.f_remind')}</span>
            <select
              value={f.remind_min}
              onChange={(e) => setF({ ...f, remind_min: e.target.value })}
              className="field"
            >
              <option value="">{t('cal.remind_none')}</option>
              <option value="0">{t('remind.lead_0')}</option>
              <option value="10">{t('water.every_m', { m: 10 })}</option>
              <option value="15">{t('water.every_m', { m: 15 })}</option>
              <option value="30">{t('water.every_m', { m: 30 })}</option>
              <option value="60">{t('water.every_h', { h: 1 })}</option>
              <option value="120">{t('water.every_h', { h: 2 })}</option>
              <option value="1440">{t('remind.lead_day')}</option>
            </select>
            <span className="field-note">
              {f.remind_min === '' ? t('cal.remind_hint') : t('cal.remind_on', {
                n: f.weekdays.length ? t('cal.remind_each') : t('cal.remind_once'),
              })}
            </span>
          </label>
        )}
        </div>

        {/**
         * ENREGISTRER RESTE A L'ECRAN.
         *
         * Le bouton etait a la fin du defilement, donc sur un telephone ou le
         * dialogue est plafonne a 92dvh il fallait descendre tout le
         * formulaire pour finir ce qu'on venait de remplir. Le wizard d'a cote
         * epinglait deja le sien sous le trait; c'est la meme coque, c'est
         * maintenant le meme bas de page.
         *
         * L'erreur vit ici plutot qu'au-dessus du bouton: c'est la reponse a
         * l'appui sur Enregistrer, et elle etait affichee a un endroit qui
         * pouvait etre hors de l'ecran au moment ou elle apparaissait.
         */}
        <div className="flex flex-wrap items-center gap-2 border-t border-hairline px-5 py-4">
          <button type="submit" disabled={busy} className="goal-action-done press">
            {busy ? t('cal.saving') : t('cal.save')}
          </button>
          <button type="button" onClick={onClose} className="goal-action press">
            {t('cal.cancel')}
          </button>
          {error && (
            <p className="text-safe w-full text-small text-negative" role="alert">
              {error}
            </p>
          )}
        </div>
      </form>
      </section>
    </div>,
    document.body,
  )
}
