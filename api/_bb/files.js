import { strFromU8, unzipSync } from 'fflate'
import { MAX_BYTES, formatOf } from '../../src/lib/bb/formats.js'

/**
 * Turning a student's file into something Claude can read (section 2.1).
 *
 *   PDF            sent as is: Claude reads it natively, layout and images.
 *   PPTX           each slide's text and speaker notes, slide numbers kept.
 *   DOCX           the paragraphs, in order.
 *   TXT, VTT, SRT  the text, timestamps kept as the place ("14:32").
 *   JPG, PNG, WEBP an image block; HEIC is refused with "export it as JPG".
 *
 * Pure apart from the bytes in, so the converters are tested without a
 * server (src/lib/bb/files.test.mjs builds tiny zips with fflate).
 */

export { MAX_BYTES }

const decodeXml = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')

/** The text runs of DrawingML (<a:t>) or WordprocessingML (<w:t>), paragraph by paragraph. */
export function paragraphs(xml, ns) {
  const out = []
  const paraRe = new RegExp(`<${ns}:p[\\s>][\\s\\S]*?</${ns}:p>`, 'g')
  const textRe = new RegExp(`<${ns}:t(?:\\s[^>]*)?>([\\s\\S]*?)</${ns}:t>`, 'g')
  for (const para of xml.match(paraRe) ?? []) {
    let line = ''
    let m
    textRe.lastIndex = 0
    while ((m = textRe.exec(para))) line += decodeXml(m[1])
    line = line.replace(/\s+/g, ' ').trim()
    if (line) out.push(line)
  }
  return out
}

const num = (name) => Number((name.match(/(\d+)\.xml$/) ?? [])[1] ?? 0)

/**
 * The slides in the order the student sees them, as file names.
 *
 * File numbers are not the order: a deck whose slides were moved keeps
 * slide7.xml where slide 2 is shown. The order is the list in
 * ppt/presentation.xml (<p:sldId r:id>), resolved through its rels; when
 * either is missing or unreadable, the file numbers are used.
 */
function slideOrder(files) {
  const byNumber = Object.keys(files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => num(a) - num(b))
  const pres = files['ppt/presentation.xml']
  const rels = files['ppt/_rels/presentation.xml.rels']
  if (!pres || !rels) return byNumber
  const target = new Map([...strFromU8(rels).matchAll(/<Relationship\b[^>]*>/g)].map((m) => [(m[0].match(/Id="([^"]+)"/) ?? [])[1], (m[0].match(/Target="([^"]+)"/) ?? [])[1]]))
  const ordered = [...strFromU8(pres).matchAll(/<p:sldId\b[^>]*r:id="([^"]+)"/g)]
    .map((m) => target.get(m[1]))
    .filter(Boolean)
    .map((t) => `ppt/${t.replace(/^\/?ppt\//, '').replace(/^\.\.\//, '')}`)
    .filter((n) => files[n])
  return ordered.length === byNumber.length ? ordered : byNumber
}

/** The notes page of a slide, through the slide's own rels. */
function notesOf(files, slideName) {
  const rels = files[slideName.replace(/slides\/(slide\d+\.xml)$/, 'slides/_rels/$1.rels')]
  const linked = rels ? (strFromU8(rels).match(/Target="(?:\.\.\/notesSlides\/|\/ppt\/notesSlides\/)(notesSlide\d+\.xml)"/) ?? [])[1] : null
  return files[`ppt/notesSlides/${linked ?? `notesSlide${num(slideName)}.xml`}`] ?? null
}

/** PPTX: "[slide 3]" blocks with their notes, numbered as shown. */
export function pptxText(bytes) {
  const files = unzipSync(bytes, {
    filter: (f) => /^ppt\/(slides\/slide\d+\.xml|slides\/_rels\/slide\d+\.xml\.rels|notesSlides\/notesSlide\d+\.xml|presentation\.xml|_rels\/presentation\.xml\.rels)$/.test(f.name),
  })
  const slides = slideOrder(files)
  const parts = []
  slides.forEach((name, i) => {
    const n = i + 1
    const text = paragraphs(strFromU8(files[name]), 'a')
    const notesFile = notesOf(files, name)
    /* Notes pages repeat the slide number as a text run; a line that is only
       a number is dropped. */
    const notes = notesFile ? paragraphs(strFromU8(notesFile), 'a').filter((l) => !/^\d+$/.test(l)) : []
    parts.push([`[slide ${n}]`, ...text, ...(notes.length ? ['Notes:', ...notes] : [])].join('\n'))
  })
  return { text: parts.join('\n\n'), pages: slides.length, imageOnly: slides.length > 0 && parts.every((p) => p.split('\n').length <= 1) }
}

