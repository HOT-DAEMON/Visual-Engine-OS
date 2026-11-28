"""Planche 09 : référence 04 (surcouche de mesure des chignons, `measure-buns.py`) à côté du rendu moteur `double_buns`, même largeur de tête affichée.
Usage : python3 -I compose-ref04.py  (depuis la racine du dépôt) → artefacts/hair-engine-pass12/09-reference-04-vs-moteur.png"""
from pathlib import Path
from PIL import Image, ImageDraw
root = Path(__file__).resolve().parents[2]; d = root / 'artefacts/hair-engine-pass12'
ref = Image.open(d / 'mesures/ref04-buns-overlay.png').convert('RGB').crop((0, 0, 736, 900))
eng = Image.open(d / 'mesures/double_buns-s2-y0.png').convert('RGB')
h = 900; ref2 = ref; eng2 = eng.resize((int(eng.width * h / eng.height), h))
sh = Image.new('RGB', (ref2.width + eng2.width + 30, h + 50), (244, 243, 241)); sh.paste(ref2, (10, 40)); sh.paste(eng2, (ref2.width + 20, 40))
t = ImageDraw.Draw(sh)
t.text((12, 12), 'référence 04 : chignon gauche ajusté par RANSAC (cercle bleu, r = 0,203 Hc) ; droit : ajustement refusé, lu à la main (≈ 0,21 Hc)', fill=(20, 20, 20))
t.text((ref2.width + 22, 12), 'moteur : double_buns, diamètre mesuré 0,41-0,42 H (cible 2 × 0,203 = 0,41 Hc)', fill=(20, 20, 20))
sh.save(d / '09-reference-04-vs-moteur.png'); print(sh.size)
