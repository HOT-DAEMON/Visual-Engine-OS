#!/usr/bin/env python3
"""Assemble les planches de la voûte crânienne depuis les vignettes de `artefacts-vault.ts`.
Usage : compose-vault.py <dossier-vignettes> <dossier-artefacts>"""
import json, sys, os
from PIL import Image, ImageChops, ImageDraw, ImageFont

SRC, DST = sys.argv[1], sys.argv[2]
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

proofs = {p['id']: p for p in json.load(open(os.path.join(SRC, 'verification', 'proofs.json')))}
S = lambda *a: os.path.join(SRC, 'tiles', *a)
tw, th_ = 250, 270

# 1. Planches par paramètre
for pid, p in proofs.items():
    fmt = lambda v: 'seed' if v is None else ('%g' % v)
    labs = ['min = %s' % fmt(p['lo']), 'nominal = %s' % fmt(p['nom']), 'max = %s' % fmt(p['hi']), 'différence min ↔ max']
    def get(i, j):
        v = VIEWS[j]
        if i < 3: return load(S('param', pid, '%s_%s.png' % (['lo', 'nom', 'hi'][i], v)), tw, th_)
        return fit(diff(S('param', pid, 'lo_%s.png' % v), S('param', pid, 'hi_%s.png' % v)), tw, th_)
    b = p['best']; ok = '✓ PERCEPTIBLE' if p['perceptible'] else '✗ NON PERCEPTIBLE'
    grid('%s — %s' % (pid, ok), 'graine 3 · tête chauve · même caméra, même lumière, même rendu · meilleure vue : %s (silhouette %.2f %%, ombre %.2f %%) · rouge = pixels changés' % (VLAB[b['view']], b['xor'] * 100, b['shadeFrac'] * 100),
         4, 6, get, labs, [VLAB[v] + (' ★' if v in p['expectedViews'] else '') for v in VIEWS], tw, th_, f'{DST}/parametres/{pid}.png', '★ = vue où l\'effet est attendu (registre). Seuils : silhouette ≥ 0,4 % de l\'union ou ≥ 0,5 % des pixels dont la luminance change de > 0,05.')

# 2. Têtes complètes
def head_board():
    tw2, th2 = 330, 400
    grid('Tête complète — graine 3 : avec cheveux (haut) et chauve (bas, relief de voûte lisible)', 'même caméra et même éclairage', 2, 6, lambda i, j: load(S('tete', '%s_%s.png' % (['cheveux', 'chauve'][i], VIEWS[j])), tw2, th2), ['avec cheveux', 'chauve'], [VLAB[v] for v in VIEWS], tw2, th2, f'{DST}/00-tete-complete.png')
head_board()

# 3. Familles
fam = json.load(open(os.path.join(SRC, 'verification', 'familles.json')))
ids = list(fam.keys())
for k, chunk in enumerate([ids[:7], ids[7:]]):
    grid('Familles de crânes (%d/2) — combinaisons de mesures INDÉPENDANTES' % (k + 1), 'aucun modèle prédéfini : chaque ligne est une combinaison de valeurs des paramètres (voir verification/familles.json)', len(chunk), 6,
         lambda i, j, c=chunk: load(S('famille', '%s_%s.png' % (c[i], VIEWS[j])), tw, th_), [c[:18] for c in chunk], [VLAB[v] for v in VIEWS], tw, th_, f'{DST}/familles-{k + 1}.png')

# 4. Interactions
inter = json.load(open(os.path.join(SRC, 'verification', 'interactions.json')))
for key, v in inter.items():
    a, b = key.split('__')
    fa = lambda x: '%g' % x
    grid('Interaction : %s × %s' % (a, b), 'vue : %s · cellules voisines perceptibles : %d / %d · corrections strictes appliquées (cellules) : %s' % (VLAB[v['view']], v['voisinesPerceptibles'], v['voisinesTotal'], sum(1 for c in v['correctionsStrictes'] if c)), 3, 3,
         lambda i, j, key=key: load(S('inter', key, '%d_%d.png' % (i, j)), 300, 320), ['%s = %s' % (a, fa(x)) for x in v['va']], ['%s = %s' % (b, fa(x)) for x in v['vb']], 300, 320, f'{DST}/interactions/{key}.png')

