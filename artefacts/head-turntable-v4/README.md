# Forme crânienne (longueur amplifiée) — preuves visuelles

Code : `src/head-turntable/engines/skull-model.ts` (`CRANIAL`, `cranialLength`, `cranialBackShift`), `engines/rows.ts`, `engines/from-face.ts` ; contrôles : `verify-head.ts`, `verify-skull.ts` ; doc : `docs/HEAD-TURNTABLE-SKULL-2.md`.
Les images AVANT viennent de l'arbre d'origine (commit 841008c), les images APRÈS de l'arbre modifié, mêmes graines 1 à 6, même hauteur (420 px).

| Fichier | Contenu |
|---|---|
| `01-avant-apres-5-lacets.png` | une graine par ligne, lacets 0° / 45° / 90° / 135° / 180°, AVANT (haut) puis APRÈS (bas) |
| `02-silhouettes-superposees-90-135.png` | contours des 6 graines superposés à 90° et à 135°, avant / après |
| `diversite.json` | diversité des silhouettes (XOR / union, moyenne sur 15 paires, tête seule) par lacet |
| `galerie-avant.csv`, `galerie-apres.csv` | longueur 3D du crâne, largeur, verdicts par graine |

Lecture honnête : la diversité des silhouettes monte de +26 % à 90° (profil) et de +3 % à 45°, +6 % à 135° ; elle reste inchangée à 0° et 180° (la largeur n'est pas touchée). Le gain visible est réel de profil, modeste en 3/4.
