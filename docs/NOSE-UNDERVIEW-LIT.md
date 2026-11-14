# Nez : vue de dessous éclairée par le moteur unique (12 nov. 2026)

Branche `feat/hair-grammar`. Répond au point « la vue de dessous n'est pas éclairée par `src/relief` (aplats diagnostiques) » de `NOSE-UNDERVIEW.md` §6. Reste à faire : `docs/NOSE-REFS-REMAINING.md`.
Code : `src/relief/underview.ts` (+ `rotateProject3`, `lobuleZ`, `alaZ` exportés de `src/face/nose/underview.ts`). Preuves : `artefacts/nez-underview/04-dessous-eclaire.png`, `metrics.json` (`litUnderview`). Tests : `tests/relief-underview.test.ts` (9).

## 1 · Audit : aucun éclairage nouveau
`litUnderview` n'implémente AUCUNE lumière. La vue de dessous produit une **carte de profondeur** (`ReliefField`, mêmes conventions que `headRelief`), puis appelle les fonctions existantes de `src/relief` :
`normalsOf`, `castShadow`, `ambientOcclusion`, `shadeAt`, `tonesOf`, avec le même `LightModel` que la tête. Test : l'ombre passe de côté quand la source passe de 300° à 120°.
`inPoly`, `polyBox`, `encodePngRgba`, `parseHex` sont réutilisés. `rotateProject` devient un alias 2D de `rotateProject3` (une seule projection).

## 2 · Surfaces de la carte de profondeur
Lobule (dôme `lobuleZ`) · ailes (rampe `alaZ`) · **columelle comme masse** (bande entre les narines, de 0 au sous-nez à `lobuleRim` × projection à la jonction du lobule, section arrondie) · narines en **cavités** (z = projection × (nostril − 0,45))
découpées dans les autres surfaces · plan de peau z = 0 qui reçoit les ombres. Échantillonnage dense (< 1 pixel après projection) puis suppression des pixels-trous (médiane 3×3 hors cavités) puis 2 passes de moyenne normalisée pour raccorder les surfaces.
**La columelle est une construction plausible, NON mesurée** (aucune référence ne la quantifie de dessous) ; ses proportions (section, profil de hauteur) sont de mon choix.

## 3 · Preuves mesurées (tests)
- Carte sans trou dans la silhouette projetée à 20°, 40°, 60° ; cavités plus profondes que la peau voisine ; hauteur de la columelle strictement décroissante du lobule vers le sous-nez.
- Pas un aplat : écart-type de luminance dans le nez ≈ 32–36 (un aplat vaut 0) pour 3 nez × 3 tangages, part ombrée au sol 18–26 %. Pyramide et cloche-ailes donnent des rendus différents (les paramètres produisent des différences visibles).
- Déterministe pixel à pixel.

## 4 · Défauts visibles (non cachés) — le résultat n'est PAS un chef-d'œuvre
Vu sur `04-dessous-eclaire.png` :
- **[CORRIGÉ le 14 nov. 2026 par `face/nose/base-mass.ts`, voir `NOSE-BASE-MASS.md` ; le texte ci-dessous décrit l'état d'avant]** **La silhouette lit « champignon » / « pique »** : les ailes sont de larges plaques plates qui s'évasent et la columelle une tige étroite. C'est un défaut de GÉOMÉTRIE (polygones d'ailes du moteur + rampe z), pas de lumière : ce travail ne l'a pas résolu.
- Ombre portée très sombre et à bord net malgré la réduction de portée (0,55 × largeur) et l'adoucissement ; c'est la sortie du `LightModel` partagé, pas un réglage propre au nez.
- Premier rendu : points parasites au centre du lobule à 40° et 60° (pixels du plan de peau entre deux surfaces) ; corrigés par la suppression des pixels-trous, vérifiée visuellement.
- Les constantes z utilisées sont celles du jeu v1 NON validé (`NOSE-UNDERVIEW-CALIB.md`) : la forme éclairée hérite de cette limite.
- Aucune matière propre au nez : la peau est la couleur de peau de l'hôte, sans brillance de pointe ni moucheture ; `litUnderview` n'est pas branché dans `head_3d`.
