# Nez : matériau propre (2e passe du 15 nov. 2026)

Restes : `NOSE-REFS-REMAINING.md`.

## Contrat
`skinMaterial.noseDetail` (`src/schema/skin-material.ts`), sous-contrat du matériau de peau existant : **aucun moteur de plus**, mêmes couches (`src/skin/shading.ts`), même lumière, même teinte d'ombre partagée avec le reste de la peau. Chaque axe vaut 0 par défaut : rendu inchangé (testé : SVG identique ; suite complète 3 222 tests verts).

| Axe | Effet | Implémentation |
|---|---|---|
| `tipShine` | reflet concentré de la pointe | tache dans `regions.noseTip`, loi des reflets de région (rugosité du nez, graisse de la zone T, intensité, réflexion) |
| `alarBlush` | rougeur de transparence des ailes | tache décalée vers l'extérieur de chaque aile, teinte = ombre de la peau mêlée de `#c25048` (40 %) |

Les sous-régions viennent de `skinRegions` (`src/face/regions.ts`, champs optionnels `noseTip`, `noseAlae`).

## Mesures sur pixels (gros plan ×2,6, peau seule, 3 graines)
`tests/nose-material.test.ts` (7 tests), aide `tests/helpers-nose-material.ts`.
- `tipShine` : luminance de la pointe monotone (0, 0,5, 1), écart-type +7 (graine 11) ; reste d'un reflet de peau (< 15 %) ; ailes inchangées (< 1,5 niveau) ; aucun pixel modifié hors du nez.
- `alarBlush` : R−G des deux ailes monotone ; débordement sur la pointe ≤ 0,54 niveau ; 1,6 à 3,2 % des pixels modifiés dépassent la boîte des ailes (bord doux) ; ton des ailes à moins de 10 % de la luminance de base.

## Preuves
`artefacts/nez-materiau/01-gros-plan-axes.png` (un axe par ligne, 0 / 0,5 / 1) et `02-tetes-eteint-allume.png` (3 têtes complètes).
**Honnêteté** : sur têtes complètes l'effet est **très discret** (petit reflet de pointe, teinte légère) ; il n'est lisible qu'en gros plan.

## Essayé et RETIRÉ : pores du nez
Deux versions, aucune lisible. (1) Filtre de bruit dédié : dans la scène complète le rendu était vide (0 à 2 pixels changés) alors que le même filtre isolé en changeait 14 456 ; cause non trouvée (région de filtre, tuile, ordre testés). (2) Points explicites déterministes : 362 pixels changés, écart-type de la pointe +0,1. Axe supprimé plutôt que livré sans preuve.

## Non fait
- Ce sont des **choix artistiques**, pas des mesures : les planches `references/nez` sont des dessins gris.
- Pas de variation aléatoire de `noseDetail` dans le générateur (aucune graine ne bouge).
- Non branché sur la vue de dessous ni sur `head_3d`.
- Cohérence de teinte nez / joues / membres : seulement par construction (même ombre partagée) ; non mesurée sur le rendu.
- **Plantage resvg préexistant** : graines 405 et 5, gros plan du nez chauffe `geom.rs:27` (`unwrap` sur `None`), vérifié **avant** ces modifications ; non investigué.
