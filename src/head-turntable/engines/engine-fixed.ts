/**
 * PARAMÈTRES NON AJUSTÉS PAR OPTIMISATION (écrits à la main, chacun avec son origine). `fit-engines.ts` les fusionne avec les paramètres ajustés.
 * [mesuré] = lu sur la planche ; [dérivé] = résolu analytiquement depuis une mesure ; [choisi] = style de la planche (anime) ou défaut du moteur.
 */
export const FIXED_FACE: Record<string, unknown> = {
  anatomyEngine: 'structured',
  // Mâchoire rigide : le menton de la planche est à 1,05 U bouche ouverte ; l'abaissement de la mandibule est déjà dans la mesure. [dérivé]
  jaw: { mobility: 0 },
  // Bouche : demi-largeur 0,10 U → width = 0,2 / W ; sourire ouvert (open 0,6, courbure +0,5). [mesuré / choisi]
  mouth: { width: 0.26, open: 0.6, curve: 0.5 },
  nose: { width: 0.14, root: { height: 0 } },
  ears: {
    family: 'human',
    // Largeur +0,78 (w = 0,186 U) : résolue depuis la largeur visible de l'oreille à 0° (0,115 U) et à 90° (0,146 U) : w·sin α = 0,115, w·cos α = 0,146 → α = 38°. Ouverture ramenée à 28° : compromis
    // avec la vue de 135° où la planche montre ~0,08 U d'oreille (un pavillon plan à 38° y est de chant : 0,02 U) ; erreurs résultantes : 0° −0,02 U, 90° +0,014 U, 135° −0,03 U. [dérivé]
    attach: { openingDeg: 28, pitchDeg: 0, rotationDeg: 6 },
    morph: { width: 0.78 },
    // Racine de l'hélix à 0,34 de la hauteur : haut de l'oreille à 0,54 U et bas (lobule) sur la base du nez à 0,80 U, comme mesuré sur la planche. [dérivé]
    anchors: { crusLevel: 0.34 },
    style: { look: 'anime', detail: 0.55, asymmetry: 0 },
  },
};
export const FIXED_SKULL: Record<string, unknown> = {};