# 5. Contraintes
c = json.load(open(os.path.join(SRC, 'verification', 'contraintes.json')))
txt = 'normal : %d correction(s) stricte(s) ; caricature : %d.  ' % (len(c['normal']), len(c['caricature'])) + ' | '.join('%s → %.2f' % (x['field'] if 'field' in x else x.get('id', '?'), x.get('to', x.get('value', 0)) if isinstance(x.get('to', x.get('value', 0)), (int, float)) else 0) for x in c['normal'][:2])
grid('Contraintes strictes (normal) contre caricature volontaire', 'demande : creux temporal 1 + tempes −1 + occiput plat 1 + inclinaison −1 · ' + txt, 2, 3, lambda i, j: load(S('contrainte', '%s_%s.png' % (['normal', 'caricature'][i], ['face', 'trois_quarts', 'dos'][j])), 300, 330), ['normal (contraint)', 'caricature (levé)'], ['face', '3/4', 'dos'], 300, 330, f'{DST}/contraintes.png')

# 6. Tissus
st = json.load(open(os.path.join(SRC, 'verification', 'registre-structures.json')))
im, d = sheet(150 + 3 * 300 + 460, 90 + 3 * 320 + 20, 'Tissus ≠ os — cuir chevelu (lignes) × os apparent (colonnes)', 'reliefs osseux actifs (mastoïde, nuchale, glabelle, creux temporal, sutures) · vue 3/4 arrière · même os, aspect différent selon style et réalisme')
for i, sc in enumerate([0.05, 0.5, 0.95]):
    d.text((8, 90 + i * 320 + 150), 'scalp = %g' % sc, font=F, fill=(30, 30, 30))
    for j, bs in enumerate([-1, 0, 1]):
        if i == 0: d.text((150 + j * 300 + 6, 70), 'boneShow = %g' % bs, font=FS, fill=(40, 40, 40))
        im.paste(load(S('tissus', '%d_%d.png' % (i, j)), 300, 320), (150 + j * 300, 90 + i * 320))
x0, y0 = 150 + 900 + 20, 90
d.text((x0, y0 - 20), 'Couches (mm) par région', font=F, fill=(30, 30, 30))
col = {'peau': (222, 170, 140), 'sous-cutané': (240, 214, 120), 'galéa': (190, 150, 190), 'périoste': (120, 170, 220), 'muscle temporal': (200, 70, 70), 'os': (225, 220, 205)}
seen = {}
for s in st:
    if s['region'] not in seen: seen[s['region']] = s
for k, (reg, s) in enumerate(seen.items()):
    y = y0 + k * 56; d.text((x0, y), reg, font=FS, fill=(30, 30, 30)); x = x0 + 80
    for l in s['tissues']:
        w = max(2, int(l['mm'] * 6.0)); d.rectangle([x, y, x + w, y + 22], fill=col[l['id']], outline=(80, 80, 80)); x += w
    d.text((x0 + 80, y + 26), 'τ fin %.2f · nominal %.2f · épais %.2f' % (s['transmission']['fin'], s['transmission']['nominal'], s['transmission']['epais']), font=FS, fill=(70, 70, 70))
for k, (n, cc) in enumerate(col.items()):
    d.rectangle([x0 + k * 66, y0 + 7 * 56 + 6, x0 + k * 66 + 12, y0 + 7 * 56 + 18], fill=cc, outline=(80, 80, 80)); d.text((x0 + k * 66 + 15, y0 + 7 * 56 + 4), n[:9], font=font(10), fill=(40, 40, 40))
im.save(f'{DST}/tissus.png', optimize=True)

