"""Planches des artefacts du modèle de crâne (lit artefacts/head-turntable-v3/metrics.json et les rendus de artefacts-skull.ts).
Usage : python3 scripts/head-turntable/compose-skull.py [dossier, défaut artefacts/head-turntable-v3]"""
import json, sys
from PIL import Image, ImageDraw, ImageFont
D = sys.argv[1] if len(sys.argv) > 1 else 'artefacts/head-turntable-v3'
m = json.load(open(f'{D}/metrics.json')); seeds = m['seeds']; yaws = [45, 135, 160]; W = H = 360
F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 16)
sheet = Image.new('RGB', (60 + W * len(yaws) * 2, 40 + H * len(seeds)), (236, 236, 236)); d = ImageDraw.Draw(sheet)
for j, y in enumerate(yaws):
    for k, t in enumerate(['avant', 'après']): d.text((60 + (j * 2 + k) * W + 110, 10), f'{y}° — {t}', fill=(20, 20, 20), font=F)
for i, s in enumerate(seeds):
    d.text((6, 40 + i * H + H // 2), f'graine {s}', fill=(20, 20, 20), font=F)
    for j, y in enumerate(yaws):
        for k, t in enumerate(['avant', 'apres']): sheet.paste(Image.open(f'{D}/{t}/seed{s}/yaw_{y}.png').convert('RGB').resize((W, H)), (60 + (j * 2 + k) * W, 40 + i * H))
sheet.save(f'{D}/01-avant-apres-6-graines.png')
levels = ['0.15', '0.3', '0.5', '0.65']; C = 300
S = Image.new('RGB', (60 + C * len(seeds), 40 + C * len(levels) + 40), (250, 250, 250)); d = ImageDraw.Draw(S); sc = C * 0.40 / 0.6
P = lambda x, z, ox, oy: (ox + x * sc, oy - (z - 0.05) * sc)   # face vers le haut
for j, s in enumerate(seeds):
    d.text((60 + j * C + C // 2 - 30, 10), f'graine {s}', fill=(20, 20, 20), font=F)
    for i, l in enumerate(levels):
        e = m['sections'][f'seed{s}'][l]; ox = 60 + j * C + C / 2; oy = 40 + i * C + C * 0.62
        if j == 0: d.text((4, 40 + i * C + C // 2), f'y = {l}', fill=(20, 20, 20), font=F)
        d.polygon([P(x, z, ox, oy) for x, z in e['avant']], outline=(150, 150, 150))
        d.line([P(x, z, ox, oy) for x, z in e['apres'] + [e['apres'][0]]], fill=(200, 40, 40), width=3)
        d.text((60 + j * C + 6, 40 + i * C + C - 22), f"pb {e['pb']:.2f} qb {e['qb']:.2f} wf {e['wf']:.2f}", fill=(60, 60, 60), font=F)
d.text((60, 40 + C * len(levels) + 12), 'gris : ellipse (avant) · rouge : modèle de crâne (après) · face vers le haut · pb, qb : exposants de l’arrière · wf : point large (0 = arrière)', fill=(20, 20, 20), font=F)
S.save(f'{D}/02-vues-de-dessus-coupes.png')
