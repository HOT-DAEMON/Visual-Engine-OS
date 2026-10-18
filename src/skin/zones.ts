import { clamp01 } from '../core/math';
import { el, urlRef } from '../core/svg';
import type { ResolvedAppearance } from '../appearance';
import type { Ellipse, FaceLandmarks, SkinRegions } from '../face';
import type { LightVector } from '../lighting/light';
import { intensityFor, softness } from '../lighting/rig';
import { spotGradient } from '../materials';
import type { FaceLighting } from '../schema';

/**
 * Zones lumineuses : front, nez, joues, épaules. Chaque zone est une grande tache diffuse de la COULEUR DE LA LUMIÈRE, décalée vers la
 * source (directionnalité) : l'éclairage est doux mais on sait d'où il vient. Les épaules (cou évasé) reçoivent la même logique.
 * Elles ne sont pas des reflets (qui dépendent de la rugosité) : elles modélisent la lumière DIFFUSE reçue par les volumes larges.
 */
export function compileZones(id: string, lm: FaceLandmarks, regions: SkinRegions, zones: FaceLighting['zones'], L: LightVector, ra: ResolvedAppearance, dir: { x: number; y: number }): { defs: string[]; markup: string[] } {
  const defs: string[] = [];
  const markup: string[] = [];
  const I = intensityFor(L, 'skin');
  const soft = softness(L);
  const list: [string, readonly Ellipse[], { intensity: number; spread: number }][] = [
    ['forehead', regions.forehead, zones.forehead],
    ['nose', regions.nose, zones.nose],
    ['cheeks', regions.cheeks, zones.cheeks],
    ['shoulders', regions.shoulders, zones.shoulders],
  ];
  for (const [name, ells, z] of list) {
    // Étalement : de 0,8 à 1,6 fois la région ; bord adouci par `zones.softness` ET par la douceur de la lumière.
    const k = 1 + 0.9 * z.spread;
    const edge = clamp01(0.4 + 0.45 * zones.softness + 0.15 * soft);
    // Teinte : lumière légèrement réchauffée par la teinte de lumière de l'apparence (pas du blanc pur).
    const alpha = clamp01(z.intensity * 0.2 * I * (name === 'shoulders' ? 0.8 : 1));
    ells.forEach((e, i) => {
      const gid = `${id}-zone-${name}${i}`;
      defs.push(spotGradient(gid, ra.light, alpha, edge));
      // Décalage vers la lumière : `directionality` × 35 % du rayon, dans la direction 2D de la source.
      markup.push(el('ellipse', { cx: e.cx + dir.x * zones.directionality * e.rx * 0.35, cy: e.cy + dir.y * zones.directionality * e.ry * 0.35, rx: e.rx * k, ry: e.ry * k, fill: urlRef(gid) }));
    });
  }
  void lm;
  return { defs, markup };
}
