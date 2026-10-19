/**
 * node src/lib/bb/server.test.mjs
 *
 * Beauty & Brain's server code, without a server, a database or a model:
 *
 *   - files: PowerPoint read in the order the student sees it with the right
 *     notes, Word, subtitles, and the refusals with their reasons;
 *   - ingestion: grounding checked in code (a concept with no excerpt is
 *     dropped, a definition keeps only an anchor it really has, a signal
 *     raises its concept's weight, free flashcards from the professor's own
 *     definitions);
 *   - generation: what an item looks like whatever the model returned;
 *   - billing: the plan read off a Stripe subscription, the row written, the
 *     return address;
 *   - the model call: strict schema first, the same request without it on a
 *     400, refusals and truncation named, never thrown.
 */
import { strToU8, zipSync } from 'fflate'
import { blockFor, captionText, docxText, pptxText } from '../../../api/_bb/files.js'
import { writeMap } from '../../../api/_bb/ingest.js'
import { shape } from '../../../api/_bb/generate.js'
import { originOf, planOf, subscriptionRow } from '../../../api/_bb/billing.js'
import { AI_PAUSED, aiPaused, keyMap, looseJson, start, structured } from '../../../api/_bb/common.js'
import { courseContext } from '../../../api/_bb/coach.js'
import { bbPreviewHtml } from '../../../api/_bb/preview.js'
import { formatLine, generatorSystem } from '../../../api/_bb/prompts.js'
import { readFileSync } from 'node:fs'
import { checkItem } from './quality.js'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass += 1
  else {
    fail += 1
    console.error(`  FAIL  ${name}${extra ? `  ${extra}` : ''}`)
  }
}
const eq = (name, a, b) => ok(name, JSON.stringify(a) === JSON.stringify(b), `got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`)

console.log('\nbeauty & brain, the server')

