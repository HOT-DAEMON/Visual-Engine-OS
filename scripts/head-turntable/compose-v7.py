"""Assemble les vues brutes de artefacts-v7.ts (arbre avant : /tmp/v7_before, arbre courant : /tmp/v7_after) en planches annotées.
Usage : python3 compose-v7.py <avant> <après> <sortie>"""
import json, shutil, sys
from PIL import Image, ImageDraw, ImageFont
A, B, OUT = sys.argv[1:4]
import os; os.makedirs(OUT, exist_ok=True)
def _font():
    for f in ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/dejavu/DejaVuSans.ttf'):
        try: return ImageFont.truetype(f, 15)
        except OSError: pass
    return ImageFont.load_default()
FONT = _font()
def tile(path, w):
    im = Image.open(path).convert('RGB'); return im.resize((w, int(im.height * w / im.width)))
def sheet(rows, cols, w, labels_top, labels_left, out, pad=44):
    ts = [[tile(p, w) for p in r] for r in rows]; h = max(t.height for r in ts for t in r)
    S = Image.new('RGB', (pad * 2 + len(cols) * w, pad + len(rows) * h), 'white'); d = ImageDraw.Draw(S)
    for j, l in enumerate(labels_top): d.text((pad * 2 + j * w + 6, 8), l, fill='black', font=FONT)
    for i, r in enumerate(ts):
        d.text((2, pad + i * h + h // 2), labels_left[i], fill='black', font=FONT)
        for j, t in enumerate(r): S.paste(t, (pad * 2 + j * w, pad + i * h))
    S.save(out)
hosts = [42, 77, 3, 11]
sheet([[f'{A}/face{s}.png', f'{A}/h{s}_y0.png', f'{B}/h{s}_y0.png', f'{B}/h{s}_y35.png', f'{B}/h{s}_y70.png'] for s in hosts], range(5), 330,
      ['visage hôte (dessin de face)', 'AVANT : 3D 0° (arc planche)', 'APRÈS : 3D 0° (sourcil hôte)', 'APRÈS : 35°', 'APRÈS : 70°'], [f'hôte {s}' for s in hosts], f'{OUT}/01-sourcils-hote.png')
for seed in (3, 5):
    rows = [[f'{A}/v{seed}_p{p}_y0.png', f'{A}/v{seed}_p{p}_y90.png', f'{B}/v{seed}_p{p}_y0.png', f'{B}/v{seed}_p{p}_y45.png', f'{B}/v{seed}_p{p}_y90.png'] for p in (0, 25, 45, 60)]
    sheet(rows, range(5), 300, ['AVANT lacet 0°', 'AVANT lacet 90°', 'APRÈS lacet 0°', 'APRÈS lacet 45°', 'APRÈS lacet 90°'], [f'tang. {p}°' for p in (0, 25, 45, 60)], f'{OUT}/02-cou-coupe-oblique-tete{seed}.png')
    rows = [[f'{B}/v{seed}_p{p}_y{y}.png' for y in (0, 45, 90)] for p in (-45, 0, 25, 45, 60)]
    sheet(rows, range(3), 330, ['lacet 0°', 'lacet 45°', 'lacet 90°'], [f'tang. {p}°' for p in (-45, 0, 25, 45, 60)], f'{OUT}/03-tete-complete-tete{seed}.png')
shutil.copy(f'{B}/rapport.json', f'{OUT}/rapport-verification-apres.json'); shutil.copy(f'{A}/rapport.json', f'{OUT}/rapport-verification-avant.json')
print('ok')
