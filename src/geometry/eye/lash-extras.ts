import { clamp, rad } from '../../core/math';
import { mulberry32 } from '../../core/prng';
import type { EyeSpec } from '../../schema';
import type { Lash } from './lashes';
import type { OpeningGeometry } from './opening';
import { upperFrame } from './opening';
import type { Vec } from './primitives';

const lerp = (a: Vec, b: Vec, f: number): Vec => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });

/**
 * Mèches : les cils voisins (déjà triés le long du bord) sont regroupés par paquets de
 * `size` (± 1, tiré dans un PRNG DÉDIÉ — jamais celui des cils, pour ne rien décaler). Les racines
 * restent espacées ; les POINTES convergent vers la pointe moyenne du paquet (d'autant plus que
 * `clump` est grand) et le cil central du paquet est un peu plus long : l'aspect « cils humides »
 * des dessins d'animé. `clump` = 0 renvoie la liste inchangée.
 */
export function clumpLashes(lashes: readonly Lash[], clump: number, size: number, seed: number): Lash[] {
  if (clump <= 0 || lashes.length < 2) return [...lashes];
  const rnd = mulberry32((seed ^ 0x9e3779b1) >>> 0);
  const out: Lash[] = [];
  let i = 0;
  while (i < lashes.length) {
    const r = rnd();
    let n = size + (r < 0.25 ? -1 : r > 0.75 ? 1 : 0);
    n = clamp(n, 2, 7);
    if (lashes.length - (i + n) === 1) n += 1; // pas de paquet orphelin d'un seul cil
    const group = lashes.slice(i, Math.min(lashes.length, i + n));
    i += group.length;
    const m = group.length;
    const meanTip: Vec = { x: group.reduce((a, l) => a + l.tip.x, 0) / m, y: group.reduce((a, l) => a + l.tip.y, 0) / m };
    const meanCtrl: Vec = { x: group.reduce((a, l) => a + l.ctrl.x, 0) / m, y: group.reduce((a, l) => a + l.ctrl.y, 0) / m };
    group.forEach((l, k) => {
      const centrality = m === 1 ? 1 : 1 - Math.abs(k - (m - 1) / 2) / ((m - 1) / 2 || 1);
      const grow = 1 + 0.2 * clump * centrality;
      const tip0 = lerp(l.tip, meanTip, clump * 0.72);
      const tip = { x: l.base.x + (tip0.x - l.base.x) * grow, y: l.base.y + (tip0.y - l.base.y) * grow };
      const ctrl = lerp(l.ctrl, meanCtrl, clump * 0.45);
      out.push({ ...l, tip, ctrl });
    });
  }
  return out;
}

/**
 * Cils longs du canthus externe (voir `LashFlick`) : des cubiques ancrées sur les derniers `reach`
 * du bord supérieur. L'angle part de `liftDeg` au cil le plus externe et se redresse vers l'intérieur
 * du groupe (éventail), la longueur croît vers l'extérieur, la pointe se recourbe vers le haut.
 */
export function flickLashes(
  g: OpeningGeometry,
  flick: EyeSpec['lashes']['upper']['flick'],
  lidPx: number,
  rootShift: (t: number) => number,
  seed: number,
): Lash[] {
  if (flick.count <= 0) return [];
  const rnd = mulberry32((seed ^ 0x51ed270b) >>> 0);
  const out: Lash[] = [];
  const up: Vec = { x: 0, y: -1 };
  for (let i = 0; i < flick.count; i++) {
    const u = flick.count === 1 ? 1 : i / (flick.count - 1); // 0 = le plus interne, 1 = le plus externe
    const jLen = rnd();
    const jAng = rnd();
    const t = clamp(1 - flick.reach * (1 - u) - 0.004, 0.5, 0.995);
    const f = upperFrame(g, t);
    const base: Vec = { x: f.pos.x + f.N.x * rootShift(t), y: f.pos.y + f.N.y * rootShift(t) };
    const a = rad(flick.liftDeg + (1 - u) * 34 + (jAng - 0.5) * 8);
    const d: Vec = { x: g.s * Math.cos(a) + up.x * Math.sin(a), y: up.y * Math.sin(a) };
    const len = flick.length * g.h * (0.62 + 0.38 * u) * (1 + (jLen - 0.5) * 0.24);
    const lift = flick.curl * len;
    out.push({
      base,
      ctrl: { x: base.x + d.x * len * 0.35, y: base.y + d.y * len * 0.35 },
      ctrl2: { x: base.x + d.x * len * 0.72, y: base.y + d.y * len * 0.72 - lift * 0.1 },
      tip: { x: base.x + d.x * len, y: base.y + d.y * len - lift * 0.26 },
      baseWidth: Math.max(0.6, lidPx * 0.5 * 1.15),
      tipSharpness: 0.9,
      colorJitter: 0,
    });
  }
  return out;
}
