# Yeux — passe 4 (2026-11-15) : liner de famille, dégagement de l'ouverture, facettes spectrales

Aucun moteur nouveau : tout passe par les paramètres existants (`lids.liner`, `iris.detail.facets`) ou par un garde-fou de géométrie (`eyeLashSet`, point d'entrée unique du rendu ET de la vérification).

## Ce qui a été fait
| Sujet | Fichiers | Preuve |
|---|---|---|
| Trait de paupière épais et effilé par famille de cils (`LashFamily.liner`, appliqué par `applyLashFamily` si l'œil n'a pas déjà un liner) | `src/generation/eye-lash-families.ts` | `artefacts/eyes-refs3/06-references-vs-moteur.png`, `artefacts/eyes-pass4/02-familles-liner-avant-apres.png`, `tests/eye-lash-clearance.test.ts` |
| Dégagement de l'ouverture : un cil dont le CORPS (ligne médiane + demi-largeur) recouvre l'ouverture pivote autour de sa racine (≤ 50°) ; un cil dégagé n'est pas touché | `src/geometry/eye/lash-clearance.ts`, `lashes.ts` (`eyeLashSet`) | 1 100 yeux, 19 021 cils : 848 intrusions -> 24 (`artefacts/eyes-pass4/03-degagement-ouverture.json`) ; cas « clump 0,9 + bendDeg 55 » : baisse > 70 % |
| Portée des cils dans la zone du dessin : le liner relève les racines, `applyLashFamily` raccourcit longueur et mèches de coin jusqu'à 0,5 de la plus grande dimension (limite du contrôle : 0,55) | `lash-zone.ts`, `eye-lash-families.ts` (`ZONE_TARGET`) | test « portée des cils » (10 familles × 34 yeux) |
| Vérification alignée : `upper-lash-tips-outside-opening` et `lashes-in-zone` utilisent les mêmes fonctions que le dégagement et le raccourcissement | `src/verify/eye-lashes.ts` | tests `eye-lash-verify` (inchangés, verts) |
| Facettes d'iris : `dispersion` (liseré spectral rouge -> violet par angle de facette + contre-liseré complémentaire) et `rays` (0–12 faisceaux issus du côté haut-gauche), opt-in, 0 = octet pour octet identique ; branchés sur les familles d'iris `prism` (0,8 ; 6) et `frost` (0,35 ; 4) | `src/schema/eye-iris-pupil.ts`, `src/render/eye/iris-crystal.ts`, `iris-detail.ts`, `eye-iris-families.ts` | `artefacts/eyes-pass4/01-facettes-dispersion-rayons.png`, `tests/eye-iris-crystal.test.ts` (5 tests ajoutés) |

Reproduire : `npx tsx scripts/artefacts-eyes-pass4.ts` puis `npx tsx scripts/artefacts-eyes-lashes.ts` et `python3 scripts/eye-refs/compose_lash_panel.py`.

## Essai abandonné (honnêteté)
Faire suivre la pointe des mèches par `ctrl2` dans `clumpLashes` : la comparaison ancien / nouveau n'était pas à groupes identiques, aucun gain prouvé ; modification annulée. Seul le dégagement traite les mèches qui recouvrent l'iris.

## Ce qui ne marche pas encore, ou n'est pas prouvé
- 24 cils sur 19 021 recouvrent encore l'ouverture : la rotation (≤ 50°) ne suffit pas (cils très courts ou racine déjà dans l'iris). Non traité.
- Les valeurs de liner (épaisseur 0,9–1,9, début, sommet, aile) sont **interprétées** sur les planches, non mesurées. Le noir est celui des cils (`#0c0a10`), pas le `#000` plat des références : le rendu garde un léger dégradé de lumière.
- Dispersion et rayons : valeurs « I » (non mesurables sur les références, qui n'ont pas de prisme). Les rayons ressemblent à des éclats isolés, pas à un vrai faisceau volumétrique ; pas de rayons dans la sclère ni sur la peau.
- Contraste des étiquettes de planche `02-…` sur fond blanc faible (cosmétique).

## Reste à faire — voir aussi `EYES-REMAINING.md`
- ⬜ Réfs 13 et 17 : ≈ 8 yeux non tracés ; réf. 14 : silhouette et iris ; réf. 15 rangées 3–5 : limbe non détecté. Non touchés dans cette passe.
- ⬜ Galerie des 100 : distance minimale entre silhouettes 0,0089 (seuil de test 0,008).
- ⬜ `verify-eye-render.ts` (pixels) sans règle sur les cils ; non appelé par `verifyFace`.
- ⬜ Almond : angles internes 93,66° (mesuré 93,67°) et externes 118,99° (119,0°) obtenus en passe 3 ; aucun nouveau travail ici.
- ⬜ Contrôle : comparer l'épaisseur de liner à une mesure par pixel sur 12–16 (la présente valeur est visuelle).