# 7. Calque anatomique : sutures et lignes (données), repères, visibilité (vert = visible, rouge = caché + occluseur)
ov = json.load(open(os.path.join(SRC, 'verification', 'registre-placements.json')))
for name in ['chauve', 'cheveux']:
    tw3, th3 = 330, 400
    im, d = sheet(6 * tw3 + 20, 90 + th3 + 40, 'Calque anatomique — %s' % name, 'sutures (cyan) et lignes (orange) : DONNÉES du modèle, normalement non rendues ; points : vert = visible, rouge = caché (occluseur indiqué)')
    for j, v in enumerate(VIEWS):
        base = tile(S('tete', '%s_%s.png' % (name, v)))[0]; o = ov['%s_%s' % (name, v)]; dr = ImageDraw.Draw(base)
        for c in o['curves']:
            colr = (0, 170, 200) if c['id'].startswith('suture') else (235, 130, 20)
            for a, b in zip(c['pts'], c['pts'][1:]):
                if a['vis'] and b['vis']: dr.line([a['x'], a['y'], b['x'], b['y']], fill=colr, width=3)
        for p in o['points']:
            colr = (30, 160, 60) if p['visible'] else (200, 40, 40); dr.ellipse([p['x'] - 5, p['y'] - 5, p['x'] + 5, p['y'] + 5], fill=colr, outline=(255, 255, 255))
            if p['visible'] or p['by'] in ('hair', 'ear', 'brow'): dr.text((p['x'] + 6, p['y'] - 6), p['id'][:7] + ('' if p['visible'] else ':' + str(p['by'])[:4]), font=font(9), fill=(20, 20, 20))
        im.paste(fit(base, tw3, th3), (10 + j * tw3, 90)); d.text((10 + j * tw3 + 6, 72), VLAB[v], font=FS, fill=(40, 40, 40))
    os.makedirs(f'{DST}/registre', exist_ok=True); im.save(f'{DST}/registre/calque-{name}.png', optimize=True)

# 8. Synthèse : une ligne par paramètre (min ↔ max dans la meilleure vue)
ids = list(proofs.keys())
rh = 84
im = Image.new('RGB', (1060, 70 + len(ids) * rh), BG); d = ImageDraw.Draw(im); d.text((14, 10), 'Synthèse — chaque paramètre : minimum | nominal | maximum dans sa meilleure vue', font=FB, fill=(20, 20, 20)); d.text((14, 36), '%d paramètres · %d perceptibles' % (len(ids), sum(1 for p in proofs.values() if p['perceptible'])), font=F, fill=(70, 70, 70))
for k, (pid, p) in enumerate(proofs.items()):
    y = 66 + k * rh; v = p['best']['view']; d.text((10, y + 28), pid, font=F, fill=(30, 30, 30))
    for j, n in enumerate(['lo', 'nom', 'hi']): im.paste(fit(tile(S('param', pid, '%s_%s.png' % (n, v)))[0], 118, rh - 4), (190 + j * 124, y))
    im.paste(fit(diff(S('param', pid, 'lo_%s.png' % v), S('param', pid, 'hi_%s.png' % v)), 118, rh - 4), (190 + 3 * 124, y))
    d.text((190 + 4 * 124 + 8, y + 18), '%s' % VLAB[v], font=FS, fill=(50, 50, 50)); d.text((190 + 4 * 124 + 8, y + 36), 'sil. %.2f %% · ombre %.2f %%' % (p['best']['xor'] * 100, p['best']['shadeFrac'] * 100), font=FS, fill=(50, 50, 50))
    d.text((190 + 4 * 124 + 8, y + 54), '✓' if p['perceptible'] else '✗ NON', font=FB, fill=(30, 140, 50) if p['perceptible'] else (200, 30, 30))
im.save(f'{DST}/00-synthese-parametres.png', optimize=True)
# 9. Variété : voûtes TIRÉES au hasard (graines 1..N, tendances facultatives à 0,5)
rf = os.path.join(SRC, 'verification', 'aleatoire.json')
if os.path.exists(rf):
    rep = json.load(open(rf)); seeds = list(rep.keys()); V4 = ['face', 'trois_quarts_arriere', 'profil', 'dessus']
    grid('Variété — %d crânes tirés au hasard (voûte indépendante, tendances 0,5)' % len(seeds), 'visage de chaque graine inchangé ; chaque ligne : face · 3/4 arrière · profil · dessus', len(seeds), 4,
         lambda i, j: load(S('aleatoire', '%s_%s.png' % (seeds[i], V4[j])), 230, 250), ['graine %s · plaus. %.2f' % (k, rep[k]['plausibilite']) for k in seeds], [VLAB[v] for v in V4], 230, 250, f'{DST}/variete-aleatoire.png')
print('ok')
