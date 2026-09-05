/**
 * What a chapter's body is, before it is rendered.
 *
 * Two questions, both of which produced a visible fault on the reading screen
 * and neither of which belongs in JSX:
 *
 *   is this the seeded filler rather than a manuscript
 *   does it open by repeating the title that is already above it
 *
 * Pure and importless, so `npm test` runs it under plain node.
 */

/**
 * The sentence 07_books_all_in_one.sql generates, forty-eight times a chapter.
 *
 * Matching on the text rather than on a flag column because there is no flag:
 * `_placeholder_body()` writes ordinary prose into the same column the
 * manuscript later replaces, so the text IS the marker. Matched on a long
 * distinctive phrase rather than the bare word PLACEHOLDER, since a real
 * chapter about writing could easily use that word in a sentence.
 */
export const FILLER_MARK = 'PLACEHOLDER. This paragraph stands in'

/** Is this body the seeded filler rather than something somebody wrote? */
export function isFiller(body) {
  return typeof body === 'string' && body.includes(FILLER_MARK)
}

/**
 * Same string, for the purpose of asking "is this heading the title again".
 *
 * Curly and straight apostrophes fold together because the seed builds its
 * heading by concatenating the title, while a manuscript is typed by a person
 * whose editor may have smartened the quotes. "Bandura's four sources" and
 * "Bandura’s four sources" are the same heading to a reader and would not be
 * to ===.
 */
const norm = (s) =>
  String(s ?? '')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

/**
 * Drop an opening heading that only repeats the chapter's own title.
 *
 * Reported as "remove the duplicate title": the screen showed CHAPTER 2, then
 * "Bandura's four sources" as the page heading, then "Bandura's four sources"
 * again immediately below it. The second one is not in the component, it is
 * the first line of the stored body: _placeholder_body() writes
 * '## ' || chapter_title before the paragraphs.
 *
 * So it is removed here rather than in the component, where it would have to
 * be a special case inside the markdown renderer, and it is removed by
 * COMPARING rather than by dropping any leading heading. A chapter whose first
 * section happens to be a heading keeps it; only an echo of the title goes.
 * Both are real: the manuscripts open on a paragraph, the seed opens on the
 * title.
 */
export function stripEchoedTitle(body, title) {
  const text = String(body ?? '')
  const want = norm(title)
  if (!want) return text

  const blocks = text.split(/\n{2,}/)
  const first = (blocks[0] ?? '').trim()
  const heading = /^#{1,3}\s+(.*)$/.exec(first)
  if (!heading) return text
  if (norm(heading[1]) !== want) return text

  return blocks.slice(1).join('\n\n').replace(/^\s+/, '')
}

/**
 * The body to render, and whether there is one at all.
 *
 * @returns { text, filler }  filler true means there is nothing written here
 *          yet and the caller should say so rather than paint the seed. A
 *          reader who paid for a book and is shown forty-eight identical
 *          paragraphs does not conclude that the text is missing, they
 *          conclude that the writing is bad.
 */
export function chapterText(body, title) {
  if (isFiller(body)) return { text: '', filler: true }
  return { text: stripEchoedTitle(body, title), filler: false }
}
