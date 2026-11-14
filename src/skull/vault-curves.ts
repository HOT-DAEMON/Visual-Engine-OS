import { sy } from '../head-turntable/engines/units';
import type { SkullGeo } from './geometry';

/**
 * COURBES ET POINTS ANATOMIQUES DE LA VOÛTE (sutures, lignes, repères), exprimés dans l'espace de paramétrage du maillage : hauteur y (U du moteur) et azimut (°, 0 = face, 90 = côté, 180 = nuque).
 * Elles EXISTENT toujours dans le modèle (données) ; elles ne sont rendues qu'en relief fin (`suturesShow`) ou en calque de contrôle. Les extrémités sont les repères osseux déjà calculés
 * (`SkullGeo.bone.lm` : bregma, lambda, ptérion, astérion, glabelle, inion, porion) : rien n'est placé « à la main » sauf les azimuts de passage, conventions d'anatomie (Gray, ch. 4).
 */
export interface VaultCurve { readonly id: string; readonly kind: 'suture' | 'line' | 'point'; readonly pts: readonly { y: number; az: number }[]; readonly visibleByDefault: boolean }
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export function vaultCurves(sk: SkullGeo): VaultCurve[] {
  const L = sk.bone.lm, Y = (id: string): number => sy((L[id] ?? L.vertex!).y);
  const br = Y('bregma'), la = Y('lambda'), pt = Y('pterion'), as = Y('asterion'), gl = Y('glabella'), por = Y('porion'), inn = Y('inion'), v = Y('vertex');
  const arc = (y0: number, a0: number, y1: number, a1: number, n: number, bow = 1): { y: number; az: number }[] =>
    Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return { y: lerp(y0, y1, t), az: lerp(a0, a1, Math.pow(t, bow)) }; });
  return [
    { id: 'suture.coronal', kind: 'suture', pts: arc(br, 0, pt, 78, 6, 0.9), visibleByDefault: false },
    { id: 'suture.sagittal.ant', kind: 'suture', pts: [{ y: v, az: 0 }, { y: br, az: 0 }], visibleByDefault: false },
    { id: 'suture.sagittal.post', kind: 'suture', pts: [{ y: v, az: 180 }, { y: la, az: 180 }], visibleByDefault: false },
    { id: 'suture.lambdoid', kind: 'suture', pts: arc(la, 180, as, 122, 6, 1.1), visibleByDefault: false },
    { id: 'suture.squamous', kind: 'suture', pts: [{ y: pt, az: 78 }, { y: pt + 0.5 * (por - pt) - 0.01, az: 96 }, { y: por - 0.06, az: 112 }, { y: as, az: 122 }], visibleByDefault: false },
    { id: 'line.temporal', kind: 'line', pts: [{ y: gl - 0.02, az: 24 }, { y: gl - 0.11, az: 48 }, { y: gl - 0.13, az: 76 }, { y: gl - 0.05, az: 100 }, { y: por - 0.1, az: 118 }], visibleByDefault: false },
    { id: 'line.nuchal', kind: 'line', pts: [{ y: inn, az: 180 }, { y: inn + 0.006, az: 160 }, { y: inn + 0.016, az: 140 }, { y: inn + 0.03, az: 124 }], visibleByDefault: false },
    { id: 'point.bregma', kind: 'point', pts: [{ y: br, az: 0 }], visibleByDefault: false },
    { id: 'point.lambda', kind: 'point', pts: [{ y: la, az: 180 }], visibleByDefault: false },
    { id: 'point.pterion', kind: 'point', pts: [{ y: pt, az: 78 }], visibleByDefault: false },
    { id: 'point.asterion', kind: 'point', pts: [{ y: as, az: 122 }], visibleByDefault: false },
    { id: 'point.glabella', kind: 'point', pts: [{ y: gl, az: 0 }], visibleByDefault: true },
    { id: 'point.inion', kind: 'point', pts: [{ y: inn, az: 180 }], visibleByDefault: false },
  ];
}
