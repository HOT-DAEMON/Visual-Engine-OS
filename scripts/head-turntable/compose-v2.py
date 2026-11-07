"""Compose les planches de artefacts/head-turntable-v2/ à partir des PNG générés (PIL + numpy + scipy).
Entrées : avant/, apres/ (audit-planche.ts), contours/{avant,apres}/ (artefacts-annotate.ts), galerie/seedN/ (artefacts-gallery.ts). Usage : python3 compose-v2.py [dossier]"""
import sys, os
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

A = sys.argv[1] if len(sys.argv) > 1 else 'artefacts/head-turntable-v2'
YAWS = [0, 20, 45, 70, 90, 110, 135, 160, 180]

def flat(p):
    im = Image.open(p).convert('RGBA'); bg = Image.new('RGBA', im.size, (255, 255, 255, 255)); bg.alpha_composite(im); return bg.convert('RGB')

def alpha(p):
    """Pixels couverts par la tête : les PNG du moteur ont un fond blanc opaque, on prend donc « différent du blanc »."""
    a = np.asarray(Image.open(p).convert('RGBA')).astype(int)
    return (a[..., 3] > 0) & (np.abs(a[..., :3] - 255).max(axis=2) > 6)

def label(img, text, xy=(8, 6)):
    ImageDraw.Draw(img).text(xy, text, fill=(0, 0, 0)); return img

def bbox_all(paths, pad=12):
    m = None
    for p in paths:
        a = alpha(p); m = a if m is None else (m | a)
    ys, xs = np.where(m); H, W = m.shape; return (max(0, xs.min() - pad), max(0, ys.min() - pad), min(W, xs.max() + pad), min(H, ys.max() + pad))

def grid(rows, cell_w, title_col=None, labels=None):
    h = max(c.height for r in rows for c in r); out = Image.new('RGB', (cell_w * max(len(r) for r in rows), h * len(rows)), 'white')
    for i, r in enumerate(rows):
        for j, c in enumerate(r): out.paste(c, (j * cell_w, i * h))
    return out

# 01 : avant / après, 9 lacets
paths = [f'{A}/{d}/yaw_{y}.png' for d in ('avant', 'apres') for y in YAWS]
bx = bbox_all(paths); W = bx[2] - bx[0]; S = 0.34
rows = []
for d in ('avant', 'apres'):
    r = []
    for y in YAWS:
        im = flat(f'{A}/{d}/yaw_{y}.png').crop(bx); im = im.resize((int(im.width * S), int(im.height * S)), Image.LANCZOS); r.append(label(im, f'{d} · {y}°'))
    rows.append(r)
grid(rows, int(W * S)).save(f'{A}/01-avant-apres-9-lacets.png')

# 02 : gros plans mâchoire
tiles = []
for d in ('avant', 'apres'):
    r = []
    for y in (20, 45, 70, 90, 135):
        im = flat(f'{A}/{d}/yaw_{y}.png'); w, h = im.size
        c = im.crop((int(w * .10), int(h * .40), int(w * .80), int(h * .86))); c = c.resize((int(c.width * .62), int(c.height * .62)), Image.LANCZOS); r.append(label(c, f'{d} · {y}°'))
    tiles.append(r)
grid(tiles, tiles[0][0].width).save(f'{A}/02-machoire-gros-plans.png')

# 03 : galerie 6 têtes x 9 lacets
seeds = [s for s in range(1, 7) if os.path.isdir(f'{A}/galerie/seed{s}')]
paths = [f'{A}/galerie/seed{s}/yaw_{y}.png' for s in seeds for y in YAWS]; bx = bbox_all(paths); S = 0.42; rows = []
for s in seeds:
    r = []
    for y in YAWS:
        im = flat(f'{A}/galerie/seed{s}/yaw_{y}.png').crop(bx); im = im.resize((int(im.width * S), int(im.height * S)), Image.LANCZOS); r.append(label(im, f'graine {s} · {y}°'))
    rows.append(r)
grid(rows, rows[0][0].width).save(f'{A}/03-galerie-6-tetes-9-lacets.png')

# 04 : silhouettes superposées (face et profil), une couleur par graine
cols = [(220, 40, 40), (40, 110, 220), (30, 160, 70), (230, 140, 20), (140, 60, 190), (20, 160, 170)]
panels = []
for y in (0, 90):
    bx = bbox_all([f'{A}/galerie/seed{s}/yaw_{y}.png' for s in seeds]); base = Image.new('RGB', (bx[2] - bx[0], bx[3] - bx[1]), 'white'); arr = np.asarray(base).copy()
    for s, c in zip(seeds, cols):
        m = ndi.binary_fill_holes(alpha(f'{A}/galerie/seed{s}/yaw_{y}.png'))[bx[1]:bx[3], bx[0]:bx[2]]; edge = m & ~ndi.binary_erosion(m, iterations=2); arr[ndi.binary_dilation(edge, iterations=1)] = c
    im = Image.fromarray(arr); ImageDraw.Draw(im).text((8, 6), f'silhouettes superposees - {y} deg - graines ' + ' '.join(str(s) for s in seeds), fill=(0, 0, 0)); panels.append(im)
out = Image.new('RGB', (sum(p.width for p in panels), max(p.height for p in panels)), 'white'); x = 0
for p in panels: out.paste(p, (x, 0)); x += p.width
out.save(f'{A}/04-silhouettes-superposees.png')

# 05 : contours annotés avant / après (vert = convexe doux, orange = serré, rouge = angle vif, bleu = concave)
tiles = []
for d in ('avant', 'apres'):
    r = []
    for y in (45, 90, 135):
        im = Image.open(f'{A}/contours/{d}/annot_{y}.png').convert('RGB'); w, h = im.size
        c = im.crop((int(w * .10), int(h * .40), int(w * .80), int(h * .86))); c = c.resize((int(c.width * .7), int(c.height * .7)), Image.LANCZOS); r.append(label(c, f'{d} · {y}° · vert doux / orange serre / rouge vif / bleu creux'))
    tiles.append(r)
grid(tiles, tiles[0][0].width).save(f'{A}/05-contours-annotes.png')

# 08 : pixels modifiés de la planche (rouge) entre l'état d'origine et l'état corrigé
panels = []
for y in (0, 45, 90, 135):
    a = np.asarray(Image.open(f'{A}/avant/yaw_{y}.png').convert('RGBA')).astype(int); b = np.asarray(Image.open(f'{A}/apres/yaw_{y}.png').convert('RGBA')).astype(int)
    d = np.abs(a - b).max(axis=2) > 6; al = b[..., 3:4] / 255; img = b[..., :3] * al + 255 * (1 - al); img = img * 0.35 + 255 * 0.65; img[d] = [230, 20, 20]
    ys, xs = np.where(((a[..., 3] > 0) & (np.abs(a[..., :3] - 255).max(axis=2) > 6)) | ((b[..., 3] > 0) & (np.abs(b[..., :3] - 255).max(axis=2) > 6))); t = Image.fromarray(img.astype(np.uint8)).crop((100, ys.min() - 10, 900, ys.max() + 10)); t = t.resize((t.width // 2, t.height // 2), Image.LANCZOS); panels.append(label(t, f'{y}° · rouge = pixel modifié'))
out = Image.new('RGB', (sum(p.width for p in panels), max(p.height for p in panels)), 'white'); x = 0
for p in panels: out.paste(p, (x, 0)); x += p.width
out.save(f'{A}/08-pixels-modifies-planche.png'); print('ok')
