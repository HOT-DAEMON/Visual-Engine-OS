# Voûte crânienne — renforcement du moteur de crâne

Réponse à `TODO-SKULL-RENFORCEMENT-VOUTE-CRANIENNE.md`. Le crâne n'est plus une ellipse dont on règle largeur et hauteur : c'est une **combinaison de mesures indépendantes**, chacune portée par une structure anatomique du registre, consommée par la géométrie 3D et **prouvée par une différence de pixels** (validation : `SKULL-VAULT-VALIDATION.md` ; reste à faire : `SKULL-VAULT-REMAINING.md`).

## Principe : on enrichit le moteur existant, on n'en crée pas un second
Les coupes de la tête (`rows.ts` → `skull-model.ts`) et le relief (`skull-relief.ts`, `head-relief.ts`) restent LA chaîne. La voûte s'y branche :

| Module | Rôle |
|---|---|
| `src/skull/vault-params.ts` | 22 mesures signées [−1, 1], **0 = nominal** (tête identique à l'ancienne), fusionnées dans `SkullParams` |
| `engines/vault-model.ts` | modifie les rangées existantes (a, zf, zb, pf, qf, pb, qb) et la hauteur du sommet |
| `engines/vault-relief.ts` | relief osseux ancré sur les repères réels (`SkullGeo.bone.lm`), filtré par les tissus |
| `engines/skull-relief.ts` | bosses pariétales (gain `parietalBulge`) et asymétries (part du visage + part propre) |
| `engines/skull-of.ts` | paramètres validés une fois par tête, **après** contraintes strictes (3× plus rapide qu'avant) |
| `src/skull/vault-tissue.ts`, `vault-curves.ts` | couches de tissus (mm), transmission, sutures et lignes (données) |
| `src/skull/vault-registry*.ts` | registre anatomique (structures, voisins, ancrages, paramètres, influence) |
| `src/skull/vault-constraints.ts`, `vault-correlations.ts` | contraintes strictes / préférences ; corrélations facultatives |
| `head-turntable/vault-visibility.ts` | position locale/globale, visibilité caméra, occlusion (lues sur le rendu) |
| `head-turntable/vault-lab.ts`, `vault-proof.ts`, `verify-vault.ts` | banc d'essai, cas de preuve, vérification géométrie / anatomie / style |

## Mesures et ce qu'elles pilotent
Poids gaussiens en hauteur `y` (U ; 0 = sommet, ≈ 0,45 = yeux). Constantes : `VAULT_MODEL`, `VAULT_RELIEF`.

| Structure | Paramètre | Champ(s) | Effet |
|---|---|---|---|
| Os frontal | `foreheadSlope`, `frontalBulge` (existants) | profil → zf | fuyant / vertical ; bombé |
| | `frontalFlat` | pf | plan frontal plat ↔ bombé |
| | `frontalBreadth` | qf | front large ↔ étroit **sans** changer la largeur max `a` |
| Pariétaux | `parietalBulge` | gain des bosses ×(1 + 0,9 p) | éminences effacées ↔ doublées |
| | `parietalFlat` | a, zf, zb près du sommet | sommet plat ↔ dôme pointu |
| | `parietalConvexity` | qf, qb, a | plans latéraux plans ↔ convexes |
| Largeur | `cranialBreadth` | a (0 au sommet, 0 avant la pommette) | ±12 % de la demi-largeur, **le visage ne bouge pas** |
| Temporaux | `temporalFlat`, `templeBreadth` | qf/qb ; a (y ≈ 0,42) | plan temporal plat ; largeur aux tempes |
| | `temporalHollow` | relief (fosse temporale) | creusé ↔ comblé |
| Ptérion | `planeTransition` | pf, qf, qb | transition frontal / temporal / pariétal anguleuse ↔ fondue |
| Occipital | `occipitalFlat`, `occipitalSlope` | pb, qb ; zb | arrondi ↔ plat ; partie basse fuyante ↔ en surplomb |
| | `occiput`, `inion` (existants) | profil ; relief nuque | projection ; protubérance externe |
| Mastoïde | `mastoid` | relief | effacée ↔ saillante |
| Glabelle | `glabella` | relief médian | lisse ↔ proéminente |
| Ligne nuchale | `nuchalLine` | relief | absente ↔ marquée |
| Sommet | `vaultHeight` | **hauteur réelle** (voir ci-dessous) | voûte basse ↔ haute |
| Sutures, lignes | `suturesShow` ∈ [0, 1] | relief fin | masquées (défaut) ↔ visibles |
| Tissus | `scalp`, `boneShow` | transmission τ | l'os transparaît plus ou moins |
| Asymétrie | `asymParietal`, `asymOccipital`, `asymFrontal`, `asymWidth` | relief | **propres**, sans le visage |
| | `asymFaceCoupling` ∈ [0, 1] | — | part de l'asymétrie du visage reportée (1 = comportement d'origine) |

### `vaultHeight` : une vraie dimension
Le sommet monte ou descend de `0,16 U × (vaultHeight − référence)` ; la référence est la valeur **dérivée du visage** (`axes.vaultHeight.derived`), donc les têtes existantes ne bougent que de leur variation libre. La calotte est étirée par un remappage vertical monotone, C¹ au raccord (`warpY` / `unwarpY`, testés) ; yeux, nez, bouche, menton et oreille ne bougent pas. Mesuré : le sommet monte de plus de 0,06 U de 0 à 1 (10–12 % de silhouette).

### Tissus ≠ os
Chaque région a une pile de couches (peau, sous-cutané, galéa, périoste, muscle temporal aux tempes, os) et une transmission `τ = (1,35 − 0,7·scalp·r)(1 + 0,6·boneShow)`, qui vaut **1** au calibrage d'origine. `scalp` et `boneShow` ne produisent donc un effet qu'avec des reliefs osseux actifs (ils se prouvent en combinaison).

### Contraintes et corrélations
- **Strictes** (`assessVault`) : appliquées par `Resolver`, journalisées, **levées par `fit.caricature`**. Ex. creux temporal profond + tempes très étroites.
- **Préférences** : mesurées (`plausibility`), jamais corrigées : une combinaison rare n'est pas interdite.
- **Corrélations** (`drawVault`) : tendances `ρ < 1`, facultatives, **0 par défaut** ; le tirage garde le même ordre quelle que soit la tendance.

### Structures et données
Les 15 structures sont des composants canoniques (`anatomy/components.ts`, enfants de `cranium`). Chacune déclare ses 6 voisins (réciprocité garantie et testée), son ancrage, ses paramètres, son influence et ses vues. Sutures et lignes sont des **données** (`vaultCurves`), invisibles par défaut ; tous les os et régions sont visibles par défaut. Toutes les structures visibles appartiennent au **même maillage continu** (relief radial sur la superellipse) : aucune couture. Matériau : hérité de `cranium` (peau), spécialisé pour la glabelle (peau mince) et les sutures (relief fin).

## Régénérer
```
npx tsx scripts/head-turntable/artefacts-vault.ts /tmp/vault 300
python3 scripts/head-turntable/compose-vault.py /tmp/vault artefacts/skull-vault
```
