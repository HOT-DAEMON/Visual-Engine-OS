# Preuves visuelles — cheveux v2

Régénérées par `npx tsx scripts/artefacts-hair-v2.ts`. Même visage de base (seed 321, yeux d'identité 3, sans pilosité) : seules les propriétés testées changent.

| Image | Preuve |
|---|---|
| `01-formes-mechesS-cones-volutes.png` | grandes mèches en S flottantes, cônes rigides, volutes libres, mélange |
| `02-franges-sheer-blades-wispy-asym.png` | franges : fils individuels (peau visible), mèches triangulaires avec jour, fines étagées, asymétrique jusqu'au sourcil |
| `03-cotes-asymetriques-oreilles.png` | oreille gauche cachée / droite dégagée, rangée, mèches de joue (zones d'oreille tracées : rouge = cachée, vert = dégagée, jaune = rangée) |
| `04-ombrage-cel-vs-lisse.png` | lisse, cel 2 tons, cel 3 tons + bande de reflet blanche + ombre portée teintée |
| `05-couleurs-vives-degrades.png` | 8 familles vives, dégradés racine → pointe à 2 et 3 couleurs, pointes translucides |
| `06-volume-gonfle-silhouettes.png` | volume gonflé raide / ondulé, silhouettes fortement asymétriques |
| `07-racines-etages-textures-melangees.png` | racines relevées (retombée variable), étages et sous-couches visibles, textures mélangées, masses + poils fins |
| `08-occlusions-devant-le-visage.png` | occlusions 0,25 → 1 de l'œil, sourcils, nez, bouche ; recouvrement demandé → mesuré annoté |
| `09-moteur-apparence-teintes-effets.png` | ombre/lumière/contour imposés, glow + bloom, texture + réfraction, dégradé à 4 couleurs + émission |
| `10-galerie-aleatoire-v2.png` | 48 visages aléatoires v2 |
| `metrics.json` | 300 seeds : 300/300 passent les 3 couches de vérification, détail par contrôle, couverture des axes, palette v1 → v2 |
