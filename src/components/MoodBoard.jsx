import { useState } from 'react'
import { MOODS, moodById, motionOf, toggleMood } from '../lib/moods'
import MoodGlyph from './MoodFace'
import { useT } from '../lib/i18n'

/**
 * "How are you today?". Seventeen shapes, as many taps as you like.
 *
 * Deliberately optional, and deliberately first. A check-in that opens with
 * twelve goals and a counter asks "did you perform"; opening with this asks
 * "how are you", which is the question that keeps someone in a group after a
 * fortnight where the answer to the first one is no.
 *
 * Nothing downstream requires it. Skipping it costs nothing and is not
 * recorded as a miss.
 */

/**
 * Where the two long labels are allowed to break.
 *
 * The measured problem: a grid cell is 66px at 320 and 89px at 390, and French
 * "Reconnaissant" sets at 99px. It does not fit at either width, so something
 * has to break it.
 *
 * `hyphens: auto` was supposed to, and cannot: it needs a hyphenation
 * dictionary for the document's language, and Chromium ships none for French.
 * With nothing to hyphenate by, `overflow-wrap: break-word` took over and
 * split the word at whatever character the line ran out on, with no hyphen at
 * all. That is what "Reconnaiss / ant" was.
 *
 * So the break points are given rather than derived. U+00AD is a SOFT hyphen:
 * invisible unless the browser actually needs the break, and drawn as a real
 * hyphen when it does. Keyed on the rendered word rather than the mood id,
 * because it is the word that is too long, and the English labels are not.
 *
 * This lives here and not in the i18n table on purpose. The same string is the
 * accessible name of every mood badge in the app, and a table nobody expects to
 * contain invisible characters is a bad place to put them.
 */
const SOFT = {
  Reconnaissant: 'Recon\u00ADnais\u00ADsant',
  Nostalgique: 'Nostal\u00ADgique',
  /* Added with the mood itself. "Decourage" measures 73px against a 66px cell
     at 320, so it was going to break somewhere; given the choice it breaks
     where French breaks it. "Discouraged" is the first English label long
     enough to need this, which is why the note above says the English ones do
     not: that stopped being true. */
  'Découragé': 'Décou\u00ADragé',
  Discouraged: 'Discour\u00ADaged',
}
const softWrap = (label) => SOFT[label] ?? label

/**
 * @param value     the selected mood ids, as an array
 * @param onChange  called with the next array. Undo is tapping again, and it
 *                  has to be as cheap as choosing
 *
 * MULTI-SELECT, AND WHY THE ROLES CHANGED WITH IT.
 *
 * This was a radiogroup, which is the correct role for one-of-many and the
 * wrong one for any-of-many: a screen reader announcing "radio button" tells
 * somebody that picking a second will drop the first, which is exactly the
 * thing that is no longer true. Toggle buttons with aria-pressed say what this
 * now is.
 *
 * GROUPED, BECAUSE SEVENTEEN IN ONE RUN IS A WALL.
 *
 * Twelve ordered by valence carried the meaning implicitly and just about held
 * together. Seventeen does not: the eye has nowhere to land and the pleasant end
 * and the hard end are the same undifferentiated grid. Three headings give it
 * somewhere, and the order is deliberate, the good ones first, because a
 * picker that opens on "en colère" is one that reads as an accusation before
 * anybody has answered.
 *
 * ANY-OF-MANY, AND ONLY THAT.
 *
 * There used to be a one-of-many mode here, with radio roles, for the journal
 * editor: an entry was about one moment rather than a whole day, so its mood
 * was a single column. The journal is gone and the daily card is the only
 * caller left, so the mode went with it rather than sitting here as a branch
 * nothing takes. A day holds more than one feeling, so the buttons are
 * toggles and the answer is an array.
 */
