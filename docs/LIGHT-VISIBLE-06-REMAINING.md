# Éclairage — ce qui reste après l'itération 06 (par composant)

**Bilan honnête** : l'ombre et la lumière sont maintenant visibles et vérifiées sur la tête et le corps, mais le résultat n'égale pas les références peintes. Ce qui suit n'est pas fait ou pas mesuré.

## Tête
- **Les yeux ne sont pas des surfaces du relief.** L'iris, les cils, les paupières sont ombrés par le multiplicateur, mais l'orbite n'a pas de globe : pas de reflet d'environnement, pas d'ombre de paupière portée sur l'œil (planche 03, 10).
- **Les cheveux ne projettent pas d'ombre.** La frange sur le front, la mèche sur l'œil (planches 03, 04, 07, 10) sont l'effet le plus reconnaissable des références : non modélisé. Piste : champ de profondeur des cheveux depuis `hair-grammar` ajouté au relief.
- **Les cheveux reçoivent l'ombre de la peau** (le multiplicateur couvre le dôme du crâne) mais pas sa propre direction de brillance : la mèche éclairée n'est pas plus claire. → **Traité pour la tête 3D** (`hair-light.ts`, `LIGHT-HEAD3D-08.md`) ; reste à faire pour `head_lit` de face.
- **Seconde lumière** (rebond par en dessous, remplissage) non modélisée : le motif « zénithale » des planches (bas du visage blanc, cou sombre) en dépend ; le moteur donne le bas du visage à l'ombre. → **Rebond (`bounceAt`) lu par la tête 3D** (`LIGHT-HEAD3D-08.md`) ; `head_lit` et le corps ne le lisent pas encore.
- **Relief approximatif** : amplitudes (arcade 0,045 W, orbites 0,065 W, pommettes 0,022 W…) tirées d'ordres de grandeur anatomiques, pas mesurées sur une photo ; les oreilles sont des plaques (pas d'hélix creusé) ; pas de relief de la bouche ouverte, de la barbe, des sourcils.
- **Terminateur anguleux** à certains endroits (pommette, arcade) en cel : la pente du relief y change brusquement ; un lissage du champ de profondeur est à essayer.
- Une tête tournée (`headTurn`) n'a pas de relief tourné : la couche n'est posée que de face (`yaw = 0`).
  → **Partiellement traité (10 nov. 2026)** : la tête en rotation `head_3d` lit maintenant ce même moteur (option `lit`, `LIGHT-HEAD3D-07.md`) ; la couche `head_lit` reste de face seulement.

## Corps
- **La tête ne projette son ombre que sur le haut du cou 3D**, recouvert par le cou du visage ; elle n'atteint pas la poitrine ni l'épaule avec les lumières testées (profondeur de la tête insuffisante au-delà du menton). Mesuré : 253–378 pixels assombris, tous entre le menton et la base du cou.
- **Les peaux de tronc, bras et jambe sont une seule teinte** : pas de variation de teint, pas de sous-teinte rouge aux plis (coude, aisselle), pas de diffusion sous-cutanée aux oreilles et aux doigts.
- Ombre portée à grille grossière (facteur 2) : ombres des doigts fins un peu floues ; non mesuré contre la pleine résolution.
- Vues autres que de face : le corps est éclairé et projette ses ombres, la tête n'a pas de couche.

## Style et contrôles
- ΔL du mode peint (0,29) **sous** les références peintes (0,40–0,50).
- Les fourchettes des motifs sont une lecture à l'œil (voir `LIGHT-REFERENCES-06.md`) ; aucun contrôle de ressemblance pixel à pixel aux références.
- Pas de contrôle de cohérence d'éclairage **entre** la tête et le corps (même direction, même teinte à la jonction du cou) ; un raccord visible subsiste au bas du cou (fondu sur 12 % de la hauteur).
- Gobo « store » et « feuillage » : non vérifiés par les contrôles (artefact 03 seulement).

## Performance
- Figure complète ≈ 9 s à 1 100 px ; tête seule ≈ 2,5 s à 2,4 px/unité. Cache de la tête (relief + ombres) par visage et par lumière : non fait. Marche de rayon en JS pur (WebGL / GPU envisageable).

## Prochaine étape la plus rentable
1. Relief des cheveux (frange) pour l'ombre portée sur le front et l'œil.
2. Seconde lumière (rebond / remplissage) et motif zénithale complet.
3. Contrôle de raccord tête ↔ cou ↔ épaules, puis tête tournée.
