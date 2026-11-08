# Apparence du cou — un seul moteur de peau

Règle : le cou **n'a pas de modèle d'éclairage propre**. Il assemble les mêmes couches que la tête, sur son contour. Le dernier commit en avait écrit un (`render/neck/shade.ts`, Lambert maison) ; il est supprimé.

## 1. Couches partagées — `src/skin/layers.ts`

Chaque constructeur prend une `SkinSurface` (contour `d`, étendue, bornes verticales, échelle des pores) et le même `SkinShading` (matériau × lumière × apparence).
`baseLayer` · `formLayer` (bords sombres) · `terminatorLayer` (+ `falloffLayer`, atténuation de la source) · `compileZones` (front, nez, joues, épaules, **cou**) · `spotLayers` (reflets par région) · `fresnelLayer` · `poreLayer` · `wrapSkin` (effets de l'apparence : grain, glow, bloom, opacité, un seul filtre).
`compileSkin` (tête) les assemble comme avant : **SVG des têtes sans cou identiques octet pour octet** (5 identités, avant/après).

## 2. Ce que le cou apporte : la géométrie — `src/render/neck/skin.ts`

- **Terminateur** : chaque point reçoit la projection de sa **normale réelle** sur la direction 2D de la lumière (+1 côté lumière, −1 côté ombre). Même échelle que le dégradé de la tête (le terminateur traverse toute l'étendue). La couleur vient de `terminatorColorAt`, sur les arrêts partagés. Torsion, asymétrie, courbure ou autre angle de lumière changent l'ombrage.
- **Ombre portée du menton** (`neck.shade`) : dégradé maximal sous le menton, nul vers 60 % de la longueur.
- **Lumière diffuse du cou** : zone `neck` de `compileZones`, avec les réglages `zones.shoulders` (le cou est un volume évasé comme les épaules). La tête ne l'émet pas.
- **Éléments** (écailles, plaques, plumes), **accessoires**, **fanon** : `toneOfNormal` (même loi, par normale). Mode cel : deux aplats.
- **Creux des reliefs** : `c.dark` = ombre de l'apparence approfondie de 30 %. Sur une peau à peine plus claire que `ra.shadow`, un creux en `ra.shadow` ne se lit pas (mesuré : six paramètres tombaient sous le seuil de preuve).

## 3. Cohérence de couleur (rendu final, corps branché, 3 identités)

Teinte cou/joue : ≤ 6° mesurés (test ≤ 8°). Teinte torse/cou : ≤ 11° mesurés (test ≤ 14°) : **le torse garde sa propre palette** (`body/volume/shade.ts`), non unifié (voir `NECK-REMAINING.md`).
Effets d'apparence : une opacité de peau de 0,5 modifie le cou comme la tête (test).

## 4. Contraste de lumière (mesuré)

Écart de luminance droite−gauche : cou ±3,7/255, tête ±1, de même signe, changeant avec l'azimut. L'ancien ombrage maison donnait > 10 ; le seuil du test est passé de 10 à 2,5 + même signe que la tête (voir `tests/neck-criteria.test.ts`).

## 5. Garde-fous — `tests/neck-appearance.test.ts`

1. Pas de `shade.ts`, pas de produit normale·lumière maison, `skin.ts` importe `../../skin`.
2. Teinte cou/joue/torse sur le rendu final.
3. Opacité de peau atteignant le cou.
Vérification (`verify/neck.ts`) : teinte ≤ 12° (erreur), `neck.shared-skin-engine`.

## 6. Essai retiré

`surface.roughness` et `surface.microrelief` (matière propre du cou) ont été essayés via le moteur partagé : 0,18 % et 0 % de pixels différents (seuil 0,6 %). Retirés, faute de preuve visuelle.
