# Audit de visibilité des paramètres du nez (19 nov. 2026)

Question posée par la consigne : *un moteur très riche en paramètres produit-il réellement des différences visibles ?* Ce document répond par la mesure, axe par axe,
et dit ce qui reste faible. Il ne prétend pas que tout soit réglé.

## 1. Méthode (reproductible)

- Une tête = une graine (11, 77, 1203), moteur `structured`, **peau seule** (crâne chauve, sans pilosité), cadrage de galerie ×2 (600 px de large, échelle 1,44).
- On change **un seul axe** : valeur basse → valeur haute (0,1 → 0,9 ; ±0,8 pour les axes signés ; `length` 0,10 → 0,22 ; `width` 0,10 → 0,24 ; `nostrils.tiltDeg` 5 → 45 ; formes de dorsum comparées à `straight`).
- Mesure : nombre de pixels de la **zone nez** (de la glabelle à la ligne de bouche + 8 px, ±1,7 × largeur du nez) dont la somme RGB change de plus de 24 (≈ 3 % de luminance).
  Un second compteur à seuil relatif (6 % de la luminance locale) est dans `visibility-lib.ts` (`zoneRelPixels`) : comparé sur 7 axes × 3 graines, il donne des valeurs proches (ex. philtrum.depth 228/531/973 contre 244/532/888 px) : le seuil absolu ne défavorise pas les peaux sombres sur ces axes (non vérifié sur les 45).
- Audit 3D : mêmes axes sur la tête 3D éclairée (`head_3d` + `src/relief`), vues 45° et 90°, cadre de 420 px de haut.
- Verdicts : **visible de face** ≥ 150 px · **visible en 3D seulement** ≥ 100 px en 45° ou 90° · **FAIBLE** 50–149 px · **INVISIBLE** < 50 px.
- Lancer : `npx tsx scripts/nose-audit/visibility.ts structured` (≈ 3 min), `npx tsx scripts/nose-audit/visibility-3d.ts a b` (tranches de paramètres a à b, ≈ 12 s par axe),
  puis `npx tsx scripts/nose-audit/table.ts`. Planches : `sheet.ts` (gros plans bas | haut | différence ×6) et `heads.ts` (têtes complètes).

## 2. Résultat brut (moyenne des 3 graines)

| paramètre | face (px) | 3D 45° (px) | 3D 90° (px) | verdict |
|---|---:|---:|---:|---|
| philtrum.blend | 0 | 0 | 0 | INVISIBLE |
| tip.alarBlend | 36 | 0 | 0 | INVISIBLE |
| junction.orbital | 57 | 0 | 0 | FAIBLE |
| columella.hang | 66 | 0 | 0 | FAIBLE |
| junction.nasolabial | 67 | 0 | 0 | FAIBLE |
| tip.highlight | 68 | 0 | 0 | FAIBLE |
| nostrils.rim | 120 | 0 | 0 | FAIBLE |
| domes.separation | 127 | 0 | 0 | FAIBLE |
| nostrils.opening | 135 | 0 | 0 | FAIBLE |
| nostrils.tiltDeg | 142 | 9 | 0 | FAIBLE |
| root.depth | 0 | 149 | 86 | visible en 3D seulement |
| dorsum.curvature | 0 | 212 | 142 | visible en 3D seulement |
| dorsum.shape(straight→convex) | 13 | 167 | 115 | visible en 3D seulement |
| groove.length | 152 | 0 | 0 | visible de face |
| junction.glabella | 154 | 0 | 0 | visible de face |
| junction.cheek | 159 | 0 | 0 | visible de face |
| sidewall.slope | 161 | 121 | 6 | visible de face |
| philtrum.width | 165 | 0 | 0 | visible de face |
| tip.roundness | 169 | 120 | 74 | visible de face |
| alae.attachment | 179 | 2 | 0 | visible de face |
| nostrils.shape | 213 | 19 | 0 | visible de face |
| root.width | 215 | 40 | 1 | visible de face |
| base.depth | 251 | 0 | 0 | visible de face |
| nostrils.asymmetry | 252 | 26 | 0 | visible de face |
| nostril | 268 | 29 | 0 | visible de face |
| domes.prominence | 277 | 0 | 0 | visible de face |
| alae.thickness | 298 | 0 | 0 | visible de face |
| nostrils.visibility | 298 | 36 | 0 | visible de face |
| base.width | 357 | 8 | 2 | visible de face |
| bridge | 369 | 0 | 0 | visible de face |
| groove.depth | 411 | 0 | 0 | visible de face |
| alae.volume | 454 | 0 | 0 | visible de face |
| nostrils.columella | 490 | 19 | 0 | visible de face |
| philtrum.depth | 555 | 0 | 0 | visible de face |
| tip.projection | 576 | 417 | 381 | visible de face |
| sidewall.concavity | 650 | 0 | 0 | visible de face |
| tip.width | 727 | 34 | 6 | visible de face |
| dorsum.shape(straight→concave) | 742 | 103 | 56 | visible de face |
| alae.flare | 1583 | 157 | 86 | visible de face |
| dorsum.width | 1622 | 0 | 0 | visible de face |
| tip.rotation | 2064 | 340 | 238 | visible de face |
| root.height | 3143 | 1541 | 1541 | visible de face |
| dorsum.deviation | 5209 | 196 | 48 | visible de face |
| length | 8447 | 4292 | 4379 | visible de face |
| width | 11288 | 572 | 303 | visible de face |

