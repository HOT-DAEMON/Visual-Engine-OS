# Audit ligne par ligne de `TODO-RENFORCEMENT-HAIR.md`

Légende : ✅ fait et prouvé (test + artefact) · 🟡 fait en partie (le reste est listé) · ⬜ non fait.
Preuves : `tests/hair-engine-*.test.ts`, `artefacts/hair-engine/` (`npx tsx scripts/hair-grammar/artefacts-engine.ts`), `metrics.json`.
Documents détaillés : `HAIR-ENGINE-CURVES`, `HAIR-OVERLAP`, `HAIR-COMPOSE`, `HAIR-FINISH-VERIFY`, `HAIR-INTENT`, `HAIR-INTEROP`.
**Passe 2** (`artefacts/hair-engine-pass2/`, `HAIR-GEOM-BRIDGE`, `HAIR-WEAVE`, `HAIR-FACE-INTENT`, bilan et reste : `HAIR-PASS2-REMAINING`) : lignes marquées « P2 » ci-dessous.
**Passe 3** (`artefacts/hair-engine-pass3/`, `HAIR-PASS3`, reste : `HAIR-PASS3-REMAINING`) : lignes marquées « P3 » ; elles remplacent l'état de la passe 2 quand elles se contredisent.

## Problème majeur — contrat d'interopérabilité
| Ligne | État | Détail |
|---|---|---|
| Les deux moteurs sont-ils raccordés ? | 🟡 | Non raccordés dans une chaîne unique (vérifié). Un contrat + adaptateur vérifiable existe (`interop.ts`). |
| Contrat d'interopérabilité explicite | ✅ | `grammarToHairLocks` + `checkHairLockContract` + `frameFromEyes`, 7 tests, artefact 12. |
| Chaîne de génération unique | ⬜ | Voir `HAIR-INTEROP.md` §« reste à faire » 1–6. |

