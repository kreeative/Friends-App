#!/usr/bin/env node
/**
 * Turns the manuscripts in content/books/ into supabase/08_chapter_bodies.sql.
 *
 * The manuscripts are markdown files in the repo, not SQL string literals.
 * Prose belongs somewhere it can be read, diffed and edited by a person who
 * is not thinking about quoting rules, and a chapter is three thousand words
 * of text containing apostrophes, which is the worst possible thing to keep
 * inside a single-quoted SQL literal.
 *
 * The generated file only ever UPDATEs. Chapters are created by
 * 07_books_all_in_one.sql, which owns the titles, the ordering and which one
 * is free. This just replaces the placeholder bodies with the real ones, so
 * it can be re-run after every edit without touching anything else and
 * without caring what order the two files are applied in.
 *
 *   node scripts/build-chapters.mjs
 *
 * Filenames carry the chapter number: 01-the-moment-after-failure.md is
 * chapter 1 of whichever book directory it sits in. The rest of the filename
 * is for humans; the title in the database comes from the seed.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BOOKS = path.join(root, 'content', 'books')
const OUT = path.join(root, 'supabase', '08_chapter_bodies.sql')

/**
 * Dollar-quoting, so nothing in the prose has to be escaped at all. The tag
 * is checked against the text rather than assumed: a chapter that happened to
 * contain the delimiter would otherwise terminate the literal early and
 * produce SQL that is both broken and confusing.
 */
function quote(text) {
  let tag = 'body'
  for (let n = 0; text.includes(`$${tag}$`); n += 1) tag = `body${n}`
  return `$${tag}$${text}$${tag}$`
}

/* Close enough to be useful for a reading-time estimate, which is all the
   column is for. Markdown headings and punctuation are left in; splitting on
   whitespace overcounts by a percent or two and nobody is billing on it. */
const countWords = (text) => text.trim().split(/\s+/).filter(Boolean).length

const books = fs
  .readdirSync(BOOKS, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort()

const rows = []
for (const slug of books) {
  const dir = path.join(BOOKS, slug)
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort()

  for (const file of files) {
    const idx = Number.parseInt(file.slice(0, 2), 10)
    if (!Number.isInteger(idx) || idx < 1) {
      throw new Error(`${slug}/${file}: filename must start with a chapter number, e.g. 01-`)
    }
    const body = fs.readFileSync(path.join(dir, file), 'utf8').trim()
    if (!body) throw new Error(`${slug}/${file}: empty`)
    rows.push({ slug, idx, file, body, words: countWords(body) })
  }
}

if (rows.length === 0) throw new Error('no manuscripts found under content/books/')

const total = rows.reduce((n, r) => n + r.words, 0)

const sql = `-- ============================================================================
-- Chapter bodies. GENERATED, do not edit.
--
-- Source: content/books/<slug>/<nn>-<name>.md
-- Rebuild: node scripts/build-chapters.mjs
--
-- Run this AFTER 07_books_all_in_one.sql. That file creates the tables, the
-- books and the chapters with their titles and preview flags; this one only
-- swaps the placeholder text for the written manuscript, so it is safe to
-- re-run as often as the prose changes.
--
-- ${rows.length} chapter(s), ${total.toLocaleString('en-GB')} words.
-- ============================================================================

begin;

${rows
  .map(
    (r) => `-- ${r.slug} · chapter ${r.idx} · ${r.words.toLocaleString('en-GB')} words · ${r.file}
update chapters c
   set body = ${quote(r.body)},
       word_count = ${r.words}
  from books b
 where b.id = c.book_id
   and b.slug = '${r.slug}'
   and c.idx = ${r.idx};`,
  )
  .join('\n\n')}

commit;

-- Which chapters are still placeholder text:
--   select b.slug, c.idx, c.title
--     from chapters c join books b on b.id = c.book_id
--    where c.body like 'PLACEHOLDER%' or c.body like '%PLACEHOLDER.%'
--    order by b.slug, c.idx;
`

fs.writeFileSync(OUT, sql)

for (const r of rows) {
  console.log(`  ${r.slug.padEnd(24)} ch${String(r.idx).padStart(2, '0')}  ${String(r.words).padStart(5)} words`)
}
console.log(`\n${rows.length} chapter(s), ${total.toLocaleString('en-GB')} words → supabase/08_chapter_bodies.sql`)
