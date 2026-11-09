# Changelog 23 — frange en touffes continues (branche `feat/hair-grammar`)

- **Frange `blades`** : `layoutBlades` (`src/face/hair/fringe-blades.ts`) remplace les 5–7 triangles isolés par des touffes `ribbon` continues qui se chevauchent à la racine (×3, plafond 20) ; longueurs corrélées, jour central conservé.
- **Frange `wispy`** : mèches `ribbon` fines, hauteurs de pointe lissées (rugosité médiane 0,0181 → 0,0027 H). `sheer` et `asym_brow` : rendu inchangé.
- **Vérification** : `src/verify/hair-fringe-tufts.ts` (continuité, largeur, aspect, rugosité du bord), branché dans `hair-form.ts`. 126 visages à lames : échecs 53 / 114 / 77 / 5 avant, 0 après (seuils posés sur ce corpus).
- **Tests** : `tests/hair-fringe-tufts.test.ts` (7) ; suite complète 2879 verts avant son ajout ; `npm run regress` 34/34 `exact`.
- **Effet de bord mesuré** : le reste de la chevelure change à graine égale (0 / 126 identiques ; cause probable : flux aléatoire décalé).
- **Artefacts** : `artefacts/hair-s4/` (avant / après, têtes entières et gros plans).
- **Docs** : `HAIR-BLADES.md`, `HAIR-BLADES-REMAINING.md` ; mise à jour de `HAIR-FORM-REMAINING.md` 8 et 21.
- Reste à faire : `docs/HAIR-BLADES-REMAINING.md` (dont retombée des cheveux longs et dents de scie de l'afro, non traités).
