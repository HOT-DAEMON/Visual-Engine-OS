# Couche de vérification du rendu des cheveux et revue

Suite de `HAIR-FORM.md`. Trois couches, lues sur la MÊME `HairGeometry` que le rendu (`verifyFace` → `hair-form.ts`, `hair-coherence.ts`).

## Contrôles ajoutés dans cette série
| Couche | Contrôle | Règle | Base du seuil |
|---|---|---|---|
| géométrie | `root-band-inside` | la repousse reste dans la coque | construction |
| géométrie | `comb-inside-shell` | stries/chaume ≤ 0,05 hors coque | corpus |
| style | `fringe-rhythm-natural` | régularité ≥ 0,25 | corpus (min 0,37) |
| anatomie | `braid-length-bound` | tresse ≤ bas du cou + 0,15 H | mesure : max +0,092 H |
| anatomie | `temples-covered` | extrémités de l'implantation couvertes ≥ 0,5 (hors coupe rase) | mesure : 1,00 partout, `buzz` min 0,5 |
| style | `comb-style-scope` | aucune strie hors coiffure tirée/rase | construction |
| style | `crown-tone-not-black` | sous-couche ≥ 0,41 × luminance | corpus |
| style | `root-band-not-black` | repousse ≥ 0,15 × luminance | corpus |
| style | `tier-hue-near-hair` | teinte rendue à ≤ 30,5° | harmonie analogue |
| géométrie | `dome-combed` | stries ≥ 0,4 du quota | corpus |
Contrôles négatifs (défaut injecté → contrôle rouge) : `braid-length-bound`, `temples-covered` (`tests/hair-coherence.test.ts`) ; `comb-inside-shell`, `dome-combed`, `comb-style-scope`, `fringe-rhythm-natural`, `tier-hue-near-hair` (`tests/hair-form.test.ts`). **`root-band-inside` : seulement un test positif** (la bande est construite sous la borne ; aucun défaut injectable sans changer `rootBand`) ; `crown-tone-not-black` et `root-band-not-black` : test de plancher dans `hair-coherence.test.ts`.

## Revue artistique et anatomique par le modèle
Faite sur les planches `artefacts/hair-finish/` : racine sous un rose, frange, dômes de queue/chignon/tresses/rase, tête entière. Constats : voir `artefacts/hair-finish/README.md`.
**Ce n'est pas une revue humaine** : aucun illustrateur n'a validé. « Rapport OK » ≠ beauté.

## Constats ouverts de la revue
1. Queues sans vent à 0,42–0,59 W de large (visages `ponytail` k = 14, 21, 25 de la graine 41000) : `tail-spread-bound` les accepte (il juge l'axe) ; un contrôle de largeur par tranche a été essayé puis retiré (p95 0,42 W sur 60 visages, non calibrable : mesure ambiguë). À regarder à l'œil.
2. `braid-length-bound` : borne 0,15 H posée sur un échantillon de mesure (max +0,092 H) ; sur le corpus du test le max est −0,15 H (aucune tresse près du seuil), donc le contrôle est large.
3. Bord inférieur en dents de scie de la masse d'**afro** (et probablement `curly`) : visible sur `artefacts/hair-finish/01`, non traité (la frange régularisée ne concerne que `short` ; le rythme n'y est pas mesuré faute de mèches `bang`/`fringe`).
4. Effet des dômes tirés et du chaume subtil en tête entière (`artefacts/hair-finish/README.md`).
5. Pas de contrôle de l'éventail des tresses (rapport pointes/racines mesuré 1,03–1,04, jugé non discriminant).
