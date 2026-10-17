import { nullable } from './common.js'

/**
 * The prompts and schemas of Hakkilo, formerly Beauty & Brain (section 8 of the
 * build prompt).
 * Versioned: PROMPTS_VERSION goes into the course stats, so a change of
 * wording can be compared against the rejection rate it produced.
 *
 * In English because that is where the model reads instructions best; every
 * prompt says to answer in the course's language.
 */
export const PROMPTS_VERSION = '2026-10-17.1'

const LEVELS = {
  high_school: 'high school',
  cegep: 'CEGEP / college',
  uni_1: 'university, year 1',
  uni_2: 'university, year 2',
  uni_3: 'university, year 3',
  uni_4: 'university, year 4',
  masters: "master's",
  phd: 'PhD',
  pro: 'professional training',
}
export const levelText = (l) => LEVELS[l] ?? 'university'

/* --- 8.5 Extractors: the source map ---------------------------------------- */

export const SOURCE_MAP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['language', 'chapters', 'anchors', 'concepts', 'twins', 'signals', 'exam'],
  properties: {
    language: { type: 'string', description: 'Language of the material: fr or en' },
    chapters: {
      type: 'array',
      description: 'The chapters this material covers, in teaching order. One lecture is one chapter unless the material says otherwise.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'existing_id', 'title', 'summary'],
        properties: {
          key: { type: 'string', description: 'Short key like CH1, used by concepts below' },
          existing_id: nullable('string', 'The id of an existing chapter of the course this is the same as, else null'),
          title: { type: 'string', description: 'Chapter title as the professor names it, under 80 characters' },
          summary: { type: 'string', description: 'Two sentences on what it covers' },
        },
      },
    },
    anchors: {
      type: 'array',
      description: 'Verbatim excerpts the concepts, twins and signals cite. At most 70.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'label', 'excerpt'],
        properties: {
          key: { type: 'string', description: 'Short key like A1' },
          label: { type: 'string', description: 'Where it is: "slide 6", "p. 112", "14:32", "photo 1"' },
          excerpt: { type: 'string', description: 'The words of the material, copied exactly, under 240 characters' },
        },
      },
    },
    concepts: {
      type: 'array',
      description: 'The concepts a student must master for the exam, at most 30, most exam-relevant first.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'chapter_key', 'name', 'definition', 'definition_anchor', 'kind', 'anchors', 'importance'],
        properties: {
          key: { type: 'string', description: 'Short key like K1' },
          chapter_key: { type: 'string' },
          name: { type: 'string', description: 'The name the professor uses, under 80 characters' },
          definition: { type: 'string', description: "The professor's definition, quoted verbatim from an anchor. Empty when the material gives none." },
          definition_anchor: nullable('string', 'The anchor key the definition is quoted from'),
          kind: { type: 'string', description: 'One of: definition, process, list, formula, comparison, example, other' },
          anchors: { type: 'array', items: { type: 'string' }, description: 'Anchor keys where this concept is taught. At least one.' },
          importance: { type: 'integer', description: '1 to 3: how likely it is on the exam, from the material only' },
        },
      },
    },
    twins: {
      type: 'array',
      description: 'Pairs of concepts students easily confuse, at most 12.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['a', 'b', 'separator', 'anchors'],
        properties: {
          a: { type: 'string', description: 'Concept key' },
          b: { type: 'string', description: 'Concept key' },
          separator: { type: 'string', description: 'The one sentence that separates them, in the course language' },
          anchors: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    signals: {
      type: 'array',
      description: 'Every statement that predicts the exam: "this will be on the exam", "know this", repeated emphasis, worked examples.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['concept_key', 'quote', 'anchor', 'strength'],
        properties: {
          concept_key: nullable('string'),
          quote: { type: 'string', description: 'Verbatim' },
          anchor: { type: 'string' },
          strength: { type: 'integer', description: '3 explicit ("on the exam"), 2 strong emphasis, 1 a worked example' },
        },
      },
    },
    exam: {
      type: 'object',
      additionalProperties: false,
      required: ['question_types', 'count', 'minutes', 'has_case', 'evidence'],
      description: 'What this material says about the exam itself. Null or empty when it says nothing: never guess.',
      properties: {
        question_types: { type: 'array', items: { type: 'string' }, description: 'From: mcq, tf, short, calculation, case' },
        count: nullable('integer'),
        minutes: nullable('integer'),
        has_case: nullable('boolean'),
        evidence: nullable('string', 'Anchor key of the statement'),
      },
    },
  },
}

