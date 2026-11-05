# Relations explicites du visage : nez, bouche, oreille, mâchoire, cheveux

> État au 5 nov. 2026. Code : `src/anatomy/face-relations.ts` · tests : `tests/face-relations.test.ts` · mesure : `scripts/relations-measure.ts` · preuve : `artefacts/face-relations/`.

## Principe

Chaque relation relie deux composants **canoniques** (`anatomy/components.ts`), appartient à une famille et est **mesurée sur la géométrie produite**
(repères, `noseGeometry`, `earGeometry`, orbites publiées), jamais lue dans un paramètre.

- **géométrique** : où c'est posé (ex. la pointe du nez reste au-dessus de la lèvre) ;
- **anatomique** : à quoi cela doit correspondre (canons larges) ;
- **visuelle** : comment cela se voit (ex. la ligne capillaire ne recouvre pas l'orbite).

Sévérité : `error` bloque `verifyPipeline` ; `warn` signale. Les seuils anatomiques sont des **canons larges, pas des cibles** : ils repèrent les cas
aberrants sans normaliser les visages. Les relations passent par `relationChecks` dans les trois couches (`geometry`, `anatomy`, `style`).

## Catalogue (28 relations ; oreille et orbite des cheveux ×2 côtés)

| Composant | Relation | Famille | Sév. |
|---|---|---|---|
| nez ↔ yeux | base sous la ligne des yeux | géo | erreur |
| nez ↔ yeux | ailes / écart intercanthal ∈ [0,45 ; 1,9] (canon ≈ 1) | ana | avert. |
| nez ↔ bouche | pointe au-dessus de la lèvre supérieure | géo | erreur |
| nez ↔ visage | ailes ≤ 60 % de la demi-largeur à la base | ana | erreur |
| nez | narines dans la silhouette ; pointe sur l'axe | géo | erreur |
| bouche ↔ nez | lèvre sous la base du nez ; bouche ≤ 3,2 × nez | géo / ana | erreur / avert. |
| bouche ↔ menton | lèvre au-dessus du sillon mentolabial | géo | erreur |
| bouche ↔ visage | part nez→menton ∈ [0,12 ; 0,55] (canon ≈ 0,33) ; commissures ≤ 80 % du contour | ana | avert. / erreur |
| oreille ↔ arcade, yeux, nez | haut vers l'arcade ; haut sous la ligne des yeux ; bas ≈ base du nez | ana | avert. |
| oreille ↔ crâne | posée à l'extérieur du contour | géo | erreur |
| mâchoire ↔ nez, bouche | angle sous la base du nez (erreur) ; ≤ 0,15 H au-dessus de la bouche | ana | erreur / avert. |
| mâchoire ↔ visage, menton, cou | angle sur le contour ; menton plus étroit ; cou plus étroit | géo / ana | erreur / avert. |
| cheveux ↔ front | ligne capillaire au-dessus de l'arcade et dans le crâne ; tempe au-dessus des yeux | ana / géo | erreur |
| cheveux ↔ front | front visible ≥ 0,04 H | ana | avert. |
| cheveux ↔ orbite | ligne capillaire au-dessus de l'orbite publiée | visuelle | erreur |

## Ce que la mesure a trouvé (200 visages, 4 nov. 2026)

1. **Défaut réel trouvé, NON corrigé** : la graine 15 a l'angle de la mâchoire **13 px au-dessus de la base du nez** (mâchoire courte, haute) ; sur 200 visages c'est le cas de **12 visages (6 %), pire 27 px au-dessus de la base du nez**. `jaw.gonion-below-nose-base`
   est donc un **avertissement**. J'ai essayé une borne dans le résolveur de `face/landmarks.ts` (`jaw-below-nose`, appliquée avant le contour) ; elle corrigeait la graine 15
   mais déplaçait la graine 52442 du balayage `hair-v2` dans un défaut déjà connu du moteur de cheveux (oreille annoncée dégagée couverte à 0,124 pour une limite de 0,12 ; même classe que le
   cas permanent `hard-18`). Un balayage de graines cassé ne se pousse pas, et corriger les cheveux sort du périmètre : **borne retirée**, dette documentée. À reprendre avec le moteur de cheveux.
2. **Dettes mesurées, pas corrigées** (avertissements ; bornes dans le test pour qu'elles ne dérivent pas) :

| Relation | Échecs | Constat |
|---|---|---|
| `mouth.lower-face-share.high` | 39 / 200 | bouche médiane à 0,445 du nez→menton (canon 0,33), jusqu'à 0,665 : philtrum long |
| `ear.top-below-eye-line` | 42 / 384 | haut de l'oreille jusqu'à 11 px sous la ligne des yeux |
| `nose.alar-vs-intercanthal.narrow` | 9 / 200 | ailes jusqu'à 0,36 × l'écart intercanthal |
| `mouth.vs-nose-width` | 3 / 200 | bouche jusqu'à 3,7 × le nez |
| `jaw.gonion-below-nose-base` | 12 / 200 | angle jusqu'à 27 px au-dessus de la base du nez (voir ci-dessus) |
| `jaw.gonion-vs-mouth-line` | 7 / 200 | angle médian 0,058 H au-dessus de la bouche (canon : niveau des lèvres), jusqu'à 0,176 H |

La médiane de `mouth.lower-face-share` est un choix de style de la zone nez→lèvre, pas une erreur ; je ne l'ai pas « corrigée » pour faire passer la mesure.

## Contrôles négatifs

Chaque relation d'erreur testée est **déclenchée** par un défaut fabriqué (ligne capillaire sous l'arcade, lèvre au-dessus du nez, gonion trop haut, etc.) :
une relation qui ne peut jamais échouer ne prouve rien.

## Reste à faire

- Relations **visuelles** : seule `hair.hairline-clear-of-orbit` existe. Manquent : ombre du nez sur la joue, recouvrement oreille/cheveux, lèvre/dents.
- Relations **sous pose 3/4** : toutes sont mesurées de face (la pose n'est pas branchée, voir `PIPELINE-WIRING-REMAINING.md`).
- Nez : relations aux joues et au sillon nasogénien non mesurées ; oreille : lobule ↔ mâchoire non mesuré.
- Matériau et texture n'ont toujours pas l'identifiant canonique (`ANATOMY-CONTRACT.md` §5).
