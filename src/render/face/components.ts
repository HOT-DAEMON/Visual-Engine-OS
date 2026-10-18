import { outlinePath, headPoly, chinPoly, earGeometry, noseGeometry, rightSamples, type FaceLandmarks, type NoseGeometry } from '../../face';
import { superEllipse } from '../../face/curve';
import { hairGeometry } from '../../face/hair';
import type { Poly } from '../../face/poly';
import type { FaceComponent, Receivers } from '../../contact';
import type { FaceParams } from '../../schema';
import { neckPath } from './neck';

/** Arête ouverte du menton : le contour réel du sillon mentolabial au bas, puis symétriquement (sans la corde du sillon). */
const chinEdge = (lm: FaceLandmarks): { x: number; y: number }[] => {
  const r = rightSamples(lm.outline, 24).filter((q) => q.y >= lm.chin.sulcusY);
  return [...[...r].reverse().map((q) => ({ x: -q.x, y: q.y })), ...r];
};

/** Polygone approchant l'ellipse (cx, cy, rx, ry). */
const ell = (cx: number, cy: number, rx: number, ry: number): Poly => superEllipse(cx, cy, rx, ry, 2, 24);

/**
 * REGISTRE des composants du visage pour le sous-moteur d'ombres de contact et de lumières de contour. Arbre :
 *   head ─┬─ nose ─┬─ tip, alaL, alaR
 *         ├─ orbitL, orbitR   ├─ earL, earR   ├─ mouth   ├─ chin   ├─ hair   └─ neck
 * Chaque composant lit ses silhouettes dans la géométrie pure (jamais dans le SVG) : le sous-moteur travaille donc sur les mêmes formes
 * que le rendu et que la vérification. Pour ajouter un composant futur : l'ajouter ici (identité, parent, silhouette, receveurs).
 */
export function faceComponents(p: FaceParams, lm: FaceLandmarks, nose?: NoseGeometry): { components: FaceComponent[]; receivers: Receivers } {
  const n = nose ?? noseGeometry(p, lm);
  const H = lm.H;
  const proj = n.tip.projectionPx;
  const comps: FaceComponent[] = [
    { id: 'head', parent: null, kind: 'caster', opaque: true, polys: [headPoly(lm)], depth: 0.05 * H * (1 + lm.jaw.tissue.submentalTension) * (0.8 + 0.6 * p.chin.projection), receivers: ['neck'], contact: 'jaw', rim: 'head' },
    { id: 'nose', parent: 'head', kind: 'caster', polys: [n.silhouette], rimEdge: (['left', 'right'] as const).map((sd) => n.dorsum.axis.slice(4).map((q, i) => ({ x: q.x + (sd === 'left' ? -1 : 1) * (n.dorsum.half[i + 4] as number), y: q.y }))), depth: Math.max(1.5, proj * 0.25), receivers: ['head'], contact: 'nose', rim: 'nose' },
    { id: 'tip', parent: 'nose', kind: 'caster', polys: [n.tip.poly], depth: Math.max(1.5, proj * 0.35), receivers: ['head'], rim: 'tip' },
    { id: 'alaL', parent: 'nose', kind: 'caster', polys: [n.alae.left.poly], rimEdge: [n.alae.left.outerEdge], depth: 1 + n.alae.left.thicknessPx * 0.6, receivers: ['head'], contact: 'alae', rim: 'alae' },
    { id: 'alaR', parent: 'nose', kind: 'caster', polys: [n.alae.right.poly], rimEdge: [n.alae.right.outerEdge], depth: 1 + n.alae.right.thicknessPx * 0.6, receivers: ['head'], contact: 'alae', rim: 'alae' },
    ...(['left', 'right'] as const).map((s): FaceComponent => {
      const o = lm.orbit[s];
      return { id: s === 'left' ? 'orbitL' : 'orbitR', parent: 'head', kind: 'socket', edge: 'soft', polys: [ell(o.cx, o.cy, o.rx, o.ry)], depth: 0.012 * H, receivers: ['head'], contact: 'orbits' };
    }),
    ...earGeometry(p, lm).map((e): FaceComponent => ({ id: e.side < 0 ? 'earL' : 'earR', parent: 'head', kind: 'socket', polys: [e.poly], depth: 0.008 * H, receivers: ['head'], contact: 'ears', rim: 'ears' })),
    { id: 'mouth', parent: 'head', kind: 'caster', opaque: true, polys: [ell(0, lm.lips.bottomY - lm.lips.lowerH * 0.5, lm.lips.half * 0.6, lm.lips.lowerH * 0.5)], depth: 0.006 * H, receivers: ['head'], contact: 'mouth', rim: 'mouth' },
    { id: 'chin', parent: 'head', kind: 'caster', polys: [chinPoly(lm)], rimEdge: [chinEdge(lm)], depth: 0.004 * H, receivers: [], rim: 'chin' },
  ];
  const hair = hairGeometry(p, lm);
  if (hair) comps.push({ id: 'hair', parent: 'head', kind: 'caster', opaque: true, polys: hair.locks.filter((l) => l.layer === 'front' && (l.rank === 'mass' || l.rank === 'main')).map((l) => l.poly), depth: 0.012 * H, receivers: ['head'], contact: 'hair' });
  if (p.neck.visible) comps.push({ id: 'neck', parent: 'head', kind: 'caster', polys: [[{ x: -lm.neck.half, y: lm.neck.topY }, { x: lm.neck.half, y: lm.neck.topY }, { x: lm.neck.half, y: lm.neck.bottomY }, { x: -lm.neck.half, y: lm.neck.bottomY }]], rimEdge: [[{ x: -lm.neck.half, y: lm.chinY }, { x: -lm.neck.half, y: lm.neck.bottomY }], [{ x: lm.neck.half, y: lm.chinY }, { x: lm.neck.half, y: lm.neck.bottomY }]], depth: 0, receivers: [], rim: 'neck' });
  const receivers: Receivers = { head: outlinePath(lm.outline), ...(p.neck.visible ? { neck: neckPath(p, lm) } : {}) };
  return { components: comps, receivers };
}
