"""Iris / pupille / reflets / dégradé des sprites colorés (réf. 15, RGBA) et des yeux colorés de la réf. 14, + flèches d'inclinaison de la 14
-> references/eyes/measures-sprites.json. Tout est CALCULÉ (couleur, composantes connexes, ellipse ajustée) ; aucune ancre manuelle.
Repère : dx, dy en fraction des demi-axes de l'iris (dy < 0 = haut), en espace écran (les deux yeux d'une paire montrent leurs reflets du même côté)."""
import json, math, os
import numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi
REF, OUT = 'references/eyes', 'artefacts/eyes-refs2'
def hsv_of(rgb): return cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV).astype(float) / [179, 255, 255]
def hexc(c): return '#%02x%02x%02x' % tuple(int(round(v)) for v in c)
def iris_measure(rgb, region, label, ell=None):
    """region : masque booléen de l'œil (sclère + iris). Iris = plus grande composante saturée ou sombre, hors sclère blanche et ombre lavande."""
    hsv = hsv_of(rgb); S, V = hsv[..., 1], hsv[..., 2]
    yy, xx = np.mgrid[0:rgb.shape[0], 0:rgb.shape[1]]
    if ell is None: return None
    cx, cy, rx, ry = ell; ie = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2; m = ie <= 1.0
    inside = m
    # pupille : le plus sombre au centre (V < 0.3, dans 0.7 des demi-axes), composante contenant le centre
    dark = inside & (V < 0.30) & (ie <= 0.7 ** 2); lab2, n2 = ndi.label(dark); pup = None
    if n2:
        kk = lab2[int(cy), int(cx)] or 1 + int(np.argmax(ndi.sum(dark, lab2, range(1, n2 + 1)))); pm = lab2 == kk; ys, xs = np.where(pm)
        if len(ys) > 30: pup = {'pupilWOverIrisW': round((xs.max() - xs.min() + 1) / (2 * rx), 3), 'pupilHOverIrisH': round((ys.max() - ys.min() + 1) / (2 * ry), 3), 'pupilAspect': round((ys.max() - ys.min() + 1) / (xs.max() - xs.min() + 1), 3)}
    # reflets : blancs peu saturés dans l'iris
    hl = inside & (V > 0.9) & (S < 0.3); lab3, n3 = ndi.label(ndi.binary_closing(hl)); hs = []
    for kk in range(1, n3 + 1):
        ys, xs = np.where(lab3 == kk)
        if len(ys) >= 20: hs.append({'dx': round((xs.mean() - cx) / rx, 3), 'dy': round((ys.mean() - cy) / ry, 3), 'rOverIris': round(math.sqrt(len(ys) / math.pi) / math.sqrt(rx * ry), 3)})
    hs.sort(key=lambda h: -h['rOverIris'])
    top = inside & (yy < cy - 0.35 * ry) & ~hl; bot = inside & (yy > cy + 0.35 * ry) & ~hl
    d = {'irisAspect': round(ry / rx, 3), 'irisCentre': [round(float(cx), 1), round(float(cy), 1)], 'irisRadii': [round(float(rx), 1), round(float(ry), 1)], 'highlights': hs[:5],
         'irisTop': hexc(rgb[top].mean(0)) if top.sum() > 30 else None, 'irisBottom': hexc(rgb[bot].mean(0)) if bot.sum() > 30 else None}
    if pup: d.update(pup)
    return d, ((cx, cy), (rx, ry))
def refine_ellipse(rgb, hint):
    """Indice (cx, cy, rx, ry) -> ellipse du limbe : sur chaque rayon, bord EXTÉRIEUR de l'anneau sombre (V < 0.38 -> V > 0.6) entre 0.8 et 1.3 fois l'indice ; moindres carrés robustes."""
    V = hsv_of(rgb)[..., 2]; cx, cy, rx, ry = hint; pts = []
    for a in np.deg2rad(np.arange(0, 360, 5)):
        prev_dark = False
        for t in np.arange(0.8, 1.3, 0.01):
            x, y = cx + math.cos(a) * rx * t, cy + math.sin(a) * ry * t
            if not (0 <= x < rgb.shape[1] - 1 and 0 <= y < rgb.shape[0] - 1): break
            v = V[int(y), int(x)]
            if v < 0.38: prev_dark = True
            elif prev_dark and v > 0.6: pts.append((x, y)); break
    P = np.array(pts, np.float32)
    if len(P) < 24: return hint
    for _ in range(3):
        (ex, ey), (w, h), ang = cv2.fitEllipse(P); res = np.abs(np.hypot((P[:, 0] - ex) / (w / 2), (P[:, 1] - ey) / (h / 2)) - 1)
        keep = res < max(0.08, np.percentile(res, 80))
        if keep.sum() < 20: break
        P = P[keep]
    (ex, ey), (w, h), ang = cv2.fitEllipse(P); ex_, ey_ = (w / 2, h / 2) if (ang < 45 or ang > 135) else (h / 2, w / 2)
    return (ex, ey, ex_, ey_)
