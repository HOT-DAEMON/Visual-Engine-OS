"""Extraction chiffrée des références d'ombre/lumière (artefacts/shadow de la branche hair-masses/artefacts).
Usage : python3 scripts/shadow-refs/extract.py <dossier des jpg> > references/shadow/lighting-stats.json
Deux familles : (A) planches à 2 tons (01, 06, 09) -> masque lumière/ombre par tête, fractions par bande anatomique, centroïde ;
(B) planches peintes (02, 03, 04, 05, 10) -> écarts de couleur ombre/lumière de la peau en OKLab."""
import sys, json, numpy as np
from PIL import Image
from scipy import ndimage as ndi
D = sys.argv[1]
def load(n): return np.asarray(Image.open(f'{D}/{n}.jpg').convert('RGB')).astype(np.float32) / 255
def lum(a): return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
def oklab(rgb):
    l = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    M1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929], [0.2119034982, 0.6806995451, 0.1073969566], [0.0883024619, 0.2817188376, 0.6299787005]])
    lms = np.cbrt(l @ M1.T)
    M2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468], [1.9779984951, -2.4285922050, 0.4505937099], [0.0259040371, 0.7827717662, -0.8086757660]])
    return lms @ M2.T
def probe(img, pts):
    """Médiane 7x7 autour de points choisis À LA MAIN sur la planche (le masque automatique par contour s'est avéré peu fiable : panneaux ratés, supprimés)."""
    return [[int(255 * v) for v in np.median(img[y - 3:y + 4, x - 3:x + 4].reshape(-1, 3), 0)] for x, y in pts]
out = {'source': 'branche hair-masses/artefacts, dossier shadow', 'planches': {}, 'palettes_peintes': {}}
# (A) planches à deux tons : tons de lumière / d'ombre mesurés en des points choisis à la main (voir probe)
for n, lit, sh in [('01', [(190, 100), (140, 130), (163, 184)], [(300, 150), (250, 200)]), ('06', [(230, 150), (120, 100)], [(80, 150)])]:
    im = load(n); L_ = probe(im, lit); S_ = probe(im, sh)
    ol = oklab(np.array(L_, np.float32) / 255).mean(0); os_ = oklab(np.array(S_, np.float32) / 255).mean(0)
    out['planches'][n] = {'ton_lumiere_rgb': L_[0], 'ton_ombre_rgb': S_[0], 'dL_oklab': float(ol[0] - os_[0]), 'ombre_vers_bleu_b': float(os_[2] - ol[2])}
# (B) palettes peintes : peau = teinte 5–45° (RGB), luminance entre 0,2 et 0,95 ; ombre = P10, mi-ton = P50, lumière = P90
res = {}
for n in ['02', '03', '04', '05', '10']:
    im = load(n); r, g, b = im[..., 0], im[..., 1], im[..., 2]; mx = im.max(-1); mn = im.min(-1); sat = (mx - mn) / np.maximum(mx, 1e-4)
    hue = np.degrees(np.arctan2(np.sqrt(3) * (g - b), 2 * r - g - b)) % 360
    m = (hue > 5) & (hue < 50) & (sat > 0.12) & (sat < 0.7) & (mx > 0.25) & (r >= g) & (g >= b)
    if m.sum() < 500: res[n] = None; continue
    px = im[m]; L = lum(px); q = np.quantile(L, [0.1, 0.5, 0.9]); sel = [px[(L >= lo - 0.02) & (L <= lo + 0.02)].mean(0) for lo in q]
    ok = [oklab(s[None])[0] for s in sel]
    res[n] = {'pixels_peau': int(m.sum()), 'L_ombre_mid_lumiere': [float(o[0]) for o in ok],
              'dL_lumiere_moins_ombre': float(ok[2][0] - ok[0][0]),
              'chroma': [float(np.hypot(o[1], o[2])) for o in ok], 'teinte_deg': [float(np.degrees(np.arctan2(o[2], o[1])) % 360) for o in ok],
              'dteinte_ombre_vers_lumiere_deg': float(((np.degrees(np.arctan2(ok[2][2], ok[2][1])) - np.degrees(np.arctan2(ok[0][2], ok[0][1])) + 180) % 360) - 180),
              'rgb': [[int(255 * v) for v in s] for s in sel]}
out['palettes_peintes'] = res
json.dump(out, sys.stdout, indent=1, ensure_ascii=False, default=lambda o: None if o is None else float(o))
