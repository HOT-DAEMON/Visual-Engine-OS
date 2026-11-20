# Moteur capillaire — passe 2 : bilan et reste à faire par composant

Preuves : `artefacts/hair-engine-pass2/` (régénérées par `npx tsx scripts/hair-grammar/artefacts-pass2.ts`, déterministe) — 5 planches + `metrics.json`.
Détails : `HAIR-GEOM-BRIDGE.md` · `HAIR-WEAVE.md` · `HAIR-FACE-INTENT.md`. Audit ligne par ligne : `TODO-RENFORCEMENT-HAIR-STATUS.md`.

## Fait dans cette passe (constats n° 1, 2 (en partie), 3, 5 de l'audit)
| Chantier | Résultat | Tests |
|---|---|---|
| A. Une seule apparence | `HairLock.geom` lu par `celBands`/`lockMarkup`/`hairGloss`, contrat vérifié | 14 |
| B. Entrelacs | `weaveStrands`, segment `weave`, résolveur corrigé (appariement, coupes adaptatives) | 13 |
| C. Anatomie du visage + intention | `anat.face`, visibilité, réparation multi-coupables, `generateIntended` | 13 |
| D. Vues −75°…+75° | balayage réparé, aucun œil/nez recouvert | inclus en C |

## Reste à faire — par composant
### Observation et ajustement (TODO §A)
- Segmentation par mèche des rasters de référence (7 grandeurs du TODO non mesurées) : NON fait.
- `observe` → `autofit` non branché ; `generateIntended` non plus.
### Forme et flux (TODO §C)
- Ramification : séparation (`splitLock`), jonction (`joinLocks`), boucles/enroulements : NON faits (seul le croisement par tronçons existe).
### Composition et occlusion (TODO §D)
- Profondeur de VOLUME (épaisseur de mèche) pour fiabiliser le mode `all` : NON fait ; l'ordre résolu reste imposé seulement par `emerge` et `weave`.
- Réapparition de la sous-couche à travers un trou ; ombre douce/ambiante : NON faits.
### Apparence (TODO §4.3, §E)
- Lumière 3D partagée : le principal garde un `ld` 2D ; `geom` ne porte que du non-lumineux.
- Mèches `part`/`sim` du principal sans `geom`.
- Filtres SVG du principal non traités.
### Art direction (TODO §F)
- Manquent : raie, frange, reflets comme axes mesurables, « pointes libres » au-delà du retroussé.
### Vérification de rendu (géométrie · anatomie · style)
- Visibilité fondée sur `facing` seul (pas de lancer de rayon contre les mèches voisines).
- Style : garde-fou à seuils, pas de jugement esthétique.
- Tests historiques en vues quasi frontales (`viewAt(0.3/0.5)`, yaw en degrés).
- « Volume +1, lourd » garde score 20 (7 `geom.self`, 8 `anat.eye`) ; résidus à 30° / 60° / −75° = `geom.self` seulement.

## Discipline
Chaque fichier de `docs/` reste ≤ 200 lignes ; au-delà, un `-REMAINING` ou une suite est créé.