Lecture honnête : le moteur n'est pas « théorique » partout, mais **dix axes restent faibles ou invisibles** (§5) et **aucun axe de région n'est lu par la tête 3D** (§4).

## 3. Ce qui a été corrigé (src/render/face/structure/nose.ts)

Les pentes d'opacité et de largeur des régions valaient ≈ 0,3 : de 0,1 à 0,9 l'axe ne changeait que quelques dizaines de pixels. Chaque formule est maintenant
`pivot(v, défaut, valeur historique au défaut, pente, min, max)` : **au défaut le SVG est identique octet pour octet** (garde-fou : hash SHA-256 dans `tests/nose-visibility.test.ts`,
vérifié aussi sur 2 graines aléatoires), et l'écart au défaut est amplifié.

| axe | avant (px) | après (px) | changement |
|---|---:|---:|---|
| philtrum.depth | 84 | 555 | gouttière : largeur ×6, opacité ×0,8 par unité ; crêtes plus larges et plus claires |
| philtrum.width | 0 | 165 | opacité de la gouttière couplée à la largeur (un philtrum large = un canal d'ombre plus large) |
| domes.prominence | 44 | 277 | reflet ×1,0 par unité, croissant d'ombre ×0,6 |
| groove.depth | 233 | 411 | trait ×4 de largeur, opacité ×1,1 par unité |
| base.depth | 132 | 251 | ombre de la base ×0,8 par unité |
| domes.separation | 89 | 127 | encore FAIBLE |

Réserve : entre les deux mesures j'ai agrandi la zone (glabelle en haut, +8 px en bas), donc « avant/après » est indicatif pour les axes proches de ces bords.
`junction.glabella` 0 → 154 px est **uniquement** une correction de ma boîte de mesure (la glabelle est au-dessus de la racine) ; le moteur n'a pas bougé pour cet axe.

Preuves visuelles : `artefacts/nez-audit-visibilite/gros-plans-renforces-77.png` et `tete-77-{philtrum-depth,groove-depth,domes-prominence}.png` (tête complète avec cheveux).

## 4. Constats structurels

1. **La tête 3D ignore les axes de région** : sidewall, domes, groove, base, columella, philtrum, junction, `alae.thickness/volume`, `bridge`, `dorsum.width`,
   `nostrils.opening/rim`, `tip.alarBlend/highlight` donnent 0 px en 45° et 90°. Ils n'existent que dans le rendu SVG de face. Les brancher dans `head_3d` n'est pas fait.
2. Les axes de profil se voient bien en 3D, pas de face : `root.depth` (149/86 px), `dorsum.curvature` (212/142), `dorsum.shape` convexe (167/115), `tip.projection` (417/381).
3. Le moteur `classic` ignore les axes de région (testé : 0 px). C'est le comportement documenté de `anatomyEngine`, pas une régression.
4. **Dispersion inter-graines forte** (px, graines 11 / 77 / 1203) : philtrum.depth 244/532/888 · philtrum.width 0/219/275 · groove.depth 76/581/576 · base.depth 29/371/352 ·
   sidewall.concavity 82/1032/837. La graine 11 répond nettement moins (cause non diagnostiquée). Les planchers du test utilisent la graine 77 (60 % des valeurs mesurées).
   Sur la graine 11, `philtrum.width` reste à 0 px.

## 5. Ce qui reste FAIBLE ou INVISIBLE (non corrigé)

`philtrum.blend` (0 px ; hypothèse non vérifiée : l'ellipse de fondu est recouverte par la lèvre), `tip.alarBlend` (36), `junction.orbital` (57), `columella.hang` (66),
`junction.nasolabial` (67), `tip.highlight` (68), `nostrils.rim` (120), `domes.separation` (127), `nostrils.opening` (135), `nostrils.tiltDeg` (142 ; 9 px en 45°).
Aucun n'a été renforcé : ils nécessitent soit un diagnostic de cause (occlusion, ordre de peinture), soit un choix artistique sur le rendu par défaut.

## 6. Limites de la mesure

- Un axe à la fois : les interactions (ex. profondeur × largeur du philtrum) ne sont pas mesurées.
- Extrêmes de plage uniquement ; pas de courbe de réponse ni de test de monotonie.
- « Visible » = pixels changés au-delà d'un seuil, **pas** « convaincant ». Le jugement artistique repose sur ma lecture des planches ; il n'est pas automatisé.
- Peau seule, éclairage par défaut : aucun axe n'a été mesuré sous d'autres lumières, ni avec cheveux/barbe qui peuvent masquer la zone.

## 7. Couche de vérification

Les règles `src/verify` existantes (géométrique, anatomique, style) sont inchangées et vertes (24 fichiers, 207 tests nez/face-structure). Je n'ai **pas** ajouté de règle `src/verify` :
elles inspectent la géométrie, pas des rasters ; la preuve par pixels vit dans `tests/nose-visibility.test.ts` (7 axes à plancher mesuré, classic = 0, hash du défaut).
