# EYES-LASHES — familles de cils (réfs 12, 13, 16 ; 14 et 15 non exploitées)

Objectif : échantillonner les cils des références pixel par pixel et en tirer des familles distinctes (touffes, plumes, style féminin…) **en réglant le moteur de cils existant**
(`src/schema/eye-lashes.ts`, `src/geometry/eye/lashes.ts`, `lash-extras.ts`, `src/render/eye/lashes-render.ts`), sans créer de moteur par référence.

## Fichiers (tous nouveaux, aucun doublon trouvé avant création)
| Fichier | Rôle |
|---|---|
| `scripts/eye-refs/extract_lashes.py` | isole chaque œil (masque d'encre, composantes), profil de silhouette + analyse **trait par trait** (squelette de chaque cil) -> `references/eyes/measures-lashes.json`, contrôles `artefacts/eyes-refs3/02-cils-segmentation-{12,13,16}.png` |
| `scripts/eye-refs/cluster_lashes.py` | k-means sur les mesures (essai de regroupement automatique) -> `references/eyes/lash-families.json` |
| `src/generation/eye-lash-families.ts` | 6 familles = jeux de paramètres du moteur existant, chaque valeur annotée M (mesurée) / I (interprétée) / C (conversion largeur->hauteur) |
| `tests/eye-lash-families.test.ts` | schéma valide, pixels ajoutés, distinction deux à deux (Jaccard < 0,6), lecture des paramètres sur l'image |
| `scripts/artefacts-eyes-lashes.ts` | planche `artefacts/eyes-refs3/03-familles-de-cils.png` (6 familles × 2 yeux, + œil sans cils) |

## Méthode d'extraction
1. Encre = luminance < 110 ; fermeture ~0,6 % de la plus grande dimension ; composantes connexes ; on rejette paires fusionnées (réf. 16), sourcils et joues (plats, sans masse d'iris).
2. Masse épaisse = ouverture par un disque de rayon 1 % de la largeur L (4 px pour les petits yeux de la réf. 12, dont les traits font 4 à 8 px) ; l'encre restante au contact de la masse = cils.
3. Cils branchés sur un trait fin sans masse (arc de paupière de la réf. 12) : branches courtes du squelette finissant sur une jonction.
4. Par cil : longueur, base, pointe, angle, courbure, largeur de base, nombre de pointes (touffe si > 1). Mesures en fraction de L.

## Familles
`plume`, `touffes`, `frange-dense`, `fin-feminin`, `aile-liner`, `rond-kawaii` — sources et valeurs dans `eye-lash-families.ts`.

## Limites connues (honnêtes)
- **Regroupement automatique non concluant** : 23 yeux sur 50 ont < 2 cils du haut détectés ; un cluster de 16 mélange tout. Les familles viennent donc d'une lecture croisée mesures + planches, pas du k-means seul.
- **Orientation interne/externe peu fiable** : le côté externe est déduit du côté du plus grand dépassement ; le rapport externe/interne sort à 0,4–0,8 pour la plupart des yeux, ce qui contredit la lecture visuelle. Les valeurs `outerLength`, `outerLift` et `flick` sont donc **interprétées (I)**.
- **Réf. 16** : isolement incomplet (cils fins hors boîte, paires fusionnées) ; 12 composantes sur 26 sont des iris ou ovales sans cils.
- **Réfs 14 (sens de tracé, flèches) et 15 (ailes fines/épaisses)** : non mesurées ; `aile-liner` s'appuie sur la lecture visuelle de la 15.
- **Cils gris pâle (résolu)** : l'enveloppe `colorVariation` du moteur (0,15 par défaut) éclaircit certains cils jusqu'à #656566 sur une encre #120e18 ; les familles fixent `colorVariation: 0` + matériau d'encre opaque (`INK`). Mon premier diagnostic (cils masqués par le pli épicanthique) était faux : ce pli ne recouvre que la zone du canthus interne.
- **Contrat de zone** : le test pixel « no-paint-outside-zone » (cils <= 0,55 de la plus grande dimension) a fait raccourcir les ailes (`aile-liner` 0,7, `plume` 0,8) ; la zone n'a pas été élargie.
- **Intégration galerie** : `extraEyeLashFamily(index)` (`eye-gallery-ext.ts`) attribue une famille à 57 des 100 yeux avec un générateur à part (aucun tirage décalé) ; les 43 autres gardent leurs cils d'origine.
- **Planches** : `04-galerie-100-familles-de-cils.png` (échelle 0,6 pour tenir dans les cellules ; les yeux très hauts #1 et #2 débordent encore).
- Le test mesure la couleur des cils (luminance moyenne < 90) et une aire minimale de 900 px.
- Pas de cils « plumes » multicolores, pas de dispersion de couleur le long du cil, pas d'animation.
