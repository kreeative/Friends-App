import {
  EDGE_PAD,
  RECENT_MAX,
  addRecent,
  clampSpot,
  defaultSpot,
  emptyPalette,
  isHex,
  normaliseHex,
  readPalette,
} from './palette.js'

let pass = 0, fail = 0
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  ok ? pass++ : fail++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`)
}

// ---- colours -----------------------------------------------------------------
eq('six digits pass',        normaliseHex('#A1B2C3'), '#a1b2c3')
eq('and are lowercased',     normaliseHex('#FFFFFF'), '#ffffff')
eq('no hash is fine',        normaliseHex('a1b2c3'), '#a1b2c3')
eq('space is fine',          normaliseHex('  #a1b2c3 '), '#a1b2c3')
// Expanded rather than kept short, so everything downstream sees one shape.
eq('three digits expand',    normaliseHex('#abc'), '#aabbcc')
eq('and expand correctly',   normaliseHex('#f00'), '#ff0000')

eq('four digits are not a colour', normaliseHex('#abcd'), null)
eq('letters past f are not',       normaliseHex('#gggggg'), null)
eq('a word is not',                normaliseHex('red'), null)
eq('nothing is not',               normaliseHex(''), null)
eq('null is not',                  normaliseHex(null), null)
// This is what guards the value that ends up in an inline background and in
// the `c` field of every stroke, and it comes back out of editable storage.
eq('a script is not a colour', normaliseHex('"><script>'), null)
eq('isHex agrees',             isHex('#abc'), true)
eq('and disagrees',            isHex('nope'), false)

// ---- recent colours ----------------------------------------------------------
eq('the first colour starts the list', addRecent([], '#ff0000'), ['#ff0000'])
eq('newest goes first',   addRecent(['#ff0000'], '#00ff00'), ['#00ff00', '#ff0000'])
// Re-picking moves it to the front rather than adding a second copy, which is
// what stops the row filling with one afternoon of near-identical greens.
eq('re-picking moves, not duplicates', addRecent(['#00ff00', '#ff0000'], '#ff0000'), ['#ff0000', '#00ff00'])
eq('and matches case-insensitively',   addRecent(['#ff0000'], '#FF0000'), ['#ff0000'])
eq('and matches short form',           addRecent(['#ff0000'], '#f00'), ['#ff0000'])

const many = ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666']
eq('the list is capped', addRecent(many, '#777777').length, RECENT_MAX)
eq('and the oldest falls off', addRecent(many, '#777777').includes('#666666'), false)
eq('while the newest is kept', addRecent(many, '#777777')[0], '#777777')

eq('rubbish is refused',      addRecent(['#ff0000'], 'nope'), ['#ff0000'])
eq('and does not break a bad list', addRecent(null, '#ff0000'), ['#ff0000'])

// ---- where the palette sits --------------------------------------------------
const size = { w: 300, h: 60, vw: 1000, vh: 800 }
eq('a spot in the middle is left alone', clampSpot({ x: 400, y: 400 }, size), { x: 400, y: 400 })
eq('negative is pulled in',   clampSpot({ x: -50, y: -50 }, size), { x: EDGE_PAD, y: EDGE_PAD })
eq('past the right is pulled in', clampSpot({ x: 5000, y: 10 }, size), { x: 1000 - 300 - EDGE_PAD, y: 10 })
eq('past the bottom too',     clampSpot({ x: 10, y: 5000 }, size), { x: 10, y: 800 - 60 - EDGE_PAD })

// Rotating a tablet is exactly the case this exists for: without it the
// toolbar from landscape sits entirely outside a portrait viewport with no
// way to fetch it back.
eq(
  'a landscape spot survives rotation',
  clampSpot({ x: 900, y: 60 }, { w: 300, h: 60, vw: 820, vh: 1180 }),
  { x: 820 - 300 - EDGE_PAD, y: 60 },
)

// A palette wider than the screen still has to land somewhere usable rather
// than at a negative coordinate.
eq('a palette wider than the screen pins left', clampSpot({ x: 40, y: 40 }, { w: 900, h: 60, vw: 400, vh: 700 }).x, EDGE_PAD)
eq('fractions are rounded', clampSpot({ x: 12.6, y: 4.2 }, size), { x: 13, y: EDGE_PAD })
eq('a missing spot lands at the pad', clampSpot(null, size), { x: EDGE_PAD, y: EDGE_PAD })

// Never placed: bottom centre, where a thumb is and where PencilKit puts it.
const d = defaultSpot(size)
eq('the default is horizontally centred', d.x, Math.round((1000 - 300) / 2))
eq('and near the bottom',                 d.y > 700, true)
eq('and still on screen',                 d.y <= 800 - 60 - EDGE_PAD, true)

// ---- reading it back ---------------------------------------------------------
eq('nothing stored is the empty palette', readPalette(null), emptyPalette())
eq('a string is not a palette',           readPalette('nope'), emptyPalette())
eq(
  'a whole palette survives',
  readPalette({ spot: { x: 10, y: 20 }, collapsed: true, recent: ['#ABC'] }),
  { spot: { x: 10, y: 20 }, collapsed: true, recent: ['#aabbcc'] },
)
// Every field is checked separately, so one bad value does not throw the
// other two away.
eq('a bad spot does not lose the colours', readPalette({ spot: { x: 'x' }, recent: ['#f00'] }).recent, ['#ff0000'])
eq('and the spot becomes null',            readPalette({ spot: { x: 'x' } }).spot, null)
eq('bad colours are dropped',              readPalette({ recent: ['#f00', 'nope', 42] }).recent, ['#ff0000'])
eq('duplicates in storage collapse',       readPalette({ recent: Array(20).fill('#111111') }).recent.length, 1)
eq('a too-long list is capped',            readPalette({ recent: ['#1a1a1a','#2a2a2a','#3a3a3a','#4a4a4a','#5a5a5a','#6a6a6a','#7a7a7a'] }).recent.length, RECENT_MAX)
eq('collapsed must be exactly true',       readPalette({ collapsed: 'yes' }).collapsed, false)
eq('and true is true',                     readPalette({ collapsed: true }).collapsed, true)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
