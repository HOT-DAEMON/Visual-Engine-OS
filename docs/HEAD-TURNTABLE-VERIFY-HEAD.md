# Tête en rotation — couche de vérification « tête quelconque » et audit pixel

Code : `src/head-turntable/verify-head.ts` (couche), `verify-contour.ts` (audit pixel), `verify-style.ts` (mesures d'encre, paramétrées par la palette), `verify-types.ts` (contrats `Check` / `LayerReport`).
Scripts : `scripts/head-turntable/{verify-head-run,audit-contour,audit-gallery,audit-planche}.ts`. Tests : `tests/head-turntable-jaw.test.ts`. Résultats : `artefacts/head-turntable-v2/galerie/verification.json`, `galerie.csv`.

Les couches existantes (`verify-geo`, `verify-anat`, `verify-style`, `verify-engines`) comparent la planche à ses mesures. Celle-ci n'a **besoin d'aucune mesure de planche** : elle valide n'importe quelle tête construite par les moteurs
(`HeadSubject = { id, spec, lengthH? }`), en trois couches. Chaque borne dit sa provenance : [canon] proportion classique du dessin de tête, [planche] valeur de la planche avec marge, [rendu] tolérance de rastérisation, [mesuré] relevé sur les 13 têtes.

## 1. Géométrie — la 3D reste fidèle aux moteurs 2D, le contour est continu (25 contrôles)

| Contrôle | Mesure | Borne | Origine |
|---|---|---|---|
| `head.geo.rows` | rangées fautives (non finies, avant ≤ arrière, point large qui recule hors calotte) | 0 | structure |
| `head.geo.front2d` | écart moyen de demi-largeur : tête seule à tangage 0 vs contour du moteur de visage (y 0,15–0,5 et 0,85–1,0) | ≤ 0,03 U | [rendu] trait + épaisseur de la coupe de cheveux (0,045 U) : **marge faible**, planche 0,0254, graine 1 0,0255 |
| `head.geo.profile2d` | écart du bord avant du front à 90°, tangage 0, vs z avant du moteur (pivot z = 0) | ≤ 0,03 U | [rendu] ; mesuré 0,001 |
| `head.geo.jaw.{0,20,45,70,90}.concavity` | creux max du contour par rapport à son enveloppe convexe | ≤ 0,02 U | [mesuré] : un sac qui pend crée un creux |
| `….inflections` | changements de signe de courbure entre deux arcs soutenus (|k| > 3 /U, ≥ 3 échantillons) | ≤ 3 | [canon] lèvre / sillon ; le comptage naïf donnait 4 sur du bruit |
| `….radius` | rayon de courbure minimal du contour convexe | ≥ 0,025 U | [mesuré] : en dessous, un angle vif |
| `….ink` | plus longue interruption du trait de contour | ≤ 4 px à 520 px | [rendu] une largeur de trait |
| `head.geo.jaw.{135,180}.concavity` | creux max, vues de dos | ≤ 0,02 U | [mesuré] |

Le contour est tracé **sur l'image** (voisinage de Moore sur le tampon d'identifiants), pas sur la géométrie : c'est ce que l'œil voit. Il est étiqueté fond / cou / autre pièce ; les bosses (nez, lèvres) et les oreilles sont exclues
(leur silhouette est légitimement sinueuse) ; la jonction mâchoire → cou (coin concave légitime) coupe les tronçons.

## 2. Anatomie (11 contrôles)

