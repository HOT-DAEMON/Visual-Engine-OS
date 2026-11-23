# Moteur capillaire — reste à faire après la passe 4, par composant

> Mis à jour par la passe 5 : raie, ombre de peau et segmentation sont traitées dans `HAIR-PASS5.md` / `HAIR-PASS5-REMAINING.md` (les lignes correspondantes ci-dessous sont dépassées).

Bilan et mesures : `HAIR-PASS4.md`. Ce fichier remplace, pour les points qu'il traite, `HAIR-PASS3-REMAINING.md` (dont les lignes soldées sont marquées).
Rien de ce qui suit n'est présenté comme fait.

## Vérification de rendu (géométrie · anatomie · style)
- `Defect.visible` n'est consommé nulle part : un défaut enfoui pèse autant qu'un défaut visible. Non traité.
- `geom.fold3d` : mesuré à 0 sur 600 mèches mais toujours pas défini comme défaut ; proxys « tour 3D > 90° » pour les mèches `nearSide` en intention lourde.
- Style = garde-fou à seuils, aucun jugement esthétique. Le contrôle « filles plus fines que leur mère » est borné à 1 : pas de test de proportion plus fine (fray 0,16, fork 0,52–0,66, join 0,35 restent des constantes de `emerge.ts`).
- Pas de lancer de rayon contre les mèches voisines : visibilité par raster à 2 px, tête convexe.
- La phase 3 de réparation ne traite que `anat.dome`. Les autres défauts globaux (équilibre G/D, `anat.balance`) n'ont pas de réparation par ajout de mèche.
- Le remplissage ne pose qu'UNE famille (la dominante) : pas de choix de famille selon la zone (frange sur le front, masse sur la couronne).
- Une mèche ajoutée est cohérente avec la grammaire (même famille, même tirage) mais n'est pas « intentionnelle » : pas de rideau symétrique de part et d'autre de la raie (ce serait un second ajout lié au premier).

## Art direction — raie (point ouvert principal)
- Netteté mesurée en baisse après remplissage (0,85 → 0,76 ; 0,84 → 0,69 ; 0,77 → 0,50). La métrique lit une FENÊTRE chauve large, pas une ligne mince à la position demandée : elle entre en conflit avec le seuil de calotte. Piste : mesurer la raie comme un SILLON (largeur ≤ 0,07 H, position = demande) dans `observe-structure.ts`, puis le réconcilier avec `tests/hair-engine-art.test.ts` (clarté ≥ 0,6 en génération brute).
- Chutes par graine non élucidées (intention complète graine 5 : 1,00 → 0,09). Hypothèse non vérifiée : d'autres réparations locales (frange/volume) fermant le couloir, pas le remplissage lui-même — `repair-local` ne connaît pas le couloir de la raie.
- « Frange +1 » : raie lue à −0,55 sans raie demandée (inchangé). Reflets (`gloss`), tension entre masses : mesurés, non pilotés.

## Observation et ajustement
- La segmentation par mèche (`observe-strands.ts`) n'est PAS branchée dans `fitFromReference` : ses grandeurs (nombre de mèches visibles, largeur moyenne et CV, longueur) ne pilotent aucun axe d'intention. Étalonnage à faire sur la grammaire comme pour `observationsToSpec`.
- Qualité mesurée : rappel ≈ 0,53, précision ≈ 0,63, pureté ≈ 0,86 sur des rendus du moteur (traits d'encre 1 px, 156×150). Limites connues : sur-segmentation d'une mèche coupée par une mèche qui la recouvre ; sous-segmentation de deux mèches de même ton sans trait ni ombre (une seule composante, testé).
- Non validée sur de VRAIES illustrations (anti-crénelage, dégradés, traits irréguliers) : seuils `VALLEY` 0,07, `REACH` 2, `CORE` 1 mesurés sur le raster du moteur uniquement. Pas d'ordre racine → pointe, pas de nombre de `LockSpec` (les mèches enfouies sont invisibles par construction).
- Identifiabilité (`weight −0,5` → ajusté `+0,21`), convergence non monotone sans critère d'arrêt par meilleur pas, hiérarchie au niveau FAMILLE, types de pointes : inchangés (voir `HAIR-PASS3-REMAINING.md`).

## Forme et flux
- Ramification : `branchHair` reste un post-traitement (non intégré aux profils) ; pas de réseau de jonctions à plusieurs niveaux ni d'enroulement.
- Boucle : un seul tour à plat. Ruban : largeur apparente + épaisseur forfaitaire `RIBBON_K = 0,3` (laissé en l'état : la mesure ne montre aucun défaut à corriger).

## Composition et occlusion
- Soldé : profondeur de volume (mesurée comme fiable à 2,9 % par tronçon ; le « 0,11 → 0,17 » était du bruit). Reste : sous-couche qui réapparaît à travers un trou, ombre douce/ambiante. Mode `all` toujours OPT-IN.
- Le critère `segRate` n'est pas encore un défaut du vérificateur (mesure de recherche seulement).

## Apparence du moteur principal
- Fait : portée de l'ombre portée selon l'élévation ; exposition cylindrique pour `part`/`sim`.
- Reste : `skinShadows` (ombre des cheveux sur la peau, `hair.ts`) garde une opacité fixe et une forme issue de la simulation, sans lien avec `ld` ni l'élévation. Le dégradé de teinte des mèches ne dépend pas de la lumière 3D.
- `part`/`sim` n'ont toujours pas de `geom` (largeur, torsion, occlusion) : seule l'exposition est dérivée. Pas de lecture « tube » de l'occlusion entre faisceaux.
- Pas de comparaison pixel à pixel sur une scène complète du générateur principal : la preuve porte sur `celBands` et `lockMarkup` (tests + planche 04).
- Filtres SVG : aucun n'est directionnel (analysés) ; grain/flou non traités comme effets de matériau.
- Reflets/brillance comme axe du générateur : `ArtMeasure.gloss` = 0 sur la planche 07 de la passe 3.

## Interopérabilité
- Aucune chaîne unique génération → adaptation → rendu principal ; `generateIntended` n'est pas branché sur `autofit`/`iso-verify`.

## Discipline
Chaque fichier de `docs/` ≤ 200 lignes ; au-delà : un `-REMAINING` ou une suite. Jetons et identifiants ne sont jamais écrits dans le dépôt.
