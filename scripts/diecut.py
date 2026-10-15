#!/usr/bin/env python3
"""
Redecouper les stickers: un liseré blanc rond, a distance constante du dessin.

  python3 scripts/diecut.py            # ce qui serait fait, sans rien ecrire
  python3 scripts/diecut.py --write    # ecrit dans src/assets/stickers

Dependances, une fois par machine: pip install pillow numpy

Meme arrangement que scripts/brand-icons.py: un generateur dont la sortie est
commitee, parce que l'alternative est une etape de build qui demande Pillow sur
chaque machine qui construit ce site.

CE QUI A ETE RAPPORTE, DEUX FOIS

  "But the sticker you have, they are not properly outlined."
  "Pourquoi ya des sticker qui sont toujours mal découper"

La premiere version de ce script a corrige le blanc (une seule valeur au lieu
de soixante teintes de JPEG) mais elle ne touchait que les fichiers a alpha
FRANC, et elle dilatait avec un filtre CARRE (MaxFilter). Sur un fond blanc
rien ne se voyait. Sur le panneau rose du pied de page et sur les cartes de
couleur, deux defauts se voyaient tres bien, mesures sur les 29 fichiers:

1. UN DEUXIEME CONTOUR. Une ligne grise fine courait dans le blanc, a quelques
   pixels du dessin: la ligne de decoupe de l'image d'origine, restee dans le
   liseré. 1516 pixels gris dans les liserés, loin du dessin, sur 12 stickers
   (cloudguy 421, leaf 248, bird 231, burger 220...). Apres: 1.

2. DES MARCHES D'ESCALIER. Un carre dilate un carre: chaque bosse du dessin
   devenait un angle droit dans le liseré. Mesure: le perimetre de la
   decoupe divise par celui de la meme forme lissee. 1,000 pour une courbe
   propre. Avant: 1,033 en moyenne, 1,123 pour bird. Apres: 1,001 en
   moyenne, 1,006 au pire.

CE QUE FAIT CE SCRIPT, SUR TOUS LES FICHIERS

  a. Retire l'ancien liseré, trouve par DIFFUSION DEPUIS LE VIDE a travers
     les pixels clairs et sans couleur. Le seuil descend jusqu'au gris de la
     ligne fantome (168), et le creme du crane de skullfire (247, 241, 202)
     reste protege par l'ecart de teinte, comme avant.
  b. Garde le dessin: son plus grand morceau, plus tout morceau ENFERME dans
     son contour (une lettre dans la bulle) ou assez grand pour etre une
     partie (la note au-dessus de l'oiseau, 35 % de l'oiseau). Les miettes
     restees dans l'ancien liseré partent: le point au-dessus de la bulle
     CHACHING etait l'une d'elles.
  c. Remplit les trous: un sticker est une seule forme pleine. La bulle
     CHACHING a une ouverture dans son trait, donc son interieur n'est ferme
     que par le nouveau liseré; c'est la qu'il est rempli, avec les pixels
     dessines d'origine (le blanc et les points de la bulle).
  d. Dilate par un DISQUE, exactement (convolution par FFT), puis ferme par un
     disque un peu plus petit: les encoches entre deux jambes ou deux lettres
     se comblent, comme la ligne d'une vraie decoupe. Le tout a 4x, puis
     reduit, ce qui donne au bord ses pixels doux.
  e. Blanc franc dessous, le dessin d'origine dessus.

Relance sur des fichiers deja traites, il redonne la meme decoupe: le liseré
blanc est retire en (a) et redessine a la meme distance en (d).
"""
import sys
from collections import deque
from pathlib import Path

try:
    import numpy as np
    from PIL import Image, ImageFilter
except ImportError:
    sys.exit("Pillow ou numpy manquant:  pip install pillow numpy")

DOSSIER = Path(__file__).resolve().parent.parent / 'src' / 'assets' / 'stickers'

# Un pixel de l'ancien liseré: clair et sans couleur. 168 attrape la ligne
# grise fantome; l'ecart de 30 laisse passer le creme du crane (45).
CLAIR = 168
ECART = 30

# La largeur du liseré, en proportion du grand cote: 3 %, soit 10 px sur 330
# et environ 2,5 px a la taille ou ils s'affichent.
LARGEUR = 0.030
MINI = 7
SUR = 4  # sur-echantillonnage du liseré

# Une miette: moins de 24 px, ou moins de 0,4 % du dessin ET moins de 140 px.
MIETTE = 24
MIETTE_PART = 0.004
MIETTE_PLAFOND = 140

V4 = ((1, 0), (-1, 0), (0, 1), (0, -1))


def inonder(depart, permis):
    """Les pixels de `permis` atteignables depuis ceux de `depart`."""
    h, w = permis.shape
    vu = depart & permis
    file = deque(zip(*np.nonzero(vu)))
    while file:
        y, x = file.popleft()
        for dy, dx in V4:
            j, i = y + dy, x + dx
            if 0 <= j < h and 0 <= i < w and permis[j, i] and not vu[j, i]:
                vu[j, i] = True
                file.append((j, i))
    return vu


def ancien_lisere(rgba):
    a = rgba[:, :, 3]
    rgb = rgba[:, :, :3].astype(int)
    clair = (a > 100) & (rgb.min(axis=2) >= CLAIR) & ((rgb.max(axis=2) - rgb.min(axis=2)) <= ECART)
    vide = np.pad(a <= 100, 1, constant_values=True)
    graines = clair & (vide[:-2, 1:-1] | vide[2:, 1:-1] | vide[1:-1, :-2] | vide[1:-1, 2:])
    return inonder(graines, clair)


