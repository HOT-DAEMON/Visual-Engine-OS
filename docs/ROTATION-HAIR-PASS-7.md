# Cheveux sous rotation — passe 7 (état, revue par coiffure, reste à faire)

Branche `feat/hair-grammar`. Suite de `ROTATION-HAIR-PASS-6.md` (58 lignes, non recopié). **Suite : `ROTATION-HAIR-PASS-8.md`** (§3.1 des longs traité : mèches conformes au crâne). Détails : `ROTATION-HAIR-LIMB.md`, `ROTATION-HAIR-VERIFY-2.md`, `ROTATION-HAIR-BUZZ.md`. Preuves : `artefacts/rotation-hair-limb/` (lisière) et `artefacts/rotation-hair-review/` (revue par coiffure, têtes entières −45/0/45°, 10 coiffures).

## 1. Fait dans cette passe
| # | Sujet | Statut |
|---|---|---|
| 1 | `pose.hairline-smooth` : lisière consciente du limbe (coupe à l'horizon, pas d'arc constant, courbure bornée) | FAIT : 300 → 0 / 480 ; coin sur fenêtre fixe 152 → 0 / 192 |
| 2 | `pose.edge-step` analysé | FAIT : 20 → 0 / 480, mais la mesure ne discrimine plus (boucle posée dense) |
| 3 | Règles de vérification : lisière de face, coin de lisière sur fenêtre fixe, épaisseur de masse (3 couches : géométrie / anatomie / style) | FAIT avec contrôles négatifs ; règle de style « recouvrements » NON faite |
| 4 | Rasé : calotte → flancs couverts, aile au crâne, deux fondus de peau | FAIT en grande partie (reste §3.3) |
| 5 | Revue forme par forme contre le crâne (mesure coque ↔ crâne) | FAIT à 0° pour 10 coiffures (`rotation-hair-review/02`, `03`) ; ±45° à l'œil seulement (`04`, `05`) |

## 2. Revue des 10 coiffures contre le crâne (0°, lecture des planches 02 / 03)
La coque (orange) est concentrique au crâne (gris) pour les 10 coiffures ; l'épaisseur suit `THICKNESS` (buzz 0,01 W … afro 0,32 W). Constats :
- buzz, short, spiky, ponytail, bun, braids : cohérents ; aile jusqu'à l'arche de l'oreille.
- curly, afro : masse ronde large ; les ailes finissent sous l'oreille en lobes ; bord inférieur droit (tranche 7, base à bords rectilignes) NON retravaillé.
- bob : coque légèrement plus large que le crâne au bas de l'aile (couvre l'oreille) : voulu.
- long : masses d'étage (pointillé bleu) très asymétriques sur 9002 (tierMasses n'existent que pour les graines 9000/9002/9004) ; coque fine sur le dessus, lisière à 2 bosses.
Limite : mesure visuelle + `skull-shell-bound` ; pas de nouvelle règle numérique par coiffure.

## 3. Reste à faire, par composant
1. **Cheveux longs à ±30–45° (TRAITÉ en passe 8 : voir `ROTATION-HAIR-PASS-8.md`)** — diagnostic d'origine, conservé : vu sur `rotation-hair-review/05` (`long` 9004) : une mèche fine de la couche `over` traverse la joue en diagonale du côté lointain ; rideau de mèches empilées du côté proche, dalles à angles vifs, semi-transparences superposées. Cause probable : les mèches sont translatées rigidement avec leur racine (`poseLock`) ; une racine proche du limbe lointain voit sa mèche portée dans la bande dépliée. Pistes : ordre de calque par `anchorDepth`, fusion des mèches `over` voisines, atténuation d'opacité par recouvrement, coupe d'une mèche `over` au bord du visage ; ajouter la règle de style correspondante (`ROTATION-HAIR-VERIFY-2.md` §4).
2. **Coque rasée à ±45°, côté lointain** : bloc à bord vertical encore perceptible (`ROTATION-HAIR-BUZZ.md` §3).
3. **Coque (`base`) sous pose** : encore projetée point par point ; lui appliquer la coupe à l'horizon de `hairline-limb.ts`.
4. **Tranche 7 (cheveux sous le menton / autour du cou)** : NON TRAITÉE. Défauts à 0° : crochets près de l'oreille, base afro à bords rectilignes. À corriger à 0° avant de poser.
5. **Crâne** : silhouette asymétrique 0,92 / 1,14 NON implémentée (contour `Outline` symétrique ; 1,14 dérivé, non mesuré) ; validation de `02-geometrie-masses-silhouette.png` NON faite dans cette passe ; vue de dos : profondeur par courbe recommandée, décision AVANT le tangage ; tangage et roulis absents.
6. **Visage** : coin de bouche qui dépasse du contour à 30° (trait du visage, `ROTATION-FACE-FEATURES.md`). NON traité.
7. **Lumière** : halo et ombre portée du menton ne suivent pas toujours la pose à ±45°. NON traité.

## 4. Méthode
- Le contrôle par sommet est sensible à la densité : mesurer sur fenêtre d'arc fixe.
- Comparer avant / après avec un worktree git sur le commit précédent et le même script de rendu.
- Un contrôle négatif par règle ; ne jamais fixer un seuil avant mesure.
