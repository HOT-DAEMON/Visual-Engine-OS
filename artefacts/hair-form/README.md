# Preuves — forme des cheveux sur le crâne

Documents : `docs/HAIR-FORM.md` (conception, mesures), `docs/HAIR-FORM-REMAINING.md` (limites). Aucune planche n'est retouchée ; mêmes graines et mêmes options avant/après.

| fichier | contenu |
|---|---|
| `01a-tetes-short-spiky.png` | têtes entières, coupes courtes (4 visages × 2 coiffures), avant | après |
| `01b-tetes-curly-afro.png` | têtes entières, coupes volumineuses : le dôme reçoit des mèches |
| `01c-tetes-bob-long.png` | têtes entières, cheveux pendants : gain mesuré mais peu lisible |
| `01d-tetes-non-modifiees.png` | **contrôle négatif** : buzz, bun, ponytail, braids — identiques avant/après (PNG égaux au bit : `avant/tetes-inchangees.png` = `apres/tetes-inchangees.png`) |
| `03-details-dessus-du-crane.png` | dessus du crâne en gros plan (afro, curly, short, spiky, long), avant au-dessus, après en dessous |
| `05-diagnostic-couverture.png` | code courant seulement : **cyan = coque encore nue**, magenta = mèches de remplissage, noir = contour de la coque |
| `rapport-verification.md` | 7 contrôles × 200 visages, part nue avant/après par coiffure, identité du reste de la chevelure (80/80) |
| `avant/`, `apres/` | planches brutes et `counts.json` (nombre de formes par visage) |

## Reproduire
```
git worktree add /tmp/avant 841008c        # commit d'origine (avant le remplissage)
ln -s "$PWD/node_modules" /tmp/avant/node_modules
cp scripts/artefacts-hair-form.ts /tmp/avant/scripts/
(cd /tmp/avant && npx tsx scripts/artefacts-hair-form.ts render "$OLDPWD/artefacts/hair-form/avant")
npx tsx scripts/artefacts-hair-form.ts compose   # « après » = code courant ; FACES=120 par défaut
```

## Lecture honnête
Le cyan de `05` montre ce qui reste à faire : une part notable du bord est encore nue. La frange en dents de scie du `short` et la plaque de cuir chevelu des cheveux longs ne sont pas traitées (`docs/HAIR-FORM-REMAINING.md` 8, 9). **Revue humaine nécessaire.**
