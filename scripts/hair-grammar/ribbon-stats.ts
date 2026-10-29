import { readFileSync, writeFileSync } from 'node:fs';
import { ribbonLength, type Ribbon, type RibbonProfile } from '../../src/hair-grammar/ribbon';

/** Statistiques de rubans de cheveux par cellule, en hauteurs de tête H (comparables d'une cellule à l'autre) — matière première d'une grammaire GÉNÉRIQUE.
 *  Usage : `npx tsx scripts/hair-grammar/ribbon-stats.ts <sortie.json> id=profil.json ...` */
const [OUT, ...ARGS] = process.argv.slice(2) as [string, ...string[]];
const q = (a: number[], p: number): number => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))] as number; };
const r3 = (v: number): number => Math.round(v * 1000) / 1000;
/** Angle de la corde (degrés, 0 = vers la droite, 90 = vers le bas), axial : un ruban n'a pas de sens. */
const chord = (r: Ribbon): number => { const a = r.p[0] as readonly number[]; const b = r.p[r.p.length - 1] as readonly number[]; return Math.atan2((b[1] as number) - (a[1] as number), (b[0] as number) - (a[0] as number)); };
/** Courbure moyenne : somme des virages absolus (rad) par unité de longueur (rad/H). */
function curvature(r: Ribbon): number {
  let t = 0; for (let i = 2; i < r.p.length; i++) { const a = r.p[i - 2] as readonly number[]; const b = r.p[i - 1] as readonly number[]; const c = r.p[i] as readonly number[];
    let d = Math.atan2((c[1] as number) - (b[1] as number), (c[0] as number) - (b[0] as number)) - Math.atan2((b[1] as number) - (a[1] as number), (b[0] as number) - (a[0] as number)); while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; t += Math.abs(d); }
  return t / Math.max(1e-6, ribbonLength(r));
}
const res: Record<string, unknown> = {};
for (const arg of ARGS) {
  const [id, path] = arg.split('=') as [string, string]; const P = JSON.parse(readFileSync(path, 'utf8')) as RibbonProfile;
  const hair = P.ribbons.filter((r) => r.role === 'hair' && r.p.length >= 2);
  const len = hair.map(ribbonLength); const wid = hair.map((r) => r.p.reduce((s, p) => s + p[2], 0) / r.p.length); const cur = hair.map(curvature);
  // direction dominante (axiale, pondérée par la longueur) et dispersion : R = 1 → toutes parallèles, 0 → isotrope
  let cs = 0; let sn = 0; let tot = 0; hair.forEach((r, i) => { const a = chord(r) * 2; const l = len[i] as number; cs += Math.cos(a) * l; sn += Math.sin(a) * l; tot += l; });
  const R = Math.hypot(cs, sn) / Math.max(1e-9, tot); let dom = (Math.atan2(sn, cs) / 2) * 180 / Math.PI; if (dom < 0) dom += 180;
  const solidsHair = P.solids.filter((s) => s.role === 'hair').length;
  res[id] = { rubansCheveux: hair.length, masseSolidesCheveux: solidsHair, longueurH: { p10: r3(q(len, 0.1)), mediane: r3(q(len, 0.5)), p90: r3(q(len, 0.9)), max: r3(Math.max(...len)) }, largeurMoyenneH: { mediane: r3(q(wid, 0.5)), p90: r3(q(wid, 0.9)) },
    courbureRadParH: { mediane: r3(q(cur, 0.5)), p90: r3(q(cur, 0.9)) }, directionDominanteDeg: Math.round(dom), alignementR: r3(R), rapportLongLarg: r3(q(hair.map((_, i) => (len[i] as number) / Math.max(1e-6, wid[i] as number)), 0.5)), repereTete: P.landmarks ?? null, unite_px: P.frame.unit };
}
writeFileSync(OUT, JSON.stringify(res, null, 2)); console.log(JSON.stringify(res));
