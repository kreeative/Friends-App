/**
 * The moods.
 *
 * On colour, and the rule this appears to break:
 *
 * The theme system exists to keep exactly one accent on screen, because a
 * page showing pink and yellow and blue at once has no accent, it has
 * decoration. This grid puts twelve colours up at once, so it needs a better
 * reason than "the reference did it".
 *
 * It has the same reason `--c-green` has. Green is not themeable because
 * "checked in this week" is a fact about the world rather than a matter of
 * taste, and it has to keep meaning the same thing in every theme. Mood
 * colour is the same kind of thing: warm-bright for the pleasant end,
 * cool-mid for the flat end, hot-orange for the sharp end. That mapping is
 * doing work (it is how the grid is scannable at all) and it would be
 * destroyed by tinting all twelve in the chosen accent.
 *
 * So: a semantic palette, declared once here, exempt from the accent for the
 * same reason green is, and used nowhere else in the app.
 *
 * On shape:
 *
 * Every mood also has its own silhouette. Colour alone would put the whole
 * feature out of reach of anyone who cannot separate these hues. About one
 * man in twelve, and the labels are the belt, but the shapes are the
 * braces. They are why this reads at a glance rather than requiring the
 * caption to be read every time.
 *
 * Paths are all drawn in a 100×100 box. `round` linejoin does the corner
 * rounding on the straight-edged ones, so the polygons do not need their
 * corners modelled.
 */



/**
 * THE ARRAY ORDER IS A GRADIENT, AND IT IS LOAD-BEARING.
 *
 * These were split into three named bands with headings over them: Positif,
 * Entre les deux, Difficile. The headings are gone and this is one run from
 * the brightest to the hardest, because the bands were doing something the
 * order already did, and doing it worse: a heading that says "Difficile" over
 * nine faces asks somebody to file their own day into a category before they
 * have said anything, and the line between "Entre les deux" and "Difficile"
 * was never a line anybody else would have drawn in the same place.
 *
 * A gradient makes no claim about where the boundaries are. It just runs.
 *
 * The order is what cleanMoods sorts by, so it decides two visible things: the
 * left-to-right order of the badges on a day, and which one primaryMood hands
 * to daily_mood.mood, which is the single face the group board and the week
 * strip draw. Rearranging this therefore rearranges what some existing days
 * look like to other people. That is the intended cost of picking a better
 * order, not an accident: nothing is stored by position, and every id in the
 * database still resolves.
 */
