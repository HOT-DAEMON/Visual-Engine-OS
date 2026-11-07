# Changelog 18 — moteur de cou (branche `hair-grammar`)

- **Audit** : le cou existait en 5 calculs indépendants ; aucun moteur unique. Détail et décisions : `docs/NECK-ENGINE.md` (pas de nouveau compilateur enregistré, justifié §2).
- **Moteur** (`src/neck/`, 18 fichiers) : contrats (6 objets), cadre unique `lm.neck`, morphologie, géométrie primaire (sections superelliptiques par rayon), 12 opérateurs + garde-fous, rig, 3 contrôleurs, M01–M10, espèces, styles, accessoires et collisions, anatomie (12 structures), secondaire M09.
- **Rendu** (`src/render/neck/`) : contour, ombrage par normales, muscles, reliefs, écailles/plaques/plumes, accessoires. Remplace `render/face/neck.ts` (supprimé).
- **Doublons retirés** : formule du cadre (`landmarks.ts`), SCM de la structure, formule du platysma (unique), constantes `0,85` et `TWIST` de la pose, `half × (1+flare)` de l'ancre du corps (désormais dernière section du cou).
- **Défauts trouvés par les tests et corrigés** : section rectangulaire mal paramétrée (trou de 14 px) ; cou plus large que la joue visible à côté de la tête ; roulis d'expression sortant le cou de sous la tête ; 11 paramètres sans effet visible renforcés ; champ `simplify` ignoré du rendu ; marche entre le cou et le torse.
- **Contrat** : `FaceNeck.system` ajouté ; `FaceNeck.length` max 0,4 → 1,6.
- **Tests** : `neck-engine` (22), `neck-criteria` (14), `neck-visible` (67, un cas par paramètre + garde de couverture). Vérification : `src/verify/neck.ts` dans `verifyFace` (24 visages, 0 erreur ; 5 contrôles négatifs détectés).
- **Artefacts** : `artefacts/neck/` (planches 01–09, `10-verification.json`, `11-tableau-preuves.json`), `docs/NECK-PROOF.md`. `npx tsx scripts/artefacts-neck.ts`.
- **Références visuelles** : 34 régénérées (le cou change) — voir `docs/NECK-REMAINING.md` §E.
- Reste à faire : `docs/NECK-REMAINING.md`.
