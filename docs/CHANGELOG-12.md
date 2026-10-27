# CHANGELOG-12 — systèmes d'yeux (feat/eyes-systems)

Base : `feat/skull-axes`. Un commit par étape, chacune avec ses tests. Détail : `EYES-SYSTEMS.md` ; reste à faire : `EYES-REMAINING.md` ; vitesse : `EYES-PERF.md`.

- feat(eyes) **pupilles** (EYE-05) : `star, diamond, polygon, cross, keyhole` ; `orientationDeg`, `center`, `edge` (netteté, liseré teinté), `response` (réponse lumineuse par
  modèle d'espèce), `multiple`, `deform` (harmoniques à graine). `geometry/eye/pupil-shape.ts`, `render/eye/pupil.ts`. Invariant testé : tout point dans l'iris.
- feat(eyes) **reflets** (OPT-01/04) : liste de ≤ 6 reflets, ancrage lumière/iris/globe, formes, rotation, flou, halo, confinement. `geometry/eye/highlights.ts`.
- feat(eyes) **couches de couleur d'iris** (EYE-04) : masques full/ring/sector/half/spot, gradients radial/angulaire, fusion émulée, halo, irrégularité à graine.
  Outil de planches `scripts/lib/eye-sheet.ts`.
- feat(eyes) **microdétails de la sclère** (EYE-07, humidité) : vaisseaux, chroma, film lacrymal + ménisque, occlusion, marques, LOD monotone.
- feat(eyes) **rotation 3D sphérique** de l'enveloppe, 12 types : `headTurn.model = 'sphere'`, `azimuthDeg`, `radiusFactor`, `parallax` (`geometry/eye/turn3d.ts`).
  Modifie `tests/head-turn.test.ts` (nouveaux défauts du schéma uniquement).
- feat(eyes) **moteur d'apparence branché** (`render/eye/look.ts`) : ombres/lumière/contour dérivés, teinte de reflet, effets sur l'iris, étalonnage.
- feat(verify) **`verifyEye`** : 3 couches (géométrie, anatomie, style), erreurs vs avertissements ; les 12 enveloppes passent sans erreur.
- perf(eyes) **ombres sans filtre** (`render/eye/soft-shadow.ts`) : rastérisation d'un œil 498,6 → 171,1 ms (× 2,9 ; × 6,1 hors plancher du canevas) et 670,7 → 212,9 ms avec
  microdétails (× 3,15) à 1024 × 768 ; écart visuel moyen 0,03–0,06/255, max 7–9. `renderQuality: 'fast' | 'reference'`. Empreinte `first-eye` mise à jour (changement voulu) ;
  34/34 références visuelles restent `close`, aucune regénérée.
- docs : `EYES-SYSTEMS.md`, `EYES-PERF.md`, `EYES-REMAINING.md` ; preuves : `artefacts/eyes/` (10 images + `perf.json` + `verification.json`, script `scripts/artefacts-eyes.ts`).

Tests ajoutés : 59 (pupil-profile 7, highlights-system 6, iris-layers 8, eye-microdetail 5, head-turn-sphere 9, eye-appearance 8, verify-eye 7, eye-perf 9).
Erreurs de parcours (détail dans `ERRORS.md`) : planche avec identifiants SVG dupliqués (cellules d'œil toutes nommées `e`) ; parallaxe de la rotation 3D qui sortait l'œil du cadre
(corrigé : recentrage par défaut) ; test de vitesse instable sous charge (rendu entrelacé) ; getter `.pixels` de resvg qui copie à chaque accès (OOM du script d'artefacts).