/* --- files ------------------------------------------------------------------ */
const slide = (...lines) => strToU8(`<p:sld>${lines.map((l) => `<a:p><a:r><a:t>${l}</a:t></a:r></a:p>`).join('')}</p:sld>`)
{
  const deck = zipSync({
    'ppt/slides/slide1.xml': slide('Membrane'),
    'ppt/slides/slide2.xml': slide('Osmose', 'L&apos;eau passe'),
    'ppt/slides/slide10.xml': slide('Bilan'),
    'ppt/notesSlides/notesSlide2.xml': slide('2', 'Ça, je le demande à chaque examen.'),
  })
  const r = pptxText(deck)
  eq('three slides', r.pages, 3)
  ok('slide 10 comes after slide 2, not after slide 1', r.text.indexOf('Bilan') > r.text.indexOf('Osmose'))
  ok('entities are decoded', r.text.includes("L'eau passe"))
  ok('the notes are read, under their slide', /\[slide 2\][\s\S]*Notes:\nÇa, je le demande/.test(r.text))
  ok('the slide number repeated in the notes is dropped', !/Notes:\n2\n/.test(r.text))
  eq('text is not image-only', r.imageOnly, false)
}
{
  const reordered = zipSync({
    'ppt/slides/slide1.xml': slide('Shown second'),
    'ppt/slides/slide2.xml': slide('Shown first'),
    'ppt/presentation.xml': strToU8('<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId3"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst></p:presentation>'),
    'ppt/_rels/presentation.xml.rels': strToU8('<Relationships><Relationship Id="rId2" Target="slides/slide1.xml"/><Relationship Id="rId3" Target="slides/slide2.xml"/></Relationships>'),
    'ppt/slides/_rels/slide2.xml.rels': strToU8('<Relationships><Relationship Id="rId1" Target="../notesSlides/notesSlide7.xml"/></Relationships>'),
    'ppt/notesSlides/notesSlide7.xml': slide('The note of the first shown slide'),
  })
  const r = pptxText(reordered)
  ok('a moved slide is numbered where it is shown', /^\[slide 1\]\nShown first/.test(r.text))
  ok('and its notes come through its own rels, not its file number', /\[slide 1\]\nShown first\nNotes:\nThe note of the first shown slide/.test(r.text))
}
{
  const pictures = zipSync({ 'ppt/slides/slide1.xml': strToU8('<p:sld><p:pic/></p:sld>'), 'ppt/slides/slide2.xml': strToU8('<p:sld><p:pic/></p:sld>') })
  eq('a deck of pictures is refused with the fix', blockFor({ name: 'cours.pptx', bytes: pictures }).problem, 'pptx_images')
}
{
  const doc = zipSync({ 'word/document.xml': strToU8('<w:document><w:body><w:p><w:r><w:t>Guide d’étude</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">Chapitre </w:t></w:r><w:r><w:t>1</w:t></w:r></w:p></w:body></w:document>') })
  const r = docxText(doc)
  ok('Word paragraphs, runs joined', r.text.includes('Guide d’étude') && r.text.includes('Chapitre 1'))
  const b = blockFor({ name: 'guide.docx', bytes: doc })
  eq('sent as a text document', [b.block.type, b.block.source.type], ['document', 'text'])
}
{
  const vtt = 'WEBVTT\n\n1\n00:14:32.000 --> 00:14:35.000\nL’osmose, c’est le passage de l’eau.\n\n2\n01:02:03,500 --> 01:02:05,000\nÇa, je le demande.'
  const r = captionText(vtt)
  ok('a cue keeps its time as its place', r.includes('[14:32] L’osmose'))
  ok('hours become minutes: 01:02:03 is 62:03', r.includes('[62:03] Ça, je le demande.'))
  ok('cue numbers and the header are dropped', !/WEBVTT|^1$/m.test(r))
}
{
  const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])
  const b = blockFor({ name: 'cours.pdf', bytes: pdf })
  eq('a PDF goes as a base64 document', [b.block.type, b.block.source.type, b.block.source.media_type], ['document', 'base64', 'application/pdf'])
  eq('a file called .pdf that is not one is refused', blockFor({ name: 'cours.pdf', bytes: strToU8('hello') }).problem, 'not_pdf')
  eq('an empty file', blockFor({ name: 'a.pdf', bytes: new Uint8Array() }).problem, 'empty')
  eq('a HEIC photo', blockFor({ name: 'a.heic', bytes: strToU8('x') }).problem, 'heic')
  eq('a JPEG photo is an image block', blockFor({ name: 'notes.JPG', bytes: strToU8('x') }).block.source.media_type, 'image/jpeg')
  eq('pasted text needs no file', blockFor({ name: 'Notes collées', pasted: 'Bonjour' }).block.source.data, 'Bonjour')
}

