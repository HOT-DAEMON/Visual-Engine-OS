/**
 * AJUSTEMENT DU MODÈLE DE TÊTE SUR LA PLANCHE DE ROTATION — lit `references/face/rotation_head.measures.json` (produit par
 * `measure-rotation.py`) et écrit `src/head-turntable/ref-fit.ts` : table de sections du crâne/mâchoire + constantes de repères.
 *
 * Méthode (enveloppe visuelle à sections elliptiques) : la demi-largeur a(y) vient de la vue de FACE (0° et 180° moyennées), l'avant
 * zf(y) et l'arrière zb(y) viennent de la vue de PROFIL (90°). Les hauteurs de l'image sont ramenées à la tête à plat (y = t / cos b,
 * b = tangage de caméra ajusté). Trois retraitements, tous écrits ici : (1) le nez et les lèvres sont retirés du profil de face (ils sont
 * des solides à part) ; (2) les oreilles sont retirées de la largeur (idem) ; (3) le bas du menton, caché derrière le cou sur la
 * planche, est une courbe ANNOTÉE (constante `CHIN_TAIL`), pas mesurée.
 * Usage : npx tsx scripts/head-turntable/fit-rotation.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';

interface Prof { t: number; left: number | null; right: number | null }
const m = JSON.parse(readFileSync('references/face/rotation_head.measures.json', 'utf8'));
const b: number = m.rigid_fit.pitch_deg;
const cb = Math.cos((b * Math.PI) / 180);
const prof = (yaw: string): Prof[] => m.views[yaw].silhouette;

/** Interpolation linéaire d'un bord de silhouette à la hauteur d'image t. */
function edge(yaw: string, t: number, side: 'left' | 'right'): number {
  const p = prof(yaw).filter((q) => q[side] !== null);
  const tt = Math.min(Math.max(t, p[0]!.t), p[p.length - 1]!.t);
  for (let i = 0; i + 1 < p.length; i++) {
    const a = p[i]!, c = p[i + 1]!;
    if (tt >= a.t && tt <= c.t) { const u = (tt - a.t) / (c.t - a.t || 1); return (a[side] as number) + ((c[side] as number) - (a[side] as number)) * u; }
  }
  return p[p.length - 1]![side] as number;
}
/** Demi-largeur de face à la hauteur d'image t (moyenne 0° / 180°, gauche / droite). */
const halfW = (t: number): number => (edge('0', t, 'right') - edge('0', t, 'left') + edge('180', t, 'right') - edge('180', t, 'left')) / 4;
const lerp = (a: number, c: number, u: number): number => a + (c - a) * u;

const EAR_BAND: [number, number] = [0.475, 0.8];          // hauteurs d'image où les oreilles élargissent la silhouette de face
const NOSE_BAND_Y: [number, number] = [0.66, 0.9];        // hauteurs vraies où nez et lèvres sortent du profil
// ANNOTÉ (relevé sur le profil 90° et la vue 0°, grille de 10 px) : le bas de la mâchoire est caché par le cou dans la silhouette ;
// [y, demi-largeur a, face arrière zb]. Le dessous de la mâchoire monte en diagonale du menton (y = 1,05 ; z = 0,37) vers l'angle de
// la mâchoire (y = 0,79 ; z = 0,09) : zb remplace donc l'arrière du cou.
const JAW: [number, number, number][] = [[0.85, 0.248, 0.06], [0.9, 0.21, 0.2], [0.95, 0.185, 0.29], [1.0, 0.15, 0.335], [1.025, 0.105, 0.34], [1.04, 0.055, 0.335], [1.05, 0.0, 0.33]];
const ys = [0, 0.025, 0.05, 0.075, 0.1, 0.125, 0.15, ...Array.from({ length: 17 }, (_, i) => Math.round((0.2 + i * 0.05) * 1000) / 1000), 1.025, 1.04, 1.05];

