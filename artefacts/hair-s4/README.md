# Preuves — frange en touffes continues

Documents : `docs/HAIR-BLADES.md` (conception, mesures), `docs/HAIR-BLADES-REMAINING.md` (limites). Aucune planche n'est retouchée ; mêmes graines, mêmes options avant / après (le script n'utilise que des paramètres existants). Le reste de la chevelure diffère aussi (flux aléatoire décalé, `HAIR-BLADES.md`) : ne pas lire toute différence hors frange comme voulue.

| fichier | contenu |
|---|---|
| `01-tetes-entieres-avant-apres.png` | 8 têtes entières à frange `blades` (afro rose, tresses, long rose, short, curly, bob, spiky, long) : avant au-dessus, après en dessous |
| `02-gros-plans-avant-apres.png` | mêmes 8 visages en gros plan : des éclats triangulaires isolés deviennent des touffes qui se chevauchent à la racine |
| `avant/`, `apres/` | planches brutes (`tetes.png`, `details.png`) et `counts.json` (nombre de mèches par visage) |

Régénérer l'« avant » : `git worktree add /tmp/avant 909c134`, y lier `node_modules`, y copier `scripts/artefacts-hair-s4.ts`, puis `npx tsx scripts/artefacts-hair-s4.ts render artefacts/hair-s4/avant` ; l'« après » depuis ce dépôt : `... render artefacts/hair-s4/apres`, puis `... compose`.

Limite visible : le `long` brun (rangée du bas, à droite) garde de grands triangles sombres au sommet (`HAIR-BLADES-REMAINING.md` 4).
