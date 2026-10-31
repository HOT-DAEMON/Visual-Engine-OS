# Membre supérieur — itération 02 : deltoïde et trapèze en masses continues, second masque `ref-04`

Preuves visuelles : `artefacts/upper-limb-02/` (8 images + `rapport.json`). Reste à faire : `docs/BODY-UPPER-LIMB-02-REMAINING.md`.

## 1. Second masque de comparaison : `ref-04` (écorché, profil + face)
- Fond = surface polynomiale de degré 4 ajustée par moindres carrés robustes sur les pixels sans relief (vignettage), puis |image − fond| > 20 après flou, fermeture, remplissage, ouverture ; cadre de 8 px ignoré. Deux figures : face (aire 120 033 px) et profil (63 854 px).
- Fichiers : `references/anatomy/ref-04.silhouette.gz` (face), `ref-04.profile.silhouette.gz` (profil), entrée `ref-04` de `measures.json` (tête 15→108 = 93 px, base du cou 125, axe 410, bout des doigts 420).
- **Limite assumée** : le bras DROIT de la figure de face est tronqué par le bord de l'image ; les rapports d'envergure et d'épaules sont donc mesurés sur la moitié gauche (`leftOnly`). `hipY` et `armClearX` sont ceux de `ref-02` mis à l'échelle (convention, notée dans le fichier).
- Le halo lumineux autour de la figure surestime le contour de 1–2 px.

## 2. Mesures qui ont piloté le travail (`scripts/body-refs/contour.ts`, `who-owns.ts`)
- **Contour supérieur de l'épaule** (unités de tête sous la base du cou) : ref-02 passe de 0,018 (x = 0,50 h) à 0,431 (x = 1,16 h), pente ≈ 0,56 ; ref-04 pente ≈ 0,41. Le moteur d'avant : pente ≈ 0,21 et sommet 0,22 h trop haut → épaule « carrée ».
- `who-owns.ts` rend chaque volume seul et dit lequel porte le contour : c'était `trapezius.upper` (pente) et `deltoid.mid` (coin) — les deux cibles demandées.
- **Chute de l'acromion** : le canon donnait 0,115 h sous la base du cou ; les deux références donnent un coin d'épaule à 0,42–0,43 h, soit ≈ 0,5 h sous le menton (proportion classique). Canon adulte porté à 0,33 h (`canon.ts`, bande de sécurité 0,3 → 0,42 h dans `frame.ts`).
- **Alignement** : désormais par la HAUTEUR DE TÊTE (échelle) et la base du cou. L'ancien alignement par le bout des doigts faisait rétrécir tout le corps dès que les bras étaient trop longs — il masquait l'erreur au lieu de la mesurer.
- **Proportions des références** : l'avant-bras de `ref-02` mesure 0,78 h, celui de `ref-04` 1,18 h (canon moteur 1,15 h). `ref-02` est donc stylisée sur ce point : le canon est **conservé** et la flexion du coude (23°) absorbe l'écart dans la pose calibrée. Décision, pas oubli.

## 3. Changements du moteur
- **Deltoïde** (`volume/deltoid.ts`) : UN volume par épaule (6 sections : calotte, ventre, V d'insertion), cotes en multiples du rayon du bras. Les trois chefs ne sont plus des volumes mais deux sillons (brins `deltoid.groove.ant|post.L|R`) et des fibres. Anciens ids `deltoid.ant|mid|post` supprimés.
- **Masse continue** : nouveau champ `Volume.mass` ; le rendu par pixel ne creuse aucune rainure entre volumes de même masse (`deltoid`, `trapezius` : 6 parties).
- **Peau du bras** : l'enveloppe n'avait pas de couvercle (un plateau plat apparaissait à l'épaule une fois l'acromion abaissé) → calotte sphérique de 3 anneaux.
- **Trapèze supérieur** : sections de l'extrémité acromiale épaissies pour se fondre dans la calotte du deltoïde.

## 4. Résultats (silhouette, zone épaules–bras)
| | avant | après |
|---|---|---|
| ref-02, pose par défaut — IoU | 0,762 | 0,775 |
| ref-04, pose par défaut — IoU | 0,699 | 0,683 (autre pose : bras écartés de 18°) |
| ref-02, pose calibrée — IoU / écart de largeur | 0,766 / 11,2 % | **0,789 / 6,4 %** |
| ref-04, pose calibrée — IoU / écart de largeur | 0,765 / 10,0 % | **0,797 / 3,8 %** |
- Poses calibrées (`calibrate-pose.ts`, symétriques) : ref-02 abduction 11°, rotation avant-bras 1°, flexion 23°, pronation −0,575 ; ref-04 abduction 18°, rotation −8°, flexion 0°, pronation −0,35.
- Pente du trapèze (0,50 → 0,94 h) : 0,55 (références 0,41–0,56). Chute de l'acromion : 0,49 h sous le menton.
- Avant le changement d'alignement, les chiffres « avant » étaient 0,766 (ref-02) ; ils sont recalculés ici avec le même alignement pour être comparables.

## 5. Vérification du rendu — couche ajoutée (`src/verify/shoulder.ts`, `tests/body-shoulder.test.ts`)
Mesurée sur l'IMAGE de face, 8 contrôles chiffrés ; seuils tirés des références.
- **Géométrie** : contour d'épaule sans marche (plus grande marche 0,022 h < 0,07) ; contour descendant du cou à l'acromion (remontée 0,000 h < 0,025).
- **Anatomie** : pente du trapèze dans la bande 0,30–0,90 ; acromion à 0,40–0,70 h sous le menton ; deltoïde = une masse par épaule, aucun chef séparé ; trapèze = une seule masse.
- **Style** : aucune couture sombre dans la calotte du deltoïde (5e centile = 0,73 × médiane > 0,55) ; relief réel (écart-type 20,3 > 5).
- Contrôle négatif testé : un chef de deltoïde ajouté de force fait échouer « une seule masse ».
- Planchers de non-régression : IoU ≥ 0,77 sur chaque référence avec sa pose, écart de largeur ≤ 8 % / 6 %, contour d'épaule ≤ 0,06 h / 0,07 h en moyenne.

## 6. Reproduire
`npx tsx scripts/body-refs/iou.ts` · `contour.ts` · `who-owns.ts ref-02|ref-04` · `calibrate-pose.ts ref-02|ref-04` · `scripts/artefacts-upper-limb-02.ts` puis `scripts/artefacts-upper-limb-02.py`.
