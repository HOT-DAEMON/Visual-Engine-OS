import { el, num } from '../../core/svg';
import { surfaceNormal } from '../../neck/geometry';
import type { P2 } from '../../neck/types';
import { mix } from '../../core/color';
import type { NeckCtx } from './ctx';

/**
 * ACCESSOIRES et éléments additionnels (GEO-04, `NeckAttachmentGraph.attachments`) : collier, écharpe, crête, collerette, pointes. Chacun est ANCRÉ sur la
 * surface déformée (u le long du cou) et suit ses sections ; le collier/l'écharpe serrent AUSSI la géométrie du cou (contrôleur de déformation, M10 :
 * le tissu déborde de part et d'autre). `behind` se dessine derrière le cou (crête et collerette dépassent de ses bords), `front` par-dessus.
 */
const shadeOf = (c: NeckCtx, color: string, n: { x: number; y: number; z: number }): string => {
  const lit = Math.max(0, n.x * c.L.x + n.y * c.L.y + n.z * c.L.z);
  return mix(c.ra.shadow, color, 0.45 + 0.55 * Math.min(1, lit * (0.6 + 0.6 * c.I)));
};
const path = (pts: readonly P2[]): string => `M${pts.map((p) => `${num(p.x)} ${num(p.y)}`).join('L')}Z`;

export function renderAttachments(c: NeckCtx): { behind: string[]; front: string[] } {
  const behind: string[] = [], front: string[] = [], U = c.u, H = c.model.ctx.H, S = c.model.stations;
  const att = c.model.composition.graph.attachments;
  for (const a of att) {
    const idx = Math.round(a.at * (S.length - 1)), thick = Math.max(4 * U, a.size * 0.1 * H);
    if (a.kind === 'collar' || a.kind === 'scarf') {
      const ring = (u: number, lift: number): P2[] => Array.from({ length: 13 }, (_, k) => c.at(u, -Math.PI / 2 + (k / 12) * Math.PI, lift));
      const w = a.kind === 'scarf' ? 1.6 : 1, ua = a.at - (thick * w * 0.5) / c.model.composition.morphology.lengthPx, ub = a.at + (thick * w * 0.5) / c.model.composition.morphology.lengthPx;
      const top = ring(ua, 3 * U), bot = ring(ub, 3 * U).reverse();
      const n = surfaceNormal(c.model, idx, 0);
      front.push(el('path', { d: path([...top, ...bot]), fill: shadeOf(c, a.color, n), stroke: c.ra.shadow, 'stroke-width': 1.1 * U, 'stroke-opacity': 0.6, 'stroke-linejoin': 'round' }));
      front.push(c.kit.stroke(`M${top.map((p) => `${num(p.x)} ${num(p.y + 1.2 * U)}`).join('L')}`, c.ra.light, 1.1 * U, 0.2 * c.I, 0.8 * U));
      if (a.kind === 'scarf') { const m = c.at(a.at, 0), L = a.size * 0.5 * H, sw = c.sys.pose.tissueLag * 0.35 * L; front.push(el('path', { d: `M${num(m.x - 0.05 * L)} ${num(m.y)}L${num(m.x + 0.09 * L)} ${num(m.y)}L${num(m.x + 0.1 * L + sw)} ${num(m.y + L * (1 - 0.1 * Math.abs(c.sys.pose.tissueLag)))}L${num(m.x - 0.04 * L + sw)} ${num(m.y + L * 1.05 * (1 - 0.1 * Math.abs(c.sys.pose.tissueLag)))}Z`, fill: shadeOf(c, a.color, n), stroke: c.ra.shadow, 'stroke-width': 1 * U, 'stroke-opacity': 0.5 })); }
    } else if (a.kind === 'spikes') {
      for (let k = 0; k < a.count; k++) {
        const psi = -Math.PI / 2 + ((k + 0.5) / a.count) * Math.PI, n = surfaceNormal(c.model, idx, psi), b = c.at(a.at, psi), len = a.size * 0.12 * H, w = Math.max(3 * U, len * 0.45);
        const tip = { x: b.x + n.x * len, y: b.y + n.y * len - 0.25 * len };
        front.push(el('path', { d: path([{ x: b.x - w / 2, y: b.y }, tip, { x: b.x + w / 2, y: b.y }]), fill: shadeOf(c, a.color, n), stroke: c.ra.shadow, 'stroke-width': 0.9 * U, 'stroke-opacity': 0.6, 'stroke-linejoin': 'round' }));
      }
    } else if (a.kind === 'crest') {
      // Crête dorsale : triangles qui dépassent des DEUX bords du cou (la nuque est derrière), de la collerette de mâchoire à `at`.
      const u0 = Math.max(0, c.jawU), cnt = a.count;
      for (let k = 0; k < cnt; k++) for (const s of [-1, 1] as const) {
        const u = u0 + ((k + 0.5) / cnt) * (a.at - u0 + 0.15), e = c.at(Math.min(1, u), s * Math.PI / 2), len = a.size * 0.1 * H * (1 - 0.3 * (k / cnt)), w = len * 0.55;
        behind.push(el('path', { d: path([{ x: e.x - s * 1.5 * U, y: e.y - w / 2 }, { x: e.x + s * len, y: e.y + 0.3 * len }, { x: e.x - s * 1.5 * U, y: e.y + w / 2 }]), fill: shadeOf(c, a.color, { x: s, y: 0, z: 0.2 }), stroke: c.ra.shadow, 'stroke-width': 0.9 * U, 'stroke-opacity': 0.6, 'stroke-linejoin': 'round' }));
      }
    } else {
      // Collerette : éventail derrière la tête, rayons ancrés sur le haut du cou.
      const cy = c.model.ctx.jawY, R = a.size * 0.9 * H, hw = c.model.ctx.chinHalf * 1.6;
      for (let k = 0; k < a.count; k++) {
        const t = (k + 0.5) / a.count, ang = Math.PI * (0.92 - 0.84 * t), x0 = (t - 0.5) * hw, tip = { x: x0 + Math.cos(ang) * R * 0.9, y: cy - Math.sin(ang) * R * 0.55 }, wdt = (R * 0.9) / a.count;
        behind.push(el('path', { d: path([{ x: x0 - wdt / 2, y: cy + 0.1 * H }, tip, { x: x0 + wdt / 2, y: cy + 0.1 * H }]), fill: shadeOf(c, a.color, { x: Math.cos(ang), y: -0.3, z: 0.5 }), stroke: c.ra.shadow, 'stroke-width': 0.9 * U, 'stroke-opacity': 0.55, 'stroke-linejoin': 'round' }));
      }
    }
  }
  return { behind, front };
}
