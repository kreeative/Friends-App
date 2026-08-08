/**
 * The twelve moods.
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

/** valence orders the grid: pleasant → flat → sharp, left to right, top to bottom. */
export const MOODS = [
  {
    id: 'excited',
    color: '#F79AC0',
    eyes: 'closed',
    mouth: 'smile',
    // circle
    path: 'M6 50a44 44 0 1 1 88 0a44 44 0 1 1-88 0Z',
  },
  {
    id: 'joyful',
    color: '#F2569F',
    eyes: 'closed',
    mouth: 'smile',
    // four petals
    path: 'M50 6a22 22 0 0 1 22 22a22 22 0 0 1 22 22a22 22 0 0 1-22 22a22 22 0 0 1-22 22a22 22 0 0 1-22-22a22 22 0 0 1-22-22a22 22 0 0 1 22-22a22 22 0 0 1 22-22Z',
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
    id: 'sensitive',
    color: '#0BA5EC',
    eyes: 'closed',
    mouth: 'flat',
    // dome
    path: 'M50 6a44 44 0 0 1 44 44v28a18 18 0 0 1-18 18H24A18 18 0 0 1 6 78V50A44 44 0 0 1 50 6Z',
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
    id: 'bored',
    color: '#0F8A3D',
    eyes: 'dots',
    mouth: 'flat',
    // wide ellipse
    path: 'M10 50a40 38 0 1 1 80 0a40 38 0 1 1-80 0Z',
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
    id: 'insecure',
    color: '#F07C1E',
    eyes: 'dots',
    mouth: 'frown',
    // diamond
    path: 'M50 6 94 50 50 94 6 50Z',
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

export const moodById = (id) => MOODS.find((m) => m.id === id) ?? null
