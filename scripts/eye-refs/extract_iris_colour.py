"""Mesure pixel par pixel des IRIS COLORÉS des planches 14 (6 yeux) et 15 (rangées 3 à 5 : 6 yeux) : `python3 scripts/eye-refs/extract_iris_colour.py`.
Ce que `extract_sheets.py` ne fait pas (il vise les iris noirs pleins des réfs 12 et 16) et que `extract_sprites.py` ratait sur 15 rangées 3-5 (limbe non détecté, aspect 1,0 par repli).

Méthode (aucune valeur inventée ; tout vient du masque, le reste est consigné « non mesuré ») :
  1. cellule d'œil = CELLS de extract_lashes.py (les mêmes boîtes annotées à la main : ANNOTATION HUMAINE, pas une mesure) ;
  2. iris = pixels SATURÉS (HSV S > 70, V > 35) ; ouverture morphologique (retire les flèches rouges de la réf. 14 : traits de ~8 px, et les cils colorés) ; composante connexe de plus grande aire ;
  3. limbe = ellipse ajustée sur le contour de cette composante REMPLIE (cv2.fitEllipse) ; demi-axes rx, ry en fraction de la largeur L de l'œil (celle de measures-lashes.json, même cellule) ;
  4. pupille = composante sombre (V < 70 et S < 255) compacte à l'intérieur de l'ellipse, la plus proche du centre ; reflets = composantes très claires (V > 215, S < 70) entièrement dans l'ellipse :
     centre normalisé par les demi-axes, rayon / demi-axe moyen ;
  5. CONFIANCE par œil : `fiable` si l'ellipse s'ajuste au contour (écart relatif médian < 0,06) et si l'aire du masque / aire de l'ellipse > 0,8 ; sinon `ambigu` (consigné, jamais écarté en silence) ;
     `rim` : l'encre sombre qui cerne l'iris (réf. 15 rang. 3-4) est comptée À PART (épaisseur = écart entre l'ellipse colorée et l'ellipse du colorée + sombre contigu), non dans le limbe.
Sortie : references/eyes/measures-iris-colour.json + artefacts/eyes-pass5/06-iris-couleur-superposition.png (chaque iris numéroté, ellipse verte = fiable, orange = ambigu)."""
import json, math
import numpy as np, cv2

ROOT = 'references/eyes/'
OUT = 'artefacts/eyes-pass5/'
CELLS = {
    '14': [(20, 60, 230, 200), (230, 50, 420, 200), (420, 55, 625, 215), (20, 270, 230, 420), (230, 260, 430, 420), (430, 270, 625, 420)],
    '15': [(60, 615, 290, 760), (350, 615, 585, 760), (60, 850, 290, 1030), (350, 850, 585, 1030), (60, 1110, 290, 1280), (350, 1110, 585, 1280)],   # rangées 3, 4, 5
}
FIRST_INDEX = {'14': 0, '15': 4}    # indice de la cellule dans CELLS['15'] complet (10 cellules : rangées 1-2 = 0..3)
SRC = {'14': '14.jpg', '15': '15.png'}
# ANNOTATION HUMAINE (relecture visuelle des superpositions artefacts/eyes-pass5/06-*, 2026-11-16) : l'ajustement automatique ne voit pas qu'une ellipse est sous-segmentée ou inclinée à tort.
# Une mesure n'est `fiable` que si le critère automatique ET cette relecture l'acceptent ; sinon `ambigu` (conservée, jamais écartée en silence).
HUMAN_REVIEW = {
    '14-00': 'partiel : iris vert/jaune, ellipse décalée vers le bas', '14-01': 'ok', '14-02': 'sous-segmenté : iris gris-bleu clair, ellipse trop petite', '14-03': 'ok',
    '14-04': 'partiel : iris sombre, ellipse décalée', '14-05': 'ok',
    '15-04': 'ok', '15-05': 'ok', '15-06': 'ellipse inclinée à tort (iris droit)', '15-07': 'ellipse inclinée à tort (iris droit)', '15-08': 'ok', '15-09': 'ok',
}


def load(name):
    from PIL import Image
    pil = Image.open(ROOT + SRC[name])
    if pil.mode in ('RGBA', 'LA'):
        bg = Image.new('RGB', pil.size, (255, 255, 255)); bg.paste(pil, mask=pil.split()[-1]); pil = bg
    return np.array(pil.convert('RGB'))


def fill(mask):
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    out = np.zeros_like(mask)
    if cnts: cv2.drawContours(out, [max(cnts, key=cv2.contourArea)], -1, 1, -1)
    return out