def boucher(masque):
    """Le masque avec ses trous remplis."""
    h, w = masque.shape
    bord = np.zeros((h, w), bool)
    bord[0, :] = bord[-1, :] = bord[:, 0] = bord[:, -1] = True
    return ~inonder(bord & ~masque, ~masque)


def morceaux(masque):
    h, w = masque.shape
    vu = np.zeros((h, w), bool)
    liste = []
    for y, x in zip(*np.nonzero(masque)):
        if vu[y, x]:
            continue
        vu[y, x] = True
        file = deque([(y, x)])
        pts = []
        while file:
            cy, cx = file.popleft()
            pts.append((cy, cx))
            for dy, dx in V4:
                j, i = cy + dy, cx + dx
                if 0 <= j < h and 0 <= i < w and masque[j, i] and not vu[j, i]:
                    vu[j, i] = True
                    file.append((j, i))
        liste.append(np.array(pts))
    return liste


def dessin(art):
    """Le dessin: son grand morceau, ce qu'il enferme, ses vraies parties."""
    liste = sorted(morceaux(art), key=len, reverse=True)
    if not liste:
        return art
    grand = len(liste[0])
    garde = np.zeros_like(art)
    garde[liste[0][:, 0], liste[0][:, 1]] = True
    dedans = boucher(garde)
    for m in liste[1:]:
        n = len(m)
        enferme = dedans[m[:, 0], m[:, 1]].mean() > 0.5
        miette = n < MIETTE or (n < MIETTE_PART * grand and n < MIETTE_PLAFOND)
        if enferme or not miette:
            garde[m[:, 0], m[:, 1]] = True
    return garde


def disque(r):
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return (x * x + y * y <= r * r).astype(np.float32)


def convoluer(masque, noyau):
    h, w = masque.shape
    kh, kw = noyau.shape
    H, W = h + kh, w + kw
    F = np.fft.rfft2(masque.astype(np.float32), s=(H, W)) * np.fft.rfft2(noyau, s=(H, W))
    plein = np.fft.irfft2(F, s=(H, W))
    return plein[kh // 2:kh // 2 + h, kw // 2:kw // 2 + w]


def dilater(masque, r):
    return convoluer(masque, disque(r)) > 0.5


def eroder(masque, r):
    k = disque(r)
    return convoluer(masque, k) > k.sum() - 0.5


def redecouper(im):
    rgba = np.asarray(im.convert('RGBA')).copy()
    art = (rgba[:, :, 3] > 100) & ~ancien_lisere(rgba)
    silhouette = boucher(dessin(art))
    h, w = silhouette.shape
    r = max(MINI, round(max(w, h) * LARGEUR))
    marge = r + 8
    sil = np.pad(silhouette, marge)
    src = np.pad(rgba, ((marge, marge), (marge, marge), (0, 0)))

    grand = np.kron(sil, np.ones((SUR, SUR), bool))
    lisere = dilater(grand, r * SUR)
    f = round(r * 0.9) * SUR
    lisere = eroder(dilater(lisere, f), f)
    alpha = np.asarray(Image.fromarray(lisere.astype(np.uint8) * 255).resize(
        (sil.shape[1], sil.shape[0]), Image.BOX)).copy()

    # Ce que le nouveau liseré enferme et que le dessin ne fermait pas.
    plein = alpha > 127
    trous = boucher(plein) & ~plein
    autour = np.asarray(Image.fromarray(trous.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(3))) > 0
    alpha[trous | (autour & (alpha > 0))] = 255

    fond = np.zeros_like(src)
    fond[:, :, :3] = 255
    fond[:, :, 3] = alpha
    out = Image.fromarray(fond, 'RGBA')
    # Le dessin, avec un pixel de plus pour emporter son bord adouci.
    garde = np.asarray(Image.fromarray(sil.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(3))) > 0
    dessus = src.copy()
    dessus[:, :, 3] = np.where(garde | trous, src[:, :, 3], 0)
    out.alpha_composite(Image.fromarray(dessus, 'RGBA'))
    return out.crop(out.getchannel('A').getbbox())


def escalier(im):
    """Perimetre de la decoupe / perimetre de la meme forme lissee. 1 = courbe
    propre; plus haut, des marches."""
    op = np.asarray(im.convert('RGBA'))[:, :, 3] > 128

    def perimetre(m):
        p = np.pad(m, 1)
        return (m & ~(p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:])).sum()

    lisse = np.asarray(Image.fromarray(op.astype(np.uint8) * 255).filter(ImageFilter.GaussianBlur(2.5))) > 127
    return perimetre(op) / max(perimetre(lisse), 1)


def enregistrer(im, chemin, cible_ko=40):
    """En palette, pas en couleurs vraies: FASTOCTREE quantifie l'alpha avec la
    couleur, donc le bord doux survit, et 30 fichiers restent legers."""
    for n in (128, 96, 64, 48):
        q = im.quantize(colors=n, method=Image.FASTOCTREE)
        q.save(chemin, optimize=True)
        if chemin.stat().st_size <= cible_ko * 1024:
            return n
    return n


def main():
    ecrire = '--write' in sys.argv
    fichiers = sorted(DOSSIER.glob('*.png'))
    print(f"{'fichier':14} {'escalier':>18} {'poids':>9}")
    for p in fichiers:
        im = Image.open(p)
        neuf = redecouper(im)
        av, ap = escalier(im), escalier(neuf)
        if ecrire:
            enregistrer(neuf, p)
            poids = f"{p.stat().st_size // 1024} ko"
        else:
            poids = "(essai)"
        print(f"  {p.name:14} {av:6.3f} -> {ap:6.3f}  {poids:>9}")
    print(f"\n{len(fichiers)} fichiers.")
    if not ecrire:
        print("Rien n'a ete ecrit. Relancer avec --write.")


if __name__ == '__main__':
    main()
