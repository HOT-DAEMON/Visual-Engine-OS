# Vent sur les cheveux

`hair.wind = { x, y, flex }` (schéma `HairWind`, `src/schema/hair-system.ts`) ; implémentation `src/face/hair/wind.ts` ; tests `tests/hair-wind.test.ts`.
Preuve : `artefacts/hair-shapes/03-vent.png`.

## Modèle
Fonction pure `applyWind(géométrie, vent, H)` appliquée en dernier dans `hairGeometry`.
- `x` ∈ [−1, 1] : +1 pousse les pointes vers la droite de l'image ; `y` ∈ [−1, 1] : +1 soulève, −1 rabat ; `flex` ∈ [0, 1] : souplesse (0 = raide).
- Une mèche est un **levier** : la racine reste sur la lisière. Déplacement d'un sommet : `dx = 0,22 · flex · L · u² · x`, `dy = −0,6 · 0,22 · flex · L · u² · y`,
  `u` = abscisse réduite (racine 0 → pointe 1) du point le plus proche de la ligne médiane, `L` = longueur de la ligne médiane.
  La longueur est conservée au second ordre (la pointe se rapproche de la racine de `d²/2L`).
- Amplitude : plein vent (\|x\| = 1, flex = 1) ≈ 12° ; la pointe d'une mèche ne bouge jamais de plus de 0,3 L (testé).
- Masse arrière (bob/long) : levier vertical fixé à son bord haut (ligne médiane synthétique de 16 points).
- **Cohérence** : un sommet qui tomberait sur la peau du visage (`boundary.isFace`) est ramené vers sa position d'origine (6 dichotomies, sinon position d'origine).
  Les mèches `over` (occlusions voulues) et les mèches sans ligne médiane ne bougent pas.
- Vent nul ou `flex = 0` : la géométrie est strictement identique à celle sans vent (testé sur 10 coiffures).

## Contrat avec `windDir`
`windDir` (champ par racine, 3D) reste l'interface pour un futur moteur 3D ; `applyWind` est l'intégration 2D de face branchée dans le rendu.
Limites : `HAIR-SHAPES-REMAINING.md` (cheveux simulés, rafales, vent 3D sur la tête tournante).
