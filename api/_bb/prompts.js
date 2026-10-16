import { nullable } from './common.js'

/**
 * The prompts and schemas of Beauty & Brain (section 8 of the build prompt).
 * Versioned: PROMPTS_VERSION goes into the course stats, so a change of
 * wording can be compared against the rejection rate it produced.
 *
 * In English because that is where the model reads instructions best; every
 * prompt says to answer in the course's language.
 */
export const PROMPTS_VERSION = '2026-10-16.1'

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
    'You build the source map of a course for Beauty & Brain, an exam coach that trains a student ONLY on her own course material.',
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

export function coachSystem({ profile, course, language, examDate }) {
  return `You are the Beauty & Brain coach inside Rich & Friends. Your one job: get this
student ready for the real exam in this course, using their own material.

The course outline and the student's excerpts are attached above, each excerpt
with an id in square brackets like [3f9c1d2a]. Student: ${profile.first_name || 'the student'}, ${levelText(profile.level)}, studies in ${language === 'en' ? 'English' : 'French'}, exam on ${examDate || 'a date not given yet'}.

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
