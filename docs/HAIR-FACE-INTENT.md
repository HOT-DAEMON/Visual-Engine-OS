# Moteur capillaire — anatomie du visage, vues obliques, intention vérifiée

Code : `compose-verify.ts` (`anat.face`, visibilité) · `head.ts` (`facing`) · `repair.ts` (`aroundView`, `moveRoot`) · `intent-run.ts` (`generateIntended`)
Tests : `tests/hair-engine-face-intent.test.ts` (13) · preuves : `artefacts/hair-engine-pass2/03-vues-75-75-reparees.png`, `04-anat-face.png`, `05-intentions-verifiees.png`, `metrics.json`.

## 1. `anat.face` : nez et bouche
Avant : `anat.eye` seul (yeux). Une mèche tombant sur le nez ou la bouche n'était pas un défaut.
- `verifyComposed` détecte une mèche (non `back`) qui recouvre la pointe du nez ou la bouche, un défaut `anat.face` PAR mèche fautive, nommée ; le rapport d'anatomie ajoute le contrôle « nez / bouche recouverts ».
- Pas de faux positif : les coiffures de la grammaire (6 graines × 5 vues, −60°…+60°) n'en produisent pas.
- Réparation (`repair.ts`) : rotation du cap ±0,4, rotation autour de l'axe de vue ±0,5, déplacement de racine ±15, raccourcissement ×0,6, aplatissement du décollement ÷2 ; gardée seulement si le score BAISSE strictement. Artefact 04 : 4 défauts → 0, score 13 → 2.

## 2. Découverte : le yaw est en DEGRÉS
`View.yaw`/`pitch` sont en degrés (`head.ts` : `rad(v.yaw)`). Mes premières sondes en radians étaient quasi de face. Mesuré : yaw 30 déplace nettement le nez, 0,3 à peine (test dédié). Les tests existants `viewAt(0.3/0.5)` restent donc quasi frontaux (non modifiés, listé plus bas).

## 3. Vérification par vue : seuls les repères VISIBLES comptent
- `facing(head, view, p)` = cosinus entre la normale du crâne et le rayon caméra. Seuil `SEEN = 0,2`.
- De face : les deux yeux sont vus ; à 70° un seul (l'autre est derrière la tête, une mèche dessus n'est pas un défaut).
- Sans ce filtre, de faux `anat.eye` apparaissaient aux grands lacets (œil lointain, repères cachés).

## 4. Réparation à plusieurs coupables
À ±75°, `anat.eye` restait irréparable : seule la dernière mèche couvrante était reportée, le score ne baissait jamais strictement. Correction : un défaut PAR mèche couvrante + deux nouvelles corrections (axe de vue, racine). Test : deux mèches sur le visage → UN défaut chacune, toutes écartées.
Balayage de −75° à +75° (artefact 03, métriques) : aucun œil/nez recouvert après réparation ; défauts totaux : −75° 2,5→0,25 · 30° 4→1 · 60° 8→0,75 · autres → 0.

## 5. `generateIntended(P, I, view, seed, repair=true)`
`applyIntent` → `generate` → `verifyComposed` → `repairCycle` ; renvoie `{profile, specs, initial, verdict, journal}`. Garanties testées : score final ≤ score initial (5 intentions × 3 graines × 2 vues), `repair=false` ⇒ journal vide, déterministe.
Artefact 05 (vue 25°) : « volume +1, lourd » 28→20 · « vent 1 vers +0,6 rad » 5,25→3 · « plaqué lisse » 4→0.

## Reste à faire (non fait)
1. « Volume +1, lourd » (vue 25°, graine 2) garde 20 de score : 7 `geom.self` + 8 `anat.eye` (12 `anat.eye` au départ). Les corrections locales ne suffisent pas ; il faut une réparation de masse (réduire volume/densité à la source). Cause exacte non analysée mèche par mèche.
2. Résidus mesurés (graine 1) : 30° → 1 `geom.self`, 60° → 3 `geom.self` (0,75), −75° → 1 `geom.self` : auto-intersections de lame que aucune correction du cycle n'a fait baisser strictement.
3. `geom.self` reste le défaut de base le plus fréquent ; réparé par le cycle, pas évité à la génération.
4. Les tests existants (`viewAt(0.3/0.5)`) devraient passer en degrés réalistes (15–45°) : non fait pour ne pas modifier des fichiers hors périmètre.
5. Le verdict de style est un garde-fou à seuils ; aucun jugement esthétique n'est automatisé.
6. `generateIntended` n'est pas branché sur `autofit` / `iso-verify` (voir `HAIR-PASS2-REMAINING.md`).
