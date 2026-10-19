import { el, urlRef } from '../../../core/svg';
import { gradientStop as stop } from '../../../materials';
import { polyD } from '../../../contact';
import { lineD } from '../soft';
import type { NoseCtx } from './context';

/**
 * Pointe du nez : reflet doux qui accentue son volume (décalé vers la lumière, taille ∝ largeur, force ∝ `highlight`), ombre sous la
 * pointe (∝ projection, c'est elle qui détache la pointe de la lèvre) et, si le raccord pointe/ailes est franc, une rupture (supra-pointe)
 * de chaque côté. Le reflet reste un fondu : aucune tache nette.
 */
export function renderTip(c: NoseCtx): string[] {
  const { g, p, ra, dir, I, u } = c;
  const t = g.tip;
  const tp = p.nose.tip;
  const out: string[] = [];
  // Volume : dégradé radial sur la pointe elle-même (clair côté lumière, ombré à l'opposé).
  const vid = `${c.id}-nose-tipvol`;
  c.defs.push(el('radialGradient', { id: vid, cx: 0.5, cy: 0.5, r: 0.5, fx: 0.5 + dir.x * 0.22, fy: 0.5 + dir.y * 0.22 }, [stop(0, ra.light, 0.85 * tp.highlight * I), stop(0.55, ra.light, 0.08 * tp.highlight * I), stop(0.85, ra.shadow, 0.1), stop(1, ra.shadow, 0.22)]));
  out.push(el('path', { d: polyD(t.poly), fill: urlRef(vid) }));
  // Ombre sous la pointe : ellipse floue sous le lobule, d'autant plus marquée que la projection est forte.
  const sh = 0.3 + 0.4 * tp.projection;
  out.push(c.kit.fill(`${polyD(t.poly.map((q) => ({ x: t.c.x + (q.x - t.c.x) * 1.05, y: t.c.y + t.ry * 0.95 + (q.y - t.c.y) * 0.35 })))}`, ra.shadow, sh * (0.6 + 0.4 * I), 1.6 * u));
  // Supra-pointe : rupture douce entre le lobule et les ailes, quand `alarBlend` est faible.
  const brk = 1 - tp.alarBlend;
  if (brk > 0.05) {
    for (const s of [-1, 1] as const) {
      const x0 = t.c.x + s * t.rx * 0.95;
      out.push(c.kit.stroke(lineD([{ x: x0, y: t.c.y - t.ry * 0.5 }, { x: x0 + s * t.rx * 0.2, y: t.c.y + t.ry * 0.1 }, { x: x0 + s * t.rx * 0.1, y: t.c.y + t.ry * 0.7 }]), ra.shadow, 1.6 * u, 0.35 * brk, 1 * u));
    }
  }
  return out;
}
