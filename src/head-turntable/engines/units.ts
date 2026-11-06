/**
 * UNITÉS ENTRE LES MOTEURS EXISTANTS (px de l'hôte) ET LE REPÈRE DE LA TÊTE EN ROTATION (U).
 * Les moteurs `face/*` et `skull/*` travaillent en pixels d'hôte, hauteur de tête H. On les appelle avec H = 1000 px : 1 px = 0,001 U.
 * Le crâne des moteurs va du vertex au bas du menton ; la planche mesure du sommet des CHEVEUX au bas du menton : les cheveux ajoutent `Y0` U
 * au-dessus du vertex (la tête de la planche a une coupe courte, ≈ 0,05 U ≈ 7 px de la planche).
 *   x_U = x_px / 1000          y_U = Y0 + (y_px + H/2) / 1000   (repère de FACE, origine au centre)      y_U = Y0 + y_px / 1000   (repère de PROFIL, origine au vertex)
 *   z_U = zPorion + x_px / 1000   (repère de profil : x vers l'avant, origine au porion = conduit auditif)
 */
export const H_PX = 1000;
export const PX = 1 / H_PX;
/** Épaisseur de la coupe de cheveux au-dessus du vertex, en U (mesurée : sommet des cheveux → ligne des yeux ajustée − ligne des yeux / H du crâne). */
export const Y0 = 0.05;
export const fx = (xPx: number): number => xPx * PX;
export const fy = (yPx: number): number => Y0 + (yPx + H_PX / 2) * PX;
export const py = (yU: number): number => (yU - Y0) * H_PX - H_PX / 2;
/** Profil : ordonnée depuis le vertex (px) ↔ U. */
export const sy = (yPx: number): number => Y0 + yPx * PX;
export const spy = (yU: number): number => (yU - Y0) * H_PX;
