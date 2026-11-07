# Artefacts — tête en rotation : mâchoire, menton, joues, variété

Preuves visuelles et chiffrées de la session « mâchoire + variété ». Suite de `artefacts/head-turntable-engines/` (état d'origine, conservé intact).
Documentation : `docs/HEAD-TURNTABLE-JAW.md`, `docs/HEAD-TURNTABLE-VARIETY.md`, `docs/HEAD-TURNTABLE-VERIFY-HEAD.md`, `docs/HEAD-TURNTABLE-REMAINING.md`.

## Fichiers

| Fichier | Ce qu'il montre | Ce qu'il prouve |
|---|---|---|
| `01-avant-apres-9-lacets.png` | la planche aux 9 lacets, état commité d'origine (haut) et corrigé (bas) | la mâchoire ne pend plus à 45° – 90°, menton en U de face |
| `02-machoire-gros-plans.png` | gros plans mâchoire à 20°, 45°, 70°, 90°, 135°, avant / après | continuité de la ligne mâchoire → menton, menton arrondi (plus de « dent »), disparition du rectangle rose sous le menton |
| `03-galerie-6-tetes-9-lacets.png` | 6 têtes issues du moteur de visage (graines 1 – 6) × 9 lacets | la rotation reste cohérente pour des visages différents |
| `04-silhouettes-superposees.png` | silhouettes de face (0°) et de profil (90°) des 6 graines superposées | les crânes, mâchoires et menton diffèrent réellement (largeur, profondeur, convergence) |
| `05-contours-annotes.png` | contour de la mâchoire coloré par courbure (vert doux, orange serré, rouge vif, bleu creux), avant / après à 45°, 90°, 135° | l'audit pixel : le menton devient un arc régulier ; le bleu du cou est le coin concave légitime mâchoire → cou |
| `06-planche2-mesures.png` | mesures de la 2e planche de référence (`rotation_head_1.jpg`) | lignes d'extraction (sommet, yeux, nez, menton) posées sur l'image |
| `08-pixels-modifies-planche.png` | pixels de la planche qui changent entre l'état d'origine et l'état corrigé (rouge) à 0°, 45°, 90°, 135° | la modification est LOCALE : contour mâchoire / menton, ombre du bas de joue, filet des lèvres, dessous du menton ; aucun pixel changé sur yeux, sourcils, nez, oreilles |
| `avant/`, `apres/` | rendus 1000 px des 9 lacets + `metrics.json` (courbure, écart à la silhouette mesurée) | données brutes de `01`, `02`, `08` et du tableau ci-dessous |
| `contours/{avant,apres}/` | `annot_{20,45,70,90,135}.png` | données brutes de `05` |
| `galerie/seedN/` | 9 lacets × graines 1 – 6 (600 px) | données brutes de `03`, `04` |
| `galerie/verification.json`, `galerie.csv` | verdicts de la couche « tête quelconque » (planche + graines 1 – 12), mesures de forme | 0 échec bloquant sur 13 têtes ; hors bornes en information : `specks` des graines 5 et 6 |

(Il n'y a pas de `07` : l'image prévue pour les verdicts est remplacée par `verification.json` et `galerie.csv`.)

## Résultat chiffré (planche, bande mâchoire t = 0,80 → 1,00, écart moyen en U à la silhouette MESURÉE)

| Lacet | 0° | 20° | 45° | 70° | 90° | 110° | 135° | 160° | 180° | Moyenne |
|---|---|---|---|---|---|---|---|---|---|---|
| Avant | 0,0051 | 0,0243 | 0,0302 | 0,0352 | 0,0279 | 0,0211 | 0,0352 | 0,0237 | 0,0216 | **0,0249** |
| Après | 0,0074 | 0,0231 | **0,0184** | 0,0325 | 0,0277 | 0,0219 | **0,0265** | 0,0215 | **0,0132** | **0,0214** |

Mêmes outils (`scripts/head-turntable/audit-planche.ts`) exécutés dans l'arbre d'origine (worktree propre de `HEAD`) et dans l'arbre corrigé.

## Ce que ces artefacts NE prouvent PAS

- **Pas de gain partout** : 0° (+0,002 U) et le signé de 160° (−0,009 → +0,017) se dégradent ; 70° garde un pic de 0,2 U au bout du menton.
- **Pas de comparaison à une référence pour les têtes variées** : `03`, `04` et `verification.json` prouvent la cohérence interne (3D ↔ moteurs 2D, contour continu, proportions), pas la ressemblance à un dessin de référence.
- **La planche 2 est mesurée, pas reproduite** : aucun paramètre n'est ajusté dessus ; `06` montre seulement l'extraction.
- **Défauts visibles dans `03`** (documentés dans `docs/HEAD-TURNTABLE-REMAINING.md`) : oreille pointillée sur les graines 5 et 6, bouche fermée très fine, nez en boule détachée sur la graine 2 (70° – 135°), yeux très grands sur les visages larges, cou cylindrique plus étroit que la mâchoire à 135° – 180°.
- Les constantes de la mâchoire (`JAW_SHAPE`) sont calées sur 2 vues d'une seule planche.

## Reproduire

```
npx tsx scripts/head-turntable/audit-planche.ts artefacts/head-turntable-v2/apres 1000
# état d'origine : git worktree add /tmp/orig <commit d'avant> ; copier scripts/head-turntable/audit-planche.ts ; lancer dans /tmp/orig avec la sortie avant/
npx tsx scripts/head-turntable/artefacts-annotate.ts artefacts/head-turntable-v2/contours/apres 20,45,70,90,135
npx tsx scripts/head-turntable/artefacts-gallery.ts artefacts/head-turntable-v2/galerie 1,2,3,4,5,6,7,8,9,10,11,12 600
python3 scripts/head-turntable/measure-sheet2.py artefacts/head-turntable-v2    # écrit rotation_head_1_mesures.png (renommé 06-planche2-mesures.png)
python3 scripts/head-turntable/compose-v2.py                                    # planches 01 – 05 et 08
```
