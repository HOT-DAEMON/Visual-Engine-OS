import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { compileScene } from '../src';
import { mulberry32 } from '../src/core/prng';
import { applyIrisPreset, extra2Recipes, generateExtra2Eye } from '../src/generation/eye-gallery-ext2';
import { EXTRA4_COUNT, extra4Recipes, generateExtra4Eye } from '../src/generation/eye-gallery-ext4';
import { PHOTO2_IRIS_FAMILIES, PHOTO2_IRIS_MEASURES, photoIrisFamily2 } from '../src/generation/eye-iris-families-photo2';
import { EXTENDED3_IDENTITIES } from '../src/generation/eye-pool';
import { atomMetrics } from './lib/eye-iris-atoms';
import { irisTone } from './lib/eye-iris-tone';
import { layout, render } from './lib/proof';
import { verifyEyeRender } from './lib/verify-eye-render';

/**
 * Artefacts de la PASSE 12 : `npx tsx scripts/artefacts-eyes-pass12.ts` → `artefacts/eyes-pass12/`
 *   01 gros plans : références (haut) / moteur (bas) · 02 SANS / AVEC les couches atomiques (fentes, facettes taillées, arcs, braises, vides) sur chaque famille, mesures dessous
 *   03 preuve paramètre par paramètre : un seul paramètre varie, tout le reste identique · 04 têtes entières (source 'extended4') + gros plans · 05 rapport chiffré (moteur contre références, vérifications de rendu).
 */
const OUT = 'artefacts/eyes-pass12'; mkdirSync(OUT, { recursive: true });
const b64 = (b: Buffer | Uint8Array): string => `data:image/png;base64,${Buffer.from(b).toString('base64')}`;
const png = (svg: string): Buffer => Buffer.from(new Resvg(svg, { font: { loadSystemFonts: true } }).render().asPng());
const baseIdx = extra2Recipes().findIndex((r) => r.style === 'almond' && r.irisFamily === null); const rc4 = extra4Recipes();
type Fam = (typeof PHOTO2_IRIS_FAMILIES)[number];
const famEye = (f: Fam, patch?: (e: any) => void): any => { const i = PHOTO2_IRIS_FAMILIES.indexOf(f); const e = applyIrisPreset(generateExtra2Eye(baseIdx) as never, photoIrisFamily2(f, mulberry32(7 + i)), 'almond', false) as any; patch?.(e); return e; };
const stripAtoms = (e: any): void => { const d = e.iris.detail; if (!d) return; delete d.slits; delete d.arcs; delete d.embers; delete d.voids; if (d.facets) d.facets.cut = 0; };
let zid = 0; const ZW = 560, ZH = 480;
/** Chaque cellule est rasterisée À PART (les ids de dégradés dérivent de la graine de l'œil) puis embarquée en image. */
const zoom = (eye: Record<string, unknown>, k = 2.5): string => { const r: any = compileScene({ width: ZW, height: ZH, background: '#f4ede6', objects: [{ kind: 'eye', id: `z${zid++}`, transform: { x: ZW / 2, y: ZH / 2 + 4, scale: k }, ...eye, eyebrow: null }] } as never); if (!r.ok) throw new Error(r.issues.join('\n')); return `<image href="${b64(png(r.svg as string))}" width="${ZW}" height="${ZH}"/>`; };
const T = (x: number, y: number, t: string, s = 13): string => `<text x="${x}" y="${y}" font-size="${s}" font-family="DejaVu Sans" fill="#222">${t.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`;
const FAMS = PHOTO2_IRIS_FAMILIES.filter((f) => f !== 'lime-cyan'); const C = PHOTO2_IRIS_FAMILIES.length; const CW = 330, CH = 280; const sc = CW / ZW;
const tones = Object.fromEntries((JSON.parse(readFileSync('references/eyes/measures-iris-photos.json', 'utf8')).eyes as any[]).map((e) => [e.id, e.tone]));

// 01
let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${CW * C}" height="${330 + CH + 60}"><rect width="100%" height="100%" fill="#f4ede6"/>${T(8, 18, 'Références mesurées (04 · 07 · 08a · 10a · 10b)', 15)}<image href="${b64(readFileSync('artefacts/eyes-pass10/02-iris-references.png'))}" x="0" y="24" width="${CW * C}" height="300" preserveAspectRatio="xMidYMid meet"/>${T(8, 354, `Moteur (passe 12) : ${PHOTO2_IRIS_FAMILIES.join(' · ')}`, 15)}`;
PHOTO2_IRIS_FAMILIES.forEach((f, i) => { s += `<g transform="translate(${i * CW},362) scale(${sc})">${zoom(famEye(f))}</g>`; });
writeFileSync(`${OUT}/01-iris-reference-vs-moteur.png`, png(`${s}</svg>`));

// 02 : sans / avec
s = `<svg xmlns="http://www.w3.org/2000/svg" width="${CW * FAMS.length}" height="${2 * CH + 110}"><rect width="100%" height="100%" fill="#f4ede6"/>`;
FAMS.forEach((f, i) => {
  const a = famEye(f), b = famEye(f, stripAtoms); const da = irisTone(a).darkShare, db = irisTone(b).darkShare, rf = tones[PHOTO2_IRIS_MEASURES[f].ref].darkShare;
  s += `<g transform="translate(${i * CW},26) scale(${sc})">${zoom(b)}</g><g transform="translate(${i * CW},${CH + 60}) scale(${sc})">${zoom(a)}</g>${T(i * CW + 8, 11, f, 12)}${T(i * CW + 8, 24, `SANS atomique · part sombre ${db}`, 11)}${T(i * CW + 8, CH + 56, `AVEC · part sombre ${da} (réf. ${rf})`)}`;
});
writeFileSync(`${OUT}/02-sans-avec-couches-atomiques.png`, png(`${s}</svg>`));

