-- ============================================================================
-- Placeholder content for the reading library.
--
-- Real chapter titles from the content brief, PLACEHOLDER bodies. The point is
-- to exercise the reader against realistic volume, roughly 3,000 words a
-- chapter, so scrolling, progress saving and chapter switching are tested
-- against what the finished books will weigh, not against two paragraphs.
--
-- The bodies are generated with repeat() rather than pasted, which keeps this
-- file small while still producing full-length chapters.
--
-- Replace the bodies with the manuscripts when they are written. Chapter 1 of
-- each book is the free preview and should be the strongest chapter you have. -- a weak free chapter is a broken storefront.
-- ============================================================================

-- ~40 words per sentence-block, repeated to reach chapter length.
create or replace function _placeholder_body(chapter_title text, paras int)
returns text language sql immutable as $$
  select '## ' || chapter_title || E'\n\n' || string_agg(
    'PLACEHOLDER. This paragraph stands in for the finished manuscript so the '
    || 'reader can be tested against a chapter of realistic length. The final '
    || 'text will open on a situation you recognise, set out what the research '
    || 'actually found, state plainly where the evidence is thin or failed to '
    || 'replicate, and end with one specific thing to do. Named researchers, '
    || 'no hype, no manufactured urgency.',
    E'\n\n')
  from generate_series(1, paras);
$$;

insert into books (slug, title, subtitle, description, price_cents, currency, published) values
 ('story-you-tell',
  'The Story You Tell About Ability',
  'Mindset, honestly',
  'What you believe about ability changes what you do after failure, the only moment that matters. Growth mindset has been oversold; this is where it actually works.',
  1200, 'CAD', true),
 ('evidence-of-yourself',
  'Evidence of Yourself',
  'Confidence as a byproduct, not a feeling',
  'Confidence is not manufactured internally and then acted on. It is the residue of accumulated evidence that you can handle things. Most advice inverts this and fails.',
  1200, 'CAD', true),
 ('design-beats-discipline',
  'Design Beats Discipline',
  'Why willpower is not the variable',
  'People who look disciplined are mostly not resisting more. They have arranged their lives so there is less to resist.',
  1200, 'CAD', true)
on conflict (slug) do nothing;

-- Chapter 1 of every book is the free preview. Everything else is gated by the
-- policy in 05_library.sql, not by anything in the application.
with outline(book_slug, idx, title) as (values
  ('story-you-tell', 1, 'The moment after failure'),
  ('story-you-tell', 2, 'Fixed and growth, and what the replications actually showed'),
  ('story-you-tell', 3, 'False growth mindset'),
  ('story-you-tell', 4, 'Why you think you failed'),
  ('story-you-tell', 5, 'Learned helplessness and its reverse'),
  ('story-you-tell', 6, 'Stress as a signal, not a threat'),
  ('story-you-tell', 7, 'Reappraisal as a trainable skill'),
  ('story-you-tell', 8, 'Practice, and the ceiling on practice'),
  ('story-you-tell', 9, 'What to do Monday'),

  ('evidence-of-yourself', 1, 'Confidence follows action'),
  ('evidence-of-yourself', 2, 'Bandura''s four sources'),
  ('evidence-of-yourself', 3, 'What doesn''t work, and why it''s still everywhere'),
  ('evidence-of-yourself', 4, 'Self-esteem is a trap; self-compassion isn''t'),
  ('evidence-of-yourself', 5, 'Nobody is watching as closely as you think'),
  ('evidence-of-yourself', 6, 'Acting before feeling ready'),
  ('evidence-of-yourself', 7, 'The impostor experience'),
  ('evidence-of-yourself', 8, 'Building an evidence file'),
  ('evidence-of-yourself', 9, 'Confidence under actual pressure'),

  ('design-beats-discipline', 1, 'The fuel tank that wasn''t'),
  ('design-beats-discipline', 2, 'What the disciplined actually do'),
  ('design-beats-discipline', 3, 'Habits are context, not character'),
  ('design-beats-discipline', 4, 'If-then'),
  ('design-beats-discipline', 5, 'Friction is the lever'),
  ('design-beats-discipline', 6, 'Bundling and precommitment'),
  ('design-beats-discipline', 7, 'Sixty-six days, give or take a lot'),
  ('design-beats-discipline', 8, 'The lapse is not the problem'),
  ('design-beats-discipline', 9, 'Identity and consistency'),
  ('design-beats-discipline', 10, 'Building your own system')
)
insert into chapters (book_id, idx, title, body, word_count, is_preview)
select b.id, o.idx, o.title, _placeholder_body(o.title, 48), 2900, (o.idx = 1)
from outline o
join books b on b.slug = o.book_slug
on conflict (book_id, idx) do nothing;

drop function _placeholder_body(text, int);

-- Sanity: 3 books, 28 chapters, 3 free previews.
-- select count(*) from books;
-- select count(*) from chapters;
-- select count(*) from chapters where is_preview;
