import { LEG_ATTACH, LEG_MUSCLES } from '../lower/leg-spec';
import type { LegFrame } from '../lower/frame';
import { tierRule } from '../muscle-tiers';
import { sinProf } from './limb';
import { vol } from './mk';
import type { Ctl } from './loft';
import { legProf, legRows } from './legs-profile';
import type { LegSkel } from './legs-skeleton';
import type { Volume } from './types';
import { add3, mul3, type P3 } from './vec3';

const MASSES = new Set(['quadriceps', 'adductors', 'hamstrings', 'gastrocnemius']);
/**
 * MUSCLES 3D DE LA CUISSE ET DE LA JAMBE : un volume par entrée de `LEG_MUSCLES` (même table que le 2D : identifiants, parents, niveaux, tons, étendue le long de l'axe,
 * décalage latéral, largeur). La 3D ajoute la PROFONDEUR (`dz`, `bz`). Chaque section se pose sur la PEAU RÉELLE (`legs-profile.ts`, source commune avec l'enveloppe) : toutes
 * les longueurs sont mises à l'échelle du rapport peau locale / peau de référence, puis BORNÉES à une coque de 6 % + 8 % × définition visible autour de la peau — un muscle
 * modèle la surface, il ne s'en échappe pas (c'est ce qui distingue un relief d'un tuyau). Taille modulée par la définition visible, palier d'apparition par `muscle-tiers.ts`.
 */
export function legMuscles(sk: LegSkel, lf: LegFrame, vis: number): Volume[] {
  const m = 0.55 + 0.6 * vis, sd = sk.sd, rows = legRows(lf), th = lf.len.thigh, sh = lf.len.shin, shell = 1.06 + 0.08 * vis, N = 7;
  return LEG_MUSCLES.map((q) => {
    const u = q.seg === 'u', p0 = u ? sk.C0 : sk.K, dir = u ? sk.d0 : sk.d1, len = u ? th : sh, ant = u ? sk.ant0 : sk.ant1, lat = u ? sk.lat0 : sk.lat1, ref = u ? lf.w.mid : lf.w.calf, s0 = u ? 0 : th;
    const ctl: Ctl[] = Array.from({ length: N }, (_, i) => {
      const x = i / (N - 1), t = q.from && q.to ? q.from[0] + (q.to[0] - q.from[0]) * x : q.t0 + (q.t1 - q.t0) * x, off0 = q.from && q.to ? q.from[1] + (q.to[1] - q.from[1]) * x : q.off;
      const pr = legProf(rows, s0 + t * len), r = pr.a / ref, bSk = pr.a * pr.k, prof = q.from ? Math.max(0.35, Math.sin(Math.PI * x) ** 0.6) : sinProf(x, q.belly, 0.3);
      let a = q.w * ref * r * (0.85 + 0.25 * vis) * m, b = ref * r * q.bz * (0.25 + 0.65 * q.w) * m, off = off0 * ref * r, dz = q.dz * ref * r;
      // Coque : étendue latérale et antéro-postérieure bornées autour de la peau ; si la borne écrase le muscle, on le rapproche du centre plutôt que de l'aplatir.
      const latHi = pr.a * shell, apHi = bSk * shell, a0 = a, b0 = b;
      a = Math.min(a, latHi - Math.abs(off)); if (a < 0.25 * a0) { a = 0.25 * a0; off = Math.sign(off) * (latHi - a); }
      const sgn = dz >= 0 ? 1 : -1; b = Math.min(b, apHi - sgn * dz); if (b < 0.25 * b0) { b = 0.25 * b0; dz = sgn * (apHi - b); }
      const c: P3 = add3(add3(add3(p0, mul3(dir, t * len)), mul3(lat, off)), mul3(ant, dz - pr.back * pr.a * pr.k));
      return { c, a: Math.max(1e-3, a * prof), b: Math.max(1e-3, b * prof), hint: ant };
    });
    const tr = tierRule(q.id), at = LEG_ATTACH[q.id], mass = MASSES.has(q.id) ? q.id : MASSES.has(q.parent) ? q.parent : undefined;
    return vol({
      id: `${q.id}.${sd}`, name: `${q.id} (${sd === 'L' ? 'gauche' : 'droit'})`, group: 'leg', side: sd, parent: q.parent.startsWith('leg.') ? `leg.env.${sd}` : `${q.parent}.${sd}`,
      level: q.level, layer: 2 + q.level, ...(tr ? { tier: tr.min } : {}), tone: q.tone, n: 7, ...(q.w > 0.25 ? { fibres: [1.35, 1.57, 1.8] } : {}), ...(mass ? { mass: `${mass}.${sd}` } : {}), ...(at ? { origin: at[0], insertion: at[1] } : {}),
    }, ctl);
  });
}
