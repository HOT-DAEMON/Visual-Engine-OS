# Dômes des coiffures tirées et de la coupe rase (`comb.ts`)

Suite de `HAIR-FORM.md`. Traite `HAIR-FORM-REMAINING.md` 7 et `HAIR-SKULL-REMAINING.md` 15.

## Problème
`ponytail`, `bun`, `braids` et `buzz` n'avaient aucune mèche sur le dessus du crâne (bord nu 0,88 à 1,00) : aplat lisse, casque.

## Modèle (graine propre `h.seed ^ 0xc0b0`, exécuté en dernier : le reste est identique)
- **Tirées** (queue, chignon, tresses) : 78 stries fines (`hairline`) parties entre l'implantation et l'arc du crâne, courbées vers l'attache (sinon le sommet pour des tresses ; une attache basse est ramenée à ≤ 0,1 H sous le sommet), alternance reflet / séparation. Aucun volume ajouté.
- **Rase** : 220 brins de chaume radiaux, 0,014 à 0,030 W, avec DÉGRADÉ (`FADE` : de 0,55 à 0,98 de la demi-largeur) : voile de peau côté tempes (`${id}-hair-fade`), source unique `fadeAt` pour traits et rendu.
- **Matière** : la sous-couche rase est mate (`underlayer(..., 'matte')`), `hairGloss` ×0,2 : le satin faisait un casque plastique.
- Rognage au bord de la coque ; `thinning` éclaircit.
- **Cheveux fous** : l'angle suit le flux de la mèche voisine (`nearestFlow`), ± 0,35 rad ; sans mèche voisine, l'ancien éventail.

## Vérification
`comb-inside-shell` (≤ 0,05), `dome-combed` (≥ 0,4 du quota), `comb-style-scope` (aucune strie hors coiffure tirée/rase) ; `envelope-coverage` exclut les traits `comb`.

## Limites
Le chaume mat montre encore une tache diffuse. L'intérieur du dessus des cheveux longs reste une coque lisse là où aucune mèche ne passe. Seuil 0,4 calibré sur corpus.
