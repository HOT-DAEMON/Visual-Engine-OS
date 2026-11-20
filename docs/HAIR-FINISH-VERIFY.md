# Moteur capillaire — finition par géométrie locale, vérification en 3 couches, réparation (TODO §3.4, §4.3, §H)

Code : `local-geometry.ts`, `paint-pro.ts`, `compose-verify.ts`, `repair.ts` · tests : `tests/hair-engine-compose.test.ts` ·
preuves : `artefacts/hair-engine/07-finition.png`, `08-verification-reparation.png`.

## A. Interface « géométrie locale » (§4.3 : « fournie par la géométrie, pas inventée par le moteur d'apparence »)
`localGeometry(h, L, blade, view)` → `LockGeom`, en chaque échantillon : tangente, normale 2D, courbure signée, orientation, torsion, largeur, profondeur,
normale 3D du ruban (normale de coque tournée de la torsion autour de la tangente), exposition à la lumière (0–1), face visible (dessous ?), occlusion locale
(issue des relations de `occlusion.ts`, décroissance `exp(−d/0,05)`). Les huit grandeurs listées au TODO y sont toutes.

## B. Finition pilotée (`paintLockPro`, `paintHairPro`)
- REFLET : ruban collé au bord éclairé (normale·lumière), largeur ∝ exposition², étranglé par `|cos φ|` : un ruban torsadé a un reflet cassé, un ruban plat un reflet continu (preuve : 07, deux premières cellules ; test « torsion »).
- OMBRE PROPRE : côté opposé, plus large quand l'exposition baisse et près des recouvrements (opacité 0,3 — 0,45 donnait un rendu boueux).
- Pas d'ellipse globale (le défaut de `hairGloss()` cité au TODO) : chaque bande suit la courbe de SA mèche.
- Le calcul est géométrique (bandes SVG) : le troisième problème du TODO (dépendance aux filtres SVG) est évité ici, pas résolu pour le moteur principal.

## C. Vérification en trois couches (`verifyComposed`)
Chaque défaut est LOCALISÉ : `{code, layer, lock, family, severity, detail}` ; `score = Σ gravités`.
| Couche | Contrôles | Codes |
|---|---|---|
| Géométrie | points finis, lames dégénérées (< 5 % H), axes qui se coupent, continuité d'émergence | `geom.finite/degenerate/self/emerge` |
| Anatomie | centre d'un œil recouvert, calotte couverte ≥ 70 %, largeur cheveux/tête, hauteur du volume, équilibre G/D | `anat.eye/dome/balance` |
| Style | lisibilité de la lecture, hiérarchie, trous parasites, variété de largeurs, croisements | `style.coherence/hierarchy/speckle` |
Seuils = garde-fous calibrés sur TOUSLED, pas des preuves de ressemblance. `geom.self` d'une mèche de dessous (calque `back`) pèse 0,25.

## D. Cycle de réparation (`repairCycle`) — les six étapes du TODO §H
1 détecter (`verifyComposed`) → 2 identifier le composant (`defect.lock`/`family`) → 3 choisir la correction (table `FIXES` par code : raccourcir, redresser le cap, réduire la largeur, retirer…) →
4 reconstruire la géométrie (`paintLock`) → 5 revérifier → 6 garder SEULEMENT si le score baisse, sinon annuler ; journal complet (`before/after/kept`).
Mesuré (artefact 08, TOUSLED graine 1) : score 5 → 0 ; 5 corrections gardées, 6 annulées ; les 5 défauts étaient des `geom.self` de mèches de côté.
Test : le score ne monte jamais ; toute tentative gardée l'a fait baisser.

## Limites connues (à faire)
- Aucun contrôle « nez/bouche recouverts » : dans l'artefact 10 une grosse mèche de frange couvre le nez sans défaut `anat.*` (seuls les yeux sont testés).
- Les intentions « voluminous » et « heavy » produisent `anat.eye` et jusqu'à 13 défauts `geom.self` (artefact 09) : `repairCycle` n'est pas lancé automatiquement après `applyIntent`.
- `geom.self` sur les mèches à `program` est exempté (une boucle voulue n'est pas un défaut) : un programme erroné n'est donc pas détecté.
- `FIXES` ne sait pas réparer `style.*` ni `anat.balance` autrement que par retrait de mèche.
- Le moteur principal n'utilise pas `LockGeom` : voir `HAIR-INTEROP.md` (reste à faire : `hairGloss`/`lockMarkup` consomment l'interface).
- `autofit.ts`/`iso-verify.ts` ne sont pas reliés au cycle (ils réparent par synthèse sur référence ; ce cycle répare par défaut localisé).
