import type { Vec } from '../../geometry/eye/primitives';
import { smooth } from '../curve';
import type { Poly } from '../poly';
import { OUTLINE_N } from './outline';
import { band, blobOf, dist, ellipse, insideShare, inset, lerp2, path, pt, ribbon, span } from './plan-geom';
import { rotAbout, scaleAbout } from './interior';
import type { EarCorrection, FlatMorph, PiercingAnchor, PlacedStructure, ResolvedEar } from './types';

/** Résultat de la construction des structures (repère CANONIQUE, avant normalisation du contour). */
export interface Built {
  readonly structures: PlacedStructure[];
  readonly landmarks: Record<string, Vec>;
  readonly anchors: PiercingAnchor[];
  readonly thickness: number;
  readonly corrections: EarCorrection[];
}

/** Point le plus bas (y max) du lobule quand il est fendu (le centre du bas est alors l'encoche) ; sinon le repère historique. */
const lowest = (o: Poly, a: number, b: number, dflt: Vec, cleft: boolean): Vec => (cleft ? o.slice(a, b + 1).reduce((m, q) => (q.y > m.y ? q : m), dflt) : dflt);
const rad = (d: number): number => (d * Math.PI) / 180;
const dir = (deg: number): Vec => pt(Math.sin(rad(deg)), -Math.cos(rad(deg)));
const at = (a: Vec, d: Vec, l: number): Vec => pt(a.x + d.x * l, a.y + d.y * l);
const add = (c: PlacedStructure[]) => (id: string, kind: PlacedStructure['kind'], poly: Poly, relief: number, ext?: PlacedStructure['ext']): void => { c.push({ id, kind, poly, relief, ...(ext ? { ext } : {}) }); };

/**
 * Anatomie atomique (EAR-01 … EAR-07, 02A–E, 05A–F, crus) construite DANS le contour : l'hélix, la scapha et les extensions SUIVENT le contour (décalages
 * intérieurs), l'anthélix/la conque/le tragus sont placés relativement aux repères. Chaque structure = rôle + polygone + relief ; rien n'est « peint ».
 * `vf` = niveau (canonique) de la racine de l'hélix, c.-à-d. de la fosse triangulaire : le repère aligné sur la ligne des yeux.
 */
