# Voûte crânienne — preuves visuelles

Toutes les images : graine 3, tête **chauve** (sauf mention), éclairage rasant, même caméra, même rendu ; seule la valeur du paramètre change. Rouge = pixels changés. Protocole et seuils : `docs/SKULL-VAULT-VALIDATION.md` ; architecture : `docs/SKULL-VAULT.md` ; reste à faire : `docs/SKULL-VAULT-REMAINING.md`.

| Fichier | Contenu |
|---|---|
| `00-tete-complete.png` | toute la tête, avec cheveux et chauve, 6 vues |
| `00-synthese-parametres.png` | chaque paramètre : min · nominal · max · différence, dans sa meilleure vue |
| `parametres/<paramètre>.png` | 48 planches (38 + 10 de la passe 2) : min / nominal / max × 6 vues + carte de différence |
| `familles-1.png` … `familles-3.png` | 18 familles (dolicho-, méso-, brachycéphale, haut, bas, occiput plat / proéminent, front large / étroit, pariétaux bombés, plans plats, asymétrique, robuste ; passe 2 : arcade en torus, front à bosses, dolicho à chignon, muscle temporal, asymétries fines) = combinaisons de mesures indépendantes |
| `interactions/<a>__<b>.png` | 13 grilles 3 × 3 de deux paramètres (dont le coin contraint creux temporal × tempes) |
| `contraintes.png` | contraintes strictes (normal) contre caricature (levée) |
| `tissus.png` | cuir chevelu × os apparent, et couches de tissus par région |
| `registre/calque-chauve.png`, `calque-cheveux.png` | sutures, lignes et repères ; vert = visible, rouge = caché + occluseur |
| `cheveux-suivent-la-voute.png` | la coiffure suit la largeur, la hauteur et l'occiput |
| `variete-aleatoire.png` | 12 voûtes tirées au hasard (avec les 10 mesures de la passe 2) |
| `verification/` | `proofs.json` / `.csv` (mesures), `familles.json`, `interactions.json`, `aleatoire.json`, `contraintes.json`, `registre-structures.json` (voisins, tissus, ancrages), `registre-placements.json` (position locale / globale, visibilité, occluseur par vue) |

La passe 2 (front, occiput, tempes, astérion, asymétries) a ses propres preuves dans `artefacts/skull-vault-2/`. Régénérer : voir `docs/SKULL-VAULT.md` et `docs/SKULL-VAULT-2.md`.
