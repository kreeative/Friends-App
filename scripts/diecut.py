#!/usr/bin/env python3
"""
Redessiner le liseré blanc des stickers, a distance constante du dessin.

  python3 scripts/diecut.py            # ce qui serait fait, sans rien ecrire
  python3 scripts/diecut.py --write    # ecrit dans src/assets/stickers

Meme arrangement que scripts/brand-icons.py: un generateur dont la sortie est
commitee, parce que l'alternative est une etape de build qui demande Pillow sur
chaque machine qui construit ce site.

CE QUI A ETE RAPPORTE

  "But the sticker you have, they are not properly outlined."

Juste, et mesurable. Deux defauts, pas un.

1. LE BLANC N'EST PAS BLANC. Le liseré de bass.png porte 62 teintes claires
   differentes et la plus frequente ne couvre que 4,1 % du liseré.
   skullfire.png en porte 108, la plus frequente 2,4 %. C'est de la
   compression JPEG cuite dans le fichier puis quantifiee en palette. A cote,
   fox.png porte 9 teintes claires et 95,7 % du liseré tient sur UNE valeur,
   (254, 254, 254). Voila a quoi ressemble un liseré propre.

2. LE LISERÉ NE SUIT PAS LA FORME. Il a ete detoure a la main sur une image
   deja compressee, donc sa largeur ondule: gras ici, mince la, avec des
   bosses qui n'appartiennent a aucun trait du dessin. Un liseré de sticker
   est un contour a distance constante. Celui-la n'en etait pas un.

CE QUE FAIT CE SCRIPT

  a. Retire l'anneau clair qui entoure le dessin, trouve par DIFFUSION DEPUIS
     LE VIDE et non par un seuil global. La face du crane de skullfire est
     creme (247, 241, 202): un seuil sur la clarte la mangerait. La diffusion
     s'arrete sur les flammes rouges, donc elle ne touche que l'anneau.
  b. Dilate l'alpha du dessin d'un nombre CONSTANT de pixels.
  c. Remplit de blanc franc, (255, 255, 255), une seule valeur.
  d. Adoucit le bord exterieur, parce qu'il n'y en avait aucun: ces fichiers
     ont 0,00 % de pixels semi-transparents, donc un escalier au lieu d'un
     contour.

QUELS FICHIERS IL TOUCHE, ET POURQUOI CE N'EST PAS UNE LISTE

Ceux dont l'alpha est FRANC: aucun pixel entre 1 et 254. C'est la signature
d'un detourage a l'emporte-piece. Les dix autres du dossier ont entre 11 % et
28 % de pixels doux, donc un vrai contour anti-crenele, et on n'y touche pas:
les redessiner changerait un dessin qui va bien.

Une regle mesuree plutot qu'une liste de noms, pour la meme raison que
src/lib/art.js globe le dossier au lieu de tenir un registre.
"""
import sys
from collections import Counter, deque
from pathlib import Path

try:
    from PIL import Image, ImageFilter
except ImportError:
    sys.exit("Pillow manquant:  pip install pillow")

DOSSIER = Path(__file__).resolve().parent.parent / 'src' / 'assets' / 'stickers'

# Un pixel de liseré: clair et sans couleur. Le creme du crane (247,241,202)
# a un ecart de 45 entre son maximum et son minimum, donc il passe au travers.
CLAIR = 196
ECART = 26

# La largeur du liseré, en proportion du grand cote, pour qu'un petit sticker
# n'herite pas d'un contour de gros. 3,5 % donne 11 px sur 320, soit environ
# 2,5 px a la taille ou ils s'affichent.
LARGEUR = 0.035
MINI = 6


def alpha_franc(im):
    """Aucun pixel entre 1 et 254: decoupe a l'emporte-piece."""
    hist = im.convert('RGBA').getchannel('A').histogram()
    return sum(hist[1:255]) == 0


def sans_lisere(im):
    """L'illustration seule, l'anneau clair retire par diffusion depuis le vide."""
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()

    def clair(p):
        r, g, b, a = p
        return a > 128 and min(r, g, b) >= CLAIR and (max(r, g, b) - min(r, g, b)) <= ECART

    vu = [[False] * w for _ in range(h)]
    q = deque()
    for y in range(h):
        for x in range(w):
            if px[x, y][3] <= 128:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    i, j = x + dx, y + dy
                    if 0 <= i < w and 0 <= j < h and not vu[j][i] and clair(px[i, j]):
                        vu[j][i] = True
                        q.append((i, j))
    n = 0
    while q:
        x, y = q.popleft()
        n += 1
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            i, j = x + dx, y + dy
            if 0 <= i < w and 0 <= j < h and not vu[j][i] and clair(px[i, j]):
                vu[j][i] = True
                q.append((i, j))

    art = im.copy()
    ap = art.load()
    for y in range(h):
        for x in range(w):
            if vu[y][x]:
                ap[x, y] = (0, 0, 0, 0)
    return art, n


