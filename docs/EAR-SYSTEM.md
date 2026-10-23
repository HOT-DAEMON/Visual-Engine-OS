# Moteur d'oreille — architecture (partie 1/2)

Implémente `docs/TODO EAR SYSTEM.md` et `docs/TODO EAR SYSTEM-2.md`. Suite : `docs/EAR-SYSTEM-2.md`. Reste à faire : `docs/EAR-REMAINING.md`.

## Principe
Une oreille n'est **pas** un dessin : c'est un **graphe de structures anatomiques** dans un **plan** (unité = hauteur de l'oreille), chacune avec un
**relief signé**. Le même graphe est projeté dans quatre vues, aligné sur le visage, peint avec un matériau, vérifié. Rien n'est « peint à la main ».

| Couche | Fichier | Rôle |
|---|---|---|
| Schéma | `src/schema/face-ear.ts` | contrat : famille, mélange, morphologie, ancrages, attache, style, matériau, extensions, piercings |
| Familles | `src/face/ear/families.ts` | préréglages d'espèce (structures requises/interdites, plages, matériaux, extensions, symétrie) |
| Résolution | `src/face/ear/morph.ts` | mélange de familles → déviations → asymétrie (graine) → plages (préférence) → présence des structures |
| Contour | `src/face/ear/outline.ts` | contour fermé C01–C07 (Catmull-Rom ; angularité = mélange spline/polyligne) |
| Structures | `src/face/ear/structures.ts` | EAR-01 … EAR-08 + contraintes strictes ; hélix/scapha suivent le contour (décalages intérieurs) |
| Modèle | `src/face/ear/geometry.ts` | normalisation unique (x ∈ [0, L/H], y ∈ [0, 1]) ; mémoïsé par contenu |
| Projection | `src/face/ear/project.ts` | un point (u, v, relief) → hôte pour un lacet de caméra |
| Placement | `src/face/ear/place.ts` | alignement sur les repères du visage |
| Visibilité | `src/face/ear/visibility.ts` | oreille sous les cheveux (état mesuré) |
| Rendu | `src/render/face/ear/*.ts`, `src/render/face/ears.ts` | matériaux (`paint.ts`), couches (`render.ts`), vues (`sheet.ts`), bijoux (`jewelry.ts`) |
| Vérification | `src/verify/ear.ts` | trois couches : géométrie, anatomie, style |

Le moteur `morphology` s'active avec `anatomyEngine: 'structured'` (`ears.engine: 'auto'`). Le moteur `classic` (ellipse) est conservé à l'identique.

## 1. Fondations
- **Anatomie** : onze structures (hélix, anthélix, scapha, fosse triangulaire, cymba, cavum, conduit, crus, tragus, antitragus, lobule) + incisure.
- **Géométrie** : contour à sept segments ; structures = polygones + relief ; mesures directes (longueurs de segments, rapport L/H, repères).
- **Matériaux** : `paint.ts`, jamais dans la géométrie (test : changer matériau/style ne change aucun polygone).
- **Éclairage** : relief → carte de hauteur (canal alpha) → `feDiffuseLighting` (sources distantes uniquement, ajoutées à la liste blanche SVG).
- **Style** : `style.look` (réaliste / anime), exagération, fidélité, angularité, douceur, asymétrie, densité de détails (LOD).
- **Espèce** : famille + mélange ; une famille règle la géométrie de départ, jamais le matériau.

## 2. Anatomie atomique
| Id | Structure | Construction |
|---|---|---|
| EAR-01 | hélix | bande intérieure du contour, de la racine au lobule ; épaisseur variable (fusion progressive) ; enroulement = relief |
| EAR-02 / 02A–E | anthélix | corps + branche supérieure + branche inférieure + jonction (volume) + sillons périphériques (côté conque, côté scapha) |
| EAR-03 | scapha | creux entre hélix et anthélix ; **jamais recouverte** (contrainte stricte) |
| EAR-04 | fosse triangulaire | triangle entre jonction et extrémités des branches |
| EAR-05 / 05A–F | conque | cymba (au-dessus du crus), cavum (au-dessous), conduit ; profondeur bornée par la paroi |
| EAR-06 | tragus / antitragus / incisure | blobs orientables, projection et profondeur d'incisure |
| EAR-07 | lobule | sans cartilage (relief doux) ; longueur, largeur, attache (libre ↔ collé), pendance |
| EAR-08 | extensions | `terminal_tip`, `secondary_ridge`, `branching_ridge`, `membrane_panel`, `ornamental_growth`, `bioluminescent_channel` |

Le **crus de l'hélix** (racine) est au niveau de la fosse triangulaire : c'est le repère aligné sur la ligne des yeux (`anchors.crusLevel`, 0,20–0,34).

## 3. Contour C01–C07
`C07` jonction oreille-crâne · `C01` pôle supérieur · `C02` bord postérieur · `C03` bord inférieur → lobule · `C06` jonction oreille-joue · `C05` tragus + incisure · `C04` bord antérieur.
Chaque segment expose ses indices `[from, to[` et sa longueur : on peut les contrôler et les mesurer indépendamment. Paramètres : `pole.{height,round,lean,tip}`,
`posterior.convexity`, `lobule.{length,width,attach,sag}`, `tragus.projection`, `notch.depth`, `width`.

### Forme réelle vs projection
`outline` est la forme réelle (plan) ; `projectEar(...).plate/rim` est sa silhouette dans une vue. La hauteur est conservée par toutes les vues, la largeur dépend de l'ouverture.
