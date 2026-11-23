# Moteur capillaire — reste à faire après la passe 5, par composant

Bilan et mesures : `HAIR-PASS5.md` (raie, ombre de peau) · `HAIR-PASS5-SEGMENT.md` (segmentation). Remplace `HAIR-PASS4-REMAINING.md` pour les points traités ; ce qui n'y est pas repris reste valable tel quel.
Rien de ce qui suit n'est présenté comme fait.

## Raie
- `GROOVE_MAX_H` = 0,14 H est un PLAFOND DU MOTEUR (les rideaux générés laissent 0,07–0,15 H), pas une cible d'illustration : une raie réelle est plus fine (quelques % de H). La génération vise 0,85 × le plafond (≈ 0,12 H). Affiner exige des mèches-rideaux plus étroites et plus proches, donc une grammaire de bords de raie (mèches « en lame » qui se séparent), pas un réglage de seuil.
- Côté détourné : à ±30° et au-delà, la raie du côté éloigné est hors de la calotte visible ; elle est « non lisible », donc non vérifiée (20 cas sur 50 de la planche 03). Aucune lecture n'existe pour une raie visible par transparence ou sous une mèche `over`.
- Résiduels `anat.dome` (raie −0,4 et −0,3, 30°, graine 1) : le remplissage ne peut pas atteindre la couverture exigée sans fermer le couloir ; priorité actuelle = le couloir. À arbitrer (assouplir la calotte près de la raie ou ajouter des rideaux plus larges).
- Raie placée par `applyPart` + `shapePart` à la GÉNÉRATION seulement : une raie lue sur une référence (`observePart`) n'est pas encore transformée en `Intent.part` dans `fitFromReference`. L'observateur existe, le câblage non.
- Raies non droites (zigzag, raie latérale courbe, raie « en V » de frange) : la ligne est toujours `x = xp` sur le crâne.
- Rideaux ajoutés : cohérents (famille, tirage) mais choisis par recherche locale, sans intention de forme. Sur la planche 02, des mèches de flanc de 0,3 H peuvent traverser le front (anat.eye réparé ensuite, mais le tracé reste un peu lourd).

## Vérification de rendu (géométrie · anatomie · style)
- Ajout passe 5 : contrôles et défauts de raie (`style.part`, `style.partgap`) lisant la MÊME ligne que la génération, le solveur et le remplissage.
- Inchangé : `Defect.visible` non consommé ; `geom.fold3d` non défini comme défaut ; style = seuils, pas de jugement esthétique ; pas de lancer de rayon ; équilibre G/D (`anat.balance`) sans réparation par ajout de mèche (observé pour raie ±0,4 avec peu d'échantillons).
- Le remplissage de calotte ne pose toujours qu'une famille (la dominante) ; `closeFlanks` en essaie 3.

## Observation et ajustement
- Segmentation : étudiée, branchement RETIRÉ (résultat négatif mesuré, `HAIR-PASS5-SEGMENT.md`). Non validée sur de vraies têtes entières (aucune annotée dans le dépôt).
- `observePart` fonctionne sur masque binaire ; sur une vraie illustration (dégradés, reflets, chapeau) la binarisation décide du résultat : non testé.
- Inchangés : identifiabilité du poids, convergence sans critère d'arrêt par meilleur pas, hiérarchie au niveau famille.

## Apparence du moteur principal
- Fait : ombre de peau des mèches suivant la lumière (azimut, élévation) ; ombre portée selon l'élévation (passe 4).
- Reste : l'OPACITÉ de `skinShadow` est fixe (ne dépend pas de l'élévation ni de l'intensité) ; la forme de l'ombre vient toujours de la simulation (ruban décalé, pas de projection réelle sur la surface du front) ; le groupe est TRANSLATÉ, pas recalculé : aucune occlusion par le relief (arcade, nez).
- `part`/`sim` n'ont toujours pas de `geom` 3D complète (largeur, torsion, occlusion) ; seule l'exposition cylindrique est dérivée. Non traité cette passe : c'est une refonte du faisceau, pas un correctif.
- Dégradé de teinte des mèches indépendant de la lumière 3D ; reflets (`gloss`) non pilotés.

## Tests d'autres flux
- `eye-gallery-ext3` et `nose-visibility` échouent à l'identique sur le commit de départ (hash de SVG recalés à chaque passe yeux/nez). À traiter par le flux yeux/nez ; jamais en relâchant l'assertion.

## Interopérabilité
- Toujours aucune chaîne unique génération → adaptation → rendu principal ; `generateIntended` non branché sur `autofit`/`iso-verify`.

## Discipline
Chaque fichier de `docs/` ≤ 200 lignes. Jetons et identifiants ne sont jamais écrits dans le dépôt.
