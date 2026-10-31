# Volumes 3D : mesures de temps

Mesures `scripts/artefacts-volume.ts` (même machine, médianes de 8 à 200 itérations, `rapport.json`). Corps `muscular`, 176 volumes dessinés.

| Étape | Mesure |
|---|---|
| Géométrie des volumes (à froid) | ≈ 6 ms |
| Rendu SVG `full` (nouveau point de vue, géométrie en cache) | ≈ 30 ms · 463 Ko |
| Rendu SVG `fast` | ≈ 19 ms · 193 Ko |
| `volumeMarkup` déjà vu (cache de contenu) | ≈ 0,2 ms |
| Rastérisation 400 px, `full` / `fast` | ≈ 49 / 27 ms |
| Référence : corps 2D (géométrie + SVG à froid) | ≈ 12 ms |

## Ce qui a réellement été fait
- Géométrie mémoïsée **sans** la caméra : tourner autour du corps ne recalcule que la projection (les 36 vues d'une rotation partagent 1 géométrie).
- Mode `fast` : 8 points par section au lieu de 14, pas d'ombre de contact ni d'occlusion aux extrémités, dégradés à 5 arrêts, pas de liserés de fibres.
  Gain mesuré : −58 % de SVG, −37 % de temps de rendu, −45 % de rastérisation.
- Cache de contenu `volumeMarkup` (comme `bodyMarkup`).

## Ce qui n'a PAS été amélioré (honnêteté)
- Le rendu `full` d'un corps 3D coûte ≈ 2,5× le corps 2D à froid : l'objectif « réduire drastiquement » n'est atteint que pour les points de vue répétés
  (cache) et le mode `fast`. Le visage (non traité ici) reste le poste dominant d'une figure complète.
- Pistes non réalisées : fusion des chemins de fibres entre muscles voisins, dédoublonnage des dégradés identiques, élimination des volumes entièrement
  masqués (z-buffer grossier), dégradés partagés par palette, SVG compact (coordonnées entières à petite échelle).
