# Contrat central des composants anatomiques

> Suite de `ARCHITECTURE.md`. Code : `src/anatomy/components.ts` (identité), `src/anatomy/relations.ts` (relations), `src/verify/pipeline.ts` (vérification).
> Tests : `tests/anatomy-contract.test.ts`. Preuves visuelles : `artefacts/tete-pipeline/` (planches 02 et 03).

## 1. Le problème, mesuré (4 nov. 2026)

Quatre vocabulaires nommaient les mêmes composants, chacun dans son domaine :

| Composant réel | contrats visage | graphe de contact | arbre de pose | contrats corps |
|---|---|---|---|---|
| crâne | `cranium` | `head` | `skull` | — |
| mandibule | `mandible` | — | `jaw` | — |
| cou | `neck` | `neck` | `neck` | `neck` |
| orbite | — | `orbitL`, `orbitR` | — | — |

Sans règle commune, chaque domaine pouvait redéfinir « où est » le composant. Un cas a été **mesuré** (§4) : l'orbite.

## 2. La règle et sa critique

Recommandation reçue : un composant anatomique possède un contrat central ; les autres systèmes le consomment au lieu de le redéfinir.
**Retenue, avec trois amendements :**

1. **Le contrat ne contient que l'anatomie** : identité, parent, paramètres, mesures, repères, relations. Apparence, matériau, texture, couleur,
   ombre et caméra le *consomment* par identifiant canonique. Les mettre dans le contrat créerait un objet-dieu que tout le monde modifie.
2. **La forme selon la rotation 3D ou l'angle de caméra est dérivée, pas stockée** : c'est la projection du contrat par la pose.
   Un contrat qui stocke ses projections diverge dès la première pose ajoutée.
3. **On ne réécrit pas les contrats existants** (visage : 11, corps : 13) : on les réconcilie par une table d'alias, vérifiée par test.
   Réécrire quatre systèmes en même temps est le « plus gros problème » que la règle veut éviter.

## 3. Ce qui est en place

- `COMPONENTS` : 28 composants canoniques (identifiant, domaine `head|body`, parent, alias par vocabulaire `contract|contact|pose|body`).
- `canonicalId(espace, nom)` : `undefined` = **orphelin**. Le test échoue s'il en existe dans l'un des quatre vocabulaires.
- Le cou est le même composant canonique pour le visage, le contact, la pose et le corps : c'est la jointure tête → corps.
- Parents : l'arbre de pose est identique au registre (testé). Le `parent` du graphe de contact est la **surface réceptrice des ombres**
  (souvent `head`), pas le parent anatomique : la règle testée est « le parent de contact est un ancêtre canonique du composant ».

Ajouter un composant : 1 entrée dans `COMPONENTS` + ses alias ; le test signale tout nom non déclaré.

## 4. Les trois familles de relations

Une transformation règle le placement ; elle ne garantit ni la correspondance anatomique ni le rendu. `relations.ts` distingue :

| Famille | Exemple mesuré | Couche de vérification |
|---|---|---|
| géométrique | canthus interne sur son ancre : 0,000 px (80 visages) | `geometry` |
| anatomique | ouverture dans l'orbite ; sous l'arcade (marge min 29,6 px) ; au-dessus du nez (min 5,0 px) | `anatomy` |
| visuelle | centre de l'iris dans la fente ; part de l'iris recouverte par les paupières (0 à 44 %) | `style` |

Chaque relation est **mesurée sur la scène compilée** (transformations monde de l'œil et de l'hôte), jamais lue dans un paramètre.

### Divergence trouvée : l'orbite — CORRIGÉE le 5 nov. 2026

Deux définitions de la même région (repères a priori vs borne d'ajustement de l'œil) : 12 yeux sur 80 hors orbite (le « rapport 1,86 » était le carré du rapport linéaire 1,364 ;
« 80 visages » désignait 80 yeux). L'œil publie maintenant son orbite et les ombres de contact la consomment : voir `ORBIT-PUBLISH.md`.
Le test `anatomy-contract` exige désormais **zéro** œil hors de l'orbite publiée et borne encore la dette de l'a priori (12 yeux sur 80, pire < 1,4).

## 5. Ce que ce contrat ne fait pas encore

Il n'impose pas encore que le matériau, la texture ou l'ombre d'un composant référencent son identifiant canonique (ils utilisent leurs propres noms).
Les relations de l'œil sont dans `anatomy/relations.ts` ; celles du nez, de la bouche, de l'oreille, de la mâchoire et des cheveux dans `anatomy/face-relations.ts` (`FACE-RELATIONS.md`).
