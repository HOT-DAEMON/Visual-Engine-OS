"""Mise en page des artefacts « membre supérieur 02 » à partir des images brutes (avant = commit précédent, après = courant).
Usage : python3 scripts/artefacts-upper-limb-02.py <brut-avant> <brut-apres> <sortie>"""
import json, sys, numpy as np
from PIL import Image, ImageDraw, ImageFont
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
from scipy import ndimage as ndi
A, B, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
BG = (59, 65, 87)
try: F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 20)
except Exception: F = ImageFont.load_default()
def cap(im, t, h=34):
    o = Image.new('RGB', (im.width, im.height + h), BG); o.paste(im, (0, h)); ImageDraw.Draw(o).text((10, 6), t, fill=(232, 236, 245), font=F); return o
def row(ims, gap=10):
    h = max(i.height for i in ims); o = Image.new('RGB', (sum(i.width for i in ims) + gap * (len(ims) - 1), h), BG); x = 0
    for i in ims: o.paste(i, (x, 0)); x += i.width + gap
    return o
def col(ims, gap=10):
    w = max(i.width for i in ims); o = Image.new('RGB', (w, sum(i.height for i in ims) + gap * (len(ims) - 1)), BG); y = 0
    for i in ims: o.paste(i, (0, y)); y += i.height + gap
    return o
L = lambda d, n: Image.open(f'{d}/{n}.png').convert('RGB')
L('/', '') if False else None
# 01 corps + tête
cap(L(B, 'full'), 'Corps par pixel + tête complète (pose ref-02) — deltoïde et trapèze en masses continues').save(f'{OUT}/01-corps-avec-tete.png')
# 02 vues libres
row([cap(L(B, f'view-{y}'), f'yaw {y}°') for y in (0, 35, 90, 145, 180)]).save(f'{OUT}/02-vues-libres.png')
# 03 épaule avant / après
rows = []
for d, t in ((A, 'AVANT (3 fuseaux)'), (B, 'APRÈS (masse continue)')):
    rows.append(row([cap(L(d, f'shoulder-{y}'), f'{t} — yaw {y}°') for y in (0, 35, 90, 180)]))
col(rows).save(f'{OUT}/03-epaule-avant-apres.png')
# 04 silhouettes
tiles = []
for rn in ('ref-02', 'ref-04'):
    tiles.append(row([cap(L(d, f'silhouette-{rn}'), f'{rn} — {t}') for d, t in ((A, 'avant'), (B, 'après'))]))
col(tiles).save(f'{OUT}/04-silhouettes-avant-apres.png')
# 05 référence vs moteur
r2 = Image.open('references/anatomy/ref-02-homme-muscles-colores.jpg').convert('RGB').crop((100, 100, 640, 560))
r4 = Image.open('references/anatomy/ref-04-homme-ecorche-profil-face.jpg').convert('RGB').crop((230, 0, 564, 450))
eng = L(B, 'view-0'); eng = eng.crop((0, 0, eng.width, int(eng.height * 0.5)))
def fit(im, h): return im.resize((int(im.width * h / im.height), h))
row([cap(fit(r2, 560), 'ref-02'), cap(fit(r4, 560), 'ref-04 (face)'), cap(fit(eng, 560), 'moteur (pose ref-02)')]).save(f'{OUT}/05-references-vs-moteur.png')
# 06 contours mesurés
mA, mB = json.load(open(f'{A}/measures.json')), json.load(open(f'{B}/measures.json'))
fig, ax = plt.subplots(2, 2, figsize=(13, 9)); fig.patch.set_facecolor('#1e2230')
for j, rn in enumerate(('ref-02', 'ref-04')):
    a = ax[0][j]; a.set_facecolor('#272c3d'); t = mB[rn]['top']; ta = mA[rn]['top']
    a.plot(t['ref']['x'], t['ref']['y'], 'o-', c='#ff5a5a', label='référence'); a.plot(ta['engine']['x'], ta['engine']['y'], 's--', c='#9aa3c0', label='avant'); a.plot(t['engine']['x'], t['engine']['y'], '^-', c='#4cd964', label='après')
    a.invert_yaxis(); a.set_title(f"{rn} — contour supérieur de l'épaule (unités de tête, 0 = base du cou)", color='w', fontsize=10); a.set_xlabel('distance à l\'axe (h)', color='w'); a.set_ylabel('profondeur sous la base du cou (h)', color='w'); a.legend(); a.tick_params(colors='w')
    w = ax[1][j]; w.set_facecolor('#272c3d'); W = mB[rn]['wall']; WA = mA[rn]['wall']
    w.plot(W['ref'], W['rows'], 'o-', c='#ff5a5a', label='référence'); w.plot(WA['engine'], WA['rows'], 's--', c='#9aa3c0', label='avant'); w.plot(W['engine'], W['rows'], '^-', c='#4cd964', label='après')
    w.invert_yaxis(); w.set_title(f"{rn} — paroi externe du bras (pose calibrée)", color='w', fontsize=10); w.set_xlabel('distance à l\'axe (h)', color='w'); w.set_ylabel('profondeur (h)', color='w'); w.legend(); w.tick_params(colors='w')
plt.tight_layout(); plt.savefig(f'{OUT}/06-contours-mesures.png', dpi=110, facecolor=fig.get_facecolor()); plt.close()
# 07 masses : un volume = une couleur ; écorché
row([cap(L(B, 'atoms'), 'un volume = une couleur : UNE masse par deltoïde'), cap(L(B, 'shoulder-flayed'), 'écorché (sans peau), épaule')]).save(f'{OUT}/07-masses-et-ecorche.png')
# 08 masque ref-04 (segmentation)
import gzip
im = Image.open('references/anatomy/ref-04-homme-ecorche-profil-face.jpg').convert('RGB'); W_, H_ = im.size; arr = np.asarray(im).copy()
for n, c in (('ref-04.silhouette.gz', (255, 60, 60)), ('ref-04.profile.silhouette.gz', (60, 220, 255))):
    m = np.unpackbits(np.frombuffer(gzip.open('references/anatomy/' + n).read(), dtype=np.uint8))[:W_ * H_].reshape(H_, W_).astype(bool)
    arr[m ^ ndi.binary_erosion(m)] = c
cap(Image.fromarray(arr), 'ref-04 : masque de face (rouge) et de profil (cyan) — segmentation par surface de fond ajustée').save(f'{OUT}/08-masque-ref-04.png')
rep = {'avant': {k: {m: mA[k][m] for m in ('iou', 'rowErr', 'spanRatio', 'shoulderRatio', 'pose')} for k in ('ref-02', 'ref-04')},
       'apres': {k: {m: mB[k][m] for m in ('iou', 'rowErr', 'spanRatio', 'shoulderRatio', 'pose')} for k in ('ref-02', 'ref-04')},
       'verification': mB['verification']}
json.dump(rep, open(f'{OUT}/rapport.json', 'w'), indent=1, ensure_ascii=False)
print('ok')
