# Références anatomiques (`references/anatomy/`) et verdict de fidélité

| Fichier | Contenu | Utilisation |
|---|---|---|
| `ref-01-femme-zbrush-3vues.jpg` | mannequin féminin, dos/face/profil | bassin féminin, rapport hanche/taille, fessier (profil : non fait) |
| `ref-02-homme-muscles-colores.jpg` | homme, muscles colorés par groupe | inventaire des muscles de face : quadriceps (droit fémoral, vaste latéral, vaste médial), sartorius, adducteurs, tibial antérieur, gastrocnémien, patella |
| `ref-03-unites-craniennes-tiers.jpg` | 10 unités crâniennes, tiers du haut du corps | canon `lower/canon.ts` (fourche à mi-hauteur, 4 têtes de jambes à 7,5 têtes) |
| `ref-04-homme-ecorche-profil-face.jpg` | écorché face/profil | relief des cuisses/mollets, pied, genou |

La couleur de fond noire des références n'est PAS reprise : le moteur peint la peau.

## Comparaison (`artefacts/body-lower/07-comparaison-references.png`) — verdict honnête
- **Fait** : mêmes groupes musculaires, proportions par têtes, progression 0 → 5.
- **Pas atteint** : les références sont des sculptures ombrées ; le moteur est un aplat SVG à faible contraste. Le relief des cuisses/mollets est lisible en silhouette mais pas en volume. La taille fine féminine (ref-01) est trop faible. La fidélité « parfaite » demandée n'est **pas** atteinte.
