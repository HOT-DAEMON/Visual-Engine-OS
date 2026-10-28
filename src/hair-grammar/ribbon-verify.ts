import { ribbonLength, type AnatomyLimits, type StyleLimits, type FaceLandmarks, type RibbonProfile } from './ribbon';
import type { Check, Report } from './verify';

/**
 * Vérification des rubans en TROIS couches (même contrat que `verify.ts`), dans le repère de tête (unité = hauteur de tête H).
 * Repères du visage de la cellule 01 mesurés sur la référence (px cellule → repère) : voir docs/HAIR-GRAMMAR-RIBBONS.md.
 * Les seuils encadrent la référence (±), ils protègent contre une dérive ; ils ne prouvent PAS la ressemblance.
 */
export const FACE01: FaceLandmarks = { crownV: -0.49, faceContourU: -0.356, noseTipV: 0.155, mouthV: 0.32, chinV: 0.484 };
/** Bornes par défaut (cellule 01). Un profil peut fournir les siennes (`limits`) : une coiffure lisse n'a pas le débord d'une coiffure ébouriffée. */
export const LIMITS01: AnatomyLimits = { crown: [0.25, 0.45], overhang: [0.2, 0.4], width: [1.0, 1.5], fringe: [-0.6, 0.1], side: [-0.4, 0.02] };

const chk = (name: string, value: number, min: number, max: number): Check => ({ name, value, min, max, ok: Number.isFinite(value) && value >= min && value <= max });
const rep = (layer: Report['layer'], checks: Check[]): Report => ({ layer, checks, ok: checks.every((c) => c.ok) });
const hair = (P: RibbonProfile) => P.ribbons.filter((r) => r.role === 'hair');

export function verifyRibbonGeometry(P: RibbonProfile): Report {
  let bad = 0; let tiny = 0; let thin = 0;
  const badSolids = P.solids.filter((m) => m.ring.length < 3 || m.ring.some((q) => q.some((x) => !Number.isFinite(x)))).length
    + P.tones.filter((t) => t.rings.length === 0 || t.rings.some((r) => r.length < 3 || r.some((q) => q.some((x) => !Number.isFinite(x))))).length;
  for (const r of P.ribbons) {
    if (r.p.some((q) => q.some((x) => !Number.isFinite(x)))) bad++;
    if (r.p.length < 2 || ribbonLength(r) < 0.03) tiny++;
    if (r.p.some((q) => q[2] <= 0)) thin++;
  }
  return rep('geometry', [chk('rubans non finis', bad, 0, 0), chk('rubans dégénérés (< 0,03 H)', tiny, 0, 0), chk('largeurs ≤ 0', thin, 0, 0), chk('masses/tons dégénérés ou non finis', badSolids, 0, 0), chk('nombre de rubans de cheveux', hair(P).length, 40, 400)]);
}

export const STYLE01: StyleLimits = { median: [0.8, 2.2], maxThin: [2, 5.1], ratio: [6, 60] };

export function verifyRibbonAnatomy(P: RibbonProfile): Report {
  const F = P.landmarks ?? FACE01; const L = P.limits ?? LIMITS01;
  const pts = hair(P).flatMap((r) => r.p);
  const minV = Math.min(...pts.map((q) => q[1])); const minU = Math.min(...pts.map((q) => q[0])); const maxU = Math.max(...pts.map((q) => q[0]));
  const faceCols = pts.filter((q) => q[0] > -0.3 && q[0] < 0.1);
  const lowestOverFace = Math.max(...faceCols.map((q) => q[1]));
  const lowest = Math.max(...pts.map((q) => q[1]));
  return rep('anatomy', [
    chk('volume au-dessus du crâne / H', F.crownV - minV, L.crown[0], L.crown[1]),
    chk('débord avant (au-delà du contour du visage) / H', F.faceContourU - minU, L.overhang[0], L.overhang[1]),
    chk('largeur totale des cheveux / H', maxU - minU, L.width[0], L.width[1]),
    chk('frange : au plus 0,1 H sous la pointe du nez', lowestOverFace - F.noseTipV, L.fringe[0], L.fringe[1]),
    chk('mèches latérales : ne descendent pas sous le menton (/H)', lowest - F.chinV, L.side[0], L.side[1]),
  ]);
}

export function verifyRibbonStyle(P: RibbonProfile): Report {
  const px = P.frame.unit; const ws = hair(P).flatMap((r) => r.p.map((q) => q[2] * px)).sort((a, b) => a - b);
  const median = ws[Math.floor(ws.length / 2)] as number; const max = ws[ws.length - 1] as number;
  const ratios = hair(P).map((r) => ribbonLength(r) / Math.max(1e-6, r.p.reduce((s, q) => s + q[2], 0) / r.p.length));
  const meanRatio = ratios.reduce((a, b) => a + b, 0) / Math.max(1, ratios.length);
  const SL = P.styleLimits ?? STYLE01;
  return rep('style', [chk('épaisseur médiane du trait (px cellule)', median, SL.median[0], SL.median[1]), chk('épaisseur maximale d\'un ruban fin (px cellule)', max, SL.maxThin[0], SL.maxThin[1]), chk('rapport longueur/largeur moyen', meanRatio, SL.ratio[0], SL.ratio[1]), chk('niveaux de ton', new Set(P.tones.map((t) => t.level)).size, (SL.tones ?? [3, 6])[0], (SL.tones ?? [3, 6])[1]),
    // le gris doit FONCER avec le niveau (sinon l'ordre de peinture clair → sombre ferait disparaître des bandes)
    chk('bandes de ton dans le désordre', [...P.tones].sort((a, b) => a.level - b.level).filter((t, i, a) => i > 0 && t.gray >= (a[i - 1] as typeof t).gray).length, 0, 0)]);
}
