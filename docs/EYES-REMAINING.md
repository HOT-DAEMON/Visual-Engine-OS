# Yeux — ce qui reste à faire, par composant

Légende : ✅ fait et testé · 🟡 partiel (précisé) · ⬜ non fait · ❔ existant avant ce chantier, **non audité** dans cette passe.

## 01 Enveloppe palpébrale / 02 Canthi
- ❔ EYE-01A→01K, EYE-02A→02G : géométrie existante (12 styles, pli, caroncule, plica…) non retravaillée ; un audit ligne à ligne contre le TODO reste à faire.
- ✅ (passe 18) Rotation : l'iris et les reflets sont mesurés tels que dessinés et le centre de l'iris suit la matrice locale (`EYES-PASS-18.md` § 1) ; ⬜ 1 cas sur 20 à 60°.
- ✅ Rotation 3D de chaque enveloppe (modèle `sphere`). 🟡 Les cils, le liner et le sourcil dérivent de l'ouverture tournée mais leur épaisseur n'est pas
  recalculée anisotropiquement ; le sourcil n'est pas reprojeté sur la sphère du front.
- ✅ (passe 15 : correction d'un constat périmé) Intégration au visage : `face/pose/eye-pose.ts` passe déjà `headTurn.model = 'sphere'`, l'azimut et `parallax: false` aux yeux des visages en rotation.
- ✅ (passe 15) Reflets : suivent la matrice locale de la projection sphérique comme l'iris (`EYES-PASS-15.md`). La pupille la suivait déjà (constat antérieur faux). 🟡 Matrice locale au centre seulement, pas de reprojection point par point.

## 03 Globe / sclère
- ✅ Humidité naturelle (film lacrymal + ménisque), vaisseaux, chroma, occlusion locale, marques.
- 🟡 (passe 16, `EYES-PASS-16.md` § 2) Cornée opt-in : réfraction réelle par lancer de rayon (03D, OPT-02) et transition cornéosclérale (03F). ⬜ 03C / 03E / 03H non audités, 03G non fait ;
  `appearance.refraction` reste l'effet du moteur partagé. ⬜ OPT-03 diffusion sous-surface.

## 04 Iris
- ✅ Couches de couleur (masques, gradients radial/angulaire, spots, fusion émulée, halo, irrégularité à graine).
- ❔ Régions, collarette, fibres, cryptes, anneaux (EYE-04A→G, J, K, N) : `iris.detail` existant, non audité. ⬜ Relief stromal (04K) réel (normales).
- 🟡 `blend` limité à normal / multiply / screen, **émulés** par pré-mélange avec la couleur dominante (pas de `mix-blend-mode` en SVG whitelisté).
- 🟡 Dégradé angulaire : secteurs de 7,5° ; des traînées radiales fines peuvent apparaître sur les grands iris (augmenter `stepsFor` si besoin).

## 05 Pupille
- ✅ A, C, D, E, F, G (par `light` explicite), H, I, J. ⬜ G : `light` ne suit pas encore l'intensité de la lumière de la scène (à lier à `LightVector.intensity`).
- 🟡 Contours concentriques des profils : traits centrés recouverts par le remplissage — approximation correcte pour opacité 1, pas pour des contours translucides.
- 🟡 Le reflet par défaut (grand disque en haut à gauche) **masque** souvent les pupilles non rondes ; les planches de preuve le réduisent explicitement.
  Correction possible : décaler le reflet primaire hors de la pupille quand `pupil.shape` ≠ ronde.
- ⬜ Mode `fast` du flou de bord (`edge.softness`) : reste un filtre.

## 06 Cils — ✅ (2026-11-15) 10 familles tirées des réfs 12–16, 3 paramètres ajoutés (`bendDeg`, `rootFuse`, `span`), vérification dédiée : voir `EYES-LASHES.md` et `EYES-LASHES-VERIFY.md`. Reste à faire : fin de `EYES-LASHES.md` (écart visuel aplats/dégradés, mèches sur l'iris, cils non adaptés aux yeux très inclinés).

## 07 Microanatomie
- ✅ A, B, C, F, H + LOD + (passe 16) E irrégularité des bords palpébraux. ⬜ D microrelief cutané (pores, normales), G petits plis des canthi.
- ✅ (passe 16) LOD automatique : `lod.eyePixels: null` est dérivé de la largeur × échelle monde × `pixelRatio`. 🟡 Ni les cils ni le raccourcissement par `headTurn` n'y participent.

## 08 Expression / 09 Extensions non humaines
- ❔ Expression (`expressions/`) non retouchée ; ⬜ le système de matériaux unifié de la §4 (contrat commun sclère/iris/pupille/cornée/paupières/bord lacrymal/cils/
  extensions) n'est pas créé : les matériaux existants (`ColorSource` + `MaterialRef`) et le moteur d'apparence sont réutilisés, sans nouveau contrat.
- ⬜ Cornée translucide, sclère sombre minérale, œil artificiel : réalisables avec `iris.layers` + `appearance.emission`, non présentés dans les artefacts.

## Vérification (`verifyEye`)
- ✅ (2026-11-14) Paire d'yeux rattachée à `checkFaceEngine` : `src/verify/eye-pair.ts` (6 contrôles : coins externes opposés, roulis commun, asymétrie d'échelle, hauteur, identité commune). 🟡 (passe 19) Le FINI des yeux est accordé au style de la tête (`eyeFinish`, règle `eyes-finish-matches-head`, 10 contrôles) ; ⬜ pas de cohérence de
  TEINTE avec la palette cel de la tête ; `style` mesure le poids/filtres/contraste, pas une adéquation à un style cible nommé.
