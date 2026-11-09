# Raccord cou ↔ corps : preuves et mesures (session 21)

Tout est reproductible : `npx tsx scripts/artefacts-neck-junction.ts` → `artefacts/neck-junction/`. Tests : `tests/neck-body-junction.test.ts` (4), `tests/neck-junction-render.test.ts` (3).

## Planches

| Fichier | Contenu | Reproductible |
|---|---|---|
| `01-raccord-avant-apres.png` | base du cou, 2 graines × 3 cous. AVANT : ancienne formule d'ancre `half × (1 + flare)` et fondu non borné ; APRÈS : ancre unique et fondu borné par le contour du cou | oui (l'ancienne formule est rejouée explicitement dans le script) |
| `02-scm-torse-avant-apres.png` | à gauche : avec les SCM du torse ; à droite : sans. Deux coins sombres à l'incisure jugulaire disparaissent | **non** : capture de la session, le code est retiré |
| `03-tetes-completes.png` | tête entière (cheveux compris) + cou + corps, 5 cous, même visage | oui |
| `04-mesures.json` | écarts d'ancre et contrôles du rendu final, 4 graines × 5 cous | oui |

## Ce que les mesures disent

- **Ancre** : l'ancienne formule donnait la même base que le moteur pour le cou par défaut (0 %), mais −28,8 % pour le cône (taper 0,9) et −8,9 % pour le cou massif avec trapèzes.
- **Fondu** : sur `01`, les rectangles à bords durs de part et d'autre de la base (colonne AVANT) disparaissent pour le cou par défaut et le cône ; le gain est discret pour le cou massif. Test pixel : 0 pixel du fondu hors du cou ; contrôle négatif : sans bornage, il déborde.
- **Rendu final** (`src/verify/neck-junction.ts`, 20 combinaisons) : cou peint partout où le modèle le place (0 échantillon manquant sur 20) ; colonne médiane menton → sous la base sans aucun trou ; écart de teinte de peau entre le haut et le bas de la base : 0,67° à 4,55° (limite 14°) ; marche de luminance : 0,01 à 8,09 sur 255 (limite 12, `warn`).
- Deux avertissements (`nothing-outside-silhouette`) sur le cou évasé (graines 3 et 42) : 1 à 2 échantillons sur 10 hors contour ne sont pas du fond (cheveux ou épaule non distingués par la mesure).
- Les deux contrôles négatifs prouvent la détection : visage sans corps → colonne médiane trouée ; couleur du corps altérée → écart de teinte > 14°.

## Limites de ces preuves

- Les limites (14°, 12/255) sont des choix d'atelier posés après mesure, pas des seuils de perception.
- Les mesures portent sur 4 graines, 5 cous, un seul corps (adulte, sexe 1, muscularité 0,6), une seule lumière.
- Le cou comprimé a la plus forte marche (jusqu'à 8,09) et montre une ligne sombre à sa base sur `03` : défaut visible, non corrigé (cf. `docs/NECK-REMAINING.md` §F).
