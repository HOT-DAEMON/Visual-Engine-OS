# Artefacts — passe 12 (détail atomique de l'iris)
Générés par `npx tsx scripts/artefacts-eyes-pass12.ts` ; mesures : `python3 scripts/eye-refs/extract_iris_atoms.py` (`refs/` = recadrages + déroulés polaires des références).
- `01-iris-reference-vs-moteur.png` : références (haut) / moteur (bas).
- `02-sans-avec-couches-atomiques.png` : chaque famille sans, puis avec fentes / facettes taillées / arcs / braises / vides ; part sombre dessous.
- `03-un-parametre-a-la-fois.png` : `slits.count`, `slits.widthDeg`, `facets.cut`, `arcs.count`, `embers.count`, `voids.strength`.
- `04-tetes-entieres.png`, `04b-tete-gros-plan-*.png` : têtes complètes (source `extended4`).
- `05-rapport-passe12.json` : moteur contre références (part sombre, fentes, cellules, étoiles, règles de rendu).
Limites : voir `docs/EYES-PASS-12.md` et `docs/EYES-REMAINING.md` § Passe 12.
