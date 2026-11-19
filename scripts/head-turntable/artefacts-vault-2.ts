import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { encodePngRgba } from '../../src/core/png';
import { generateRandomProfile } from '../../src/generation/random-skull';
import { renderProfile } from '../../src/skull';
import { skullGeometry } from '../../src/skull/geometry';
import { SkullParams } from '../../src/skull/types';
import { VAULT_STRUCTURES } from '../../src/skull/vault-registry';
import { vaultRender, vaultSpec, VAULT_VIEWS, type VaultViewId } from '../../src/head-turntable/vault-lab';
import { place } from '../../src/head-turntable/vault-visibility';
import { vaultReport } from '../../src/head-turntable/verify-vault';
import type { TurnRender } from '../../src/head-turntable/types';
import { FAMILIES } from './vault-boards';

/**
 * Preuves visuelles de la PASSE 2 de la voûte (`docs/SKULL-VAULT-2.md`) : tête complète avant / après, gros plans centrés sur les ANCRES DU REGISTRE (là où la structure est déclarée, pas à l'œil),
 * profil 2D (contours min / nominal / max), ancre pariétale qui suit l'éminence, cheveux posés sur le même relief. Vignettes + json ; `compose-vault-2.py` assemble les planches.
 * Usage : tsx artefacts-vault-2.ts <dossier> [hauteurPx, défaut 420]. Même graine (3), même caméra, même éclairage que la passe 1.
 */
const out = process.argv[2] ?? '/tmp/vault2', H = Number(process.argv[3] ?? 420), VIEWS = Object.keys(VAULT_VIEWS) as VaultViewId[];
const T = (...p: string[]): string => join(out, 'tiles', ...p);
const png = (path: string, w: number, h: number, rgba: Uint8Array | Uint8ClampedArray): void => { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, encodePngRgba(w, h, rgba as Uint8Array)); };
const json = (rel: string, v: unknown): void => { const f = join(out, 'verification', rel); mkdirSync(join(f, '..'), { recursive: true }); writeFileSync(f, JSON.stringify(v, null, 1)); };
const fam = (id: string) => FAMILIES.find((f) => f.id === id)!;
// Reprise : `FROM=<n>` saute les sections < n (les vignettes déjà écrites sont conservées).
const FROM = Number(process.env.FROM ?? 1), COMP_JSON = join(out, 'verification', 'composites.json');
const COMPOSITES = ['arcade-torus', 'front-bosses', 'dolicho-chignon', 'muscle-temporal', 'asym-fine'] as const;

// 1. Tête complète AVANT (nominal) / APRÈS (famille de la passe 2), chauve et coiffée, 6 vues. Toutes les valeurs : `verification/composites.json`.
const rep: Record<string, unknown> = FROM > 1 && existsSync(COMP_JSON) ? JSON.parse(readFileSync(COMP_JSON, 'utf-8')) : {};
for (const id of COMPOSITES) {
  if (FROM > 1) break;
  const ov = fam(id).ov;
  for (const [name, spec] of [['avant', vaultSpec({}, 3, true)], ['apres', vaultSpec(ov, 3, true)], ['apres-cheveux', vaultSpec(ov, 3, false)]] as const) for (const v of VIEWS) { const r = vaultRender(spec, v, H); png(T('tete', `${id}_${name}_${v}.png`), r.w, r.h, r.rgba); }
  rep[id] = { label: fam(id).label, overrides: ov, nouveauxControles: vaultReport(vaultSpec(ov, 3, true)).flatMap((l) => l.checks.filter((c) => /vault\.(geo\.symmetry|anat\.(arch|eminence|bun|line|parietal\.anchor|visible\.front)|style\.(silhouette\.back|relief))/.test(c.id)).map((c) => ({ id: c.id, value: c.value, min: c.min, max: c.max, ok: c.ok }))) };
  console.log('tête', id);
}
if (FROM <= 1) json('composites.json', rep);

