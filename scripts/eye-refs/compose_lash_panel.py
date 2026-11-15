"""Planche 06 : pour chaque famille de cils, l'œil de RÉFÉRENCE dont elle est tiree (recadre d'après measures-lashes.json) au-dessus du rendu du moteur (deux yeux).
Prerequis : `npx tsx scripts/artefacts-eyes-lashes.ts` (ecrit /tmp/x/row-eye6.png et row-eye40.png). Usage : python3 scripts/eye-refs/compose_lash_panel.py"""
import json, os
from PIL import Image, ImageDraw
ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
REF = os.path.join(ROOT, 'references', 'eyes') + os.sep
OUT = os.path.join(ROOT, 'artefacts', 'eyes-refs3') + os.sep
FILES = {'12': '12.jpg', '13': '13.jpg', '14': '14.jpg', '15': '15.png', '16': '16.webp'}
FAMILIES = [('plume', '13-03'), ('touffes', '13-00'), ('frange-dense', '13-05'), ('fin-feminin', '12-04'), ('aile-liner', '15-04'),
            ('rond-kawaii', '16-16'), ('trio-externe', '12-00'), ('touffes-bas', '15-06'), ('ticks-reguliers', '15-08'), ('trainants', '14-02')]
J = json.load(open(REF + 'measures-lashes.json'))
eyes = {e['id']: e for e in J['eyes']}
CW, CH = 300, 230
panel = Image.new('RGB', (5 * CW, 6 * CH), (43, 47, 63)); d = ImageDraw.Draw(panel)
rows = [Image.open(f'/tmp/x/row-eye{i}.png').convert('RGB') for i in (6, 40)]
for k, (fam, rid) in enumerate(FAMILIES):
    col, r0 = k % 5, (k // 5) * 3
    e = eyes[rid]; x, y, w, h = e['bbox']; im = Image.open(REF + FILES[rid.split('-')[0]])
    if im.mode == 'RGBA':
        bg = Image.new('RGB', im.size, (255, 255, 255)); bg.paste(im, mask=im.split()[-1]); im = bg
    m = int(0.12 * max(w, h)); crop = im.convert('RGB').crop((max(0, x - m), max(0, y - m), x + w + m, y + h + m))
    if e['outerSide'] == 'left': crop = crop.transpose(Image.FLIP_LEFT_RIGHT)       # externe à droite, comme le moteur
    crop.thumbnail((CW - 10, CH - 30)); panel.paste(crop, (col * CW + (CW - crop.width) // 2, r0 * CH + 6))
    d.text((col * CW + 8, r0 * CH + CH - 18), f'ref {rid} (miroir si externe a gauche) -> {fam}', fill=(207, 214, 238))
    for j, row in enumerate(rows): panel.paste(row.crop((k * CW, 0, (k + 1) * CW, CH)), (col * CW, (r0 + 1 + j) * CH)) if False else None
    for j, row in enumerate(rows):
        cell = row.crop((k * CW, 0, (k + 1) * CW, CH))
        panel.paste(cell, (col * CW, (r0 + 1 + j) * CH)) if (r0 + 1 + j) < 6 else None
panel.save(OUT + '06-references-vs-moteur.png'); print('06-references-vs-moteur.png', panel.size)
