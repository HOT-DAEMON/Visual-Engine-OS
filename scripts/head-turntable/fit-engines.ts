/**
 * AJUSTEMENT DES MOTEURS EXISTANTS SUR LA PLANCHE DE ROTATION.
 *   npx tsx scripts/head-turntable/fit-engines.ts            → écrit src/head-turntable/engines/engine-fit.ts (généré) et artefacts/head-turntable-engines/fit_report.json
 * Bornes : celles du schéma, RESSERRÉES à des plages anatomiquement plausibles (une bascule d'un paramètre sur sa borne = forme caricaturale ; le rapport signale les paramètres à moins de 3 % d'une borne).
 * Entrées : `REF_ROWS` / `REF_FIT` (mesures de `references/face/rotation_head.jpg`, voir fit-rotation.ts). Sorties : paramètres de FaceParams / SkullParams,
 * zPorion, inclinaison du ramus, épaisseur de la coupe de cheveux. Méthode : Nelder-Mead sur des paramètres normalisés dans leurs bornes de schéma.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { engineHead } from '../../src/head-turntable/engines/face-model';
import { engineRows } from '../../src/head-turntable/engines/rows';
import { skinPoints } from '../../src/head-turntable/engines/profile';
import { PX, fx, fy, spy } from '../../src/head-turntable/engines/units';
import type { EngineFit } from '../../src/head-turntable/engines/engine-fit';
import { FIXED_FACE, FIXED_SKULL } from '../../src/head-turntable/engines/engine-fixed';
import { REF_FIT, REF_ROWS } from '../../src/head-turntable/ref-fit';

interface P { path: string; kind: 'face' | 'skull' | 'top'; lo: number; hi: number; x0: number }
const T: P[] = [
  { path: 'templeY', kind: 'face', lo: 0.32, hi: 0.47, x0: 0.4 }, { path: 'jawY', kind: 'face', lo: 0.68, hi: 0.84, x0: 0.74 },
  { path: 'jawWidth', kind: 'face', lo: 0.55, hi: 0.95, x0: 0.72 }, { path: 'chinWidth', kind: 'face', lo: 0.12, hi: 0.45, x0: 0.3 },
  { path: 'jaw.angle', kind: 'face', lo: 0.3, hi: 0.9, x0: 0.6 }, { path: 'jaw.taper', kind: 'face', lo: 0.1, hi: 0.95, x0: 0.55 },
  { path: 'chin.height', kind: 'face', lo: 0.1, hi: 0.2, x0: 0.15 }, { path: 'chin.projection', kind: 'face', lo: 0, hi: 1, x0: 0.35 }, { path: 'chin.form', kind: 'face', lo: 0, hi: 1, x0: 0.4 }, { path: 'chin.symphysisWidth', kind: 'face', lo: 0.2, hi: 1, x0: 0.6 },
  { path: 'nose.length', kind: 'face', lo: 0.12, hi: 0.22, x0: 0.171 }, { path: 'nose.tip.projection', kind: 'face', lo: 0, hi: 1, x0: 0.5 },
  { path: 'nose.tip.rotation', kind: 'face', lo: -0.5, hi: 0.9, x0: 0.5 }, { path: 'mouth.y', kind: 'face', lo: 0.72, hi: 0.86, x0: 0.79 },
  { path: 'mouth.upperLip', kind: 'face', lo: 0.1, hi: 0.7, x0: 0.4 }, { path: 'mouth.lowerLip', kind: 'face', lo: 0.2, hi: 0.75, x0: 0.55 },
  { path: 'eyeLine', kind: 'face', lo: 0.55, hi: 0.58, x0: 0.579 }, { path: 'eyeGap', kind: 'face', lo: 0.16, hi: 0.28, x0: 0.22 },
  { path: 'length', kind: 'skull', lo: -1, hi: 1, x0: 0 }, { path: 'vaultHeight', kind: 'skull', lo: 0.15, hi: 0.85, x0: 0.5 },
  { path: 'vaultPeak', kind: 'skull', lo: 0, hi: 1, x0: 0.45 }, { path: 'foreheadSlope', kind: 'skull', lo: 0, hi: 1, x0: 0.35 },
  { path: 'frontalBulge', kind: 'skull', lo: 0.1, hi: 0.9, x0: 0.5 }, { path: 'occiput', kind: 'skull', lo: 0.1, hi: 0.9, x0: 0.5 },
  { path: 'maxilla', kind: 'skull', lo: -0.6, hi: 0.6, x0: 0 }, { path: 'W', kind: 'top', lo: 700, hi: 840, x0: 766 },
  { path: 'neckTilt', kind: 'skull', lo: 0.1, hi: 0.9, x0: 0.4 }, { path: 'neckDepth', kind: 'skull', lo: 0, hi: 1, x0: 0.45 }, { path: 'neck.width', kind: 'face', lo: 0.25, hi: 0.6, x0: 0.375 }, { path: 'neckScale', kind: 'top', lo: 0.6, hi: 1.1, x0: 0.85 }, { path: 'mandArc', kind: 'top', lo: 0, hi: 3, x0: 0.8 },
  { path: 'zPorion', kind: 'top', lo: -0.1, hi: 0.2, x0: 0.04 }, { path: 'ramusDeg', kind: 'top', lo: 0, hi: 30, x0: 12 },
  { path: 'hairTh', kind: 'top', lo: 0, hi: 0.05, x0: 0.02 },
];

const setPath = (o: Record<string, unknown>, path: string, v: number): void => { const k = path.split('.'); let c = o; for (let i = 0; i < k.length - 1; i++) { c[k[i]!] = { ...((c[k[i]!] as object) ?? {}) }; c = c[k[i]!] as Record<string, unknown>; } c[k[k.length - 1]!] = v; };
function build(x: number[]): EngineFit & { hairTh: number } {
  const face: Record<string, unknown> = JSON.parse(JSON.stringify(FIXED_FACE)), skull: Record<string, unknown> = { ...FIXED_SKULL }; const top: Record<string, number> = {};
  T.forEach((p, i) => { const v = p.lo + Math.min(1, Math.max(0, x[i]!)) * (p.hi - p.lo); if (p.kind === 'face') setPath(face, p.path, v); else if (p.kind === 'skull') skull[p.path] = v; else top[p.path] = v; });
  return { face, skull, W: top.W!, zPorion: top.zPorion!, ramusDeg: top.ramusDeg!, neckZ: 0.04, hairTh: top.hairTh!, neckScale: top.neckScale!, mandArc: top.mandArc! };
}

export interface Terms { rows: number; landmarks: number; total: number }
function cost(f: ReturnType<typeof build>): Terms {
  let e; try { e = engineHead(f); } catch { return { rows: 1e3, landmarks: 1e3, total: 2e3 }; }
  const R = engineRows(e, REF_ROWS.map((r) => r.y), f.hairTh);
  let rows = 0, w = 0;
  REF_ROWS.forEach((m, i) => {
    const r = R[i]!; if (m.y < 0.05) return;
    const wa = m.y >= 0.95 && m.y < 1.05 ? 2 : 1, wf = m.y <= 1.0 ? 1 : 0.3, wb = m.y <= 0.9 ? 1.5 : 0.25;   // dessous de mâchoire annoté (caché par le cou) : poids faible
    rows += wa * (r.a - m.a) ** 2 + wf * (r.zf - m.zf) ** 2 + wb * (r.zb - m.zb) ** 2; w += wa + wf + wb;
  });
  rows /= w;
  const P = skinPoints(e), cav = e.mouth.cavity.length ? e.mouth.cavity.reduce((s, q) => s + q.y, 0) / e.mouth.cavity.length : e.lm.mouthY;
  const lm = 4 * (fy(e.lm.eyeY) - REF_FIT.eye.y) ** 2 + 4 * (fx(e.lm.innerCanthus.right.x) - (REF_FIT.eye.x - 0.085)) ** 2 + 2 * (fy(e.lm.noseBaseY) - 0.8) ** 2
    + 3 * ((P.get('pronasale')!.y - REF_FIT.noseTip.y) ** 2 + (P.get('pronasale')!.z - REF_FIT.noseTip.z) ** 2) + 2 * (fy(cav) - REF_FIT.mouth.y) ** 2 + 4 * (fy(e.lm.outline.bottomY) - 1.05) ** 2;
  // Cou : demi-largeur 0,143 U [mesuré 0°/180°] ; dos du cou = bord droit de la silhouette à 90° (z = −0,100 à y = 0,9 ; −0,107 à 1,0 ; −0,127 à 1,05) [mesuré] ;
  // dos à y = 1,2 (−0,213) et face antérieure (0,15 à y = 1,1 ; 0,133 à y = 1,2) lus sur la vue de 90° sous le menton [annotés, ±0,02].
  const nk = e.sk.neck, ns = f.neckScale, zz = (x: number, y: number): number => e.fit.zPorion + ((nk.xBack(y) + nk.xFront(y)) / 2 + ((x - (nk.xBack(y) + nk.xFront(y)) / 2) * ns)) * PX;
  const bk = (yU: number, z: number, w = 1): number => w * (zz(nk.xBack(spy(yU)), spy(yU)) - z) ** 2, fr = (yU: number, z: number): number => (zz(nk.xFront(spy(yU)), spy(yU)) - z) ** 2;
  const neck = 4 * (e.lm.neck.half * PX - 0.143) ** 2 + bk(0.9, -0.1, 3) + bk(1.0, -0.107, 3) + bk(1.05, -0.127, 3) + bk(1.2, -0.213) + fr(1.1, 0.15) + fr(1.2, 0.133);
  return { rows, landmarks: lm + neck, total: rows + lm + neck };
}

function nelderMead(f: (x: number[]) => number, x0: number[], iters: number, step = 0.12): number[] {
  const n = x0.length; let S = [x0, ...x0.map((_, i) => x0.map((v, j) => (j === i ? Math.min(1, v + step) : v)))].map((x) => ({ x, v: f(x) }));
  for (let it = 0; it < iters; it++) {
    S.sort((a, b) => a.v - b.v); const c = x0.map((_, j) => S.slice(0, n).reduce((s, p) => s + p.x[j]!, 0) / n), w = S[n]!;
    const at = (t: number): number[] => c.map((v, j) => Math.min(1, Math.max(0, v + t * (w.x[j]! - v)))), r = at(-1), fr = f(r);
    if (fr < S[0]!.v) { const e = at(-2), fe = f(e); S[n] = fe < fr ? { x: e, v: fe } : { x: r, v: fr }; }
    else if (fr < S[n - 1]!.v) S[n] = { x: r, v: fr };
    else { const k = at(fr < w.v ? -0.5 : 0.5), fk = f(k); if (fk < Math.min(fr, w.v)) S[n] = { x: k, v: fk }; else { const b = S[0]!; S = S.map((p, i) => (i === 0 ? p : (() => { const x = p.x.map((v, j) => b.x[j]! + 0.5 * (v - b.x[j]!)); return { x, v: f(x) }; })())); } }
  }
  return S.sort((a, b) => a.v - b.v)[0]!.x;
}

const norm0 = T.map((p) => (p.x0 - p.lo) / (p.hi - p.lo));
const before = cost(build(norm0));
let x = norm0;
for (let round = 0; round < 10; round++) x = nelderMead((v) => cost(build(v)).total, x, 500, 0.12 / (1 + (round % 3)));
const best = build(x), after = cost(best);
const e = engineHead(best), R = engineRows(e, REF_ROWS.map((r) => r.y), best.hairTh);
const rms = (k: 'a' | 'zf' | 'zb', y1 = 0.9): number => Math.sqrt(REF_ROWS.filter((m) => m.y >= 0.05 && m.y <= y1).reduce((s, m) => s + (R[REF_ROWS.indexOf(m)]![k] - m[k]) ** 2, 0) / REF_ROWS.filter((m) => m.y >= 0.05 && m.y <= y1).length);
const atBound = T.filter((_p, i) => x[i]! < 0.03 || x[i]! > 0.97).map((p) => p.path);
const report = { before, after, atBound, rmsU: { a: rms('a'), zf: rms('zf'), zb: rms('zb', 0.75) }, params: Object.fromEntries(T.map((p, i) => [p.path, +(p.lo + x[i]! * (p.hi - p.lo)).toFixed(4)])) };
console.log(JSON.stringify(report, null, 1));
mkdirSync('artefacts/head-turntable-engines', { recursive: true });
writeFileSync('artefacts/head-turntable-engines/fit_report.json', JSON.stringify({ ...report, rows: REF_ROWS.map((m, i) => ({ y: m.y, meas: m, engine: R[i] })) }, null, 1));
const { hairTh, neckScale, mandArc, ...fit } = best;
writeFileSync('src/head-turntable/engines/engine-fit.ts', `/* GÉNÉRÉ par scripts/head-turntable/fit-engines.ts — ne pas modifier à la main (les paramètres non ajustés viennent de engine-fixed.ts). */
/** Paramètres des moteurs existants recalés sur la planche (références/face/rotation_head.jpg). Résidus : voir artefacts/head-turntable-engines/fit_report.json. */
export interface EngineFit {
  readonly face: Readonly<Record<string, unknown>>;
  readonly skull: Readonly<Record<string, unknown>>;
  /** Largeur du crâne (px = 0,001 U). [ajusté] */
  readonly W: number;
  /** z (U) du porion = origine du repère de profil des moteurs. [ajusté] */
  readonly zPorion: number;
  /** Inclinaison du ramus (°) : plan mandibulaire = angle gonial − 90° − ramus. [ajusté] */
  readonly ramusDeg: number;
  /** z de l'axe du cou (U) = pivot de rotation. [mesuré] */
  readonly neckZ: number;
  /** Épaisseur de la coupe de cheveux sur le crâne (U). [ajusté] */
  readonly hairTh: number;
  /** Facteur sur la demi-profondeur du cou du moteur (sa borne basse, 0,34 H, dépasse le cou de la planche). [ajusté] */
  readonly neckScale: number;
  /** Courbure du dessous de la mandibule (z −= κ·d², d = distance au bas du menton en U) : le corps de la mandibule est un arc, pas une droite. [ajusté] */
  readonly mandArc: number;
}
export const ENGINE_FIT: EngineFit = ${JSON.stringify({ ...fit, hairTh, neckScale, mandArc }, null, 2)};
`);
