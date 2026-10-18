import { lerp } from '../curve';
import type { Vec } from '../../geometry/eye/primitives';
import type { FaceParams } from '../../schema';
import type { NoseFrame } from './frame';

/**
 * Profil du nez VU DE CÔTÉ (x = avancée devant le plan du visage, y = hauteur) : racine enfoncée, arête (droite, concave, convexe),
 * pointe projetée, sous-nez (columelle), lèvre supérieure. Ce profil est une grandeur de référence : la vue de face ne le montre pas
 * directement, mais le rendu en tire les ombres (enfoncement de la racine, ombre sous la pointe) et les artefacts le dessinent.
 * Projection de la pointe : 45–95 % de la longueur du nez, ce qui couvre du nez court au nez très projeté.
 */
export interface NoseProfile {
  readonly points: readonly Vec[];
  readonly projectionPx: number;
  /** Avancée de l'arête à chaque échantillon du dorsum (racine → supra-pointe), px : sert à moduler le reflet de l'arête. */
  readonly ridge: readonly number[];
  /** Angle naso-labial indicatif (degrés) : plus la pointe est relevée, plus il s'ouvre. */
  readonly nasolabialDeg: number;
}

export function noseProfile(p: FaceParams, F: NoseFrame, samples: number, depthPx: number): NoseProfile {
  const n = p.nose;
  const L = F.baseY - F.rootY;
  const zTip = L * (0.45 + 0.5 * n.tip.projection);
  const supratipY = F.tipY - 0.6 * F.tipRy;
  // Écart de l'arête à la droite racine → pointe : convexe = bosse (positif), concave = creux (négatif), asymétrique = bosse légère.
  const bow = { straight: 0, concave: -1, convex: 1, asymmetric: 0.35 }[n.dorsum.shape] * n.dorsum.curvature * 0.12 * L;
  const ridge: number[] = [];
  const pts: Vec[] = [{ x: 0, y: F.rootY - 0.05 * F.H }, { x: -depthPx, y: F.rootY }];
  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1);
    // Droite racine → supra-pointe, plus l'écart en demi-sinusoïde (nul aux deux bouts : le profil se raccorde à la racine et à la pointe).
    const z = lerp(-depthPx, zTip * 0.9, t) + bow * Math.sin(Math.PI * t);
    ridge.push(z);
    if (i > 0) pts.push({ x: z, y: lerp(F.rootY, supratipY, t) });
  }
  pts.push({ x: zTip, y: F.tipY }, { x: zTip * 0.55, y: lerp(F.tipY, F.baseY, 0.7) }, { x: 0, y: F.baseY }, { x: -0.02 * F.W, y: F.baseY + 0.03 * F.H });
  return { points: pts, projectionPx: zTip, ridge, nasolabialDeg: 100 + 20 * n.tip.rotation };
}
