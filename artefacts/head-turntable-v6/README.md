# Artefacts — tête 3D dans le pipeline et cou en cloche

Produits par `scripts/head-turntable/artefacts-v6-scene.ts`, `artefacts-v6.ts` (avant : arbre du commit e27d7b5 ; après : arbre courant) puis `compose-v6.py`. Docs : `docs/PIPELINE-HEAD-3D*.md`, `docs/HEAD-TURNTABLE-NECK-BELL.md`.

| Fichier | Contenu |
|---|---|
| `01-pipeline-head-3d-graine{3,7,42}.png` | scène du pipeline : le visage de face de l'hôte, puis la MÊME personne en `head_3d` à 0°, 45°, 90°, 135° (tangage 10°) |
| `02-cou-avant-apres.png` | 4 graines × lacet 0° / 90° / 180° : cou cylindrique (avant) / cloche des trapèzes (après) |
| `03-reference-07-contre-moteur.png` | cellule de dos de `rotation-3d/07.jpg` (celle qui a été mesurée) à côté du moteur à 180° |
| `mesures/profil-cou-reference-07.json` | largeurs de silhouette mesurées, courbe normalisée, comparaison à `smooth` |
| `mesures/verification-pipeline.json` | 3 couches de vérification par graine : 79 contrôles, 0 échec bloquant, 1 avertissement |

Lire avec l'esprit critique :
- Graine 3 (`01-…graine3.png`) : l'hôte a des cheveux bouclés avec une natte ; la tête 3D a une calotte lisse (la lisière est reprise, pas le volume). Les yeux 3D sont plus grands et plus ronds que ceux de l'hôte.
- Graine 42 : hôte chauve → tête chauve, iris olive repris, crâne large comme le visage : le cas le plus cohérent.
- `03-…` : la cloche est moins large et plus « vase » que le trapèze de la référence ; la coupe est un disque plat.
- Pas de planche lacet × tangage v6 : la grille ±35° est celle de `head-turntable-v5/05-…` (le cou y est l'ancien).