/* --- ingestion: grounding checked in code -------------------------------------- */
function fakeDb() {
  const rows = {}
  const calls = []
  const from = (table) => ({
    insert: async (r) => {
      calls.push(['insert', table])
      rows[table] = [...(rows[table] ?? []), ...(Array.isArray(r) ? r : [r])]
      return { error: null }
    },
    upsert: async (r) => {
      calls.push(['upsert', table])
      rows[table] = [r]
      return { error: null }
    },
    update: (patch) => ({ eq: async () => (calls.push(['update', table, patch]), { error: null }) }),
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: rows[table]?.[0] ?? null }) }) }),
  })
  return { from, rows, calls }
}
{
  const db = fakeDb()
  const map = {
    language: 'fr',
    chapters: [{ key: 'C1', title: 'La membrane', summary: 'S' }, { key: 'C2', existing_id: 'old-ch', title: 'x' }, { key: 'C3', existing_id: 'not-mine', title: 'Nouveau' }],
    anchors: [
      { key: 'A1', label: 'diapo 6', excerpt: 'La membrane est une bicouche.' },
      { key: 'A2', label: '14:32', excerpt: 'L’osmose, je le demande à chaque examen.' },
      { key: 'A1', label: 'doublon', excerpt: 'ignored' },
      { key: 'A3', label: '', excerpt: 'no place, dropped' },
    ],
    concepts: [
      { key: 'K1', chapter_key: 'C1', name: 'Membrane', definition: 'Une bicouche.', definition_anchor: 'A1', kind: 'definition', anchors: ['A1'], importance: 1 },
      { key: 'K2', chapter_key: 'C2', name: 'Osmose', definition: 'Le passage de l’eau.', definition_anchor: 'A9', kind: 'process', anchors: ['A2'], importance: 2 },
      { key: 'K3', chapter_key: 'C1', name: 'Invented', definition: 'Nothing quotes this.', definition_anchor: null, kind: 'other', anchors: ['A7'], importance: 3 },
      { key: 'K4', chapter_key: 'C9', name: 'Lost chapter', definition: '', anchors: ['A1'], importance: 1, kind: 'weird' },
    ],
    twins: [{ a: 'K1', b: 'K2', separator: 'L’une est une structure, l’autre un mouvement.', anchors: ['A1', 'A2', 'A5'] }, { a: 'K1', b: 'K3', separator: 'K3 was dropped' }],
    signals: [{ concept_key: 'K2', quote: 'je le demande à chaque examen', anchor: 'A2', strength: 3 }, { concept_key: 'K1', quote: 'no anchor', anchor: 'A8', strength: 3 }],
    exam: { question_types: ['MCQ', 'short'], count: 60, minutes: 120, has_case: false, evidence: 'A2' },
  }
  const result = await writeMap(db, { user: { id: 'u1' }, course: { id: 'c1', stats: {} }, material: { id: 'm1', file_name: 'Cours 3.pdf' }, map, existing: [{ id: 'old-ch', position: 4 }], pages: 42 })
  eq('chapters: one new, one reused, one with an id that is not the student’s made new', [result.chapters, result.reused], [2, 1])
  eq('a new chapter is numbered after the existing ones', db.rows.bb_chapters.map((c) => c.position), [5, 6])
  eq('anchors: duplicate keys and empty places are dropped', db.rows.bb_anchors.map((a) => a.label), ['diapo 6', '14:32'])
  eq('a concept quoting nothing that exists is dropped (rule 1)', db.rows.bb_concepts.map((c) => c.name), ['Membrane', 'Osmose', 'Lost chapter'])
  eq('and counted', result.dropped, 1)
  const osmose = db.rows.bb_concepts.find((c) => c.name === 'Osmose')
  ok('a definition whose anchor does not exist loses the anchor, keeps the words', osmose.definition_anchor === null && osmose.definition === 'Le passage de l’eau.')
  eq('a concept goes to the chapter the model named, reused or new', osmose.chapter_id, 'old-ch')
  const lost = db.rows.bb_concepts.find((c) => c.name === 'Lost chapter')
  ok('an unknown chapter falls back to the first one', lost.chapter_id === db.rows.bb_chapters[0].id)
  eq('an unknown kind becomes other', lost.kind, 'other')
  eq('the professor’s signal raises the concept to its strength', osmose.weight, 3)
  eq('a signal without a real anchor is dropped', db.rows.bb_signals.length, 1)
  eq('a twin keeps only anchors that exist', db.rows.bb_twins[0].anchor_ids.length, 2)
  eq('a twin with a dropped concept is dropped', db.rows.bb_twins.length, 1)
  const cards = db.rows.bb_items
  eq('a free flashcard per quoted, anchored definition', cards.map((c) => c.stem), ['Membrane'])
  ok('in the professor’s words, marked as theirs', cards[0].answer.text === 'Une bicouche.' && cards[0].source === 'concept' && cards[0].quality === 'pass')
  ok('every inserted row belongs to the student and the course', ['bb_chapters', 'bb_anchors', 'bb_concepts', 'bb_twins', 'bb_signals', 'bb_items'].every((t) => db.rows[t].every((r) => r.user_id === 'u1' && r.course_id === 'c1')))
  const bp = db.rows.bb_blueprints[0].data
  eq('the exam format is merged into the blueprint, lower case', [bp.types, bp.count, bp.minutes], [['mcq', 'short'], 60, 120])
  eq('with its evidence', bp.evidence.length, 1)
  ok('the course language is set from the material', db.calls.some(([op, t, p]) => op === 'update' && t === 'bb_courses' && p.language === 'fr'))
  eq('what the reader reports', [result.anchors, result.concepts, result.signals, result.cards, result.pages], [2, 3, 1, 1, 42])
}
{
  const db = fakeDb()
  await writeMap(db, { user: { id: 'u1' }, course: { id: 'c1', stats: {}, language: 'en' }, material: { id: 'm1', file_name: 'Notes_semaine-2.docx' }, map: {}, existing: [], pages: null })
  eq('an empty map still gives the file a chapter, named after it', db.rows.bb_chapters.map((c) => c.title), ['Notes_semaine-2'])
  ok('a course language already chosen is not overwritten', !db.calls.some(([op, t, p]) => op === 'update' && t === 'bb_courses' && 'language' in p))
}

