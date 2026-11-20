# Artefacts — moteur capillaire (tête entière)

Régénération déterministe : `npx tsx scripts/hair-grammar/artefacts-engine.ts` (écrit ces PNG et `metrics.json`). Docs : `docs/TODO-RENFORCEMENT-HAIR-STATUS.md`.

| Image | Preuve | Doc |
|---|---|---|
| 01-courbes | 8 comportements de courbe + programme complet | HAIR-ENGINE-CURVES |
| 02-largeur | renflement, pincement, méplat, marche, torsion | HAIR-ENGINE-CURVES |
| 03-emergence | mère + 3 filles nées sur sa coque (écart ≤ 0,004 H) | HAIR-ENGINE-CURVES |
| 04-occlusion | tresse (lames fabriquées), filles sous la mère | HAIR-OVERLAP |
| 05-composition-pilotage | lecture et équilibre visés vs mesurés | HAIR-COMPOSE |
| 06-composition-analyse | masses, espaces négatifs, focaux, lignes de force | HAIR-COMPOSE |
| 07-finition | ruban plat vs torsadé ; finition de base vs géométrie locale | HAIR-FINISH-VERIFY |
| 08-verification-reparation | défauts localisés (rouge) avant, score 5 → 0 après | HAIR-FINISH-VERIFY |
| 09-intentions | airy / sleek / voluminous / windswept / heavy + mesures | HAIR-INTENT |
| 10-variation-niveaux | un niveau change à la fois | HAIR-INTENT |
| 11-tete-entiere-vues | coiffure composée, lacets −60° … +30° | HAIR-COMPOSE |
| 12-interop | rendu grammaire vs `HairLock` (couleur = rang) | HAIR-INTEROP |

Limites visibles : 03 est discret (filles qui retombent) ; 04 bas = scène d'émergence, haut = lames fabriquées ; 09 montre un œil couvert (voluminous/heavy) ;
10 montre une frange couvrant le nez (pas de contrôle `anat.face`) ; 11 non validé au-delà de +30°.