def lisere(art):
    """Le contour, redessine a distance constante."""
    w, h = art.size
    anneau = max(MINI, round(max(w, h) * LARGEUR))
    marge = anneau + 4
    grand = Image.new('RGBA', (w + 2 * marge, h + 2 * marge), (0, 0, 0, 0))
    grand.alpha_composite(art, (marge, marge))

    masque = grand.getchannel('A').point(lambda v: 255 if v > 110 else 0)
    reste = anneau
    while reste > 0:
        pas = min(reste, 7)  # MaxFilter veut un noyau impair et raisonnable
        masque = masque.filter(ImageFilter.MaxFilter(pas * 2 + 1))
        reste -= pas
    # Arrondir les angles que la dilatation carree laisse, puis adoucir: c'est
    # ce flou final qui donne les pixels semi-transparents qui manquaient.
    masque = masque.filter(ImageFilter.GaussianBlur(0.7)).point(lambda v: 255 if v > 128 else 0)
    masque = masque.filter(ImageFilter.GaussianBlur(0.6))

    out = Image.new('RGBA', grand.size, (255, 255, 255, 0))
    out.putalpha(masque)
    out.alpha_composite(grand)
    return out.crop(out.getchannel('A').getbbox())


def teintes_bord(im):
    """Combien de valeurs differentes le LISERÉ porte, et la part de la plus
    frequente.

    Mesure sur le bord, pas sur tous les pixels clairs de l'image. La premiere
    version comptait partout, et rendait donc 102 teintes pour cloudguy apres
    correction: ses chaussures et ses yeux sont blancs, et ils n'ont rien a
    voir avec le liseré. Un chiffre qui repond a une autre question que celle
    posee est pire qu'aucun chiffre.

    Le bord, ici, c'est l'anneau opaque qui touche la transparence.
    """
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()
    c = Counter()
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            r, g, b, a = px[x, y]
            if a != 255:
                continue
            if min(px[x - 1, y][3], px[x + 1, y][3], px[x, y - 1][3], px[x, y + 1][3]) < 255:
                c[(r, g, b)] += 1
    tot = sum(c.values())
    if not tot:
        return 0, 0.0
    return len(c), c.most_common(1)[0][1] / tot * 100


def pct_doux(im):
    """La part de pixels semi-transparents: un contour anti-crenele en a,
    une decoupe a l'emporte-piece en a zero."""
    im = im.convert('RGBA')
    hist = im.getchannel('A').histogram()
    return sum(hist[1:255]) / (im.width * im.height) * 100


def enregistrer(im, chemin, cible_ko=40):
    """En palette, pas en couleurs vraies.

    La premiere version ecrivait du RGBA: liseré parfait, et des fichiers de
    115 ko la ou le README du dossier en demande moins de 40. Trente fichiers
    de decoration a ce prix, c'est trois megaoctets sur une page que quelqu'un
    ouvre au telephone.

    FASTOCTREE, et pas MEDIANCUT: seul le premier quantifie l'alpha en meme
    temps que la couleur, ce qui est tout l'interet ici. Une palette PNG porte
    la transparence par entree (chunk tRNS), donc le bord doux survit; c'est
    exactement ce que font les dix stickers du dossier qui allaient deja bien,
    avec leurs 96 couleurs.

    On descend le nombre de couleurs jusqu'a tenir sous la cible. Un liseré
    blanc et un aplat de dessin animé ne demandent pas 256 teintes.
    """
    for n in (128, 96, 64, 48):
        q = im.convert('RGBA').quantize(colors=n, method=Image.FASTOCTREE)
        q.save(chemin, optimize=True)
        if chemin.stat().st_size <= cible_ko * 1024:
            return n
    return n


def main():
    ecrire = '--write' in sys.argv
    fichiers = sorted(p for p in DOSSIER.glob('*.png'))
    touches = 0
    print(f"{'fichier':16} {'teintes du lisere':>18} {'dominante':>20} {'doux':>14} {'poids':>9}")
    for p in fichiers:
        im = Image.open(p)
        if not alpha_franc(im):
            continue
        av_n, av_dom = teintes_bord(im)
        av_doux = pct_doux(im)
        art, _ = sans_lisere(im)
        neuf = lisere(art)
        ap_n, ap_dom = teintes_bord(neuf)
        ap_doux = pct_doux(neuf)
        if ecrire:
            enregistrer(neuf, p)
            poids = f"{p.stat().st_size // 1024} ko"
        else:
            poids = "(essai)"
        touches += 1
        print(f"  {p.name:14} {av_n:>7} -> {ap_n:<7} {av_dom:>8.1f}% -> {ap_dom:<8.1f}%"
              f" {av_doux:>5.1f}% -> {ap_doux:<5.1f}% {poids:>9}")
    print(f"\n{touches} fichiers sur {len(fichiers)}."
          f" Les autres ont deja un contour anti-crenele et sont laisses tels quels.")
    if not ecrire:
        print("Rien n'a ete ecrit. Relancer avec --write.")


if __name__ == '__main__':
    main()
