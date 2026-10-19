# Matériau de peau, éclairage, zones lumineuses

Contrats : `src/schema/skin-material.ts`, `src/schema/light-transform.ts` (`LightSpec`), `src/schema/face-lighting.ts` (`zones`).
Code : `src/skin/`, `src/lighting/rig.ts`, `src/face/regions.ts`. Preuves : `artefacts/face-anatomy/` (08, 09, 10, 13).

## Rendu = f(géométrie, matériaux, éclairage, caméra)

| Entrée | Contrat | Contient | NE contient PAS |
|---|---|---|---|
| géométrie | `FaceParams` (+ `nose`, `chin`, `jaw`) → `faceLandmarks`, `noseGeometry`, `skinRegions` | formes, positions, régions nommées | couleur, brillance |
| matériaux | `SkinMaterial` + `Appearance` (`skin`) | rugosité par région, reflet, diffusion, grain, tons | coordonnée, forme, identité de personnage |
| éclairage | `LightSpec` (+ `FaceLighting.zones`) | direction, taille, température, dureté, distance, influence, zones | matériau |
| caméra | `transform` de l'hôte (position, échelle, rotation) | cadrage | lumière |

Preuves de la séparation : `tests/skin-light.test.ts` (« le même matériau donne les mêmes intensités sur deux géométries différentes »,
`skinShading` ne reçoit que des régions nommées) ; artefact 10 (même matériau sur 3 géométries, même géométrie en 4 styles).
`skinMaterial.model = 'legacy'` rétablit l'ancien ombrage générique pour comparaison.

## Matériau de peau (`SkinMaterial`)

- Pas de champ `metallic` (le schéma est strict) : la peau est un DIÉLECTRIQUE ; la couleur du reflet est celle de la lumière
  (`specular.tint` ≤ 12 % de peau). Contrôle de style `skin-specular-nonmetal` (chroma ≤ 0,3).
- `roughness` : une valeur PAR RÉGION (front, nez, joues, tempes, menton, lèvre supérieure, cou). Elle pilote taille (plancher 0,3 du rayon, reflets LARGES),
  intensité (`1 − 0,7 r`) et douceur du reflet de CETTE région. `oiliness` renforce la zone T. Contrôle `skin-roughness-varies`.
- `softness` : largeur du terminateur lumière → ombre (≥ 0,1 en mode lisse ; ≤ 0,02 en mode `cel`). `subsurface` : rougeur retenue (30 % de rouge sang) au
  milieu du terminateur. `pores` : grain (turbulence fractale) par région, ∝ rugosité. `specular.fresnel` : bord éclairci.
- Les reflets sont décalés vers le vecteur médian : ils SUIVENT la lumière (test sur 12 azimuts + contrôle `skin-highlights-follow-light`).
- Test sur pixels (`rendu : la peau reste cohérente sous différents éclairages`) : la joue du côté de la lumière est plus claire ; inverser la lumière inverse le signe.

## Éclairage (`LightSpec`)

Direction : `azimuthDeg`, `elevationDeg` (inchangés). Ajouts, tous à valeur neutre (une scène existante se rend à l'identique) :
`sourceSize` (taille apparente), `temperatureK` (corps noir, 6500 K neutre ; multiplie `color`), `shadowHardness`, `distance` (position : `null` = à l'infini ;
finie = dégradé d'intensité proche/lointain et source apparemment plus grande), `influence` (`skin`, `hair`, `eyes`, `lips`, `metal`).
`softness(L)` est monotone (taille ↑, dureté ↓, distance ↓ → plus doux). `intensityFor(L, classe)` applique l'influence par matériau.

## Zones lumineuses (`FaceLighting.zones`)

Front, nez, joues, épaules : taches diffuses de la couleur de la lumière, décalées vers la source (`directionality`) et bordées d'une chute douce
(`softness`). Les épaules sont une zone à la base du cou (l'évasement du cou tient lieu de trapèzes : pas d'épaules en géométrie, voir TODO-FACE).

## Apparence (tous les axes)

La peau lit les axes de `Appearance` : `light` (ombre, lumière, contour), `gradient` (dégradé vertical), `texture`, `shading` (`smooth`/`cel`), `contrast`,
`saturation`, `brightness`, `opacity`, `emission`, `reflection` (intensité, taille, teinte), `refraction`, `glow`, `bloom`. `generation/random-face-anatomy.ts`
tire chacun d'eux avec des bornes réalistes, à partir d'un flux de hasard DÉRIVÉ (les tirages existants ne bougent pas). Deux défauts du moteur d'apparence
trouvés et corrigés : voir `docs/ERRORS-4.md`.