## 3.1 Grammaire de composition
| Ligne | État | Détail |
|---|---|---|
| Existant (masses, familles, couches, sous-couches, distribution, raie, volumes, asymétries) | ✅ vérifié | Existe (`HAIR-GRAMMAR*.md`) ; aucune mesure de composition n'existait. |
| Hiérarchie des masses (preuve visuelle) | ✅ | `analyzeComposition.masses` + `hierarchy` ; artefact 06 (parts 37/24/16/12/12 %) ; test de pilotage à 0,1. |
| Direction principale de lecture | 🟡 | Mesurée et pilotée (05) ; erreur 0,15–0,25 rad aux angles obliques. |
| Équilibre G/D | ✅ | 05 : −0,25/0/0,25 → −0,21/0,04/0,23. |
| Espaces négatifs | 🟡 | Mesure + corridors + parasites ; « bien conçu » esthétiquement non jugé (seuils de garde-fou). |
| Points focaux visibles et construits | ✅ | épi, faisceau de pointes, accent (06). Précision de visée ~5 % H. |
| Lignes de force complètes | 🟡 | Contour + flux + portée (06) ; pas de lignes de tension entre masses distantes. |
| Distribution intentionnelle de densité | ✅ | carte cible → acceptation de racines ; test corrélation ↑. Démo visuelle dédiée : ⬜ (testé, pas d'image). |
| Relations entre groupes consommées par le moteur | ✅ | `RelationRule` → `emergeFrom` dans `composeHair` ; `occlusion.ts` consomme `emerge`. |
| « Nombre de mèches ≠ fonction » | ✅ | rôle dominant/secondaire/accent par famille. |

## 3.2 Courbes et transitions
| Ligne | État | Détail |
|---|---|---|
| Huit comportements successifs (droite, arc, inflexion, compression, onde, torsion, accélération, retournement) | ✅ | `curve-program.ts`, un test par comportement + combinaison + continuité 1e-5 ; artefact 01 (8 + combinaison). |
| Test visuel 1 par 1 et combinaison | ✅ | 01-courbes.png. |
| Transition entre masses (émergence) | ✅ | `emergeFrom` : racine sur la coque, écart 0,004 H, angle ≤ 7,5° ; artefact 03 (visuellement discret). |
| Renflements, étranglements, sections aplaties, changements brusques/progressifs | ✅ | `bulge/pinch/flat/step` ; 02. |
| Torsion de ruban | 🟡 | Largeur apparente + face visible ; pas de surface de ruban 3D. |

## 3.3 Chevauchement
| Ligne | État | Détail |
|---|---|---|
| 8 questions (devant, début, fin, visible, ombre de contact, sous-couche, croisement, silhouette) | 🟡 | 1–5, 7, 8 ✅ ; « sous-couche qui réapparaît » (6) non faite. |
| Logique de relations plutôt que de calques | 🟡 P3 | Profondeur de VOLUME (dalles) : découpes −65…−75 %, stabilité meilleure en agrégat seulement. Graphe + ordre topologique + tronçons ; OPT-IN (constat mesuré : profondeur de coque peu fiable sur cheveux denses). |
| Deux mèches alternativement devant/derrière | ✅ P2 | `weaveStrands` (segment `weave`) : alternance écrite par la géométrie, lue par l'occlusion ; ablation lift 0 → pas d'alternance (`HAIR-WEAVE`, artefact pass2/01). |

## 3.4 Finition picturale
| Ligne | État | Détail |
|---|---|---|
| Palette simplifiée (3 aplats, croissant, encre commune) | 🟡 | `paint-pro` : reflet et ombre calculés ; encre toujours commune ; 3 aplats de base conservés. |
| Bénéficier de `hair-lock.ts` | 🟡 P2 | La géométrie de `paint-pro` est consommée par `lockMarkup` via `HairLock.geom` (`HAIR-GEOM-BRIDGE`). Le SVG de `paint-pro` reste un second pinceau. |

## 4.3 Moteur d'apparence
| Ligne | État | Détail |
|---|---|---|
| Lumière ↔ forme (courbure, orientation, torsion) | ✅ P2 | `LockGeom` ; ruban plat vs torsadé (07) ; côté principal : `celBands` lit largeur, torsion, face, occlusion. Lumière toujours 2D (`ld`). |
| Lumière commune (un vecteur hôte ↔ repère tête) | 🟡 P3 | `light-bridge.ts` + `LockGeom.exposure` lu par `celBands`/reflet ; ombres de contact et filtres restent 2D. |
| Reflets localisés suivant chaque mèche | ✅ P2 | bandes le long de l'axe ; reflet local clippé par mèche hors cel ; `hairGloss` s'efface (`localGlossShare`). |
| Dépendance au SVG | 🟡 | contournée dans `paint-pro` (géométrie) ; non traitée pour les filtres du principal. |
| Interface normale/courbure/orientation/torsion/largeur/profondeur/exposition/occlusion | ✅ | `LockGeom`. |

## A–H
| Moteur | État | Détail |
|---|---|---|
| A. Analyse de référence | 🟡 P3 | + `observe-structure` (régions de flux) et `fitFromReference` en boucle fermée ; segmentation par mèche ⬜ ; paramètres non identifiables de façon unique. |
| B. Grammaire de style | ✅ | couche supérieure = `CompositionSpec` + `Intent`. |
| C. Forme et flux (structures ramifiées) | ✅ P3 / 🟡 | séparation, pointes libres, jonction, boucle (`branch.ts`, vérifiés) ; non intégrés aux profils, pas de spirale 3D. |
| D. Composition et occlusion (graphe de relations) | ✅ grammaire / ⬜ principal | graphe `relationsOf` + relations de groupes. |
| E. Apparence (ne pas dupliquer) | ✅ P2 / 🟡 P3 | `geom` consommé ; `exposure` commun ; mèches `part`/`sim` et filtres SVG : ⬜. |
| F. Art direction | 🟡 P3 | + frange, pointes libres, raie pilotées et mesurées ; reflets non pilotés ; calotte autour de la raie fragile. |
| G. Variation | ✅ | 7 niveaux indépendants, test champ par champ. |
| H. Cycle de réparation (6 étapes) | ✅ | `repairCycle` ; artefact 08 (5 → 0). Non branché sur `autofit`/`iso-verify`. |
| Couche de vérification du rendu (géométrie, anatomie, style) | ✅ P2 / 🟡 P3 | `verifyComposed`, défauts localisés ; + `anat.face` (nez, bouche), visibilité par `facing`, réparation multi-coupables, vues −75°…+75° (`HAIR-FACE-INTENT`). |

## Constats à traiter ensuite (après la passe 3)
1. ✅ P3 — « volume +1, lourd » : 20 → 0 ; résidus 30°/60°/−75° soldés ; tests en degrés avec garde.
2. ✅ P3 — ramification (séparation, jonction, boucle, pointes libres) ; profondeur de volume en mode `all` (🟡 stabilité par cas).
3. ✅ P3 — lumière commune (🟡 ombres et filtres) ; visibilité réelle + `geom.layer`.
4. 🟡 P3 — observation → ajustement en boucle fermée ; segmentation par mèche ⬜.
5. 🟡 P3 — intention combinée : style CV 0,94 et `anat.dome` 63 % à 30° non résolus.
6. ⬜ Sous-couche réapparaissante, ombre douce, mèches `part`/`sim` sans `geom`, filtres SVG.
Détail par composant : `HAIR-PASS3-REMAINING.md` (passe 2 : `HAIR-PASS2-REMAINING.md`).
