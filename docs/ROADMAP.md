# Feuille de route — eye-engine

Document vivant. Mis à jour à chaque session de travail, jamais réécrit pour
« paraître » plus avancé qu'il ne l'est : une case cochée signifie testée et
vérifiée, pas seulement écrite.

## Vision du projet

Un moteur de rendu visuel piloté par des spécifications JSON strictement
validées (schéma Zod), qui compose une quasi-infinité d'individus visuels
(yeux d'abord, puis visages, puis personnages entiers, puis les animaux, les robots, les demons, les anges, la nature, etc..) à partir de
composants génériques et réutilisables : un système de matériaux/lumière
partagé, des bibliothèques de motifs paramétriques, et des générateurs
aléatoires déterministes qui prouvent la composabilité par des tests, pas
par affirmation.

## État d'avancement — légende

- ✅ Implémenté et couvert par des tests qui passent (vérifié à la date indiquée)
- 🚧 Implémenté partiellement — limites explicites listées
- ⏳ Planifié, non commencé

## Composants de l'œil

| Composant | État | Détail |
|---|---|---|
| Enveloppe (fente palpébrale) | ✅ | Bézier cubique, canthi arrondis, tilt, ouverture, 4 styles (`shape.style`) : almond (classique), round (kawaii), sharp (tsurime), drooping (tareme) — le canthus interne reste anatomiquement stable, seul l'externe varie |
| Sclère | ✅ | Matériau libre (n'importe quelle teinte), pas seulement blanc |
| Iris — couleur | ✅ | `ColorSource` libre (uni/linéaire/radial), palette procédurale par famille |
| Iris — texture | 🚧 | `fibers` (rayons), `concentric` (anneaux), `spiral`, `petals` implémentés ; `veins`/`mandala` richement décoré = ⏳ |
| Pupille — forme | ✅ | ronde, fente verticale, fente horizontale |
| Pupille — remplissage/contour | ✅ | `fill: ColorSource` (uni/linéaire orientable/radial — même richesse que l'iris/la sclère), 0 à 3 contours concentriques indépendants (couleur/épaisseur/opacité chacun), `visible: boolean` explicite. Volontairement SANS `compileSurface` (une pupille est un trou, pas une surface éclairée). |
| Highlight — forme | ✅ | bibliothèque de motifs : cercle, ellipse, croissant, trapèze, étoile, étincelle (sparkle), croix +, croix x, cœur |
| Cils | ✅ | Vrai moteur paramétrique (`eye-lashes.ts`) : MORPHOLOGIE (épaisseur, longueur, arche réglable en position/largeur/amplitude, angle global, pointe effilée, courbure), FIBRES (dispersion seedée : longueur, épaisseur, orientation, courbure, répartition — chacune un curseur indépendant), APPARENCE (matériau/couleur propre ou hérité, opacité, variation de luminosité par cil, brillance directionnelle). `angle` et `inclinaison` ont été fusionnés en un seul champ (`angleDeg`) — ce sont le même effet, les dupliquer n'aurait rien ajouté. « Rugosité » n'est pas un champ séparé de la brillance (`gloss`) pour la même raison. Pas encore de mélange de PLUSIEURS styles au sein d'un même œil (tous les cils d'un groupe partagent la même morphologie de base, seule la dispersion varie). |
| Sourcil | ✅ | densité, longueur, épaisseur, arche, angle — combinables indépendamment |
| Pli palpébral | ✅ | hauteur, profondeur, ombre portée |
| Pli épicanthique | ✅ | recouvrement du canthus interne, raccord tangent |
| Canthi | ✅ | arrondi interne/externe, caroncule lacrymale colorée |
| Regard 3D | ✅ | rotation sphérique du globe DANS l'orbite (yaw/pitch), raccourcissement physique |
| Rotation 3D de la tête | ✅ | `headTurn: {yawDeg, pitchDeg}` — enveloppe ENTIÈRE (paupières, cils, sourcil, caroncule, pli) compressée en perspective + parallaxe (même physique que le regard, réutilisée), ET rotation 3D réelle de la lumière (ombrage cohérent). Combinable avec le regard — vérifié par test. Limite assumée : pas d'hôte/visage connu, donc pas d'occultation par l'arête du nez à angle marqué. |
| Expressions | ✅ | 13 au total : colère, tristesse, peur, angoisse, mélancolie, lassitude (6 initiales) + étonnement, air maussade, fureur, joie, sourire, regard féroce, stress (7 nouvelles) — fonction pure. « fatigué » fusionné avec lassitude (même effet). « sanglant » interprété comme regard féroce, faute de confirmation du sens voulu — voir `expressions/deltas.ts`. |
| Coordination inter-yeux | ✅ | `eyebrow.pinch` : la tête du sourcil converge (colère) ou diverge (peur) vers/loin du nez ; les deux yeux d'une paire partagent la même expression donc convergent symétriquement ; regard déjà naturellement synchronisé (yaw/pitch non mirroré par outerSide) — vérifié bout-en-bout (position monde réelle des deux sourcils), pas seulement au niveau d'un seul œil |
| États visible/invisible | ✅ | pupille (`pupil.visible`, vrai booléen), highlight secondaire, cils, sourcil, glow — désactivables sans laisser de trace. *Correction* : les entrées précédentes marquaient déjà ceci ✅ pour la pupille ; ce n'était pas exact avant cette session (aucun champ `visible` n'existait sur `Pupil`) — corrigé ici, voir `docs/ERRORS.md` #9. |

## Ancrage / composition de scène

| Fonctionnalité | État |
|---|---|
| Hôte (ellipse / rectangle arrondi) | ✅ |
| Ancres explicites + motifs (ring, line) | ✅ |
| Héritage du matériau de peau | ✅ |
| Coordination inter-yeux sur un hôte | ✅ |
| Hôte posé sur un hôte (imbrication) | ⏳ non exclu par le schéma, non testé |

## Archétypes (10 au total)

| # | Archétype | Type | État |
|---|---|---|---|
| 1 | Œil anime (`eye`, `archetype: null`) | kind de base | ✅ |
| 2 | Réaliste | préréglage de `eye` | ✅ |
| 3 | Reptile | préréglage de `eye` | ✅ |
| 4 | Félin | préréglage de `eye` | ✅ |
| 5 | Poupée | préréglage de `eye` | ✅ |
| 6 | Alien | préréglage de `eye` | ✅ |
| 7 | Démon | préréglage de `eye` | ✅ |
| 8 | Œil de robot (`robot_eye`) | kind à part | ✅ |
| 9 | Œil composé / insecte (`compound_eye`) | kind à part, dôme hexagonal | ✅ |
| 10 | Œil de gemme / cristal (`gem_eye`) | kind à part, facettes de pierre taillée | ✅ |

Les 6 préréglages (2-7) sont des recombinaisons du système EXISTANT (iris, pupille,
sclère, glow, émission) via un nouveau champ `archetype` sur `EyeSpec`, résolu par
une fonction pure (`archetypes/apply.ts`, même mécanique que les expressions) —
pas de nouveau code de rendu. `compound_eye` et `gem_eye` sont de VRAIS nouveaux
`kind`, avec leur propre géométrie et leur propre rendu.

| Autre | État |
|---|---|
| Panneau (preuve de généricité) | ✅ |
| Visage complet (nez, lèvres, oreilles) | ⏳ |

## Architecture du code

| Objectif | État |
|---|---|
| Un fichier = un domaine, ≤ ~200 lignes | ✅ — 58 fichiers, le plus gros fait 199 lignes (voir `docs/ARCHITECTURE.md`) |
| Arborescence par domaine (core/schema/materials/geometry/render/…) | ✅ |
| Chaque ligne commentée | 🚧 — commenté par bloc/fonction, pas systématiquement ligne à ligne |

## Prochaines étapes (non commencées)

- ⏳ Génération aléatoire de visage complet (au-delà d'une paire d'yeux)
- ⏳ Motifs iris supplémentaires : nervures fines ramifiées, mandala composite
- ⏳ Formes décoratives (cœurs, étoiles, étincelles, croix) pour le highlight — la pupille a maintenant remplissage/contours riches, mais reste une ellipse/fente, pas une forme libre
- ⏳ Mélange de PLUSIEURS morphologies de cils au sein d'un même œil (ex. longs et fins au coin externe, courts et denses ailleurs, au lieu d'une seule morphologie dispersée statistiquement)
- ⏳ Nez, lèvres, oreilles comme nouveaux archétypes composables
- ⏳ Documentation ligne-à-ligne systématique (le code actuel est commenté par bloc/fonction, pas par ligne)
- ⏳ Bibliothèques de motifs décoratifs pour l'iris/le highlight/la pupille (cœurs, étoiles, étincelles, croix, croissants, spirales, pétales, nervures)
- ⏳ Cils transformés en éléments décoratifs (filaments, plumes, brins d'herbe)

Voir `docs/CHANGELOG.md` pour l'historique détaillé des sessions et
`docs/ERRORS.md` pour les erreurs rencontrées et leur correction.
