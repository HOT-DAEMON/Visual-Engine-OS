# Masses de région — ce qui reste à faire

## Fait (cette passe)
Masses de tempe + patte, mèche de joue, nuque, zone rasée, volume du dessus, longueur propre à chaque archétype ; vérification par zones et silhouette ; rendu encre ; planches de preuve ; mémoïsation de la géométrie.

## Pas fait / insuffisant
1. **Fidélité au dessin** (priorité 1) : mèches longues et courbes qui sortent de la silhouette du crâne ; aplats blancs LARGES découpés par mèche (les références sont surtout blanches) ; mèches en S à plusieurs ruptures. Aujourd'hui : rubans courts + deux arcs blancs.
2. **Différenciation des silhouettes** : `top`, `width`, `sweep` agissent, mais l'écart visuel entre archétypes reste faible (voir `HAIR-REFERENCE-COMPARISON.md`). Il faut des formes de masse propres (houppe en vague, frange diagonale franche, chignon avec mèche de raccord).
3. **Pattes** : visibles comme fines bandes ; pas de pointe individualisée ni de patte coupée en biais.
4. **Zone rasée** : aplat uni teinté ; pas de texture de repousse ni de dégradé vers la masse (le dégradé coûterait un filtre).
5. **Valeurs de profil** : choisies à la main d'après les références, non calibrées sur un corpus ; les seuils `sil-*` sont des garde-fous.
6. **Défauts** : `regions` et `ink` restent `false` par défaut ; les passer à `true` change tous les rendus simulés (régénérer `artefacts/regression`).
7. **Chignon / tresses / rangées** : voir `HAIR-SIM-REMAINING.md` (inchangé).
8. **Mèches de joue du moteur d'archétype** (`kind: 'cheek'`, `limit: 'free'`) ne sont pas limitées par zone : seule la nuque, les tempes et les mèches de joue de région le sont.
9. **Performance** : voir `PERF-HAIR-SIM.md` (bruit de peau, ombres de contact : non traités).
10. **Détecteur de silhouette** : aucun contrôle ne compare le rendu à une image cible (IoU) ; il faudrait une vue 3/4 pour que ce soit significatif.
