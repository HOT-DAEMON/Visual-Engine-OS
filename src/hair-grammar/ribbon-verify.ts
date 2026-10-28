import { ribbonLength, type RibbonProfile } from './ribbon';
import type { Check, Report } from './verify';

/**
 * Vérification des rubans en TROIS couches (même contrat que `verify.ts`), dans le repère de tête (unité = hauteur de tête H).
 * Repères du visage de la cellule 01 mesurés sur la référence (px cellule → repère) : voir docs/HAIR-GRAMMAR-RIBBONS.md.
 * Les seuils encadrent la référence (±), ils protègent contre une dérive ; ils ne prouvent PAS la ressemblance.
 */
export const FACE01 = { crownV: -0.49, faceContourU: -0.356, noseTipV: 0.155, mouthV: 0.32, chinV: 0.484 } as const;

const chk = (name: string, value: number, min: number, max: number): Check => ({ name, value, min, max, ok: Number.isFinite(value) && value >= min && value <= max });
const rep = (layer: Report['layer'], checks: Check[]): Report => ({ layer, checks, ok: checks.every((c) => c.ok) });
const hair = (P: RibbonProfile) => P.ribbons.filter((r) => r.role === 'hair');

export function verifyRibbonGeometry(P: RibbonProfile): Report {
  let bad = 0; let tiny = 0; let thin = 0;
  for (const r of P.ribbons) {
    if (r.p.some((q) => q.some((x) => !Number.isFinite(x)))) bad++;
    if (r.p.length < 2 || ribbonLength(r) < 0.03) tiny++;
    if (r.p.some((q) => q[2] <= 0)) thin++;
  }
  return rep('geometry', [chk('rubans non finis', bad, 0, 0), chk('rubans dégénérés (< 0,03 H)', tiny, 0, 0), chk('largeurs ≤ 0', thin, 0, 0), chk('nombre de rubans de cheveux', hair(P).length, 40, 400)]);
}

export function verifyRibbonAnatomy(P: RibbonProfile): Report {
  const pts = hair(P).flatMap((r) => r.p);
  const minV = Math.min(...pts.map((q) => q[1])); const minU = Math.min(...pts.map((q) => q[0])); const maxU = Math.max(...pts.map((q) => q[0]));
  const faceCols = pts.filter((q) => q[0] > -0.3 && q[0] < 0.1);
  const lowestOverFace = Math.max(...faceCols.map((q) => q[1]));
  const lowest = Math.max(...pts.map((q) => q[1]));
  return rep('anatomy', [
    chk('volume au-dessus du crâne / H', FACE01.crownV - minV, 0.25, 0.45),
    chk('débord avant (au-delà du contour du visage) / H', FACE01.faceContourU - minU, 0.2, 0.4),
    chk('largeur totale des cheveux / H', maxU - minU, 1.0, 1.5),
    chk('frange : au plus 0,1 H sous la pointe du nez', lowestOverFace - FACE01.noseTipV, -0.6, 0.1),
    chk('mèches latérales : ne descendent pas sous le menton (/H)', lowest - FACE01.chinV, -0.4, 0.02),
  ]);
}

export function verifyRibbonStyle(P: RibbonProfile): Report {
  const px = P.frame.unit; const ws = hair(P).flatMap((r) => r.p.map((q) => q[2] * px)).sort((a, b) => a - b);
  const median = ws[Math.floor(ws.length / 2)] as number; const max = ws[ws.length - 1] as number;
  const ratios = hair(P).map((r) => ribbonLength(r) / Math.max(1e-6, r.p.reduce((s, q) => s + q[2], 0) / r.p.length));
  const meanRatio = ratios.reduce((a, b) => a + b, 0) / Math.max(1, ratios.length);
  return rep('style', [chk('épaisseur médiane du trait (px cellule)', median, 0.8, 2.2), chk('épaisseur maximale (px cellule)', max, 2, 3.6), chk('rapport longueur/largeur moyen', meanRatio, 6, 60), chk('niveaux de ton', new Set(P.tones.map((t) => t.level)).size, 2, 3)]);
}