export function buildStructures(outline: Poly, m: FlatMorph, r: ResolvedEar, vf: number, ctrlIdx: { lobuleStart: number; bottom: number; lobuleEnd: number; peak: number }, fidelity = 0.8): Built {
  const out: PlacedStructure[] = [];
  const S = add(out);
  const corr: EarCorrection[] = [];
  const g = (k: string): number => m[k] ?? 0;
  const thickness = 0.05 + 0.012 * g('helix.roll');
  // Fidélité anatomique : articulation des raccords et sillons (sillons périphériques, jonction des branches, fosse, incisure, cymba). 1 au défaut (0,8) → géométrie historique.
  const ff = Math.min(1.3, 0.05 + 1.1875 * fidelity);
  const fold = Math.max(0, g('helix.fold'));
  // ── Hélix (EAR-01) : bande intérieure du contour, de la racine au lobule ; épaisseur variable (fusion progressive avec le lobule).
  const end = r.present.lobule ? ctrlIdx.lobuleStart * OUTLINE_N : ctrlIdx.bottom * OUTLINE_N;
  const idx = span(outline.length, 0, end);
  const tH0 = 0.075 + 0.03 * g('helix.thickness');
  const tors = g('helix.torsion'), cont = g('helix.continuity');
  const NICK_S = 0.58;
  const wH = idx.map((_, k) => {
    const s = k / (idx.length - 1);
    const w0 = tH0 * smooth(s / 0.15) * (1 - 0.65 * smooth((s - 0.7) / 0.3)) * (1 + 2.4 * fold * smooth((s - 0.06) / 0.14) * (1 - smooth((s - 0.42) / 0.16)));
    // EAR-01 torsion : le rebord se tord le long de sa course (épais en haut / fin en bas, ou l'inverse) ; continuité > 0 : épaisseur régularisée, < 0 : le rebord se rompt (entaille à 58 %).
    const twisted = w0 * (1 + 0.6 * tors * Math.cos(Math.PI * Math.min(1, s * 1.25)));
    const even = cont > 0 ? twisted + (tH0 * 0.85 * smooth(s / 0.15) * (1 - 0.5 * smooth((s - 0.75) / 0.25)) - twisted) * 0.7 * cont : twisted;
    return even * (cont < 0 ? 1 - 0.92 * -cont * Math.exp(-(((s - NICK_S) / 0.045) ** 2)) : 1);
  });
  // ── Anthélix (EAR-02, 02A–02D) : corps + deux branches + jonction (ruban à largeur variable, relief propre).
  const rel = g('antihelix.relief');
  const wB = 0.072 + 0.018 * rel;
  const crv = g('antihelix.curvature');
  const A0 = pt(0.52, 0.69), A1 = pt(0.625 + 0.07 * crv, 0.56), B = pt(0.64 + 0.025 * crv, 0.385);
  const sep = 62 + 24 * g('antihelix.branchAngle');
  const aU = sep * 0.35, aL = -sep * 0.65;
  const U = at(B, dir(aU), 0.26 * (1 + 0.45 * g('antihelix.upperLength')));
  const Lw = at(B, dir(aL), 0.2 * (1 + 0.45 * g('antihelix.lowerLength')));
  const bend = (a: Vec, b: Vec, k: number): Vec => { const m2 = lerp2(a, b, 0.5); return pt(m2.x + (b.y - a.y) * k, m2.y - (b.x - a.x) * k); };
  const pBody = path([A0, A1, B]);
  const pUp = path([B, bend(B, U, 0.18 + 0.25 * crv), U]);
  const pLow = path([B, bend(B, Lw, -0.15 - 0.25 * crv), Lw]);
  // ── Scapha (EAR-03) : creux entre l'hélix et l'anthélix. CONTRAINTE STRICTE : l'hélix et l'anthélix ne la recouvrent jamais. La place disponible est mesurée
  // POINT PAR POINT le long de l'hélix (distance au contour − largeur de l'hélix − demi-largeur de l'anthélix) : la scapha se pince là où la branche supérieure
  // s'approche du bord et s'ouvre partout ailleurs. (Version précédente : un MINIMUM global écrasait la largeur à 0,012 partout → l'axe `scapha.width` était mort.)
  const sIdx = idx.filter((_, k) => k > idx.length * 0.08 && k < idx.length * 0.86);
  const anti = [...pUp, ...pBody];
  const sRoom = sIdx.map((i) => Math.min(...anti.map((q) => dist(q, outline[i] as Vec))) - wB - (wH[idx.indexOf(i)] as number));
  const tS0 = 0.1 + 0.055 * g('scapha.width');
  const scurv = g('scapha.curvature');
  const sProf = sIdx.map((_, k) => { const u = (k + 1) / (sIdx.length + 1); return Math.sin(Math.PI * u ** (scurv >= 0 ? 1 + 1.6 * scurv : 1 / (1 - 1.6 * scurv))) ** 0.6 * (1 + 0.55 * scurv * (1 - 2 * u)); });
  const sW = sIdx.map((_, k) => Math.max(0.008, Math.min(tS0 * (sProf[k] as number), 0.85 * (sRoom[k] as number))));
  const meanW = sW.reduce((a, b) => a + b, 0) / sW.length, meanReq = (tS0 * sProf.reduce((a, b) => a + b, 0)) / sProf.length;
  const tS = meanW;
  if (meanW < 0.9 * meanReq) corr.push({ id: 'scapha-not-hidden', param: 'scapha.width', requested: meanReq, applied: meanW, reason: "l'hélix et l'anthélix ne recouvrent pas la scapha (largeur ≤ 85 % de la place mesurée en chaque point)", tier: 'strict' });
  S('helix', 'band', band(outline, idx, idx.map(() => 0), wH), 0.9 + 0.35 * g('helix.roll'));
  S('scapha', 'cavity', band(outline, sIdx, sIdx.map((i) => wH[idx.indexOf(i)] as number), sIdx.map((i, k) => (wH[idx.indexOf(i)] as number) + (sW[k] as number))), -0.3 - 0.3 * g('scapha.depth'));
  // EAR-03 dégradé d'ombre : la moitié côté anthélix (gradient > 0) ou côté hélix (< 0) est creusée davantage → la scapha passe de la lumière à l'ombre au lieu d'un fond uniforme.
  const sgr = g('scapha.gradient');
  if (Math.abs(sgr) > 0.05) {
    const hw = (i: number): number => wH[idx.indexOf(i)] as number;
    const mid = sIdx.map((i, k) => hw(i) + (sW[k] as number) * 0.5), out2 = sIdx.map((i, k) => hw(i) + (sW[k] as number)), inn = sIdx.map((i) => hw(i));
    // Surimpression : relief juste au-dessus de la scapha (ordre de dessin : après elle), force portée par `strength`.
    out.push({ id: 'scapha:shade', kind: 'cavity', poly: sgr > 0 ? band(outline, sIdx, mid, out2) : band(outline, sIdx, inn, mid), relief: -0.3 - 0.3 * g('scapha.depth') + 0.004, strength: Math.min(1, Math.abs(sgr)) });
  }
  // EAR-01 : l'entaille du rebord (continuité < 0) est un creux transversal réel, pas seulement un amincissement.
  if (cont < -0.05) {
    const i = idx[Math.round(NICK_S * (idx.length - 1))] as number;
    const q = outline[i] as Vec, c = inset(outline, [i], [tH0 * 0.4])[0] as Vec;
    const nx = c.x - q.x, ny = c.y - q.y;
    S('helix:nick', 'cavity', ellipse(c, tH0 * 0.85, 0.016 + 0.012 * -cont, (Math.atan2(ny, nx) * 180) / Math.PI), -0.9);
  }
  if (r.present.antihelix) {
    const sh = (p: Vec[], w0: number, w1: number): number[] => p.map((_, k) => w0 + (w1 - w0) * (k / (p.length - 1)));
    S('antihelix:body', 'ridge', ribbon(pBody, sh(pBody, wB * 0.9, wB)), 0.6 + 0.3 * rel);
    S('antihelix:upper', 'ridge', ribbon(pUp, sh(pUp, wB * 0.85, wB * 0.4)), 0.6 + 0.3 * rel);
    S('antihelix:lower', 'ridge', ribbon(pLow, sh(pLow, wB * 0.85, wB * 0.35)), 0.55 + 0.3 * rel);
    S('antihelix:junction', 'blob', ellipse(B, wB * 1.25, wB * 1.25), (0.56 + 0.3 * rel) * ff);
    // 02E sillons périphériques : creux étroits entre l'anthélix et la conque (côté concave) et entre l'anthélix et la scapha.
    const off = (p: Vec[], d: number): Vec[] => p.map((q, k) => { const a = p[Math.max(0, k - 1)] as Vec, b = p[Math.min(p.length - 1, k + 1)] as Vec; const l = dist(a, b) || 1; return pt(q.x + (-(b.y - a.y) / l) * d, q.y + ((b.x - a.x) / l) * d); });
    S('antihelix:groove-conch', 'cavity', ribbon(off(pBody, -(wB + 0.014)), pBody.map(() => 0.011)), -0.3 * ff);
    S('antihelix:groove-scapha', 'cavity', ribbon(off(pBody, wB + 0.014), pBody.map(() => 0.011)), -0.2 * ff);
    if (r.present.fossa) {
      const fd = g('fossa.depth'), fw = g('fossa.width');
      const f0 = [pt(B.x, B.y - 0.04), lerp2(B, U, 0.8), lerp2(B, Lw, 0.8)];
      const fc = pt((f0[0]!.x + f0[1]!.x + f0[2]!.x) / 3, (f0[0]!.y + f0[1]!.y + f0[2]!.y) / 3);
      // EAR-04 orientation (`tilt` : rotation du triangle autour de la jonction des branches, ±55°) et courbure des bords (`curvature` > 0 : côtés bombés, < 0 : côtés pincés).
      const f1 = rotAbout(f0.map((q) => pt(fc.x + (q.x - fc.x) * (1 + 0.55 * fw), fc.y + (q.y - fc.y) * (1 + 0.55 * fw))), B, 55 * g('fossa.tilt'));
      const fcv = g('fossa.curvature');
      const side = (i: number): Vec => { const a = f1[i] as Vec, b = f1[(i + 1) % 3] as Vec, m2 = lerp2(a, b, 0.5); return pt(m2.x + (m2.x - fc.x) * 2.2 * fcv, m2.y + (m2.y - fc.y) * 2.2 * fcv); };
      S('fossa', 'cavity', blobOf(fcv === 0 ? f1 : [f1[0] as Vec, side(0), f1[1] as Vec, side(1), f1[2] as Vec, side(2)]), -0.3 * ff * (1 + 2.2 * fd));
    }
  }
  // ── Crus de l'hélix + conque (cymba au-dessus, cavum au-dessous : 05A–05F) + ouverture du conduit.
  // EAR-05 conque : `volume` (homothétie de la cuvette + profondeur), `tilt` (inclinaison de la cuvette autour de l'entrée antérieure, ±16°), `transition` (cymba ↔ cavum : > 0 le crus s'abaisse et s'amincit, la conque devient une seule cuvette ; < 0 le crus devient une paroi).
  const cvol = g('concha.volume'), ctilt = g('concha.tilt'), ctran = g('concha.transition');
  const CPIV = pt(0.1, 0.5);
  const cxf = (poly: Poly): Poly => rotAbout(scaleAbout(poly, pt(0.3, 0.46), 1 + 0.2 * cvol, 1 + 0.13 * cvol), CPIV, 16 * ctilt);
  // La cymba reste SOUS-TENDUE par le crus (ordre vertical anatomique cymba < racine < cavum) : sa transformation pivote au niveau du crus, avec la moitié de l'inclinaison.
  const cxc = (poly: Poly): Poly => rotAbout(scaleAbout(poly, pt(0.3, vf), 1 + 0.2 * cvol, 1 + 0.13 * cvol), pt(0.1, vf), 8 * ctilt);
  const tc = Math.max(0.008, (0.028 + 0.034 * g('crus.thickness')) * (ctran > 0 ? 1 - 0.65 * ctran : 1 - 0.9 * ctran));
  const cl = 1 + 0.5 * g('crus.length'), ca = 0.11 * g('crus.angle');
  const crus = path([pt(0.02, vf), pt(0.19 * cl, vf + 0.012 + ca * 0.4), pt(0.44 * cl, vf + 0.035 + ca)]);
  S('crus', 'ridge', ribbon(crus, crus.map((_, k) => tc * (0.8 + 0.2 * Math.sin((Math.PI * k) / 8) - 0.45 * smooth(k / (crus.length - 1))))), Math.max(0.08, 0.55 * (ctran > 0 ? 1 - 0.8 * ctran : 1 - 0.7 * ctran)));
  // EAR-05 transition > 0 : pont — le crus est recouvert d'un creux continu, la cymba et le cavum ne forment plus qu'une cuvette.
  if (ctran > 0.08) out.push({ id: 'concha:bridge', kind: 'cavity', poly: cxc(ribbon(crus, crus.map(() => 0.012 + 0.05 * ctran))), relief: Math.max(0.08, 0.55 * (1 - 0.8 * ctran)) + 0.004, strength: Math.min(1, ctran) });
  const cym = Math.max(0.006, 0.05 * (1 + 1.25 * g('concha.cymba')));
  S('cymba', 'cavity', cxc(blobOf([pt(0.12, vf - cym), pt(0.32, vf - cym - 0.005), pt(0.52, vf - cym * 0.6), pt(0.54, vf + 0.005), pt(0.22, vf - 0.005), pt(0.12, vf - 0.01)])), -0.5 * (0.5 + 0.5 * ff));
  // Épaisseur de paroi (strict) : profondeur de la conque ≤ épaisseur − paroi minimale.
  const dReq = 0.032 * (1 + 0.6 * g('concha.depth') + 0.4 * cvol);
  const dMax = thickness - 0.012;
  const depth = Math.min(dReq, dMax);
  if (depth < dReq - 1e-9) corr.push({ id: 'concha-wall', param: 'concha.depth', requested: dReq, applied: depth, reason: 'la profondeur de la conque garde une paroi minimale (la cavité ne traverse pas le pavillon)', tier: 'strict' });
  const cav = cxf(blobOf([pt(0.09, vf + 0.05), pt(0.32, vf + 0.05), pt(0.5, vf + 0.08), pt(0.58, 0.5), pt(0.54, 0.62), pt(0.4, 0.67), pt(0.2, 0.655), pt(0.08, 0.585)]));
  const wall = g('concha.wall');
  S('cavum', 'cavity', cav, -(depth / thickness) * 0.95 * (1 + 0.35 * Math.min(0, wall)));
  // 05C–05E : rebord de conque (arête qui borde le cavum et masque une part du fond) et paroi postérieure ombrée, distincts de la cavité.
  if (wall > 0.02) {
    const rimW = cav.map(() => 0.008 + 0.014 * wall);
    S('concha:rim', 'ridge', ribbon([...cav, cav[0] as Vec], [...rimW, rimW[0] as number]), 0.3 + 0.35 * wall);
    S('concha:wall', 'cavity', ribbon(cav.slice(2, 6), [0.02 + 0.03 * wall, 0.03 + 0.04 * wall, 0.03 + 0.04 * wall, 0.02 + 0.03 * wall]), -0.55 - 0.3 * wall);
  }
  const cy = vf + 0.045 + 0.55 * (0.6 - (vf + 0.045));
  const canal = rotAbout([pt(0.22, cy)], CPIV, 16 * ctilt)[0] as Vec;
  S('canal', 'cavity', ellipse(canal, 0.04, 0.052), -1);
  // ── Tragus, antitragus, incisure intertragique (EAR-06).
  const ts = 1 + 0.55 * g('tragus.size'), tt = g('tragus.tip');
  const tragus = pt(0.07 - 0.03 * g('tragus.projection'), 0.5);
  if (r.present.tragus) {
    const th = g('tragus.thickness');
    const base = ellipse(tragus, 0.095 * ts, 0.08 * ts * (1 + 0.22 * th), -20);
    // Pointe du tragus : le sommet côté conduit s'étire (tt > 0 : pointu) ou s'aplatit (tt < 0 : tronqué).
    const tp = tt === 0 ? base : base.map((q) => { const dx = q.x - tragus.x, dy = q.y - tragus.y; const c = dx / (Math.hypot(dx, dy) || 1); const k = 1 + (c > 0 ? 1.5 * tt * c ** 3 : 0); return pt(tragus.x + dx * k, tragus.y + dy * (tt > 0 ? 1 - 0.25 * tt * Math.max(0, c) : 1)); });
    S('tragus', 'blob', tp, Math.max(0.2, 0.7 * (1 + 0.45 * th)));
  }
  const as = 1 + 0.6 * g('antitragus.size');
  if (r.present.antitragus) S('antitragus', 'blob', ellipse(pt(0.4, 0.695), 0.1 * as, 0.052 * as, 20 + 65 * g('antitragus.orientation')), 0.55);
  {
    // L'incisure suit le bord antérieur : si ce bord recule (oreille étroite, conque creuse), on la décale vers le centre jusqu'à ce qu'elle reste dans le pavillon.
    let nx = 0.13; const nry = 0.03 * (1 + g('notch.depth'));
    while (nx < 0.3 && insideShare(ellipse(pt(nx, 0.615), 0.032, nry), outline) < 0.75) nx += 0.015;
    S('notch', 'cavity', ellipse(pt(nx, 0.615), 0.032, nry), -0.6 * (0.5 + 0.5 * ff));
  }
  // ── Lobule (EAR-07) : sans cartilage (relief doux), du début du bord inférieur à la jonction avec la joue.
  if (r.present.lobule) S('lobule', 'blob', outline.slice(ctrlIdx.lobuleStart * OUTLINE_N, ctrlIdx.lobuleEnd * OUTLINE_N + 1), Math.max(0.05, 0.25 * (1 + 0.9 * g('lobule.volume'))));
  // ── Variantes anatomiques ajoutées (0 = absentes) : tubercule de Darwin, hélix replié, lobule étiré (trou + boucle de peau).
  const dwn = Math.max(0, g('helix.darwin'));
  if (dwn > 0.05) {
    const c0 = 4 * OUTLINE_N, sub = span(outline.length, c0 - 5, c0 + 6);
    S('darwin', 'blob', band(outline, sub, sub.map(() => 0.016), sub.map((_, j) => 0.016 + (0.05 + 0.08 * dwn) * Math.sin((Math.PI * (j + 0.5)) / sub.length))), 0.95 + 0.4 * dwn);
  }
  if (fold > 0.05) {
    // Pli de l'hélix replié : un sillon d'ombre le long du bord intérieur de la partie épaissie (le rebord se recourbe vers l'avant et recouvre une part de la scapha).
    const top = idx.filter((_, k) => k > idx.length * 0.1 && k < idx.length * 0.52);
    S('helix:fold', 'cavity', ribbon(inset(outline, top, top.map((i) => (wH[idx.indexOf(i)] as number) + 0.004)), top.map((_, k) => 0.008 + 0.012 * fold * Math.sin((Math.PI * (k + 0.5)) / top.length))), -0.55 - 0.3 * fold);
  }
  const stretch = Math.max(0, g('lobule.stretch'));
  if (r.present.lobule && stretch > 0.25) {
    const lb = outline[ctrlIdx.bottom * OUTLINE_N] as Vec;
    S('lobule:hole', 'cavity', ellipse(pt(lb.x, lb.y - 0.11 - 0.03 * stretch), 0.03 + 0.03 * stretch, 0.04 + 0.04 * stretch), -0.95);
  }
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
  const landmarks: Record<string, Vec> = { crus: pt(0.02, vf), lobuleBottom: lowest(outline, ctrlIdx.lobuleStart * OUTLINE_N, ctrlIdx.lobuleEnd * OUTLINE_N, outline[ctrlIdx.bottom * OUTLINE_N] as Vec, g('lobule.cleft') > 0.02), top: outline[ctrlIdx.peak * OUTLINE_N] as Vec, tragus, canal, junction: B, upperEnd: U, lowerEnd: Lw, antitragus: pt(0.4, 0.695) };
  const lobeC = pt((outline[ctrlIdx.bottom * OUTLINE_N] as Vec).x, (outline[ctrlIdx.bottom * OUTLINE_N] as Vec).y - 0.07);
  const hx = outline[idx[Math.round(idx.length * 0.12)] as number] as Vec;
  const anchors: PiercingAnchor[] = [
    { kind: 'ear_lobe_piercing', at: lobeC, angleDeg: 90, compatible: r.present.lobule && g('lobule.length') > -0.6 },
    { kind: 'helix_piercing', at: pt(hx.x + 0.03, hx.y + 0.02), angleDeg: 135, compatible: true },
    { kind: 'tragus_piercing', at: tragus, angleDeg: 180, compatible: r.present.tragus },
    { kind: 'conch_piercing', at: pt(0.36, (vf + 0.05 + 0.6) / 2), angleDeg: 90, compatible: true },
    { kind: 'industrial_piercing', at: pt(hx.x + 0.04, hx.y + 0.06), end: at(U, pt(0.12, -0.05), 1), angleDeg: 20, compatible: r.present.antihelix },
  ];
  return { structures: out, landmarks, anchors, thickness, corrections: corr };
}
