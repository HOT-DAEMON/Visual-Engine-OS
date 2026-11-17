# Cheveux sous rotation — passe 6 (état, mesures, reste à faire)

Branche `feat/hair-grammar`. Preuves : `artefacts/rotation-hair-pass-6/`. Les autres docs `ROTATION-*.md` restent la référence des passes 1 à 5 ; ce fichier ne les recopie pas.

## 1. Fait dans cette passe

| # | Sujet | Commit | Preuve |
|---|-------|--------|--------|
| 1 | Ombre de mâchoire (trait sombre + reflet du gonion) tracée sur la silhouette POSÉE : fin du halo / de l'ombre fantôme à ±30° | 04a8b43 | `01-…` (avant), `02-…` (après) ; `tests/face-pose-jaw.test.ts` (3 tests) |
| 2 | Lisière de face : rabotage des SOMMETS aigus (`shavePeaks`, `HAIRLINE_PEAK_TURN = 0,8` rad) | 72b3ab7 | `03-…` ; `tests/hair-hairline-peak.test.ts` (4 tests, 2 échouent sans la correction) |

Garanties mesurées : à lacet 0° le rendu du menton est identique à l'octet près (`jaw` vide) ; 50 lisières sur 60 (graines 9000–9059) sont inchangées à l'octet près ; 10 sur 60 bougent, de 3,6 px au plus ; virage frontal max 1,60 → 0,81 rad ; plus aucune lisière > 0,9 rad. Les extrémités (coins de tempe, qui portent les pattes) et l'abscisse de chaque point ne bougent pas. Lots de tests passés : `tests/hair-*` (24 fichiers, 721 tests) et pose / rotation (8 fichiers, 115 tests + 1 échec attendu).

Honnêteté sur l'effet visuel : le rabotage est quasi invisible à l'échelle de la tête entière (≤ 3,6 px) ; il retire un coin de 46°–92° sur la lisière de face, il n'en change pas le caractère. Il ne résout PAS les avertissements `pose.hairline-smooth` (§2.1).

## 2. Diagnostic : ce qui reste, par composant

### 2.1 Lisière sous pose (`pose.hairline-smooth`, `pose.edge-step`)
- Mesure : 291 avertissements `hairline-smooth` sur 480 poses échantillonnées. Le coin frontal de 90° n'en est PAS la cause principale (le raboter ne change rien à ce compte).
- Causes établies : (a) effondrement au limbe proche : la pente de `projectX` tend vers ρ(1−ψ)² ≈ 0, des points distincts se superposent ; (b) non-linéarité réelle de la projection près de la fin de tempe (sx ≈ 0,94, pente ≈ 0,24). Angle « injecté » (|virage projeté − virage affine|) : médiane 0,18 rad, p90 0,58, max 1,17.
- Correctif envisagé, NON fait : projection de lisière consciente du limbe (réparamétrer par longueur d'arc projetée avant de projeter, ou rééchantillonner dans l'espace projeté). Aucun seuil nouveau n'est inventé ici : à fixer après implémentation, sur les mêmes 480 poses.
- `pose.edge-step` : pas encore analysé.

### 2.2 Cheveux longs à ±30–45°
Mèches ancrées au-dessus de l'oreille qui passent devant la joue, recouvrements semi-transparents encombrés. Non traité. Piste : fixer l'ordre de calque par profondeur d'ancre (`anchorDepth`) au lieu de l'ordre frontal ; vérifier qu'une mèche ancrée du côté lointain ne repasse pas devant le limbe proche.

### 2.3 Rasé / buzz : « calotte orange »
Visible sur `02-…` (rangée du haut, buzz 9003) : la zone rasée se lit comme une calotte orange sur un crâne chauve. Non traité. Piste : fondre la masse rasée vers la peau (opacité en gradient depuis la lisière) plutôt qu'aplat ; à valider sur l'œil, pas sur un seuil.

### 2.4 Tranche 7 : cheveux sous le menton / autour du cou
Non traitée. Défauts connus à 0° : crochets près de l'oreille, base afro à bords rectilignes. À corriger à 0° d'abord (frontal), avant de les poser.

### 2.5 Lumière et ombres
- Fait : ombre de mâchoire (§1). Reste : halo de lumière du visage et ombre portée du menton ne suivent pas toujours la pose à ±45°.
- Défaut distinct repéré : coin de bouche qui dépasse du contour à 30° (`02-…`, rangée du bas, droite). C'est un trait du visage (`ROTATION-FACE-FEATURES.md`), pas un cheveu. Non traité.

### 2.6 Crâne : profondeurs avant / arrière
- `DEPTH_RATIO = 1,03` est MESURÉ (planche `rotation-3d/07`) ; la profondeur arrière 1,14 (= 2×1,03 − 0,92) est DÉRIVÉE, non mesurée.
- Silhouette asymétrique (avant 0,92 / arrière 1,14) : NON implémentée. Le contour (`Outline`) est symétrique (échantillons droits miroités) ; il faut un contour asymétrique. Formules prêtes : étendue droite hx·hypot(cos a, kf sin a), gauche hx·hypot(cos a, kb sin a) pour a > 0. Gros changement : à décider avant le tangage.
- Validation de `02-geometrie-masses-silhouette.png` (correction du modèle de crâne) : non faite dans cette passe.

### 2.7 Vue de dos et axes
- Dos : choix entre keyframes dessinés et profondeur minimale par courbe. Recommandation maintenue : profondeur par courbe ; à décider avant le tangage.
- Tangage et roulis absents du contrat ; la séquence livrée va de −75° à +75° (le schéma limite le lacet à ±75°).

### 2.8 Revue forme par forme des cheveux contre le crâne
Pas de revue systématique faite : seules la lisière (§1) et la mâchoire ont été retravaillées. À faire : pour chaque style (buzz, short, long, curly, afro, spiky, bob, ponytail, bun, braids), mesurer l'écart masse ↔ coque du crâne à 0° et ±45°.

## 3. Couche de vérification

Existante (`src/verify/hair-pose.ts`) : identité à 0°, finitude, calques, racines collées, échelle des mèches, enveloppe, lisière sur le crâne / au-dessus des sourcils, sur-fondu, attaches, `hairline-smooth`, `edge-step`, avec témoin négatif (`override`).

À ajouter (non fait) : règle de lisière FRONTALE (virage de sommet ≤ `HAIRLINE_PEAK_TURN`), règle d'anatomie (masse de cheveux ⊂ coque + épaisseur plausible), règle de style (nombre / opacité des recouvrements de mèches à ±45°).

## 4. Méthode d'essai réutilisable
- Isoler un artefact : bissection des groupes SVG de premier niveau, puis profil de pixels.
- Angle injecté : |virage projeté − virage affine| mesure un coin né de la non-linéarité de la projection.
- Comparer avant / après avec un worktree sur le commit précédent et le même script de rendu.
