# Lisière des cheveux — reste à faire et limites (par composant)

Ce qui est fait : `HAIR-BOUNDARY.md`. Suite traitée (coque, portée, masse arrière, vérification crâne ↔ cheveux) : `HAIR-SKULL.md`, ses limites : `HAIR-SKULL-REMAINING.md`. Suite 2 (portée au polygone, attaches, vent, vocabulaire, 13 contrôles) : `HAIR-COHERENCE.md`, limites `HAIR-COHERENCE-REMAINING.md`. Suite 3 (remplissage de la coque, couche `hair-form`) : `HAIR-FORM.md`, limites `HAIR-FORM-REMAINING.md`. Rien ci-dessous n'est caché : chaque ligne est une limite mesurée ou constatée sur les planches.

## Lisière (`boundary/`)
1. **Seuils à la main** : 0,12 H (trou), 0,05 H (dents de scie), 0,25 (oreille libre), 0,1 (bord lisible) sont posés sur le corpus de 600 visages, pas appris d'une référence. À recaler sur des visages dessinés par un illustrateur.
2. **Profil de profondeur `b(y)`** : modèle simple (demi-ellipsoïde, plancher 0,3 rz). Il n'est pas aligné sur le crâne de profil (`src/skull/`) ; l'occiput et la nuque ne sont pas contrôlés contre la vue de profil.
3. **Nuque** (non traité dans la série 3) : hauteur déduite de la mâchoire et des oreilles ; pas de forme de nuque propre (rasée, dégradé, queue de cheval haute).
4. **Visage non symétrique** (non traité dans la série 3) : le miroir gauche utilise les oreilles gauches, mais pas de patte asymétrique indépendante (la patte vient d'un seul profil).

## Formes de cheveux et coque
5. **Moteur v2 — traité pour l'extension** (`HAIR-SKULL.md`) : toutes les formes libres et les mèches de corps sont bornées par une portée par coiffure ; la masse arrière du bob/long est reconstruite (`HAIR-BACK-MASS.md`). `afro` (0,256 H) et `curly` (0,164 H) restent volumineux par conception ; élégance = revue humaine (`HAIR-SKULL-REMAINING.md` 2, 9).
6. **Moteur classic** : frange `short` refaite en festons arrondis (voir `HAIR-SHAPES.md`) ; jugement d'élégance = revue humaine. MAJ série 3 : la frange `short` n'est plus un peigne (écarts/largeurs inégaux, `HAIR-FORM-FRINGE.md`) ; la frange `wispy` garde un fin zigzag.
7. **Archétypes simulés (Verlet)** : leurs mèches restent non bornées (drapé déjà résolu) ; ils reçoivent la nouvelle masse arrière ; régions `own` → portée de coque `none`. Leur lisière propre n'est pas reliée à `boundary`.
8. **Vue de profil des cheveux** (`src/skull/hair-shape.ts`) : n'utilise pas la nouvelle lisière.
9. **Coque** : épaisseur plafonnée par coiffure (`THICKNESS`, `HAIR-SKULL.md`) en plus de la table `SHELL` ; toujours pas dérivée du volume réel de la masse, pas de coupe en dégradé ni de raie rasée. `SHELL.buzz.reach` passe à `none` (plateau de tempe supprimé).

## Rotation de la tête
10. **Relié depuis `HEAD-TURNTABLE-HAIR.md`** : la lisière alimente la tête tournante (`headSpecFromFace`). Reste : volume 3D. Historique : interface seulement (+ module voisin) : `projectBoundary` et `skullSurface.project` tournent la lisière de façon rigide (testé) ; le **rendu complet d'un visage tourné n'est pas branché** (planche 04 = schéma de géométrie). Le commit distant `327f2b9` (`src/head-turntable`, `docs/HEAD-TURNTABLE.md`) rend une tête complète en rotation avec sa PROPRE ligne d'implantation (`hairlineY`) : il n'importe rien de `src/face` ; relier cette lisière à ce module n'est pas fait (et aucun conflit : fichiers disjoints).
11. Les mèches (`front`, `wings`, masses) ne sont pas encore implantées en 3D sur les repères de racine : elles restent en 2D de face.
12. Visibilité : la pente verticale de la normale est négligée (seule l'azimut compte) ; suffisant pour la lisière, pas pour des mèches.

## Vent
13. Vent 2D de face intégré (`HAIR-WIND.md`), borné par la portée de la coiffure (`HAIR-WIND-REACH.md`). `windDir` ne donne que **la direction et la portance** par racine ; aucune intégration (Verlet, ressort) ni soufflage dans les moteurs de rendu. Planche 05 = champ de flèches.
14. Pas de turbulence, pas de rafale, pas de couplage avec `sim/`.

## Rendu du bord
15. **Effet discret** : l'ombre de transition varie de 0,03 à 0,2 d'opacité ; sur la planche 06 la différence nette / floue se lit surtout sur la coupe, peu sur l'ombre.
16. Contraste mesuré en luminance seule (pas de teinte, pas de sous-tons de peau).
17. MAJ : l'angle des cheveux fous suit le flux de la mèche voisine (`HAIR-FORM-DOMES.md`) ; leur nombre reste tiré, non relié à la densité.

## Vérification
18. « Rapport OK » ≠ beauté : la couche style vérifie lissé, équilibre, lisibilité du bord. Elle ne juge ni l'élégance de la coupe ni la cohérence de silhouette. **Revue humaine nécessaire** sur `artefacts/hair-boundary/07` et `artefacts/hair-skull/`. Cohérence crâne ↔ cheveux : 12 contrôles de plus (`HAIR-SKULL-VERIFY.md`).
19. Corpus : coiffures et textures du schéma ; pas de visage d'enfant ni de coiffure hors table (`SHELL`).
20. Régression visuelle : `npm run regress` passe, mais ses 34 images n'ont pas bougé (rms ≤ 0,26/255) : soit elles ne montrent pas les cheveux modifiés, soit le changement y est sous le seuil (cause non vérifiée). Ajouter des références avec cheveux (non fait : actualiser les références est une décision explicite). Revérifié après les changements crâne ↔ cheveux : exit 0, 34 images, rms ≤ 0,26/255. Revérifié après `hair-form` : exit 0, toutes `exact`.

## Sécurité
21. **Un jeton GitHub a été collé en clair dans la conversation (de nouveau lors de la série `hair-form`) : à révoquer** (GitHub → Settings → Developer settings → Tokens). Il n'est écrit nulle part dans le dépôt, ni dans l'URL du dépôt distant ; il n'a servi que par un en-tête temporaire.