/* --- generation ------------------------------------------------------------------ */
{
  const s = shape({ concept: 'K1', type: 'weird', bloom: 9, stem: '  Une   question ', options: [{ text: 'a', why: 'w', anchor: 'A1' }], key: '0', explanation: null, anchors: ['A1', 2] })
  eq('an unknown type is a multiple choice', s.type, 'mcq')
  eq('Bloom is kept between 1 and 6', s.bloom, 6)
  eq('spaces are tidied', s.stem, 'Une question')
  eq('the key becomes a number', s.key, 0)
  eq('anchors become strings', s.anchors, ['A1', '2'])
  const good = shape({ concept: 'K1', type: 'mcq', bloom: 3, stem: 'Une cellule fait entrer du glucose contre le gradient. Quel mécanisme?', options: [{ text: 'Diffusion simple', why: 'suit le gradient', anchor: 'A1' }, { text: 'Diffusion facilitée', why: 'suit le gradient', anchor: 'A1' }, { text: 'Transport actif', why: 'contre le gradient, ATP', anchor: 'A2' }, { text: 'Osmose', why: 'eau seulement', anchor: 'A1' }], key: 2, explanation: 'x', anchors: ['A2'] })
  ok('a clean item passes the code checks', checkItem(good, { anchors: new Set(['A1', 'A2']) }).ok)
  ok('an item citing an excerpt that does not exist does not', !checkItem({ ...good, anchors: ['A9'] }, { anchors: new Set(['A1', 'A2']) }).ok)
  ok('a key outside the course is refused', !checkItem({ ...good, options: good.options.map((o, i) => (i === 2 ? { ...o, outside: true } : o)) }, { anchors: new Set(['A1', 'A2']) }).ok)
}
{
  const k = keyMap([{ id: 'x' }, { id: 'y' }], 'A')
  eq('short keys for the prompt, and back', [k.toKey.get('y'), k.toId.get('A1')], ['A2', 'x'])
  eq('loose JSON from a chatty answer', looseJson('Voici: {"a": 1} merci'), { a: 1 })
  eq('and null when there is none', looseJson('rien'), null)
}

