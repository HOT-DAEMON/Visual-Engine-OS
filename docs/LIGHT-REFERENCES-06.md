# Références d'ombre et de lumière — extraction (itération 06)

Source : dossier `shadow/` de la branche `hair-masses/artefacts` (10 images). Données chiffrées : `references/shadow/lighting-stats.json` (script `scripts/shadow-refs/extract.py`).
Planche d'ensemble : `artefacts/lighting-06/06-extraction-references.png`.

## Ce que chaque planche enseigne
| Réf. | Contenu | Information extraite | Utilisée dans |
|---|---|---|---|
| 01 | 9 têtes d'anime, flèche de lumière, 2 tons (blanc / bleu) | 9 directions ; terminateur qui épouse nez, orbite, pommette ; ombre du menton sur le cou ; ΔL OKLab 0,21 | `LIGHT_PATTERNS`, style `cel2`, ombre froide |
| 02 | 6 têtes peintes (fond sombre), lumières frontale, rasante, par bandes | ΔL 0,46 ; ombre plus rouge et plus saturée (diffusion sous-cutanée) | style `soft`, ombre chaude |
| 03 | 16 vignettes + sphère témoin | lumière = f(sphère) : la sphère donne le modèle ; ombre portée de la frange | modèle `shadeAt`, ΔL 0,50 |
| 04 | 4 têtes à couleurs de lumière extrêmes (orange, bleu, cyan / noir) | ombre portée en bandes sur les cheveux ; lumière colorée ≠ blanche ; ΔL 0,40 | `color`, `temperatureK`, `ambient` |
| 05 | soleil, lune, bougie, bicolore, store, feuillage | température de couleur ; projection (gobo) en bandes et en taches ; ΔL 0,49 | `gobo`, `rimColor`, motifs colorés |
| 06 | 9 masques, gris + blanc | zénithale (calotte + point de nez), contre-jour, masques sous les yeux ; ΔL 0,30 | motifs `overhead`, `frontal` |
| 07 | croquis noir et blanc, 9 vignettes + sphères | ombre portée des mèches et du col ; lecture par sphère | lu à l'œil (non mesuré) |
| 08 | « Lighting Patterns » : silhouette, split, overhead, underside, Rembrandt, loop, broad / short | vocabulaire des motifs ; larges / courts (côté de la lumière) | motifs, `expect` des contrôles |
| 09 | 16 têtes, 4 niveaux d'ombre (blanc, gris, noir) | cheveux et peau dans des tons différents sous la même lumière | non repris (cheveux : voir REMAINING) |
| 10 | 4 portraits (A–D) : lumière chaude, violette, bleue + orange, douce | **lumière de contour colorée** ; ombre portée de la frange sur le visage ; mélange de deux lumières | `rimColor`, `ambient` ; frange : REMAINING |

## Mesures (OKLab, écart de clarté lumière − ombre sur la peau)
| Famille | Planches | ΔL | Teinte ombre → lumière |
|---|---|---|---|
| Cel (aplats) | 01, 06 | 0,21 ; 0,30 | ombre bleue (01) ou gris-bleu (06) |
| Peint | 02, 03, 04, 05, 10 | 0,46 ; 0,50 ; 0,40 ; 0,49 ; 0,41 | ombre plus rouge : +1° à +39° de teinte vers le jaune du côté lumière |
Le moteur (artefact 03) : cel 0,20–0,30, peint 0,29 par défaut (réglable : `contrast`, `intensity`, `shadowHardness`). **Le peint reste en deçà des références (0,29 contre 0,40–0,50)** ; décision : un défaut naturel plutôt que dramatique.

## Ce qui n'a pas pu être mesuré (et pourquoi)
- **Parts éclairées par zone (front, yeux, nez, bouche) sur les planches 01, 06, 09.** Un premier extracteur, fondé sur le contour (remplissage des trous), a donné des têtes aberrantes
  (par exemple 43 × 53 px au lieu de ≈ 230 × 290) : **résultats supprimés**, non utilisés. Les fourchettes des motifs (`expect`) sont une **lecture à l'œil** de ces planches, pas une mesure.
- Planches 07, 08, 09 : pas de teinte mesurée (noir et blanc, pas de peau).
- Les directions de lumière de la planche 01 sont lues sur les flèches (numérotation 1–9) ; les élévations sont estimées.
