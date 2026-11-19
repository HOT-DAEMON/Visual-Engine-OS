"""Utilitaires communs de composition des planches de la voûte (partagés par compose-vault.py et compose-vault-2.py) : polices, vignettes, différence min/max, grilles."""
import json, sys, os
from PIL import Image, ImageChops, ImageDraw, ImageFont

VIEWS = ['face', 'trois_quarts', 'profil', 'trois_quarts_arriere', 'dos', 'dessus']
VLAB = {'face': 'face 0°', 'trois_quarts': '3/4 45°', 'profil': 'profil 90°', 'trois_quarts_arriere': '3/4 arrière 135°', 'dos': 'dos 180°', 'dessus': 'dessus'}
BG = (250, 248, 244)

def font(sz, bold=False):
    for p in ['/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf' % ('-Bold' if bold else ''), '/usr/share/fonts/dejavu/DejaVuSans%s.ttf' % ('-Bold' if bold else '')]:
        if os.path.exists(p): return ImageFont.truetype(p, sz)
    return ImageFont.load_default()
F, FB, FS = font(15), font(19, True), font(12)

def tile(path):
    im = Image.open(path).convert('RGBA'); bg = Image.new('RGBA', im.size, BG + (255,)); bg.alpha_composite(im); return bg.convert('RGB'), im.getchannel('A')

def diff(a, b):
    (ia, aa), (ib, ab) = tile(a), tile(b)
    lum = ImageChops.difference(ia.convert('L'), ib.convert('L')).point(lambda v: 255 if v > 13 else 0)
    sil = ImageChops.difference(aa.point(lambda v: 255 if v > 0 else 0), ab.point(lambda v: 255 if v > 0 else 0))
    mask = ImageChops.lighter(lum, sil)
    base = Image.blend(ib, Image.new('RGB', ib.size, (255, 255, 255)), 0.55)   # image « max » pâlie : le rouge ressort
    red = Image.new('RGB', ia.size, (220, 30, 30)); base.paste(red, mask=mask); return base

def sheet(w, h, title, sub=None):
    im = Image.new('RGB', (w, h), BG); d = ImageDraw.Draw(im); d.text((14, 10), title, font=FB, fill=(20, 20, 20))
    if sub: d.text((14, 36), sub, font=F, fill=(70, 70, 70))
    return im, d

def grid(title, sub, rows, cols, get, rowlab, collab, tw, th_, out, foot=None):
    L, TOP = 190, 70
    im, d = sheet(L + cols * tw + 10, TOP + rows * th_ + 20 + (22 if foot else 0), title, sub)
    for j, c in enumerate(collab): d.text((L + j * tw + 6, TOP - 20), c, font=FS, fill=(40, 40, 40))
    for i, r in enumerate(rowlab):
        d.text((8, TOP + i * th_ + th_ // 2 - 8), r, font=F, fill=(30, 30, 30))
        for j in range(cols):
            t = get(i, j)
            if t is not None: im.paste(t, (L + j * tw, TOP + i * th_))
    if foot: d.text((14, TOP + rows * th_ + 4), foot, font=FS, fill=(60, 60, 60))
    os.makedirs(os.path.dirname(out), exist_ok=True); im.save(out, optimize=True)

def fit(im, tw, th_):
    r = min(tw / im.width, th_ / im.height); return im.resize((int(im.width * r), int(im.height * r)), Image.LANCZOS)

def load(p, tw, th_): return fit(tile(p)[0], tw, th_)