export default function MoodBoard({ value, onChange }) {
  const { t } = useT()
  const chosen = Array.isArray(value) ? value : value ? [value] : []

  /**
   * QUELLE TUILE EST EN TRAIN DE JOUER, ET COMBIEN DE FOIS ON LUI A DEMANDE.
   *
   *   "So when you click on them, they make the face, like they reproduce the
   *    emotion."
   *
   * Le compteur n'est pas du zele: il sert de `key`, donc un deuxieme appui
   * pendant que le geste tourne REMONTE le noeud et rejoue depuis le debut.
   * Sans lui, remettre la meme classe sur le meme element ne relance rien, et
   * la deuxieme tape ne fait rien du tout, ce qui se lit comme un bouton mort.
   *
   * Un seul etat pour les dix-huit, pas un par tuile: il n'y a qu'un doigt.
   *
   * Le geste joue aussi quand on DECOCHE. Enlever une humeur est une reponse
   * comme une autre, et une tuile qui ne repond que dans un sens se lit comme
   * une tuile qui a rate le tap.
   */
  const [beat, setBeat] = useState({ id: null, n: 0 })

  return (
    /**
     * ONE RUN, NO HEADINGS.
     *
     * Three labelled bands used to sit here. They asked somebody to agree with
     * the app about which category their own day belonged to before they had
     * said anything, and the boundary between "Entre les deux" and "Difficile"
     * was never one two people would draw in the same place. The catalogue is
     * already ordered brightest to hardest, so the gradient says everything the
     * headings were saying and makes no claim about where the lines are.
     *
     * Three across on a phone, four from `sm` up.
     *
     * Four columns on a 390px screen leaves each face about 82px, and
     * "Reconnaissant" and "Plein d'énergie" are wider than that, so the labels
     * ran into their neighbours and the row became unreadable. Three columns
     * give each one about 110px, which every label in both languages fits
     * inside on at most two lines.
     *
     * The row gap is larger than the column gap on purpose. Labels that wrap to
     * a second line need the vertical room; giving them the same horizontal
     * room would cost the width that stopped them colliding.
     */
    <div
      role="group"
      /* The question itself, which MoodToday renders as the visible heading
         directly above. With the band headings gone this group had no name at
         all, and a screen reader would have announced seventeen toggles with
         nothing saying what they were for. */
      aria-label={t('mood.question_day')}
      data-hook="mood-grid"
      /* stagger: les visages arrivent en cascade plutot que d'un bloc. Le
         geste de selection vit sur un span a l'interieur du bouton, donc
         l'animation d'entree posee ici ne se dispute pas `transform` avec lui.
         Voir la note des deux boites plus bas. */
      className="stagger grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 sm:gap-x-2"
    >
      {MOODS.map((mood) => {
              const selected = chosen.includes(mood.id)
              return (
                <button
                  key={mood.id}
                  type="button"
                  /* Un hook a lui, parce que la regle du depot le demande: un
                     selecteur accroche a une classe a casse a chaque restyle de
                     cette base, et le libelle ne marche pas non plus ici, il
                     change avec la langue. */
                  data-mood={mood.id}
                  aria-pressed={selected}
                  onClick={() => {
                    setBeat((b) => ({ id: mood.id, n: b.n + 1 }))
                    onChange(toggleMood(chosen, mood.id))
                  }}
                  className="press group flex flex-col items-center rounded-inner py-1 text-center"
                >
                  {/* A fixed box, not a fraction of the column. The glyphs have
                      to line up across rows whatever the label under them does. */}
                  <span
                    className={`block h-14 w-14 shrink-0 transition-transform duration-200 ease-settle ${
                      selected ? 'scale-110' : 'group-hover:scale-105'
                    }`}
                    style={{
                      filter: selected
                        ? `drop-shadow(0 4px 10px ${mood.color}66)`
                        : 'drop-shadow(0 1px 2px rgb(0 0 0 / 0.12))',
                    }}
                  >
                    {/**
                     * DEUX BOITES, ET C'EST CE QUI PERMET LES DEUX MOUVEMENTS.
                     *
                     * Celle du dessus porte `scale-110`, l'etat "choisi", en
                     * transition. Celle-ci porte le geste, en animation. Les
                     * deux ecrivent `transform`, et sur un seul element la
                     * derniere declaree gagne: l'animation aurait avale le
                     * grossissement pendant qu'elle joue, donc la tuile aurait
                     * retreci d'un dixieme a chaque tape avant de repartir.
                     * Imbriquees, les deux transformations se composent.
                     */}
                    <span
                      key={beat.id === mood.id ? `b${beat.n}` : 'rest'}
                      className={`mood-act block h-full w-full ${
                        beat.id === mood.id ? motionOf(mood.id) : ''
                      }`}
                      /* Retiree a la fin, pour que la tuile revienne a un etat
                         sans animation: c'est ce qui rend la suivante possible
                         et ce qui evite de laisser dix-huit `will-change` en
                         place sur une grille que plus personne ne touche. */
                      onAnimationEnd={() =>
                        setBeat((b) => (b.id === mood.id ? { id: null, n: b.n } : b))
                      }
                    >
                      <MoodGlyph mood={mood} playing={beat.id === mood.id} />
                    </span>
                  </span>
                  {/* Selection is carried by the fill behind the label, not by
                      colour on the glyph, the glyph is already the mood's own
                      colour and has nowhere left to go.

                      rounded-inner rather than a pill: a pill radius on a label
                      that has wrapped to two lines reads as a lozenge with the
                      text falling out of it. */}
                  <span
                    /* w-full, not a max-width. A max-width wider than the grid
                       cell is not a limit at all: "Reconnaissant" simply ran out
                       past the right edge of the card. The cell is the limit, so
                       the label takes the cell and wraps inside it. px-1 rather
                       than px-2 buys the eight pixels that keep that word on one
                       line. */
                    /* break-words is GONE. It was the thing snapping words in
                       half: it breaks at whatever character the line runs out
                       on, with no hyphen, so "Reconnaissant" rendered as
                       "Reconnaiss" over "ant". hyphens-auto stays as a bonus
                       where a dictionary exists; softWrap below is what
                       actually does the work. */
                    className={`mt-2 w-full hyphens-auto rounded-inner px-1 py-0.5 text-label font-semibold leading-tight ${
                      selected ? 'bg-ink text-bg' : 'text-muted'
                    }`}
                  >
                    {softWrap(t(`mood.${mood.id}`))}
                  </span>
                </button>
              )
      })}
    </div>
  )
}

