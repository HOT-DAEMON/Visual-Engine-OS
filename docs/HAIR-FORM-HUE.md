# Teinte des étages : harmonie analogue (`hair-look.ts`)

Suite de `HAIR-FORM.md` (plafond de teinte 24°, seuil 48°). Traite `HAIR-FORM-REMAINING.md` 9 (« posés sur des mesures »).

## Principe
Plafond de 24° et seuil de 48° venaient de 720 étages mesurés. Remplacés par une règle d'harmonie : des cheveux d'une même personne restent des couleurs ANALOGUES, soit ± 30° (une case de la roue à 12 teintes, règle classique des illustrateurs).
- `ANALOGOUS_MAX = 30`.
- `tierHueShift(h, tier, ra)` : décalage de l'étage borné pour que la teinte RENDUE soit à ≤ 30° de celle des cheveux ; le plafond 24° (`UNDER_HUE_MAX`) reste le plafond du décalage seul.
- Cheveux gris (saturation < 0,15) : pas de famille de teinte, plafond seul.
Vérification : `tier-hue-near-hair` (≤ 30,5°) lit la même fonction que le rendu.

## Limites
La roue à 12 teintes est une convention d'atelier, pas une mesure perceptuelle (CIELAB/OKLCH ne le justifie pas partout) ; non comparée à des visages dessinés. Revue humaine nécessaire.
