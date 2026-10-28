import { bladeOutline, makeBlade, smoothPath, type Blade } from './blade';
import { viewRayInHead, type HeadSpec, type View } from './head';
import { walk, type LockSpec } from './lock';
import type { V2 } from './vec';

/**
 * PEINTURE d'une coiffure : chaque mèche devient une lame 2D remplie (ton), cernée d'un trait d'encre dont l'épaisseur varie
 * (bord d'ombre en croissant côté `shadow`), avec quelques brins fins. Couches : `back` (derrière la tête : faces cachées),
 * `front` (sur le crâne), `over` (devant le visage). Le tout est du SVG de chemins : aucun filtre, rastérisation rapide.
 */
export interface PaintStyle {
  readonly ink: string;
  readonly lineW: number;
  readonly light: string;
  readonly mid: string;
  readonly dark: string;
}
export const INK: PaintStyle = { ink: '#111', lineW: 0.85, light: '#f3f1ee', mid: '#cfcdca', dark: '#26262a' };

const f = (v: number): string => (Math.round(v * 100) / 100).toString();
const pt = (p: V2): string => `${f(p.x)} ${f(p.y)}`;

/** Remplissage d'après le ton relatif (−1 sombre … +1 clair). */
function fillOf(tone: number, st: PaintStyle): string {
  if (tone <= -0.6) return st.dark;
  if (tone < 0) return st.mid;
  return st.light;
}

/** Croissant d'ombre le long d'un bord : polygone entre le bord et sa copie décalée vers l'intérieur. */
function crescent(edge: V2[], inner: V2[], thick: (t: number) => number): string {
  const n = edge.length; const a: V2[] = []; const b: V2[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1); const k = thick(t);
    const e = edge[i] as V2; const m = inner[i] as V2;
    a.push(e); b.push({ x: e.x + (m.x - e.x) * k, y: e.y + (m.y - e.y) * k });
  }
  return `<path d="${smoothPath([...a, ...b.reverse()], true)}" fill="#111"/>`;
}

export interface PaintedLock { readonly spec: LockSpec; readonly blade: Blade; readonly layer: 'back' | 'front' | 'over'; readonly svg: string }

export function paintLock(h: HeadSpec, L: LockSpec, view: View, st: PaintStyle = INK): PaintedLock {
  const ray = viewRayInHead(view);
  const samples = walk(h, L);
  const blade = makeBlade(L, samples, view, ray);
  const mid = blade.facing.slice(Math.floor(blade.facing.length * 0.2), Math.floor(blade.facing.length * 0.8));
  const meanFacing = mid.reduce((a, b) => a + b, 0) / Math.max(1, mid.length);
  const layer = L.layer === 'auto' ? (meanFacing < -0.05 ? 'back' : 'front') : L.layer;
  const outline = bladeOutline(blade);
  const path = smoothPath(outline, true);
  const parts: string[] = [];
  parts.push(`<path d="${path}" fill="${fillOf(L.tone, st)}" stroke="${st.ink}" stroke-width="${st.lineW}" stroke-linejoin="round"/>`);
  // Bord d'ombre : croissant côté droit de la lame (sens racine → pointe), plus épais au milieu.
  const inset = blade.right.map((p, i) => { const c = blade.spine[i] as V2; return { x: p.x + (c.x - p.x) * 0.3, y: p.y + (c.y - p.y) * 0.3 }; });
  parts.push(crescent(blade.right, inset, (t) => Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 0.03) / 0.94))) ** 0.7 * (L.tone < 0 ? 0.5 : 1)));
  // Brins fins parallèles à l'axe (texture).
  for (let s = 0; s < L.strands; s++) {
    const u = ((s + 1) / (L.strands + 1)) * 2 - 1; // −1…1 en travers de la lame
    const i0 = Math.floor(blade.spine.length * 0.12); const i1 = Math.floor(blade.spine.length * (0.62 + 0.3 * ((s * 7) % 5) / 5));
    const line: V2[] = [];
    for (let i = i0; i <= i1; i++) { const l = blade.left[i] as V2; const r = blade.right[i] as V2; const k = (u + 1) / 2; line.push({ x: l.x + (r.x - l.x) * k, y: l.y + (r.y - l.y) * k }); }
    if (line.length > 3) parts.push(`<path d="${smoothPath(line)}" fill="none" stroke="#111" stroke-width="0.4" opacity="0.6"/>`);
  }
  void pt;
  return { spec: L, blade, layer, svg: parts.join('') };
}

export interface HairPainting { readonly back: string; readonly front: string; readonly over: string; readonly locks: PaintedLock[] }

export function paintHair(h: HeadSpec, locks: readonly LockSpec[], view: View, st: PaintStyle = INK): HairPainting {
  const painted = locks.map((L) => paintLock(h, L, view, st));
  const pick = (l: 'back' | 'front' | 'over'): string => painted.filter((p) => p.layer === l).map((p) => p.svg).join('');
  return { back: pick('back'), front: pick('front'), over: pick('over'), locks: painted };
}
