# Moteur capillaire — reste à faire après la passe 3, par composant

Bilan et mesures : `HAIR-PASS3.md`. Les points de la passe 2 non repris ici sont soldés (volume +1 lourd, résidus 30°/60°/−75°, tests en degrés,
ramification, volume en mode `all`, lumière commune, ajustement en boucle fermée). Ce qui suit est ce qui n'est PAS fait ou seulement en partie.

## Vérification de rendu (géométrie · anatomie · style)
- Intention combinée (volume 0,6 · frange 0,5 · raie −0,3 · pointes 0,5 · poids 0,3, graine 2) : le contrôle de style « variété des largeurs (CV) » échoue à 0,94 (limite 0,9) à TOUS les lacets. Cause probable : les pointes libres (`fray`) sont fines par construction et tirent le CV. Piste : mesurer le CV sur les mèches sans mère, ou une limite dépendante de `Intent.tips`. Non fait pour ne pas assouplir un seuil sans mesure.
- Même cas à 30° : `anat.dome` « calotte couverte » 63 % (< 70 %), non réparé par le solveur local (score 4 → 2). Piste : réparation `anat.dome` qui ajoute une mèche de masse, aujourd'hui absente de `FIXES`.
- `Defect.visible` (porté par les défauts) n'est consommé nulle part : un défaut enfoui devrait peser moins.
- Contrôle `geom.fold3d` (pli 3D de la lame) : mesuré à 0 sur 600 mèches mais pas défini comme défaut. Quelques proxys « tour 3D > 90° » subsistent pour les intentions lourdes sur les mèches `nearSide`, alors que la métrique réelle `geom.self` vaut 0 après réparation.
- Style = garde-fou à seuils ; aucun jugement esthétique n'est tenté.
- Pas de lancer de rayon contre les mèches voisines : la visibilité est par raster à pas de 2 px, tête convexe (exacte pour un crâne convexe, conservatrice sinon).

## Observation et ajustement
- Segmentation PAR MÈCHE d'un raster de référence : non faite (7 grandeurs du TODO non mesurées). `observe-structure` travaille par régions de flux, pas par mèche.
- Identifiabilité : plusieurs intentions donnent la même image (vérité `weight −0,5` → ajusté `+0,21`). Il faut des mesures qui séparent les causes, ou une pénalité vers l'intention neutre.
- Convergence non monotone (erreur de largeur 0 → 0,01 à l'itération 4) : pas de critère d'arrêt par meilleur pas.
- Hiérarchie au niveau FAMILLE (et non région) : non faite. Types de pointes (effilée / franche) non mesurés.
- Pas d'images « avant » sans coque ; le fit n'est validé que sur des rendus du moteur lui-même (pas sur de vraies illustrations).

## Forme et flux
- Ramification : `splitLock`/`fray`/`joinLocks`/`loopLock` posés et testés, MAIS non intégrés au générateur de profils : seul `branchHair` (post-traitement) les emploie. Pas de réseau de jonctions à plusieurs niveaux, pas d'enroulement autour d'une autre mèche.
- Boucle : un seul tour à plat ; pas d'enroulement en spirale 3D.
- Ruban : toujours une largeur apparente + épaisseur forfaitaire (`RIBBON_K = 0,3`), pas de surface de ruban 3D.

## Composition et occlusion
- Profondeur de volume : le gain n'est qu'agrégé. À 8° de lacet, taux d'inversion par cas : base 29° 0,11 → 0,17 ; lourd 0° 0,01 → 0,10 (voir planche 04). Calibrer `RIBBON_K` par famille ou par largeur relative.
- Sous-couche qui réapparaît à travers un trou ; ombre douce/ambiante : non faites.
- Le mode `all` reste OPT-IN (relations de volume activées seulement quand `mode === 'all'`).

## Apparence
- Lumière : `exposure` branché dans `celBands` et le reflet, mais les ombres de contact et les filtres SVG du principal gardent un `ld` 2D.
- Mèches `part`/`sim` du principal sans `geom` (donc sans exposition).
- Filtres SVG du principal : non traités.
- Reflets/brillance comme axe du générateur : mesurés (`gloss`) mais pas pilotés (`ArtMeasure.gloss` = 0 sur tous les cas de la planche 07).

## Art direction
- Raie : la calotte reste peu couverte autour de la ligne (raie fine avec couverture de la couronne : non faite) ; la raie mesurée est mal lue quand la frange est maximale (« frange +1 » : clarté 0, raie lue à −0,55 sans raie demandée).
- Frange, pointes, raie sont pilotées et mesurées ; reflets, tension entre masses distantes : non.

## Interopérabilité
- Aucune chaîne unique génération → adaptation → rendu principal (voir `HAIR-INTEROP.md`) ; `generateIntended` n'est pas branché sur `autofit`/`iso-verify`.

## Discipline
Chaque fichier de `docs/` ≤ 200 lignes ; au-delà : un `-REMAINING` ou une suite. Jetons et identifiants ne sont jamais écrits dans le dépôt.
