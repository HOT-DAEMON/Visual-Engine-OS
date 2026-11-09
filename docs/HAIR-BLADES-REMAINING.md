# Frange en touffes — reste à faire et limites (par composant)

Fait : `HAIR-BLADES.md`. Chaque ligne est une limite mesurée ou constatée sur `artefacts/hair-s4/`. Listes précédentes toujours valables : `HAIR-FORM-REMAINING.md`, `HAIR-SKULL-REMAINING.md`, `HAIR-COHERENCE-REMAINING.md`, `HAIR-BOUNDARY-REMAINING.md`.

## Frange `blades` (`fringe-blades.ts`)
1. **Seuils circulaires** : `TUFT_LIMITS` (0,03 / 0,25 / 0,7 / 0,03) a été posé après la correction, sur le même corpus (126 visages) ; pas de référence dessinée. Le « avant » échoue (53 / 114 / 77 / 5 visages), ce qui montre que les contrôles discriminent, pas que les seuils sont justes.
2. **Réglages posés à la main** : recouvrement 1,35–1,9, longueurs 0,68 / 0,38, densité ×3, plafond 20, inclinaison 0,05–0,25 xF. Choisis en regardant les planches, pas optimisés ; non validés par un illustrateur.
3. **Touffes toutes de même famille** : un seul profil (`ribbon`, pointe 0,5–0,8). Pas de mèches qui se croisent ni de séparation en deux masses plus nettes.
4. **Grands triangles sombres au sommet du `long` brun** (`artefacts/hair-s4/02`, rangée du bas à droite) : NON traité. Ce ne sont pas des touffes `main` de la frange (les contrôles ne les voient pas) ; origine non identifiée dans cette série.
5. **Contrôle de continuité limité aux `blades`** ; `wispy`, `sheer`, `asym_brow` ouvrent le front par conception et ne sont jugés que sur la rugosité du bord.
6. **`asym_brow` conserve des `cone`** (triangles) : le passage en `ribbon` n'a rien changé de visible, il n'a donc pas été retenu. La forme reste anguleuse.
7. **Flux aléatoire décalé** : le reste de la chevelure change à graine égale (0 / 126 identiques, `HAIR-BLADES.md`). Piste : tirer les touffes de frange avec un flux propre pour que `tone()` / `lockFrom` ne consomment plus le flux principal ; non faite, cause non vérifiée.
8. **Coût** : jusqu'à 20 mèches de frange par visage au lieu de 5–7 ; le temps de `hairGeometry` n'a pas été remesuré.

## Hors de cette série (non faits, déjà listés ailleurs)
9. **Retombée des cheveux longs = rectangle arrondi** (`HAIR-SKULL-REMAINING.md` 10, `HAIR-FORM-REMAINING.md` 10) : non retravaillée.
10. **Bord en dents de scie de l'afro/curly** (`HAIR-FORM-REMAINING.md` 21) : non traité ; ce n'est pas la frange `blades`.
11. **Revue humaine nécessaire** : « rapport OK » ≠ beauté (`artefacts/hair-s4/01`, `02`).
