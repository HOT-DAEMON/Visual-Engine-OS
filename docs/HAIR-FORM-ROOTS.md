# Repousse des cheveux teints (`root-band.ts`)

Suite de `HAIR-FORM.md`. Limites : `HAIR-FORM-REMAINING.md` (lignes 9, 19).

## Problème
Une racine sombre voulue (`hair.rootColor`, ~14 % des visages) teignait TOUTE la sous-couche : sous un rose, un casque brun faisait la silhouette du dôme partout où les mèches laissaient un jour, bord compris. Anatomiquement faux : la repousse se voit là où les cheveux s'écartent du cuir chevelu (raie, implantation), pas sur la tranche de la chevelure.

## Modèle
- **Sous-couche** (`shellColorOf`) = couleur des cheveux ombrée (`mix(base, shadow, 0,55)`), plancher de luminance 0,42 × la luminance des cheveux (`ROOT_MIN_RATIO`).
- **Repousse** = trait flou (`rootColorOf`) le long de l'implantation et autour de la raie, plancher PROPRE 0,16 (`ROOT_BAND_MIN_RATIO`) : une racine doit rester plus sombre que la longueur, sinon elle disparaît (essayé avec le plancher 0,42 : la racine brune devenait mauve, invisible).
- **Profondeur** `rootBandDepth` : 0,42 × épaisseur de coque, bornée à [0,010 ; 0,045] W et toujours < 0,9 × `RIM_FROM` × épaisseur : le bord n'est jamais de la couleur de racine.
- Pas de bande si la coque est plus mince que 0,012 W (coupe rase) ou sans implantation (`rootBand` → `null`).
- Rendu : groupe `*-hair-root-blur` (flou σ = 0,4 × profondeur, opacité 0,92). Source unique : rendu ET vérification.

## Essai écarté
Une bande sur tout le dôme : lisait comme une plaque. Restreinte à l'implantation + la raie.

## Vérification
`crown-tone-not-black` (sous-couche ≥ 0,41 × luminance), `root-band-not-black` (repousse ≥ 0,15 ×), `root-band-inside` (`hair-form.ts` : la bande reste dans la coque). Test : `tests/hair-coherence.test.ts` (racine sombre, teinte rose).

## Limites
Planchers 0,42 et 0,16 calibrés sur le corpus, pas sur une référence dessinée. Pas de repousse sur les mèches individuelles ni sur la nuque. Revue humaine nécessaire (`HAIR-FORM-REVIEW.md`).
