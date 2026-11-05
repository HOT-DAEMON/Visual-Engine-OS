# Branchement tête + corps au pipeline principal

> Audit reproductible : `node scripts/audit-wiring.mjs` (bundle esbuild de `src/compile.ts`, liste des fichiers atteints).

## 1. État mesuré avant ce travail (243 fichiers `src/` atteints)

| Atteint depuis `compileScene` | N'est PAS atteint |
|---|---|
| `face/` (ear 9, jaw 4, nose 10, mouth 2, hair 28, structure 6), `skin/`, `appearance/`, `contact/` | `body/`, `skull/`, `hair-grammar/`, `face/pose/`, `relief/` |

Le corps n'était composé qu'après coup : `composeFigure` retouchait la chaîne SVG par regex, hors schéma, sans validation.

## 2. Ce qui est branché maintenant

- **`kind: 'body'`** (`src/schema/body.ts`) : `{ id, host, body: BodyParams, level, mode }`. Aucune coordonnée absolue : le corps lit le cou de son hôte
  (`neckAnchor` → `hostFace`, repères **stylisés**, source unique avec le visage), la transformation monde de l'hôte et la peau de l'hôte.
- **Validation de scène** (`schema/scene.ts`) : hôte introuvable, hôte non `shape: 'face'`, deux corps sur le même hôte → rejet avec message.
- **Calque `underlay`** (`CompiledObject`) : le torse et les bras passent derrière le visage, le fondu de la base du cou devant (ordre de `composeFigure`).
- **Équivalence prouvée** : `tests/pipeline-body.test.ts` compare, sur 3 graines, la nouvelle sortie à `composeFigure(...)` : chaînes SVG **identiques**.
- **Registre des compilateurs** (`render/registry.ts`) : table typée `{ [kind]: compilateur }`, exhaustive à la compilation (un `kind` non inscrit ne compile pas).
  `compile.ts` ne contient plus de `switch`. Ajouter un objet = 1 schéma + 1 entrée du registre + 1 ligne de l'union `schema/scene.ts`.

## 3. Pourquoi un registre typé et pas un registre ouvert

Mesure : le `switch` couvrait 6 types sur 14 lignes. Les futurs composants (nez, bouche, oreilles…) **ne passent pas par lui** : ce sont des parties de l'hôte
`face`, ordonnées à la main dans `render/face/face.ts` (`faceParts`). Le goulot d'évolutivité est là (ordre de dessin codé en dur), pas dans `compile.ts`.
Un registre dynamique (enregistrement à l'exécution) ferait perdre l'exhaustivité vérifiée par le compilateur : coût réel, bénéfice non démontré.
À rouvrir si `faceParts` dépasse ~15 couches ou si des composants doivent venir de paquets externes.

## 4. Vérification du rendu (3 couches)

`verifyPipeline(scène)` (`src/verify/pipeline.ts`) :

- **géométrie** : la scène compile ; relations géométriques (canthus sur ancre) ; contrôles géométriques du corps (`verifyBody`) ;
- **anatomie** : relations anatomiques de l'œil ; identité canonique de tous les composants du graphe de contact ; le cou est sous le menton ;
- **style** : relations visuelles paupière/iris ; contrôles de style du corps (trait homogène, contraste trait/peau, pas de filtre).

Défauts trouvés et corrigés pendant cette vérification : olécrâne en heptagone (asymétrie 1,3 px, maintenant octogone) ;
contraste du trait comparé en luminance absolue (échec par construction sur toute peau foncée) → rapport relatif + trait adaptatif (`body/render.ts: inkOf`,
identique à l'ancien sur peau claire).

## Ajouts du 5 nov. 2026

- `kind: 'head_profile'` (`PIPELINE-PROFILE.md`), `kind: 'head_lit'` (`PIPELINE-RELIEF.md`), `legs` dans `kind: 'body'` (`PIPELINE-LOWER.md`).
- `expandPlacements` (source unique du lien enfant → hôte) ; `CompileCtx.orbits` et `lightSpec` ; `CompiledObject.top`.
- Reste : `PIPELINE-WIRING-REMAINING.md`.
