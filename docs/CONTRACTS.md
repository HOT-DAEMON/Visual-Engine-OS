# Contrats entre composants, mesures, invariants, résolution

Code : `src/face/contracts/` (mesures, influence, registre, ordre, monotonie) et `src/core/resolve.ts` (résolveur).
Tests : `tests/contracts.test.ts`. Artefacts : `artefacts/contrats/`.

## 1. Mesures observables (`measureFace`)

Une mesure est calculée sur la GÉOMÉTRIE produite (jamais lue dans un paramètre), en px ou en degrés, finie, déterministe, et
sur le visage STYLISÉ (celui qui est dessiné). 74 mesures : les 16 de la structure, plus nez, bouche, joues, menton, cou, yeux,
crâne, oreilles, et des **empreintes de forme** par groupe (`nose.shape.*`, `mouth.shape.*`, `philtrum.shape`,
`nasolabial.shape` : somme des aires, longueurs et ellipses du groupe). Une empreinte change dès qu'une région change
géométriquement ; un paramètre qui n'en change aucune n'agit que sur l'ombrage.

## 2. Carte d'influence mesurée (`influenceMap`)

Chaque paramètre numérique est perturbé seul (première valeur acceptée par le schéma parmi ±0,25 ; ×0,5 ; ±5 ; ±0,05 ; ±0,01)
et l'on note les mesures qui bougent. C'est la vérité de terrain des contrats.
Couverture mesurée : **134 paramètres géométriques, 82 avec un effet mesuré, 52 sans** (liste : `artefacts/contrats/influence.json`).
Les 52 sont, pour la plupart, des réglages d'ombrage (reflets, profondeur, relief) ou des paramètres sans effet à l'état neutre
(`caricature`, `elasticity`) : ils sont couverts par la régression visuelle, pas par la géométrie.

## 3. Contrats de composants (`CONTRACTS`)

Onze composants : cranium, eye, mandible, nose, mouth, philtrum, nasolabial, chin, cheek, neck, ear. Chacun déclare `needs`
(dépendances), `reads` (préfixes de paramètres lus) et `provides` (préfixes de mesures). Le test compare chaque influence
MESURÉE à la fermeture transitive des lectures déclarées : une influence non déclarée fait échouer le test. Le contrat ne
peut donc pas mentir en silence.

**Le test a corrigé le modèle** : le premier DAG (nez avant bouche) était faux. Le philtrum et les jonctions naso-labiales
dépendent du nez ET de la bouche ; `gonionY` suit l'ouverture de la bouche. Ils sont devenus des composants propres
(`philtrum`, `nasolabial`) et `gonionY` appartient à `mandible`, ce qui supprime le cycle nez ↔ bouche.

## 4. Ordre de résolution déterministe (`resolutionOrder`)

Tri topologique (Kahn), identifiant alphabétique le plus petit d'abord parmi les composants prêts. Mêmes contrats ⇒ même ordre,
quel que soit l'ordre de déclaration (testé). Cycle ou dépendance inconnue : erreur qui nomme le problème.
Ordre actuel : `artefacts/contrats/ordre.json`.

## 5. Résolveur de contraintes (`Resolver`, `src/core/resolve.ts`)

Mécanisme généralisé parce qu'il se RÉPÈTE : arbitrage du nez (5 contraintes), bouche dans le contour, bouche sous le nez,
sillon mentolabial sous la lèvre, cou entre menton et mâchoire. Règles :
1. `limit(id, param, demandé, min, max, raison)` ; appliqué = `min(max, max(min, demandé))` ; si les bornes se croisent, le MAX l'emporte ;
2. toute valeur changée (> 1e-9) est ENREGISTRÉE (demandé, appliqué, raison) : `lm.corrections`, `nose.regions.constraints` ;
3. ordre des enregistrements = ordre des appels (déterministe) ; aucun état global.
Les formules de forme (courbes, ellipses, ombres) ne se répètent pas : elles ne sont PAS généralisées.

Corrections observées sur les 18 cas difficiles : `artefacts/contrats/corrections-cas-difficiles.json` (ex. cas 01 : bouche 45 → 12,6 px).

## 6. Invariants

| Famille | Invariant | Où |
|---|---|---|
| Ordre | yeux < base du nez < bouche < sillon du menton | `checkContracts` (erreur) |
| Anatomie | bouche plus étroite que la mâchoire | `checkContracts` (erreur) |
| Géométrie | toutes les mesures finies ; aucune contrainte ne réduit une demande de plus de moitié | erreur / avertissement |
| Os préservé | l'expression ne change jamais `cranium.*` ni `mandible.*` | `tests/stylization-profiles.test.ts` |
| Somme | les pulsions d'expression s'additionnent (gain 1) | idem |
| Monotonie | 7 paires paramètre → mesure strictement croissantes sur un balayage | `MONOTONE` |
| Relations | menton < mâchoire, cou entre les deux, bouche dans le contour, ordre vertical, pour chaque profil | `relationsOf` |
| Rendu | filtres ≤ 160 par visage complet (médiane ≈ 100) | avertissement |

## 7. Ce qui reste (documenté, non fait)

- Les contrats vérifient les LECTURES (qui influence quoi), pas la direction de chaque effet sauf pour les 7 paires monotones.
- La règle T10 « propagation automatique générique » reste partielle : le résolveur borne et enregistre, il ne propage pas.
- 52 paramètres géométriques sans mesure (§2). Les dépendances propres au nez ne sont pas des règles de perturbation (T10) :
  elles sont couvertes par la carte d'influence et le résolveur du nez.
- Zone morte `jawWidth` ≥ 0,9 sous tissus maximaux : tolérée, non corrigée (le contour sature).
- Bouche écrasée (cas 01) : mesurée et signalée, pas corrigée (une correction demande un choix de conception sur l'entonnoir).
