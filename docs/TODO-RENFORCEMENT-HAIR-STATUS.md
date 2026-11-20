# Audit ligne par ligne de `TODO-RENFORCEMENT-HAIR.md`

Légende : ✅ fait et prouvé (test + artefact) · 🟡 fait en partie (le reste est listé) · ⬜ non fait.
Preuves : `tests/hair-engine-*.test.ts`, `artefacts/hair-engine/` (`npx tsx scripts/hair-grammar/artefacts-engine.ts`), `metrics.json`.
Documents détaillés : `HAIR-ENGINE-CURVES`, `HAIR-OVERLAP`, `HAIR-COMPOSE`, `HAIR-FINISH-VERIFY`, `HAIR-INTENT`, `HAIR-INTEROP`.
**Passe 2** (`artefacts/hair-engine-pass2/`, `HAIR-GEOM-BRIDGE`, `HAIR-WEAVE`, `HAIR-FACE-INTENT`, bilan et reste : `HAIR-PASS2-REMAINING`) : lignes marquées « P2 » ci-dessous.

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
| Logique de relations plutôt que de calques | 🟡 | Graphe + ordre topologique + tronçons ; OPT-IN (constat mesuré : profondeur de coque peu fiable sur cheveux denses). |
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
| Reflets localisés suivant chaque mèche | ✅ P2 | bandes le long de l'axe ; reflet local clippé par mèche hors cel ; `hairGloss` s'efface (`localGlossShare`). |
| Dépendance au SVG | 🟡 | contournée dans `paint-pro` (géométrie) ; non traitée pour les filtres du principal. |
| Interface normale/courbure/orientation/torsion/largeur/profondeur/exposition/occlusion | ✅ | `LockGeom`. |

## A–H
| Moteur | État | Détail |
|---|---|---|
| A. Analyse de référence | 🟡 | 7 grandeurs observables (`observe.ts`) ; 7 autres du TODO ⬜ (segmentation par mèche) ; `autofit` non branché. |
| B. Grammaire de style | ✅ | couche supérieure = `CompositionSpec` + `Intent`. |
| C. Forme et flux (structures ramifiées) | 🟡 | émergence ; séparation/jonction/enroulement/croisement : seul le croisement par tronçons. |
| D. Composition et occlusion (graphe de relations) | ✅ grammaire / ⬜ principal | graphe `relationsOf` + relations de groupes. |
| E. Apparence (ne pas dupliquer) | ✅ P2 / 🟡 | le moteur principal consomme `geom` (contrat vérifié) ; lumière 3D commune et mèches `part`/`sim` : ⬜. |
| F. Art direction | 🟡 | 4 axes mesurables ; manquent raie, frange, reflets, « pointes libres » au-delà du retroussé. |
| G. Variation | ✅ | 7 niveaux indépendants, test champ par champ. |
| H. Cycle de réparation (6 étapes) | ✅ | `repairCycle` ; artefact 08 (5 → 0). Non branché sur `autofit`/`iso-verify`. |
| Couche de vérification du rendu (géométrie, anatomie, style) | ✅ P2 | `verifyComposed`, défauts localisés ; + `anat.face` (nez, bouche), visibilité par `facing`, réparation multi-coupables, vues −75°…+75° (`HAIR-FACE-INTENT`). |

## Constats à traiter ensuite (priorité décroissante, après la passe 2)
1. ✅ P2 — `LockGeom` branché dans `lockMarkup`/`hairGloss`.
2. 🟡 P2 — auteur d'entrelacs fait (`weaveStrands`) ; profondeur de VOLUME pour le mode `all` : ⬜.
3. ✅ P2 — `anat.face` et `repairCycle` après `applyIntent` (`generateIntended`).
4. ⬜ Segmentation par mèche pour l'observation ; brancher `observe` → `autofit`.
5. ✅ P2 — vues −75°…+75° validées (résidus `geom.self` : 30°, 60°, −75°).
6. ⬜ Ramification complète (séparation, jonction, boucles).
7. ⬜ Réparation de masse (« volume +1, lourd » garde 7 `geom.self` + 8 `anat.eye`) ; tests historiques `viewAt(0.3/0.5)` à passer en degrés.
Reste détaillé par composant : `HAIR-PASS2-REMAINING.md`.