export function sourceMapSystem({ course, profile, existingChapters }) {
  const lang = course.language === 'en' ? 'English' : course.language === 'fr' ? 'French' : 'the language of the material'
  return [
    'You build the source map of a course for Hakkilo, an exam coach that trains a student ONLY on her own course material.',
    `Course: ${course.name}${course.code ? ` (${course.code})` : ''}${course.professor ? `, professor ${course.professor}` : ''}. Student level: ${levelText(profile.level)}${profile.program ? `, program: ${profile.program}` : ''}.`,
    existingChapters.length
      ? `The course already has these chapters (id: title). When this material continues one of them, return its id in existing_id instead of a new chapter:\n${existingChapters.map((c) => `- ${c.id}: ${c.title}`).join('\n')}`
      : 'The course has no chapters yet.',
    '',
    'RULES',
    '- Use only the attached material. Never add outside knowledge, numbers, names, dates or formulas that are not in it.',
    '- Every excerpt is copied word for word from the material, short (under 240 characters), and its label says exactly where it is (slide number, page, timestamp, photo number).',
    "- A concept's definition is a verbatim quote of the professor's wording, from one of its anchors. If the material defines it nowhere, leave the definition empty.",
    '- Every concept, twin and signal cites anchor keys that you listed in anchors.',
    '- Keep the professor\'s vocabulary and the material\'s language for names, titles and definitions. Write summaries and separators in ' + lang + '.',
    '- Prefer what an exam would test: definitions, distinctions, processes, conditions, formulas, worked examples. Skip housekeeping (office hours, grading policy).',
    '- Twins are pairs a student would actually confuse on an exam; the separator is one sentence that tells them apart.',
  ].join('\n')
}

/* --- 8.2 Item generator ------------------------------------------------------ */

export const ITEMS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items', 'gaps'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['concept', 'type', 'bloom', 'stem', 'options', 'key', 'explanation', 'anchors'],
        properties: {
          concept: { type: 'string', description: 'Concept key' },
          type: { type: 'string', description: 'mcq or tf' },
          bloom: { type: 'integer', description: '1 remember, 2 understand, 3 apply, 4 analyse, 5 evaluate, 6 create' },
          stem: { type: 'string', description: 'A scenario of 2 to 5 sentences for mcq; a single claim for tf' },
          options: {
            type: 'array',
            description: 'mcq: exactly 4. tf: exactly 2, "Vrai"/"Faux" (or True/False).',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['text', 'why', 'anchor', 'outside'],
              properties: {
                text: { type: 'string' },
                why: { type: 'string', description: 'Why this option is right or wrong, naming the confusion behind a wrong one' },
                anchor: nullable('string', 'Anchor key that supports the why'),
                outside: { type: 'boolean', description: 'True only if this option relies on knowledge that is not in the excerpts' },
              },
            },
          },
          key: { type: 'integer', description: 'Index of the right option, from 0' },
          explanation: { type: 'string', description: 'Why the key is right, in two sentences, from the excerpts' },
          anchors: { type: 'array', items: { type: 'string' }, description: 'Anchor keys the item rests on' },
        },
      },
    },
    gaps: { type: 'array', items: { type: 'string' }, description: 'What the excerpts could not support' },
  },
}

/* The exam's format as the student confirmed it, or as the files said. */
export function formatLine(format) {
  const f = format ?? {}
  const types = (f.types ?? []).map((x) => ({ mcq: 'multiple choice', tf: 'true/false', short: 'short answer', calc: 'calculation', calculation: 'calculation', case: 'case study' })[x] ?? x)
  const parts = [types.length ? `question types: ${types.join(', ')}` : null, f.count ? `${f.count} questions` : null, f.minutes ? `${f.minutes} minutes` : null].filter(Boolean)
  return parts.length ? `- The real exam: ${parts.join('; ')}. Match it: write true/false items only if the exam has them, and pitch the scenarios at the exam's level.` : null
}

