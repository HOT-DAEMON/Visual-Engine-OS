# Orbite publiée par l'œil

> État au 5 nov. 2026. Corrige la « divergence trouvée : l'orbite » de `ANATOMY-CONTRACT.md` §4.

## Le problème, remesuré

Deux définitions de la même cavité coexistaient :

- `face/landmarks.ts` : une ellipse **a priori** (`ry = 0,085 H`, `rx` lié au temple) ;
- `face/fit-eye.ts` : une borne de l'œil par l'arcade et le nez, bien plus large.

L'ombre d'orbite du graphe de contact (`orbitL`, `orbitR`) utilisait l'a priori : elle ne contenait pas toujours l'œil qu'elle entoure.

**Deux erreurs de lecture corrigées dans la doc précédente :**

| Ce que disait la doc | Ce que c'est réellement |
|---|---|
| « 80 visages, 12 hors orbite » | **80 yeux** (40 visages × 2) : 12 yeux sur 80 |
| « rapport max 1,86 » | le **carré** du rapport ; en linéaire 1,364 |

Mesure sur 200 visages (400 yeux) : **52 yeux hors de l'orbite a priori**, pire rapport linéaire 1,407.
Les rapports d'orbite sont désormais **linéaires** (1 = sur le bord).

## Règle

L'orbite a priori est le **défaut**. L'œil, une fois ajusté, **publie** son orbite (`src/anatomy/orbit.ts`) :

1. rapport œil/orbite ≤ `ORBIT_KEEP` (0,98) → l'a priori est rendu **tel quel** (aucune dérive pour les visages conformes) ;
2. sinon : centre horizontal = milieu de l'ouverture, demi-axe horizontal = étendue × 1,2 (jamais sous l'a priori),
   bord interne à au moins `0,012 W` de la ligne médiane ; demi-axe vertical **exact** (le plus petit qui contient chaque point × `ORBIT_MARGIN` 1,08).

Pourquoi `ORBIT_KEEP` = 0,98 et non 1 : l'ombre est un polygone à 24 côtés **inscrit** dans l'ellipse (affaissement cos(π/24) = 0,991).
Un œil entre 0,99 et 1,00 sortait du polygone réellement dessiné (cas trouvé : graine 69, détecté par `verifyOrbits`).

## Qui lit quoi

```
expandPlacements (composition/expand.ts)  ← source UNIQUE du lien œil → hôte
  → placedEyesOf (anatomy/placed.ts)
  → publishedOrbits (anatomy/orbit.ts)
  → CompileCtx.orbits (compile.ts) → compileHost → faceParts → faceComponents (ombres orbitL/orbitR)
  → verifyOrbits / eyeRelations (vérification, même fonction)
```

Un visage sans œil posé garde l'a priori (`orbits` absent).

## Mesures (200 visages)

| Mesure | Valeur |
|---|---|
| yeux hors orbite a priori | 52 / 400 |
| yeux hors orbite publiée | **0** (pire rapport 0,996) |
| orbites agrandies | 52 ; aire ×1,13 au maximum |
| orbites sortant du contour du crâne | 0 |
| visages dont les deux orbites se chevauchent | 0 (a priori : 0) |

## Vérification (`src/verify/orbit.ts`, `anatomy/relations.ts`)

- géométrie : le **polygone d'ombre réellement émis** contient toute l'ouverture de chaque œil ;
- anatomie : orbite dans le contour du crâne ; orbites disjointes ; croissance ≤ ×1,3 (avertissement) ;
- `eye.in-orbit` : contre l'orbite publiée (erreur) ; `eye.in-orbit-prior` : contre l'a priori (avertissement, la dette résorbée).

Contrôle négatif (`tests/orbit-publish.test.ts`) : avec l'a priori seul, la vérification **détecte** l'œil hors de l'ombre.

## Effet sur le rendu

Seuls les yeux qui dépassaient changent. Sur les 34 cas de régression, 4 changent (`std-02`, `std-14`, `std-16`, `hard-16`).
Leurs références ont été réécrites avec `scripts/regress.ts update-some <ids>` (fusion dans le manifeste, les autres entrées ne bougent pas).
La différence visible est **faible** (l'ombre est discrète) mais mesurée : `artefacts/orbit-publish/`.

## Reste à faire

- `relief/head.ts` a ses propres constantes d'orbite (non branchées à l'orbite publiée).
- Les 30 autres références de régression sont « close » et non « exact » : leur manifeste est périmé (antérieur à ce travail). À régénérer en bloc, en revue.
- Plusieurs yeux par côté : l'orbite contient leur union (testé en unitaire, pas sur une planche).
