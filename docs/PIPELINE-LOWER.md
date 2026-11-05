# Bassin et jambes dans le pipeline principal (`kind: 'body'`, option `legs`)

> État au 5 nov. 2026. Avant : « le torse s'arrête sur une coupe droite : le bassin et les jambes ne sont pas branchés ».

## Contrat

`BodySpec.legs` : `false` (défaut) ou un `LegParams` (même `{}`).

- `false` = **buste** : sortie historique identique au bit près (test : `legs: false` explicite = absent). Cadrage portrait, coût minimal.
- `LegParams` = **figure** : `render/body.ts` appelle `figureMarkup(body, legs, ancre de cou, options)` au lieu de `bodyMarkup`.

Le bas lit le **même `BodyFrame`** que le haut (même `BodyParams`, même ancre de cou, même peau) : aucun axe n'est dupliqué.
Le bassin passe **derrière** le tronc : mesuré sur 4 morphologies, le haut du bassin recouvre la coupe du tronc de ~8 unités (pas de trou).

Le défaut est `false` : les scènes existantes ne changent pas ; la figure complète est un choix de cadrage, pas une régression.

## Vérification

`verifyPipeline` ajoute `verifyLegs(legGeometry(...), figureMarkup(...))` quand `legs !== false` (couches géométrie / anatomie / style du bas du corps).
Mesuré : adulte homme musclé, adulte femme adipeuse, enfant de 8 ans, adulte très musclé → toutes valides (planche : `artefacts/pipeline-wiring/01-*.png`).

Test : `tests/pipeline-body.test.ts` — `legs: {}` produit exactement `composeFigure(visage, figureMarkup(...))` ; le SVG gagne plus de 20 Ko ; `verifyPipeline` passe sur 3 graines × 3 morphologies.

## Mesure de coût (`compileScene` complet ; le visage seul a coûté 335 ms à froid, puis il est en cache de contenu)

| Scène | Temps total | SVG |
|---|---|---|
| visage + buste | 121 ms | 646 Ko |
| visage + figure (bassin + jambes) | 134 ms | 711 Ko |

Ces temps incluent le visage **déjà en cache** : ils mesurent surtout le corps. Le bas du corps ajoute ~13 ms et ~65 Ko au buste ;
le coût dominant d'une scène reste le visage à froid et, si utilisé, le relief (`PIPELINE-RELIEF.md`). Une seule mesure par cas (pas de médiane) : ordre de grandeur, pas un benchmark.

## Piège rencontré (pas un défaut du moteur)

Ma première planche montrait un trou entre tronc et bassin. Cause : les `<defs>` (clipPath `b0-crop`) sont **globaux** dans un SVG assemblé ;
quatre cellules avec le même id d'objet se découpaient mutuellement. Une scène du pipeline a des identifiants d'objet uniques (le schéma l'impose) ; seules les
planches assemblées à la main doivent préfixer leurs ids par cellule. Corrigé dans `scripts/artefacts-wiring.ts`.

## Reste à faire

- Les muscles 3D des jambes, le pied détaillé, la rampe de profondeur poitrine → ventre, le deltoïde enveloppant : `BODY-JUNCTIONS-05-REMAINING.md`.
- Le bas du corps reste en vue de face (pas de pose 3/4).
- Fidélité aux références d'anatomie non atteinte (`BODY-LOWER-REMAINING.md`) ; le rendu du bas du corps est plus plat que les sculptures de référence.
- Pas de variation d'âge sur le visage (axe d'âge du visage absent) : l'enfant a un visage d'adulte à l'échelle.
