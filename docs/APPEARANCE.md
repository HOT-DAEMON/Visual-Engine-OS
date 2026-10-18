# Moteur d'apparence (contrat partagé)

Code : `src/appearance/` (moteur), `src/schema/appearance.ts` (contrat Zod). Tests : `tests/hair-v2.test.ts` (bloc « moteur d'apparence »).

## Principe

Un composant du visage — parent (hôte `face`), enfant (cheveux, pilosité, nez, oreilles, cou) ou frère — ne choisit **jamais** ses
couleurs ni ses effets lui-même. Il fournit une couleur de base et reçoit un `ResolvedAppearance`. Les couleurs sont **définies par
la lumière**, pas par un teint unique : trois teintes indépendantes s'ajoutent à la base.

| Entrée (`Appearance`) | Rôle | Si `null` / absente |
|---|---|---|
| `light.shadow` | teinte d'ombre | base assombrie (L × 0,62), tirée vers le bleu-violet 250° de `shadowShift` × 0,55 → **proche de la couleur principale** |
| `light.light` | teinte de lumière / reflets | base éclaircie, tirée de 22 % vers le chaud (48°) pour les teintes chaudes, le froid (195°) sinon ; noirs : reflet bleuté 218° |
| `light.rim` | lumière de contour | lumière mélangée à 35 % de blanc |
| `gradient[]` | dégradé **à N couleurs** (≤ 8 stops), opacité par stop | couleur de base seule |
| `texture` | `grain` · `strands` · `dots` · `hatch`, échelle, intensité | aucune |
| `shading` | `smooth` ou `cel` (2–3 tons), bande de reflet, ombre portée | lisse |
| `contrast` · `saturation` · `brightness` | −1…1, étalonnage de toutes les couleurs résolues | 0 = identité |
| `opacity` | opacité globale | 1 |
| `emission` | voile émissif (couleur, intensité) | 0 |
| `reflection` | intensité, taille, teinte du reflet | 0,5 / 0,5 / dérivée |
| `refraction` | déplacement du fond (translucidité) | 0 |
| `glow` | halo de la silhouette (couleur, rayon, intensité) | 0 |
| `bloom` | halo des zones claires (rayon, intensité, seuil de luminance) | 0 |

## API

```ts
resolveAppearance(baseHex, spec) → ResolvedAppearance
  .base .shadow .light .rim .highlight          // toutes des #rrggbb
  .ramp(t) .rampAlpha(t)                        // dégradé racine(0) → pointe(1) : couleur et opacité
  .tone(v, from?)                               // v∈[-1,1] : vers l'ombre (<0) ou la lumière (>0), mélange en lumière linéaire
  .cel(from?) → { lit, shade, core }            // les 3 tons du mode cel
compileEffects(id, spec, resolved, box, scale?) → { defs, filter }   // UN filtre SVG chaîné
```

Ordre du filtre : réfraction (`feTurbulence` → `feDisplacementMap`) → grain (`feTurbulence` découpé par l'alpha) → glow → bloom →
émission. Aucun filtre n'est émis si aucun effet n'est actif (`filter === undefined`).

## Règles de dérivation (testées)

- **Teintes imposées** : étalonnées comme la base. **Teintes dérivées** : calculées depuis la base *déjà étalonnée* — un contraste fort
  ne doit pas écraser l'ombre et la lumière l'une sur l'autre (erreur n° 25 de `ERRORS-3.md`).
- L'ombre reste dans la famille de la couleur (écart de teinte < 75°, vérifié par `style/shadow-near-main`).
- Étalonnage neutre = identité exacte ; saturation/luminosité/contraste monotones (tests).

## Qui l'utilise

| Composant | Fichier | Ce qu'il lit |
|---|---|---|
| Cheveux (mèches, dégradé, cel, ombre portée, effets) | `render/face/hair.ts`, `hair-lock.ts`, `hair-look.ts` | tout |
| Pilosité (barbe, moustache, favoris) | `render/face/facial-hair.ts` | ombre / lumière dérivées de sa couleur |
| Peau : cou, oreilles, nez, transition à l'implantation | `render/face/face.ts` → `neck.ts`, `ears.ts`, `nose.ts` | `FaceParams.skin` (teinte d'ombre bleutée) |

`FaceParams.skin`, `FaceHair.appearance` et `FaceFacialHair.appearance` ont le même type `Appearance` : un nouvel enfant n'a qu'à
résoudre la sienne et lire `.shadow` / `.light` / `.ramp`.

## Limites connues

- Le dégradé de mèche est calculé par mèche (axe racine → pointe) : une mèche en S très recourbée a un dégradé linéaire sur son axe, pas
  sur sa longueur curviligne.
- `refraction` déforme l'arrière-plan du groupe filtré, pas une vraie réfraction optique (pas d'indice, pas de profondeur).
- `texture` : un seul bruit fractal anisotrope ; ce n'est pas un matériau procédural complet.
