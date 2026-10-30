# Hiérarchie musculaire — « non musclé » → « très très musclé » (`src/body/muscle-tiers.ts`)

Source unique, partagée par le tronc, les bras et les jambes. Références : `references/anatomy/ref-02` (groupes musculaires colorés) et `ref-04` (écorché face/profil).

## Les 6 paliers
| Palier | Nom | Ce qui se lit |
|---|---|---|
| 0 | non musclé | enveloppes seules (enfant, adiposité forte) |
| 1 | faiblement musclé | masses : vaste latéral, gastrocnémien médial |
| 2 | tonique | + droit fémoral, sartorius, deltoïde antérieur, abdos hauts |
| 3 | athlétique | + chefs du biceps/triceps, tibial antérieur, adducteurs |
| 4 | musclé | + séparations fines, dentelé, bandelette ilio-tibiale |
| 5 | très très musclé | tout, dont tendons et muscles de la main/avant-bras fins |

## Mécanisme
`T = tierOf(frame.vis)` ∈ [0,5], où `vis` vient de musculature × maturité (âge) × (1 − adiposité masquante) : **aucun axe d'origine**. Chaque muscle a `min` dans `MUSCLE_TIERS` ; opacité `reveal(T, min) = clamp(T − min + 1, 0, 1)` : apparition en fondu sur un palier, jamais brutale. Un muscle absent de la table est toujours montré (masses structurantes). La **silhouette** grossit en parallèle (mi-cuisse ×(1+0,42·mus), mollet ×(1+0,34·mus), bombé du vaste latéral).

## Ajouter un muscle
1. Ligne dans `ROWS` (`arm.ts` ou `lower/leg.ts`). 2. Entrée `MUSCLE_TIERS` (identifiant sans suffixe de côté). 3. Préfixe dans `provides` du contrat. Les tests de contrat et de confinement échouent sinon.

## Ajouts du membre supérieur dans cette tâche
`anconeus`, `supinator`, `abductor-pollicis-longus`, `extensor-pollicis-brevis`, `flexor-pollicis-longus`, `pronator-quadratus`, `teres-major` (4 sont cachés de face, 3 visibles de dos de main).
