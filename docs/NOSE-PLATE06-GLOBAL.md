# Planche 06 : ajustement global (v3)

Suite de `NOSE-ASPECT-CEILING.md`. Objectif : reprendre ellipse large, trapèze plat et losange (résidus v2 : 0,44 / 0,16 / 0,31, seuil de reproductibilité 0,15).

## Ce qui a changé par rapport à la v2
Script unique : `scripts/nose-refs/fit.ts` (la v2 est archivée dans `references/nez/fit-06-v2.json`, la v1 dans `fit-06-v1.json`).
- **Même** fonction de coût (RMS du profil de largeur sur les 18 premiers niveaux sur 25 + 0,25 × |log(L/H ÷ L/H de référence)|) et **mêmes** bornes.
- **Optimiseur** : Nelder–Mead borné à redémarrages (30 par forme, deux passes de 250 itérations, graine propre à chaque forme). La v2 faisait 600 tirages puis une descente par coordonnée.
- **Axes ajoutés** : `nose.tip.rotation` et `nose.alae.attachment`. Un balayage de sensibilité (±0,4 autour du défaut) a donné un effet sur la silhouette de 0,085 et 0,026.
- **Axes retirés** : `nose.alae.volume` et `nose.dorsum.width` (effet 0,000 sur la silhouette). Ils restent à la valeur par défaut du schéma, au lieu d'une valeur arbitraire tirée au hasard par la v2. Conséquence : l'aspect éclairé de pyramide et cloche-ailes change par rapport à la v2.
- Paramètres arrondis à 4 décimales (à 3, la pyramide passait de 0,0708 à 0,0929 : solution sensible à l'arrondi).

Reproduire : `npx tsx scripts/nose-refs/fit.ts 30 <0..4>` (chaque forme, ~3 min) puis `npx tsx scripts/nose-refs/fit.ts emit` (écrit `fit-06.json` et `archetypes.generated.ts`).

## Résultats
| Forme | Résidu v2 → v3 | L/H v3 | L/H réf. | Statut |
|---|---|---|---|---|
| pyramide | 0,0721 → 0,0708 | 0,730 | 0,73 | exportée |
| cloche-ailes | 0,1227 → 0,0992 | 0,977 | 0,977 | exportée |
| plat-trapèze | 0,1644 → **0,1341** | 1,228 | 1,228 | **exportée (nouveau)** |
| losange | 0,3098 → 0,2687 | 1,045 | 1,52 | non reproduit |
| ellipse large | 0,4408 → 0,3980 | 1,044 | 1,60 | non reproduit |

Ellipse et losange : leur L/H de référence dépasse le plafond 1,399 de la silhouette de face ; l'optimiseur, qui arbitre entre profil et L/H, s'arrête à L/H ≈ 1,04. Les 5 meilleurs redémarrages donnent des résidus voisins (±0,003) : ce n'est pas un minimum local de recherche mais la borne du modèle.

## Vérifications
- Superposition sur la planche réelle : `artefacts/nez-planche06-v3/01-superposition-v2-v3.png` (v2 gris, v3 vert). Le haut du plat-trapèze suit la référence ; son cou est plus étroit que le haut large de la référence, et les ailes font des crochets sous la ligne de comparaison.
- Têtes complètes : `artefacts/nez-planche06-v3/02-tetes-archetypes.png` (face et 3D à 30°). À 30°, l'aile lointaine du plat-trapèze déborde du contour de la joue.
- Deux moteurs : résidu sur visage neutre identique en `classic` et `structured` (`references/nez/archetype-engines.json`). Sur 40 visages aléatoires, L/H du plat-trapèze : 1,12 à 1,40, médiane 1,28 (réf. 1,228).
- Tests : `tests/nose-archetypes.test.ts` (résidu recalculé depuis la référence, ellipse et losange déclarés non reproduits, plat-trapèze exporté et L/H à ±3 %), `tests/nose-refs-aspect.test.ts` (v3 ≤ v2 ≤ v1).
- `verifyFace` sur 24 graines : 0 erreur en tirage libre, cloche-ailes et plat-trapèze ; 1 erreur en pyramide (`round-dome-centered`) : voir `NOSE-DOME-COUPLING.md`.

## Limites
- Le résidu ne compare que 72 % du haut de la silhouette ; le bas (contour du lobule) n'est pas comparé.
- Paramètres du plat-trapèze presque aux bornes (`tip.width` 1, `tip.rotation` 0,9987, `root.height` 0,0003, `width` 0,2998) : forme extrême, pas un nez « moyen ».
- L'option `noseArchetype: 'random'` choisit maintenant parmi 3 archétypes : les graines déjà utilisées avec `'random'` peuvent changer d'archétype (sans l'option, aucun visage ne change).
- Restent hors de portée : ellipse large et losange (exigent une silhouette qui ne part pas de la racine).