/* --- billing ----------------------------------------------------------------------- */
{
  const sub = { id: 'sub_1', status: 'active', customer: 'cus_1', cancel_at_period_end: false, current_period_end: 1800000000, metadata: { plan: 'plus_semester', user_id: 'u1' }, items: { data: [] } }
  eq('the plan comes from the metadata', planOf(sub), 'plus_semester')
  const byPrice = { metadata: {}, items: { data: [{ price: { unit_amount: 12999, recurring: { interval: 'year', interval_count: 1 } } }] } }
  eq('or from the price when the metadata is missing', planOf(byPrice), 'plus_year')
  const row = subscriptionRow('u1', sub)
  eq('the row', [row.plan, row.status, row.stripe_customer, row.stripe_subscription, row.current_period_end], ['plus_semester', 'active', 'cus_1', 'sub_1', new Date(1800000000 * 1000).toISOString()])
  const newer = subscriptionRow('u1', { ...sub, current_period_end: undefined, items: { data: [{ current_period_end: 1800000000 }] } })
  ok('the period end is also read where newer API versions put it', newer.current_period_end === row.current_period_end)
  eq('back to the site the request came from', originOf({ headers: { origin: 'https://richandfriends.xyz' } }), 'https://richandfriends.xyz')
  eq('a preview deployment too', originOf({ headers: { origin: 'https://friends-app-git-x.vercel.app' } }), 'https://friends-app-git-x.vercel.app')
  eq('but never anywhere else', originOf({ headers: { origin: 'https://evil.example' } }), 'https://richandfriends.xyz')
}

