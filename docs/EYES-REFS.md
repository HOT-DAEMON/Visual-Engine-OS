# Yeux — références mesurées, almond recalé, galerie de 100 formes (session du 2026-11-13)

Les 11 images de `references/eyes/` **nourrissent le moteur existant** (`src/geometry/eye`, `src/generation`, `src/verify`) : aucun moteur par référence.
Tout ce qui suit est reproductible : `python3 scripts/eye-refs/extract.py`, `npx tsx scripts/gallery-eyes-100.ts`, `npx tsx scripts/artefacts-eyes-100.ts`.

## 1. Extraction (scripts/eye-refs/extract.py → references/eyes/measures.json)

Méthode : l'humain fournit seulement, par œil, les deux canthi, des ancres grossières des marges haute/basse et le centre/rayon approximatifs de l'iris.
Tout le reste est **calculé** : accrochage des ancres sur le plus fort gradient de luminance (±9 px, image lissée), rééchantillonnage à 64 points,
repère de l'œil (axe interne → externe), profils normalisés à 21 points, ajustement de deux cubiques (moindres carrés, comme `TRIANGLE`),
iris (cercle moindres carrés robuste sur le limbe), pupille (composante sombre centrale), reflets (blobs V > 0,93 dans l'iris),
palette de la sclère (3 bandes) et de la peau périoculaire, épaisseur du trait de paupière.
Preuve : `artefacts/eyes-refs/overlay-*.png` (rouge = marge haute, vert = basse, jaune = limbe, magenta = reflets).

| Réf. | Vue | Largeur px | Inclinaison | Hauteur/largeur | Fraction haute | Sommet haut / creux bas | Iris r / hauteur | Pupille / iris |
|---|---|---|---|---|---|---|---|---|
| 04 | face | 656 | 0,5° | 0,547 | 0,77 | 0,48 / 0,62 | 0,491 | 0,127 |
| 07 | face | 452 | 5,7° | 0,545 | 0,57 | 0,55 / 0,56 | 0,540 | 0,138 |
| 11 | face (recadrée) | 582 | 1,0° | 0,473 | 0,61 | 0,60 / 0,46 | 0,542 | 0,284 |
| 10a | 3/4 | 415 | 22,1° | 0,580 | 0,62 | 0,41 / 0,63 | 0,524 | 0,211 |
| 10b | 3/4 | 476 | 18,9° | 0,475 | 0,55 | 0,47 / 0,49 | 0,542 | 0,250 |

Sclère : moyenne 150–180 de luminance mais ombrée par la paupière (5ᵉ centile 60–73) ; peau périoculaire et reflets : voir le JSON.
Enseignements : diamètre de l'iris ≈ hauteur d'ouverture (0,98–1,08) ; centre de l'iris à 0,47–0,51 le long de l'axe ; reflet principal r/iris 0,22–0,29 ;
canthus interne plus aigu (≈ 75–104°) que l'externe.

**Références 12 à 17 (ajoutées en cours de session)** — ce sont des planches de formes sur fond uni, mesurées différemment :
- 12 et 16 (iris noirs pleins, reflets blancs) : **mesure automatique** sans ancre (`scripts/eye-refs/extract_sheets.py` → `references/eyes/measures-sheets.json`) :
  aspect d'iris hauteur/largeur médiane 1,007 (12 iris) et 1,078 (28 iris) ; reflet principal r/iris 0,18–0,25, placé en haut (dy ≈ −0,44) ; secondaire 0,10–0,12.
  Consommé : `ROUND_IRIS_ASPECT` (aspect d'iris des styles round / chibi / circle de la galerie étendue), testé.
- 13 et 17 (yeux manga au trait), 14 (yeux colorés avec flèches d'inclinaison), 15 (sprites pixelisés) : **pas encore mesurés** (contours au trait sans sclère remplie :
  il faut tracer les marges ; 15 est en très basse résolution). Voir `EYES-REMAINING.md`.

**Non tracées (documenté, pas contourné)** : 06 et 09 (canthi hors cadre), 03 et 05 (yeux trop petits dans un visage), 01 et 02 (styles cel : cheveux/ombres
mêlés au contour), 08 (yeux chibi : tracé raté, l'iris ne coïncidait pas). Limite générale : ancres posées à la main ; la segmentation automatique de la
sclère par couleur a été essayée et **échoue** (sclère ombrée, peau claire confondue).

## 2. Almond recalé (src/geometry/eye/opening-ref.ts)

Mesure du moteur avec les mêmes descripteurs (`geometry/eye/profile.ts`, `scripts/eye-refs/profile-engine.ts`) : le profil de l'almond était déjà dans la plage
des références, mais le **creux de la paupière basse était à 0,45** (références 0,46–0,62, moyenne 0,55) et le **canthus interne trop ouvert (119°)**.
Ajustement de 6 facteurs (Powell, bornes physiques, apex conservé à `hEff × upperFraction`) : erreur quadratique moyenne au profil moyen des réfs 04/07/11
0,0192 → 0,0020 ; creux bas 0,55 ; canthus interne 98°. Les facteurs s'appliquent aux contrôles de la base procédurale (`opening.ts`) :
almond, sharp, drooping, compressed (canthus interne commun conservé) ; `round` (dessiné à la main) reste neutre.
Tests : `eye-ref-measures` (constantes = moyenne recalculée depuis le JSON, RMS < 0,07, pics dans les plages mesurées) ; deux tests figés d'origine
(`eye-shape-style`, `eye-shape-styles-extra`) et l'empreinte `first-eye` ont été **mis à jour volontairement**.
Preuve : `artefacts/eyes-100/02-almond-avant-apres-vs-references.png`. Honnêteté : à l'écran la différence est subtile à la taille par défaut.

## 3. Galerie étendue : 100 formes (src/generation/eye-gallery-ext.ts)

- Les 48 yeux d'origine n'exploitaient que 4 des 12 enveloppes ; les 100 nouveaux utilisent les **12** (8 ou 9 chacun, cases entrelacées).
- Sélection par échantillonnage du plus éloigné (320 candidats par style, distance = RMS des profils haut + bas + inclinaison) : distance minimale **0,0103** entre
  nouveaux et **0,0230** aux 48 existants (largeur = 1) — mesurée, testée (`eye-gallery-ext`). Le seuil minimal est faible : quelques paires restent proches.
- Chaque œil est validé par `verifyEye` ; en cas d'échec, tentatives déterministes plus sages (regard nul, iris réduit, reflets simplifiés). Archétype `alien`
  écarté (le preset impose un rayon d'iris absolu qui annule le calibrage).
- Rayon d'iris **calibré sur l'ouverture réelle** : diamètre vertical = 1,02 × hauteur d'ouverture (mesuré). Pupille 0,2–0,34 (mesuré 0,13–0,28).
- 60 % des yeux reçoivent une **famille d'iris** (`eye-iris-families.ts` : golden, teal-gem, prism, frost, ember, amber-radial), construite avec `iris.layers` et
  `highlights.list` existants ; proportions mesurées (testées), teintes interprétées des références.
- Sorties : `examples/gallery-100.json`, `artefacts/eyes-100/01-galerie-100-yeux.png`, têtes complètes `04-…`, `05-…`.

## 4. Vérification (trois couches : géométrie, anatomie, style)

| Niveau | Où | Contrôles |
|---|---|---|
| Paramètres / enveloppe | `src/verify/eye-envelope.ts` (appelé par `verifyEye`) | geometry : paupières ordonnées, un seul sommet par paupière (error) ; anatomy : sommet haut/creux bas dans la plage mesurée, iris ≈ hauteur d'ouverture (warn) ; style : RMS du profil au profil de référence ≤ 0,16 (warn). Anatomie et style : styles « naturels » seulement (almond, sharp, drooping, compressed). |
| Image rastérisée | `scripts/lib/verify-eye-render.ts` | geometry : rien de peint hors de la zone de l'œil, centre de l'iris peint, ouverture remplie ≥ 98 % ; anatomy : pupille plus sombre que l'iris, sclère claire reste ≥ 60 de luminance (5ᵉ centile mesuré) ; style : iris non aplat (écart-type de luminance ≥ 3). |

Résultat sur les 100 yeux (`artefacts/eyes-100/06-verification.json`) : **0 erreur `verifyEye`, 0 échec pixel**. Avertissements restants : `pupil-to-iris` 21
(extension propre aux pupilles en fente du moteur : 0,82 constant), `lower-peak-max` 5, `upper-peak-min` 2, `lower-peak-min` 2, `envelope-vs-reference-profile` 2,
`iris-to-opening-width` 3, `pupil-darker-than-iris` 4.

## 5. Paramètres consommés et prouvables (scripts/lib/eye-param-sweeps.ts)

31 paramètres (enveloppe, canthi, pli, pli palpébral, iris, pupille, reflets, cils, sourcil, regard, expression) sont balayés bas → haut avec un rendu resvg réel ;
`tests/eye-params-consumed.test.ts` exige un nombre minimal de pixels changés (150 par défaut). Résultat : **31/31**. Preuve :
`artefacts/eyes-100/03-parametres-consommes-bas-vs-haut.png`. Piège découvert : le sourcil se dessine ≈ 220 px au-dessus du centre de l'œil ; un cadrage trop
serré donnait faussement « non consommé » (corrigé dans le banc, pas dans le moteur).

> Suite (2026-11-14) : `EYES-REFS-2.md` (silhouettes des réfs 13/15/17, looks, iris atomique, galerie étendue, vérification de paire).
