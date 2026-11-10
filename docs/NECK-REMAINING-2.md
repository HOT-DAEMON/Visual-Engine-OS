# Moteur de cou — passe « reste du cou » (session 22)

Suite de `docs/NECK-REMAINING.md`. Rien n'est présenté comme fait sans preuve ; ce qui n'est pas fait est listé en §C.
Preuves visuelles : `artefacts/neck-remaining/` (script `scripts/artefacts-neck-remaining.ts`). Presets : `docs/NECK-PRESETS.md`.

## A. Fait, avec sa preuve

| Point demandé | Code | Preuve |
|---|---|---|
| Presets | `src/neck/presets.ts` (13) | `tests/neck-presets.test.ts` ; planche `03` |
| Larynx par `body.sex` | `HeadContext.sex` (`src/neck/types.ts`, `link.ts`), visibilité `anatomy.ts`, forme `render/neck/reliefs.ts` ; sexe exprimé = `expressedSex` (`src/body/tones.ts`), transmis par `CompileCtx.bodySex` | `tests/neck-remaining.test.ts` (visibilité F < neutre < M ; stations et silhouette identiques) ; planche `02` |
| Non-collision accessoire / mâchoire | `src/neck/attachments.ts` (`attachment-jaw`, `JAW_MARGIN`) | `tests/neck-remaining.test.ts` (2 tests) ; planche `04` |
| Générateur aléatoire | `src/generation/random-face-neck.ts`, options `neckVariety`, `neckPreset` | `tests/neck-remaining.test.ts` (3 tests) ; planche `05` |
| Palette du torse / apparence | `src/body/tones.ts`, `skinAppearance` (`render/face/face.ts`), `bodyRenderOpts` (`render/body.ts`) | `tests/pipeline-body.test.ts` ; mesure §B |
| §F ligne sombre du cou comprimé | plis en croissants effilés (`render/neck/reliefs.ts`) | planche `01` (avant/après) |
| §F trapèzes en traits droits | volumes éclairés par la loi partagée (`render/neck/muscles.ts`) | planche `01` |
| §F haut plat du torse | haut étroit caché dans le cou + pente d'épaule échantillonnée (`body/torso.ts`) | planche `01` |
| Strie verticale au bord du cou (cause trouvée) | `neckEdges` (`render/neck/path.ts`) : la lumière de contour suivait un rectangle ±`lm.neck.half` | planche `01` |

Vérifications faites avant d'écrire : il n'existe qu'un seul moteur de cou (`src/neck` + `src/render/neck`) ; aucun second compilateur n'a été ajouté. Le besoin d'un compilateur de composant enregistrable par le cou n'a **pas** été établi : le cou est déjà rendu par `renderNeck` appelé depuis `faceParts`, sans modifier de compilateur central pour chaque variante. Aucune extension n'a été créée.

## B. Mesures

- **Écart de teinte torse/cou** (12 graines, corps adulte, `scripts` jetable non conservé) : avant, moyenne 8,27°, max 26,68° ; après, moyenne 7,16°, max 24,04°. Écart de clarté HSL inchangé (moyenne 0,11, max 0,19 → 0,17). **Amélioration faible.** Les écarts élevés sont sur des peaux peu saturées (S < 0,2) où la teinte est instable, et le torse reste plus clair que le cou (le cou est dans l'ombre du menton). La source de palette est unifiée ; l'égalité visuelle ne l'est pas.
- Défauts §F : preuve = planche avant/après, pas de métrique nouvelle.

## C. Pas fait, ou fait partiellement

- **Microtexture** (pores, grain, fibres) : non traitée.
- **Muscles comme volumes qui poussent l'enveloppe** (GEO-02) : les trapèzes sont des volumes de RENDU (aire remplie, dégradé), pas de la géométrie ; la silhouette du cou ne change pas avec eux.
- Reste de `NECK-REMAINING.md` §A non traité : cage/réseau de contrôle, matériau (réflexion/transmission), masques de densité, réorientation des éléments, GEO-04 (fourrure, membranes, nageoires, bijoux, crinière, armure), champs de déplacement, vertèbres, M09, BodyLanguage vers épaules/yeux.
- **Générateur aléatoire opt-in** : le tirage du système (masse, âge, trapèzes…) modifie le cadre `lm.neck`. Activé par défaut il a fait échouer 8 tests existants (identité de `lm.neck`, cou entre menton et mâchoire) et aurait déplacé des visages existants. `neckVariety` vaut donc 0 par défaut. Aucun visage existant ne bouge sans l'option.
- **Couche de vérification du rendu** (cohérence géométrique, anatomique, style) : seules les vérifications existantes (`verify/neck`, `verify/neck-junction`) s'appliquent ; aucune couche nouvelle n'a été ajoutée dans cette passe.
- **Preuve visuelle du larynx** : visible mais discrète à l'échelle de la tête entière (planche `02`).

## D. Défauts visibles connus après la passe

- Une **bosse minuscule** (arc de l'épaule/deltoïde) peut dépasser du contour de l'épaule sur un cou fin ; le grand arc fantôme (clavicule, pente d'épaule) est supprimé.
- La **pente d'épaule est quasi rectiligne** (corde base du cou → acromion, relevée de 0,03 h) : plus lisible qu'un bord plat, mais pas une courbe de trapèze réelle.
- La **barre sombre du cou comprimé** est devenue un pli doux, mais la base reste un peu plus sombre que le torse.
- La lumière de contour du cou démarre à la hauteur du menton par un début net (pas de fondu).
- Preset `stylized-bull` : bloc plus large que la mâchoire, haut d'épaules horizontal (planche `06`) ; caricature non traitée.
- Les cous créature (écailles, plaques) montrent peu de volume d'un bord à l'autre (inchangé).

## E. Tests modifiés (à relire)

- `tests/neck-engine.test.ts` : le collier du test de contact passe de 0,7 à 0,85 (à 0,7 il touche le menton et est désormais ramené plus bas).
- `tests/neck-body-junction.test.ts` : marge de 3 px au lieu de 2 (3 pixels de frange anti-aliasée, écart de 4 niveaux, bord évasé à 0,6 avec roulis 0,24°) ; le contrôle négatif (débordement de dizaines de pixels) est inchangé.
- `tests/pipeline-body.test.ts` : l'équivalence pipeline / `composeFigure` utilise `bodyRenderOpts` et `renderScene(scene, { bodySex })` ; le visage avec corps n'est plus identique au visage seul (larynx).

## F. Suite de tests

Suite complète (120 fichiers, 2 907 tests) sur l'état final avant régénération des références : **2 906 réussis, 1 échec** (`regression-visual` : 27 cas sur 34 écartés, rms ≤ 6,4, au plus 4,3 % de pixels écartés de plus de 8 niveaux, changements confinés à la moitié basse de l'image ; les 7 cas sans cou visible sont identiques).
Les 34 références de `references/visual/` ont été **régénérées volontairement** (`npm run regress:update`) ; après régénération, `regression-visual`, `neck-remaining` et `neck-presets` passent (16 tests) et `tsc` est propre. La suite complète n'a pas été relancée après la régénération.
Durée de la suite complète : environ 15 minutes sur une machine à un cœur (lancer détachée).
