#!/usr/bin/env python3
"""
Le lettrage du logo, sur une ligne, en vecteur, pour le pied de page.

  python3 scripts/lettering.py

Ecrit src/content/lettering.js, qui est versionne. Meme arrangement que
scripts/brand-icons.py: un generateur dont la sortie est commitee, pour que
la compilation du site n'ait besoin ni de Pillow ni de potrace.

Dependances, une fois par machine: pip install pillow numpy potracer
(potracer est le portage en Python pur de potrace, sans compilation).

POURQUOI UN VECTEUR ET PAS LE PNG.

  "same for the footer", sur la capture du pied de page de truus: le nom de
  la marque en geant, en bas, coupe par le bord, avec des stickers dessus.

Le seul dessin du lettrage est la tuile de 600 px, ou les lettres tiennent
dans 444 px. Etire a 1400 px de large, c'est trois fois sa definition: flou
sur un ecran normal et pire sur un ecran Retina. Trace en courbes, il tient a
n'importe quelle taille, et il prend la couleur du texte (currentColor), ce
qui laisse le pied de page le peindre dans le jaune de la marque.

POURQUOI UNE LIGNE.

La tuile empile "Rich &" sur "Friends", un carre. En bas d'une page large, un
carre fait 900 px de haut pour 1000 de large; une ligne fait 260. Les deux
lignes sont donc separees (par composante connexe, chaque lettre est une
tache) et posees cote a cote, centres de gravite alignes, avec une espace de
mot entre les deux. Aucune lettre n'est redessinee ni deplacee a l'interieur
de son mot.

L'ALPHA EST RETROUVE, PAS SEUILLE. La tuile est deux couleurs pleines avec des
bords lisses, donc chaque pixel est un melange des deux et sa position entre
elles est exacte (meme projection que brand-icons.py). Le trace se fait sur
une version trois fois plus grande, lissee, pour que potrace suive la courbe
et pas l'escalier des pixels.
"""
import json
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image
import potrace

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'public' / 'brand' / 'wordmark-pink.png'
OUT = ROOT / 'src' / 'content' / 'lettering.js'

GROUND = np.array([255, 0, 122], dtype=float)   # POP de brand-icons.py
INK = np.array([248, 203, 2], dtype=float)      # YEL de brand-icons.py

SCALE = 3      # le trace se fait a 3x
GAP = 44       # espace entre "Rich&" et "Friends", en pixels de la tuile
PAD = 6
SPLIT = 290    # une lettre dont le centre est au-dessus est de la ligne 1


def alpha(img):
    px = np.asarray(img.convert('RGB'), dtype=float)
    d = INK - GROUND
    t = ((px - GROUND) * d).sum(axis=2) / (d * d).sum()
    return np.clip(t, 0, 1)


def components(mask):
    """Etiquette les taches (4-connexite). Rend la carte et les boites."""
    h, w = mask.shape
    lab = np.zeros((h, w), dtype=np.int32)
    boxes = []
    n = 0
    for y in range(h):
        for x in range(w):
            if not mask[y, x] or lab[y, x]:
                continue
            n += 1
            lab[y, x] = n
            q = deque([(y, x)])
            y0 = y1 = y
            while q:
                cy, cx = q.popleft()
                y0, y1 = min(y0, cy), max(y1, cy)
                for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not lab[ny, nx]:
                        lab[ny, nx] = n
                        q.append((ny, nx))
            boxes.append((n, (y0 + y1) / 2))
    return lab, boxes


def grow(lab, steps):
    """Etend chaque etiquette de quelques pixels, pour emporter le bord lisse
    de la lettre avec elle plutot que de le laisser sur place."""
    for _ in range(steps):
        out = lab.copy()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            sh = np.roll(np.roll(lab, dy, axis=0), dx, axis=1)
            take = (out == 0) & (sh != 0)
            out[take] = sh[take]
        lab = out
    return lab


def one_line(a):
    lab, boxes = components(a > 0.5)
    lab = grow(lab, 3)
    top = [n for n, cy in boxes if cy < SPLIT]
    low = [n for n, cy in boxes if cy >= SPLIT]
    l1 = np.where(np.isin(lab, top), a, 0.0)
    l2 = np.where(np.isin(lab, low), a, 0.0)

    ys = np.arange(a.shape[0])[:, None]
    cy = lambda l: float((l * ys).sum() / l.sum())
    cols = lambda l: np.where(l.max(axis=0) > 0.02)[0]
    dy = round(cy(l1) - cy(l2))
    dx = int(cols(l1).max()) + GAP - int(cols(l2).min())

    h, w = a.shape
    canvas = np.zeros((h, w + dx))
    canvas[:, :w] = l1
    yy, xx = np.nonzero(l2)
    canvas[yy + dy, xx + dx] = np.maximum(canvas[yy + dy, xx + dx], l2[yy, xx])

    rows = np.where(canvas.max(axis=1) > 0.02)[0]
    cs = np.where(canvas.max(axis=0) > 0.02)[0]
    return canvas[rows.min() - PAD:rows.max() + PAD + 1, cs.min() - PAD:cs.max() + PAD + 1]


def trace(crop):
    img = Image.fromarray(((1 - crop) * 255).astype(np.uint8), 'L')  # lettres en noir
    big = img.resize((img.width * SCALE, img.height * SCALE), Image.LANCZOS)
    plist = potrace.Bitmap(big, blacklevel=0.5).trace(
        turdsize=16, alphamax=1.15, opticurve=True, opttolerance=1.2,
    )

    # Coordonnees en dixiemes de pixel de la tuile, puis en relatif: les
    # deltas sont pris entre points DEJA arrondis, donc l'erreur ne s'accumule
    # pas le long d'une courbe.
    def q(p):
        return round(p.x / SCALE * 10), round(p.y / SCALE * 10)

    def num(v):
        s = f'{v / 10:.1f}'
        s = s[:-2] if s.endswith('.0') else s
        if s.startswith('0.'):
            return s[1:]
        if s.startswith('-0.'):
            return '-' + s[2:]
        return s

    out = []
    for curve in plist:
        cur = q(curve.start_point)
        out.append(f'M{num(cur[0])} {num(cur[1])}')
        for seg in curve.segments:
            pts = [q(seg.c), q(seg.end_point)] if seg.is_corner else [q(seg.c1), q(seg.c2), q(seg.end_point)]
            s = ''
            ref = cur
            for i, (x, y) in enumerate(pts):
                # Les points d'un meme segment sont relatifs a son DEBUT.
                if seg.is_corner and i == 1:
                    ref = pts[0]
                for v in (x - ref[0], y - ref[1]):
                    t = num(v)
                    s += t if (not s or t.startswith('-')) else ' ' + t
                if seg.is_corner and i == 0:
                    out.append('l' + s)
                    s = ''
            out.append(('l' if seg.is_corner else 'c') + s)
            cur = pts[-1]
        out.append('z')
    return ''.join(out)


def main():
    crop = one_line(alpha(Image.open(SRC)))
    d = trace(crop)
    w, h = crop.shape[1], crop.shape[0]
    OUT.write_text(
        '/* Genere par scripts/lettering.py a partir de public/brand/wordmark-pink.png.\n'
        '   Ne pas modifier a la main: relancer le script. */\n'
        f'export const LETTERING = {json.dumps({"w": w, "h": h, "d": d})}\n'
    )
    print(f'{OUT.relative_to(ROOT)}  {w}x{h}  {len(d)} caracteres')


if __name__ == '__main__':
    main()
