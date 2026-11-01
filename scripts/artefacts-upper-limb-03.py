"""Mise en page des artefacts « membre supérieur 03 » (épaule resserrée, calotte abaissée, profondeur de l'abdomen, comparaison de profil à ref-04).
Usage : python3 scripts/artefacts-upper-limb-03.py <brut-avant> <brut-apres> <sortie>   (bruts : scripts/artefacts-upper-limb-02.ts + scripts/artefacts-profile-raw.ts)"""
import json, sys, gzip, numpy as np
from PIL import Image, ImageDraw, ImageFont
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
A, B, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
BG = (59, 65, 87); W, H = 564, 771
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
cap(L(B, 'full'), 'Corps par pixel + tête complète (pose ref-02) — épaule resserrée, abdomen plus profond').save(f'{OUT}/01-corps-avec-tete.png')
row([cap(L(B, f'view-{y}'), f'yaw {y}°') for y in (0, 35, 90, 145, 180)]).save(f'{OUT}/02-vues-libres.png')
col([row([cap(L(d, f'shoulder-{y}'), f'{t} — yaw {y}°') for y in (0, 35, 90, 180)]) for d, t in ((A, 'AVANT'), (B, 'APRÈS'))]).save(f'{OUT}/03-epaule-avant-apres.png')
# 04 profil : ref-04 (profil) vs moteur ; gris = les deux, rouge = référence seule, bleu = moteur seul
ref = np.unpackbits(np.frombuffer(gzip.open('references/anatomy/ref-04.profile.silhouette.gz').read(), dtype=np.uint8))[:W * H].reshape(H, W)
def overlay(d):
    eng = np.fromfile(f'{d}/profile-mask.bin', dtype=np.uint8).reshape(H, W); img = np.zeros((H, W, 3), np.uint8) + 30
    img[(ref == 1) & (eng == 1)] = (200, 200, 200); img[(ref == 1) & (eng == 0)] = (230, 60, 60); img[(ref == 0) & (eng == 1)] = (70, 120, 240)
    img[125:318] = img[125:318]; img[:125] = (img[:125] * 0.35).astype(np.uint8); img[318:] = (img[318:] * 0.35).astype(np.uint8)  # zone comparée (cou → crête iliaque) en pleine clarté
    return Image.fromarray(img[0:340, 0:230]).resize((460, 680), Image.NEAREST)
mA, mB = json.load(open(f'{A}/profile.json')), json.load(open(f'{B}/profile.json'))
r4 = Image.open('references/anatomy/ref-04-homme-ecorche-profil-face.jpg').convert('RGB').crop((0, 0, 230, 340)).resize((460, 680))
row([cap(r4, 'ref-04 (profil)'), cap(overlay(A), f"AVANT — IoU {mA['iou']:.3f}, erreur de profondeur {100*mA['rowErr']:.1f} %"), cap(overlay(B), f"APRÈS — IoU {mB['iou']:.3f}, erreur de profondeur {100*mB['rowErr']:.1f} %")]).save(f'{OUT}/04-profil-ref04-avant-apres.png')
# 05 contours mesurés (face)
a, b = json.load(open(f'{A}/measures.json')), json.load(open(f'{B}/measures.json'))
fig, ax = plt.subplots(2, 2, figsize=(13, 9)); fig.patch.set_facecolor('#1e2230')
for j, rn in enumerate(('ref-02', 'ref-04')):
    t, ta = b[rn]['top'], a[rn]['top']; p = ax[0][j]; p.set_facecolor('#272c3d')
    p.plot(t['ref']['x'], t['ref']['y'], 'o-', c='#ff5a5a', label='référence'); p.plot(ta['engine']['x'], ta['engine']['y'], 's--', c='#9aa3c0', label='avant'); p.plot(t['engine']['x'], t['engine']['y'], '^-', c='#4cd964', label='après')
    p.invert_yaxis(); p.set_title(f"{rn} — contour supérieur de l'épaule (h, 0 = base du cou)", color='w', fontsize=10); p.legend(); p.tick_params(colors='w')
    w = ax[1][j]; w.set_facecolor('#272c3d'); Wb, Wa = b[rn]['wall'], a[rn]['wall']
    w.plot(Wb['ref'], Wb['rows'], 'o-', c='#ff5a5a', label='référence'); w.plot(Wa['engine'], Wa['rows'], 's--', c='#9aa3c0', label='avant'); w.plot(Wb['engine'], Wb['rows'], '^-', c='#4cd964', label='après')
    w.invert_yaxis(); w.set_title(f"{rn} — paroi externe du bras (pose calibrée)", color='w', fontsize=10); w.legend(); w.tick_params(colors='w')
plt.tight_layout(); plt.savefig(f'{OUT}/05-contours-mesures.png', dpi=110, facecolor=fig.get_facecolor()); plt.close()
rep = {'face': {'avant': {k: {m: a[k][m] for m in ('iou', 'rowErr', 'spanRatio', 'shoulderRatio')} for k in ('ref-02', 'ref-04')}, 'apres': {k: {m: b[k][m] for m in ('iou', 'rowErr', 'spanRatio', 'shoulderRatio')} for k in ('ref-02', 'ref-04')}},
       'profil_ref04': {'avant': {k: mA[k] for k in ('iou', 'rowErr')}, 'apres': {k: mB[k] for k in ('iou', 'rowErr')}}, 'verification_epaule': b.get('verification'), 'verification_profil': mB['verification']}
json.dump(rep, open(f'{OUT}/rapport.json', 'w'), indent=1, ensure_ascii=False); print('ok')
