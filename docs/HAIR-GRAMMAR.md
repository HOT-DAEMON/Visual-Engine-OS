# Grammaire de coiffure — architecture (`src/hair-grammar/`)

Principe : **une coiffure n'est pas une fonction**, c'est un jeu de paramètres interprété par un générateur unique. Les mèches sont ancrées sur une tête 3D, jamais en pixels : la vue (face, 3/4, profil) est un paramètre de rendu.

## Chaîne
```
HeadSpec ──► shell (coque) ──► LockSpec (mèche) ──► walk (marche 3D) ──► Blade (lame 2D) ──► SVG
   ▲                              ▲
   │                              └── grammar.ts : FlowField + FamilySpec[] → LockSpec[] (graine)
   └── fit.ts : calage de vue sur des repères image
```
| Fichier | Rôle |
|---|---|
| `vec.ts` | vecteurs, PRNG déterministe |
| `head.ts` | crâne ellipsoïdal + mâchoire effilée, repères 3D, projection orthographique (lacet/tangage), **inversion image → coque** (`aimOnShell`) |
| `fit.ts` | calage (lacet, tangage, échelle, translation) sur repères mesurés ; résidu par repère |
| `shell.ts` | coque capillaire (crâne + cou), normale, tangentes |
| `lock.ts` | **primitive de mèche** : racine, cap, longueur, courbure, ondulation en S, retroussé, décollement, gravité, profil de lame |
| `blade.ts` | axe 2D rééchantillonné (Catmull-Rom), largeur variable, contours |
| `grammar.ts` | champ d'écoulement (`sweep`, `swirl`, `radial`, `fall`) + familles de mèches (boîtes de racines, intervalles) |
| `paint.ts` | lame remplie + trait + croissant d'ombre + brins ; couches `back/front/over` |
| `face3q.ts` | tête 3/4 d'encre (silhouette, mâchoire, cou, yeux simplifiés, nez, bouche) |
| `verify.ts` | couches **géométrique / anatomique / style** + métriques contre la référence |
| `profiles/tousled.ts` | profil de la coiffure 01 (données seulement) |

## Ce que décrit une mèche (`LockSpec`)
Forme (largeur, position du maximum, acuité de pointe), **position** (racine : élévation × azimut sur la coque), **direction** (`aim`, vecteur de tête projeté au plan tangent), **taille** (longueur en hauteurs de tête), **orientation** (cap qui tourne : `bend`, `wave`, `flick`), **portée** (décollement `lift0→lift1`, gravité). La portée est bornée par la vérification anatomique (la frange ne doit pas dépasser la pointe du nez, etc.).

## Couches (ordre de dessin)
mèches `back` (faces cachées) → cou → oreille → peau → traits du visage → yeux → mèches `front` → `over`. Une mèche `auto` est `back` si la normale de coque au milieu de la mèche s'éloigne de la caméra.

## Vitesse
SVG de chemins uniquement : **aucun filtre**, aucune ombre floue. Médianes mesurées (`artefacts/hair-grammar/metrics.json`, 15 passes après échauffement) : construction géométrie+SVG ≈ 14 ms, rastérisation 312 px ≈ 25 ms. Piège rencontré : le premier rendu resvg coûtait ~7 s à cause du chargement des polices système → `loadSystemFonts: false`.
Comparaison avec l'ancien moteur : non mesurée sur le même cas (l'ancien est de face, pas comparable) — voir `HAIR-GRAMMAR-REMAINING.md`.

## Reproduire
`npx tsx scripts/hair-grammar/artefacts-01.ts` (régénère `artefacts/hair-grammar/`), `npx vitest run tests/hair-grammar.test.ts`.
