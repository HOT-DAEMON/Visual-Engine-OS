# Moteur de cou — ce qui reste à faire (et les limites connues)

**Mis à jour session 22 : voir `docs/NECK-REMAINING-2.md` (ce qui a été fait, mesuré, et ce qui reste).** Rien ici n'est présenté comme fait. Référence : `docs/TODO-NECK-SYSTEMS.md`, état actuel : `docs/NECK-ENGINE.md`.

## A. Parties du TODO non implémentées

| TODO | État |
|---|---|
| §3 catalogue « plusieurs variantes » par famille | **Partiel (session 22)** : 13 presets (`src/neck/presets.ts`, `docs/NECK-PRESETS.md`), un par cas ; pas de variantes multiples par famille. |
| §4 stratégie « cage / réseau de contrôle » | Non implémentée (retirée du schéma). `chain`, `weighted`, `centerline`, `fields` existent. |
| §7 Famille Surface : `roughness`, `microrelief`, `wrinkle_scale` | **Absents** (retirés du schéma faute d'effet ; `roughness`/`microrelief` réessayés via le moteur de peau partagé, 0,18 % / 0 % de pixels : `NECK-APPEARANCE.md` §6). Seul `skinTension` existe. |
| §7 matériau : réflexion, transmission, matière translucide | Non séparés : la couleur vient de l'apparence du visage, rien d'autre. |
| §7 microtexture (pores, grain, fibres) | Aucune (non traitée en session 22). |
| §7 « placements pilotés par des masques », densité variable par zone | Seul `smoothThroat` (gorge lisse) ; la densité est globale. |
| §7 réponse des éléments à la déformation : changement d'orientation | Les éléments suivent la surface et s'aplatissent par la normale ; ils ne se **réorientent** pas selon la courbure/les mouvements. |
| GEO-04 : fourrure, membranes, nageoires, bijoux, crinière, armure cervicale | **Non faits.** Faits : collier, écharpe, crête, collerette, pointes (rendus simples : bandes plates). |
| GEO-02 : muscles comme volumes ancrés avec épaisseur | **Partiel (session 22)** : les trapèzes sont des volumes de RENDU (aire + dégradé de la loi partagée), les SCM et le platysma restent des tracés ; aucun ne pousse l'enveloppe. |
| GEO-03 : champs de déplacement | Plis et sillons en traits ; pas de déplacement de surface. |
| NECK-01/02 : vertèbres, C1–C2 | Représentés seulement par le rig (3 articulations) et les sections ; visibilité 0, aucun rendu des vertèbres dans la vue de face. |
| NECK-06A : dimorphisme du larynx | **Fait (session 22)** : `body.sex × puberté` → `HeadContext.sex` (visibilité et forme du larynx) ; le cou n'a pas de paramètre de sexe propre ; géométrie inchangée (testé). |
| M09 | Seulement fanon et queue d'écharpe, via `pose.tissueLag` ; plumes, fourrure, bijoux non couverts. Le moteur ne porte pas le temps : une animation doit appeler `secondaryTrack`. Non branché à la planche tournante. |
| §5 BodyLanguageController | Les expressions n'agissent **que sur le cou**. `shoulderRaise` et `gazeLift` sont publiés mais ne sont lus ni par le corps ni par les yeux. |
| §10 critères visuels (beauté de la silhouette, crédibilité de la caricature) | Non automatisables : évaluation sur les planches `artefacts/neck/`. |

## B. Câblage incomplet avec le reste du projet

- **Tête non pivotée** : le visage hôte est dessiné de face. La rotation (`headYawDeg`) est prouvée par la silhouette du modèle (planche 09) et par les tests, pas par un rendu de visage tourné. Conséquence : les expressions (tangage, roulis, translation) sont **peu lisibles de face** sur la planche 04 ; seules compression, étirement, plis et tension se voient nettement.
- **Planche tournante** (`head-turntable/engines/neck3d.ts`) : lit `lm.neck` (largeur, longueur, exagération, compression passent) mais **ses sections (profondeur, centre) viennent du moteur de crâne** : asymétrie, torsion, sablier, espèce, surface ne sont pas rendus en 3D. Le critère « rendu 2D et 3D » n'est donc que partiellement satisfait (testé au niveau du cadre).
- **Profil** (`skull/neck.ts`), **volumes du corps** (`body/volume/neck.ts`) : calculs propres conservés ; l'ancre de base du corps (`anchorFromLandmarks`, dernière section du cou) et les constantes de pose sont partagés. NB : avant la session 21, la SCÈNE utilisait encore `half × (1 + flare)` (cf. §F) ; ce n'est plus le cas.
- **SCM du torse** : doublon retiré (cf. §F). Le torse ne dessine plus de muscles du cou.
- **Générateur aléatoire** : options **opt-in** `neckVariety` (défaut 0) et `neckPreset` (session 22, flux dérivé : le reste du visage ne bouge pas). Par défaut le cou reste neutre : le tirage change `lm.neck` et déplacerait des visages existants (8 tests le prouvent).
- **Contrat** : `FaceNeck.length` max passe de 0,4 à 1,6 (cou de cygne/dragon).

## C. Défauts visuels connus (vus sur les planches)

- Collier et écharpe : bandes plates, sans épaisseur ni plis de tissu.
- Reliefs (larynx, hyoïde, trachée, vaisseaux) petits à l'échelle d'une tête entière ; le gain `GAIN` est un calibrage à l'œil.
- Cou « taureau » : bloc large ; le raccord au torse est partiellement traité (fondu borné, ancre unique, cf. §F) mais pas le reste du raccord (haut plat du torse, ton de la base).
- Plumes : texture fine ressemblant à du poil quand `size` est petit.
- Cou très fin exagéré : tube sans évasement lisible.
- Cou à écailles (dragon, reptile) : peu de volume de lumière visible d'un bord à l'autre, la couleur des éléments étant la base éclairée par la loi partagée (contraste directionnel faible).

## D. Couverture de test et de vérification à compléter

- Pas de mesure de performance du cou (modèle mémoïsé ; ≤ 2 600 éléments de surface).
- La vérification de style ne contrôle que la teinte de la peau et les 3 tons du mode cel ; aucun critère de « beauté ».
- Non-collision accessoire/mâchoire : **faite (session 22)** (`attachment-jaw`) ; pas de test accessoire/épaules.
- La teinte de peau est vérifiée sur le rendu final pour 3 identités seulement (`neck-appearance`), pas pour toutes.
- **Marges de preuve faibles** : `reliefs.clavicle` (0,71 %), `modifiers.age` (0,88 %), `softTissue.dewlap` (1,39 %) pour un seuil de 0,6 %.
- **Torse / apparence** : le corps lit maintenant l'apparence de la peau du visage (`body/tones.ts`). Écart de teinte torse/cou mesuré 8,3° → 7,2° en moyenne (max 26,7° → 24,0°) : faible gain, voir `NECK-REMAINING-2.md` §B.
- Contraste directionnel du cou faible (±3,7/255) : décision de matériau (`skinMaterial`), pas du cou.

## E. Références visuelles

Les 34 références de `references/visual/` (tous les cas std-* et hard-*) montrent toutes un cou : elles ont été **régénérées volontairement** car le contour, l'ombrage et les reliefs ont changé. Avant la régénération, les écarts se concentraient sous le menton (le cou) et sur la ligne du menton (antialiasing contre le contour du cou), pas sur la tête.

## F. Raccord cou ↔ corps (session 21) : traité, mesuré, et ce qui reste

**Traité** — prouvé par `tests/neck-body-junction.test.ts` (4 tests) :

- **Ancre unique.** La scène utilisait `neckAnchor` avec l'ancienne formule `half × (1 + flare)` ; seule `anchorFromFace` lisait le cou. Écart mesuré entre la base du torse et la dernière section du cou : cône (taper 0,9) −28,8 %, massif + trapèzes −8,9 %, compression −8,8 %, défaut 0 %. Désormais `anchorFromLandmarks` (`src/body/anchor.ts`) est la seule formule ; `neckAnchor` et `anchorFromFace` l'appellent.
- **SCM en double.** L'atome `neck.scm` du torse (≈ 700 px du rendu final) dessinait deux coins rigides à l'incisure jugulaire, indifférents à la pose. Retiré de `torso.ts` et de `contracts.ts` ; le moteur de cou (`render/neck/muscles.ts`) en est seul propriétaire.
- **Fondu de la base du cou.** Rectangle de largeur constante qui débordait du cou sur le fond (bord vertical dur). Borné par le contour réel du cou (`BodyRenderOpts.neckContour`), limité à la largeur de la base en dessous. Mesuré : 0 pixel du fondu hors du cou (3 graines × 5 cous) ; contrôle négatif : sans bornage, il déborde.
- `tests/pipeline-body.test.ts` figeait l'ancienne formule comme « référence legacy » : il utilise maintenant la source unique.

**Pas traité (visible sur les rendus, non masqué)** :

- Le fondu converge maintenant vers la couleur de base du cou (`neckTone`, session 22) ; une marche de luminance subsiste entre cou et torse.
- Haut du torse : rétréci et caché dans le cou (session 22) ; la pente d'épaule est quasi rectiligne.
- Trapèzes du cou : volumes de rendu ; la strie verticale venait d'un rectangle droit servant de contour à la lumière de contour (corrigé, `neckEdges`).
- Cou comprimé (`pose.compression` 0,8) : plis en croissants effilés (session 22) ; ancienne ligne sombre mesurée (planche `03`) ; c'est la plus forte marche de luminance mesurée (jusqu'à 8,09 / 255).
- La vérification du rendu final ne couvre que 4 graines, 5 cous et un seul corps (`docs/NECK-JUNCTION-PROOF.md`).
- Une scène avec `neckContour` absent (appel direct de `bodyMarkup`) garde le fondu non borné : c'est un choix d'opt-in, pas une garantie.

**Ajouté en session 21** : couche de vérification du RENDU FINAL du raccord (`src/verify/neck-junction.ts`, 3 couches, pure : elle reçoit le raster) ; options de rendu du corps en source unique (`bodyRenderOpts`, utilisée par la scène et par `verifyPipeline`, qui vérifiait avant un balisage sans `neckContour`). Non branchée à `verifyPipeline` (pas de rastériseur dans `src/`) : elle est appelée par le test et le script d'artefacts.
