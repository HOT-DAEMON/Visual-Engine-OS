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
    out.push(vol({ id: `trapezius.upper.${s > 0 ? 'L' : 'R'}`, name: 'trapèze supérieur', group: 'back', side: s > 0 ? 'L' : 'R', layer: 5, tier: 1, fibres: fan(5, 0.9), origin: 'occiput', insertion: 'clavicle', n: 10, mass: 'trapezius' },
      [{ c: t0.p, a: 0.03 * H, b: 0.016 * H, hint: t0.n }, { c: t1.p, a: 0.052 * H, b: 0.022 * H, hint: t1.n }, { c: t15.p, a: 0.058 * H, b: 0.022 * H, hint: t15.n }, { c: t2.p, a: 0.062 * H, b: 0.027 * H, hint: t2.n }, { c: t3, a: 0.046 * H, b: 0.027 * H, hint: p3(0, -0.5, -0.8) }]));
  }
  L({ id: 'trapezius.middle', name: 'trapèze moyen', group: 'back', layer: 5, tier: 2, mass: 'trapezius', fibres: fan(5, 0.6), origin: 'C7-T3', insertion: 'scapular-spine' }, [A(y.base + 0.05 * H, PI - 0.05, 0.05 * H, 0.016 * H), A(y.acr + 0.03 * H, PI - 0.7, 0.04 * H, 0.016 * H), A(y.acr + 0.03 * H, PI - 1.25, 0.022 * H, 0.014 * H)]);
  L({ id: 'trapezius.lower', name: 'trapèze inférieur', group: 'back', layer: 5, tier: 2, mass: 'trapezius', fibres: fan(5, 0.5), origin: 'T4-T12', insertion: 'scapular-spine' }, [A(y.base + 0.66 * tl, PI - 0.05, 0.03 * H, 0.012 * H), A(y.base + 0.42 * tl, PI - 0.38, 0.05 * H, 0.016 * H), A(y.acr + 0.08 * H, PI - 0.95, 0.03 * H, 0.014 * H)]);
  L({ id: 'latissimus', name: 'grand dorsal', group: 'back', layer: 3, tier: 2, fibres: fan(6, 0.9), origin: 'T7-sacrum', insertion: 'humerus' }, [A(y.navel - 0.04 * H, PI - 0.22, 0.08 * H, 0.015 * H), A(y.nipple + 0.4 * (y.waist - y.nipple), PI - 0.95, 0.11 * H, 0.022 * H), A(y.axilla + 0.025 * H, PI / 2 + 0.48, 0.05 * H, 0.026 * H)]);
  for (const [k, psi, a, b] of [['medial', 0.16, 0.034, 0.03], ['lateral', 0.42, 0.028, 0.024]] as const)
    L({ id: `erector.${k}`, name: k === 'medial' ? 'érecteur du rachis (longissimus)' : 'érecteur du rachis (ilio-costal)', group: 'back', layer: 3, tier: 2, fibres: [PI / 2 - 0.35, PI / 2, PI / 2 + 0.35], origin: 'sacrum', insertion: 'ribs' },
      [A(y.crop - 0.02 * H, PI - psi, a * H, b * H), A(y.waist, PI - psi, 1.3 * a * H, 1.15 * b * H), A(y.nipple, PI - psi, a * H, 0.9 * b * H), A(y.acr + 0.07 * H, PI - psi * 0.9, 0.7 * a * H, 0.6 * b * H)]);
  L({ id: 'gluteus.max', name: 'grand fessier', group: 'pelvis', layer: 4, tier: 2, fibres: fan(5, 0.8), origin: 'sacrum', insertion: 'femur' }, [A(y.navel + 0.04 * tl, PI - 0.2, 0.07 * H, 0.03 * H), A(y.navel + 0.18 * tl, PI - 0.55, 0.12 * H, 0.075 * H), A(y.crop + 0.1 * H, PI - 0.85, 0.09 * H, 0.05 * H)]);
  L({ id: 'gluteus.medius', name: 'moyen fessier', group: 'pelvis', layer: 3, tier: 3, fibres: fan(4, 0.6), origin: 'iliac-wing', insertion: 'femur' }, [A(y.waist + 0.12 * tl, PI - 0.55, 0.05 * H, 0.02 * H), A(y.navel + 0.1 * tl, PI - 1.05, 0.075 * H, 0.034 * H), A(y.crop + 0.02 * H, PI - 1.28, 0.05 * H, 0.03 * H)]);
  // ── OMOPLATE (itération 04) ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // Placée par des COTES ANATOMIQUES relatives au squelette du moteur, pas par des angles ψ à l'œil :
  //  · unité verticale u = une vertèbre thoracique = (T12 − C7)/12 (suit la longueur du tronc : enfant, adulte…) ;
  //  · le sommet de la lame (angle supérieur) est calé sur l'acromion du cadre (y.acr), la racine de l'épine ≈ 1 u plus bas, l'angle inférieur 5,5 u plus bas (T2→T7/T8) ;
  //  · en largeur (fractions de la demi-largeur biacromiale x.acr) : bord médial ≈ 0,27–0,30, glène ≈ 0,80 (largeur de lame ≈ 0,5, mesure classique 10–11 cm pour 40 cm d'épaules).
  const lv = tr.spine.lv, u = (lv.t12 - lv.c7) / 12, ys = y.acr + 0.005 * H, XA = f.x.acr;
  const bx = (yy: number, x: number): number => PI - Math.asin(Math.min(0.97, x / tr.at(yy).X));
  const yu = (k: number): number => ys + k * u;
  // lame : sections [k (en u sous l'acromion), bord médial, bord latéral] — large à l'épine, puis resserrée vers l'angle inférieur
  const blade: readonly (readonly [number, number, number])[] = [[0, 0.27, 0.42], [1, 0.27, 0.8], [2.2, 0.28, 0.8], [3.5, 0.29, 0.62], [4.8, 0.3, 0.42], [5.5, 0.3, 0.35]];
  L({ id: 'scapula', name: 'omoplate (lame)', group: 'shoulder', kind: 'bone', level: 3, layer: 2, tier: 4, tone: 0.1, n: 14, hidden: true },
    blade.map(([k, m, l]) => A(yu(k), bx(yu(k), ((m + l) / 2) * XA), ((l - m) / 2) * XA, 0.013 * H, 0.004 * H)));  // atome CACHÉ (`hidden`) : géométrie exploitable (repères, collisions, vérification) mais non dessinée — la peau n'occulte pas les os, d'où le drapeau explicite
  // épine de l'omoplate : de la racine (bord médial) à l'acromion, obliquement vers le haut et en dehors
  L({ id: 'scapular-spine', name: 'épine de l’omoplate', group: 'shoulder', kind: 'bone', level: 3, layer: 5, tier: 3, tone: 0.2, n: 11 },
    ([[0.27, 1], [0.42, 0.85], [0.58, 0.6]] as const).map(([x, k]) => A(yu(k), bx(yu(k), x * XA), 0.018 * H, 0.012 * H, 0.0)));  // seul le tiers médial de l'épine se dessine en relief ; la partie latérale (jusqu'à l'acromion) est portée par le trapèze/deltoïde
  // angle inférieur : relief doux de surface (la lame reste sous les muscles, comme en anatomie : seule la pointe s'y devine). Le bord médial n'est PAS tracé : isolé, il se lisait comme une aiguille.
  L({ id: 'scapula.inferior-angle', name: 'angle inférieur de l’omoplate', group: 'shoulder', kind: 'landmark', level: 3, layer: 5, tier: 4, tone: 0.12, n: 5, hidden: true },
    [A(yu(4.7), bx(yu(4.7), 0.31 * XA), 0.02 * H, 0.006 * H, 0.004 * H), A(yu(5.5), bx(yu(5.5), 0.31 * XA), 0.026 * H, 0.008 * H, 0.005 * H)]);
  // Muscles posés SUR la lame (mêmes cotes) : rhomboïde (de l'épineuse vers le bord médial, fibres obliques vers le bas et en dehors), infra-épineux (fosse sous l'épine), grand rond (angle inférieur → humérus).
  L({ id: 'rhomboid', name: 'rhomboïde', group: 'back', layer: 4, tier: 3, fibres: fan(4, 0.5), origin: 'C7-T5', insertion: 'scapula-medial' }, [A(yu(0.2), bx(yu(0.2), 0.06 * XA), 0.02 * H, 0.016 * H), A(yu(1.6), bx(yu(1.6), 0.17 * XA), 0.036 * H, 0.018 * H), A(yu(3.2), bx(yu(3.2), 0.27 * XA), 0.022 * H, 0.015 * H)]);
  L({ id: 'infraspinatus', name: 'infra-épineux', group: 'back', layer: 4, tier: 3, fibres: fan(4, 0.55), origin: 'scapula', insertion: 'humerus', n: 11 }, [A(yu(1.5), bx(yu(1.5), 0.36 * XA), 0.048 * H, 0.016 * H, 0.002 * H), A(yu(2.5), bx(yu(2.5), 0.52 * XA), 0.082 * H, 0.02 * H, 0.003 * H), A(yu(3.5), bx(yu(3.5), 0.64 * XA), 0.062 * H, 0.018 * H, 0.002 * H)]);
  L({ id: 'teres-major', name: 'grand rond', group: 'back', layer: 4, tier: 3, origin: 'scapula-inferior', insertion: 'humerus', n: 9 }, [A(yu(4.6), bx(yu(4.6), 0.42 * XA), 0.034 * H, 0.02 * H, 0.002 * H), A(yu(4.0), bx(yu(4.0), 0.64 * XA), 0.04 * H, 0.024 * H, 0.003 * H), A(y.axilla + 0.015 * H, PI / 2 + 0.3, 0.024 * H, 0.018 * H)]);
  out.push(vol({ id: 'vertebral-groove', name: 'sillon vertébral', group: 'back', kind: 'landmark', level: 3, layer: 5, tier: 3, strand: true, tone: -0.5 }, [y.base + 0.03 * H, y.base + 0.3 * tl, y.base + 0.65 * tl, y.crop].map((yy) => { const q = tr.point(yy, PI, 0); return { c: q.p, a: 0.004 * H, b: 0.003 * H, hint: q.n }; })));
  return out;
}
