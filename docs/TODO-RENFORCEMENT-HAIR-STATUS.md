# Audit ligne par ligne de `TODO-RENFORCEMENT-HAIR.md`

Légende : ✅ fait et prouvé (test + artefact) · 🟡 fait en partie (le reste est listé) · ⬜ non fait.
Preuves : `tests/hair-engine-*.test.ts`, `artefacts/hair-engine/` (`npx tsx scripts/hair-grammar/artefacts-engine.ts`), `metrics.json`.
Documents détaillés : `HAIR-ENGINE-CURVES`, `HAIR-OVERLAP`, `HAIR-COMPOSE`, `HAIR-FINISH-VERIFY`, `HAIR-INTENT`, `HAIR-INTEROP`.

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
| Deux mèches alternativement devant/derrière | ✅ | tresse (04) mais sur lames fabriquées : le moteur ne sait pas auteurer un entrelacs. |

## 3.4 Finition picturale
| Ligne | État | Détail |
|---|---|---|
| Palette simplifiée (3 aplats, croissant, encre commune) | 🟡 | `paint-pro` : reflet et ombre calculés ; encre toujours commune ; 3 aplats de base conservés. |
| Bénéficier de `hair-lock.ts` | ⬜ | `paint-pro` est un second pinceau dans la grammaire ; le principal n'en profite pas. |

## 4.3 Moteur d'apparence
| Ligne | État | Détail |
|---|---|---|
| Lumière ↔ forme (courbure, orientation, torsion) | ✅ dans la grammaire | `LockGeom` ; ruban plat vs torsadé (07). ⬜ côté moteur d'apparence principal. |
| Reflets localisés suivant chaque mèche | ✅ dans la grammaire | bandes le long de l'axe ; `hairGloss()` du principal inchangé. |
| Dépendance au SVG | 🟡 | contournée dans `paint-pro` (géométrie) ; non traitée pour les filtres du principal. |
| Interface normale/courbure/orientation/torsion/largeur/profondeur/exposition/occlusion | ✅ | `LockGeom`. |

## A–H
| Moteur | État | Détail |
|---|---|---|
| A. Analyse de référence | 🟡 | 7 grandeurs observables (`observe.ts`) ; 7 autres du TODO ⬜ (segmentation par mèche) ; `autofit` non branché. |
| B. Grammaire de style | ✅ | couche supérieure = `CompositionSpec` + `Intent`. |
| C. Forme et flux (structures ramifiées) | 🟡 | émergence ; séparation/jonction/enroulement/croisement : seul le croisement par tronçons. |
| D. Composition et occlusion (graphe de relations) | ✅ grammaire / ⬜ principal | graphe `relationsOf` + relations de groupes. |
| E. Apparence (ne pas dupliquer) | 🟡 | interface fournie ; le moteur commun ne la consomme pas encore. |
| F. Art direction | 🟡 | 4 axes mesurables ; manquent raie, frange, reflets, « pointes libres » au-delà du retroussé. |
| G. Variation | ✅ | 7 niveaux indépendants, test champ par champ. |
| H. Cycle de réparation (6 étapes) | ✅ | `repairCycle` ; artefact 08 (5 → 0). Non branché sur `autofit`/`iso-verify`. |
| Couche de vérification du rendu (géométrie, anatomie, style) | ✅ | `verifyComposed`, défauts localisés. |

## Constats à traiter ensuite (priorité décroissante)
1. Brancher `LockGeom` dans `lockMarkup`/`hairGloss` (une seule apparence).
2. Auteur d'entrelacs (`weaveWith`) + profondeur de volume pour fiabiliser le mode `all`.
3. Contrôle `anat.face` (nez, bouche) et `repairCycle` automatique après `applyIntent`.
4. Segmentation par mèche pour l'observation ; brancher `observe` → `autofit`.
5. Validation des vues > +30° (artefact 11 montre le profil 01 calé sur −46°).
6. Ramification complète (séparation, jonction, boucles).