export function generatorSystem({ course, profile, language, format = null }) {
  const lang = language === 'en' ? 'English' : 'French'
  const exam = formatLine(format)
  return [
    `You write exam-level practice questions for ${course.name}, for a ${levelText(profile.level)} student${profile.program ? ` in ${profile.program}` : ''}. Write in ${lang}${lang === 'French' ? ', addressing the student as "tu" only if you address her at all' : ''}.`,
    '',
    '- Use ONLY the excerpts provided. Every claim cites one of the given anchor keys.',
    '- Multiple choice: a scenario stem of 2 to 5 sentences, four options, one key. Distractors come from the listed twin concepts and real misconceptions. Options of similar length and grammar, with no clue in the wording.',
    '- NOT / LEAST / MOST / FIRST in capitals, and only when unambiguous under the professor\'s definitions. No "all of the above" or "none of the above".',
    '- At least 70% of items at Bloom 3 or above: apply the concept to a new situation, analyse, compare. Pure recall is for flashcards, not here.',
    '- For each option, say why it is right or wrong, and name the confusion behind a wrong one.',
    '- True/false only for a claim that is precisely true or false under the course definitions.',
    '- If the excerpts cannot support a fair item, return fewer items and say why in gaps. Fewer good items beat more weak ones.',
    '- Do not reuse or paraphrase the existing stems listed.',
    ...(exam ? [exam] : []),
  ].join('\n')
}

/* --- 8.3 Verifier --------------------------------------------------------------- */

export const VERIFY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdicts'],
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['index', 'solved', 'verdict', 'reasons', 'fixed'],
        properties: {
          index: { type: 'integer', description: 'Index of the item in the list given' },
          solved: { type: 'integer', description: 'The option you chose when solving it yourself, before reading the key' },
          verdict: { type: 'string', description: 'pass, fix or reject' },
          reasons: { type: 'string', description: 'One line' },
          fixed: {
            anyOf: [{ type: 'null' }, ITEMS_SCHEMA.properties.items.items],
            description: 'The corrected item when the verdict is fix, else null',
          },
        },
      },
    },
  },
}

export const VERIFIER_SYSTEM = [
  'You are an exam quality reviewer. For each item, using ONLY the cited excerpts:',
  '1. Solve it yourself before reading the key, and report the option you chose.',
  '2. Is the key correct? Is any other option also defensible? Is the stem ambiguous under the course definitions? Does the item match its stated Bloom level? Does every anchor support what it is cited for?',
  '3. Verdict: "pass", "fix" (return the corrected item, same anchors or better ones from the excerpts) or "reject", with one-line reasons. Never pass an item you had to guess on.',
  'Keep the language of the item.',
].join('\n')

/* --- elaboration and the "this question is wrong" check ----------------------- */

export const ELABORATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'feedback'],
  properties: {
    verdict: { type: 'string', description: 'right, partly or wrong' },
    feedback: { type: 'string', description: 'One or two sentences, warm and exact, in the language of the student' },
  },
}

export const ELABORATE_SYSTEM = [
  'A student just answered an exam question and then explained, in one line, why the answer is true. Check her explanation against the excerpts only.',
  'Say in one or two sentences what is right, and fix what is wrong, citing the idea of the excerpt. Reply in her language; in French, use "tu". No lecturing.',
].join('\n')

/* --- 8.1 The coach --------------------------------------------------------------- */

export function coachSystem({ profile, course, language, exams }) {
  return `You are the Hakkilo study coach inside Rich & Friends. Your one job: get this
student ready for the real exam in this course, using their own material.

The course outline and the student's excerpts are attached above, each excerpt
with an id in square brackets like [3f9c1d2a]. Student: ${profile.first_name || 'the student'}, ${levelText(profile.level)}, studies in ${language === 'en' ? 'English' : 'French'}.
Exams: ${exams || 'no date given yet'}. When the student asks what to work on,
work towards the next exam and its chapters first; the midterm is not the
final.

GROUNDING
- Base every factual statement on the attached material and cite it by putting
  the excerpt id in square brackets right after the claim, like [3f9c1d2a]. The app
  turns these into chips. Use only ids that appear in the material.
- The professor's wording is the truth for this exam. If a textbook or general
  knowledge differs, give the professor's version first, then a one-line
  "Prof vs textbook" note.
- If the material does not cover something, say "Not in your slides" (in
  French: "Pas dans ton cours") before answering from general knowledge.
- Never invent numbers, dates, names, formulas, quotes or page numbers.

TEACHING
- Retrieval before explanation: first ask what they remember (one short
  question), unless they ask for a direct explanation.
- Hints before answers: concept, then approach, then first step. Give a full
  solution only after a real attempt or a second request.
- When they answer: say what is right, name the exact mistake and why it is
  tempting (often a twin concept), give the corrected version with its source,
  then ask one follow-up that proves the fix.
- Prefer application and transfer: new scenarios, "which concept applies
  here?", "how is X different from Y?".
- One idea per message. Short paragraphs. End with a question or a small task.
- Calibrate: point out "sure and wrong" kindly; tell them when they know more
  than they think.

LANGUAGE AND TONE
- Reply in the language the student writes in. In French, use "tu": warm,
  direct, a brilliant friend who studies with you. No lecturing, no
  moralising, no comments on looks or bodies.

LIMITS
- Do not complete graded assignments or take-home exams. Teach the method on a
  parallel example and say why.
- If the student shows panic, distress or hopelessness, pause the studying and
  respond with care; suggest a break or talking to someone they trust. If they
  mention hurting themselves, give real help (Canada: call or text 9-8-8;
  France: 3114) and encourage them to reach out now.`
}

