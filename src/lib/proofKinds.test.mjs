import {
  DEFAULT_PROOF,
  PROOF_TYPES,
  hasProof,
  isValidLink,
  linkHost,
  normaliseLink,
  proofFields,
  proofFilled,
  proofOf,
  proofTypeOf,
} from './proofKinds.js'

let pass = 0, fail = 0
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  ok ? pass++ : fail++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`)
}

// ---- which proof a goal wants -----------------------------------------------
eq('the kinds are the four', PROOF_TYPES, ['photo', 'link', 'text', 'none'])
eq('a goal says what it wants',   proofTypeOf({ proof_type: 'link' }), 'link')
eq('none is a real answer',       proofTypeOf({ proof_type: 'none' }), 'none')
// A goal written before migration 28 has no column, and must keep offering
// exactly what it offered yesterday.
eq('a goal from before 28 wants a photo', proofTypeOf({ commitment: 'x' }), 'photo')
eq('so does no goal at all',              proofTypeOf(null), DEFAULT_PROOF)
eq('and so does nonsense',                proofTypeOf({ proof_type: 'interpretive dance' }), 'photo')

// ---- links, as people actually type them ------------------------------------
eq('a full url survives', normaliseLink('https://github.com/a/b'), 'https://github.com/a/b')
eq('http is left alone',  normaliseLink('http://example.com/x'), 'http://example.com/x')
// Nobody types the scheme. Without this the anchor resolves against our own
// origin and the proof link opens rich-and-friends.app/github.com/...
eq('a bare host gets https', normaliseLink('github.com/me/thing'), 'https://github.com/me/thing')
eq('and so does a bare domain', normaliseLink('strava.com'), 'https://strava.com/')
eq('surrounding space goes', normaliseLink('  example.com/a  '), 'https://example.com/a')

eq('nothing is not a link',   normaliseLink(''), null)
eq('null is not a link',      normaliseLink(null), null)
eq('spaces are not a link',   normaliseLink('   '), null)
// A hostname with no dot is either a typo or an intranet name, and neither is
// evidence four other people can open.
eq('a word is not a link',    normaliseLink('hello'), null)
eq('a sentence is not a link', normaliseLink('I went to the gym'), null)

// The reason the scheme is tested before https is bolted on: otherwise
// "javascript:alert(1)" becomes "https://javascript:alert(1)", which parses
// as an ordinary URL with a strange host and would be rendered as an href on
// four other people's screens.
eq('javascript is refused', normaliseLink('javascript:alert(1)'), null)
eq('data is refused',       normaliseLink('data:text/html,<script>'), null)
eq('file is refused',       normaliseLink('file:///etc/passwd'), null)
eq('mailto is refused',     normaliseLink('mailto:a@b.com'), null)
eq('a schemeless host is not a scheme', normaliseLink('news.ycombinator.com/item?id=1'), 'https://news.ycombinator.com/item?id=1')

eq('valid says valid',   isValidLink('example.com'), true)
eq('invalid says so',    isValidLink('nope'), false)
eq('and refuses script', isValidLink('javascript:alert(1)'), false)

// ---- what a tile shows -------------------------------------------------------
eq('the host is the readable part', linkHost('https://www.strava.com/activities/123?x=1'), 'strava.com')
eq('www is dropped',                linkHost('www.github.com/a'), 'github.com')
eq('a bad link has no host',        linkHost('nope'), '')

// ---- what is actually on an item --------------------------------------------
eq('a photo is a photo', proofOf({ photo_url: 'u' }), { kind: 'photo', value: 'u' })
eq('a link is a link',   proofOf({ link_url: 'https://x.com/' }), { kind: 'link', value: 'https://x.com/' })
eq('a note is a note',   proofOf({ evidence: 'went' }), { kind: 'text', value: 'went' })
eq('nothing is nothing', proofOf({}), null)
eq('no item is nothing', proofOf(null), null)
eq('blank text is nothing', proofOf({ evidence: '   ' }), null)

// Read from what was stored, not from what the goal asks for now: a goal
// switched from photo to link still has last month's photographs on it.
eq('a photo wins over a note', proofOf({ photo_url: 'u', evidence: 'caption' }).kind, 'photo')
eq('a photo wins over a link', proofOf({ photo_url: 'u', link_url: 'https://x.com/' }).kind, 'photo')
eq('a link wins over a note',  proofOf({ link_url: 'https://x.com/', evidence: 'n' }).kind, 'link')

eq('hasProof agrees',        hasProof({ photo_url: 'u' }), true)
eq('and on an empty item',   hasProof({}), false)

// ---- is the control satisfied? ----------------------------------------------
eq('a photo goal wants a photo',  proofFilled({ photo_url: 'u' }, 'photo'), true)
eq('and is not fooled by a note', proofFilled({ evidence: 'x' }, 'photo'), false)
eq('a link goal wants a link',    proofFilled({ link_url: 'example.com' }, 'link'), true)
eq('and refuses a sentence',      proofFilled({ link_url: 'I did it' }, 'link'), false)
eq('a text goal wants text',      proofFilled({ evidence: 'x' }, 'text'), true)
eq('and refuses whitespace',      proofFilled({ evidence: '  ' }, 'text'), false)
eq('a goal wanting none is never filled', proofFilled({ photo_url: 'u' }, 'none'), false)
eq('an empty answer is not filled', proofFilled({}, 'photo'), false)
eq('no answer at all is not filled', proofFilled(undefined, 'text'), false)

// ---- what goes to the server -------------------------------------------------
eq(
  'a photo goal sends the photo',
  proofFields({ photo_url: 'u', evidence: 'caption' }, 'photo'),
  { evidence: 'caption', photo_url: 'u', link_url: null },
)
eq(
  'a link goal sends a normalised link',
  proofFields({ link_url: 'github.com/a' }, 'link'),
  { evidence: null, photo_url: null, link_url: 'https://github.com/a' },
)
eq(
  'a text goal sends only the note',
  proofFields({ evidence: 'sat with it' }, 'text'),
  { evidence: 'sat with it', photo_url: null, link_url: null },
)

// A goal switched from link to photo must not keep posting whatever was left
// in the link box before the switch.
eq(
  'the other fields are dropped',
  proofFields({ photo_url: 'u', link_url: 'old.com' }, 'photo'),
  { evidence: null, photo_url: 'u', link_url: null },
)
eq(
  'a goal wanting none sends neither',
  proofFields({ photo_url: 'u', link_url: 'a.com' }, 'none'),
  { evidence: null, photo_url: null, link_url: null },
)
// evidence is carried whatever the kind: it doubles as the caption on a
// photograph, which is what evidence_def has always prompted for.
eq('a caption survives on a link goal', proofFields({ link_url: 'a.com', evidence: 'cap' }, 'link').evidence, 'cap')
eq('an unfilled link is null, not empty string', proofFields({ link_url: '' }, 'link').link_url, null)
eq('a blank note is null, not empty string',     proofFields({ evidence: '  ' }, 'text').evidence, null)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
