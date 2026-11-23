# Yeux — passe 14 : budget de filtres, règle de pupille, emerald (réf. 07), tests périmés

Suite de `EYES-PASS-13.md` § 7 et `EYES-REMAINING.md` § Passe 13. Règle respectée : aucune famille ni moteur par référence ; les mesures de la réf. 07 recalent la famille `emerald-facets` existante et ses paramètres d'iris existants (`facets`, `voids`). Aucun paramètre ajouté : rien d'orphelin.

Reproduire : `npx tsx scripts/artefacts-eyes-pass14.ts` (preuves → `artefacts/eyes-pass14/`), `npx vitest run tests/eye-pass14.test.ts`, `npx tsx scripts/eye-refs/calibrate-atoms.ts emerald-facets`.

## 1. Flous de reflets partagés (`render/eye/highlights-render.ts`)
- Constat : un filtre `feGaussianBlur` par éclat (halo + douceur). Les éclats d'une famille ont souvent la même taille : ice déclarait 12 filtres de reflets, dont 5 identiques (écart 2,397).
- Changement : un filtre par valeur (`blurFilter`), écart quantifié par pas de 5 % (`quantizeBlur`, erreur ≤ 2,5 %). Les régions de filtre sont relatives à la boîte de l'objet : un même filtre sert des éclats de tailles différentes.
- Résultat (3 familles sur 5 concernées ; prism 11 et lime-cyan 5 inchangées) : ice 18 → 12, emerald 15 → 13, fire 12 → 10 ; limite 14 ; `filter-budget` ne signale plus aucun œil de la galerie 4.
- **Limite mesurée** : le temps de rastérisation ne change pas (ice ≈ 408 ms avant comme après sur 3 mesures chacune, une mesure isolée à 468 ms = bruit) ; resvg paie à chaque application du filtre, pas à chaque définition. Le gain est sur le décompte et sur le poids du SVG, pas sur la vitesse. Pour gagner du temps il faudrait moins d'éclats flous, pas moins de définitions.
- Preuve : `tests/eye-pass14.test.ts` (deux éclats identiques → un filtre, utilisé deux fois ; aucun filtre de reflet orphelin ; budget des 5 familles).

## 2. `pupil-darker-than-iris` : une définition, deux règles (`geometry/eye/highlights.ts`)
- Constat : la règle de pixels exemptait déjà la pupille noyée dans une étoile centrée (réfs 04, 10a, 10b) ; la règle de `verifyEye` comparait la couleur de BASE de l'iris et la pupille sans cette exemption : **30 avertissements sur 100** (galerie 4), tous des étoiles centrées (valeurs 0,003 à −0,018).
- Changement : `pupilOccludedByStar(eye)` est exportée et appelée par les deux règles (le test inline de `verify-eye-render.ts` est supprimé : une seule source).
- Preuve : galerie 4 → 0 avertissement (un contre-exemple reste détecté : pupille `#e8e8e8` sans étoile → échec), `artefacts/eyes-pass14/02-pupille-noyee-regle.png`.

## 3. emerald-facets recalée sur la réf. 07 (`eye-iris-families-photo2.ts`)
Trois réglages de paramètres existants : `facets.count` 20 → 36, `facets.cut` 0,8 → 0,5, `voids[0].outer` 0,34 → 0,22 (vide interne resserré : petite pupille à fin halo sombre comme la référence ; le disque sombre de 0,34 R était le défaut anatomique le plus visible).
| Mesure | Réf. 07 | Passe 13 | Passe 14 |
|---|---|---|---|
| Part sombre | 0,101 | 0,167 | 0,104 |
| Luminance moyenne | 128,8 | 124,5 | 136,2 |
| Pics de saturation | 0,738 | 0,741 | 0,729 |
| Cellules | 105 | 50 | 97 |
| Fentes (dérive °/ρ) | 6 (3,6) | 19 (8,4) | 16 (6,9) |
| Étoiles top 6 / première | 0,312 / 0,583 | 0,326 / 0,625 | 0,339 / 0,841 |
Preuves : `01-emerald-reference-avant-apres.png`, `03-tetes-entieres-emerald.png`, `03b-tete-gros-plan-emerald.png`, `04-rapport-passe14.json`. Tests : part sombre ± 0,03, luminance ± 10, cellules entre 80 et 2 × la référence ; `voids[0].outer` et `facets.count` prouvés LUS (le moteur noircit plus à 0,34, plus de cellules à 36).
- **Régressions et limites assumées** : luminance +7 par rapport à la référence (dans la tolérance de ± 10 mais en hausse) ; la première étoile passe de 0,63 à 0,84 R (réf. 0,58) ; les fentes restent trop nombreuses (16 pour 6).

## 4. Tests périmés
`tests/eye-gallery-ext3.test.ts` « identité 300 » échouait depuis la passe 10 : l'empreinte portait sur le JSON COMPLET du visage, qui change dès qu'un paramètre est ajouté ailleurs (oreille, iris). L'invariant voulu est « les sources existantes gardent leurs tirages » : l'empreinte porte désormais sur les identifiants et enveloppes des yeux de 4 graines, **vérifiée identique au commit 4dc0d14 (passe 10)** puis au HEAD. `highlights-system` suit les nouveaux identifiants de filtres.

## 5. Vérification de rendu (couche géométrie / anatomie / style)
Aucune règle ajoutée : la passe corrige des règles existantes (anatomie : exemption de pupille unifiée) et en prouve d'autres (style : budget de filtres, part sombre et luminance de l'emerald). Galerie 4 : 0 échec de pixels (100 yeux).

## 6. Reste à faire → `EYES-REMAINING.md` § Passe 14
