"""Assemble les artefacts v6 : cou avant/après (graines × lacet 0/90/180) et référence 07 (dos) contre le moteur à 180°.
Usage : python3 compose-v6.py <brut /tmp/v6> <sortie artefacts/head-turntable-v6>"""
import sys, os
from PIL import Image, ImageDraw, ImageFont
src, out = sys.argv[1], sys.argv[2]
FONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 15)   # police avec accents (la police par défaut de PIL n'a pas les caractères français)
seeds, yaws = [3, 5, 6, 11], [0, 90, 180]
def load(kind, s, y): return Image.open(os.path.join(src, kind, f's{s}_y{y}.png')).convert('RGB')
w, h = load('avant', 3, 0).size
sc = 0.6; cw, ch = int(w * sc), int(h * sc)
sheet = Image.new('RGB', (len(yaws) * cw * 2 + 30, len(seeds) * ch + 40), 'white'); d = ImageDraw.Draw(sheet)
d.text((10, 8), 'AVANT (cou cylindrique, évasement ×1,3)', fill='black', font=FONT); d.text((len(yaws) * cw + 40, 8), 'APRÈS (cloche des trapèzes, ×1,7 – 2,3)', fill='black', font=FONT)
for r, s in enumerate(seeds):
    for c, y in enumerate(yaws):
        sheet.paste(load('avant', s, y).resize((cw, ch)), (c * cw, 30 + r * ch))
        sheet.paste(load('apres', s, y).resize((cw, ch)), (len(yaws) * cw + 30 + c * cw, 30 + r * ch))
sheet.save(os.path.join(out, '02-cou-avant-apres.png'), optimize=True)
# Référence 07 (cellule de dos, recadrage mesuré) contre le moteur (graine 5, 180°, après).
ref = Image.open('references/rotation-3d/07.jpg').convert('RGB').crop((285, 791, 500, 991))
eng = load('apres', 5, 180); H = 520
ref = ref.resize((int(ref.width * H / ref.height), H)); eng = eng.resize((int(eng.width * H / eng.height), H))
t = Image.new('RGB', (ref.width + eng.width + 20, H + 24), 'white'); dd = ImageDraw.Draw(t)
dd.text((6, 4), 'référence rotation-3d/07 (dos, mesurée)', fill='black', font=FONT); dd.text((ref.width + 26, 4), 'moteur, graine 5, 180° (après)', fill='black', font=FONT)
t.paste(ref, (0, 24)); t.paste(eng, (ref.width + 20, 24)); t.save(os.path.join(out, '03-reference-07-contre-moteur.png'), optimize=True)
