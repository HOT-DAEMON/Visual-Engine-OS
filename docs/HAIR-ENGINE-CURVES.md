# Moteur capillaire — courbes, largeurs, émergence (TODO §3.2)

Code : `src/hair-grammar/curve-program.ts`, `width-program.ts`, `emerge.ts` · tests : `tests/hair-engine-curves.test.ts` (18) ·
preuves : `artefacts/hair-engine/01-courbes.png`, `02-largeur.png`, `03-emergence.png` (régénérer : `npx tsx scripts/hair-grammar/artefacts-engine.ts`).

## Constat de départ (vérifié dans le code avant d'écrire)
`lock.ts` ne savait produire qu'un cap `bend·t + onde sinusoïdale + retroussé de pointe` : une seule loi pour toute la mèche. `blade.ts` avait un
profil de largeur unique (pic + effilement). Aucune notion de torsion de ruban ni de mèche née d'une autre.

## 1. Programme de courbe (`CurveSegment[]`)
Une mèche peut porter `program`, suite de segments aux longueurs relatives ; le cap `θ(t)` est CONTINU aux jonctions (testé à 1e-5).
| Segment | Rôle | Paramètres |
|---|---|---|
| `straight` | racine presque droite | `len` |
| `arc` | courbure progressive | `angle`, `ease` (exposant d'entrée) |
| `inflect` | inflexion : la courbure change de signe | `angle` |
| `compress` | compression : oscillation resserrée à enveloppe `sin^0,75` | `amp`, `f0 → f1` |
| `wave` | ondulation | `amp`, `freq` |
| `twist` | torsion du ruban (n tours) | `turns` |
| `accelerate` | accélération de la courbure (loi de puissance) | `angle`, `power` |
| `tipFlip` | retournement de pointe | `angle` |
`FULL_PROGRAM` combine les huit. Sans `program`, comportement historique inchangé (compatibilité testée sur les tests pré-existants).

## 2. Grammaire de largeur (`WidthOp[]`)
`bulge` (renflement), `pinch` (étranglement), `flat` (méplat : largeur constante), `step` (changement brusque ou progressif, `sharp`).
Les opérations multiplient le profil de base (`widthAt`). La TORSION agit sur la largeur apparente : `twistWidth(φ) = max(0,16 ; |cos φ|)`
— le ruban se met de profil sans disparaître (plancher `TWIST_MIN`), et la face visible alterne (`Blade.twist`, `Blade.depth`).

## 3. Émergence (`emergeFrom`)
Une mèche fille naît EXACTEMENT sur la coque de la mère au paramètre `t` : racine = `Sample.shell` de la mère (pas une approximation), cap initial =
tangente de la mère, puis programme `[straight, arc(peel)]`. `emergenceContinuity` mesure écart (en H), angle et rapport de largeur.
Mesuré sur la scène de l'artefact 03 : écart 0,004 H (= l'enfoncement volontaire `sink`), angle 0,9–7,5°, rapport de largeur ≤ 0,05.

## Limites connues (à faire)
- Pas de structure RAMIFIÉE générale : une fille a une mère ; « se séparent / se rejoignent / s'enroulent » : seul le premier cas (émergence) est couvert.
  Se rejoindre (fusion de deux mèches) et s'enrouler (boucle fermée, `|Δθ| > 2π`) restent à implémenter.
- La torsion modifie largeur et face visibles ; aucun modèle de ruban 3D complet (pas de surface de Bézier réglée).
- Le cap est programmé en 2D-sur-la-coque ; une boucle serrée peut sortir de la coque (contrôle par `walk`, non vérifié au-delà de 1 tour).
- L'artefact 03 est géométriquement exact mais peu spectaculaire : les filles retombent par gravité vers le bas de la mère (à fixer : `gravity` par famille).