const zfRaw = (y: number): number => -edge('90', y * cb, 'left');
const raw = ys.map((y) => {
  const t = y * cb;
  let zf = zfRaw(y);
  if (y > NOSE_BAND_Y[0] && y < NOSE_BAND_Y[1]) zf = lerp(zfRaw(NOSE_BAND_Y[0]), zfRaw(NOSE_BAND_Y[1]), (y - NOSE_BAND_Y[0]) / (NOSE_BAND_Y[1] - NOSE_BAND_Y[0]));
  let zb = -edge('90', t, 'right');
  let a = halfW(t);
  if (t > EAR_BAND[0] && t < EAR_BAND[1]) { const u = (t - EAR_BAND[0]) / (EAR_BAND[1] - EAR_BAND[0]), sm = u * u * (3 - 2 * u); a = lerp(halfW(EAR_BAND[0]), halfW(EAR_BAND[1]), sm); }
  const jaw = JAW.find(([jy]) => Math.abs(jy - y) < 1e-6);
  if (jaw) { a = jaw[1]; zb = jaw[2]; }
  if (y === 0) { a = 0; zf = zb = (zf + zb) / 2; }           // sommet : pointe fermée (le plat mesuré à y = 0 n'est que l'épaisseur du trait)
  return { y, a, zf, zb, fixed: !!jaw || y === 0 };
});
// Lissage [1 2 1]/4 (2 passes) des colonnes a, zf, zb : les silhouettes mesurées sont quantifiées au pixel (0,0067 U), sans lissage la
// surface hérite de ce bruit (contours ondulés). Les rangées ANNOTÉES (mâchoire, sommet) et les deux dernières ne sont pas lissées.
const rows = raw.map((r) => ({ ...r }));
for (let pass = 0; pass < 2; pass++) {
  const prev = rows.map((r) => ({ a: r.a, zf: r.zf, zb: r.zb }));
  for (let i = 1; i < rows.length - 1; i++) {
    const r = rows[i]!;
    if (r.fixed || r.y > 0.8) continue;
    for (const k of ['a', 'zf', 'zb'] as const) r[k] = (prev[i - 1]![k] + 2 * prev[i]![k] + prev[i + 1]![k]) / 4;
  }
}
for (const r of rows) { r.a = +r.a.toFixed(3); r.zf = +r.zf.toFixed(3); r.zb = +r.zb.toFixed(3); }

// Bout du nez : point le plus avancé du profil de 90° entre y = 0,6 et 0,8 (hauteur d'image).
let tip = { t: 0, z: 0 };
for (const p of prof('90')) if (p.left !== null && p.t >= 0.6 && p.t <= 0.8 && -p.left > tip.z) tip = { t: p.t, z: -p.left };
const f = m.rigid_fit;
const out = `/* GÉNÉRÉ par scripts/head-turntable/fit-rotation.ts à partir de references/face/rotation_head.measures.json — ne pas modifier à la main. */
import type { Row } from './types';

/** Tangage de caméra ajusté sur les 9 vues (degrés) et résidus de l'ajustement rigide (unités U ; 1 U = 150 px de la planche). */
export const REF_PITCH = ${f.pitch_deg};
export const REF_RESIDUAL = { eye: ${f.eye.rms_H}, mouth: ${f.mouth.rms_H}, observations: ${f.n_observations} } as const;

/** Repères ajustés (tête à plat) : yeux, bouche, bout du nez (profondeur z = avancée max. du profil de 90°). */
export const REF_FIT = {
  eye: { x: ${f.eye.x}, y: ${f.eye.y}, z: ${f.eye.z} },
  mouth: { y: ${f.mouth.y}, z: ${f.mouth.z} },
  noseTip: { y: ${(tip.t / cb).toFixed(4)}, z: ${tip.z.toFixed(4)} },
} as const;

/** Table de sections (y, a, zf, zb), pas de 0,05 U (0,025 aux extrémités) : sommet → bas du menton. */
export const REF_ROWS: readonly Row[] = [
${rows.map((r) => `  { y: ${r.y}, a: ${r.a}, zf: ${r.zf}, zb: ${r.zb} },`).join('\n')}
];
`;
writeFileSync('src/head-turntable/ref-fit.ts', out);
console.log(`ref-fit.ts écrit : ${rows.length} sections, tangage ${b}°, nez z=${tip.z} y=${(tip.t / cb).toFixed(3)}`);
console.table(rows);
