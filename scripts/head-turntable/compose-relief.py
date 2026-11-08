#!/usr/bin/env python3
"""
Assemble les preuves visuelles des reliefs de la tête (artefacts/head-turntable-v5/) à partir des rendus produits par
`artefacts-gallery.ts` (avant : arbre d'origine ; après : arbre courant), `artefacts-relief.ts` (grilles, champs) et `audit-chin-registration.ts`.
Usage : python3 compose-relief.py <avant> <après> <relief> <chin-registration.json> <sortie>
"""
import json, sys, os
from PIL import Image, ImageDraw
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

AV, AP, RL, CR, OUT = sys.argv[1:6]
os.makedirs(OUT, exist_ok=True)

def load(d, yaw):
    im = Image.open(f"{d}/yaw_{yaw}.png").convert("RGBA"); bg = Image.new("RGBA", im.size, (255, 255, 255, 255)); bg.alpha_composite(im); return bg.convert("RGB")

def label(img, text):
    d = ImageDraw.Draw(img); d.rectangle([0, 0, 8 + 7 * len(text), 16], fill=(255, 255, 255)); d.text((4, 2), text, fill=(0, 0, 0)); return img

def sheet(rows, yaws, scale, path):
    w, h = load(rows[0][1], yaws[0]).size; w, h = int(w * scale), int(h * scale)
    S = Image.new("RGB", (w * len(yaws), h * len(rows)), (255, 255, 255))
    for r, (name, d) in enumerate(rows):
        for c, y in enumerate(yaws):
            im = load(d, y).resize((w, h), Image.LANCZOS)
            if c == 0: label(im, name)
            S.paste(im, (c * w, r * h))
    S.save(path)

# 01 : avant / après, 6 graines, 5 lacets
rows = []
for s in range(1, 7): rows += [(f"graine {s} avant", f"{AV}/seed{s}"), (f"graine {s} apres", f"{AP}/seed{s}")]
sheet(rows, [20, 45, 70, 135, 160], 0.55, f"{OUT}/01-avant-apres-6-graines.png")
# 02 : oreille lointaine à 0°, 10°, 20°, 45° : planche (avant / après) et deux graines
rows = [("planche avant", f"{AV}/planche"), ("planche apres", f"{AP}/planche")]
sheet(rows, [0, 20, 45], 0.7, f"{OUT}/02-oreille-lointaine-planche.png")
# 03 : cou -> épaules, vues de profil et de trois quarts arrière
rows = []
for s in (2, 5): rows += [(f"graine {s} avant", f"{AV}/seed{s}"), (f"graine {s} apres", f"{AP}/seed{s}")]
sheet(rows, [90, 110, 135, 180], 0.7, f"{OUT}/03-cou-epaules.png")

# 04 : champs de relief (hauteur x azimut)
F = json.load(open(f"{RL}/champs.json"))
fig, ax = plt.subplots(2, len(F), figsize=(4.2 * len(F), 7), squeeze=False)
for j, (k, v) in enumerate(F.items()):
    for i, (nm, key) in enumerate([("crane (bosses parietales + asymetrie)", "skull"), ("joue (pommette, creux, masseter)", "cheek")]):
        a = np.array(v[key]); m = max(0.02, np.abs(a).max())
        im = ax[i][j].imshow(a, extent=[0, 180, v["ys"][-1], v["ys"][0]], aspect="auto", cmap="RdBu_r", vmin=-m, vmax=m)
        ax[i][j].set_title(f"{k} : {nm}", fontsize=8); ax[i][j].set_xlabel("azimut (0 = face, 90 = cote, 180 = nuque)", fontsize=7); ax[i][j].set_ylabel("y (U depuis le sommet)", fontsize=7)
        fig.colorbar(im, ax=ax[i][j], fraction=0.046, label="deplacement radial (U)")
fig.tight_layout(); fig.savefig(f"{OUT}/04-champs-de-relief.png", dpi=110); plt.close(fig)

# 05 : grilles lacet x tangage, a cote de la reference rotation-3d/01.jpg
ref = Image.open("references/rotation-3d/01.jpg").convert("RGB")
for s in sorted(d.split("seed")[1] for d in os.listdir(RL) if d.startswith("grille-seed")):
    g = f"{RL}/grille-seed{s}"; yaws, pitches = [90, 45, 0, -45, -90], [35, 18, 0, -18, -35]
    w, h = Image.open(f"{g}/y0_p0.png").size; sc = 0.62; w, h = int(w * sc), int(h * sc)
    G = Image.new("RGB", (w * 5, h * 5), (255, 255, 255))
    for r, p in enumerate(pitches):
        for c, y in enumerate(yaws):
            im = Image.open(f"{g}/y{y}_p{p}.png").convert("RGBA"); bg = Image.new("RGBA", im.size, (255, 255, 255, 255)); bg.alpha_composite(im)
            G.paste(bg.convert("RGB").resize((w, h), Image.LANCZOS), (c * w, r * h))
    rr = ref.resize((int(ref.width * G.height / ref.height), G.height), Image.LANCZOS)
    C = Image.new("RGB", (G.width + rr.width + 10, G.height), (255, 255, 255)); C.paste(G, (0, 0)); C.paste(rr, (G.width + 10, 0)); C.save(f"{OUT}/05-grille-lacet-tangage-graine{s}.png")

# 06 : menton, recalage vertical par vue
R = json.load(open(CR)); fig, ax = plt.subplots(1, 2, figsize=(11, 4))
yw = [r["yaw"] for r in R]
ax[0].plot(yw, [r["maxAvant"] for r in R], "o-", label="avant recalage"); ax[0].plot(yw, [r["maxApres"] for r in R], "s-", label="apres recalage vertical par vue")
ax[0].set_title("ecart maximal en bande machoire (U)"); ax[0].set_xlabel("lacet (deg)"); ax[0].legend()
ax[1].bar(yw, [r["dtU"] for r in R], width=8); ax[1].set_title("decalage vertical du rendu qui minimise l'ecart (U)"); ax[1].set_xlabel("lacet (deg)")
fig.tight_layout(); fig.savefig(f"{OUT}/06-menton-recalage-vertical.png", dpi=110); plt.close(fig)
print("ok", sorted(os.listdir(OUT)))