| Contrôle | Borne | Origine |
|---|---|---|
| `head.anat.eyeline` (ligne des yeux / sommet → menton) | 0,40 – 0,66 | [canon] ½ ; dessin stylisé plus bas : planche 0,59, planche 2 (`rotation_head_1`) 0,62 |
| `head.anat.depth` (profondeur au sourcil / hauteur) | 0,66 – 1,0 | [canon] 0,70–0,95 ; planche 0,76 |
| `head.anat.jaw.plane` (gonion → menton / horizontale) | 10° – 42° | [canon] 15–35° ; planche 26,9° |
| `head.anat.gonion.height` (gonion vs bouche) | −0,15 – +0,35 U | [canon] gonion ≈ niveau de la bouche ; planche −0,003 |
| `head.anat.gonion.rest` (gonion → bas du menton) | 0,06 – 0,4 U | [canon] |
| `head.anat.bigonial` (largeur bigoniale / bizygomatique) | 0,50 – 0,97 | [canon] 0,55–0,95 ; planche 0,61 |
| `head.anat.skull.length` (longueur 3D du crâne vs `derivation.lengthH`) | ≤ 0,02 U | [mesuré] 0,002 sur les graines ; crâne figé : jusqu'à 0,044 |
| `head.anat.ear.top` / `ear.bottom` | −0,12 – 0,2 / −0,16 – 0,12 | [canon] haut de l'oreille ≈ sourcil, bas ≈ base du nez |
| `head.anat.neck` (information) | 0,30 – 0,72 | [canon] |
| `head.anat.chin.lowest` (x image du point le plus bas à 90°, face = gauche) | −0,7 – −0,1 U | le menton, côté face, est le point le plus bas : pas de « pendaison » |

## 3. Style (12 contrôles)

`ink.contrast` (WCAG encre / peau ≥ 2,5 ; planche 9,2, le générateur de palette garantit ≥ 3,2) · `hair.contrast` (information) · `line.{0,90}` (trait de la mâchoire 0,006 – 0,022 U ; planche ≈ 0,013, mesuré sur la
mâchoire car des cheveux sombres ressemblent à l'encre) · `closure.{0,45,90,180}` (≥ 0,96) · `specks.{0,45,90}` (îlots d'encre ≤ 6 : **information** pour les têtes autres que la planche, voir §5) · `specks.180` (information, la planche en compte 33).
Les tolérances de couleur d'encre (45 / 70 / 95) sont ramenées à une fraction de la distance encre ↔ peau : sur peau foncée elles faisaient « voir de l'encre » partout.

## 4. Résultats (13 têtes : planche + 12 graines, 520 px)

Planche : 47 contrôles, 0 hors bornes. Graines 1 à 12 : 48 contrôles chacune, **0 échec bloquant** ; hors bornes en information : `specks.0` / `specks.45` (graine 5 : 22 et 13), `specks.0` (graine 6 : 15).
Preuve de détection : un crâne figé (visage large de rapport 0,91 + crâne de la planche) échoue `head.anat.skull.length` (test `un crâne figé est détecté`).

## 5. Limites de cette couche — à lire avant de s'y fier

1. **Bornes calées après coup** sur la planche et les graines : plusieurs ont été élargies quand un contrôle échouait (`eyeline`, `gonion.height`, `specks`), chaque fois après examen de la cause. Elles garantissent la cohérence interne et attrapent les régressions ; elles ne prouvent pas la fidélité à une référence.
2. **Contrôle tautologique** : `head.anat.ear.bottom` vaut 0 partout, car le gréement d'oreille aligne le bas sur la base du nez ; il ne détecte qu'une régression de ce gréement.
3. **Marge faible** sur `head.geo.front2d` (0,0255 pour 0,03).
4. **Une seule référence mesurée par vue** : `rotation_head.measures.json` pour la planche ; la planche 2 n'est utilisée que comme canon (proportions), jamais comparée à une tête générée.
5. **Style = lisibilité du trait, pas goût** : aucun contrôle sur la qualité de l'ombrage ni sur la ressemblance au style de la référence ; les bandes d'ombre dures sur la joue (arête de normale du V de mâchoire) ne sont pas détectées.
6. **Pendaison** : détectée par le creux et la position du point bas ; la métrique la plus parlante sur la planche reste l'écart signé à la silhouette mesurée (`audit-planche.ts`), inapplicable aux têtes sans mesure.
7. Rendus mémoïsés par `HeadRenders` ; une vérification complète = 9 rendus (≈ 8–10 s à 520 px).

## 6. Utilisation

```
npx tsx scripts/head-turntable/verify-head-run.ts 1,2,3     # planche + graines
npx tsx scripts/head-turntable/audit-planche.ts <dossier>    # 9 lacets : courbure + écart signé à la planche (à lancer dans n'importe quel arbre : avant/après)
npx tsx scripts/head-turntable/artefacts-annotate.ts <dossier>  # contour coloré par courbure
```
