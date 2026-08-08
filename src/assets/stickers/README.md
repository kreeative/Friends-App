# Stickers

Drop a PNG in this folder. That is the whole process, nothing to register,
no list to edit. `src/lib/art.js` globs this directory at build time, so a new
file shows up everywhere stickers appear: the sign-in row, the group rows on
the dashboard, and the decoration scattered down every page.

Delete one and it disappears just as cleanly.

## What to export

| | |
|---|---|
| **Format** | PNG with a real alpha channel |
| **Size** | 600 px on the long edge (they render at 56-110 px, so this covers 2× and a bit) |
| **Background** | Transparent. Not white, white shows as a box on a white page |
| **Trim** | Crop tight to the artwork. Padding inside the file becomes a gap the layout cannot see |
| **Weight** | Aim under 40 kB each. `pngquant --quality 65-90` gets there without a visible change |

A white die-cut outline drawn *as part of the artwork* is the look and is
welcome, that is different from a white background.

## Naming

Lowercase, no spaces: `skull.png`, `pizza.png`, `blue-cat.png`. The filename is
the name the code uses.

Two places name specific stickers rather than taking whatever exists:

- `HERO_ART` in `src/pages/SignIn.jsx`, the row across the top of sign-in
- the `SETS` in `src/components/Stickers.jsx`, where each one sits on a page

Both are filtered against what actually exists, so a name that no longer
matches a file is skipped rather than rendering a broken image. If you rename
art, check those two lists so the intended one still appears.

## One thing to know

Which sticker a group shows is derived from its id, not stored. Adding art can
therefore reshuffle which group shows which face. That is fine for decoration
and is why it needs no database column, but it does mean the mapping is not a
promise.
