import type { BodyFrame } from '../frame';
import type { BodyParams } from '../types';
import type { Neck } from './neck';
import { both, rng, surf, vol, type Anchor } from './mk';
import type { VolumeParams } from './params';
import type { Trunk } from './trunk';
import type { Volume } from './types';
import { add3, p3, type P3 } from './vec3';

const A = (y: number, psi: number, a: number, b: number, lift?: number): Anchor => ({ y, psi, a, b, ...(lift !== undefined ? { lift } : {}) });
const fan = (n: number, w: number): number[] => Array.from({ length: n }, (_, i) => Math.PI / 2 + w * ((i / (n - 1)) * 2 - 1));

/** Face antérieure : pectoraux (faisceaux + striations), seins, abdominaux IRRÉGULIERS (4 × 2 blocs distincts), obliques, dentelé, intercostaux, crête iliaque, V inguinal, clavicule, cou. */
export function frontVolumes(tr: Trunk, nk: Neck, f: BodyFrame, bp: BodyParams, vp: VolumeParams): Volume[] {
  const H = f.h, y = f.y, tl = y.navel - y.base, out: Volume[] = [], r = rng(vp.seed * 977 + 13), jit = (k: number): number => 1 + k * (r() * 2 - 1);
  const mid = (a: number, b: number): number => (a + b) / 2;
  // Pectoraux : chef claviculaire (haut) + chef sterno-costal ; 7 faisceaux de fibres (striations) qui convergent vers le tendon huméral.
  out.push(...both(tr, { id: 'pectoralis.clav', name: 'grand pectoral — chef claviculaire', group: 'chest', layer: 4, tier: 2, fibres: fan(5, 0.8), origin: 'clavicle', insertion: 'humerus' },
    [A(y.base + 0.07 * H, 0.14, 0.04 * H, 0.02 * H), A(mid(y.base, y.acr) + 0.07 * H, 0.55, 0.05 * H, 0.03 * H), A(y.axilla - 0.1 * H, 1.1, 0.035 * H, 0.03 * H)]));
  out.push(...both(tr, { id: 'pectoralis.sternal', name: 'grand pectoral — chef sterno-costal', group: 'chest', layer: 4, tier: 1, fibres: fan(7, 0.95), origin: 'sternum', insertion: 'humerus' },
    [A(mid(y.axilla, y.nipple) + 0.05 * H, 0.1, 0.13 * H, 0.04 * H), A(mid(y.axilla, y.nipple) + 0.01 * H, 0.55, 0.12 * H, 0.052 * H), A(y.axilla - 0.01 * H, 1.12, 0.05 * H, 0.04 * H)]));
  // Seins (adulte seulement : garde-fou hérité du moteur 2D) : volume 3D posé sur le pectoral, projection indépendante.
  const bAmt = f.age >= 18 ? Math.max(0, Math.min(1, 0.5 - 0.55 * f.dim)) : 0;
  if (bAmt > 0.08) {
    const rad = 0.095 * H * (0.55 + 0.9 * bp.breast.volume) * (0.35 + 0.65 * bAmt), pr = rad * (0.5 + 0.8 * bp.breast.projection), yc = y.nipple + (0.02 + 0.07 * bp.breast.ptosis) * H;
    const psi = Math.asin(Math.min(0.9, (0.19 * H * (1 + 0.35 * bp.breast.spacing)) / tr.at(yc).X));
    out.push(...both(tr, { id: 'breast', name: 'sein', group: 'chest', kind: 'fat', layer: 5, tier: 0, parent: 'pectoralis.sternal' }, [A(yc - rad, psi, 0.62 * rad, 0.45 * pr, 0), A(yc - 0.1 * rad, psi, rad, pr, 0), A(yc + 1.05 * rad, psi, 0.72 * rad, 0.62 * pr, 0)]));
  }
  // Abdominaux : 4 rangées × 2 colonnes, chacune sa hauteur, sa largeur, son épaisseur, son décalage (G/D indépendants) — jamais 8 blocs identiques.
  const rows: [number, number][] = [[0.52, 0.645], [0.66, 0.775], [0.79, 0.93], [1.07, 1.19]];
  rows.forEach(([t0, t1], i) => (['L', 'R'] as const).forEach((sd) => {
    const s = sd === 'L' ? 1 : -1, y0 = y.base + tl * (t0 + 0.012 * (r() - 0.5)), y1 = y.base + tl * (t1 + 0.014 * (r() - 0.5)), ym = mid(y0, y1) + 0.004 * H * (r() - 0.5);
    const Xr = tr.at(ym).X, wob = jit(0.16), cx = Xr * (0.2 - (i === 3 ? 0.05 : 0) + 0.015 * (r() - 0.5)), aw = Xr * 0.135 * wob * (i === 3 ? 0.78 : 1) * (i === 0 ? 1.08 : 1), th = 0.03 * H * jit(0.22) * (i === 3 ? 0.8 : 1);
    const ps = s * Math.asin(Math.min(0.9, cx / Xr));
    out.push(surf(tr, { id: `rectus.${i + 1}.${sd}`, name: `droit de l’abdomen, rangée ${i + 1}`, group: 'abdomen', side: sd, layer: 4, tier: 3, origin: 'costal-cartilage', insertion: 'pubis', n: 5 }, [A(y0, ps, aw * 0.85, th * 0.55, 0), A(ym, ps, aw, th, 0), A(y1, ps, aw * 0.85, th * 0.55, 0)]));
  }));
  out.push(...both(tr, { id: 'oblique.ext', name: 'oblique externe', group: 'abdomen', layer: 3, tier: 2, fibres: fan(5, 0.6), origin: 'ribs', insertion: 'iliac-crest' },
    [A(y.nipple + 0.1 * H, 1.35, 0.06 * H, 0.022 * H), A(mid(y.nipple, y.waist) + 0.08 * H, 1.0, 0.09 * H, 0.026 * H), A(y.navel - 0.04 * H, 0.66, 0.07 * H, 0.02 * H)]));
  for (let i = 0; i < 4; i++) {
    const y0 = y.axilla + (0.0 + 0.068 * i) * H;
    out.push(...both(tr, { id: `serratus.${i + 1}`, name: `dentelé antérieur, digitation ${i + 1}`, group: 'chest', layer: 3, tier: 3, origin: 'ribs', insertion: 'scapula' }, [A(y0, 1.5, 0.016 * H, 0.012 * H), A(y0 + 0.034 * H, 1.32, 0.019 * H, 0.016 * H), A(y0 + 0.07 * H, 1.14, 0.013 * H, 0.011 * H)]));
  }
  // Intercostaux : sillons entre les côtes (tracés au trait, visibles chez les sujets secs).
  for (let i = 0; i < 6; i++) {
    const y0 = y.nipple - 0.17 * H + i * 0.047 * H + 0.004 * H * (r() - 0.5);
    out.push(...both(tr, { id: `intercostal.${i + 1}`, name: `sillon intercostal ${i + 1}`, group: 'chest', kind: 'landmark', level: 3, layer: 5, tier: 4, strand: true, tone: -0.5 },
      [A(y0, 0.32, 0.0035 * H, 0.003 * H, 0), A(y0 + 0.012 * H, 0.75, 0.0035 * H, 0.003 * H, 0), A(y0 + 0.036 * H, 1.1, 0.0035 * H, 0.003 * H, 0), A(y0 + 0.078 * H, 1.42, 0.0035 * H, 0.003 * H, 0)]));
  }
  out.push(surf(tr, { id: 'linea-alba', name: 'ligne blanche', group: 'abdomen', kind: 'landmark', level: 3, layer: 5, tier: 3, strand: true, tone: -0.55 }, [A(y.base + 0.5 * tl, 0, 0.0035 * H, 0.003 * H, 0), A(y.base + 0.8 * tl, 0, 0.0035 * H, 0.003 * H, 0), A(y.crop - 0.02 * H, 0, 0.0035 * H, 0.003 * H, 0)]));
  out.push(surf(tr, { id: 'navel', name: 'ombilic', group: 'abdomen', kind: 'landmark', level: 3, layer: 5, tone: -0.7 }, [A(y.navel - 0.012 * H, 0, 0.007 * H, 0.004 * H, -0.003 * H), A(y.navel, 0, 0.01 * H, 0.006 * H, -0.005 * H), A(y.navel + 0.014 * H, 0, 0.007 * H, 0.004 * H, -0.003 * H)]));
  // Crête iliaque (os, en relief) et pli inguinal en V (sillon sous l'épine iliaque antéro-supérieure).
  const yA = y.navel + 0.07 * tl;
  out.push(...both(tr, { id: 'iliac-crest', name: 'crête iliaque', group: 'pelvis', kind: 'bone', level: 3, layer: 5, tier: 3, tone: 0.2 },
    [A(y.waist + 0.01 * H, 1.55, 0.013 * H, 0.012 * H), A(mid(y.waist, y.navel) + 0.02 * H, 1.28, 0.014 * H, 0.014 * H), A(yA, 0.98, 0.015 * H, 0.014 * H)]));
  out.push(...both(tr, { id: 'inguinal-v', name: 'pli inguinal (V)', group: 'pelvis', kind: 'landmark', level: 3, layer: 5, tier: 3, strand: true, tone: -0.6 },
    [A(yA + 0.012 * H, 0.98, 0.004 * H, 0.003 * H, 0), A(y.navel + 0.19 * tl, 0.6, 0.004 * H, 0.003 * H, 0), A(y.crop + 0.015 * H, 0.17, 0.004 * H, 0.003 * H, 0)]));
  // Clavicules (os saillants, en S) et cou : sterno-cléido-mastoïdiens + pomme d'Adam.
  for (const s of [1, -1] as const) {
    const sh = tr.shoulder(s), acr: P3 = add3(sh, p3(s * (f.x.acr - f.joint.x) * 0.55, y.acr - f.joint.y, 0.02 * H));
    const n0 = tr.point(y.base + 0.035 * H, s * 0.08, 0.016 * H), m0 = tr.point(y.base + 0.05 * H, s * 0.6, 0.026 * H);
    out.push(vol({ id: `clavicle.${s > 0 ? 'L' : 'R'}`, name: 'clavicule', group: 'shoulder', kind: 'bone', side: s > 0 ? 'L' : 'R', layer: 5, level: 2, tier: 1, tone: 0.28, origin: 'sternum', insertion: 'acromion' },
      [{ c: n0.p, a: 0.016 * H, b: 0.015 * H, hint: n0.n }, { c: m0.p, a: 0.0125 * H, b: 0.0135 * H, hint: m0.n }, { c: acr, a: 0.016 * H, b: 0.014 * H, hint: p3(0, -0.4, 1) }]));
  }
  out.push(...[1, -1].map((s) => {
    const t = nk.top, a0 = nk.point(t + 0.05 * H, s * 2.15, 0.014 * H), a1 = nk.point(mid(t, f.a.baseY), s * 1.15, 0.016 * H), a2 = tr.point(y.base + 0.03 * H, s * 0.32, 0.012 * H);
    const w = 0.02 * H * (1 + 0.35 * f.vis);
    return vol({ id: `sternocleidomastoid.${s > 0 ? 'L' : 'R'}`, name: 'sterno-cléido-mastoïdien', group: 'neck', side: s > 0 ? 'L' : 'R', layer: 4, tier: 2, fibres: [Math.PI / 2], origin: 'sternum', insertion: 'mastoid' },
      [{ c: a0.p, a: w * 0.7, b: w * 0.55, hint: a0.n }, { c: a1.p, a: w, b: w * 0.8, hint: a1.n }, { c: a2.p, a: w * 0.75, b: w * 0.6, hint: a2.n }]);
  }));
  if (f.dim > 0.2 && f.age >= 14) {
    const yy = mid(nk.top, f.a.baseY) + 0.1 * H, q = nk.point(yy, 0, 0.012 * H), k = 0.5 + 0.5 * f.dim;
    out.push(vol({ id: 'thyroid-cartilage', name: 'pomme d’Adam', group: 'neck', kind: 'landmark', level: 3, layer: 5, tier: 0, tone: 0.18 }, [-1, 0, 1].map((i) => ({ c: add3(q.p, p3(0, i * 0.017 * H * k, 0)), a: 0.011 * H * k * (i === 0 ? 1 : 0.55), b: 0.014 * H * k * (i === 0 ? 1 : 0.5), hint: q.n }))));
  }
  return out;
}
