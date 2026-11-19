# Yeux — ce qui reste à faire, par composant

Légende : ✅ fait et testé · 🟡 partiel (précisé) · ⬜ non fait · ❔ existant avant ce chantier, **non audité** dans cette passe.

## 01 Enveloppe palpébrale / 02 Canthi
- ❔ EYE-01A→01K, EYE-02A→02G : géométrie existante (12 styles, pli, caroncule, plica…) non retravaillée ; un audit ligne à ligne contre le TODO reste à faire.
- ✅ Rotation 3D de chaque enveloppe (modèle `sphere`). 🟡 Les cils, le liner et le sourcil dérivent de l'ouverture tournée mais leur épaisseur n'est pas
  recalculée anisotropiquement ; le sourcil n'est pas reprojeté sur la sphère du front.
- ⬜ Intégration au visage : `FaceParams` ne passe pas `headTurn.model = 'sphere'` ni l'azimut (± 22°) à chaque œil ; à brancher dans `render/face` (la pose du visage
  garde le modèle `flat` + sa propre parallaxe). `headTurn.parallax` est prévu pour cet hôte.
- ⬜ Reflets (disques) et pupille ne sont pas déformés par la projection sphérique (seul l'iris suit la jacobienne centrale).

## 03 Globe / sclère
- ✅ Humidité naturelle (film lacrymal + ménisque), vaisseaux, chroma, occlusion locale, marques.
- ⬜ EYE-03C→03H (limbe/cornée/réfraction cornéosclérale) : non touchés. ⬜ OPT-02 réfraction réelle (déformation de l'iris derrière la cornée) ; `appearance.refraction` ne
  fait qu'appliquer l'effet du moteur partagé. ⬜ OPT-03 diffusion sous-surface.

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
- ✅ A, B, C, F, H + LOD. ⬜ D microrelief cutané (pores, normales), E irrégularité des bords palpébraux, G petits plis des canthi.
- 🟡 LOD : paramètre explicite `lod.eyePixels` ; le visage/la scène ne le renseigne pas encore automatiquement à partir de la taille finale en pixels.

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
- 🟡 Almond : validé hors échantillon sur 03 / 05 (haut 0,033 / 0,018 ; bas 0,051 / 0,058 contre 0,013–0,033 en entraînement), `ALMOND_REF` inchangé. ⬜ Paramètre `lowerPeak` exposé (sommet bas 0,40–0,65 selon l'œil) puis refit.
- 🟡 Texture d'iris moteur 12–22 contre 22–42 sur les références : couleurs et proportions atteintes, filigranes fins non. ⬜ Réfs 08 et 10 sans mesure d'iris ; aspect de pupille de 05 / 09 et limbe de 05 non fiables ; canthus externe de 03 incertain.
