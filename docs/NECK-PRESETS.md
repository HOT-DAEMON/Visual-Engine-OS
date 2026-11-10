# Presets du cou

Source : `src/neck/presets.ts`. Preuve visuelle : `artefacts/neck-remaining/03-presets-cou.png` (13 presets, même visage, même corps, seul le preset change).

## Principe

Un preset est une **donnée** exprimée dans les paramètres existants (`FaceNeck` + `NeckSystem`). Il n'ajoute ni champ, ni chemin de rendu : `applyNeckPreset(id, overrides)` le valide par le schéma du cou, donc par les mêmes bornes et corrections que tout autre cou. `neckPresetPatch(id)` rend les données DÉCLARÉES (sans les défauts du schéma) : c'est ce que fusionne le générateur aléatoire.

Priorité de fusion : tirage aléatoire < preset < `neck` imposé par l'appelant (fusion profonde d'un niveau pour `system`).

## Catalogue (13)

| Famille | Ids |
|---|---|
| human | `human-average`, `human-slender`, `human-athletic`, `human-thick-short`, `human-elderly`, `human-child` |
| stylized | `stylized-swan`, `stylized-bull` |
| creature | `creature-serpent`, `creature-avian`, `creature-reptile`, `creature-dragon`, `creature-armored` |

Les presets « creature » servent à des hôtes non humains. Sur un visage humain ils donnent un cou de créature sous une tête humaine : c'est voulu pour la preuve, pas un usage recommandé.

## Preuves (`tests/neck-presets.test.ts`)

- chaque preset passe le schéma, produit un modèle sans erreur de vérification ; les presets humains n'ont **aucune correction** ;
- les presets sont **distincts deux à deux** : écart moyen de demi-largeur de la silhouette de face ≥ 0,8 % de H, ou longueur visible ≥ 3 % de H. Un preset qui ne se distingue d'aucun autre est un doublon et fait échouer le test ;
- un override gagne champ à champ sur le preset ; un id inconnu est une erreur explicite.

## Limites connues

- La distinction est prouvée sur la **silhouette de face**, pas sur le rendu final. Les presets `human-average` et `human-child` diffèrent surtout par l'âge et la masse : leur écart de silhouette passe le seuil, mais il est modeste à l'œil.
- `human-child` ne change que le cou : le corps garde son âge (`body.age`), le preset n'y touche pas.
- Les cous très longs (`stylized-swan`, `creature-serpent`) sortent du cadre de la planche : c'est le cadrage de la planche, pas du moteur.
- Les presets créature n'ont pas de preuve de cohérence avec une tête non humaine (il n'y en a pas dans le projet).
- Pas de variantes multiples par famille (le TODO §3 en demande plusieurs) : un preset par cas, 6 humains au total.