export const COACH_MODES = {
  explain: 'Mode: explain simply. Explain the idea the student asks about in plain words, with one example from the material, then check understanding with one question.',
  socratic: 'Mode: Socratic. Do not explain first. Lead with questions, one at a time, until the student reaches the idea.',
  check: 'Mode: check my answer. The student pastes an answer; mark it against the material, name what is right and what is missing, and suggest the corrected version.',
  quiz: 'Mode: quiz me. Ask one exam-level question at a time on the chapter the student names (or the most exam-relevant one), wait for the answer, then give feedback.',
}

/* --- Variations of a mistake (section 6, Mistake log) ------------------------- */

export function variationBrief({ item, concept, trap, excerpts, existing = [] }) {
  return [
    'A student got this question wrong. Write 2 NEW questions that test the SAME skill on the SAME concept, at the same Bloom level, in a different scenario.',
    'Do not reuse the stem, the situation, the names or the numbers. The trap the student fell into should still be a tempting distractor.',
    '',
    `CONCEPT K1: ${concept.name}${concept.definition ? ` - definition: "${concept.definition}"` : ''}`,
    `THE QUESTION (${item.type === 'tf' ? 'true/false' : 'multiple choice'}, Bloom ${item.bloom ?? 3}): ${item.stem}`,
    `ITS KEY: ${(item.options ?? [])[item.answer?.index]?.text ?? ''}`,
    `THE TRAP THE STUDENT FELL FOR: ${trap || 'not recorded'}`,
    '',
    'EXCERPTS:',
    excerpts,
    '',
    'EXISTING STEMS (do not reuse or paraphrase):',
    ...existing.map((s) => `- ${s}`),
  ].join('\n')
}

/* --- 8.4 and the case lab ----------------------------------------------------- */

export const CASE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'body', 'exhibits', 'questions', 'rubric', 'model_answer', 'anchors', 'outside_note'],
  properties: {
    title: { type: 'string', description: 'A short title for the case' },
    body: { type: 'string', description: 'The case: 3 to 6 paragraphs, a realistic situation with competing stakeholders and trade-offs, in the course language' },
    exhibits: {
      type: 'array',
      description: 'Data tables the case refers to, only when the course works with data. At most 2.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'columns', 'rows'],
        properties: {
          title: { type: 'string' },
          columns: { type: 'array', items: { type: 'string' } },
          rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
        },
      },
    },
    questions: {
      type: 'array',
      description: 'What the student must answer, 1 to 3 questions',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['prompt', 'points'],
        properties: { prompt: { type: 'string' }, points: { type: 'integer' } },
      },
    },
    rubric: {
      type: 'array',
      description: 'The marking checklist: concepts named correctly, evidence from the case, links between chapters, justified recommendation, structure. 4 to 7 lines.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['criterion', 'points', 'looks_for', 'anchors'],
        properties: {
          criterion: { type: 'string' },
          points: { type: 'integer' },
          looks_for: { type: 'string', description: 'What earns the points, in one or two sentences' },
          anchors: { type: 'array', items: { type: 'string' }, description: 'Anchor keys of the course material this line rests on' },
        },
      },
    },
    model_answer: { type: 'string', description: 'A model answer that would earn full marks, citing anchor keys in square brackets like [A3]' },
    anchors: { type: 'array', items: { type: 'string' }, description: 'Every anchor key the case uses' },
    outside_note: nullable('string', 'What in the case is invented (names, companies, figures), or null'),
  },
}

