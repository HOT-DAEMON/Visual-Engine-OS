import type { Vec } from '../../geometry/eye/primitives';
import { smooth } from '../curve';
import type { Poly } from '../poly';
import { OUTLINE_N } from './outline';
import { band, blobOf, dist, ellipse, insideShare, inset, lerp2, path, pt, ribbon, span } from './plan-geom';
import type { EarCorrection, FlatMorph, PiercingAnchor, PlacedStructure, ResolvedEar } from './types';

/** Résultat de la construction des structures (repère CANONIQUE, avant normalisation du contour). */
export interface Built {
  readonly structures: PlacedStructure[];
  readonly landmarks: Record<string, Vec>;
  readonly anchors: PiercingAnchor[];
  readonly thickness: number;
  readonly corrections: EarCorrection[];
}

const rad = (d: number): number => (d * Math.PI) / 180;
const dir = (deg: number): Vec => pt(Math.sin(rad(deg)), -Math.cos(rad(deg)));
const at = (a: Vec, d: Vec, l: number): Vec => pt(a.x + d.x * l, a.y + d.y * l);
const add = (c: PlacedStructure[]) => (id: string, kind: PlacedStructure['kind'], poly: Poly, relief: number, ext?: PlacedStructure['ext']): void => { c.push({ id, kind, poly, relief, ...(ext ? { ext } : {}) }); };

/**
 * Anatomie atomique (EAR-01 … EAR-07, 02A–E, 05A–F, crus) construite DANS le contour : l'hélix, la scapha et les extensions SUIVENT le contour (décalages
 * intérieurs), l'anthélix/la conque/le tragus sont placés relativement aux repères. Chaque structure = rôle + polygone + relief ; rien n'est « peint ».
 * `vf` = niveau (canonique) de la racine de l'hélix, c.-à-d. de la fosse triangulaire : le repère aligné sur la ligne des yeux.
 */