HINTS15 = [(175, 122, 45, 72), (192, 424, 42, 62), (150, 690, 45, 45), (160, 930, 52, 52), (172, 1182, 52, 52)]
def sprites15():
    im = Image.open(f'{REF}/15.png').convert('RGBA'); a = np.array(im); rgb = a[..., :3]; al = a[..., 3] > 128; lab, n = ndi.label(al); res = {}; ov = rgb.copy(); ov[~al] = 40
    comps = sorted([(k, np.argwhere(lab == k)) for k in range(1, n + 1) if (lab == k).sum() >= 5000], key=lambda t: (round(t[1][:, 0].mean() / 100), t[1][:, 1].mean()))
    for i, (k, yx) in enumerate(comps):
        hx, hy, hrx, hry = HINTS15[i // 2]; hx = hx if i % 2 == 0 else 640 - hx
        m = iris_measure(rgb, lab == k, f'15-{i:02d}', refine_ellipse(rgb, (hx, hy, hrx, hry)))
        if not m: continue
        d, ((cx, cy), (rx, ry)) = m; ys, xs = yx[:, 0], yx[:, 1]; d['openingWidthPx'] = int(xs.max() - xs.min() + 1); d['openingHeightPx'] = int(ys.max() - ys.min() + 1)
        d['irisHOverOpeningH'] = round(2 * ry / d['openingHeightPx'], 3); d['irisWOverOpeningW'] = round(2 * rx / d['openingWidthPx'], 3); res[f'15-{i:02d}'] = d
        cv2.ellipse(ov, ((float(cx), float(cy)), (float(2 * rx), float(2 * ry)), 0), (255, 255, 0), 2)
        for h in d['highlights']: cv2.circle(ov, (int(cx + h['dx'] * rx), int(cy + h['dy'] * ry)), 4, (255, 0, 255), 2)
    Image.fromarray(ov).save(f'{OUT}/sprites-15-iris.png'); return res
def colored14():
    rgb = np.array(Image.open(f'{REF}/14.jpg').convert('RGB')); R, G, B = [rgb[..., i].astype(int) for i in range(3)]
    arrow = (abs(R - 178) < 35) & (G < 70) & (B < 70)
    arrow = ndi.binary_dilation(arrow, iterations=1)
    hsv = hsv_of(rgb); colored = (hsv[..., 1] > 0.30) & (hsv[..., 2] > 0.22) & ~arrow; colored = ndi.binary_opening(colored, iterations=2)
    lab, n = ndi.label(colored); res = {}; ov = rgb.copy(); idx = 0
    comps = sorted([(k, np.argwhere(lab == k)) for k in range(1, n + 1) if (lab == k).sum() >= 1200], key=lambda t: (round(t[1][:, 0].mean() / 150), t[1][:, 1].mean()))
    # flèches : composantes rouges fusionnées par proximité ; direction = du bout fin vers l'extrémité épaisse (pointe)
    am = ndi.binary_dilation(((abs(R - 178) < 35) & (G < 70) & (B < 70)), iterations=7); lab, n = ndi.label(am); arrows = []
    base = ((abs(R - 178) < 35) & (G < 70) & (B < 70)); dt = ndi.distance_transform_edt(base)
    for k in range(1, n + 1):
        m = (lab == k) & base
        if m.sum() < 250: continue
        P = np.argwhere(m)[:, ::-1].astype(float); c = P.mean(0); _, s, vt = np.linalg.svd(P - c, full_matrices=False); t = (P - c) @ vt[0]
        e0, e1 = P[t < np.percentile(t, 12)], P[t > np.percentile(t, 88)]; th0, th1 = dt[m][t < np.percentile(t, 12)].mean(), dt[m][t > np.percentile(t, 88)].mean()
        tail, head = (e0.mean(0), e1.mean(0)) if th1 > th0 else (e1.mean(0), e0.mean(0)); v = head - tail
        arrows.append({'centre': [round(float(c[0]), 1), round(float(c[1]), 1)], 'lengthPx': round(float(np.hypot(*v)), 1), 'angleDegScreen': round(float(math.degrees(math.atan2(-v[1], v[0]))), 1), 'pixels': int(m.sum())})
    return res, arrows
if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True); s15 = sprites15(); c14, arrows = colored14()
    json.dump({'method': 'automatique : couleur/saturation + composantes connexes + cv2.fitEllipse ; dx/dy en fraction des demi-axes de l\'iris, dy<0 = haut', 'sprites15': s15, 'arrows14': arrows}, open(f'{REF}/measures-sprites.json', 'w'), indent=1)
    for k, v in s15.items(): print(k, 'irisAsp', v['irisAspect'], 'pup', v.get('pupilWOverIrisW'), v.get('pupilAspect'), 'hl', [(h['dx'], h['dy'], h['rOverIris']) for h in v['highlights'][:3]], v['irisTop'], v['irisBottom'])
    print('arrows', len(arrows), [(a['angleDegScreen'], a['lengthPx']) for a in arrows])
