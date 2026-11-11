# Tête 3D éclairée, suite (8) — ailes du nez, rebond, cheveux

Suite de `LIGHT-HEAD3D-07.md`. Même moteur de lumière (`src/relief/model.ts`), aucun moteur ajouté ; les références `references/rotation-3d` et la planche `artefacts/lighting-06/06-extraction-references.png` ont servi à régler ce moteur, pas à en créer un.

## 1. Ce qui a été lu dans les références
- `rotation-3d/01, 02` (grilles lacet × tangage) : la lumière reste FIXE pendant que la tête tourne et se penche ; les plans d'ombre changent de place sur le visage (dessous du nez, du menton, de la mâchoire visibles quand la tête se lève). → la planche d'artefacts fait varier lacet ET tangage sous une lumière fixe (`artefacts/head3d-lit-v2/grille-lacet-tangage-*.png`, tangages −30°, 0°, +30°).
- `lighting-06` (ΔL ombre → lumière mesuré, cel 0,21–0,30, peint 0,40–0,50) : borne de style de la couche de vérification (§ `HEAD-TURNTABLE-LIGHT-VERIFY.md`).
- Planches 02, 03, 10 d'éclairage : l'ombre n'est pas noire sous le menton et le nez (lumière renvoyée par en dessous), la mèche éclairée porte un arc clair → rebond et brillance des cheveux ci-dessous.

## 2. Ce qui a été changé (fichiers)
| Défaut vu dans la planche v1 | Cause mesurée | Correction | Fichier |
|---|---|---|---|
| Deux **disques clairs** cernés d'ombre sur les ailes du nez | Ailes = ellipsoïdes : normales sphériques (terminateur propre) ET saillie de 0,02 U qui trace un anneau d'occlusion | Normale éclairée ramenée de 85 % vers celle de la face ; profondeur de l'aile allégée de 80 % pour l'ombre portée et l'occlusion (le tampon, les contours et le mode « planche » ne changent pas) | `nose-light.ts` (nouveau), `parts.ts` (`alaOf` : source unique des ailes), `paint.ts` |
| Dessous du menton / du nez / cou = aplat sans retour de lumière | `LightModel.bounce` (0,18) était défini mais lu nulle part | `bounceAt` : seconde lumière par en dessous et du côté opposé à la clé, nulle sur surface occultée, en palier franc en cel | `relief/model.ts`, `paint.ts` |
| Cheveux « presque noirs par en dessous », sans brillance propre | Multiplicateur de la PEAU appliqué aux cheveux | Tons dérivés de la couleur des cheveux (écart ΔL ≤ 55 % de leur clarté) ; bande de brillance de Kajiya-Kay le long du méridien du crâne (cercle autour du vertex, suit la tête sous lumière fixe) | `hair-light.ts` (nouveau), `paint.ts` |

Avant / après du nez : `artefacts/head3d-lit-v2/nez-avant-apres.png`. Seul le mode éclairé (`lit`) est touché ; sans `lit` le rendu est identique.

## 3. Mesures
- Aile du nez : écart de normale éclairée / face ≤ 10,2° sur la coque (ellipsoïde brut : > 35°, test de sensibilité). Détail par zone : coque ≤ 10°, flanc du nez dans le fondu jusqu'à 81° (volontairement non touché : c'est le nez).
- Couche de vérification éclairée : 0 échec bloquant sur 3 graines × 2 motifs (`mesures-verification-eclairee.md`, 2 graines détaillées).
- Tests : `tests/head-turntable-lit-verify.test.ts` (4). Sous-ensemble tête en rotation + pipeline + relief : 15 fichiers, 126 tests verts. Suite complète non lancée (1 cœur).

## 4. Lecture honnête de la grille lacet × tangage
- Cohérent : le terminateur reste du côté opposé à la lumière à tous les lacets et tangages ; l'ombre du nez ne se détache plus en disque ; l'arc de brillance des cheveux tourne avec le crâne.
- **Pas jugé conforme** : à tangage +30° / lacet 90° la coupe du cou se lit comme un seau elliptique ; les cheveux sur teinte vive (graine 77, cyan) paraissent vitreux : la brillance est écrite pour des cheveux sombres, intensité non calibrée sur les références.
- Non corrigé, non mesuré ici : recalage de l'oreille et des yeux à fort tangage (pas de mesure sur les grilles `rotation-3d/01-02` cette session), perspective (la caméra est orthographique : les références 01, 02, 06 montrent un raccourci de perspective net en plongée / contre-plongée).

## 5. Reste à faire (par composant)
- **Cheveux** : ombre portée de la frange sur le front et l'œil (`LIGHT-VISIBLE-06-REMAINING.md`) ; brillance non comparée pixel à pixel aux références ; direction du brin au sommet (dégénérée, brillance coupée) ; tresses / mèches séparées non traitées.
- **Nez** : narine éclairée comme le reste (non vérifiée après correction, non mesurée) ; ailes de la tête de face et ailes 3D restent deux modèles (gaussienne / ellipsoïde).
- **Lumière** : rebond non lu par `head_lit` ni le corps (consommateur unique : la tête 3D) ; pas de lumière de contour (« rim ») distincte du rebond.
- **Caméra** : perspective optionnelle (opt-in, défaut orthographique) ; le rastériseur et la marche d'ombre supposent l'orthographique.
- **Vérification** : pipeline +≈ 6–8 s par `head_3d` éclairé et par vérification (non mémoïsé) ; mesures sur 3 graines seulement.
- Asymétrie non expliquée de `LIGHT-HEAD3D-07.md` § 5 : non reprise.