/* MoodBadge, the single-mood version, is gone. Its three callers (the group
   card, the week panel and the day recap) all read one id when the day had
   held several since migration 36, and fixing that made every one of them a
   MoodBadges call. A one-element array renders identically, so keeping a
   second component whose only remaining property is that it CANNOT show the
   second feeling would be keeping the bug available. */

/**
 * All of today's moods, at rest.
 *
 * Overlapped rather than spaced, so four faces read as one answer with several
 * parts rather than as four separate statements. The z-order runs left to right
 * so each tucks behind the next, the same trick the sign-in stickers use.
 *
 * The names go on one label for the set instead of one each: a screen reader
 * reading "joyful, image, impatient, image" is reading the implementation.
 */
export function MoodBadges({ ids = [], size = 28 }) {
  const { t } = useT()
  const list = (Array.isArray(ids) ? ids : [ids]).filter((id) => moodById(id))
  if (list.length === 0) return null

  return (
    <span className="inline-flex items-center align-middle" aria-label={list.map((id) => t(`mood.${id}`)).join(', ')}>
      {list.map((id, i) => (
        <span
          key={id}
          style={{ width: size, height: size, zIndex: list.length - i, marginLeft: i === 0 ? 0 : -size * 0.28 }}
          className="relative block shrink-0"
          aria-hidden="true"
        >
          <MoodGlyph mood={moodById(id)} />
        </span>
      ))}
    </span>
  )
}
