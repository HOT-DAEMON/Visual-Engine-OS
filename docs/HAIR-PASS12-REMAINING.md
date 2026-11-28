# Moteur capillaire — reste à faire après la passe 12, par composant

Bilan : `HAIR-PASS12.md` ; chignons : `HAIR-BUNS.md`. Reprend `HAIR-PASS11-REMAINING.md` (inchangé pour ce qui n'est pas cité ici).
Statuts : FAIT · PARTIEL · NON FAIT (raison) · DÉCIDÉ DE NE PAS FAIRE (raison). Rien n'est « fait » sans preuve (tests, planches, JSON).

## Coupes
- Chignons doubles / chignon haut : FAIT (40/40 chacun sur 5 lacets). PARTIEL : le chignon est un dôme de mèches posé sur la coque, pas une sphère 3D ; de profil il se lit
  comme une touffe plutôt qu'une boule lisse (planche 05a/05b). Spirale peu lisible à petite taille. NON FAIT : tire-cheveux / perles (accessoire, hors du modèle de mèches),
  mèches folles échappées (la réf. 04 en a), chignon bas (nuque), chignon tressé.
- Queue de cheval haute : FAIT (38/40). PARTIEL : de face on ne voit que le nœud (c'est exact) ; de profil le nœud est une touffe sombre à pointes. Pas de queue basse,
  de queue latérale ni de double queue. NON FAIT : élastique/ruban.
- Couettes tressées : FAIT (35/40) ; entrelacs de face nets. PARTIEL : le haut de chaque tresse (naissance sous l'oreille) est peu travaillé ; tresse FIXE à 3 brins,
  4 périodes ; pas de tresse plaquée sur le crâne (réf. 09/33/55 en ont), pas de tresse à 4–5 brins, pas de tresse unique dans le dos. Tresse droite à −30° : 1 croisement visible (5 cas).
- Carré sous-dimensionné (≈ 35 % en hauteur, 31 % en largeur vs réf. 06) : NON FAIT, non touché (voir passe 11). Pixie fidèle à la réf. 32 : NON FAIT, bloqué par `anat.dome` (non modifié).
- Hime à chignons doubles (réf. 47) : FAIT sous le nom `DOUBLE_BUNS` (cadre de la hime). Afro, dreads, cheveux bouclés longs : NON FAIT.

## Vérification
- Échecs restants (7/160) : ponytail +30° g.1 (trous parasites), −30° g.1 (lames dégénérées) ; twin_braids −30° g.1, 3, 5, 6, 8 (croisements). La réparation n'a pas de correction
  pour « lames dégénérées » ni pour « croisements de tresse » (un brin ne se « répare » pas par élargissement) : NON FAIT.
- ANGLE MORT constaté à l'œil, que le vérificateur ne voit pas : de profil (±60°/±90°), le CÔTÉ du crâne peut rester nu (peau visible) alors que G/A/S est vert ; `anat.dome` ne juge que la
  calotte supérieure. Le cas de l'arrière du crâne a été corrigé à la main (`backCover`) après lecture de la planche 07 ; il faudrait un contrôle « couverture latérale / arrière » : NON FAIT.
- ±90° n'est pas dans la grille de verdicts (0, ±30, ±60 seulement) ; les planches 05a–d le montrent mais sans verdict : NON FAIT.
- `attach-verify.ts` : le test de rondeur utilise la boîte englobante, pas le contour (un chignon peut être rond en boîte et irrégulier) ; croisements de tresse comptés
  par le détecteur d'occlusion existant (sensible à l'amplitude visible) : à remplacer par une mesure de phase des brins. Seuil 2 choisi sur 2–3 mesurés, pas sur un panel de références.
- Les dimensions de chignon sont calées sur UNE référence mesurée (04) et un chignon droit lu à la main : NON FAIT, mesurer 15, 21, 47, 48 par le même estimateur.

## Mesure des références
- Réf. 04 : mesurée (chignon gauche par RANSAC). Réfs 09, 33, 55 (tresses), 12 (queue), 21, 48, 15, 47 (chignons) : lues sur planches contact, NON mesurées pixel par pixel ;
  les réglages des tresses et de la queue (longueur, azimut de racine, soulèvement) sont des choix de lecture, pas des mesures. NON FAIT : étendre `measure-buns.py` / `measure-cuts.py`.
- Réf. 32 et 47 : segmentation partielle, valeurs lues à la main (inchangé, voir `HAIR-MEASURE.md`). Réf. 28 et 50 : NON mesurées.
- Ancres (œil, menton, sommet, axe) posées à la main (±5 px) : NON FAIT, détection automatique.

## Intégration
- Le flux de production (`renderHair`) ne génère pas de mèches de grammaire : les 4 coupes ne servent qu'aux artefacts, scripts et tests (comme hime/pixie). NON FAIT.
- Roulis, tangage et vent non validés sur ces coupes ; seul le lacet est exercé. Les profils sont exportés par `src/hair-grammar/index.ts` mais PAS ajoutés au registre de `render-masks.ts` (mesure des rendus du moteur) : NON FAIT.
- Teintes à racine (`rootColor`) et barbe non testées avec les attaches.

## Dette préexistante (non traitée, hors périmètre)
- `tests/hair-engine-part.test.ts` : « génération brute, 3 positions × 4 graines » atteint le délai de 30 s ; échoue À L'IDENTIQUE sans les changements de la passe 12 (vérifié par `git stash`). NON TRAITÉ.
- `tests/hair-engine-art.test.ts` > raie > « la position suit la consigne… » : délai de 30 s dépassé (≈32,3 s), IDENTIQUE sans la passe 12 (vérifié par `git stash -u`). NON TRAITÉ.
- `profiles/bob.ts` ligne 15 : `lift1` dupliquée (TS1117) ; `scripts/artefacts-figure-perf.ts` importe `/tmp/orig/...` absent (TS2307).
