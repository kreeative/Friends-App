# Nunito

Self-hosted, one file, declared at the top of `src/index.css`.

```
nunito-variable.woff2    weights 400–900, latin subset
```

## Why it is here rather than on a link

Google serves this perfectly well, and linking it is one line. It is local
anyway for three reasons:

1. **It renders on networks that block Google Fonts.** Plenty do — corporate
   proxies, some countries, some privacy extensions. The fallback in that case
   is whatever sans the device happens to have, which is not the design.
2. **No third-party connection on first paint.** A `<link>` to
   fonts.googleapis.com is a DNS lookup, a TLS handshake and a CSS round trip
   before the font request even starts.
3. **It can be verified.** A headless browser with no outbound access silently
   falls back, so a screenshot taken to check the typography would have been
   checking the wrong typeface — which is exactly what happened once.

## Why one file for six weights

Nunito is a variable font. Google's own CSS returns the *same* URL for 400
through 900 and simply varies the `font-weight` line, so shipping six files
would be shipping the same 39KB six times. The `@font-face` declares
`font-weight: 400 900` and the browser interpolates.

## Updating it

```
curl -A "Mozilla/5.0 (X11; Linux x86_64) Chrome/120" \
  "https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap"
```

Take the `.woff2` URL from the block commented `/* latin */` — not
`latin-ext`, which is a second file for characters this site does not use —
and save it here as `nunito-variable.woff2`. The `unicode-range` in
`src/index.css` must match the one in that same block.

Nunito is licensed under the SIL Open Font License, which permits
redistribution including in a repository like this one.

## If you ever swap the face

Two files, and the metrics matter more than the family name:

- `src/index.css` — the `@font-face` block
- `tailwind.config.js` — `fontFamily`, and the per-size `letterSpacing`

That second one is not optional. The tracking here is tuned for Nunito, which
is narrow and whose round terminals already carry the eye between letters. The
previous face was Montserrat, drawn much wider, and needed roughly double the
negative tracking; those values applied to Nunito closed whole words into
single shapes. Change the family without changing the tracking and it will
look wrong in a way that is hard to name.
