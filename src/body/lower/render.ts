import { darken, lighten } from '../../core/color';
import { el, urlRef } from '../../core/svg';
import { reveal, tierOf } from '../muscle-tiers';
import type { BodyMarkup, BodyRenderOpts } from '../render';
import { box, pathOf } from '../shape';
import type { Atom } from '../types';
import type { LegGeo } from './geometry';

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const hash = (s: string): number => { let x = 2166136261; for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619); return x >>> 0; };
const hslHex = (hh: number, s: number, l: number): string => { const k = (n: number): number => (n + hh / 30) % 12, a = s * Math.min(l, 1 - l), f = (n: number): string => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))).toString(16).padStart(2, '0'); return `#${f(0)}${f(8)}${f(4)}`; };
const layerOf = (a: Atom): number => (a.part.startsWith('foot.') ? 3 : a.part.startsWith('shin.') ? 2 : a.part.startsWith('thigh.') ? 1 : 0);
const isEnv = (a: Atom): boolean => (a.kind === 'skin' && a.level === 0) || a.id.startsWith('foot.toe.');

/**
 * Rendu du bas du corps = f(géométrie, matière, lumière) : AUCUN filtre, même lumière (gauche de l'image), même encre et même peau que le haut.
 * À poser DERRIÈRE le tronc (`figureMarkup`) : le bassin passe sous le tronc, les cuisses sous le bassin visuel. Les muscles apparaissent par PALIERS
 * (`muscle-tiers.ts`) : un atome de palier `min` n'est peint qu'à partir de `min − 1`.
 */
export function renderLegs(geo: LegGeo, o: BodyRenderOpts): BodyMarkup {
  const f = geo.frame.body, h = f.h, level = o.level ?? 3, uid = `${o.uid ?? 'bd'}L`;
  const skin = o.skin, ink = darken(skin, 0.62), shade = darken(skin, 0.2), sw = 0.0085 * h, vis = clamp01(1.4 * f.vis), T = tierOf(f.vis);
  const own = geo.atoms, g: string[] = [], defs: string[] = [];
  if (o.mode === 'atoms') {
    for (const a of [...own].sort((p, q) => p.z - q.z)) {
      const col = hslHex(hash(a.part) % 360, 0.7, 0.45);
      g.push(el('path', { d: pathOf(a.poly, !a.open), fill: a.open ? 'none' : col, 'fill-opacity': a.level === 0 ? 0.12 : 0.3, stroke: col, 'stroke-width': (a.level === 0 ? 1.2 : 0.7) * sw * 0.6, 'stroke-dasharray': a.view === 'occluded' ? `${0.012 * h} ${0.01 * h}` : undefined, 'stroke-linejoin': 'round' }));
    }
    return { back: el('g', {}, g), front: '' };
  }
  const shown = own.filter((a) => a.view === 'front' && a.level <= level).sort((a, b) => a.z - b.z), env = shown.filter(isEnv);
  const detail = (a: Atom): string => {
    const d = pathOf(a.poly, !a.open), rv = a.tier === undefined ? 1 : reveal(T, a.tier);
    if (a.kind === 'muscle' || a.kind === 'fat') { const t = a.tone ?? 0, k = (a.kind === 'fat' ? 0.5 : vis) * rv; return el('path', { d, fill: t >= 0 ? lighten(skin, 0.9 * t) : darken(skin, -1.4 * t), 'fill-opacity': 0.7 * k, stroke: shade, 'stroke-width': 0.4 * sw, 'stroke-opacity': 0.7 * k, 'stroke-linejoin': 'round' }); }
    if (a.kind === 'line') return el('path', { d, fill: 'none', stroke: ink, 'stroke-width': 0.45 * sw, 'stroke-opacity': 0.5 * Math.max(vis, 0.35) * (a.id.startsWith('foot.tendon') ? clamp01(T - 2) : 1), 'stroke-linecap': 'round' });
    if (a.kind === 'bone') return el('path', { d, fill: 'none', stroke: ink, 'stroke-width': 0.5 * sw, 'stroke-opacity': 0.5 * (1 - f.fat) * clamp01(f.vis * 2 + 0.2), 'stroke-linecap': 'round' });
    if (a.kind === 'nail') return el('path', { d, fill: lighten(skin, 0.42), 'fill-opacity': 0.85, stroke: shade, 'stroke-width': 0.4 * sw });
    return el('path', { d, fill: shade, 'fill-opacity': 0.28 });
  };
  const grad = new Map<string, string>();
  const gradOf = (a: Atom): string => {
    const key = `${layerOf(a)}${a.side}`;
    let id = grad.get(key);
    if (!id) {
      const b = box(env.filter((q) => layerOf(q) === layerOf(a) && q.side === a.side).flatMap((q) => [...q.poly]));
      id = `${uid}-sh${grad.size}`; grad.set(key, id);
      defs.push(el('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1: b.x0, y1: 0, x2: b.x1, y2: 0 }, [el('stop', { offset: 0, 'stop-color': shade, 'stop-opacity': 0 }), el('stop', { offset: 0.55, 'stop-color': shade, 'stop-opacity': 0.08 }), el('stop', { offset: 1, 'stop-color': shade, 'stop-opacity': layerOf(a) === 0 ? 0.3 : 0.5 })]));
    }
    return id;
  };
  const visible = (a: Atom): boolean => !(a.kind === 'muscle' && (vis < 0.06 || (a.tier !== undefined && reveal(T, a.tier) < 0.04))) && !(a.kind === 'bone' && f.vis < 0.03);
  defs.push(el('clipPath', { id: `${uid}-clip` }, env.map((a) => el('path', { d: pathOf(a.poly) }))));
  for (const a of env) g.push(el('path', { d: pathOf(a.poly), fill: ink, stroke: ink, 'stroke-width': 2 * sw, 'stroke-linejoin': 'round' }));
  for (let layer = 0; layer < 4; layer++) {
    for (const a of env.filter((q) => layerOf(q) === layer)) g.push(el('path', { d: pathOf(a.poly), fill: skin }), ...(layer === 3 ? [] : [el('path', { d: pathOf(a.poly), fill: urlRef(gradOf(a)) })]));
    const dts = shown.filter((q) => layerOf(q) === layer && !isEnv(q) && visible(q));
    if (dts.length) g.push(el('g', { 'clip-path': urlRef(`${uid}-clip`) }, dts.map(detail)));
  }
  return { back: el('g', {}, [el('defs', {}, defs), ...g]), front: '' };
}
