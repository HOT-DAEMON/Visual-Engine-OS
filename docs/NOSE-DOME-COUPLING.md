# Pourquoi `round-dome-centered` dépend du nez

Question posée (suite de `NOSE-BASE-MASS.md` §5) : la règle de cheveux `round-dome-centered` (`lop`, `src/verify/hair-round.ts`) change avec le nez. Pourquoi ?

## Ce que mesure `lop`
Asymétrie gauche/droite de la masse capillaire `geo.base[0]` : `lop = |maxD − maxG| / (maxD + maxG)` (extension horizontale max de chaque côté). Seuil de la règle : 0,05.

## Mesure (graine 174218, afro, seul `nose.length` varie, reste du visage identique)
Reproduire : `npx tsx scripts/nose-refs/dome-lop-coupling.ts` (JSON : `artefacts/nez-dome-couplage/balayage-longueur.json`).

| nose.length | 0,15 | 0,16 | 0,17 | 0,18 | 0,19 | 0,20 | 0,21 | 0,22 | 0,23 | 0,24 | 0,25 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| lop avec rentrage | 0,0510 | 0,0156 | 0,0176 | 0,0238 | 0,0203 | 0,0121 | 0,0205 | 0,0208 | 0,0485 | 0,0149 | 0,0175 |
| lop sans rentrage | 0,0143 | 0,0143 | 0,0143 | 0,0143 | 0,0143 | 0,0143 | 0,0143 | 0,0143 | 0,0143 | 0,0143 | 0,0143 |

Sans le rentrage de la sous-couche (`TUCK`, `src/face/hair/tuck.ts`), `lop` ne bouge plus (écart 4·10⁻⁵ : l'équateur de la coque suit l'oreille à moins d'un pixel). Le rentrage multiplie l'écart par plus de 100 (test : `tests/nose-dome-coupling.test.ts`).

## Chaîne causale
1. Le nez n'agit sur les cheveux que par `lm.noseBaseY` (forcer `noseBaseY` à celle du visage libre supprime l'écart ; parmi les champs du nez, `length` seul reproduit l'écart ; `width` et `root` ont été testés sans effet). Les oreilles sont placées d'après `noseBaseY` (`sides.ts`, `boundary/ear-marks.ts`).
2. Le nombre de mèches de façade change avec la longueur du nez (563 à 588 sur le balayage).
3. `tuckBase` ramène la sous-couche vers le crâne, côté par côté, là où aucune mèche ne la couvre, jusqu'à `maxInset` = 0,05 W (18,7 px). À 0,15 le bord gauche de l'équateur n'est pas couvert (240,9 → 223,7 px), le droit l'est : l'asymétrie passe de 0,014 à 0,051.
4. La coque elliptique (`ellipseOuter`) est quasi identique entre les longueurs (gauche 240,2 à 240,9 px) : elle n'est pas en cause.

## À l'échelle
80 visages afro/bouclés : maximum de `lop` 0,0244 sans rentrage, 0,0479 avec ; aucun ne dépasse 0,05. Le seuil 0,05 est donc la somme de l'asymétrie de base (≈ 0,014 à 0,024) et du retrait maximal du rentrage : la règle mesure surtout le rentrage, pas le dôme.

## Limites de cette étude
- Le lien « hauteur d'oreille → mèches » est établi par ce qui varie (nombre de mèches, bord non couvert) et par l'ablation de `noseBaseY`, pas suivi mèche par mèche.
- `clearCaches()` ne vide pas le cache de contenu de `hairGeometry` (clé = `p`, `W`, `H`) : toute ablation doit casser la clé (epsilon sur un champ inerte) ou ses résultats sont périmés.
- Aucun code de cheveux modifié, aucun seuil relâché. Piste (non faite) : rentrage symétrique pour les styles de `SYMMETRIC_SIDES` ; à valider contre le croissant sombre que le rentrage supprime.
