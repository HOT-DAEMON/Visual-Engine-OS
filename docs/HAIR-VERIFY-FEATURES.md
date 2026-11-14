# Vérification des traits de la coiffure 3D (frange, épis, mèches)

Branche `feat/hair-grammar`. Fichier : `src/head-turntable/verify-hair-features.ts`, branché dans `verify-head.ts` (mêmes trois couches que `HAIR-VOLUME-VERIFY.md`). Les bornes sont des **conventions** fixées avant la mesure ; aucune n'a été ajustée pour faire passer un rendu.

| Couche | Identifiant `head.hair3d.` | Mesure | Borne |
|---|---|---|---|
| géométrie | `geo.spike.outward` | cos(direction d'épi, normale de la coque), minimum | ≥ 0,15 |
| géométrie | `geo.fringe.range` | table de frange finie, sous le sommet | ≥ y du sommet |
| géométrie | `geo.fringe.track` | bord de frange projeté par la rotation = bord cheveux / peau à ≤ 6 px (4 angles) | ≥ 0,7 |
| anatomie | `anat.fringe.brow` | écart bord de frange → haut du sourcil (U) | ≥ 0,015 |
| anatomie | `anat.fringe.eye` | écart bord de frange → haut de l'œil (U) | ≥ 0,05 |
| anatomie | `anat.spike.count` | nombre d'épis (`spiky`) | 12 – 80 |
| anatomie | `anat.spike.len` | longueur médiane d'épi (U) | 0,04 – 0,3 |
| style | `style.strand.irregular` | coefficient de variation des largeurs de colonnes | ≥ 0,1 |
| style (hors couche) | `styleDistinctness(a, b)` | part des pixels de cheveux qui diffèrent de face entre deux coiffures | ≥ 0,04 (test) |

Modifs de contrôles existants : `lisiere.track` ignore les points d'implantation sous la frange (leur bord est celui de la frange) ; `style.teeth` borné à 60 pour `spiky`.
Exécution : `npx tsx scripts/hair-volume/verify.ts <style> <graine>` (tous les contrôles `head.hair3d.*`) ; tests : `tests/hair-features-3d.test.ts` (10 coiffures sans échec bloquant).
Résultat sur la graine 9000 : les 10 coiffures passent leurs contrôles durs. Limite : une seule graine pour les 10 coiffures dans ce passage ; à étendre (`HAIR-3D-REMAINING.md`).
