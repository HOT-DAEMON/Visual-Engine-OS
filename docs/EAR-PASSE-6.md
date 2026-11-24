# Moteur d'oreille — passe 6

Preuves : `artefacts/oreille-passe-6/` (voir son `README.md`). Rendus réels du moteur, jamais retouchés. Mesures : `scripts/ear-refs/` (`extract-ref01.py`, `engine-measures.ts`, `structure-map.ts`, `attach-gap.ts`). Tests : `tests/ear-passe6.test.ts`, `tests/ear-passe6-axes.test.ts`.

## 1. Méthode : mesurer la référence avant de corriger

`references/orreil/01.jpg` (oreille humaine colorée : rose = hélix/crus/lobule, bleu = anthélix, vert = tragus, gris = creux) est segmentée par couleur (`extract-ref01.py` → `references/orreil/measures-01.json`). Le moteur est mesuré avec les mêmes classes (`engine-measures.ts`) et dessiné dans le même code couleur (`structure-map.ts`). Les références 02 et 03 (dessins d'elfe, crayonné réaliste) servent de contrôle qualitatif : conque large qui descend vers l'antitragus, anthélix en arc, rebord d'hélix continu jusqu'au lobule.
Limite : la référence 01 est un dessin stylisé (hélix et anthélix épaissis) ; ses parts d'aire ne sont PAS prises comme cibles, seule la disposition l'est.

## 2. Défauts vus sur la carte des structures (avant)

1. Le lobule était fermé par une corde droite : arête horizontale nette, et un trou de peau nue entre la fin de l'hélix et le lobule.
2. L'anthélix était une dalle verticale mince, le Y minuscule.
3. La scapha était plafonnée à 0,10–0,155 : bande de peau nue entre elle et l'anthélix.
4. La conque s'arrêtait à 0,745 : bande lisse entre conque et lobule.

## 3. Corrections (`src/face/ear/structures.ts`)

| Défaut | Correction | Mesure (100 oreilles « natural », plan) avant → après |
|---|---|---|
| Corde du lobule | arc partant du bord intérieur de l'hélix, sous l'antitragus | peau nue 23,7 % → 13,4 % (avec 3 et 4) |
| Dalle d'anthélix | arc parallèle au bord postérieur, largeur 0,088, queue vers l'antitragus, branches 0,30 / 0,23, sillons collés à la largeur effilée | part d'anthélix 15,3 % → 19,6 % |
| Scapha plafonnée | `SCAPHA_FILL = 1,9` (la gouttière remplit la place mesurée, 90 % max) | — |
| Conque courte | cavum descend à 0,79, cymba 0,07, antitragus à (0,44 ; 0,79) | conque 25,1 % → 26,8 % |

Contrainte découverte par la vérification : la conque agrandie sortait du pavillon (oreilles étroites, pointues) ; les seuls sommets dehors sont ramenés vers le centre (correction `concha-inside`, tier strict).

## 4. Nouveaux axes (chacun a une planche et un test ≥ 378 px)

- `antihelix.upperBend`, `antihelix.lowerBend` (02B/02C) : courbure libre de chaque branche (avant : une courbure partagée).
- `concha.floor` (05E) : > 0 cuvette interne plus profonde ; < 0 plateau surélevé (le plateau est un peu « coussin » : limite).
- `helix.darwinSite` : position du tubercule de Darwin le long du bord (le contour bombe au bon endroit).
- Compositeur : flux dédié `pass6`, donc aucun tirage antérieur ne bouge.

## 5. Axes faibles renforcés

- `scapha.curvature` et `scapha.gradient` : voile de scapha plus sombre/opaque (rendu `render.ts`) et force de la surimpression de courbure relevée ; lisibles en gros plan (`artefacts/.../04-*`).
- `helix.continuity` : l'entaille est plus large (0,04–0,07 H) ; reste discrète à l'échelle de la tête. Le côté « continuité > 0 » ne change que l'égalité d'épaisseur : effet faible.

## 6. Attache sur mâchoire fuyante (tête 22)

- Pente de mâchoire suivie plafonnée à 0,7 (`EAR_LEAN_MAX`), cisaillement d'attache plus large (portée 0,36, max 0,4 H).
- L'angle d'écartement se referme vers le lobule (`LOBE_FLAT = 0,55`, `project.ts`, rapporté à la course racine → pied : la racine n'est jamais touchée). Cette formule est dans `placeEarPoint`, donc partagée par les moteurs 3D.
- Mesure (`attach-gap.ts`, 50 têtes) : écart du bas du lobule à la tête, médiane 0,21 H → 0,14 H, max 0,39 H → 0,26 H. Le bord antérieur reste collé (0 médiane).
- La tête 22 est meilleure mais encore oblique.

## 7. Vérification (`src/verify/ear-pass6.ts`)

Géométrie : `ear-lobule-no-chord`, `ear-helix-lobule-continuous`, `ear-concha-inside`. Anatomie : `ear-lobule-height(-max)`, `ear-concha-reaches-antitragus` (seuil abaissé pour lobule long/étiré), `ear-antihelix-above-lobule`, `ear-scapha-present`. Sur 120 oreilles composées : 0 erreur ; seuls restent les avertissements `ear-outline-turn` déjà connus (1 caricature, 5 fantasy).
Cette couche a trouvé deux vrais défauts de mes propres corrections (conque hors pavillon ; `ear-attached` en échec sur oreille de type équidé à cause de la fermeture d'angle mal rapportée) : les deux sont corrigés.

## 8. Tête 3D de profil

`head_3d` utilise le même modèle (`earModel` + `placeEarPoint`). Planche `10-tete-3d-oreilles-composees.png` : 6 têtes, profil et trois-quarts. Les oreilles sont placées et attachées ; le rendu 3D reste en style encre (pas le réalisme des vues 2D). Non validé par un seuil chiffré spécifique : voir `EAR-REMAINING.md`.

## 9. Ce que cette passe ne fait pas

Voir `docs/EAR-REMAINING.md`.
