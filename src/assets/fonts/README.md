# Poppins

Self-hosted, five weights, declared at the top of `src/index.css`.

```
poppins-400.woff2   regular
poppins-500.woff2   medium — body text is set at 500, not 400
poppins-600.woff2   semibold
poppins-700.woff2   bold — headings
poppins-800.woff2   extrabold — the hero
```

## Round letters, sharp edges

Those are two different things and the difference decided this file.

A **rounded** face — Nunito, Varela Round, Baloo — files the ends off its
strokes. The letters can be any shape at all; what makes it rounded is that
every terminal is soft.

A **geometric** face — Poppins, Futura, Century Gothic — builds its letters
out of circles and straight lines, and cuts every stroke off dead flat. The
shapes are round; the edges are not.

Poppins is the second kind, which is what this design wants: the o, e, c, b, d
and p are near-perfect circles, the `a` is single-storey, and nothing is
softened. It sits next to a bubbly hand-drawn logo without competing with it,
and it does not go soft the way a rounded face does at 13px.

## Why it is here rather than on a link

Google serves this perfectly well and linking it is one line. It is local
anyway:

1. **It renders on networks that block Google Fonts.** Plenty do. The fallback
   otherwise is whatever sans the device has, which is not the design.
2. **No third-party connection on first paint.** A `<link>` to
   fonts.googleapis.com is a DNS lookup, a TLS handshake and a CSS round trip
   before the font request even begins.
3. **It can be verified.** A headless browser with no outbound access falls
   back silently, so a screenshot taken to check the typography checks the
   wrong typeface. That happened once here and nearly shipped.

Five static files at roughly 7KB each. Google does not publish a variable
Poppins, so this is the whole family — and 35KB for the set is still less than
one variable file of most other faces.

## Updating it

```
curl -A "Mozilla/5.0 (X11; Linux x86_64) Chrome/120" \
  "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap"
```

Take the `.woff2` from each block commented `/* latin */` — not `latin-ext`,
which is a second set of files for characters this site does not use — and
save them here by weight. The `unicode-range` in `src/index.css` must match
the one in those blocks.

Poppins is licensed under the SIL Open Font License, which permits
redistribution including in a repository like this one.

## If you ever swap the face

Two files, and the metrics matter more than the family name:

- `src/index.css` — the `@font-face` blocks
- `tailwind.config.js` — `fontFamily`, and the per-size `letterSpacing`

That second one is not optional, and it is easy to forget because the result
looks wrong in a way that is hard to name. Poppins is built on circles, so it
is wide and needs pulling in at display sizes; its x-height is tall and its
descenders short, so it needs *more* line height than a narrow face, not less.
Montserrat needed roughly half again as much negative tracking. Nunito needed
about a third as much. Copying either set onto this one closes the words up or
leaves them adrift.
