# Reste à faire — tête + corps dans le pipeline principal (état au 5 nov. 2026)

> Suite de `PIPELINE-WIRING.md` et `ANATOMY-CONTRACT.md`. Une ligne = un manque réel, avec sa preuve ou sa raison.

## Branchement au pipeline principal

| Élément | État | Reste à faire |
|---|---|---|
| visage de face (crâne, face, nez, bouche, mâchoire, menton, oreilles, cou) | branché (`host shape: 'face'`) | — |
| yeux | branchés (`place` sur les ancres de l'hôte) | — |
| cheveux v2 (`face/hair`) | branchés | — |
| cheveux `hair-grammar` | **non branchés** — et pas branchables avant la pose 3/4 (rubans définis en vue 3/4) | `PIPELINE-WIRING-REMAINING.md` |
| crâne de profil (`src/skull`) | **branché** (`kind: 'head_profile'`, crâne dérivé du visage) | trous listés dans `PIPELINE-PROFILE.md` |
| tête + cou tournants (`head-turntable`) | **branchée** (`head_3d`, lacet / tangage libres) ; yeux de l'hôte, cou (SCM / platysma / clavicule) et roulis faits ; reste : volume des cheveux, sourcils (`PIPELINE-HEAD-3D-REMAINING.md`) | `PIPELINE-HEAD-3D.md` |
| pose 3/4 (`face/pose`) | **non branchée** (géométrie pure ; exige de reprojeter chaque composant) | `PIPELINE-WIRING-REMAINING.md` |
| corps : torse + bras | branché (`kind: 'body'`) | — |
| corps : bassin + jambes (`src/body/lower`) | **branchés** (`legs` de `kind: 'body'`, défaut `false` = buste) | `PIPELINE-LOWER.md` |
| `relief` (relief de la tête) | **branché** (`kind: 'head_lit'`, calque `top`) ; coût ~13× le visage à `ppu` 2,4 | `PIPELINE-RELIEF.md` |

## Contrat central (Problème 1)

- Orbite : **corrigée** (`ORBIT-PUBLISH.md`). L'œil publie son orbite, les ombres la consomment ; 4 références de régression réécrites.
- Le graphe de contact n'a pas de composant « paupière » ni « arcade » : la relation visuelle œil/paupière n'a donc pas de composant canonique propre.
- Matériau, texture, ombre : ils n'utilisent pas encore l'identifiant canonique (`ANATOMY-CONTRACT.md` §5).

## Relations (Problème 3)

- Couvert : œil (`relations.ts`) ; nez, bouche, oreille, mâchoire, cheveux (`face-relations.ts`, 28 relations, planche `artefacts/face-relations/`). Voir `FACE-RELATIONS.md`.
- Manque : relations visuelles (ombre du nez sur la joue, oreille/cheveux, lèvre/dents) et toutes les mesures sous pose 3/4.
- Le visuel de la paupière est mesuré par recouvrement de l'iris ; il manque la courbure de la paupière contre le globe (aucune mesure fiable à ce jour).

## Compilateur (Problème 2)

- `faceParts` ordonne les couches à la main : c'est le vrai point de congestion. Seuil de réouverture : plus de ~15 couches, ou composants externes.

## Qualité visuelle constatée sur les planches

- Planche 01 : le torse était coupé en bas (corrigé : `legs`) ; l'enfant de 8 ans a les mêmes proportions de bras que l'adulte à l'œil, à vérifier contre `BODY-CANON.md`.
- Planche 02 : le tracé réel du cou commence au niveau du nez (haut caché derrière la tête) ; sans conséquence visuelle, mais le graphe de contact `neck` a le même rectangle.