// 2. Gros plans : fenêtre de 0,62 × 0,5 U centrée sur l'ANCRE du registre de la structure (position locale → globale → pixel, `place`), à 800 px de haut ; min / nominal / max.
const ZOOM: readonly { id: string; key: string; vals: [number, number, number]; view: VaultViewId; struct: string; side: -1 | 0 | 1; base?: object }[] = [
  { id: 'frontalEminence', key: 'frontalEminence', vals: [-1, 0, 1], view: 'trois_quarts', struct: 'frontal-eminence', side: 1 },
  { id: 'browArch-3-4', key: 'browArch', vals: [-1, 0, 1], view: 'trois_quarts', struct: 'supraorbital-arch', side: 1 },
  { id: 'browArch-profil', key: 'browArch', vals: [-1, 0, 1], view: 'profil', struct: 'supraorbital-arch', side: 1 },
  { id: 'metopicRidge', key: 'metopicRidge', vals: [-1, 0, 1], view: 'profil', struct: 'metopic-ridge', side: 0 },
  { id: 'occipitalBun', key: 'occipitalBun', vals: [-1, 0, 1], view: 'profil', struct: 'occipital-bun', side: 0 },
  { id: 'inionSize', key: 'inionSize', vals: [-1, 0, 1], view: 'trois_quarts_arriere', struct: 'nuchal-line', side: 0 },
  { id: 'temporalLine', key: 'temporalLine', vals: [-1, 0, 1], view: 'trois_quarts', struct: 'temporal-line', side: 1 },
  { id: 'temporalMuscle', key: 'temporalMuscle', vals: [-1, 0, 1], view: 'trois_quarts', struct: 'temporal-muscle', side: 1 },
  { id: 'asterion', key: 'asterion', vals: [-1, 0, 1], view: 'trois_quarts_arriere', struct: 'asterion', side: 1 },
  { id: 'asymMastoid', key: 'asymMastoid', vals: [-1, 0, 1], view: 'dos', struct: 'mastoid-process', side: 1, base: { mastoid: 0.5 } },
];
const crop = (r: TurnRender, cx: number, cy: number, w: number, h: number): { w: number; h: number; rgba: Uint8Array } => {
  const o = new Uint8Array(w * h * 4); const x0 = Math.round(cx - w / 2), y0 = Math.round(cy - h / 2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const sx = x0 + x, sy = y0 + y, d = (y * w + x) * 4; if (sx < 0 || sy < 0 || sx >= r.w || sy >= r.h) { o.set([250, 248, 244, 255], d); continue; } o.set(r.rgba.subarray((sy * r.w + sx) * 4, (sy * r.w + sx) * 4 + 4), d); }
  return { w, h, rgba: o };
};
for (const z of ZOOM) {
  if (FROM > 2) break;
  const st = VAULT_STRUCTURES.find((s) => s.id === z.struct)!;
  z.vals.forEach((v, i) => {
    const spec = vaultSpec({ ...(z.base ?? {}), [z.key]: v }, 3, true), r = vaultRender(spec, z.view, 800), p = place(spec, st, z.side, VAULT_VIEWS[z.view], r), W = Math.round(0.62 * r.ppu), Hh = Math.round(0.5 * r.ppu);
    const c = crop(r, p.px, p.py, W, Hh); png(T('zoom', `${z.id}_${['lo', 'nom', 'hi'][i]}.png`), c.w, c.h, c.rgba);
  });
  console.log('zoom', z.id);
}
if (FROM <= 2) json('zoom.json', ZOOM.map((z) => ({ id: z.id, parametre: z.key, valeurs: z.vals, vue: z.view, structure: z.struct, fenetre: '0,62 × 0,5 U centrée sur l\'ancre du registre', base: z.base ?? {} })));

