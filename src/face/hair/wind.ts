import { clamp } from '../../core/math';
import type { Vec } from '../../geometry/eye/primitives';
import type { FaceParams } from '../../schema';
import type { Poly } from '../poly';
import type { HairBoundary } from './boundary/types';
import type { HairGeometry, HairLock } from './types';

/**
 * VENT sur la géométrie des cheveux (vue de face), appliqué APRÈS la construction : fonction pure `(géométrie, vent) → géométrie`.
 *  - Une mèche est un levier : sa racine reste sur la lisière, la pointe se déplace le plus. Le déplacement horizontal d'un sommet vaut
 *    `vx · flex · L · u²` (L = longueur de la ligne médiane, u = abscisse réduite racine 0 → pointe 1 du point le plus proche) ; la composante
 *    verticale soulève (`y > 0`) ou rabat (`y < 0`) de la même façon ; la longueur est conservée au second ordre (`− d²/2L`).
 *  - COHÉRENCE : un sommet déplacé qui tomberait sur la PEAU DU VISAGE (`boundary.isFace`, sous l'implantation, hors patte) est ramené
 *    vers sa position d'origine (dichotomie, 6 pas) : le vent ne découvre ni ne recouvre le visage.
 *  - Les mèches `over` (qui passent devant le visage) et les mèches sans ligne médiane (cheveux simulés) ne bougent pas.
 * `flex = 0` ou vent nul : la géométrie rendue est l'objet d'origine, sans copie.
 */
export function applyWind(geo: HairGeometry, wind: FaceParams['hair']['wind'], H: number): HairGeometry {
  const power = Math.hypot(wind.x, wind.y) * wind.flex;
  if (power < 1e-6) return geo;
  const moved = new Map<Poly, Poly>();
  const sway = (spine: Vec[], poly: Poly, b: HairBoundary): Poly => {
    const cum = [0];
    for (let i = 1; i < spine.length; i++) cum.push((cum[i - 1] as number) + Math.hypot((spine[i] as Vec).x - (spine[i - 1] as Vec).x, (spine[i] as Vec).y - (spine[i - 1] as Vec).y));
    const L = cum[cum.length - 1] as number;
    if (L < 1e-6) return poly;
    return poly.map((v) => {
      let k = 0, best = Infinity;
      spine.forEach((s, i) => { const d = (s.x - v.x) ** 2 + (s.y - v.y) ** 2; if (d < best) { best = d; k = i; } });
      // 0,22 : plein vent (|x| = 1, flex = 1) incline la pointe d'environ 12° ; au-delà une longue mèche traverserait le visage.
      const u = (cum[k] as number) / L, g = 0.22 * wind.flex * L * u * u;
      const dx = wind.x * g, dy = -wind.y * g * 0.6;
      // Longueur conservée au second ordre : la pointe se rapproche de la racine de d²/2L le long de la mèche.
      const arc = ((dx * dx + dy * dy) / (2 * L)) * ((spine[spine.length - 1] as Vec).y >= (spine[0] as Vec).y ? -1 : 1);
      const wasFace = b.isFace(v.x, v.y);
      let t = 1, p = { x: v.x + dx, y: v.y + dy + arc };
      for (let i = 0; i < 6 && !wasFace && b.isFace(p.x, p.y); i++) { t *= 0.5; p = { x: v.x + dx * t, y: v.y + (dy + arc) * t }; }
      if (!wasFace && b.isFace(p.x, p.y)) p = { x: v.x, y: v.y };
      return { x: p.x, y: clamp(p.y, -H, H) };
    });
  };
  const locks: HairLock[] = geo.locks.map((l) => {
    if (l.layer === 'over' || !l.spine || l.spine.length < 2) return l;
    const poly = sway(l.spine, l.poly, geo.boundary);
    moved.set(l.poly, poly);
    const spine = sway(l.spine, l.spine, geo.boundary);
    return { ...l, poly, spine };
  });
  // La masse arrière (bob/long) n'a pas de ligne médiane : elle est un levier VERTICAL fixé à son bord haut (spine synthétique de 16 points).
  let backBase = geo.backBase;
  if (backBase && backBase.length > 2) {
    const ys = backBase.map((q) => q.y), x0 = backBase.reduce((a, q) => a + q.x, 0) / backBase.length, top = Math.min(...ys), bot = Math.max(...ys);
    const spine = Array.from({ length: 16 }, (_, i) => ({ x: x0, y: top + ((bot - top) * i) / 15 }));
    const nb = sway(spine, backBase, geo.boundary);
    moved.set(backBase, nb);
    backBase = nb;
  }
  const remap = (a: Poly[]): Poly[] => a.map((q) => moved.get(q) ?? q);
  return { ...geo, locks, backBase, front: remap(geo.front), back: remap(geo.back), over: remap(geo.over) };
}
