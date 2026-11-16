# Nez : archétypes branchés dans le générateur aléatoire (2e passe du 15 nov. 2026)

Suite de `NOSE-ASPECT-CEILING.md`. Restes : `NOSE-REFS-REMAINING.md`.

## Question posée
Le générateur aléatoire tourne en moteur `classic`, où le plancher de zone (longueur minimale du nez) ne s'applique pas. Un archétype ajusté en `structured` y donne-t-il la même silhouette ?

## Étude (avant tout branchement)
Script : `scripts/nose-refs/archetype-engines.ts`. Sortie : `references/nez/archetype-engines.json`.

1. **Visage neutre**, résidu de silhouette contre `references/nez/06.png`, mêmes constantes, deux moteurs : identique (pyramide 0,0708, cloche-ailes 0,0992, plat-trapèze 0,1341, dans `classic` et `structured`).
2. **40 visages aléatoires** à graine fixe, archétype imposé : l'écart de L/H entre les deux moteurs reste < 0,002.

Explication : les longueurs des archétypes (≥ 0,17) sont déjà au-dessus du plancher, qui n'intervient donc jamais. La crainte du document précédent est levée **pour ces trois archétypes** ; elle reste ouverte pour un archétype futur plus court.

Effet sur la dispersion : avec l'archétype, le L/H des visages aléatoires se resserre autour de la référence (pyramide 0,73, cloche-ailes 0,98, plat-trapèze 1,23 : 1,12 à 1,40 sur 40 visages), contre 0,26 à 1,08 pour le nez tiré librement.

## Branchement
`generateRandomFace(seed, { noseArchetype })` dans `src/generation/random-face.ts` :
- `'pyramide'`, `'cloche-ailes'` ou `'plat-trapeze'` : pose l'archétype AU-DESSUS des tirages du nez ; `'random'` en choisit un dans un flux **dérivé** (`seed ^ 0x6e6f7365`) qui ne déplace aucun autre tirage ;
- **opt-in** : sans l'option, le visage est identique graine pour graine (testé) ;
- avec l'option, **seul le nez change** (tous les autres axes identiques, testé) ;
- un `anatomy.nose` explicite garde le dernier mot (testé).

Tests : `tests/nose-archetype-wiring.test.ts` (6).

## Preuve visuelle
`artefacts/nez-archetypes-generateur/01-tetes-colonnes.png` : 4 graines × (nez tiré / pyramide / cloche-ailes / plat-trapèze), têtes complètes. La pyramide change nettement le nez ; cloche-ailes et plat-trapèze sont plus subtils de face (le plat-trapèze élargit surtout les ailes) (comme `NOSE-ASPECT-CEILING.md` le disait).

## Vérification du rendu (24 graines, `verifyFace`)
`artefacts/nez-archetypes-generateur/verify-24-graines.json` : 0 erreur en tirage libre, cloche-ailes et plat-trapèze ; **1 erreur sur 24 en pyramide** (règle de cheveux `round-dome-centered`). Avec les archétypes v2 c'était la cloche-ailes (graine 174218, 0,0502 pour 0,05) : le nez ne change `lop` que par la hauteur d'oreille → mèches → rentrage de la sous-couche, ce qui explique que la victime change avec les paramètres (`NOSE-DOME-COUPLING.md`). Aucun seuil relâché.

## Non fait
- Activation par défaut.
- Correction du couplage nez → dôme capillaire (expliqué, pas corrigé).
- Archétypes ellipse large et losange (hors de portée du modèle : `NOSE-ASPECT-CEILING.md`, `NOSE-PLATE06-GLOBAL.md`).
