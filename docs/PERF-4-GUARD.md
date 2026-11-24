# PERF-4 — garde contre le plantage natif de `resvg` et identifiants uniques

## Le plantage (reproduit, isolé, expliqué)

Une scène à plusieurs personnages dont l'un est très hors cadre (x = 9 000 ou −5 000) fait **avorter le processus Node** : « fatal runtime error: failed to initiate panic »,
sans exception rattrapable (le panic Rust traverse le FFI). La trace native pointe `resvg/src/geom.rs:27 : called Option::unwrap() on a None value`.

Isolé par dichotomie sur des SVG minimaux (`tests/offcanvas.test.ts`, contrôle négatif) : un **calque** (`clip-path`, `filter`, `opacity`, `mask`) dont l'emprise est
ENTIÈREMENT hors du canevas à plus de deux tailles de canevas de l'origine plante ; un `clip-path` seul suffit, sans filtre. Seuils mesurés pour un canevas W × H : à
droite `x ≥ 2W + 2`, à gauche bord droit `≤ −(2W + 2)`, idem en vertical, indépendants de la taille du clip. Un élément hors cadre SANS calque ne plante pas.
La règle est empirique ; la cause exacte dans `resvg` (ajustement de l'emprise du calque à une zone bornée) est déduite de la trace, pas lue dans son code.

## La garde (`src/core/offcanvas.ts`, `affine.ts`)

`cullOffCanvas(svg)` : un calque dont l'emprise est entièrement hors du canevas est INVISIBLE ; le supprimer ne change aucun pixel et supprime le déclencheur.
- Emprise toujours MAJORÉE : géométrie par `pathBox` (conservatif), trait élargi (×2 de la plus grande épaisseur de la chaîne), filtre = sa région, `clip-path` =
  intersection avec le tracé du clip, `svg` imbriqué = son cadre de vue (`viewBox` + `meet`/`none`).
- On ne supprime que ce qui est mesurable : transformation inconnue, balise dessinante inconnue, `<use>` (référence par id), `clipPathUnits=objectBoundingBox`, SVG illisible
  → laissé tel quel. Le texte du SVG est alors rendu inchangé.
- Les DÉFINITIONS d'un sous-arbre supprimé (`defs`, dégradés, clips, filtres…) sont CONSERVÉES : un élément resté en vue peut les référencer.
- Coût : ≈ 38 ms sur une scène de 2,7 Mo (≈ 1 % d'une figure ; comparable à `resvg` seul).
- Branchée à `scripts/lib/raster.ts` (cache de rastérisation, utilisé par la plupart des scripts) et `scripts/render.ts` (CLI). **Non branchée** à `render-fast.ts`
  (SVG d'une cellule de cheveux, jamais hors cadre) ni aux ≈ 60 autres `new Resvg` ponctuels des scripts d'artefacts.

Preuves : 4 formes de calque lointain × (brut → plante, gardé → ne plante pas) en processus enfant ; 5 dispositions de scènes à plusieurs personnages (pixels du SVG gardé
identiques au brut quand le brut ne plante pas) ; scène extrême x = 9 000 (brut plante, gardé non) ; décisions géométriques ; 18 tests au total dans `tests/offcanvas.test.ts`. Image : `artefacts/figure-perf/05-…png`.

## Identifiant dupliqué

58 visages sur 60 portaient au moins un `id` répété, dans 5 familles (`hair-base-clip`, `sideburn#-clip`, `beard-clip`, `mustache-clip`, `stubble#-clip`). Cause : `compileSurface(id)`
émet déjà `<clipPath id="${id}-clip">`, puis l'appelant en pousse un second sous le même nom avec le même tracé. Corrigé à l'unique point d'assemblage (`src/compile.ts`)
par `dedupeDefs` (`src/core/defs.ts`) : une définition STRICTEMENT identique est supprimée (aucun pixel ne change) ; un même `id` de contenu DIFFÉRENT est conservé et signalé,
jamais masqué. Tests : 60 visages et 3 scènes à 3 personnages sans doublon ; deux `clipPath` identiques ou un seul → mêmes pixels. Régression visuelle du dépôt : `exact` ou `close` à RMS 0,00.

## `pathBox` plus rapide (dépendance de la garde)

`src/core/pathbox.ts` : découpage en jetons sans regex ni tableau (43 → 21 ms pour 2,1 Mo de tracés). Égal à l'ancienne version sur tous les tracés de 8 visages complets et
30 000 chaînes aléatoires piégeuses (`tests/pathbox-equiv.test.ts`, oracle figé `tests/helpers/pathbox-ref.ts`). **Écart voulu** : l'ancienne version prenait un nombre à
exposant (`6e+12`) pour une commande (test `/[a-zA-Z]/` sur chaque jeton) ; la nouvelle le lit comme un nombre. Sans effet sur le moteur (`num()` n'écrit jamais d'exposant).
Le fuzzing a aussi attrapé un bug de ma première version (« `61.` » lu 608), corrigé.