def ellipse_of(mask):
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cnts, key=cv2.contourArea)
    (cx, cy), (w, h), ang = cv2.fitEllipse(c)
    return (cx, cy), (w / 2, h / 2), ang, c


def fit_error(c, cx, cy, a, b, ang):
    """Écart relatif médian des points du contour à l'ellipse ajustée (|r - 1|, r = distance normalisée)."""
    t = math.radians(ang); ca, sa = math.cos(t), math.sin(t)
    d = []
    for (x, y) in c[:, 0, :]:
        dx, dy = x - cx, y - cy; u = (dx * ca + dy * sa) / max(a, 1e-6); v = (-dx * sa + dy * ca) / max(b, 1e-6)
        d.append(abs(math.hypot(u, v) - 1))
    return float(np.median(d))


def measure(rgb, box, L):
    x0, y0, x1, y1 = box
    sub = rgb[y0:y1, x0:x1]
    hsv = cv2.cvtColor(sub, cv2.COLOR_RGB2HSV)
    # iris = tout ce qui n'est NI du blanc (sclère, fond), NI de l'encre noire (traits de paupière : V < 60 et S < 90), NI l'ombre lavande de la paupière (teinte 112–140 de 180, S 25–120, V > 170) :
    # les dégradés de l'iris (réf. 14) sont en partie peu saturés, un simple seuil de saturation en perdait la moitié.
    H_, S_, V_ = hsv[:, :, 0].astype(int), hsv[:, :, 1].astype(int), hsv[:, :, 2].astype(int)
    white = (V_ > 235) & (S_ < 30)
    ink = (V_ < 60) & (S_ < 90)
    lav = (H_ >= 112) & (H_ <= 140) & (S_ >= 25) & (S_ <= 120) & (V_ > 170)
    m = ((~white) & (~ink) & (~lav)).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
    n, lbl, st, cen = cv2.connectedComponentsWithStats(m)
    if n < 2: return None
    cxm, cym = (x1 - x0) / 2, (y1 - y0) / 2
    def score(i):   # grande, proche du centre de la cellule, compacte (une flèche rouge est mince : solidité faible)
        area = st[i, cv2.CC_STAT_AREA]; comp_i = (lbl == i).astype(np.uint8); cn, _ = cv2.findContours(comp_i, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        hull = cv2.contourArea(cv2.convexHull(max(cn, key=cv2.contourArea))); sol = area / max(hull, 1)
        return area * sol ** 2 / (1 + math.hypot(cen[i][0] - cxm, cen[i][1] - cym) / 60)
    best = 1 + int(np.argmax([score(i) for i in range(1, n)]))
    comp = (lbl == best).astype(np.uint8)
    solid = fill(comp)
    (cx, cy), (a, b), ang, cnt = ellipse_of(solid)
    err = fit_error(cnt, cx, cy, a, b, ang)
    cover = float(solid.sum()) / (math.pi * a * b)
    # axe majeur / mineur dans le repère image : a = demi-largeur, b = demi-hauteur de l'ellipse de cv2 (angle de rotation de l'ellipse)
    ell = np.zeros_like(solid); cv2.ellipse(ell, ((cx, cy), (2 * a, 2 * b), ang), 1, -1)
    # pupille : sombre, compacte, dans l'ellipse (reflets exclus car clairs)
    dark = ((hsv[:, :, 2] < 70) & (ell > 0)).astype(np.uint8)
    dark = cv2.morphologyEx(dark, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    nd, ld, sd, cd = cv2.connectedComponentsWithStats(dark)
    pupil = None
    if nd > 1:
        j = 1 + int(np.argmin([math.hypot(cd[i][0] - cx, cd[i][1] - cy) - 0.05 * sd[i, cv2.CC_STAT_AREA] ** 0.5 for i in range(1, nd)]))
        w, h = sd[j, cv2.CC_STAT_WIDTH], sd[j, cv2.CC_STAT_HEIGHT]
        pupil = {'dx': float((cd[j][0] - cx) / a), 'dy': float((cd[j][1] - cy) / b), 'rx': float(w / 2 / a), 'ry': float(h / 2 / b)}
    # reflets : très clairs et peu saturés, entièrement dans l'ellipse
    hl = ((hsv[:, :, 2] > 215) & (hsv[:, :, 1] < 70)).astype(np.uint8)
    nh, lh, sh, ch = cv2.connectedComponentsWithStats(hl)
    lights = []
    for i in range(1, nh):
        if sh[i, cv2.CC_STAT_AREA] < 12: continue
        comp_i = (lh == i)
        if (ell[comp_i] > 0).mean() < 0.98: continue
        r = math.sqrt(sh[i, cv2.CC_STAT_AREA] / math.pi)
        lights.append({'dx': float((ch[i][0] - cx) / a), 'dy': float((ch[i][1] - cy) / b), 'r': float(r / ((a + b) / 2))})
    lights.sort(key=lambda h: -h['r'])
    # anneau d'encre : pixels sombres et peu saturés contigus à l'ellipse (dilatée de 8 px) -> épaisseur
    big = np.zeros_like(solid); cv2.ellipse(big, ((cx, cy), (2 * a + 16, 2 * b + 16), ang), 1, -1)
    ring = ((hsv[:, :, 2] < 85) & (hsv[:, :, 1] < 120) & (big > 0) & (ell == 0))
    rim = float(ring.sum()) / max(2 * math.pi * (a + b) / 2, 1)         # épaisseur moyenne (px) de l'encre qui cerne
    rec = {
        'cell': [int(v) for v in box], 'eyeWidth': L,
        'center': [float(cx + x0), float(cy + y0)], 'rx': float(a / L), 'ry': float(b / L), 'aspect': float(b / a), 'rotationDeg': float(ang % 180),
        'pupil': pupil, 'highlights': lights[:4], 'rimPx': round(rim, 2), 'rimOverIrisRadius': round(rim / ((a + b) / 2), 3),
        'fitError': round(err, 4), 'coverage': round(cover, 3),
        'confidence': 'fiable' if (err < 0.06 and cover > 0.8) else 'ambigu',
    }
    return rec, (cx + x0, cy + y0, a, b, ang)


def main():
    import os
    os.makedirs(OUT, exist_ok=True)
    lashes = {e['id']: e for e in json.load(open(ROOT + 'measures-lashes.json', encoding='utf8'))['eyes']}
    res = {'method': __doc__.split('\n')[0], 'annotations': {'cells': 'boîtes CELLS (annotation humaine, identiques à extract_lashes.py)', 'humanReview': HUMAN_REVIEW}, 'eyes': []}
    for name in ('14', '15'):
        rgb = load(name); dbg = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR).copy()
        for k, box in enumerate(CELLS[name]):
            eid = f'{name}-{FIRST_INDEX[name] + k:02d}'
            L = lashes[eid]['width'] if eid in lashes else float(box[2] - box[0])
            r = measure(rgb, box, L)
            if r is None: res['eyes'].append({'id': eid, 'confidence': 'rejeté', 'reason': 'aucun iris saturé après ouverture'}); continue
            rec, (cx, cy, a, b, ang) = r; rec['id'] = eid
            rec['autoConfidence'] = rec['confidence']; rec['humanReview'] = HUMAN_REVIEW.get(eid, 'non relu')
            if rec['confidence'] == 'fiable' and rec['humanReview'] != 'ok': rec['confidence'] = 'ambigu'
            res['eyes'].append(rec)
            col = (0, 160, 0) if rec['confidence'] == 'fiable' else (0, 140, 255)
            cv2.ellipse(dbg, ((cx, cy), (2 * a, 2 * b), ang), col, 2); cv2.putText(dbg, eid, (int(cx - a), int(cy - b - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, col, 2)
        cv2.imwrite(OUT + f'06-iris-couleur-superposition-{name}.png', dbg)
    ok = [e for e in res['eyes'] if e.get('confidence') == 'fiable']
    if ok:
        for key in ('rx', 'ry', 'aspect', 'rimOverIrisRadius'):
            v = np.array([e[key] for e in ok]); res.setdefault('summary', {})[key] = {'n': len(v), 'p10': round(float(np.percentile(v, 10)), 3), 'median': round(float(np.median(v)), 3), 'p90': round(float(np.percentile(v, 90)), 3)}
    res['notMeasured'] = ['silhouette (sclère) de la réf. 14 : blanche sur fond blanc, bord inférieur de paupière ouvert -> aucun polygone fermé mesurable', 'épaisseur de liner (interprétée)']
    json.dump(res, open(ROOT + 'measures-iris-colour.json', 'w'), indent=1, ensure_ascii=False)
    for e in res['eyes']:
        print(e['id'], e['confidence'], {k: e.get(k) for k in ('rx', 'ry', 'aspect', 'fitError', 'coverage', 'rimOverIrisRadius')} if e['confidence'] != 'rejeté' else e['reason'])


if __name__ == '__main__':
    main()
