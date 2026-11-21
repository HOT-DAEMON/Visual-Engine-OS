# Moteur capillaire — passe 3 : ce qui a été fait, avec les mesures

Preuves : `artefacts/hair-engine-pass3/` (8 planches + `metrics.json`, déterministes : `npx tsx scripts/hair-grammar/artefacts-pass3.ts`).
Reste à faire par composant : `HAIR-PASS3-REMAINING.md`. Audit ligne par ligne : `TODO-RENFORCEMENT-HAIR-STATUS.md`.
Convention : `View.yaw` est en DEGRÉS ; `viewAt` refuse 0 < |yaw| < 1 (garde contre les anciens tests en radians).

Avant chaque chantier, le code existant a été relu pour ne rien refaire : `emergeFrom`, `weave`, `repairCycle`, `relationsOf`, `observe`, `autofit`,
`HairLock.geom` existaient et ont été RÉUTILISÉS ; seuls les manques ont été écrits.

## 1. « Volume +1, lourd » : score 20 → 0 (reste n° 7 de la passe 2)
Cause mesurée : la coque tête→cou n'était pas C¹ (arête à la jonction mâchoire/cou) → plis de lame, `geom.self` et mèches posées sur l'œil.
- `shell.ts` : jonction mâchoire→cou en Hermite C¹, `offsetNormal` lissée, `effectiveLift` (critères de vitesse et d'alignement). Test : `hair-engine-shell`.
- `repair-local.ts` : résolveur LOCAL (une mèche fautive, ses filles re-résolues par `refreshChildren`) avant la boucle globale de `repair.ts`.
- `lock-check.ts` : `allowedCrossings(L)` — un croisement d'axe n'est un défaut que s'il n'est pas voulu par le programme (boucle).
- Résultat (7 lacets −75…75°, volume +1 lourd) : avant 8 à 28, APRÈS 0 PARTOUT, dont 30°, 60°, −75° (planche 01). Plis 3D bruts : 0 / 600 mèches.

## 2. Ramification (`branch.ts`) — reste de la passe 2
Bâti sur `emergeFrom` (déjà là) + un segment de courbe `loop` (`curve-program.ts`) ; rien n'est recopié.
| Opération | Garantie vérifiée | Mesure |
|---|---|---|
| `splitLock` (2–3 branches) | racine de chaque branche DANS la lame du tronc, écart ≤ 0,01 H, angle ≤ 12°, aire conservée | 2 et 3 branches |
| `fray` (pointes libres) | fines mèches, échelonnées sur la fin, continues | 4 |
| `joinLocks` | pointe de la fille sur la cible (`geom.join`, réparé par re-résolution) | écart 5·10⁻⁵ H |
| `loopLock` | un tour : exactement les croisements permis (`allowedCrossings`), cap net nul | longueur 0,975 |
| `branchHair` | déterministe, ids uniques, mères présentes, 0 défaut `geom.emerge`/`geom.join` | tests |
Tests : `hair-engine-branch` (14). Planche 02.

## 3. Visibilité réelle et étagement (`visibility.ts`)
La passe 2 jugeait la visibilité par `facing` seul. Maintenant : ordre de peinture réel (arrière → tête → devant → dessus), tête = enveloppe convexe de la coque projetée.
- `visible` (part d'aire), `spineVisible`, `buried` (< 3 %), `misLayered` (mèche peinte devant le visage alors que ≥ 50 % de son axe est derrière le crâne).
- Nouveau défaut `geom.layer` + réparation. Option `verifyComposed(..., {visibility:true})`.
- Mesures (yaw 29°, 50 mèches) : 28 % de visibilité moyenne (coiffure dense = beaucoup de recouvrement), 2/32 mèches de devant enfouies, mal étagées 1 → 0.
- Coiffures générées : ≤ 1 mèche mal étagée sur 16 cas. Tests : `hair-engine-visibility`. Planche 03.

## 4. Profondeur de VOLUME pour le mode `all` (`blade.ts`, `occlusion.ts`)
Chaque lame a une épaisseur (`RIBBON_K = 0,3` × largeur) ; deux dalles qui se pénètrent n'imposent plus d'ordre.
- Découpes −65 à −75 %, croisements imposés −74 à −83 % (4 cas, planche 04).
- STABILITÉ : à 3° les taux d'inversion sont égaux ; à 8° le total est plus bas, mais PAS cas par cas (base 29° : 0,11 → 0,17 ; lourd 0° : 0,01 → 0,10). Le gain est réel en agrégat, pas garanti. Voir REMAINING.
- Mode `weave` inchangé (test). Outil : `occlusion-stability.ts`.

## 5. Lumière commune (`light-bridge.ts`)
Un seul `LightVector` hôte ↔ lumière en repère tête ; `LockGeom.exposure` (ajouté à `HairLockGeom`, copié par `interop.ts`) lu par `celBands` (`hair-cel.ts`) et par le reflet (`lit(i)`).
- Mesure : exposition moyenne 0,80 (azimut 300°) → 0,63 (180°) : le sens de la lumière change bien l'image. Aller-retour exact (tests `hair-engine-light`). Planche 05.
- Limite : le principal garde son `ld` 2D pour le reste (ombres de contact, filtres).

## 6. Observation → ajustement en boucle fermée
- `observe-structure.ts` : tenseur de structure → régions de flux (k-means), hiérarchie, asymétrie, frange, raie, reflet.
- `reference-fit.ts` : `referenceFromPainted`, `fitFromReference` (ajuste `Intent` en comparant l'observation du rendu à celle de la référence, historique `FitStep`).
- Mesure (planche 06) : erreurs de largeur et d'espace négatif décroissent sur les premières itérations (largeur 0,08 → 0,05 ; 0,01 → 0 sur le cas 1, puis remontent à 0,01 à l'itération 4 : pas de convergence monotone). MAIS les paramètres ne sont pas identifiables de façon unique : vérité `weight −0,5` → ajusté `+0,21`. L'ajustement reproduit l'IMAGE, pas forcément l'intention. Tests : `hair-engine-reference` (14).

## 7. Axes d'art direction : frange, pointes, raie (`intent.ts`, `part.ts`)
- `Intent.fringe` (nombre/longueur des mèches de frange), `Intent.tips` (pointes libres via `fray`), `Intent.part` (raie −1…1, `applyPart`).
- `measureArt` → `ArtMeasure` : frange mesurée 0,46 → 0,77 → 0,96 (frange −1/0/+1) ; raie mesurée à −0,55 / 0,06 / +0,55 pour −0,4 / 0 / +0,4 ; pointes 0 → 0,68 → 2,24.
- `generateIntended` applique raie puis `branchHair` avant vérification/réparation. Tests : `hair-engine-art` (10). Planche 07.

## 8. Toute la tête (planche 08) et couche de vérification
Intention combinée (volume 0,6 ; frange 0,5 ; raie −0,3 ; pointes 0,5 ; poids 0,3 ; 113 mèches), 5 lacets : score avant 2–10, après 0 sauf 30° (2).
Échecs restants : style « variété des largeurs » (CV 0,94 > 0,9, tous lacets) et, à 30°, anatomie « calotte couverte » 63 % < 70 %. Ils sont REPORTÉS, pas masqués : voir REMAINING.
Les trois couches de `verifyComposed` (géométrie : `geom.self/emerge/join/layer` ; anatomie : `anat.eye/face/dome` ; style : largeur, équilibre, négatifs) sont intactes et enrichies.

## 9. Tests et typage
Nouveaux : shell, repair-local, branch, visibility, light, reference, art. Modifiés : compose, face-intent (radians → vue brute), geom-bridge, intent, interop.
État final : `npx tsc --noEmit` sans erreur ; suite `tests/hair*` + `face-pose-hair*` + `head-hair-bridge` : 47 fichiers, 1042 tests verts (≈ 9 min, à lancer en tâche de fond).
