# Preuves — forme des cheveux sur le crâne

Documents : `docs/HAIR-FORM.md` (conception, mesures), `docs/HAIR-FORM-REMAINING.md` (limites). Aucune planche n'est retouchée ; mêmes graines et mêmes options avant/après.

| fichier | contenu |
|---|---|
| `01a-tetes-short-spiky.png` | têtes entières, coupes courtes (4 visages × 2 coiffures), avant | après |
| `01b-tetes-curly-afro.png` | têtes entières, coupes volumineuses : le dôme reçoit des mèches |
| `01c-tetes-bob-long.png` | têtes entières, cheveux pendants : gain mesuré mais peu lisible |
| `01d-tetes-non-modifiees.png` | **contrôle négatif** : buzz, bun, ponytail, braids — aucune mèche ajoutée. PNG égaux au bit **si l'on désactive le plafond de teinte d'étage** (vérifié : `UNDER_HUE_MAX` = 24000 → identique à `avant/`) ; avec le plafond (24°), seule la teinte des sous-couches d'étage change, sur 6 visages (bun / ponytail / braids, visages 4 et 5) |
| `03-details-dessus-du-crane.png` | dessus du crâne en gros plan (afro, curly, short, spiky, long), avant au-dessus, après en dessous |
| `05-diagnostic-couverture.png` | code courant seulement : **cyan = coque encore nue**, magenta = mèches de remplissage, noir = contour de la coque |
| `rapport-verification.md` | 8 contrôles × 200 visages, part nue avant/après par coiffure, identité du reste de la chevelure (80/80) |
| `avant/`, `apres/` | planches brutes et `counts.json` (nombre de formes par visage) |

## Reproduire
```
git worktree add /tmp/avant 2869446        # parent du premier commit du remplissage (84d0e95) : même cou, même peau, sans remplissage
ln -s "$PWD/node_modules" /tmp/avant/node_modules
cp scripts/artefacts-hair-form.ts /tmp/avant/scripts/
(cd /tmp/avant && npx tsx scripts/artefacts-hair-form.ts render "$OLDPWD/artefacts/hair-form/avant")
npx tsx scripts/artefacts-hair-form.ts compose   # « après » = code courant ; FACES=120 par défaut
```

## Lecture honnête
Le cyan de `05` montre ce qui reste à faire : une part notable du bord est encore nue. La frange en dents de scie du `short` n'est pas traitée ; la plaque des cheveux longs est corrigée (couverture + teinte d'étage plafonnée), sauf la racine sombre voulue sur cheveux teints (`docs/HAIR-FORM-REMAINING.md` 8, 9). **Revue humaine nécessaire.**
