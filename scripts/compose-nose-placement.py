"""Planche avant/après de la loi de placement des narines (docs/NOSE-NOSTRIL-PLACEMENT.md).
Usage : python3 scripts/compose-nose-placement.py <rendus-avant> <rendus-apres> <dossier-sortie>
Ne fait QUE composer des images déjà rendues par scripts/artefacts-nose-placement.ts (aucune donnée inventée) ; la 3e colonne est la différence absolue réelle (×4)."""
import sys
from PIL import Image, ImageChops, ImageDraw, ImageFont
b, a, out = sys.argv[1:4]
F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13)
IDS = ['std-03', 'std-07', 'std-11', 'std-15', 'hard-09-nez-projection-maximale', 'hard-10-nez-minimal', 'hard-05-encre-contours-maximaux']
def load(d, n): return Image.open(f'{d}/{n}.png').convert('RGB')
W, H = load(b, IDS[0]).size
sheet = Image.new('RGB', (3 * W + 40, len(IDS) * (H + 26) + 40), (44, 48, 64))
d = ImageDraw.Draw(sheet)
for j, t in enumerate(['AVANT (HEAD : narines collées à la columelle)', 'APRÈS (placement à 42 % de la marge)', 'différence absolue × 4']): d.text((10 + j * (W + 10), 10), t, font=F, fill=(255, 255, 255))
for i, n in enumerate(IDS):
    x0, y0 = load(b, n), load(a, n); diff = ImageChops.difference(x0, y0).point(lambda v: min(255, v * 4))
    y = 34 + i * (H + 26)
    for j, im in enumerate([x0, y0, diff]): sheet.paste(im, (10 + j * (W + 10), y))
    d.text((10, y + H + 4), n, font=F, fill=(200, 220, 255))
sheet.save(f'{out}/01-avant-apres-visages.png')
# dessous éclairé : avant / après pour 3 nez
names = ['defaut', 'pyramide', 'cloche-ailes']
ims = [(load(b, f'dessous-{n}-40'), load(a, f'dessous-{n}-40')) for n in names]
w = max(max(p.size[0], q.size[0]) for p, q in ims); h = max(max(p.size[1], q.size[1]) for p, q in ims)
s2 = Image.new('RGB', (len(names) * (w + 10) + 10, 2 * (h + 24) + 40), (44, 48, 64)); d2 = ImageDraw.Draw(s2)
d2.text((10, 8), 'Dessous éclairé à 40° (ligne 1 : AVANT, ligne 2 : APRÈS) : nez par défaut, « pyramide », « cloche-ailes »', font=F, fill=(255, 255, 255))
for k, (p, q) in enumerate(ims):
    s2.paste(p, (10 + k * (w + 10), 30)); s2.paste(q, (10 + k * (w + 10), 30 + h + 24)); d2.text((10 + k * (w + 10), 34 + h), names[k], font=F, fill=(200, 220, 255))
s2.save(f'{out}/02-dessous-avant-apres.png')
print('ok')
