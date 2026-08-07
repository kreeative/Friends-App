# Gordita

Gordita is a **commercial** typeface. It is not on Google Fonts and cannot be
fetched from a CDN, so it is not shipped in this repo — you have to buy a
webfont licence and drop the files here yourself.

Until they exist, everything falls back to **Outfit**, which has the same
geometric skeleton and near-circular bowls. The site is designed against
Gordita's metrics and looks correct in either.

## Adding it

Buy the **web** licence (a desktop licence does not permit `@font-face`), then
put these four files in this folder, named exactly:

```
gordita-regular.woff2    400
gordita-medium.woff2     500
gordita-bold.woff2       700
gordita-black.woff2      800
```

Then uncomment the `@font-face` block at the top of `src/index.css`. Nothing
else changes — `Gordita` is already first in the stack in `tailwind.config.js`,
so it takes over the moment the files resolve.

If your foundry ships `.woff` or `.ttf` instead, convert to `.woff2` first. It
is roughly 30% smaller and every browser this app supports reads it.

## Why the fallback is Outfit and not something else

The face is doing a specific job here: the headline sizes run to `clamp(2.5rem,
6.5vw, 4.25rem)` at `-0.035em` tracking, which needs a geometric sans with
tight, even sidebearings and a large x-height. Outfit holds at that size.
Poppins is close but rounder and sits noticeably wider, so line breaks in the
hero move. Montserrat — what this used before — is wider still.
