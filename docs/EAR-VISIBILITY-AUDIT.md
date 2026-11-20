# Moteur d'oreille — audit de visibilité des paramètres

Question posée : un paramètre produit-il une différence que l'on VOIT, ou n'est-il qu'une fonctionnalité théorique ? Mesure par `scripts/ear-audit/`.

## Méthode (comparable avant/après)
- `visibility.ts` : même graine, même éclairage, crâne chauve ; un paramètre à la fois, du bas au haut de sa plage ; 3 graines (11, 77, 1203) ; rendu réel d'une **tête entière** 600 × 760 ; on compte les pixels dont la somme RGB change de plus de 24 dans la boîte des deux oreilles. Verdicts : ≥ 150 px visible, 50–149 FAIBLE, < 50 INVISIBLE.
- `views.ts` : même mesure dans les 4 vues de l'oreille (face, trois-quarts, profil, gros plan) ; verdict par la meilleure vue (≥ 378 px).
- L'état d'origine a été remesuré avec la **même bibliothèque corrigée** (`artefacts/oreille-audit-visibilite/avant/`). Une première version de la mesure utilisait des boîtes d'oreille calculées sur le moteur classique : elle sous-comptait certains axes. Corrigée avant tout chiffre cité ici.
- Bilan complet : `artefacts/oreille-audit-visibilite/comparaison.md`, graphique `audit-avant-apres.png`, vues `vues.md`.

## Résultat
Avant : 48 paramètres — 34 visibles, 4 faibles, 10 invisibles. Après : 64 paramètres (16 axes ajoutés) — 57 visibles, 5 faibles, 2 invisibles.

### Paramètres existants qui changent de verdict (ou restent non visibles)
| paramètre | avant | après | verdict |
|---|---:|---:|---|
| attach.pitchDeg | 0 | 0 | INVISIBLE → INVISIBLE |
| attach.scale | 0 | 11324 | INVISIBLE → visible |
| material.glow | 0 | 4840 | INVISIBLE → visible |
| material.translucency | 10 | 3508 | INVISIBLE → visible |
| morph.antitragus.orientation | 68 | 81 | FAIBLE → FAIBLE |
| morph.antitragus.size | 126 | 165 | FAIBLE → visible |
| morph.concha.cymba | 26 | 43 | INVISIBLE → INVISIBLE |
| morph.crus.thickness | 58 | 98 | FAIBLE → FAIBLE |
| morph.scapha.depth | 39 | 575 | INVISIBLE → visible |
| morph.scapha.width | 0 | 237 | INVISIBLE → visible |
| morph.tragus.size | 142 | 183 | FAIBLE → visible |
| style.detail | 38 | 1043 | INVISIBLE → visible |
| style.fidelity | 0 | 321 | INVISIBLE → visible |
| style.softness | 0 | 908 | INVISIBLE → visible |

## Causes trouvées (dans le code, pas seulement dans le rendu)
1. `scapha.width` : la contrainte stricte « l'hélix et l'anthélix ne recouvrent pas la scapha » prenait le MINIMUM global de la place disponible (la branche supérieure s'approche du bord par construction) : largeur écrasée à 0,012 partout, correction journalisée à chaque oreille. Désormais mesurée point par point (`structures.ts`). L'oreille par défaut change donc : la scapha est un vrai creux (référence `hard-05` régénérée).
2. `style.softness` et `style.fidelity` : déclarés dans le schéma, lus nulle part. Câblés : douceur = croissants plus larges et plus pâles, éclairage plus flou, flou léger au-dessus de 0,5 ; fidélité = articulation des raccords (jonction des branches, fosse, incisure, cymba), 1 au défaut.
3. `material.glow` : n'agissait que via l'extension bioluminescente. Désormais halo + liseré intérieur + crêtes allumées pour toute matière.
4. `attach.scale` : sans effet quand les ancrages sont à 1. Désormais l'oreille grandit depuis la racine de l'hélix (qui reste sur la ligne des yeux) ; le lobule quitte la base du nez, la vérification en tient compte.
5. `material.translucency` : liséré presque invisible. Désormais, au-dessus de 0,5 les parties minces rougeoient, en dessous elles s'opacifient (défaut inchangé).
6. `style.detail` : n'agissait que par seuils de sillons. Désormais module aussi la force du relief éclairé, et pilote le LOD des détails de surface (`EAR-NEW-ANATOMY.md`).

## Ce que l'audit ne résout pas (honnêteté)
- **« Visible » en pixels n'est pas « convaincant à l'œil » sur la tête entière de face** : l'oreille n'y est qu'une fine bande. Scapha, fidélité, douceur et détail se lisent dans les vues oreille (3/4, profil, gros plan), pas dans la tête de face (`artefacts/oreille-composeur/01-…`). Seule `attach.scale` y est évidente.
- `attach.pitchDeg` : 0 px de face **par construction** (rotation autour de l'axe horizontal, projection frontale) ; lisible en trois-quarts et profil (≈ 25 000 px).
- Restent faibles à l'échelle de la tête : `concha.cymba` (43), `crus.length` (75), `antitragus.orientation` (81), `crus.thickness` (98), `crus.angle` (123, classé visible seulement dans les vues), `tragus.tip` (144). Ce sont de petites structures (≈ 5 à 10 px sur la tête) ; amplitudes déjà poussées, au-delà l'anatomie n'est plus plausible.
- `attach.insertion` : 0 px dans les vues oreille (c'est un réglage du contour de la tête, 6 288 px sur la tête entière).
