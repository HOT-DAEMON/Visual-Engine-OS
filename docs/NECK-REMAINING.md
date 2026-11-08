# Moteur de cou — ce qui reste à faire (et les limites connues)

Rien ici n'est présenté comme fait. Référence : `docs/TODO-NECK-SYSTEMS.md`, état actuel : `docs/NECK-ENGINE.md`.

## A. Parties du TODO non implémentées

| TODO | État |
|---|---|
| §3 catalogue « plusieurs variantes » par famille | **Pas de bibliothèque de préréglages** (`presets`) : les morphologies s'obtiennent en combinant les paramètres (planche 01). |
| §4 stratégie « cage / réseau de contrôle » | Non implémentée (retirée du schéma). `chain`, `weighted`, `centerline`, `fields` existent. |
| §7 Famille Surface : `roughness`, `microrelief`, `wrinkle_scale` | **Absents** (retirés du schéma faute d'effet ; `roughness`/`microrelief` réessayés via le moteur de peau partagé, 0,18 % / 0 % de pixels : `NECK-APPEARANCE.md` §6). Seul `skinTension` existe. |
| §7 matériau : réflexion, transmission, matière translucide | Non séparés : la couleur vient de l'apparence du visage, rien d'autre. |
| §7 microtexture (pores, grain, fibres) | Aucune. |
| §7 « placements pilotés par des masques », densité variable par zone | Seul `smoothThroat` (gorge lisse) ; la densité est globale. |
| §7 réponse des éléments à la déformation : changement d'orientation | Les éléments suivent la surface et s'aplatissent par la normale ; ils ne se **réorientent** pas selon la courbure/les mouvements. |
| GEO-04 : fourrure, membranes, nageoires, bijoux, crinière, armure cervicale | **Non faits.** Faits : collier, écharpe, crête, collerette, pointes (rendus simples : bandes plates). |
| GEO-02 : muscles comme volumes ancrés avec épaisseur | Les SCM, trapèzes et platysma sont des **tracés** (reflet + creux) posés sur la surface, pas des volumes qui poussent l'enveloppe. Les trapèzes agissent aussi sur la pente nuque-épaule. |
| GEO-03 : champs de déplacement | Plis et sillons en traits ; pas de déplacement de surface. |
| NECK-01/02 : vertèbres, C1–C2 | Représentés seulement par le rig (3 articulations) et les sections ; visibilité 0, aucun rendu des vertèbres dans la vue de face. |
| NECK-06A : dimorphisme du larynx | Pas de paramètre de sexe dans le cou (pas de doublon avec le corps) ; le branchement `body.sex → cou` n'est pas fait. |
| M09 | Seulement fanon et queue d'écharpe, via `pose.tissueLag` ; plumes, fourrure, bijoux non couverts. Le moteur ne porte pas le temps : une animation doit appeler `secondaryTrack`. Non branché à la planche tournante. |
| §5 BodyLanguageController | Les expressions n'agissent **que sur le cou**. `shoulderRaise` et `gazeLift` sont publiés mais ne sont lus ni par le corps ni par les yeux. |
| §10 critères visuels (beauté de la silhouette, crédibilité de la caricature) | Non automatisables : évaluation sur les planches `artefacts/neck/`. |

## B. Câblage incomplet avec le reste du projet

- **Tête non pivotée** : le visage hôte est dessiné de face. La rotation (`headYawDeg`) est prouvée par la silhouette du modèle (planche 09) et par les tests, pas par un rendu de visage tourné. Conséquence : les expressions (tangage, roulis, translation) sont **peu lisibles de face** sur la planche 04 ; seules compression, étirement, plis et tension se voient nettement.
- **Planche tournante** (`head-turntable/engines/neck3d.ts`) : lit `lm.neck` (largeur, longueur, exagération, compression passent) mais **ses sections (profondeur, centre) viennent du moteur de crâne** : asymétrie, torsion, sablier, espèce, surface ne sont pas rendus en 3D. Le critère « rendu 2D et 3D » n'est donc que partiellement satisfait (testé au niveau du cadre).
- **Profil** (`skull/neck.ts`), **volumes du corps** (`body/volume/neck.ts`) : calculs propres conservés ; seuls l'ancre de base (`body/anchor.ts`, désormais la dernière section du cou) et les constantes de pose sont partagés.
- **Doublon restant** : le torse du corps porte encore ses propres SCM (`neck.scm`, enveloppe d'insertion). À réconcilier avec ceux du moteur de cou.
- **Générateur aléatoire** : `generateRandomFace` ne tire pas `neck.system` (cou neutre) ; aucune variété de cou issue de la génération. Choix délibéré pour ne pas déplacer les graines existantes.
- **Contrat** : `FaceNeck.length` max passe de 0,4 à 1,6 (cou de cygne/dragon).

## C. Défauts visuels connus (vus sur les planches)

- Collier et écharpe : bandes plates, sans épaisseur ni plis de tissu.
- Reliefs (larynx, hyoïde, trachée, vaisseaux) petits à l'échelle d'une tête entière ; le gain `GAIN` est un calibrage à l'œil.
- Cou « taureau » : bloc large, raccord au torse non traité (le corps n'est pas dessiné sur les planches).
- Plumes : texture fine ressemblant à du poil quand `size` est petit.
- Cou très fin exagéré : tube sans évasement lisible.
- Cou à écailles (dragon, reptile) : peu de volume de lumière visible d'un bord à l'autre, la couleur des éléments étant la base éclairée par la loi partagée (contraste directionnel faible).

## D. Couverture de test et de vérification à compléter

- Pas de mesure de performance du cou (modèle mémoïsé ; ≤ 2 600 éléments de surface).
- La vérification de style ne contrôle que la teinte de la peau et les 3 tons du mode cel ; aucun critère de « beauté ».
- Pas de test de non-collision entre un accessoire et la mâchoire/les épaules (seulement entre accessoires).
- La teinte de peau est vérifiée sur le rendu final pour 3 identités seulement (`neck-appearance`), pas pour toutes.
- **Marges de preuve faibles** : `reliefs.clavicle` (0,71 %), `modifiers.age` (0,88 %), `softTissue.dewlap` (1,39 %) pour un seuil de 0,6 %.
- **Torse hors moteur d'apparence** : `body/volume/shade.ts` garde sa palette (écart de teinte jusqu'à 11° avec le cou) ; unifier le corps reste à faire.
- Contraste directionnel du cou faible (±3,7/255) : décision de matériau (`skinMaterial`), pas du cou.

## E. Références visuelles

Les 34 références de `references/visual/` (tous les cas std-* et hard-*) montrent toutes un cou : elles ont été **régénérées volontairement** car le contour, l'ombrage et les reliefs ont changé. Avant la régénération, les écarts se concentraient sous le menton (le cou) et sur la ligne du menton (antialiasing contre le contour du cou), pas sur la tête.
