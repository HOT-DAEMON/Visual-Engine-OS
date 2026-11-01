# Membre supérieur — itération 03 : épaule resserrée, abdomen plus profond, premier profil mesuré (`ref-04`)

Preuves visuelles : `artefacts/upper-limb-03/` (5 images + `rapport.json`). Reste à faire : `docs/BODY-UPPER-LIMB-03-REMAINING.md`.

## 1. Ce qui a été mesuré d'abord
- **Contour de l'épaule (face, ref-02)** : le coin extérieur tenu par `arm.env` (x = 1,08 et 1,16 h) était 0,037 et 0,064 h trop haut ; la paroi du deltoïde (x = 1,23 h) n'était atteinte qu'à 0,49 h sous le cou contre 0,79 h dans la référence.
- **Profil (nouveau, `scripts/body-refs/profile-iou.ts`)** : le masque de profil de `ref-04`, produit à l'itération 02, n'avait jamais été comparé. Le moteur est rendu à yaw ±90, mis à l'échelle de la référence, puis recalé en TRANSLATION seule (±24 px, on garde le décalage qui maximise l'IoU). Les deux sens ont été essayés : yaw −90 colle mieux (0,659 contre 0,570 avant recalage) → la figure regarde à gauche.
- **Correction d'une erreur de méthode** : une première version alignait par centroïde et donnait un IoU de profil de 0,659 ; c'était surtout un décalage avant/arrière arbitraire. Le point de départ honnête est **0,776** (recalé).
- **Erreur de profondeur par ligne** (largeur de silhouette, indépendante de l'alignement, de 0,65 h sous le cou à la crête iliaque) : 19,6 %. Le thorax collait (1,29 h contre 1,35 h) ; c'est l'abdomen qui était trop plat : 0,9 h contre 1,15–1,30 h.

## 2. Changements du moteur
- `volume/limb.ts` : calotte de la peau du bras abaissée (0,34 → 0,20 × rayon) et deux premières sections de l'enveloppe amincies (×0,86 et ×0,95).
- `volume/deltoid.ts` : trois premières sections du profil resserrées et rapprochées de l'axe de l'humérus (décalage 0,26/0,32/0,40 → 0,14/0,22/0,26 ; demi-axe 0,84/1,06/1,14 → 0,66/0,90/1,00 ; ventre 0,38 → 0,32).
- `volume/trunk.ts` : rapport profondeur/largeur de la taille, du nombril et de la crête iliaque 0,62/0,64/0,68 → 0,74/0,76/0,78, multiplié par `1 + 0,15 × musculature visible`. **Essai rejeté** : appliquer ce facteur aussi à l'aisselle et au mamelon a poussé le rapport D/L du thorax hors de sa bande anatomique (0,60–0,85) et fait échouer deux tests existants.

## 3. Résultats
| Mesure | avant | après |
|---|---|---|
| Coin d'épaule x = 1,08 / 1,16 h (écart à ref-02) | −0,037 / −0,064 h | **−0,009 / 0,000 h** |
| Paroi du deltoïde x = 1,30 h (écart) | −0,083 h | **+0,009 h** |
| Profil ref-04 — IoU recalé | 0,776 | **0,799** |
| Profil ref-04 — erreur de profondeur par ligne | 19,6 % | **12,8 %** |
| Face ref-02, pose calibrée — IoU / écart de largeur | 0,789 / 6,4 % | 0,790 / 6,0 % |
| Face ref-04, pose calibrée — IoU / écart de largeur | 0,797 / 3,8 % | 0,798 / 3,4 % |
Les gains de silhouette de FACE sont **marginaux** (+0,001 à +0,002) : le gros de l'écart restant n'est pas dans le coin d'épaule (voir REMAINING). Le gain net de cette itération est dans le contour du coin et dans le profil.

## 4. Vérification du rendu — couche ajoutée (`src/verify/profile.ts`, `tests/body-profile.test.ts`)
Mesurée sur l'IMAGE d'un rendu de profil, 6 contrôles chiffrés ; seuils tirés de ref-04 (une seule référence de profil : bandes larges, elles bornent l'absurde et ne décrivent pas une population).
- **Géométrie** : aucun saut de profondeur entre lignes espacées de 0,05 h (plus grand saut 0,069 h < 0,2), sur 0,65 → 1,80 h (au-delà, le tronc du moteur s'arrête : c'est un bord, pas une forme).
- **Anatomie** : profondeur du thorax 1,27 h (bande 1,0–1,7) ; abdomen 1,03 / 1,10 h (bande 0,8–1,5, élargie de 0,5 × adiposité) ; rapport abdomen/thorax 0,81 (bande 0,60 – 1,10 + 0,5 × adiposité ; ref-04 : 0,86).
- **Style** : tronc modelé (écart-type de luminance 19,0 > 5) ; aucun contour noir (0,00 % de pixels pleins quasi noirs).
- Testé sur 7 archétypes (veryMuscular, muscular, adultMale, adultFemale, thin, obese, elderMale), profil gauche ET droit. Contrôle négatif : un abdomen effacé de l'image fait échouer la bande d'anatomie. Plancher de non-régression : IoU de profil > 0,77 et erreur de profondeur < 16 %.
- **Bornes à connaître** : la borne basse du rapport abdomen/thorax (0,60) a été abaissée de 0,70 après qu'un corps mince est tombé à 0,70 pile ; c'est une estimation, pas une mesure.

## 5. Reproduire
`npx tsx scripts/body-refs/profile-iou.ts` · `iou.ts` · `contour.ts` · `scripts/artefacts-upper-limb-02.ts` (images brutes, avant = worktree du commit précédent) + `scripts/artefacts-profile-raw.ts` puis `scripts/artefacts-upper-limb-03.py <avant> <après> artefacts/upper-limb-03`.
