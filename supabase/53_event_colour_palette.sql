-- ============================================================================
-- Three more colours an event may paint in.
--
-- Run after 52. Safe to re-run.
--
-- WHY THIS IS A MIGRATION AND NOT A CLIENT CHANGE.
--
-- The report was that an exam looks like a class looks like a shift. It was
-- right, and the cause was in this constraint rather than in the CSS: the
-- allowed list was accent, green, quiet, cat-1, cat-2, cat-3, cat-4, and three
-- of those are the same colour. accent is #E60070, cat-1 is #FF007A and cat-2
-- is #FF2D6B. Three magentas inside fifteen degrees of hue, painted as an
-- eighteen per cent wash over white, is one pale pink as far as a month grid
-- is concerned.
--
-- Seven categories needed seven answers and the palette only offered four
-- real ones, so the client had no mapping available that would have fixed it.
--
-- WHY THESE THREE.
--
-- The sun theme is a warm ramp on purpose: pink, coral, orange, amber, yellow.
-- Hue separation inside it runs out after four. cat-6 is the far end of that
-- ramp, and 'ink' is the only genuinely dark value in the whole palette, which
-- is what an exam wants: the one entry on the grid you cannot skim past.
--
-- cat-5 is added for completeness rather than because a category uses it. The
-- ramp is declared 1 to 6 in tailwind.config.js and a constraint that allows
-- 1, 2, 3, 4 and 6 is a trap for whoever adds the eighth category.
--
-- 'ink' IS A TOKEN, NOT A COLOUR. Same rule the rest of this table follows and
-- worth restating because it is the whole reason these are names: a stored
-- hex is correct on exactly one of the two themes. --c-ink is 30 24 27 in sun
-- and 22 28 30 in sea, so 'ink' means "the darkest thing on this screen" in
-- both, which is what the category actually wants to say.
-- ============================================================================

alter table calendar_event drop constraint if exists calendar_event_colour_check;

alter table calendar_event
  add constraint calendar_event_colour_check
  check (colour in (
    'accent', 'green', 'quiet', 'ink', 'negative', 'field',
    'cat-1', 'cat-2', 'cat-3', 'cat-4', 'cat-5', 'cat-6'
  ));

-- ---------------------------------------------------------------------------
-- Repaint what is already stored.
--
-- Existing rows carry the old mapping, so an exam written last week is still
-- 'accent' and a shift is still 'cat-2'. Those are the two the client no
-- longer assigns, and leaving them would mean the fix only applies to events
-- created from now on, which is not a fix.
--
-- Only rows whose colour is still the default FOR THEIR CATEGORY are touched.
-- Somebody who deliberately set a colour on one event keeps it: the column
-- exists to be overridden and this is a repaint, not a reset.
-- ---------------------------------------------------------------------------
update calendar_event set colour = 'ink'      where category = 'examen'    and colour = 'accent';
update calendar_event set colour = 'field'    where category = 'travail'   and colour = 'cat-2';
update calendar_event set colour = 'negative' where category = 'evenement' and colour = 'cat-4';
update calendar_event set colour = 'cat-4'    where category = 'etude'     and colour = 'cat-3';

notify pgrst, 'reload schema';

-- Check:
--   -- the new values are accepted:
--   update calendar_event set colour = 'ink' where category = 'examen';
--
--   -- an invented one still is not:
--   update calendar_event set colour = 'chartreuse' where category = 'examen';
--   -- must fail on calendar_event_colour_check
--
--   -- and nothing is left on the two colours the client no longer assigns:
--   select category, colour, count(*) from calendar_event group by 1, 2 order by 1;
