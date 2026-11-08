import { PART, type Mesh } from '../mesh';
import type { View } from '../types';

/**
 * OREILLE LOINTAINE. À 20° (et de dos à 160°) la planche de référence ne dessine pas l'oreille de l'autre côté : elle n'est qu'un fragment du dos du pavillon qui dépasse de la joue.
 * Le tampon de profondeur seul la laisse visible (le pavillon est ouvert de ~28° et dépasse le contour), d'où un lobe fantôme. Convention du dessin : l'oreille lointaine est OMISE dans
 * les vues où elle serait vue de dos, presque à plat contre le crâne : |sin lacet| entre `EAR_CULL.s0` et `EAR_CULL.s1` (≈ 8° – 35°), et son symétrique de dos (145° – 172°).
 * À 0° et 180° les deux oreilles se lisent de face / de dos ; au-delà de 35° le crâne cache l'oreille lointaine : le tampon de profondeur décide seul.
 */
export const EAR_CULL = { s0: Math.sin((8 * Math.PI) / 180), s1: Math.sin((35 * Math.PI) / 180) } as const;

/** Côté (+1 : x > 0) de l'oreille LOINTAINE du lacet donné, ou 0 si aucune oreille n'est omise. */
export function farEarSide(view: View): 0 | 1 | -1 {
  const a = (view.yaw * Math.PI) / 180, s = Math.sin(a), as = Math.abs(s);
  if (as < EAR_CULL.s0 || as > EAR_CULL.s1) return 0;
  return s > 0 ? -1 : 1;   // lacet > 0 : le visage se tourne vers la gauche de l'image, l'oreille +x est la plus proche de la caméra
}

/** Retire de la liste le pavillon lointain (les pavillons sont repérés par le signe de leur abscisse moyenne). */
export function cullFarEar(meshes: readonly Mesh[], view: View): readonly Mesh[] {
  const side = farEarSide(view);
  if (!side) return meshes;
  return meshes.filter((m) => m.id !== PART.ear || Math.sign(m.P.reduce((s, p) => s + p.x, 0)) !== side);
}
