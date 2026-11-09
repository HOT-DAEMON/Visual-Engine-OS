# Preuves — série « finitions » des cheveux

Documents : `docs/HAIR-FORM-ROOTS.md`, `-FRINGE.md`, `-DOMES.md`, `-HUE.md`, `-REVIEW.md` ; limites : `docs/HAIR-FORM-REMAINING.md`. Aucune planche n'est retouchée ; mêmes graines et mêmes options avant/après.

| fichier | contenu |
|---|---|
| `01-tetes-entieres-avant-apres.png` | 8 têtes entières : long et afro roses sur racine brune, short (frange droite, rideau), ponytail, bun, braids, buzz. Avant en haut, après en bas |
| `02-gros-plans-avant-apres.png` | mêmes 8 visages en gros plan (repousse, frange, dômes) |
| `rapport-verification.md` | 29 contrôles × 200 visages (10 coiffures × 20), 0 échec ; nombre de formes par visage avant → après |
| `avant/`, `apres/` | planches brutes et `counts.json` |

## Lecture honnête (ce que les images montrent, et ne montrent pas)
- **Frange du `short`** : visible. Le peigne de pointes égales devient des touffes de largeurs inégales.
- **Cheveux tirés** (ponytail 311 → 378 formes, bun 263 → 341, braids 380 → 420) et **coupe rase** (169 → 326) : le gain est subtil à cette échelle : stries fines et chaume plus lisibles en gros plan qu'en tête entière. Le buzz garde un dôme à peu près uni.
- **Long rose sur racine brune** : 477 → 478 formes ; la racine n'est plus un casque brun sous le rose, mais le gain se lit surtout à l'implantation, peu sur la tête entière.
- **Non corrigé, visible** : la masse rose de l'**afro** garde un bord inférieur en dents de scie (389 formes avant et après). Le correctif de frange ne touche que `short`.
- **Revue humaine nécessaire.** « 0 échec » prouve la cohérence géométrique, anatomique et de style mesurée par les contrôles, pas la beauté.

## Reproduire
```
git worktree add /tmp/avant-finish 261af14
ln -s "$PWD/node_modules" /tmp/avant-finish/node_modules
cp scripts/artefacts-hair-finish.ts /tmp/avant-finish/scripts/
(cd /tmp/avant-finish && npx tsx scripts/artefacts-hair-finish.ts render "$OLDPWD/artefacts/hair-finish/avant")
npx tsx scripts/artefacts-hair-finish.ts render artefacts/hair-finish/apres
npx tsx scripts/artefacts-hair-finish.ts compose
```
