#!/usr/bin/env python3
"""Assemble les rendus « avant » / « après » (scripts/artefacts-body-09-shots.sh) en planches annotées.
Usage : python3 scripts/artefacts-body-09-compose.py <dossier des rendus> <dossier de sortie>   (le dossier des rendus contient avant/ et apres/)"""
import sys, os
from PIL import Image, ImageDraw, ImageFont
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
try: F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22); S = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 16)
except OSError: F = S = ImageFont.load_default()

def load(side, name):
    p = os.path.join(src, side, name)
    return Image.open(p).convert('RGB') if os.path.exists(p) else None

def sheet(title, rows, fname, height=620, note=None):
    """rows : liste de (légende, nom de fichier) ; une colonne AVANT et une colonne APRÈS par ligne."""
    cells = []
    for cap, name in rows:
        a, b = load('avant', name), load('apres', name)
        if a is None or b is None: continue
        r = lambda im: im.resize((int(im.width * height / im.height), height))
        cells.append((cap, r(a), r(b)))
    if not cells: return
    W = max(a.width + b.width + 30 for _, a, b in cells) + 20
    H = 70 + sum(height + 50 for _ in cells) + (30 if note else 0)
    img = Image.new('RGB', (W, H), (245, 245, 245)); d = ImageDraw.Draw(img)
    d.text((14, 12), title, fill=(20, 20, 20), font=F)
    if note: d.text((14, 44), note, fill=(90, 90, 90), font=S)
    y = 78 if note else 60
    for cap, a, b in cells:
        d.text((14, y), f'{cap} — AVANT (gauche)  |  APRÈS (droite)', fill=(40, 40, 40), font=S); y += 26
        img.paste(a, (10, y)); img.paste(b, (10 + a.width + 10, y)); y += height + 24
    img.save(os.path.join(out, fname)); print('écrit', fname)

sheet("Dos — grand dorsal, losange du trapèze, niveau de l'omoplate", [(a, f'dos-{a}.png') for a in ('veryMuscular', 'muscular', 'adultMale', 'adultFemale', 'thin')], '03-dos-avant-apres.png', 560,
      "Les « sabres » du grand dorsal sont remplacés par une nappe de relief ; l'angle inférieur de l'omoplate monte de ≈ T9 à ≈ T8.")
sheet("Épaule — enveloppe du deltoïde (profil)", [(a, f'epaule-profil-{a}.png') for a in ('veryMuscular', 'adultMale')], '02a-epaule-profil-avant-apres.png', 560)
sheet("Épaule — enveloppe du deltoïde (face)", [(a, f'epaule-face-{a}.png') for a in ('veryMuscular', 'adultMale')], '02b-epaule-face-avant-apres.png', 560)
sheet("Main gauche — palmures interdigitales", [(a, f'main-face-{a}.png') for a in ('veryMuscular', 'adultMale')], '05-mains-avant-apres.png', 520,
      "Les palmures sont invisibles de dos (mains au repos tournées vers l'avant) ; la main reste très schématique (phalanges cylindriques).")
sheet("Tête + corps de face (la tête est le moteur de visage 2D : pas d'arrière de tête)", [(a, f'fig/figure-{a}.png') for a in ('veryMuscular', 'adultMale', 'adultFemale', 'thin', 'obese')], '01-tete-corps-avant-apres.png', 700)