export const MOODS = [
  {
    id: 'joyful',
    color: '#F2569F',
    eyes: 'closed',
    mouth: 'smile',
    // four petals
    path: 'M50 6a22 22 0 0 1 22 22a22 22 0 0 1 22 22a22 22 0 0 1-22 22a22 22 0 0 1-22 22a22 22 0 0 1-22-22a22 22 0 0 1-22-22a22 22 0 0 1 22-22a22 22 0 0 1 22-22Z',
  },
  {
    id: 'energized',
    color: '#A78BDA',
    eyes: 'closed',
    mouth: 'smile',
    // three lobes over a rounded base. The arcs are elliptical rather than
    // circular so the lobes reach the top of the box without eating the
    // body, a circular arc wide enough to span a third of the width is
    // only ever 16 tall, and the face ends up sitting on the rim.
    path: 'M4 36a15.3 24 0 0 1 30.7 0a15.3 24 0 0 1 30.7 0a15.3 24 0 0 1 30.6 0v48a12 12 0 0 1-12 12H16A12 12 0 0 1 4 84Z',
  },
  {
    id: 'excited',
    color: '#F79AC0',
    eyes: 'closed',
    mouth: 'smile',
    // circle
    path: 'M6 50a44 44 0 1 1 88 0a44 44 0 1 1-88 0Z',
  },
  {
    id: 'grateful',
    color: '#8B5CD6',
    eyes: 'closed',
    mouth: 'smile',
    // squircle
    path: 'M50 4c28 0 46 18 46 46s-18 46-46 46S4 78 4 50 22 4 50 4Z',
  },
  {
    id: 'serene',
    color: '#3FBFB0',
    eyes: 'closed',
    mouth: 'smile',
    // capsule, lying down. The only horizontal shape in the set, which is what
    // makes calm read as calm before the label is read.
    path: 'M36 20h28a30 30 0 0 1 0 60H36a30 30 0 0 1 0-60Z',
  },
  {
    id: 'neutral',
    color: '#8797A6',
    eyes: 'dots',
    mouth: 'flat',
    // octagon: the most even-sided thing available, which is the point.
    path: 'M32 8h36l24 24v36l-24 24H32L8 68V32Z',
  },
  {
    id: 'nostalgic',
    color: '#B384BC',
    eyes: 'closed',
    mouth: 'flat',
    // pentagon, point up. Leaning without falling either way.
    path: 'M50 6 92 38 76 92H24L8 38Z',
  },
  {
    id: 'sensitive',
    color: '#0BA5EC',
    eyes: 'closed',
    mouth: 'flat',
    // dome
    path: 'M50 6a44 44 0 0 1 44 44v28a18 18 0 0 1-18 18H24A18 18 0 0 1 6 78V50A44 44 0 0 1 50 6Z',
  },
  {
    id: 'bored',
    color: '#0F8A3D',
    eyes: 'dots',
    mouth: 'flat',
    // wide ellipse
    path: 'M10 50a40 38 0 1 1 80 0a40 38 0 1 1-80 0Z',
  },
  {
    id: 'confused',
    color: '#1B58D9',
    eyes: 'dots',
    mouth: 'flat',
    // hexagon
    path: 'M50 6 89 28v44L50 94 11 72V28Z',
  },
  {
    id: 'insecure',
    color: '#F07C1E',
    eyes: 'dots',
    mouth: 'frown',
    // diamond
    path: 'M50 6 94 50 50 94 6 50Z',
  },
  {
    id: 'stressed',
    color: '#17A55C',
    eyes: 'squint',
    mouth: 'flat',
    // triangle
    path: 'M50 8 92 84H8Z',
  },
  {
    id: 'angry',
    color: '#E8500F',
    eyes: 'squint',
    mouth: 'frown',
    // rounded square
    path: 'M22 8h56a14 14 0 0 1 14 14v56a14 14 0 0 1-14 14H22A14 14 0 0 1 8 78V22A14 14 0 0 1 22 8Z',
  },
  {
    id: 'discouraged',
    color: '#A9856B',
    eyes: 'dots',
    mouth: 'frown',
    // trapezoid, wide at the top and narrow at the foot: the one shape here
    // that is visibly running out. Left as a plain polygon because the glyph
    // paints a 6px stroke with a round join, which rounds the corners for
    // free, the same way the triangle and the diamond get theirs.
    path: 'M12 12H88L72 88H28Z',
  },
  {
    id: 'sad',
    color: '#6B84A8',
    eyes: 'closed',
    mouth: 'frown',
    // teardrop, point up. The only shape in the set that comes to a point at
    // the top, and the one whose meaning is legible before the label is read.
    // The bowl is a circle of r40 centred at y60, so it is 75 wide at the eye
    // line and the face sits in it without touching the sides.
    path: 'M50 4C62 26 90 42 90 60A40 40 0 1 1 10 60C10 42 38 26 50 4Z',
  },
  {
    id: 'hurt',
    color: '#F5A623',
    eyes: 'closed',
    mouth: 'frown',
    // lobed top and bottom, same elliptical trick as energized
    path: 'M4 32a15.3 20 0 0 1 30.7 0a15.3 20 0 0 1 30.7 0a15.3 20 0 0 1 30.6 0v36a15.3 20 0 0 1-30.6 0a15.3 20 0 0 1-30.7 0a15.3 20 0 0 1-30.7 0Z',
  },
  {
    id: 'guilty',
    color: '#FBC02D',
    eyes: 'dots',
    mouth: 'frown',
    // quarter-round. The one big corner has to be much larger than the other
    // three or it just reads as another rounded square.
    path: 'M10 90V42A32 32 0 0 1 42 10h36a12 12 0 0 1 12 12v56a12 12 0 0 1-12 12Z',
  },
]

export const MOOD_IDS = MOODS.map((m) => m.id)

/**
 * How many one day may carry.
 *
 * The whole set, so this can only be hit by something that is not a person
 * tapping faces. An unbounded array in a row anybody can create for free is
 * the shape of a table that grows in a way nobody planned.
 */
export const MAX_MOODS = MOODS.length

/**
 * A stored value, made safe to render.
 *
 * Anything can be in that column: a row from before the array existed, an id a
 * later build knows and this one does not, or something edited by hand.
 * Unknown ids are dropped rather than drawn, because moodById returns null for
 * them and a badge that renders nothing beside three that do reads as a
 * rendering fault.
 *
 * Order is the catalogue's, not the tap order, so two days carrying the same
 * two moods look identical whichever way round they were chosen.
 */
export function cleanMoods(raw) {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : []
  const seen = new Set()
  for (const id of list) if (MOOD_IDS.includes(id)) seen.add(id)
  return MOOD_IDS.filter((id) => seen.has(id))
}

/**
 * Tapping a face.
 *
 * On when it was off, off when it was on. Unknown ids are refused rather than
 * added, so a stale tab cannot write a value the check constraint will reject.
 */
export function toggleMood(list, id) {
  if (!MOOD_IDS.includes(id)) return cleanMoods(list)
  const now = cleanMoods(list)
  return cleanMoods(now.includes(id) ? now.filter((x) => x !== id) : [...now, id])
}

/**
 * The one that stands for the rest.
 *
 * daily_mood.mood is `not null` and has been read as a single value by the
 * week strip and the group board since migration 12. Rather than making every
 * one of those handle an array, the first of the set stays in that column and
 * the full set lives beside it. First in CATALOGUE order, not tap order, so
 * the face somebody's group sees does not depend on which one they happened to
 * press first.
 */
export const primaryMood = (list) => cleanMoods(list)[0] ?? null

export const moodById = (id) => MOODS.find((m) => m.id === id) ?? null
