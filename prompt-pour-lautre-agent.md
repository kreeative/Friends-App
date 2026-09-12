# Prompt à coller dans l'autre chat

Copie tout ce qui est entre les deux lignes.

---

Stop. Before you write another screen, read this, because the problem is not
that your screens are ugly. Each one is fine on its own. The problem is that
they are all **the same screen wearing different words**, and you cannot see it
because you look at them one at a time.

## The test you are failing

Render every screen you have built. Screenshot each one. Shrink them all to
200px wide and put them in a row.

**Can you name each screen from its silhouette alone, with the text unreadable?**

If they all reduce to the same grey rhythm — a title, then a column of equal
rounded boxes — the design has failed, no matter how good any single one looks
at full size. This is the only design test that matters right now. Run it
before you show me anything else.

## Why you keep producing the same screen

This is worth understanding, because once you see the mechanism you will catch
yourself doing it.

You generate each screen independently. With no memory of the composition you
chose an hour ago, you reach for the safest arrangement you know: page title,
vertical stack of equal-weight rounded cards, three stat tiles in a row, one
accent colour sprinkled around, everything between 16px and 24px.

That arrangement is never *wrong*. It never overflows, never breaks on a phone,
never fails a review. So nothing ever corrects it, and every screen regresses
to the same mean. **Safety is the bug.** You are not lacking creativity, you
are lacking a reason to leave the local minimum.

## The seven rules that break it

These are checkable. Do not treat them as vibes.

**1. Two typefaces, not one.** This is the single biggest reason your work looks
like a template. Everything is one sans-serif at three sizes. Wealthsimple —
which is the bar being set here — uses **Caslon, a serif, next to Futura, a
geometric sans**. A serif display face in a money app is the move that makes it
read as a brand instead of a Bootstrap page. Pick a display face with real
personality and a neutral sans for everything else, and never mix them inside
one line.

**2. One hero per screen, and a different KIND of hero each time.** Something on
every screen must be three to five times larger than everything around it. On
one screen that is a number. On the next it is a chart. On the next it is a
single sentence set large. On the next it is an image. If every screen's hero
is the same kind of object, you have only changed the content.

**3. Real type scale.** Every screen needs one element at 48px or more sitting
next to 14–16px body copy. Sameness in type is what causes sameness in layout:
when everything is within 8px of everything else, no arrangement can look
different from any other.

**4. Space separates. Borders do not.** Before you add a border, a divider or a
card, delete one. Your instinct is to wrap each idea in a container because a
container cannot overflow. Generous whitespace between sections does the same
job and is what "expensive" actually looks like.

**5. Cap the cards.** At least one section on every screen must be borderless
and full-bleed — sitting directly on the page ground with nothing around it.
A screen made entirely of cards is a filing cabinet.

**6. One accent, one job.** Pick the single most important action or number on
the screen and give it the accent. Everything else is ink, muted ink, and
ground. Colour used as decoration is colour that has stopped meaning anything.

**7. In a finance app, the number IS the artwork.** A balance is not a label
with a value beside it. Set it at display size, tabular figures, with the cents
smaller than the dollars, and let it carry the screen. This one change will do
more than everything else on this list.

## Banned, because they are the tells

- Three equal stat tiles in a row. This is *the* signature of generated UI.
- Every section wrapped in its own rounded card.
- Icon + label + chevron rows used for every list on every screen.
- A chart that is always the same height in the same slot.
- An emoji used where an icon or nothing belongs.

If you catch yourself reaching for any of these, you are back in the local
minimum.

## About the interaction, since it feels stuck

Motion is part of the design, not decoration added at the end. In a money app,
specifically:

- A balance counts up to its value rather than appearing.
- A sheet grows from the element that opened it, so the eye knows where it came
  from and where it will return.
- A chart draws rather than appears.
- A number that changed flashes its direction once, then settles.

But no animation without a job. Motion exists to explain where something came
from. If you cannot say what a transition explains, delete it.

## Where consistency actually lives, so you do not overcorrect

Do not read any of this as "make every screen wildly different". That fails in
the other direction and it fails faster.

**Consistency lives in the tokens. Variety lives in the composition.** One
colour palette, one spacing scale, one type scale, one corner radius, one
motion curve — shared by every screen without exception. What changes screen to
screen is how those tokens are *arranged*: what is big, what is full-bleed, what
carries the accent, where the eye lands first.

Shared tokens plus different compositions is a design system. Identical
compositions is a template. You have been building the second one.

## Two things that are not negotiable

**Keep the palette that was already chosen.** The colours are not the problem
and changing them would throw away the one part that is working.

**Accessibility is a floor, not a trade-off.** Body text at 4.5:1 against its
real background, large text and meaningful graphics at 3:1, and colour is never
the only thing carrying a meaning — a state must survive a greyscale
screenshot. Composite translucent and opacity-reduced colours down to the
opaque layer before you measure, and on a gradient measure the worst pixel, not
the commonest one. "New" that fails contrast is not new, it is broken.

## How to work from here

Build it, run it, **screenshot it, and look at the screenshot.** Do not reason
about what the CSS should produce — that is how a screen ends up with a control
that overlaps another one on a phone while the code reads perfectly. Every
claim you make about how something looks should come from an image you actually
opened.

Then run the thumbnail test again. Every time.

---

Start by showing me the thumbnail row of what exists today, and tell me which
rule above each screen is breaking. Do not redesign anything until we have
agreed on the diagnosis.
