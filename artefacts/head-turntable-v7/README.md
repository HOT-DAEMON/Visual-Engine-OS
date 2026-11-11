# head-turntable-v7 — sourcils de l'hôte et coupe oblique du cou

Vues AVANT (commit 6d1411e) / APRÈS, produites par `scripts/head-turntable/artefacts-v7.ts` (lancé dans chaque arbre) puis assemblées par `compose-v7.py`.

| Fichier | Contenu |
|---|---|
| `01-sourcils-hote.png` | graines d'hôte 42, 77, 3, 11 : dessin de face de l'hôte, 3D avant (arc de la planche), 3D après à 0°, 35°, 70° (tangage 10°) |
| `02-cou-coupe-oblique-tete3.png`, `-tete5.png` | coupe du cou avant / après, tangage 0°, 25°, 45°, 60°, lacet 0° / 45° / 90° |
| `03-tete-complete-tete3.png`, `-tete5.png` | toute la tête après, tangage −45° … 60° × lacet 0° / 45° / 90° |
| `rapport-verification-avant.json`, `-apres.json` | contrôles par sujet (nombre, échecs durs ; après : valeurs des contrôles sourcils et coupe) |

Lecture honnête : le hôte 11 n'a pas de sourcil, la tête 3D n'en a pas non plus (correct). À 90° de lacet la coupe se lit comme une tranche en biais ; l'oreille et les yeux à fort tangage ne sont pas recalés (voir `docs/PIPELINE-HEAD-3D-REMAINING.md`).
