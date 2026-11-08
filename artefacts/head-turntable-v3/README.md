# Artefacts — tête en rotation : modèle de coupe du crâne (vue de dessus)

Preuves de la session « crâne ». Suite de `artefacts/head-turntable-v2/` (mâchoire, variété). Documentation : `docs/HEAD-TURNTABLE-SKULL.md`, `docs/HEAD-TURNTABLE-REMAINING.md`, `docs/HEAD-TURNTABLE-VERIFY-HEAD.md`.

## Fichiers

| Fichier | Ce qu'il montre | Ce qu'il prouve |
|---|---|---|
| `01-avant-apres-6-graines.png` | 6 têtes du moteur de visage (graines 1 – 6) à 45°, 135°, 160°, coupes elliptiques (avant) et modèle de crâne (après), rendus par le MÊME arbre | l'occiput et le plan facial changent d'une tête à l'autre ; **les différences sont subtiles** |
| `02-vues-de-dessus-coupes.png` | coupes horizontales (y = 0,15 ; 0,3 ; 0,5 ; 0,65) vues de dessus : ellipse (gris) et modèle (rouge), avec `pb`, `qb`, `wf` | l'arrière devient plat (graines 1, 3, 4, 6 à y = 0,3), pointu (graine 2 à y = 0,5), le point large recule (`wf` 0,42 – 0,56) |
| `metrics.json` | exposants et position du point large par graine et par niveau, diversité des silhouettes, verdicts de la couche de vérification | données brutes de `01`, `02` et du tableau ci-dessous |
| `avant/`, `apres/` | rendus 500 px des 9 lacets des 6 graines | données brutes de `01` |

## Diversité des silhouettes entre graines (recouvrement XOR / union, moyenne des 15 paires, tête seule)

| Lacet | Avant | Après | Variation |
|---|---|---|---|
| 0° | 0.1456 | 0.1451 | -0.3 % |
| 20° | 0.1354 | 0.1360 | +0.4 % |
| 45° | 0.1057 | 0.1129 | +6.8 % |
| 70° | 0.0954 | 0.0997 | +4.5 % |
| 90° | 0.0831 | 0.0849 | +2.2 % |
| 110° | 0.0721 | 0.0774 | +7.4 % |
| 135° | 0.0840 | 0.0901 | +7.3 % |
| 160° | 0.1100 | 0.1127 | +2.5 % |
| 180° | 0.1159 | 0.1187 | +2.4 % |

## Ce que ces artefacts NE prouvent PAS

- **Le gain est modeste** : +7 % de diversité à 45° et 135°, aucun gain à 0°. Ce n'est pas un crâne différent par tête : la longueur de tête reste dans 0,757 – 0,85 H (dérivation partagée non modifiée).
- **Aucune comparaison à un crâne réel** : les constantes de `SKULL_SHAPE` sont des conventions bornées ; la planche de référence ne contient pas de vue de dessus.
- **La planche n'est pas concernée** : elle garde ses ellipses (identique au pixel).
- **Défauts visibles inchangés** (voir `docs/HEAD-TURNTABLE-REMAINING.md`) : nez en boule de la graine 2, oreille lointaine, cou cylindrique plus étroit que la mâchoire, bouche fermée très fine.
- **Pic du menton à 70° non corrigé** : diagnostiqué seulement (décalage vertical d'environ 0,03 U).
- La suite de tests COMPLÈTE n'a pas pu être exécutée dans cet environnement (limite de durée) : seuls les fichiers liés ont été lancés (voir `docs/HEAD-TURNTABLE-SKULL.md`).

## Reproduire

```
npx tsx scripts/head-turntable/artefacts-skull.ts artefacts/head-turntable-v3 1,2,3,4,5,6 500
python3 scripts/head-turntable/compose-skull.py artefacts/head-turntable-v3
```
