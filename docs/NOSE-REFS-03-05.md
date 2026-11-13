# Nez : quantification des réf. 03 et 05 (12 nov. 2026)

Branche `feat/hair-grammar`. Suite de `docs/NOSE-REFS.md`. Reste à faire : `docs/NOSE-REFS-REMAINING.md`.
Régénérable : `python3 scripts/nose-refs/extract_03.py` et `extract_05.py` → `references/nez/measures-03.json`, `measures-05.json` ; preuves : `artefacts/nez-refs/03-overlay.png`, `05-overlay.png`.
Méthode commune : aucune valeur saisie à la main ; chaque extraction a été **contrôlée à l'œil sur son image de superposition** et deux défauts de ma première version ont été corrigés (voir §1 et §2).

## 1 · `03.jpg` — narines vues de dessous (Procreate, niveaux de gris)
Fond local (médiane large) → écart au fond → amas = un nez ; traits sombres (< 95/255) → ellipse par trait ; **paire de narines** = plus gros trait de la moitié gauche + plus gros de la moitié droite,
hors flanc extrême (cx ∈ [0,12 ; 0,88]) et hors haut de la boîte (cy ≥ 0,40).
- 16 amas ; **l'amas n°7 contient DEUX nez fusionnés** : détecté par sa taille (> 1,6 × la médiane), exclu des statistiques au lieu d'être découpé à la main.
- **11 paires** sur 15 nez ; sans paire : 2, 5, 12, 14 (la narine y est un trait mince collé au bord ou un dégradé sans trait sombre : **non mesuré, non inventé**).
- Défauts corrigés après contrôle visuel : (a) critère « intérieur au lobule » trop strict (6 paires seulement, narines collées au bord rejetées) ; (b) sélection par allongement qui perdait les narines rondes (nez 1, 8, 13, 15).
- Mesures (rapport à la largeur de la boîte du nez) : séparation des narines **médiane 0,431** (0,381–0,496) ; hauteur relative du centre des narines **0,650** (0,615–0,799) ; longueur du trait **0,215** (0,153–0,356) ;
  asymétrie de longueur gauche/droite médiane 0,12 (0,003–0,47) ; inclinaison de la ligne des narines médiane 0,7° (−8,6° à 10,9°).
- **Doute déclaré** : nez 9 (vue oblique) — la paire retenue y est ambiguë ; les statistiques sont des médianes pour limiter ce type d'effet. Le « trait » est le trait sombre dessiné, pas l'ouverture de la narine.

## 2 · `05.jpg` — 24 nez au crayon graphite (grille 6 × 4)
Grille déduite des **vallées de la projection d'encre** (4 colonnes, 6 rangées) → plus gros amas par cellule → boîte, taches très sombres de la moitié basse (narines), petites taches compactes (moucheture).
- Premier essai par amas dilatés : 22 amas au lieu de 24 (rangée 6, colonnes 3–4, fusionnées avec celles du dessus) → remplacé par la grille ; les 24 cellules sont isolées (contrôle visuel).
- Rapport L/H de la boîte du dessin : médiane 0,82 (0,58–1,28). La boîte inclut les hachures de l'arête : c'est celui du dessin, pas celui du lobule.
- **16 paires de narines** sur 24 cellules (profils stricts : pas de paire, non mesuré). Séparation médiane 0,40 (0,26–0,55) — plus dispersée que `03` car les cellules sont dans toutes les orientations ; hauteur relative médiane 0,76 ;
  taille d'une narine / largeur du nez : 0,096 (0,066–0,137).
- **Moucheture (pores dessinés)** : 1ʳᵉ mesure en comptant les petites taches sur l'encre dilatée → ≈ 0 partout, contredit par l'image (cellules 2.1, 2.2 visiblement piquetées) ; **corrigée** en comptant les taches compactes
  sur l'encre non dilatée. Résultat : densités 0–0,99 pour 1000 px² ; les plus fortes sont 5.2 (0,99), 2.1 (0,90), 3.2 (0,86), 2.2 (0,73). **5.2 et 3.2 sont des faux positifs probables** (détail dense des narines et hachures),
  2.1 et 2.2 sont de vraies cellules piquetées. Proxy bruité : à ne pas utiliser comme loi sans ré-extraction.
- **Rougeurs : NON mesurables.** `05.jpg` est un dessin au graphite en gris, il ne contient aucune information de teinte. Le document `NOSE-REFS.md` listait « rougeurs de `05.jpg` » : cette information n'existe pas dans l'image.

## 3 · Ce que le moteur fait de ces mesures (comparaison vérifiable, `tests/relief-underview.test.ts`)
Nez du moteur en vue de dessous (tangages 20°, 40°, 60°), rapportés à la largeur de l'enveloppe lobule + ailes, comparés à `03` :
- **Hauteur relative des narines** : 0,70–0,75 pour le nez par défaut et les archétypes « pyramide » et « cloche-ailes » → **dans la plage mesurée** (0,61–0,80).
- **Séparation des narines** : 0,325 (défaut), 0,378 (pyramide), 0,372 (cloche-ailes), contre 0,381–0,496 mesuré → **le nez par défaut est SOUS la plage** (écart verrouillé par un test) ; pyramide à la limite basse.
- Longueur : 0,116–0,135 du moteur contre 0,153–0,356 mesuré, **non comparable en l'état** (largeur d'ouverture du moteur contre trait sombre dessiné) : ni écart ni accord affirmés.
- **Non fait** : aucune de ces mesures n'est branchée dans le moteur (pas de paramètre de séparation recalé, pas de brillance de pointe, pas de moucheture). Mesure et comparaison seulement.

## 4 · `01.jpg` et `02.jpg` : NON quantifiées
`01.jpg` est une photo de croquis (fond gris bruité, hachures, écriture) et `02.jpg` un dessin au trait fin : la segmentation par seuils utilisée pour 03 et 05 n'y est pas fiable et je n'ai pas fabriqué de mesure.