// 3. Profil 2D (moteur `src/skull`, mode `bone` : os seul, car la coiffure du dessin fini masque la voûte) : le MÊME paramètre, lu par la même fonction de forme ; contours min (bleu) / nominal (noir) / max (rouge) et dessin fini du max.
const p3 = generateRandomProfile(3), PH = 600, PK: [string, object][] = [['browArch', {}], ['frontalEminence', {}], ['metopicRidge', {}], ['occipitalBun', {}], ['inionSize', {}], ['parietalHeight', { parietalBulge: 1 }]];
const ras = (svg: string, w: number): { w: number; h: number; rgba: Uint8Array } => { const r = new Resvg(svg, { fitTo: { mode: 'width', value: w }, font: { loadSystemFonts: false }, background: '#faf8f4' }).render(); return { w: r.width, h: r.height, rgba: r.pixels }; };
const polyOf = (ov: object) => skullGeometry(p3.face.params, SkullParams.parse({ ...p3.skull, ...ov }), PH).poly;
for (const [k, base] of PK) {
  const polys = [-1, 0, 1].map((v) => polyOf({ ...base, [k]: v })), all = polys.flat(), x0 = Math.min(...all.map((q) => q.x)) - 20, y0 = Math.min(...all.map((q) => q.y)) - 20, w = Math.max(...all.map((q) => q.x)) - x0 + 20, h = Math.max(...all.map((q) => q.y)) - y0 + 20;
  const line = (poly: readonly { x: number; y: number }[], c: string, sw: number): string => `<polyline fill="none" stroke="${c}" stroke-width="${sw}" points="${poly.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' ')}"/>`;
  png(T('profil2d', `${k}_contours.png`), ...((r) => [r.w, r.h, r.rgba] as const)(ras(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${w} ${h}" width="${w}" height="${h}">${line(polys[0]!, '#2060d0', 4)}${line(polys[2]!, '#d02020', 4)}${line(polys[1]!, '#111', 2)}</svg>`, 420)));
  [-1, 0, 1].forEach((v, i) => { const r = ras(renderProfile(p3.face.params, SkullParams.parse({ ...p3.skull, ...base, [k]: v }), { width: 420, hair: '#222222', background: null, mode: 'bone' }).svg, 420); png(T('profil2d', `${k}_${['lo', 'nom', 'hi'][i]}.png`), r.w, r.h, r.rgba); });
  let m = 0; for (let i = 0; i < Math.min(polys[0]!.length, polys[2]!.length); i++) m = Math.max(m, Math.hypot(polys[0]![i]!.x - polys[2]![i]!.x, polys[0]![i]!.y - polys[2]![i]!.y) / PH);
  console.log('profil 2D', k, (m).toFixed(4), 'H');
  (rep as Record<string, unknown>)[`profil2d_${k}`] = { deplacementMaxEnH: +m.toFixed(4) };
}
json('composites.json', rep);
if (Number(process.env.TO ?? 9) < 4) process.exit(0);   // reprise : `TO=3` s'arrête après le profil 2D

// 4. (on dessine sur une COPIE du rendu, jamais sur le rendu mesuré) L'ancre pariétale SUIT l'éminence (vue de dos, graine 3) : point vert = ancre du registre (`place`), pour les deux côtés.
const dot = (r: TurnRender, x: number, y: number, col: [number, number, number]): void => { for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) { const d = Math.hypot(dx, dy); if (d > 6 || x + dx < 0 || y + dy < 0 || x + dx >= r.w || y + dy >= r.h) continue; const i = ((y + dy) * r.w + x + dx) * 4; r.rgba.set(d > 4.5 ? [255, 255, 255, 255] : [...col, 255], i); } };
const PAR = VAULT_STRUCTURES.find((s) => s.id === 'parietal-bone')!;
for (const [k, base] of [['parietalHeight', { parietalBulge: 1 }], ['parietalAzimuth', { parietalBulge: 1 }], ['asymParietalHeight', { parietalBulge: 1 }]] as [string, object][]) for (const [i, v] of [-1, 0, 1].entries()) {
  const spec = vaultSpec({ ...base, [k]: v }, 3, true), view = k === 'parietalAzimuth' ? 'dessus' : 'dos', r0 = vaultRender(spec, view, H), r = { ...r0, rgba: Uint8ClampedArray.from(r0.rgba) } as TurnRender;
  for (const s of [1, -1] as const) { const p = place(spec, PAR, s, VAULT_VIEWS[view], r); dot(r, p.px, p.py, p.visible || p.grazing ? [30, 170, 60] : [210, 40, 40]); }
  png(T('ancre', `${k}_${['lo', 'nom', 'hi'][i]}.png`), r.w, r.h, r.rgba);
}

// 5. Cheveux : la coiffure est posée sur le MÊME maillage ; elle suit le chignon, les bosses et les arcades (tête coiffée, graine 3).
for (const [n, ov] of [['nominal', {}], ['chignon', { occipitalBun: 1, inionSize: 0.6 }], ['chignon-moins', { occipitalBun: -1 }], ['bosses', { frontalEminence: 1, parietalBulge: 0.7 }], ['arcade', { browArch: 1, glabella: 0.5 }]] as [string, object][]) for (const v of ['trois_quarts', 'profil', 'dos'] as const) { const r = vaultRender(vaultSpec(ov, 3, false), v, H); png(T('cheveux', `${n}_${v}.png`), r.w, r.h, r.rgba); }

// 6. Robustesse : 24 voûtes TIRÉES au hasard avec les 10 nouvelles mesures (variété 0,9, tendances 0,5) : échecs de la couche de vérification, s'il y en a.
const rnd: Record<string, unknown> = {};
for (let seed = 1; seed <= 24; seed++) { const p = generateRandomProfile(seed, { vault: { variety: 0.9, tendency: 0.5 } }); rnd[seed] = vaultReport(vaultSpec(p.skull, seed, true)).flatMap((l) => l.checks.filter((c) => !c.ok).map((c) => `${c.id}=${c.value}`)); }
json('aleatoire-passe2.json', rnd); console.log('terminé');