export function buildStructures(outline: Poly, m: FlatMorph, r: ResolvedEar, vf: number, ctrlIdx: { lobuleStart: number; bottom: number; lobuleEnd: number; peak: number }): Built {
  const out: PlacedStructure[] = [];
  const S = add(out);
  const corr: EarCorrection[] = [];
  const g = (k: string): number => m[k] ?? 0;
  const thickness = 0.05 + 0.012 * g('helix.roll');
  // ── Hélix (EAR-01) : bande intérieure du contour, de la racine au lobule ; épaisseur variable (fusion progressive avec le lobule).
  const end = r.present.lobule ? ctrlIdx.lobuleStart * OUTLINE_N : ctrlIdx.bottom * OUTLINE_N;
  const idx = span(outline.length, 0, end);
  const tH0 = 0.075 + 0.03 * g('helix.thickness');
  const wH = idx.map((_, k) => { const s = k / (idx.length - 1); return tH0 * smooth(s / 0.15) * (1 - 0.65 * smooth((s - 0.7) / 0.3)); });
  // ── Anthélix (EAR-02, 02A–02D) : corps + deux branches + jonction (ruban à largeur variable, relief propre).
  const rel = g('antihelix.relief');
  const wB = 0.05 + 0.015 * rel;
  const A0 = pt(0.4, 0.665), A1 = pt(0.5, 0.54), B = pt(0.52, 0.385);
  const sep = 62 + 24 * g('antihelix.branchAngle');
  const aU = sep * 0.35, aL = -sep * 0.65;
  const U = at(B, dir(aU), 0.26 * (1 + 0.45 * g('antihelix.upperLength')));
  const Lw = at(B, dir(aL), 0.2 * (1 + 0.45 * g('antihelix.lowerLength')));
  const bend = (a: Vec, b: Vec, k: number): Vec => { const m2 = lerp2(a, b, 0.5); return pt(m2.x + (b.y - a.y) * k, m2.y - (b.x - a.x) * k); };
  const pBody = path([A0, A1, B]);
  const pUp = path([B, bend(B, U, 0.18), U]);
  const pLow = path([B, bend(B, Lw, -0.15), Lw]);
  // ── Scapha (EAR-03) : creux entre l'hélix et l'anthélix. CONTRAINTE STRICTE : l'hélix ne la recouvre jamais → largeur ≤ 90 % de l'intervalle mesuré.
  const gap = Math.min(...[...pUp, ...pBody].map((q) => Math.min(...idx.filter((_, k) => k % 3 === 0).map((i) => dist(q, outline[i] as Vec)))));
  const tS0 = 0.1 + 0.04 * g('scapha.width');
  const tS = Math.max(0.012, Math.min(tS0, 0.9 * gap - tH0 - wB));
  if (tS < tS0 - 1e-9) corr.push({ id: 'scapha-not-hidden', param: 'scapha.width', requested: tS0, applied: tS, reason: "l'hélix et l'anthélix ne recouvrent pas la scapha (largeur ≤ 90 % de l'intervalle)", tier: 'strict' });
  S('helix', 'band', band(outline, idx, idx.map(() => 0), wH), 0.9 + 0.35 * g('helix.roll'));
  const sIdx = idx.filter((_, k) => k > idx.length * 0.08 && k < idx.length * 0.86);
  S('scapha', 'cavity', band(outline, sIdx, sIdx.map((i) => wH[idx.indexOf(i)] as number), sIdx.map((i, k) => (wH[idx.indexOf(i)] as number) + tS * Math.sin((Math.PI * (k + 1)) / (sIdx.length + 1)) ** 0.6)), -0.25 - 0.2 * g('scapha.depth'));
  if (r.present.antihelix) {
    const sh = (p: Vec[], w0: number, w1: number): number[] => p.map((_, k) => w0 + (w1 - w0) * (k / (p.length - 1)));
    S('antihelix:body', 'ridge', ribbon(pBody, sh(pBody, wB * 0.9, wB)), 0.6 + 0.3 * rel);
    S('antihelix:upper', 'ridge', ribbon(pUp, sh(pUp, wB * 0.85, wB * 0.4)), 0.6 + 0.3 * rel);
    S('antihelix:lower', 'ridge', ribbon(pLow, sh(pLow, wB * 0.85, wB * 0.35)), 0.55 + 0.3 * rel);
    S('antihelix:junction', 'blob', ellipse(B, wB * 1.25, wB * 1.25), 0.56 + 0.3 * rel);
    // 02E sillons périphériques : creux étroits entre l'anthélix et la conque (côté concave) et entre l'anthélix et la scapha.
    const off = (p: Vec[], d: number): Vec[] => p.map((q, k) => { const a = p[Math.max(0, k - 1)] as Vec, b = p[Math.min(p.length - 1, k + 1)] as Vec; const l = dist(a, b) || 1; return pt(q.x + (-(b.y - a.y) / l) * d, q.y + ((b.x - a.x) / l) * d); });
    S('antihelix:groove-conch', 'cavity', ribbon(off(pBody, -(wB + 0.014)), pBody.map(() => 0.011)), -0.3);
    S('antihelix:groove-scapha', 'cavity', ribbon(off(pBody, wB + 0.014), pBody.map(() => 0.011)), -0.2);
    if (r.present.fossa) S('fossa', 'cavity', blobOf([pt(B.x, B.y - 0.04), lerp2(B, U, 0.8), lerp2(B, Lw, 0.8)]), -0.3);
  }
  // ── Crus de l'hélix + conque (cymba au-dessus, cavum au-dessous : 05A–05F) + ouverture du conduit.
  const tc = 0.028 + 0.014 * g('crus.thickness');
  const crus = path([pt(0.02, vf), pt(0.17, vf + 0.012), pt(0.38, vf + 0.035)]);
  S('crus', 'ridge', ribbon(crus, crus.map((_, k) => tc * (0.8 + 0.2 * Math.sin((Math.PI * k) / 8) - 0.45 * smooth(k / (crus.length - 1))))), 0.55);
  const cym = 0.05 * (1 + 0.5 * g('concha.cymba'));
  S('cymba', 'cavity', blobOf([pt(0.12, vf - cym), pt(0.3, vf - cym - 0.005), pt(0.42, vf - cym * 0.6), pt(0.42, vf + 0.005), pt(0.2, vf - 0.005), pt(0.12, vf - 0.01)]), -0.5);
  // Épaisseur de paroi (strict) : profondeur de la conque ≤ épaisseur − paroi minimale.
  const dReq = 0.032 * (1 + 0.6 * g('concha.depth'));
  const dMax = thickness - 0.012;
  const depth = Math.min(dReq, dMax);
  if (depth < dReq - 1e-9) corr.push({ id: 'concha-wall', param: 'concha.depth', requested: dReq, applied: depth, reason: 'la profondeur de la conque garde une paroi minimale (la cavité ne traverse pas le pavillon)', tier: 'strict' });
  const cav = blobOf([pt(0.09, vf + 0.045), pt(0.3, vf + 0.045), pt(0.43, vf + 0.08), pt(0.46, 0.5), pt(0.41, 0.61), pt(0.28, 0.645), pt(0.09, 0.58)]);
  S('cavum', 'cavity', cav, -(depth / thickness) * 0.95);
  const cy = vf + 0.045 + 0.55 * (0.6 - (vf + 0.045));
  const canal = pt(0.2, cy);
  S('canal', 'cavity', ellipse(canal, 0.04, 0.052), -1);
  // ── Tragus, antitragus, incisure intertragique (EAR-06).
  const ts = 1 + 0.4 * g('tragus.size');
  const tragus = pt(0.07 - 0.03 * g('tragus.projection'), 0.5);
  if (r.present.tragus) S('tragus', 'blob', ellipse(tragus, 0.095 * ts, 0.08 * ts, -20), 0.7);
  const as = 1 + 0.4 * g('antitragus.size');
  if (r.present.antitragus) S('antitragus', 'blob', ellipse(pt(0.34, 0.675), 0.1 * as, 0.052 * as, 20 + 25 * g('antitragus.orientation')), 0.55);
  S('notch', 'cavity', ellipse(pt(0.13, 0.615), 0.032, 0.03 * (1 + g('notch.depth'))), -0.6);
  // ── Lobule (EAR-07) : sans cartilage (relief doux), du début du bord inférieur à la jonction avec la joue.
  if (r.present.lobule) S('lobule', 'blob', outline.slice(ctrlIdx.lobuleStart * OUTLINE_N, ctrlIdx.lobuleEnd * OUTLINE_N + 1), 0.25);
  // ── Extensions (EAR-08) : mécanisme de construction réutilisé, matériau et raccord adaptés (voir le rendu).
  for (const e of r.extensions) {
    const k = Math.min(idx.length - 1, Math.max(0, Math.round(e.at * (idx.length - 1))));
    const half = Math.max(2, Math.round(e.length * idx.length * 0.25));
    const sub = idx.slice(Math.max(0, k - half), Math.min(idx.length, k + half + 1));
    if (sub.length < 3) continue;
    const wd = sub.map(() => tH0 + tS * 0.5);
    if (e.kind === 'secondary_ridge') S('ext:secondary_ridge', 'ext', ribbon(inset(outline, sub, wd), sub.map((_, i) => 0.018 + 0.016 * e.intensity * Math.sin((Math.PI * (i + 0.5)) / sub.length))), 0.5, e.kind);
    else if (e.kind === 'bioluminescent_channel') S('ext:bioluminescent_channel', 'ext', ribbon(inset(outline, sub, wd), sub.map(() => 0.013 + 0.01 * e.intensity)), -0.1, e.kind);
    else if (e.kind === 'membrane_panel') S('ext:membrane_panel', 'ext', [...sub.map((i) => outline[i] as Vec), ...inset(outline, sub, sub.map((_, i) => 0.05 + 0.12 * e.length * Math.sin((Math.PI * (i + 0.5)) / sub.length))).reverse()], -0.1, e.kind);
    else if (e.kind === 'branching_ridge') S('ext:branching_ridge', 'ext', ribbon(path([U, pt(U.x + 0.06, U.y - 0.03), pt(U.x + 0.1 * (0.5 + e.length), U.y - 0.11 * (0.5 + e.length))]), [0.024, 0.018, 0.01]), 0.5, e.kind);
    else if (e.kind === 'ornamental_growth') {
      const n = 3 + Math.round(2 * e.intensity);
      for (let j = 0; j < n; j++) {
        const i0 = sub[Math.round(((j + 0.5) * (sub.length - 1)) / n)] as number;
        const q = outline[i0] as Vec, nx = outline[(i0 + 1) % outline.length] as Vec, pv = outline[(i0 - 1 + outline.length) % outline.length] as Vec;
        const l = dist(nx, pv) || 1;
        const nrm = pt((nx.y - pv.y) / l, -(nx.x - pv.x) / l);
        // Normale SORTANTE : opposée au décalage intérieur (testée sur le centroïde du contour).
        const cx = outline.reduce((s, c) => s + c.x, 0) / outline.length, cyy = outline.reduce((s, c) => s + c.y, 0) / outline.length;
        const sg = nrm.x * (q.x - cx) + nrm.y * (q.y - cyy) >= 0 ? 1 : -1;
        const ap = pt(q.x + sg * nrm.x * (0.06 + 0.07 * e.length), q.y + sg * nrm.y * (0.06 + 0.07 * e.length));
        S(`ext:ornamental_growth:${j}`, 'ext', [pt(q.x - (nx.x - pv.x) / l * 0.02, q.y - (nx.y - pv.y) / l * 0.02), ap, pt(q.x + (nx.x - pv.x) / l * 0.02, q.y + (nx.y - pv.y) / l * 0.02)], 0.6, e.kind);
      }
    } else if (e.kind === 'terminal_tip') S('ext:terminal_tip', 'ext', ribbon(inset(outline, span(outline.length, ctrlIdx.peak * OUTLINE_N - 6, ctrlIdx.peak * OUTLINE_N + 7), Array(13).fill(0.012)), Array.from({ length: 13 }, (_, i) => 0.03 * (1 - Math.abs(i - 6) / 7))), 0.5, e.kind);
  }
  // Toute structure construite reste DANS le pavillon (invariant géométrique ; seules les extensions saillantes peuvent sortir).
  for (const s of out) if (s.kind !== 'ext' && s.id !== 'helix' && s.id !== 'lobule' && s.kind !== 'band' && insideShare(s.poly, outline) < 0.55 && !String(s.id).startsWith('antihelix:groove')) corr.push({ id: `inside:${s.id}`, param: String(s.id), requested: insideShare(s.poly, outline), applied: insideShare(s.poly, outline), reason: 'structure partiellement hors du pavillon', tier: 'preference' });
  const landmarks: Record<string, Vec> = { crus: pt(0.02, vf), lobuleBottom: outline[ctrlIdx.bottom * OUTLINE_N] as Vec, top: outline[ctrlIdx.peak * OUTLINE_N] as Vec, tragus, canal, junction: B, upperEnd: U, lowerEnd: Lw, antitragus: pt(0.34, 0.675) };
  const lobeC = pt((outline[ctrlIdx.bottom * OUTLINE_N] as Vec).x, (outline[ctrlIdx.bottom * OUTLINE_N] as Vec).y - 0.07);
  const hx = outline[idx[Math.round(idx.length * 0.12)] as number] as Vec;
  const anchors: PiercingAnchor[] = [
    { kind: 'ear_lobe_piercing', at: lobeC, angleDeg: 90, compatible: r.present.lobule && g('lobule.length') > -0.6 },
    { kind: 'helix_piercing', at: pt(hx.x + 0.03, hx.y + 0.02), angleDeg: 135, compatible: true },
    { kind: 'tragus_piercing', at: tragus, angleDeg: 180, compatible: r.present.tragus },
    { kind: 'conch_piercing', at: pt(0.32, (vf + 0.05 + 0.6) / 2), angleDeg: 90, compatible: true },
    { kind: 'industrial_piercing', at: pt(hx.x + 0.04, hx.y + 0.06), end: at(U, pt(0.12, -0.05), 1), angleDeg: 20, compatible: r.present.antihelix },
  ];
  return { structures: out, landmarks, anchors, thickness, corrections: corr };
}