/** DOCX: the body paragraphs, with a page-ish marker every 40 paragraphs. */
export function docxText(bytes) {
  const files = unzipSync(bytes, { filter: (f) => f.name === 'word/document.xml' })
  const xml = files['word/document.xml']
  if (!xml) return { text: '', pages: 0 }
  const paras = paragraphs(strFromU8(xml), 'w')
  const out = []
  paras.forEach((p, i) => {
    if (i % 40 === 0) out.push(`[part ${Math.floor(i / 40) + 1}]`)
    out.push(p)
  })
  return { text: out.join('\n'), pages: Math.ceil(paras.length / 40) }
}

/** Subtitles: "[14:32] what was said", one cue per line, numbering dropped. */
export function captionText(raw) {
  const lines = String(raw).replace(/\r/g, '').split('\n')
  const out = []
  let stamp = null
  for (const line of lines) {
    const t = line.match(/^(\d{1,2}:)?(\d{1,2}):(\d{2})[.,]\d{3}\s*-->/)
    if (t) {
      const h = t[1] ? Number(t[1].slice(0, -1)) : 0
      const m = Number(t[2]) + h * 60
      stamp = `${m}:${t[3]}`
      continue
    }
    if (/^WEBVTT/.test(line) || /^\d+$/.test(line.trim()) || !line.trim()) continue
    out.push(stamp ? `[${stamp}] ${line.trim()}` : line.trim())
    stamp = null
  }
  return out.join('\n')
}

/* What kind of file this is: shared with the app, which refuses a HEIC
   before uploading it. */
export { formatOf }

const IMAGE_TYPE = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' }

/**
 * The content block for one material, or { problem }.
 * `bytes` is a Uint8Array (absent for pasted text).
 */
export function blockFor({ name, mime, bytes, pasted }) {
  if (pasted) return { block: textBlock(pasted, name), text: pasted, pages: null }
  const format = formatOf(name, mime)
  if (!bytes || !bytes.length) return { problem: 'empty' }
  if (bytes.length > MAX_BYTES) return { problem: 'too_big' }
  if (format === 'pdf') {
    const head = strFromU8(bytes.slice(0, 5), true)
    if (!head.startsWith('%PDF')) return { problem: 'not_pdf' }
    const data = Buffer.from(bytes).toString('base64')
    return { block: { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data }, title: name }, pages: null }
  }
  if (format === 'pptx') {
    const { text, pages, imageOnly } = pptxText(bytes)
    if (!text.trim() || imageOnly) return { problem: 'pptx_images' }
    return { block: textBlock(text, name), text, pages }
  }
  if (format === 'docx') {
    const { text, pages } = docxText(bytes)
    if (!text.trim()) return { problem: 'empty' }
    return { block: textBlock(text, name), text, pages }
  }
  if (format === 'captions') {
    const text = captionText(strFromU8(bytes))
    return text.trim() ? { block: textBlock(text, name), text, pages: null } : { problem: 'empty' }
  }
  if (format === 'text') {
    const text = strFromU8(bytes)
    return text.trim() ? { block: textBlock(text, name), text, pages: null } : { problem: 'empty' }
  }
  if (format === 'image') {
    const ext = String(name).toLowerCase().split('.').pop()
    const media = IMAGE_TYPE[ext] ?? (String(mime).startsWith('image/') ? mime : 'image/jpeg')
    return { block: { type: 'image', source: { type: 'base64', media_type: media, data: Buffer.from(bytes).toString('base64') } }, pages: 1 }
  }
  if (format === 'heic') return { problem: 'heic' }
  if (format === 'legacy') return { problem: 'legacy' }
  return { problem: 'unknown_format' }
}

function textBlock(text, name) {
  return { type: 'document', source: { type: 'text', media_type: 'text/plain', data: String(text).slice(0, 400000) }, title: name }
}
