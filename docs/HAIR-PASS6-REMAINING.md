# Moteur capillaire — reste à faire après la passe 6, par composant

Bilan et mesures : `HAIR-PASS6.md` · `HAIR-PASS6-MEASURES.md`. Remplace `HAIR-PASS5-REMAINING.md` pour les points traités ; ce qui n'y est pas repris reste valable tel quel.
Rien de ce qui suit n'est présenté comme fait.

## Raie
- Lue sur référence : FAIT (`fitFromReferencePart`) pour une raie DROITE, sillon net, vue de face testée à ±30°/±60° pour la conversion image → crâne. Reste : raie lue sur une vraie illustration (dégradés, reflets, chapeau) — `observePart` travaille sur masque binaire, la binarisation décide du résultat ; non testé.
- `GROOVE_MAX_H` = 0,14 H reste un plafond du moteur, pas une cible d'illustration (raie réelle plus fine). Exige une grammaire de bords de raie.
- Côté détourné (±30° et au-delà) : raie hors de la calotte visible, « non lisible », donc non vérifiée. L'inversion image → crâne ne retrouve pas un point caché : en cas de raie lue de ce côté, aucune garantie.
- Raies non droites (zigzag, courbe, « en V ») : la ligne est toujours `x = xp`.
- Résiduels `anat.dome` (raie −0,4 et −0,3, 30°, graine 1) ; rideaux ajoutés choisis par recherche locale sans intention de forme.
- L'ajustement sur référence ne retrouve que la raie, le volume et le poids : la silhouette de la référence n'est pas reproduite (planche 04).

## Reflet transversal (`spec-ring.ts`)
- Option `ring` désactivée par défaut dans `paint-pro.ts` : AUCUN appelant du rendu principal ne l'active. Brancher exige de juger les planches 01–02 et de décider `replace` ou `add`.
- Mesures : deux rubans (panneaux A, B) ; panneau C (éventail) non mesuré ; invariance longueur / largeur de l'étendue indéterminée.
- Seuils NON mesurés : `minNH`, `fullNH`, `bodyWidth`, `minCoverage`. À rejuger sur des artefacts, ou sur davantage de références.
- Lisibilité : sur un ton de mèche très clair, le reflet blanc a peu de contraste ; la bande se lit surtout par son ombre aval (planche 02). Pas de reflet coloré, ni de reflet sur les mèches `mass` pliées à moins de 0,3 de couverture (volontairement omis).
- Un seul reflet par mèche ; pas de reflet secondaire (double bande des cheveux lisses), pas de lien avec la texture (bouclé, crépu).
- Le reflet n'est pas lié au relief du crâne : l'occlusion locale entre mèches est prise en compte, pas l'ombre portée du crâne ou des oreilles.

## Vérification de rendu (géométrie · anatomie · style)
- Ajout : `verify-ring.ts` (reflet), 18 cas vérifiés sur 3 lumières × 3 graines × 2 lacets, 5 mutations testées. Non branché dans `compose-verify.ts` ni dans `repairCycle` : un reflet fautif est signalé, jamais réparé ; aucun `Defect` émis (rapports seulement).
- Inchangé : `Defect.visible` non consommé ; `geom.fold3d` non défini comme défaut ; style = seuils, pas de jugement esthétique ; pas de lancer de rayon ; `anat.balance` sans réparation par ajout de mèche.
- Remplissage de calotte : une seule famille (la dominante).
- Contrôle de style « part de mèches à reflet » : borne 15–85 % d'ingénierie, non mesurée.

## Apparence du moteur principal
- Fait : opacité de l'ombre de peau selon l'intensité et la douceur ; brillance principale selon l'intensité (`hair`).
- Reste : la forme de l'ombre vient toujours de la simulation (ruban décalé), sans projection réelle ; groupe translaté, pas d'occlusion par le relief (arcade, nez) ; la couleur de la lumière ne teinte pas l'ombre de peau.
- Reste : la brillance de grammaire (`grammar ring`) n'est pas branchée sur le rendu principal ; les deux pipelines ont encore deux brillances distinctes.
- `part`/`sim` sans `geom` 3D complète (largeur, torsion, occlusion).
- Dégradé de teinte des mèches indépendant de la lumière 3D.
- La planche 03 fait varier l'intensité de TOUTE la scène : elle ne prouve pas l'effet isolé sur les cheveux (preuve : tests à mutation).

## Tests d'autres flux
- `eye-gallery-ext3` et `nose-visibility` échouaient avant mes changements (hash de SVG des passes yeux/nez) ; à traiter par ce flux, jamais en relâchant l'assertion. Si la suite hors cheveux montre d'autres écarts, ils sont listés dans le message de livraison, pas ici.

## Interopérabilité
- Toujours aucune chaîne unique génération → adaptation → rendu principal ; `generateIntended` et `fitFromReferencePart` non branchés sur `autofit` / `iso-verify`.

## Discipline
Chaque fichier de `docs/` ≤ 200 lignes. Jetons et identifiants ne sont jamais écrits dans le dépôt.

## Mise à jour
État à jour après la passe 7 : `HAIR-PASS7-REMAINING.md` (ombre aval mesurée, raie cachée rejetée, garde de rendu ; chaque point ci-dessus y est repris avec son statut).
