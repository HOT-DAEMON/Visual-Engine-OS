import type { HandFrame } from './arm';
import { mk } from './atom';
import type { BodyFrame } from './frame';
import { add, limbPoly, mul, rotV, v, type Station } from './shape';
import type { Atom, BodyParams, Level, V } from './types';

const NAMES = ['thumb', 'index', 'middle', 'ring', 'little'] as const;
/** Proportions d'atelier (fractions de la longueur de la main poignet → bout du majeur) ; CONVENTIONS, vérifiées par bandes dans `verify/body.ts`. */
const FINGER_LEN = [0, 0.4, 0.45, 0.42, 0.33];
const SPLIT = [0.46, 0.3, 0.24];
const THUMB = [0.2, 0.17, 0.15];
const BASE_X = [-0.72, -0.24, 0.24, 0.72];
const BASE_Y = [0.97, 1.0, 0.96, 0.88];
const FAN = [-8, -1, 5, 12];
const WIDTH = [0.25, 0.25, 0.23, 0.2];

/**
 * Main complète, vue de face selon la rotation de l'avant-bras : paume, éminences, 5 doigts (3 segments chacun), articulations, ongles ou pulpes,
 * plis, tendons, interosseux, métacarpiens, carpe. Repère local : y le long des doigts, x en travers (négatif = côté du pouce) ; la projection
 * écrase x par `hw` (rotation de l'avant-bras) et y par la flexion. Les doigts fléchis se raccourcissent par cos(flexion cumulée).
 */