/* --- the model call ------------------------------------------------------------------- */
function fakeClient(answers) {
  const calls = []
  return {
    calls,
    messages: {
      stream(req) {
        calls.push(req)
        const next = answers.shift()
        return { finalMessage: async () => (next instanceof Error ? Promise.reject(next) : next) }
      },
    },
  }
}
{
  const cl = fakeClient([{ stop_reason: 'end_turn', parsed_output: { ok: 1 }, usage: { input_tokens: 10 }, model: 'claude-opus-5-5', content: [] }])
  const r = await structured(cl, { system: 's', content: [{ type: 'text', text: 'x' }], schema: { type: 'object', properties: {}, additionalProperties: false } })
  eq('the parsed output', r.data, { ok: 1 })
  ok('with the strict format, an explicit effort, and no thinking or beta settings', cl.calls[0].output_config?.format && cl.calls[0].output_config?.effort === 'medium' && !('thinking' in cl.calls[0]) && !('betas' in cl.calls[0]))
}
{
  const refused = Object.assign(new Error('schema too complex'), { status: 400 })
  const cl = fakeClient([refused, { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Here: {"items": []}' }], usage: {}, model: 'claude-opus-5-5' }])
  const r = await structured(cl, { system: 's', content: [], schema: { type: 'object' } })
  eq('a 400 on the schema retries without it and reads the JSON loosely', r.data, { items: [] })
  ok('the retry has no format', cl.calls.length === 2 && !cl.calls[1].output_config.format)
}
{
  const cl = fakeClient([{ stop_reason: 'refusal', content: [], usage: {}, model: 'm' }])
  eq('a refusal is named, not thrown', (await structured(cl, { system: 's', content: [], schema: { type: 'object' } })).error, 'refused')
  const cut = fakeClient([{ stop_reason: 'max_tokens', content: [], usage: {}, model: 'm' }])
  eq('a cut answer is named', (await structured(cut, { system: 's', content: [], schema: { type: 'object' } })).error, 'too_long')
  const busy = fakeClient([Object.assign(new Error('overloaded'), { status: 429 })])
  let threw = null
  try {
    await structured(busy, { system: 's', content: [], schema: { type: 'object' } })
  } catch (err) {
    threw = err.status
  }
  eq('anything else is thrown to the route, which redacts it', threw, 429)
}

/* --- the coach's context -------------------------------------------------------------- */
{
  const rows = {
    bb_chapters: [{ id: 'ch1', title: 'La membrane', position: 0 }],
    bb_concepts: [{ id: 'k1', chapter_id: 'ch1', name: 'Osmose', definition: 'Le passage de l’eau.', definition_anchor: 'aaaaaaaa-0000', anchor_ids: [], weight: 3 }],
    bb_anchors: [{ id: 'aaaaaaaa-0000', material_id: 'm1', label: '14:32', excerpt: 'L’osmose...' }, { id: 'aaaaaaaa-1111', material_id: 'm1', label: 'collision', excerpt: 'second' }],
    bb_twins: [],
    bb_signals: [{ concept_id: 'k1', quote: 'je le demande', strength: 3 }],
    bb_materials: [{ id: 'm1', file_name: 'Cours 4.vtt' }],
  }
  const chain = (table) => {
    const q = { eq: () => q, order: () => q, then: (res) => res({ data: rows[table] ?? [] }) }
    return q
  }
  const db = { from: (t) => ({ select: () => chain(t) }) }
  const text = await courseContext(db, 'u1', 'c1')
  ok('the outline carries the definition with its excerpt id', text.includes('- Osmose (exam signal): "Le passage de l’eau." [aaaaaaaa]'))
  ok('and what the professor flagged', text.includes('"je le demande" (Osmose)'))
  ok('each excerpt once, with its file and place', text.includes('[aaaaaaaa] Cours 4.vtt · 14:32: "L’osmose..."'))
  ok('a colliding short id is listed once, the first', !text.includes('collision'))
}

/* --- the exam's format reaches the generator ----------------------------------------- */
{
  eq('nothing known, nothing said', formatLine({}), null)
  ok('the confirmed format is spelled out', formatLine({ types: ['mcq', 'calculation'], count: 60, minutes: 120 }).includes('multiple choice, calculation; 60 questions; 120 minutes'))
  const sys = generatorSystem({ course: { name: 'Bio' }, profile: { level: 'uni_2' }, language: 'fr', format: { types: ['mcq'] } })
  ok('and is in the generator prompt', sys.includes('The real exam: question types: multiple choice'))
  ok('in French, with the level', sys.includes('Write in French') && sys.includes('university, year 2'))
}

/* --- the link preview ------------------------------------------------------------------ */
{
  const html = bbPreviewHtml({ locale: 'fr' })
  ok('a shared /hakkilo link shows the B&B card, not the R&F one', html.includes('og:site_name" content="Hakkilo"') && html.includes('/brand/hakkilo-og.png'))
  ok('its canonical is /hakkilo', html.includes('<link rel="canonical" href="https://richandfriends.xyz/hakkilo" />'))
  ok('the title is the new name', html.includes('<title>Hakkilo · Révise comme une nerd.</title>'))
  ok('the pricing page has its own title', bbPreviewHtml({ page: 'tarifs', locale: 'en' }).includes('Hakkilo · Pricing'))
  const rewrites = JSON.parse(readFileSync(new URL('../../../vercel.json', import.meta.url))).rewrites
  const at = (src) => rewrites.findIndex((r) => r.source === src)
  ok('crawlers of /hakkilo and /hakkilo/tarifs are sent to it, before the catch-all', at('/hakkilo') >= 0 && at('/hakkilo/tarifs') >= 0 && at('/hakkilo') < at('/((?!api/).*)') && rewrites[at('/hakkilo')].has?.[0]?.key === 'user-agent')
}

/* --- which model does what ------------------------------------------------------------------- */
{
  /* "Okay pour Sonnet" (Kee): Sonnet 5.5 writes for the student, Opus 5.5
     reads the files and checks the questions. */
  const src = (p) => readFileSync(new URL(`../../../api/_bb/${p}`, import.meta.url), 'utf8')
  const common = src('common.js')
  ok('Sonnet 5.5 by default, Opus 5.5 for the heavy jobs', /export const MODEL = 'claude-sonnet-5-5'/.test(common) && /export const HEAVY_MODEL = 'claude-opus-5-5'/.test(common) && /heavyModel = \(\) => process\.env\.BB_MODEL_HEAVY \|\| HEAVY_MODEL/.test(common))
  ok('reading a file and checking a question stay on the heavy model', /model: heavyModel\(\)/.test(src('ingest.js')) && /model: heavyModel\(\)/.test(src('check.js')) && /model = heavyModel\(\)/.test(src('pipeline.js')))
  /* Sonnet 5.5 answers a 400 to both (shared/model-migration.md). */
  /* The code only: the comment in common.js names both to say they are not sent. */
  const all = ['common.js', 'coach.js', 'check.js', 'ingest.js', 'generate.js', 'cases.js', 'pipeline.js'].map(src).join('\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  ok('no request turns thinking off or forces a tool', !/type:\s*['"]disabled['"]/.test(all) && !/tool_choice/.test(all) && !/budget_tokens/.test(all))
  const rates = readFileSync(new URL('./plans.js', import.meta.url), 'utf8')
  ok('and its calls are priced at its own rate', /'claude-sonnet-5-5': \{ input: 2, output: 10, cacheRead: 0\.2, cacheWrite: 2\.5 \}/.test(rates))
}

/* --- the AI on hold -------------------------------------------------------------------------- */
{
  /* "I have 100 dollars of free API credit but I don't wanna use it, so put a
     hold on the API utilisation for Hakkilo" (Kee, 19 October). */
  const saved = { ...process.env }
  const set = (v) => (v === undefined ? delete process.env.BB_AI_PAUSED : (process.env.BB_AI_PAUSED = v))
  ok('on hold in the code', AI_PAUSED === true)
  set(undefined)
  ok('paused when Vercel says nothing', aiPaused() === true)
  for (const v of ['0', 'false', 'off', 'NO', ' 0 ']) {
    set(v)
    ok(`BB_AI_PAUSED=${JSON.stringify(v)} resumes`, aiPaused() === false)
  }
  for (const v of ['1', 'true', 'on']) {
    set(v)
    ok(`BB_AI_PAUSED=${JSON.stringify(v)} pauses`, aiPaused() === true)
  }

  /* Fake values, never keys: start() answers before it would use any. */
  process.env.SUPABASE_URL = 'http://localhost:54321'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role'
  process.env.ANTHROPIC_API_KEY = 'fake-not-a-key'
  const answer = async (opts) => {
    const out = { status: null, body: null }
    const res = { setHeader() {}, status(c) { out.status = c; return this }, json(b) { out.body = b; return this } }
    const ctx = await start({ method: 'POST', headers: {}, body: {} }, res, opts)
    return { ctx, ...out }
  }
  set(undefined)
  const paused = await answer()
  ok('a route that calls a model answers 503 paused, key or not', paused.ctx === null && paused.status === 503 && paused.body?.error === 'paused')
  const free = await answer({ needsModel: false })
  ok('a route that needs no model (status, billing, delete) is not held', free.body?.error !== 'paused')
  set('0')
  const resumed = await answer()
  ok('resumed: the call goes on to sign-in', resumed.body?.error !== 'paused')

  const src = (p) => readFileSync(new URL(`../../../api/_bb/${p}`, import.meta.url), 'utf8')
  const common = src('common.js')
  ok('the hold comes before the key and before any client', common.indexOf('needsModel && aiPaused()') < common.indexOf("needsModel && !env('anthropicKey')") && common.indexOf('needsModel && aiPaused()') < common.indexOf('const db = admin()'))
  /* Every handler that reaches a model goes through start() with the default. */
  for (const f of ['coach.js', 'ingest.js', 'generate.js', 'vary.js', 'visual.js', 'check.js', 'cases.js']) {
    const code = src(f)
    ok(`${f}: through start(), which holds it`, /await start\(req, res\)/.test(code) && !/start\(req, res, \{ needsModel: false \}\)/.test(code))
  }
  ok('status says it, so the course page can', /paused: aiPaused\(\)/.test(src('status.js')) && /model: Boolean\(env\('anthropicKey'\)\) && !aiPaused\(\)/.test(src('status.js')))
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]
  Object.assign(process.env, saved)
}

console.log(`  ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
