import { neckCutRing } from './mesh';
import { project, toCam } from './math';
import type { Frame } from './raster';
import type { HeadTurnSpec, View } from './types';

/**
 * COUPE DU COU PAR LE CADRE (têtes issues d'un visage). Le cou se prolonge sous sa base (`mesh.ts` `NECK_EXT`) ; le rendu ne dessine pas les pixels du cou situés sous la LIGNE HORIZONTALE de l'image
 * qui passe par le point le plus bas de l'anneau de l'orifice thoracique (`neckCutRing`) vu sous la caméra courante (roulis, lacet, tangage, perspective compris). Le bas du cou est donc toujours une droite
 * horizontale, comme le bord de cadre des références `rotation-3d/01` : jamais une ellipse d'envers. Renvoie l'ordonnée de la ligne en pixels du cadre `f`, ou `undefined` (planche : son disque est conservé).
 */
export function neckClipPx(spec: HeadTurnSpec, view: View, f: Frame): number | undefined {
  const ring = neckCutRing(spec, 48);
  if (!ring.length) return undefined;
  let low = -Infinity;
  for (const p of ring) low = Math.max(low, project(toCam(p, view, 'neck'), view).y);
  return f.oy + low * f.ppu;
}
