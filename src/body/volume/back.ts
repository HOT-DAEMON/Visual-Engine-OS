import type { BodyFrame } from '../frame';
import type { Neck } from './neck';
import { both, vol, type Anchor } from './mk';
import type { Trunk } from './trunk';
import type { Volume } from './types';
import { add3, p3, type P3 } from './vec3';

const PI = Math.PI;
const A = (y: number, psi: number, a: number, b: number, lift?: number): Anchor => ({ y, psi, a, b, ...(lift !== undefined ? { lift } : {}) });
const fan = (n: number, w: number): number[] => Array.from({ length: n }, (_, i) => PI / 2 + w * ((i / (n - 1)) * 2 - 1));

/** Face postérieure : trapèze complet (supérieur, moyen, inférieur), rhomboïdes, infra-épineux, grand rond, grand dorsal, érecteurs du rachis, fessiers, omoplate, sillon vertébral. */
export function backVolumes(tr: Trunk, nk: Neck, f: BodyFrame): Volume[] {
  const H = f.h, y = f.y, tl = y.navel - y.base, out: Volume[] = [];
  const L = (s: Omit<Parameters<typeof vol>[0], 'side'>, an: readonly Anchor[]): void => { out.push(...both(tr, s as never, an)); };
  // Trapèze supérieur : de l'occiput au tiers externe de la clavicule/acromion ; le cou S'ÉVASE dans ce volume (sa courbe part du cou, finit sur l'épaule).
  for (const s of [1, -1] as const) {
    const t0 = nk.point(nk.top + 0.02 * H, s * (PI - 0.3), 0.01 * H), t1 = nk.point(nk.top + 0.55 * (f.a.baseY - nk.top), s * (PI - 0.72), 0.014 * H);
    const t15 = tr.point(y.base - 0.012 * H, s * (PI / 2 + 0.95), 0.014 * H), t2 = tr.point(y.base + 0.4 * (y.acr - y.base), s * (PI / 2 + 0.5), 0.016 * H), sh = tr.shoulder(s), t3: P3 = add3(sh, p3(s * -0.015 * H, y.acr - f.joint.y + 0.012 * H, -0.01 * H));
    out.push(vol({ id: `trapezius.upper.${s > 0 ? 'L' : 'R'}`, name: 'trapèze supérieur', group: 'back', side: s > 0 ? 'L' : 'R', layer: 5, tier: 1, fibres: fan(5, 0.9), origin: 'occiput', insertion: 'clavicle', n: 10 },
      [{ c: t0.p, a: 0.03 * H, b: 0.016 * H, hint: t0.n }, { c: t1.p, a: 0.052 * H, b: 0.022 * H, hint: t1.n }, { c: t15.p, a: 0.058 * H, b: 0.022 * H, hint: t15.n }, { c: t2.p, a: 0.06 * H, b: 0.024 * H, hint: t2.n }, { c: t3, a: 0.034 * H, b: 0.02 * H, hint: p3(0, -0.5, -0.8) }]));
  }
  L({ id: 'trapezius.middle', name: 'trapèze moyen', group: 'back', layer: 5, tier: 2, fibres: fan(5, 0.6), origin: 'C7-T3', insertion: 'scapular-spine' }, [A(y.base + 0.05 * H, PI - 0.05, 0.05 * H, 0.016 * H), A(y.acr + 0.03 * H, PI - 0.7, 0.04 * H, 0.016 * H), A(y.acr + 0.03 * H, PI - 1.25, 0.022 * H, 0.014 * H)]);
  L({ id: 'trapezius.lower', name: 'trapèze inférieur', group: 'back', layer: 5, tier: 2, fibres: fan(5, 0.5), origin: 'T4-T12', insertion: 'scapular-spine' }, [A(y.base + 0.66 * tl, PI - 0.05, 0.03 * H, 0.012 * H), A(y.base + 0.42 * tl, PI - 0.38, 0.05 * H, 0.016 * H), A(y.acr + 0.08 * H, PI - 0.95, 0.03 * H, 0.014 * H)]);
  L({ id: 'rhomboid', name: 'rhomboïde', group: 'back', layer: 4, tier: 3, fibres: fan(4, 0.5), origin: 'C7-T5', insertion: 'scapula-medial' }, [A(y.base + 0.06 * H, PI - 0.09, 0.02 * H, 0.016 * H), A(y.acr + 0.07 * H, PI - 0.44, 0.036 * H, 0.018 * H), A(y.axilla - 0.02 * H, PI - 0.6, 0.022 * H, 0.015 * H)]);
  L({ id: 'infraspinatus', name: 'infra-épineux', group: 'back', layer: 4, tier: 3, fibres: fan(4, 0.55), origin: 'scapula', insertion: 'humerus' }, [A(y.acr + 0.05 * H, PI - 1.12, 0.05 * H, 0.02 * H), A(y.acr + 0.14 * H, PI - 0.95, 0.06 * H, 0.024 * H), A(y.axilla + 0.04 * H, PI - 0.72, 0.034 * H, 0.02 * H)]);
  L({ id: 'teres-major', name: 'grand rond', group: 'back', layer: 4, tier: 3, origin: 'scapula-inferior', insertion: 'humerus' }, [A(y.axilla + 0.01 * H, PI - 1.0, 0.026 * H, 0.02 * H), A(y.axilla + 0.035 * H, PI - 1.3, 0.03 * H, 0.024 * H), A(y.axilla + 0.015 * H, PI / 2 + 0.3, 0.02 * H, 0.016 * H)]);
  L({ id: 'latissimus', name: 'grand dorsal', group: 'back', layer: 3, tier: 2, fibres: fan(6, 0.9), origin: 'T7-sacrum', insertion: 'humerus' }, [A(y.navel - 0.04 * H, PI - 0.22, 0.08 * H, 0.015 * H), A(y.nipple + 0.4 * (y.waist - y.nipple), PI - 0.95, 0.11 * H, 0.022 * H), A(y.axilla + 0.025 * H, PI / 2 + 0.48, 0.05 * H, 0.026 * H)]);
  for (const [k, psi, a, b] of [['medial', 0.16, 0.034, 0.03], ['lateral', 0.42, 0.028, 0.024]] as const)
    L({ id: `erector.${k}`, name: k === 'medial' ? 'érecteur du rachis (longissimus)' : 'érecteur du rachis (ilio-costal)', group: 'back', layer: 3, tier: 2, fibres: [PI / 2 - 0.35, PI / 2, PI / 2 + 0.35], origin: 'sacrum', insertion: 'ribs' },
      [A(y.crop - 0.02 * H, PI - psi, a * H, b * H), A(y.waist, PI - psi, 1.3 * a * H, 1.15 * b * H), A(y.nipple, PI - psi, a * H, 0.9 * b * H), A(y.acr + 0.07 * H, PI - psi * 0.9, 0.7 * a * H, 0.6 * b * H)]);
  L({ id: 'gluteus.max', name: 'grand fessier', group: 'pelvis', layer: 4, tier: 2, fibres: fan(5, 0.8), origin: 'sacrum', insertion: 'femur' }, [A(y.navel + 0.04 * tl, PI - 0.2, 0.07 * H, 0.03 * H), A(y.navel + 0.18 * tl, PI - 0.55, 0.12 * H, 0.075 * H), A(y.crop + 0.1 * H, PI - 0.85, 0.09 * H, 0.05 * H)]);
  L({ id: 'gluteus.medius', name: 'moyen fessier', group: 'pelvis', layer: 3, tier: 3, fibres: fan(4, 0.6), origin: 'iliac-wing', insertion: 'femur' }, [A(y.waist + 0.12 * tl, PI - 0.55, 0.05 * H, 0.02 * H), A(y.navel + 0.1 * tl, PI - 1.05, 0.075 * H, 0.034 * H), A(y.crop + 0.02 * H, PI - 1.28, 0.05 * H, 0.03 * H)]);
  L({ id: 'scapula', name: 'omoplate', group: 'shoulder', kind: 'bone', level: 3, layer: 2, tier: 4, tone: 0.1 }, [A(y.acr + 0.04 * H, PI - 1.08, 0.055 * H, 0.006 * H, 0), A(y.acr + 0.14 * H, PI - 0.9, 0.066 * H, 0.008 * H, 0), A(y.axilla + 0.12 * H, PI - 0.68, 0.03 * H, 0.006 * H, 0)]);
  L({ id: 'scapular-spine', name: 'épine de l’omoplate', group: 'shoulder', kind: 'bone', level: 3, layer: 5, tier: 3, tone: 0.2 }, [A(y.acr + 0.035 * H, PI - 0.42, 0.011 * H, 0.011 * H, 0.004 * H), A(y.acr + 0.045 * H, PI - 0.85, 0.011 * H, 0.012 * H, 0.004 * H), A(y.acr + 0.02 * H, PI - 1.35, 0.012 * H, 0.012 * H, 0.004 * H)]);
  out.push(vol({ id: 'vertebral-groove', name: 'sillon vertébral', group: 'back', kind: 'landmark', level: 3, layer: 5, tier: 3, strand: true, tone: -0.5 }, [y.base + 0.03 * H, y.base + 0.3 * tl, y.base + 0.65 * tl, y.crop].map((yy) => { const q = tr.point(yy, PI, 0); return { c: q.p, a: 0.004 * H, b: 0.003 * H, hint: q.n }; })));
  return out;
}
