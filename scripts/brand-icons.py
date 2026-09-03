#!/usr/bin/env python3
"""
Regenerate every brand tile and every favicon from the two source drawings.

  python3 scripts/brand-icons.py

Run by hand when the artwork or the brand colour changes, and commit what it
writes. Same arrangement as scripts/build-chapters.mjs: a generator whose
output is checked in, because the alternative is a build step that needs
Pillow on every machine that ever builds this site.

WHY THIS EXISTS RATHER THAN THE PNGS BEING EDITED.

Three separate pinks were in the app at once and nobody could have found that
by looking:

    #DE3578   the ground baked into every logo PNG
    #E60070   --c-accent, so every button and every active tab
    #FF007A   --c-cat-1 and --c-mark, so the landing page and the dots

They are close enough to look like one colour in isolation and obviously
different side by side, which is exactly the failure that was reported. A
colour that lives inside a PNG cannot be changed with the rest of the palette,
so it drifts, and it will drift again the next time unless changing it is one
edit in one place. POP below is that place.

THE ARTWORK IS NOT REDRAWN. Both sources are two flat colours with antialiased
edges, so every pixel is a blend of exactly two values and its position along
that axis can be recovered exactly. That fraction is reused as an alpha, which
is what lets the ground be replaced without touching a single letterform and
without leaving a halo of the old colour on every curve.
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
BRAND = ROOT / 'public' / 'brand'
PUB = ROOT / 'public'

# ---------------------------------------------------------------------------
# The palette. These are the only lines to edit.
#
# POP is #FF007A, which is the brand pink, chosen by name. The long version of
# what that costs lives beside --c-accent in index.css and is not repeated
# here; the short version is that white on it is 3.80:1 and the deliberate
# trade was made there, once, in writing.
#
# What matters HERE is only that this file and that token are the same value.
# Three pinks is what started all of this, and the one inside a PNG is the one
# nobody can find by reading the stylesheet.
#
# PRESSED goes DARKER, never lighter. A hover that lightens takes the fill
# towards the white sitting on it, which is the one direction that cannot be
# afforded here.
# ---------------------------------------------------------------------------
POP = (255, 0, 122)      # #FF007A
YEL = (248, 203, 2)      # #F8CB02, the brand yellow, unchanged
SEA = (0, 157, 185)      # #009DB9, the alternate theme's ground, unchanged

SRC_PINK_GROUND = (222, 53, 120)   # #DE3578, what the PNGs were drawn on
SRC_SEA_GROUND = (0, 157, 185)


def axis(img, a, b):
    """Each pixel's position from colour `a` to colour `b`, as 0..255.

    The sources are two flat colours, so every pixel lies on the segment
    between them and the projection is exact rather than a guess. Antialiased
    edge pixels land in the middle and come back as partial alpha, which is
    the whole reason this is a projection and not a threshold: a threshold
    would give every letterform a one-pixel staircase.
    """
    px = img.convert('RGB').load()
    w, h = img.size
    d = [b[i] - a[i] for i in range(3)]
    den = sum(v * v for v in d) or 1
    out = Image.new('L', (w, h))
    op = out.load()
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            t = sum((p[i] - a[i]) * d[i] for i in range(3)) / den
            op[x, y] = max(0, min(255, round(t * 255)))
    return out


def art(src, ground, ink=YEL):
    """The lettering alone, as an alpha mask, cropped to its own bounds.

    `ink` is a parameter because the two sources are drawn the opposite way
    round: the wordmark is yellow on pink and the monogram is pink on yellow.
    Passing the wrong one does not fail, it returns the negative, so the
    monogram came back as a yellow tile with pink letters on it. That is the
    kind of mistake a contact sheet catches and a unit test never would.
    """
    mask = axis(Image.open(src), ground, ink)
    box = mask.point(lambda v: 255 if v > 127 else 0).getbbox()
    return mask.crop(box)


def squircle(size, radius_pct=0.23):
    """The rounded-square mask that makes a tab icon read as an app icon."""
    ss = 4  # supersampled, then downscaled, because ImageDraw does not antialias
    m = Image.new('L', (size * ss, size * ss), 0)
    ImageDraw.Draw(m).rounded_rectangle(
        [0, 0, size * ss - 1, size * ss - 1],
        radius=int(size * ss * radius_pct),
        fill=255,
    )
    return m.resize((size, size), Image.LANCZOS)


def tile(mask, size, ground, inset=0.74, rounded=False):
    """A finished icon: lettering at `inset` of the square, centred on `ground`.

    `inset` is the fix for "raw, unpadded, edge-to-edge". The sources put the
    lettering against a margin that is part of the drawing at 512px and is most
    of the icon at 32, so the words came out clipped and unreadable in a tab.
    Cropping to the letterforms and re-insetting means the margin is chosen
    per size instead of inherited from the artwork.
    """
    out = Image.new('RGBA', (size, size), ground + (255,))
    w, h = mask.size
    scale = (size * inset) / max(w, h)
    fit = mask.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    lay = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    lay.paste(
        Image.new('RGBA', fit.size, YEL + (255,)),
        ((size - fit.size[0]) // 2, (size - fit.size[1]) // 2),
        fit,
    )
    out = Image.alpha_composite(out, lay)
    if rounded:
        out.putalpha(squircle(size))
    return out


def main():
    word = art(BRAND / 'wordmark-pink.png', SRC_PINK_GROUND)
    mono = art(BRAND / 'mark-pink.png', YEL, SRC_PINK_GROUND)
    word_sea = art(BRAND / 'wordmark-blue.png', SRC_SEA_GROUND)

    wrote = []

    def save(img, path, **kw):
        img.save(path, **kw)
        wrote.append(f'{path.relative_to(ROOT)}  {img.size[0]}x{img.size[1]}')

    # The tiles the app itself draws. Square: the CSS rounds them, and baking a
    # radius in as well would show two curves a pixel apart at some sizes.
    save(tile(word, 600, POP).convert('RGB'), BRAND / 'wordmark-pink.png')
    save(tile(mono, 600, POP).convert('RGB'), BRAND / 'mark-pink.png')
    save(tile(word_sea, 600, SEA).convert('RGB'), BRAND / 'wordmark-blue.png')
    save(tile(mono, 600, SEA).convert('RGB'), BRAND / 'mark-blue.png')
    save(tile(word, 600, YEL).convert('RGB'), BRAND / 'wordmark-yellow.png')

    # Tab and home screen. Rounded, because nothing else rounds these and a
    # square is what made the icon look like a screenshot rather than an app.
    save(tile(word, 512, POP, rounded=True), PUB / 'icon-512.png')
    save(tile(word, 192, POP, rounded=True), PUB / 'icon-192.png')

    # THE SMALL SIZES GET THE MONOGRAM, WHICH IS THE OTHER HALF OF THE FIX.
    #
    # "Rich & Friends" is four lines of lettering. At 32px each line is eight
    # pixels tall and the result was a smudge with the words clipped at both
    # edges; at 16 there is nothing there at all. Three letterforms have room
    # to be shapes at that size, and a tab icon is recognised rather than read.
    save(tile(mono, 32, POP, inset=0.80, rounded=True), PUB / 'icon-32.png')

    # iOS masks this one itself, so it must be a full opaque square: rounding
    # it here would put transparent corners inside Apple's own rounding and
    # they render black.
    save(tile(word, 180, POP).convert('RGB'), PUB / 'apple-touch-icon.png')

    # Maskable art is cropped to a circle by the launcher, so everything has to
    # sit inside the middle 80 per cent and the ground has to reach every edge.
    save(tile(word, 512, POP, inset=0.56).convert('RGB'), PUB / 'icon-maskable-512.png')

    ico = PUB / 'favicon.ico'
    tile(mono, 64, POP, inset=0.80, rounded=True).save(
        ico, sizes=[(16, 16), (32, 32), (48, 48), (64, 64)]
    )
    wrote.append(f'{ico.relative_to(ROOT)}  16/32/48/64')

    print('\n'.join(wrote))
    print('\nBump ?v= in index.html and manifest.webmanifest, or Safari keeps the old one.')


if __name__ == '__main__':
    main()
