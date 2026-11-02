import type { BodyFrame } from '../frame';
import { legFrame } from '../lower/frame';
import { LegParams } from '../lower/types';
import type { Ctl } from './loft';
import { vol } from './mk';
import type { Trunk } from './trunk';
import type { Volume } from './types';
import { p3 } from './vec3';

/**
 * JAMBES 3D (itération 05) : une enveloppe de peau CONTINUE par jambe, de l'intérieur du bassin à la cheville (cuisse, genou, jambe en un seul loft :
 * pas de couture au genou). Elle est de type `skin` : elle partage le tampon de profondeur du tronc, donc la hanche se raccorde au bassin sans
 * marche (le tronc a été prolongé jusqu'à la fourche, voir `trunk.ts`). Toutes les cotes viennent de `lower/frame.ts` (même `LegFrame` que le module
 * 2D du bas du corps : une seule source) ; l'axe suit la pose du tronc par `tr.xf` (contrapposto, torsion, décalage du bassin) et s'écarte de la
 * ligne médiane de `LegPose.abduction` (4° par défaut, comme le module 2D). Les muscles de la cuisse restent dans le module 2D : voir `docs/BODY-LOWER-3D-REMAINING.md`.
 */
export function legVolumes(tr: Trunk, f: BodyFrame): Volume[] {
  const lf = legFrame(f, LegParams.parse({})), { y, w } = lf, h = f.h, out: Volume[] = [];
  const abd = Math.tan((LegParams.parse({}).pose.left.abduction * Math.PI) / 180), zc = tr.at(y.crotch).c.z;
  const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
  const th = y.knee - y.crotch, sh = y.ankle - y.knee;
  // [y, demi-largeur a, rapport profondeur/largeur, recul du centre en fraction de b] : le mollet gonfle vers l'ARRIÈRE, la cuisse vers l'avant.
  const rows: readonly (readonly [number, number, number, number])[] = [
    [y.crotch - 0.14 * h, 0.9 * w.top, 1.3, 0],
    [y.crotch, 1.0 * w.top, 1.22, -0.02],
    [y.crotch + 0.18 * th, lerp(w.top, w.mid, 0.4), 1.12, -0.03],
    [y.crotch + 0.5 * th, w.mid, 1.02, -0.03],
    [y.crotch + 0.85 * th, lerp(w.mid, w.knee, 0.7), 0.98, 0],
    [y.knee, w.knee * 1.02, 0.96, 0],
    [y.knee + 0.25 * sh, w.calf * 0.95, 1.12, 0.14],
    [y.knee + 0.62 * sh, lerp(w.calf, w.ankle, 0.6), 1.0, 0.06],
    [y.ankle, w.ankle * 1.05, 1.0, 0],
    [y.ankle + 0.02 * h, w.ankle * 0.55, 0.9, 0],
    [y.ankle + 0.035 * h, w.ankle * 0.15, 0.8, 0],
  ];
  for (const s of [1, -1] as const) {
    const ctl: Ctl[] = rows.map(([yy, a, k, back]) => ({ c: tr.xf(p3(s * (lf.axisX + abd * Math.max(0, yy - y.crotch)), yy, zc - back * a * k)), a, b: a * k, hint: p3(0, 0, 1) }));
    out.push(vol({ id: `leg.env.${s > 0 ? 'L' : 'R'}`, name: 'jambe (enveloppe continue : cuisse, genou, jambe)', group: 'leg', kind: 'skin', side: s > 0 ? 'L' : 'R', level: 0, layer: 1, tier: 0, n: 48 }, ctl));
  }
  return out;
}
