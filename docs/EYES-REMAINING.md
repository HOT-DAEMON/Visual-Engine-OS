# Yeux — ce qui reste à faire, par composant

Légende : ✅ fait et testé · 🟡 partiel (précisé) · ⬜ non fait · ❔ existant avant ce chantier, **non audité** dans cette passe.

## 01 Enveloppe palpébrale / 02 Canthi
- ❔ EYE-01A→01K, EYE-02A→02G : géométrie existante (12 styles, pli, caroncule, plica…) non retravaillée ; un audit ligne à ligne contre le TODO reste à faire.
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
- ✅ (2026-11-14) Paire d'yeux rattachée à `checkFaceEngine` : `src/verify/eye-pair.ts` (6 contrôles : coins externes opposés, roulis commun, asymétrie d'échelle, hauteur, identité commune). ⬜ Pas de cohérence de
  teinte avec le style cel de la tête ; `style` mesure le poids/filtres/contraste, pas une adéquation à un style cible nommé.
- 🟡 Contrôles anatomiques paramétrés pour des yeux humains : les styles stylisés produisent des avertissements, jamais des erreurs (choix volontaire).

## Performance
- 🟡 Voir `EYES-PERF.md` : filtres opt-in restants (glow d'iris, douceur de reflet, bord de pupille, effets d'apparence).
- ⬜ Cache de compilation non utilisé par `verifyEye`.

## Passe « références mesurées » (2026-11-13) — voir `EYES-REFS.md` : fait, pour mémoire
5 yeux mesurés (04, 07, 11, 10a, 10b), almond recalé, 100 formes, vérification enveloppe + pixels, 31 paramètres prouvés.

## Passe « EYES-REFS-2 » (2026-11-14) — voir `EYES-REFS-2.md` (détail, mesures, preuves)
Fait : silhouettes des réfs 13, 15, 17 ajustées en recettes ; 100 formes incluant 7 formes mesurées ; looks naturel / sprite / encre reversés au moteur ;
facettes et bulles d'iris ; `eyeSource: 'extended'` dans `generateRandomFace` (148 identités) ; paire d'yeux vérifiée ; almond passe 2.
Reste à faire (chaque point est détaillé dans `EYES-REFS-2.md`, § « Reste à faire ») :
- ⬜ Réf. 14 : silhouettes et iris non mesurés (sclère blanche sur fond blanc, flèches mesurées mais non interprétées) ; réf. 15 rangées 3–5 : iris non mesurés (limbe non détecté).
- ⬜ Réf. 13 E1–E4, E6–E9, E11, E12 et 17 (≈ 8 yeux) : canthus externe sous une masse de cils ou yeux coupés par la tuile ; non tracés.
- ✅ Almond passe 3 : contrôle d'angle du canthus interne exposé (`u1dx`, `u1dy` dans `EnvelopeRefFactors`), 8 facteurs ajustés (`scripts/eye-refs/fit-almond.ts`) : interne 93,66° (mesuré 93,67°), externe 118,99° (mesuré 119,0°) ; erreur de profil 0,022 → 0,026 (haut), 0,041 → 0,043 (bas). `tiltDeg` par défaut 6° inchangé. Références visuelles et empreinte first-eye régénérées (rms 0,7 à 5,2, limité aux yeux).
- 🟡 Facettes : lisibles mais discrètes ; pas de dispersion prismatique, pas de rayons de lumière, pas de cils dorés ; bulles sans réfraction du fond.
- 🟡 Galerie : distance minimale 0,0089 entre silhouettes (seuil du test abaissé de 0,009 à 0,008) ; les sprites hauts (15-A, 15-B) débordent de la cellule des planches.
- 🟡 Look « encre » : teintes grises et reflets en lentille interprétés (non mesurés) ; peau périoculaire mesurée seulement sur 5 photos.
- ⬜ Seuils d'enveloppe issus de 3 yeux de face ; `verify-eye-render.ts` (pixels) toujours dans `scripts/`, non appelé par `verifyFace`.