// 03 : un paramètre varie à la fois
const rows: { f: Fam; name: string; vals: { label: string; patch: (e: any) => void }[] }[] = [
  { f: 'prism-star', name: 'slits.count (long 0)', vals: [8, 32, 60].map((v) => ({ label: `count ${v}`, patch: (e) => { e.iris.detail.slits.count = v; e.iris.detail.slits.long = 0; } })) },
  { f: 'prism-star', name: 'slits.widthDeg', vals: [1, 3.8, 7].map((v) => ({ label: `${v}°`, patch: (e) => { e.iris.detail.slits.widthDeg = v; } })) },
  { f: 'emerald-facets', name: 'facets.cut', vals: [0, 0.4, 1].map((v) => ({ label: `cut ${v}`, patch: (e) => { e.iris.detail.facets.cut = v; } })) },
  { f: 'ice-star', name: 'arcs.count', vals: [3, 9, 18].map((v) => ({ label: `count ${v}`, patch: (e) => { e.iris.detail.arcs.count = v; } })) },
  { f: 'fire-halo', name: 'embers.count', vals: [0, 70, 160].map((v) => ({ label: `count ${v}`, patch: (e) => { if (v === 0) delete e.iris.detail.embers; else e.iris.detail.embers.count = v; } })) },
  { f: 'ice-star', name: 'voids.strength ×', vals: [0, 0.5, 1].map((v) => ({ label: `×${v}`, patch: (e) => { for (const x of e.iris.detail.voids) x.strength *= v; } })) },
];
const w3 = 3 * 250, h3 = 262; s = `<svg xmlns="http://www.w3.org/2000/svg" width="${w3 * 2}" height="${h3 * 3}"><rect width="100%" height="100%" fill="#f4ede6"/>`;
rows.forEach((r, i) => { const ox = (i % 2) * w3, oy = Math.floor(i / 2) * h3; s += T(ox + 6, oy + 14, `${r.f} · ${r.name}`, 13); r.vals.forEach((v, j) => { s += `<g transform="translate(${ox + j * 250},${oy + 20}) scale(${250 / ZW})">${zoom(famEye(r.f, v.patch))}</g>${T(ox + j * 250 + 6, oy + 20 + 226, v.label, 12)}`; }); });
writeFileSync(`${OUT}/03-un-parametre-a-la-fois.png`, png(`${s}</svg>`));

// 04 : têtes entières
const pick = (f: string, n: number): number[] => rc4.filter((r) => r.irisFamily === f).slice(0, n).map((r) => EXTENDED3_IDENTITIES + r.index);
const ids = FAMS.flatMap((f) => pick(f, 2)); const L = layout(ids.length, 4, 250, 440, 0.62, (i) => ({ seed: 1700 + i * 11, opts: { eyeSource: 'extended4', identity: ids[i], lashFamily: null } as never }));
writeFileSync(`${OUT}/04-tetes-entieres.png`, render(L.objects as never, 1000, 880, '', '#3b4157', 1000));
for (const f of FAMS) { const c = layout(1, 1, 700, 900, 1.5, () => ({ seed: 4343, opts: { eyeSource: 'extended4', identity: pick(f, 1)[0], lashFamily: null } as never })); writeFileSync(`${OUT}/04b-tete-gros-plan-${f}.png`, render(c.objects as never, 700, 900, '', '#3b4157', 700)); }

// 05 : rapport
const A = JSON.parse(readFileSync('references/eyes/measures-iris-atoms.json', 'utf8')).eyes;
const rep: Record<string, unknown> = {}; for (const f of PHOTO2_IRIS_FAMILIES) { const id = PHOTO2_IRIS_MEASURES[f].ref; const e = famEye(f); const m = atomMetrics(e); const t = irisTone(e);
  rep[f] = { ref: id, darkShare: { moteur: t.darkShare, reference: tones[id].darkShare }, lumMean: { moteur: t.lumMean, reference: tones[id].lumMean }, satPeaks: { moteur: t.satPeaks, reference: tones[id].satPeaks }, fentes: { moteur: m.slits, reference: A[id].slits ?? null }, cellules: { moteur: m.cells, reference: A[id].cells ?? null }, etoilesTop4: { moteur: m.stars.top.slice(0, 4).map((x) => x.feretOverR), reference: A[id].stars?.top.slice(0, 4).map((x: any) => x.feretOverR) ?? null }, regles: verifyEyeRender(e).filter((c) => ['slits-radial', 'arcs-concentric', 'iris-dark-share-plausible', 'atomic-edge-density'].includes(c.id)).map((c) => `${c.id}:${c.ok ? 'ok' : 'ECHEC'} ${c.value}/${c.limit}`) }; }
const fails: Record<string, number> = {}; for (let i = 0; i < EXTRA4_COUNT; i++) for (const c of verifyEyeRender(generateExtra4Eye(i) as never)) if (!c.ok) fails[c.id] = (fails[c.id] ?? 0) + 1;
writeFileSync(`${OUT}/05-rapport-passe12.json`, JSON.stringify({ familles: rep, echecsPixelsGalerie4: fails }, null, 1));
console.log('ok');
