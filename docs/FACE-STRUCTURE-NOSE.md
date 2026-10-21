# Nez : régions et axes dissociés (T1, T2)

Fichiers : `src/schema/face-nose-regions.ts` (contrat), `src/face/nose/regions.ts` (géométrie), `constraints.ts` (arbitre), `src/render/face/structure/nose.ts` (rendu).

## Les douze régions du cahier des charges

| Région | Où dans le code | Contrat |
|---|---|---|
| Racine (entre les yeux) | `nose/dorsum.ts` (existant) | `nose.root.*` |
| Dorsum (arête) | `nose/dorsum.ts` (existant) | `nose.dorsum.*` |
| Parois latérales | `regions.ts · sidewall()` | `nose.sidewall.slope`, `concavity` |
| Pointe | `nose/tip.ts` (existant) | `nose.tip.*` |
| Dômes des cartilages alaires | `regions.ts · dome()` | `nose.domes.prominence`, `separation` |
| Ailes | `nose/alae.ts` (existant) | `nose.alae.*` |
| Sillons alaires | `regions.ts · groove()` | `nose.groove.depth`, `length` |
| Base du nez | `regions.ts · base` | `nose.base.width`, `depth` |
| Narines (ouverture + bords) | `regions.ts · nostril()` | `nose.nostrils.opening`, `rim` |
| Columelle | `regions.ts · columella` | `nose.nostrils.columella` (largeur, existant), `nose.columella.hang` (descente) |
| Transitions vers les joues | `nose/junctions.ts` + `groove().cheekBlend` | `nose.junction.*` |
| Transitions vers philtrum et lèvre | `regions.ts · philtrum` | `nose.philtrum.depth`, `width`, `blend` |

Chaque région expose un polygone (ou une polyligne) dans `noseGeometry(p, lm).regions`.
Choix de conception : la paroi latérale est définie par une largeur positive pilotée par la pente (`amp × sin(πt)^0,7`), jamais par l'ancien `wallHalf`
(qui peut être plus étroit que l'arête près de la pointe : défaut trouvé pendant le développement, voir `docs/ERRORS-5.md`).

## Sept axes dissociés

| Axe | Paramètre | Mesure normalisée (test) |
|---|---|---|
| Longueur | `nose.length` | `baseY − eyeY` |
| Largeur | `nose.width` | `2 × outerX` des ailes |
| Projection | `nose.tip.projection` | projection ÷ longueur dorsale (rapport anatomique 45–95 %) |
| Hauteur de racine | `nose.root.height` | `eyeY − root.y` |
| Forme de pointe | `nose.tip.roundness`, `tip.width` | remplissage de la boîte englobante |
| Ouverture des narines | `nose.nostrils.opening` | aire de l'ouverture ÷ largeur² |
| Largeur de base | `nose.base.width` | demi-base ÷ crête alaire |

`tests/face-nose-regions.test.ts` : chaque axe change sa propre mesure (> 5 %) et laisse les six autres sous 2 %.
La projection est volontairement un RAPPORT à la longueur (contrainte anatomique existante) : son équivalent en pixels suit la longueur, comme en anatomie.

## Contraintes anatomiques (`constraints.ts`)

Chaque contrainte est une inégalité justifiée, ramène la valeur à la plus proche valeur admissible et la NOTE dans `regions.constraints` :

1. `base-carries-nostrils` — la demi-base ≥ demi-columelle + 9 % de la largeur des ailes ;
2. `domes-inside-tip` — séparation des dômes ≤ 0,3 + 0,7 × largeur de pointe ;
3. `columella-above-lip` — le bas de la columelle reste à 1,8 % de H au-dessus de la lèvre ;
4. `opening-vs-visibility` — ouverture ≤ 0,25 + 0,75 × visibilité de la narine ;
5. `philtrum-narrower-than-mouth` — la largeur du philtrum correspond à 12–36 % de la demi-bouche. Cette contrainte est déclarée mais n'est JAMAIS active : le schéma borne déjà l'axe à [0, 1] (elle sert de garde-fou si le schéma change).

## Limites connues

Voir `FACE-STRUCTURE-STATUS.md` : vue de trois quarts, narines vues de dessous, asymétrie des ailes en région, bosse osseuse volumétrique.