## Cils (réfs 12–16) — voir docs/EYES-LASHES.md et EYES-LASHES-VERIFY.md (2026-11-15)
Fait : orientation externe par construction (miroir / ancres), 66 yeux mesurés dont réfs 14 et 15, familles de cils non intégrées -> `generateRandomFace({ lashFamily })`, 10 familles, couche de vérification dédiée, planche 04 recadrée.
- 🟡 Réf. 14 : cils (traits) mesurés ; **silhouette et iris toujours non mesurés** ; flèches non interprétées au-delà de la famille `trainants`.
- 🟡 Réf. 15 : traits de cils mesurés (10 yeux) ; **limbe des rangées 3 à 5 toujours non détecté** (pas d'iris).
- ⬜ Réfs 13 et 17 : yeux non tracés (≈ 8) ; 13 mesurée avec la détection d'origine (12 yeux), 17 non touchée dans cette passe.
- ⬜ Facettes d'iris : dispersion prismatique et rayons de lumière, distance minimale de la galerie (0,0089), almond : non retouchés dans cette passe.
- ⬜ Pixel : `verify-eye-render.ts` sans règle cils ; ⬜ cils non adaptés à l'inclinaison de l'ouverture (4 cas / 174).


## Passe 4 (2026-11-15) — voir `EYES-PASS-4.md`
Fait : liner épais effilé par famille de cils (`lids.liner`), dégagement de l'ouverture (848 -> 24 intrusions sur 19 021 cils), portée dans la zone du dessin, vérification alignée, facettes d'iris avec `dispersion` et `rays` (branchées sur `prism`, `frost`).
- 🟡 Cils : 24 cas non dégagés par la rotation ≤ 50° ; liner et épaisseurs interprétés (non mesurés) ; encre = noir bleuté des cils, pas l'aplat `#000` des références.
- 🟡 Facettes : dispersion et rayons présents mais valeurs interprétées ; pas de faisceau volumétrique réel.
- ⬜ Inchangé : yeux non tracés des réfs 13/17, réf. 14, limbe réf. 15 rangées 3–5, distance minimale de la galerie, règle « cils » en pixels.

## Passe 5 (audit des cils) — état par composant (détails : `EYES-PASS-5.md`)
- ✅ Cils : encre mesurée (`#040404`), contrat `ink: family | keep`, 0 cil sur l'ouverture (19 021), règle « cils » sur les pixels (géométrie / anatomie / style), corpus tracé (empreinte, sources, exclusions).
- ✅ Extracteur : bug d'angles non ramenés à ±180° corrigé (54 traits sur 437) ; mesures régénérées.
- 🟡 Galerie des 100 : distance minimale 0,0201 ; quotas adaptatifs (diamond 4, diamond_v2 5). ⬜ Almond et formes des 100 **non retravaillés** (seule la distinction l'a été).
- 🟡 Iris colorés (réfs 14, 15 rangées 3–5) : 7 mesures fiables, 5 ambiguës (14-00, 14-02, 14-04, 15-06, 15-07) ; **non branchées au moteur** (plafond de hauteur/largeur : moteur 1,22 contre références 1,33).
- ⬜ Réf. 17 (détecteur de cellules à écrire) · ⬜ 8 yeux de la réf. 13 non tracés · ❌ silhouette de la réf. 14 : non mesurable (sclère blanche sur fond blanc, paupière basse ouverte).
- ⬜ Épaisseur du liner et dispersion des cils : encore **interprétées** (à mesurer en pixels) · ⬜ variation bornée entre les deux yeux · ⬜ familles dans `random-eye`.

## Passe 6 — voir `EYES-REFS-3.md`
- ✅ Réf. 17 : détecteur de cellules (motif périodique de 477 px reconstruit, 15 cellules annotées) ; 9 yeux tracés (`17-P*`).
- ✅ Réf. 13 : 9 des yeux non tracés le sont maintenant (`13-R*`) ; ⬜ 13-R3C3 (sphère sans paupière) volontairement non tracé.
- ✅ 27 recettes ajustées, 24 places mesurées dans la galerie des 100 (distance minimale 0,0208) ; tests yeux verts.
- 🟡 Ancres lues à ≈ 2 px près ; RMS élevé pour 17-P07 (0,078), 17-P08 (0,077) ; P09 ambiguë (aile et iris mêlés).
- ⬜ Almond et les 100 formes : toujours **non retravaillés** (boucle « jusqu'à parfait » non faite) ; ⬜ look « encre » en aplats noirs francs ; ⬜ réf. 14 ; ⬜ limbe réf. 15 rangées 3–5 ; ⬜ facettes d'iris (dispersion, rayons) ; ⬜ liner et dispersion à mesurer.


## Passe 7 — voir `EYES-REFS-4.md` (almond en unités de largeur)
- ✅ Almond réajusté : contrat de hauteur (écart 0,0171 → 0,0003), RMS haut 0,0208 → 0,0149 ; 2 règles d'enveloppe ajoutées (`envelope-height-contract`, `canthus-opening-angle-*`), prouvées sur l'ancien défaut. Galerie : flux par style, losanges élargis (`diamond` 3 → 5), `fitLashesToZone` 10 → 40 tours.
- 🟡 RMS de la paupière basse inchangé (0,0230 → 0,0235) : épaule interne non reproduite, sommets non exposés (0,46–0,62 selon les références).
- ⬜ `sharp` et `drooping` : −27 % de hauteur par rapport à la demande (défaut préexistant, borné par un test). ⬜ Dôme pâle au-dessus du trait pour `upperFraction` = 0,40.
- ⬜ Toujours ouverts : look « encre » en aplats noirs francs · 17-P07, P08, P09 · réf. 14 · limbe réf. 15 rangées 3–5 · facettes d'iris (dispersion) · épaisseur du liner et dispersion à mesurer · 11 autres enveloppes non reprises une à une.

## Passe 8 — voir `EYES-PASS-8.md` (encre en aplats, contrat de hauteur)
- ✅ Look « encre » en aplats francs : `EyeSpec.finish: 'flat'`, encres mesurées (réf. 17 `#3f363b`, réf. 13 `#000000`), règle pixel `ink-flat` ; `toneShare` ≤ 0,02 sur les 20 yeux d'encre (0,000 sur les 4 de l'artefact 01).
- ✅ `sharp` / `drooping` : contrat de hauteur (−25 % / −26 % → ≤ 1,6 %), règle étendue, refit de 12 recettes sur 27, appariement d'échelle des deux yeux (`PAIR_SCALE_MAX`).
- 🟡 17-P01 (0,0876) et 15-B (0,0846) au-dessus de 0,08 · 🟡 17-P07 (0,0782) et 17-P08 (0,0767) : ancres déjà sur l'ouverture réelle, l'écart vient de la mesure ; P08 non revu · ✅ 17-P09 (0,0181 après refit, non retracé).
- 🟡 Dôme pâle à `upperFraction` = 0,40 : non reproduit avec certitude ; piste = arête nette de l'ombre de paupière sur la sclère (`soft-shadow.ts`, `sharp` à 0,40). Non corrigé.
- ⬜ `angular` −22 %, `triangle` −26 %, `chibi` −12 %, `diamond` −16 %, `round` +32 % de hauteur · ⬜ 17 combinaisons œil × famille de cils en échec (24 avant).
- ⬜ Toujours ouverts : réf. 14 · limbe réf. 15 rangées 3–5 · facettes d'iris · épaisseur du liner et dispersion à mesurer · 11 autres enveloppes une à une · profil bas (0,0235) · 100 formes supplémentaires
  (enveloppes 12, 13, 14, 15, 16, 17) · `finish` non relié au rendu de visage `ink` ni à `random-eye` · ton clair de l'iris 13 : interprétation (3 iris mesurés).


## Passe 9 (détail : `EYES-PASS-9.md`)
- ✅ Iris des réfs 03 / 05 / 06 / 09 mesurés pixel par pixel (`extract_iris_photos.py`) ; 4 familles d'iris additives (`eye-iris-families-photo.ts`), constantes testées contre le JSON ; plancher `pupil.size` 0,12 → 0,08.
- ✅ Seconde galerie : 100 yeux de plus (`eye-gallery-ext2.ts`, distance min 0,0129 aux 148 existants), `eyeSource: 'extended2'` (248 identités) ; 0 erreur `verifyEye`, 0 échec pixel.
- ✅ Règles d'iris : `pupil-core-centred` (géométrie), `specular-in-upper-iris` (anatomie), `iris-texture` (style ; voile gris 3,3 < 8 ≤ familles 11,9–21,8).
- 🟡 Almond : validé hors échantillon sur 03 / 05 (haut 0,033 / 0,018 ; bas 0,051 / 0,058 contre 0,013–0,033 en entraînement), `ALMOND_REF` inchangé. ✅ Paramètre `lowerPeak` exposé en passe 10 (`EYES-PASS-10.md` § 6) ; ⬜ pas encore branché dans les galeries / visages.
- 🟡 Texture d'iris moteur 12–22 contre 22–42 sur les références : couleurs et proportions atteintes, filigranes fins non. ✅ Réfs 04, 07, 08, 10 mesurées en passe 10 ; ⬜ 10a : limbe et pupille non mesurables ; aspect de pupille de 05 / 09 et limbe de 05 non fiables ; canthus externe de 03 incertain.

## Passe 10 (détail : `EYES-PASS-10.md`)
- ✅ Correction de la mesure de limbe de la passe 9 (axes de `fitEllipse` permutés pour 05 / 06 / 09 : aspect 1,10 → 0,929 pour 06) ; constantes des 4 familles régénérées.
- ✅ Contrat de hauteur des yeux GAUCHES (`apexHeights`, `openingProfile`) : sharp / drooping étaient ~24 % trop bas à gauche ; `anatomy-contract` 14 → 17 yeux hors orbite a priori (bornes inchangées).
- ✅ 5 familles d'iris additives (04, 07, 08, 10a, 10b, `eye-iris-families-photo2.ts`) avec matériau de base remplaçable ; luminance à ± 25 des références.
- ✅ Galerie 3 : 100 yeux de plus (`eye-gallery-ext3.ts`, distance min 0,0096), `eyeSource: 'extended3'` (348 identités) ; 0 erreur `verifyEye`, 0 échec pixel.
- ✅ Almond : `shape.lowerPeak` exposé et prouvé (erreur du profil bas 0,0358 → 0,0213, 05 hors échantillon 0,058 → 0,019).
- ⬜ Saturation des pics d'iris (0,41–0,65 contre 0,72–0,79), part sombre de `ice-star`, prisme de 04, bulles de 07, six pointes de 10b.
- ⬜ Brancher `lowerPeak` dans les galeries et `generateRandomFace` ; galerie 4 = nouvelles enveloppes (réfs 13 / 17), l'espace actuel est saturé.

## Passe 11 (détail : `EYES-PASS-11.md`)
- ✅ Saturation des pics d'iris (`iris.vibrance`, calibrée sur les 5 références) ; prisme arc-en-ciel de 04 ; bulles nettes de 07 ; six étoiles de 10b ; `lowerPeak` branché (galerie 4, `eyeLowerPeak`) ; galerie 4 : 100 yeux, enveloppes issues des réfs 13 / 17.
- ⬜ **04 Iris — détail atomique** : fentes radiales sombres de 04, facettes taillées de 07 (les nôtres sont régulières), étoiles de 10b trop petites (taille 0,1 réglée à l'œil ; la référence en montre de bien plus grandes : non mesuré), anneau et braises de 10a ; haut de l'iris du prisme olive (référence turquoise).
- ⬜ **04 Iris — part sombre** (`darkShare`) : prism 0,033 (réf. 0,154), emerald 0,012 (0,101), ice 0,196 (0,297), fire 0,32 (0,373) ; lumMean de lime 156 (169), fire 73 (89), ice 90 (103).
- ⬜ `fire-halo` : vibrance 0,96, plus aucune marge ; saturer d'abord la couche d'anneau.
- ⬜ **Galerie 4** : `almond` repose sur 7 ancres sans rondeur de canthus mesurée (tirage large) ; pas de `circle` ni de `diamond` (aucune silhouette 13 / 17) ; plafond d'aspect 0,8 (au-delà : sclère illisible) alors que les réfs vont à 1,17 (chibi / sprites) ; 12 yeux avertissent `lower-peak-min`, 13 `envelope-vs-reference-profile` (non bloquants).
- ✅ `pupil-darker-than-iris` (30 yeux, passe 14) · ⬜ `svg-weight` 44 sur 100 (voir passe 14).
- ⬜ Preuve visuelle par œil de la galerie 4 : planche 03 lue en vue d'ensemble, pas œil par œil.


## Passe 12 (détail : `EYES-PASS-12.md`)
- ✅ **04 Iris — détail atomique** : fentes radiales (04), facettes taillées (07), arcs (10b), braises (10a), vides sombres ; part sombre dans ± 0,04 des 4 références ; couche de vérification (géométrie / anatomie / style) ; preuves : `artefacts/eyes-pass12/`.
- ⬜ **Étoiles** : plates et blanches, sans rayonnement ni teinte ; étoiles de l'anneau de 10b 0,31 R (réf. 0,39), second flare de 10a 0,36 R (réf. 0,65), flares de 07 0,54 / 0,48 R (réf. 0,67 / 0,58). Le détecteur fusionne encore les arcs blancs et le grand flare central (Feret 1,0 R sur ice).
- ⬜ **Fentes** : mesurées sur 04 seulement ; ice (8 fentes courtes mesurées sur le moteur) et fire n'ont pas de référence de fentes. Les fentes sont droites (celles de 04 sont légèrement courbes).
- ⬜ **Facettes de 07** : 70 cellules mesurées contre 105 ; pas de facettes triangulaires étroites ni de grain turquoise du haut de l'iris (« poussière » de 04 / 07).
- ⬜ **Anneau** : la métrique `ring` est indicative ; l'anneau de 10a est un halo large avec rayons, le moteur le rend en anneau resserré. Les « tirets » de 10a ne sont pas mesurés de façon fiable (3).
- ⬜ **Luminance moyenne** : fire 70 (89), ice 81 (103), prism 112 (126), emerald 108 (129) : tous dans ± 25 (test), mais sous les références ; la couleur dans les zones lumineuses reste plus plate.
- ⬜ `lime-cyan` (08a) : aucun détail atomique ajouté ; cellules 37 mesurées contre 5 en référence (fibres trop contrastées).
- ⬜ Les `cellules` mesurées sur fire (226 contre 44) et ice (65 contre 31) sont trop nombreuses (fibres, braises) : non retenues comme critère.
- ⬜ Haut de l'iris du prisme olive (réf. turquoise) : inchangé.
- ⬜ `tests/eye-gallery-ext3` : empreintes `sha1` périmées avant la passe 12 (voir `EYES-PASS-12.md` § 6).
- ⬜ Les points ouverts de la passe 11 non traités ici restent valables : galerie 4 (enveloppes, `circle` / `diamond`), `verifyEye` (`pupil-darker-than-iris` 30 yeux, `svg-weight`), preuve visuelle œil par œil.

## Passe 13 (détail : `EYES-PASS-13.md`)
- **Fait** : étoiles rayonnantes et teintées (`rays`, `tint`, `jitter`), détecteur d'étoiles à bassins versants, `iris.lift` (luminance à ± 10 des 5 références), `slits.curve`, fentes mesurées sur toutes les références, cellules de ice (65 → 41 pour 31) et de fire (200 → 60 pour 44), détail atomique de lime-cyan, règles `iris-luminance-plausible` et `iris-white-share-plausible`.
- **Cellules** : lime-cyan 52 pour 5 (la réf. 08 est faite de grands aplats ; la règle de gradient demande des arêtes — tension non résolue, seuil léger 9 à valider) ; fire 60 pour 44 ; prism 200 pour 167 ; emerald 54 pour 105 (trop peu).
- **Fentes** : emerald 19 pour 6 (les arêtes de facettes se lisent comme des fentes radiales, profondeur 63 pour 30) ; fire 15 pour 7 ; ice 2 pour 4 (4 fentes ajoutées sur fond sombre n'étaient pas détectées, retirées) ; courbure : seule prism l'utilise (09 dérive à 36 °/ρ, non reprise).
- **Étoiles** : premier éclat d'ice 0,79 pour 0,81 et de fire 0,90 pour 0,80 (réglés à la main, instables : le seuil de l'ouverture morphologique fait sauter la mesure) ; petites étoiles `star` à 5 pointes sans lobes asymétriques fidèles à 10b (5 à 6 lobes irréguliers, bleu glacé) ; teinte seulement dans le dégradé du corps (pas de couleur propre par aiguille).
- **Tonalité** : part sombre emerald 0,166 pour 0,101 et fire 0,316 pour 0,373 ; `lift` et `vibrance` à recalibrer ensemble à chaque changement de famille (`calibrate-lift.ts`, `calibrate-vibrance.ts`).
- **Filtres SVG** : avertissement `filter-budget` (non bloquant, limite 14) : ice 18 (15 avant la passe), emerald 15 ; `softness` ajoute un filtre par éclat ; les étoiles d'anneau d'ice ont déjà `intensity` 0. Piste : un seul filtre de flou partagé par les éclats d'une famille. → **fait en passe 14** (ice 12, emerald 13, fire 10 ; décompte seulement, pas de gain de temps mesuré).
- **Tests** : `eye-gallery-ext3` « identité 300 » échoue depuis avant la passe (empreintes figées à régénérer) → **résolu en passe 14** (empreinte de tirage, plus du JSON complet) ; non relancés après la dernière série : rotation 3D de la tête et pipeline visage complet hors galeries.
- **Non fait** : galerie 4 « nouvelles enveloppes réfs 13/17 », facettes taillées de 07, braises de 10a, anneau 10a fidèle (listés en passe 11–12, inchangés).

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
- ⬜ Bords : cils, pli et caroncule ne suivent pas le tracé perturbé. ⬜ Poids SVG non remesuré après les nouveaux atomes.
- Vérifié : tous les tests `*eye*` + 30 autres fichiers ; 1 échec préexistant (`nose-visibility`) ; suite complète de 233 fichiers **non exécutée**.