export function handAtoms(f: BodyFrame, p: BodyParams, hf: HandFrame): Atom[] {
  const { side, tau, hw, palmar, fc, pose } = hf;
  const { arm, h } = f;
  const out: Atom[] = [];
  const T = (x: number, y: number): V => add(add(hf.o, mul(hf.d, y * fc)), mul(hf.n, tau * -x * hw));
  const W = (pts: ReadonlyArray<readonly [number, number]>): V[] => pts.map(([x, y]) => T(x, y));
  const S = side, ph = palmar ? 'palmar' : 'dorsal';
  const id = (n: string): string => `${n}.${S}`;
  const L = arm.hand, pl = 0.55 * L, ph2 = arm.palmHalf, wr = arm.wristHalf;
  const add_ = (n: string, kind: Atom['kind'], parent: string, level: Level, poly: readonly V[], o: { open?: boolean; tone?: number; z?: number; only?: 'palmar' | 'dorsal' | 'never' } = {}): void => {
    const hidden = o.only === 'never' || (o.only !== undefined && o.only !== ph);
    out.push(mk(id(n), kind, `hand.${S}`, parent === 'forearm' ? `arm.fore.${S}` : id(parent), level, poly, { side: S, ...(o.open ? { open: true } : {}), ...(hidden ? { view: 'occluded' as const } : {}), z: o.z ?? 20 + level * 10, ...(o.tone !== undefined ? { tone: o.tone } : {}) }));
  };
  const dot = (c: V, rx: number, ry: number, n = 6): V[] => Array.from({ length: n }, (_, i) => v(c.x + rx * Math.cos((2 * Math.PI * i) / n), c.y + ry * Math.sin((2 * Math.PI * i) / n)));
  // Paume (enveloppe) : du poignet à la ligne des articulations métacarpo-phalangiennes.
  const palm: ReadonlyArray<readonly [number, number]> = [[-wr, 0], [-ph2 * 1.02, pl * 0.35], [-ph2, pl * 0.9], [-ph2 * 0.5, pl * 1.0], [0, pl * 1.01], [ph2 * 0.5, pl * 0.99], [ph2 * 0.98, pl * 0.93], [ph2 * 0.96, pl * 0.4], [wr, 0]];
  out.push(mk(id('hand.palm'), 'skin', `hand.${S}`, `arm.fore.${S}`, 0, W(palm), { side: S, z: 5 }));
  // Éminences : thénar (pouce) et hypothénar (auriculaire), chacune avec ses 3 muscles.
  const thenar = (): V[] => W([[-wr * 0.9, pl * 0.02], [-ph2 * 1.0, pl * 0.3], [-ph2 * 0.72, pl * 0.5], [-ph2 * 0.2, pl * 0.34], [-wr * 0.3, pl * 0.05]]);
  add_('hand.thenar', 'muscle', 'hand.palm', 1, thenar(), { tone: 0.1, only: 'palmar' });
  const th3: Array<[string, ReadonlyArray<readonly [number, number]>, number]> = [['abductor-pollicis-brevis', [[-ph2 * 0.98, pl * 0.28], [-ph2 * 0.7, pl * 0.46], [-ph2 * 0.55, pl * 0.3], [-ph2 * 0.8, pl * 0.12]], 0.15], ['flexor-pollicis-brevis', [[-ph2 * 0.7, pl * 0.1], [-ph2 * 0.4, pl * 0.3], [-ph2 * 0.2, pl * 0.3], [-wr * 0.5, pl * 0.06]], 0.05], ['opponens-pollicis', [[-ph2 * 0.9, pl * 0.1], [-ph2 * 0.75, pl * 0.3], [-ph2 * 0.5, pl * 0.2], [-wr * 0.8, pl * 0.04]], -0.05]];
  for (const [n, pts, tone] of th3) add_(`hand.${n}`, 'muscle', 'hand.thenar', 2, W(pts), { tone, only: 'palmar' });
  add_('hand.hypothenar', 'muscle', 'hand.palm', 1, W([[wr * 0.95, pl * 0.03], [ph2 * 0.96, pl * 0.4], [ph2 * 0.86, pl * 0.66], [ph2 * 0.4, pl * 0.5], [wr * 0.3, pl * 0.08]]), { tone: -0.05, only: 'palmar' });
  const hy3: Array<[string, ReadonlyArray<readonly [number, number]>, number]> = [['abductor-digiti-minimi', [[ph2 * 0.92, pl * 0.12], [ph2 * 0.98, pl * 0.5], [ph2 * 0.78, pl * 0.6], [ph2 * 0.62, pl * 0.2]], 0.1], ['flexor-digiti-minimi-brevis', [[ph2 * 0.5, pl * 0.3], [ph2 * 0.7, pl * 0.55], [ph2 * 0.5, pl * 0.5], [ph2 * 0.3, pl * 0.2]], 0.0], ['opponens-digiti-minimi', [[ph2 * 0.3, pl * 0.1], [ph2 * 0.55, pl * 0.4], [ph2 * 0.4, pl * 0.45], [wr * 0.4, pl * 0.1]], -0.1]];
  for (const [n, pts, tone] of hy3) add_(`hand.${n}`, 'muscle', 'hand.hypothenar', 2, W(pts), { tone, only: 'palmar' });
  // Squelette de la main (caché) + tendons / interosseux dorsaux (visibles de dos).
  add_('hand.carpal', 'bone', 'hand.palm', 2, W([[-wr, 0], [wr, 0], [ph2 * 0.8, pl * 0.24], [-ph2 * 0.8, pl * 0.24]]), { only: 'never' });
  for (let k = 0; k < 5; k++) { const x1 = k === 0 ? -ph2 * 0.85 : (BASE_X[k - 1] as number) * ph2, y1 = k === 0 ? pl * 0.5 : (BASE_Y[k - 1] as number) * pl; add_(`hand.metacarpal.${k + 1}`, 'bone', 'hand.palm', 2, W([[k === 0 ? -wr * 0.6 : (BASE_X[k - 1] as number) * wr * 0.7, pl * 0.15], [x1, y1]]), { open: true, only: 'never' }); }
  for (let k = 0; k < 4; k++) {
    const x0 = (BASE_X[k] as number) * wr * 0.7, x1 = (BASE_X[k] as number) * ph2, y1 = (BASE_Y[k] as number) * pl;
    add_(`hand.tendon.${k + 1}`, 'line', 'hand.palm', 3, W([[x0, pl * 0.05], [(x0 + x1) / 2, pl * 0.5], [x1, y1 * 0.97]]), { open: true, only: 'dorsal' });
    const xm = (x1 + (k < 3 ? (BASE_X[k + 1] as number) * ph2 : x1 + ph2 * 0.3)) / 2;
    add_(`hand.interosseous.dorsal.${k + 1}`, 'muscle', 'hand.palm', 2, W([[x1 * 0.95, pl * 0.35], [xm, pl * 0.45], [xm, y1 * 0.95], [x1 * 0.98, y1 * 0.9]]), { tone: -0.05, only: 'dorsal' });
  }
  const crease: ReadonlyArray<[string, ReadonlyArray<readonly [number, number]>]> = [['hand.crease.wrist', [[-wr, pl * 0.02], [0, pl * 0.035], [wr, pl * 0.02]]], ['hand.crease.thenar', [[-ph2 * 0.62, pl * 0.78], [-ph2 * 0.35, pl * 0.45], [-wr * 0.3, pl * 0.12]]], ['hand.crease.head', [[-ph2 * 0.9, pl * 0.74], [0, pl * 0.64], [ph2 * 0.9, pl * 0.56]]], ['hand.crease.heart', [[-ph2 * 0.5, pl * 0.86], [0, pl * 0.78], [ph2 * 0.95, pl * 0.74]]]];
  for (const [n, pts] of crease) add_(n, 'line', 'hand.palm', 3, W(pts), { open: true, only: 'palmar' });
  // Doigts : 4 doigts × 3 phalanges, + pouce (métacarpien libre, proximale, distale).
  const joints = ['mcp', 'pip', 'dip'];
  for (let i = 0; i < 5; i++) {
    const nm = NAMES[i] as string, c = pose.curl[i] as number;
    const k = 1 + 0.15 * (p.fingers[i] as number) * (i === 0 ? 1 : 1);
    const lens = i === 0 ? THUMB.map((q) => q * L * k * (1 + 0.12 * p.limbs.thumb)) : SPLIT.map((q) => q * (FINGER_LEN[i] as number) * L * k);
    let a: V, ang: number, fh: number;
    if (i === 0) { a = v(-ph2 * 0.8, pl * 0.22); ang = -(38 + 22 * pose.spread); fh = ph2 * 0.29; }
    else { a = v((BASE_X[i - 1] as number) * ph2, (BASE_Y[i - 1] as number) * pl); ang = (FAN[i - 1] as number) * pose.spread * 2; fh = ph2 * (WIDTH[i - 1] as number); }
    const flex = i === 0 ? [25, 45, 35].map((q) => q * c) : [70, 100, 55].map((q) => q * c);
    let cum = 0, parent = 'hand.palm', dir = 0;
    const segNames = i === 0 ? ['meta', 'prox', 'dist'] : ['prox', 'mid', 'dist'];
    for (let s = 0; s < 3; s++) {
      cum += flex[s] as number;
      dir = i === 0 ? ang + cum : ang;
      const ca = i === 0 ? 1 : Math.cos((cum * Math.PI) / 180);
      const e = Math.sign(ca || 1) * Math.max(0.22, Math.abs(ca));
      const u = rotV(v(0, 1), -dir), vec = mul(u, (lens[s] as number) * e);
      const b = add(a, vec), nL = v(-u.y, u.x);
      const tip = s === 2, taper = 1 - 0.18 * s;
      const stn: Station[] = [{ t: 0, lat: fh * taper * 1.0, med: fh * taper * 1.0 }, { t: 0.5, lat: fh * taper * 0.9, med: fh * taper * 0.9 }, { t: 1, lat: fh * taper * (tip ? 0.8 : 1.02), med: fh * taper * (tip ? 0.8 : 1.02) }];
      const poly = limbPoly(T(a.x, a.y), T(b.x, b.y), mul(hf.n, 1), stn.map((q) => ({ ...q, lat: q.lat * hw, med: q.med * hw })), 0.2, tip ? 0.6 : 0.25);
      void nL;
      const sid = `finger.${nm}.${segNames[s]}`;
      // Vue de dos, un segment fléchi au-delà de 95° passe derrière les articulations : il existe mais n'est pas visible.
      const behind = !palmar && cum > 95;
      add_(sid, 'skin', s === 0 ? 'hand.palm' : `finger.${nm}.${segNames[s - 1]}`, 0, poly, { z: 6 + s, ...(behind ? { only: 'never' as const } : {}) });
      const jc = T(a.x, a.y);
      add_(`finger.${nm}.joint.${i === 0 ? ['cmc', 'mcp', 'ip'][s] : joints[s]}`, 'landmark', sid, 3, dot(jc, 0.016 * h * hw + 0.004 * h, 0.012 * h), { tone: -0.2 });
      if (tip) {
        const nc = T(b.x - u.x * (lens[2] as number) * 0.35 * Math.abs(e), b.y - u.y * (lens[2] as number) * 0.35 * Math.abs(e));
        add_(`finger.${nm}.nail`, 'nail', sid, 3, dot(nc, fh * 0.55 * hw + 0.002 * h, (lens[2] as number) * 0.3 * fc), { tone: 0.25, only: behind ? 'never' : 'dorsal' });
        add_(`finger.${nm}.pad`, 'fat', sid, 3, dot(nc, fh * 0.6 * hw + 0.002 * h, (lens[2] as number) * 0.28 * fc), { tone: 0.12, only: 'palmar' });
      }
      a = b; parent = sid;
    }
    void parent; void dir;
  }
  for (let k = 0; k < 3; k++) add_(`hand.web.${k + 1}`, 'landmark', 'hand.palm', 3, dot(T(((BASE_X[k] as number) + (BASE_X[k + 1] as number)) * 0.5 * ph2, ((BASE_Y[k] as number) + (BASE_Y[k + 1] as number)) * 0.5 * pl * 1.01), 0.016 * h * hw + 0.004 * h, 0.01 * h));
  add_('hand.web.thumb', 'landmark', 'hand.palm', 3, dot(T(-ph2 * 0.8, pl * 0.7), 0.02 * h * hw + 0.004 * h, 0.014 * h));
  return out;
}
