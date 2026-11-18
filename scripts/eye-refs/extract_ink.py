"""Encre des références au trait (12, 13, 17) -> references/eyes/measures-ink.json. Tout est CALCULÉ, aucune ancre manuelle.
Mesure, par image : teinte de l'encre (médiane RGB des pixels de la plus haute densité sombre, zones sans gradient), teinte du papier, et `toneShare` = part des pixels
sans gradient hors papier qui n'appartiennent à AUCUN des 3 tons dominants (±16 de luminance) : 0 = aplats francs (au plus 3 tons plats), > 0 = dégradé.
Même définition que `toneShare` de scripts/lib/verify-eye-render.ts (règle de style `ink-flat`, yeux `finish: 'flat'`).
Usage : python3 scripts/eye-refs/extract_ink.py"""
import json
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

REF = 'references/eyes'
LOW_GRAD = 14      # écart max-min de luminance sur 5x5 en dessous duquel un pixel est « sans gradient »
PAPER_LUM = 235    # au-dessus : papier
INK_BAND = 16      # ±16 de luminance autour d'un ton dominant : même ton plat
TONES = 3          # nombre de tons plats tolérés (encre, ton moyen, ton clair)


def lum_of(a):
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]


def hexc(c):
    return '#%02x%02x%02x' % tuple(int(round(v)) for v in c)


def measure(name):
    rgb = np.asarray(Image.open(f'{REF}/{name}').convert('RGB')).astype(float)
    lum = lum_of(rgb)
    rng = ndi.maximum_filter(lum, 5) - ndi.minimum_filter(lum, 5)
    flat = rng <= LOW_GRAD
    dark = flat & (lum < 110)
    hist, edges = np.histogram(lum[dark], bins=22, range=(0, 110))
    k = int(hist.argmax())
    mode = (edges[k] + edges[k + 1]) / 2
    ink_px = dark & (abs(lum - mode) <= INK_BAND)
    paper_px = flat & (lum >= 240)
    nonpaper = flat & (lum < PAPER_LUM)
    h2, e2 = np.histogram(lum[nonpaper], bins=64, range=(0, 256))
    h2 = h2.copy(); tones = []
    for _ in range(TONES):
        j = int(h2.argmax()); tones.append(round(float((e2[j] + e2[j + 1]) / 2), 1)); h2[max(0, j - 4):j + 5] = 0
    near = np.zeros(lum.shape, bool)
    for t in tones: near |= abs(lum - t) <= INK_BAND
    off = nonpaper & ~near
    return {
        'file': name,
        'size': [rgb.shape[1], rgb.shape[0]],
        'ink': hexc(np.median(rgb[ink_px], axis=0)),
        'inkLuminanceMode': round(float(mode), 1),
        'inkPixels': int(ink_px.sum()),
        'paper': hexc(np.median(rgb[paper_px], axis=0)),
        'nonPaperFlatPixels': int(nonpaper.sum()),
        'dominantTones': tones,
        'toneShare': round(float(off.sum() / max(nonpaper.sum(), 1)), 4),
    }


out = {
    'definition': f'toneShare = pixels sans gradient (max-min lum 5x5 <= {LOW_GRAD}) hors papier (lum < {PAPER_LUM}) à plus de {INK_BAND} de luminance des {TONES} tons dominants / pixels sans gradient hors papier',
    'refs': {n.split('.')[0]: measure(n) for n in ['12.jpg', '13.jpg', '17.jpg']},
}
json.dump(out, open(f'{REF}/measures-ink.json', 'w'), indent=1, ensure_ascii=False)
print(json.dumps(out, indent=1, ensure_ascii=False))
