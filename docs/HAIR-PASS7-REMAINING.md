# Moteur capillaire — reste à faire après la passe 7, par composant

Bilan : `HAIR-PASS7.md` · mesures : `HAIR-PASS7-MEASURES.md`. Remplace `HAIR-PASS6-REMAINING.md` : chaque point y est repris ci-dessous.
État à jour après la passe 8 : `HAIR-PASS8-REMAINING.md` (ombre lisse FAITE, reflet branché sur le rendu principal, `replace` par mèche).
Statuts : FAIT · PARTIEL · NON FAIT (avec la raison) · DÉCIDÉ DE NE PAS FAIRE (avec la raison). Rien n'est présenté comme fait sans preuve (tests, planches, `metrics.json`).

## Raie
- Lecture sur référence : FAIT pour une raie droite à sillon net. Point caché : FAIT (rejet si l'erreur de re-projection dépasse 0,03 rx) ; lisible pour |u| ≲ 0,68 rx à 0°, ~47 % des positions à 75° de lacet.
- Raie lue sur une vraie illustration (dégradés, reflets, chapeau) : NON FAIT. `observePart` travaille sur masque binaire ; la binarisation décide du résultat. Il faut un jeu d'illustrations avec raie annotée.
- `GROOVE_MAX_H` = 0,14 H : NON FAIT. Plafond du moteur, pas une cible d'illustration ; exige une grammaire de bords de raie.
- Raies non droites (zigzag, courbe, « en V ») : NON FAIT. La ligne est toujours `x = xp`.
- Résiduels `anat.dome` (raie −0,4 et −0,3, 30°, graine 1) : NON FAIT. Rideaux ajoutés par recherche locale, sans intention de forme.
- Silhouette de la référence non reproduite (4 axes d'intention) : NON FAIT.

## Reflet transversal
- Mesures : FAIT pour A, B, C (`HAIR-PASS7-MEASURES.md`). Invariance longueur / largeur de l'étendue : toujours indéterminée (rubans ~4,5, mèche ~9 ; l'éventail ne la tranche pas).
- Défaut `ring: 'off'` : NON DÉCIDÉ. Aucun appelant du rendu principal ne l'active. Décider `replace` ou `add` exige de juger les planches 01–02 (discrètes à l'échelle de la tête) et de brancher le reflet sur le rendu principal.
- Seuils `minNH`, `fullNH`, `bodyWidth`, `minCoverage` : NON FAIT, non mesurés. Piste : les calibrer pour que la part d'aire retrouve 1,39 % (18 cas : 1,24–3,07 %, donc plutôt trop de reflet à ce seuil). Une seule référence : à corroborer sur d'autres.
- Ombre à bords durs : NON FAIT. Trois paliers contre un dégradé lisse ; à 0,30–0,42 L la passe 7 est plus sombre que la référence. Piste : `linearGradient` le long de l'axe de la mèche, à condition que `ring-check` sache le lire.
- Lisibilité sur ton très clair : le reflet blanc garde peu de contraste ; la bande se lit surtout par son ombre (maintenant à −33,5 %).
- Un reflet par mèche : NON FAIT (pas de double bande des cheveux lisses, pas de lien avec la texture bouclée / crépue). Pas de reflet coloré.
- Lien avec le relief du crâne : NON FAIT. L'occlusion entre mèches est prise en compte, pas l'ombre portée du crâne ou des oreilles.

## Vérification de rendu (géométrie · anatomie · style)
- FAIT : défauts localisés `Defect` (`ring-check.ts`), garde de rendu à la peinture, deux contrôles de style mesurés, mutation testée.
- NON FAIT : le reflet n'est pas branché dans `compose-verify.ts` ni `repairCycle` ; un reflet fautif est écarté à la peinture, jamais réparé (retailler la lame).
- NON FAIT : `Defect.visible` non consommé ; `geom.fold3d` non défini comme défaut ; pas de lancer de rayon ; `anat.balance` sans réparation par ajout de mèche.
- Style = seuils, pas de jugement esthétique. Les bornes [×0,25 ; ×4] de la part d'aire sont d'ingénierie, centrées sur une mesure.
- Calotte : une seule famille de remplissage (la dominante).

## Apparence du moteur principal
- FAIT (passes 6–7) : opacité de l'ombre de peau selon l'intensité et la douceur ; brillance principale selon l'intensité ; isolement prouvé (planche 07 : 0,0 % du bas du visage change).
- NON FAIT : brancher le reflet de grammaire sur le rendu principal (`HairLockGeom` / `lockMarkup`). La brillance principale à intensité 1 est un halo flou, pas un reflet de mèche : deux brillances distinctes subsistent. C'est le chantier suivant le plus utile.
- NON FAIT : forme de l'ombre de peau issue de la simulation (ruban décalé), sans projection réelle ; pas d'occlusion par le relief (arcade, nez).
- DÉCIDÉ DE NE PAS FAIRE : teinte de l'ombre de peau selon la couleur de la lumière, côté cheveux seuls. C'est une propriété de `skinAppearance`, partagée par tout le corps ; la teinter partout relève du pipeline peau.
- NON FAIT : `part` / `sim` sans `geom` 3D complète (largeur, torsion, occlusion).
- NON FAIT : dégradé de teinte des mèches indépendant de la lumière 3D.

## Tests d'autres flux
- `eye-gallery-ext3` et `nose-visibility` : NON VÉRIFIÉ cette passe. Échouaient avant (hash de SVG des passes yeux / nez) ; à traiter par ce flux, jamais en relâchant l'assertion.
- Suite capillaire complète (> 10 min) : une exécution de référence en arrière-plan s'est arrêtée sur UN échec non identifié ; non reproduit ni attribué. À relancer fichier par fichier.
- Contrôle de régression de rendu (`npm run regress`) : voir le message de livraison pour le résultat de cette passe.

## Données
- `references/hair/68.png` est un fichier de 2 octets (un saut de ligne), illisible : à remplacer.

## Interopérabilité
- NON FAIT : aucune chaîne unique génération → adaptation → rendu principal ; `generateIntended` et `fitFromReferencePart` non branchés sur `autofit` / `iso-verify`.

## Discipline
Chaque fichier de `docs/` ≤ 200 lignes. Jetons et identifiants ne sont jamais écrits dans le dépôt.