- 🟡 Contrôles anatomiques paramétrés pour des yeux humains : les styles stylisés produisent des avertissements, jamais des erreurs (choix volontaire).

## Performance
- 🟡 Voir `EYES-PERF.md` : filtres opt-in restants (glow d'iris, douceur de reflet, bord de pupille, effets d'apparence).
- ⬜ Cache de compilation non utilisé par `verifyEye`.

## Passes 1 à 13 (références mesurées, cils, iris, galeries) — voir `EYES-REMAINING-2.md`
Archive déplacée telle quelle ; ses points ouverts encore valables sont repris, composant par composant, dans les sections 01 à 09 ci-dessus et dans les passes 14 à 18 ci-dessous.

## Passe 14 (détail : `EYES-PASS-14.md`)
- **Fait** : flous de reflets partagés (ice 18 → 12 filtres), règle `pupil-darker-than-iris` unifiée avec les pixels (`pupilOccludedByStar` ; 30 → 0 avertissement), emerald recalée sur la réf. 07 (part sombre 0,167 → 0,104 ; cellules 50 → 97 pour 105 ; petite pupille à fin halo), test d'identité 300 de `eye-gallery-ext3` réparé (empreinte de tirage vérifiée identique à la passe 10).
- **emerald (07) — non fait** : bulles trop grandes et uniformes, cerclées de sombre (la réf. a des grappes de tailles variées, sans cercle) ; facettes triangulaires étroites et grain turquoise du haut de l'iris ; fentes 16 pour 6 ; luminance 136 pour 129 (en hausse) ; première étoile 0,84 R pour 0,58 ; dérive des fentes 6,9 pour 3,6 °/ρ.
- **`svg-weight`** : 44 yeux sur 100 de la galerie 4 dépassent 140 ko (max 233 ko), de 850 à 1 050 tracés d'iris (facettes, cellules). Mesuré : le temps de rastérisation corrèle à 0,69 avec le nombre de filtres et à 0,39 avec les ko ; médiane 237 ms (lourds) contre 185 ms (légers). Le seuil de 140 ko est un mauvais proxy du coût : à remplacer par une règle composite (filtres, tracés, ko), non fait.
- **Partage de filtres sans gain de temps** : resvg applique le filtre à chaque élément ; pour gagner du temps il faut moins d'éclats flous (`softness`) ou un flou appliqué à un groupe d'éclats, non fait.
- **✅ LOD automatique (résolu en passe 16)** (07) : `lod.eyePixels` n'est calculé nulle part. Il faudrait ajouter l'échelle en pixels de la scène à `CompileCtx` (aujourd'hui : lumière, hôtes, orbites, yeux, sexe du corps) et la composer avec `transform.scale` de l'œil posé ; `null` valant pleine précision, tout œil petit changerait de rendu : les empreintes de non-régression des visages seraient à régénérer. Non touché.
- **⬜ Non retouchés** (inchangés depuis les passes 11–13) : intégration `headTurn.model = 'sphere'` dans `FaceParams`, reflets et pupille non déformés par la projection sphérique, cornée / réfraction réelle, microrelief cutané, bords palpébraux irréguliers, fire (part sombre 0,316 pour 0,373) et ice (fentes 2 pour 4), facettes taillées de 07 fidèles, braises et anneau de 10a, galerie 4 « nouvelles enveloppes » (`circle` / `diamond`, plafond d'aspect 0,8), `svg-weight`.
- **Vérifié** : suite complète sur l'état fusionné avec la branche (221 fichiers) : 4 004 tests verts, 1 échec : `tests/nose-visibility.test.ts` « garde-fou du pivot » (hash d'une tête complète `1401677…` pour `995eb7f…`), **préexistant** : identique sur la branche distante seule (`662e1e7`, passe 5 des oreilles) et avec l'ancien rendu des reflets ; hash non recalé ici, à recaler par la session des oreilles.

## Passe 15 (détail : `EYES-PASS-15.md`)
- ✅ Reflets sous rotation sphérique (preuve en pixels, 3 cas échouaient avant) ; ✅ `svg-weight` remplacé par `svg-cost` (coût mesuré : filtres, ko) ; galerie 4 : 0 avertissement.
- 🟡 `svg-cost` : R² 0,45, ms propres à la machine de calibration, plafond 120 ms non rattaché à un budget de frame ; `filter-budget` (14) inchangé.
- ⬜ Pas de règle `verifyEye` sur les reflets sous rotation (tautologique en géométrie) ; contrôle en pixels seulement, hors `verifyFace`.
- ⬜ **Non touchés** (inchangés depuis la passe 14 ; LOD automatique et braises de 10a traités en passe 16) : emerald (bulles, facettes triangulaires, fentes 16 pour 6, première étoile 0,84 R pour 0,58) ; fire (part sombre 0,316 pour 0,373), ice (fentes 2 pour 4) ; anneau de 10a (facettes et braises : passe 16) ; galerie 4 (`circle` / `diamond`, plafond d'aspect 0,8) ; microrelief cutané (07) ; teinte de style cel de la paire d'yeux.
- ⬜ `scripts/artefacts-eyes-pass14.ts` compte encore l'identifiant `svg-weight` (supprimé) : ses compteurs de cette règle restent à 0.

## Passe 16 (détail : `EYES-PASS-16.md`)
- ✅ LOD automatique (iris, microdétails, `verifyEye`) · ✅ bords palpébraux irréguliers (`microdetail.edge`) · 🟡 cornée (`cornea` : réfraction, halo) · ✅ atomes `shard`, `dust`, `sizeSpread`, `rim`, braises `lance` / `scatter` (tous opt-in).
- ✅ fire : part sombre 0,316 → 0,360 (réf. 0,373). 🟡 emerald : bulles variées et éclats, **métriques maintenues, non améliorées** (part sombre 0,104 → 0,080 pour 0,101 ; étoiles 0,343 pour 0,312 ; luminance 136 pour 129). `rim` 0,65 imposé par le détecteur d'étoiles.
- ⬜ ice (fentes 2 pour 4) · ⬜ emerald : fentes 16 pour 6, première étoile 0,84 R pour 0,58, 54 cellules pour 105, poussière peu visible · ⬜ fire : anneau 10a en halo large avec rayons.
- ⬜ Cornée : fibres historiques et cellules non réfractées ; mesure de pupille en pixels inutilisable sur pupille claire (feu : 0 px) ; haze discret à l'écran ; `cornea` sans effet sur les reflets (voulu).
- ✅ (passe 17) Bords : cils, pli et caroncule suivent le tracé perturbé. ✅ (passe 17) Poids SVG remesuré : voir `EYES-PASS-17.md` §5.
- Vérifié : tous les tests `*eye*` + 30 autres fichiers ; 1 échec préexistant (`nose-visibility`) ; suite complète de 233 fichiers **non exécutée**.

## Passe 17 (détail : `EYES-PASS-17.md`)
- ✅ Bord irrégulier suivi par cils, pli (×0,6), caroncule, ligne humide, liseré et ombre des paupières (`eyeEdges` source unique) · ✅ LOD des cils (couverture d'encre conservée) · ✅ LOD sensible à la rotation de tête (`apparentWidthRatio`, modèle `sphere`).
- ✅ EYE-07G `microdetail.canthusLines` (4 paramètres, preuve en pixels, fini flat conservé) · ✅ paire d'yeux : fini, présence et force des microdétails (6 → 9 contrôles) · ✅ outils d'artefacts mutualisés.
- ⬜ Rotation : `iris-meets-opening` et `highlights-confined` échouent à lacet 60° + azimut 22° (préexistant, vérifié sur la passe 16) ; LOD du modèle `flat` de rotation non traité.
- ⬜ Plis des canthi : pas de pli de la paupière inférieure ni de lien avec l'âge ou l'expression ; teinte propre à la peau seulement (pas de cohérence mesurée avec le style cel de la tête).
- ⬜ Reste de la passe 16 inchangé : emerald (fentes, première étoile, cellules), ice (fentes 2 pour 4), fire (anneau 10a), cornée (fibres non réfractées, pupille claire non mesurable), microrelief cutané ; tête de graine 23 à 25° : 16 Mo de SVG, à expliquer.
- Vérifié : suite complète exécutée fichier par fichier (46 fichiers yeux / cils / liner + 190 autres) ; 1 échec préexistant (`nose-visibility`, hash `e27bacc…` identique sur le code de la passe 16). Plis de canthus : invisibles sur une tête entière (œil < 70 px → LOD), lisibles en gros plan.

## Passe 18 (détail : `EYES-PASS-18.md`)
- ✅ `iris-meets-opening` et `highlights-confined` à lacet 60° / azimut +22° : cause A = vérification qui mesurait l'iris non comprimé (`applyTurnAbout`, `turnedHalfExtents`, partagés avec le rendu) ; cause B = centre d'iris qui ignorait la matrice (`irisCenter(eye, g, jac)`). 9 yeux sur 20 à iris < 0,2 → 0 ; centre hors de l'ouverture 2 → 1. Preuves : `artefacts/eyes-pass18/`.
- ✅ Cause des 16 Mo (tête de graine 23 à 25°) : cheveux (`densify` à 0,002 W sur les mèches posées + clip de reflet de 166 528 segments), pas les yeux ; la tête chauve pèse 0,75 Mo. ⬜ Non corrigé (moteur de cheveux, tests à empreintes) ; piste dans `EYES-PASS-18.md` § 3.
- ✅ Plis des canthi sur une tête : LOD mesuré (`fine` 0 / 0,35 / 1 à 40 / 120 / 245 px) ; ⬜ restent discrets même à 245 px, pas de réglage d'opacité par taille.
- ⬜ Rotation : 1 cas sur 20 à 60° (almond très haut + regard baissé, hypothèse de cisaillement non mesurée) ; `gazeT` absent de la mesure de l'iris ; cils et liner non recalculés anisotropiquement ; LOD du modèle `flat`.
- ⬜ Inchangés depuis les passes 16–17 (non touchés ici) : emerald (fentes, première étoile, cellules), ice (fentes 2 pour 4), fire (anneau 10a), cornée (fibres non réfractées), microrelief cutané (07D), cohérence de teinte avec le style cel de la tête, ⬜ suite complète du dépôt et `npm run regress` non exécutés.

## Passe 19 (détail : `EYES-PASS-19.md`)
- ✅ `faceIsCel` (définition unique), `RandomFaceOptions.eyeFinish` (`auto` accorde tête et yeux dans les deux sens, opt-in, visages par défaut identiques à l'octet), règle `eyes-finish-matches-head` (avertissement) ; mesure : 14 têtes lisses à yeux d'encre sur 120 visages des galeries étendues sans `auto`, 0 avec ; correction de `eyes-same-finish` (valeur par défaut `'painted'` hors énumération).
- ⬜ La tête cel n'est pas plate : grain de peau (`texture: grain`), blush et cheveux gardent leurs dégradés ; le terminateur d'ombre dur et les ovales de reflet plats de la peau cel rendent la tête « cel » obtenue par `auto` sur les yeux d'encre PAS meilleure à l'œil (planche 02). Chantier du moteur de peau, non touché.
- ⬜ Iris `flat` sans détail : limbe, ombre de paupière sur l'iris et bord dentelé de la réf. 01 ne sont pas recomposés en aplats.
- ⬜ Inchangés depuis la passe 18 (non touchés ici) : rotation (1 cas sur 20 à 60°, cils et liner non recalculés anisotropiquement, LOD du modèle `flat`), emerald / ice / fire, cornée (fibres non réfractées), microrelief cutané (07D : à reconsidérer, le style cel des références n'en a pas), enveloppes non auditées (01/02), 16 Mo de cheveux (hors yeux).
- Vérifié : 13 fichiers de tests liés (133 tests) + 23 fichiers `eye-*` verts ; `npm run regress` EXIT 0 (4 cas « close » préexistants, identiques sur l'ancien code). ⬜ Suite complète (250 fichiers) **non exécutée** ; `eye-gallery-ext4` non rejoué.