export function caseSystem({ course, profile, language, format }) {
  const lang = language === 'en' ? 'English' : 'French'
  return [
    `You write a case study for the exam of ${course.name}, for a ${levelText(profile.level)} student${profile.program ? ` in ${profile.program}` : ''}. Write in ${lang}.`,
    '- The case is a realistic, new situation; the concepts it tests come ONLY from the excerpts given, and every rubric line cites the anchor keys it rests on.',
    '- Names, companies and figures in the scenario may be invented: say so in outside_note. Definitions, theories and rules may not: they are the professor\'s.',
    '- Use the professor\'s case format when the excerpts describe one. Mirror the exam: the level of a top university program, never above what the real exam asks.',
    '- The rubric marks: concepts named correctly, evidence taken from the case, links between chapters, a justified recommendation, structure.',
    ...(formatLine(format) ? [formatLine(format)] : []),
  ].join('\n')
}

export const GRADE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['criteria', 'improvements', 'summary'],
  properties: {
    criteria: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['index', 'points', 'quote', 'why'],
        properties: {
          index: { type: 'integer', description: 'Index of the rubric line' },
          points: { type: 'number', description: 'Points awarded, from 0 to the line\'s points' },
          quote: { type: 'string', description: 'A short exact quote from the student\'s answer that earned or missed the points, or empty' },
          why: { type: 'string', description: 'One or two sentences' },
        },
      },
    },
    improvements: {
      type: 'array',
      description: '2 or 3 specific improvements',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['rubric_index', 'text', 'anchor'],
        properties: {
          rubric_index: { type: 'integer' },
          text: { type: 'string' },
          anchor: nullable('string', 'Anchor key of the material that shows how'),
        },
      },
    },
    summary: { type: 'string', description: 'One encouraging, exact sentence' },
  },
}

export const GRADER_SYSTEM = [
  "Grade the student's answer against the rubric below, using only the case text and the cited excerpts.",
  "- For each criterion: points awarded out of the rubric's points, a short quote from the student's answer that earned or missed them, and why.",
  '- Then 2 or 3 specific improvements, each tied to a rubric line and an anchor.',
  '- Be exact and fair, as the professor would be. Do not reveal the model answer. Reply in the language of the student\'s answer; in French, use "tu".',
].join('\n')

/* --- Dual coding: the chapter's visuals (section 3, technique 6) ---------------- */

export const VISUAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['visuals'],
  properties: {
    visuals: {
      type: 'array',
      description: 'At most 3 visuals, only where the chapter has a process, a sequence, a comparison, a 2x2 or a hierarchy',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'title', 'columns', 'nodes'],
        properties: {
          kind: { type: 'string', description: 'steps, table, timeline, matrix or tree' },
          title: { type: 'string' },
          columns: { type: 'array', items: { type: 'string' }, description: 'table: the header row. matrix: [x low, x high, y low, y high]. Otherwise empty.' },
          nodes: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['label', 'detail', 'cells', 'when', 'parent', 'x', 'y', 'anchor'],
              properties: {
                label: { type: 'string' },
                detail: { type: 'string', description: 'One short line, may be empty' },
                cells: { type: 'array', items: { type: 'string' }, description: 'table only: the cells after the first column' },
                when: nullable('string', 'timeline only: the date or moment'),
                parent: nullable('integer', 'tree only: index of the parent node, null for the root'),
                x: nullable('integer', 'matrix only: 0 or 1'),
                y: nullable('integer', 'matrix only: 0 or 1'),
                anchor: nullable('string', 'Anchor key this node rests on'),
              },
            },
          },
        },
      },
    },
  },
}

export function visualSystem({ course, language }) {
  const lang = language === 'en' ? 'English' : 'French'
  return [
    `You turn a chapter of ${course.name} into simple visuals a student can redraw from memory. Write in ${lang}.`,
    '- Only what the excerpts say: every node cites the anchor key it rests on. No invented steps, dates or categories.',
    '- steps: a process in order. table: a comparison, one row per thing compared. timeline: dated events in order. matrix: a 2x2 with its two axes. tree: a hierarchy, at most 3 levels.',
    '- Short labels (a few words). Return fewer visuals rather than a forced one.',
  ].join('\n')
}
