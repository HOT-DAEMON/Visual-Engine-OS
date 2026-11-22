import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { compileScene } from '../src';
import { EXTRA4_COUNT, extra4Recipes, generateExtra4Eye } from '../src/generation/eye-gallery-ext4';
import { PHOTO2_IRIS_FAMILIES, PHOTO2_IRIS_MEASURES } from '../src/generation/eye-iris-families-photo2';
import { EXTENDED3_IDENTITIES } from '../src/generation/eye-pool';
import { famEye } from './eye-refs/calibrate-atoms-lib';
import { atomMetrics } from './lib/eye-iris-atoms';
import { irisTone } from './lib/eye-iris-tone';
import { layout, render } from './lib/proof';
import { verifyEyeRender } from './lib/verify-eye-render';

/**
 * Artefacts de la PASSE 13 : `npx tsx scripts/artefacts-eyes-pass13.ts` → `artefacts/eyes-pass13/`
 *   01 références (haut) / moteur (bas) · 02 étoiles SANS / AVEC rayonnement et teinte (même taille, même place) · 03 un paramètre à la fois (rays, tint, jitter, iris.lift, slits.curve)
 *   04 têtes entières (galerie 4, une identité par famille d'iris) + gros plans · 05 rapport chiffré (moteur contre références, règles de rendu).
 */
const OUT = 'artefacts/eyes-pass13'; mkdirSync(OUT, { recursive: true });
const b64 = (b: Buffer | Uint8Array): string => `data:image/png;base64,${Buffer.from(b).toString('base64')}`;
const png = (svg: string): Buffer => Buffer.from(new Resvg(svg, { font: { loadSystemFonts: true } }).render().asPng());
type Fam = (typeof PHOTO2_IRIS_FAMILIES)[number];
const fam = (f: Fam, patch?: (e: any) => void): any => { const e: any = famEye(f); patch?.(e); return e; };
let zid = 0; const ZW = 560, ZH = 480;
const zoom = (eye: Record<string, unknown>, k = 2.5): string => { const r: any = compileScene({ width: ZW, height: ZH, background: '#f4ede6', objects: [{ kind: 'eye', id: `z${zid++}`, transform: { x: ZW / 2, y: ZH / 2 + 4, scale: k }, ...eye, eyebrow: null }] } as never); if (!r.ok) throw new Error(r.issues.join('\n')); return `<image href="${b64(png(r.svg as string))}" width="${ZW}" height="${ZH}"/>`; };
const T = (x: number, y: number, t: string, s = 13): string => `<text x="${x}" y="${y}" font-size="${s}" font-family="DejaVu Sans" fill="#222">${t.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`;
const CW = 330, CH = 280, sc = CW / ZW; const C = PHOTO2_IRIS_FAMILIES.length;
const tones = Object.fromEntries((JSON.parse(readFileSync('references/eyes/measures-iris-photos.json', 'utf8')).eyes as any[]).map((e) => [e.id, e.tone]));
const A = JSON.parse(readFileSync('references/eyes/measures-iris-atoms.json', 'utf8')).eyes as Record<string, any>;
const crop = (id: string): string => `<image href="${b64(readFileSync(`artefacts/eyes-pass12/refs/${id}-crop.png`))}" width="${CW}" height="${CH}" preserveAspectRatio="xMidYMid slice"/>`;

// 01
let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${CW * C}" height="${2 * CH + 70}"><rect width="100%" height="100%" fill="#f4ede6"/>${T(8, 18, 'Références mesurées (04 · 07 · 08a · 10a · 10b)', 15)}`;
PHOTO2_IRIS_FAMILIES.forEach((f, i) => { const id = PHOTO2_IRIS_MEASURES[f].ref; s += `<g transform="translate(${i * CW},28)">${crop(id)}</g>${T(i * CW + 8, 28 + CH + 18, `moteur : ${f} (réf. ${id})`, 12)}<g transform="translate(${i * CW},${CH + 52}) scale(${sc})">${zoom(fam(f))}</g>`; });
writeFileSync(`${OUT}/01-iris-reference-vs-moteur.png`, png(`${s}</svg>`));

// 02 : sans / avec rayonnement et teinte (mêmes tailles, mêmes positions)
const plain = (e: any): void => { for (const h of e.highlights.list) { h.rays = 0; h.tint = null; h.jitter = 0; } };
const SF: Fam[] = ['ice-star', 'fire-halo', 'emerald-facets', 'prism-star'];
s = `<svg xmlns="http://www.w3.org/2000/svg" width="${CW * SF.length}" height="${2 * CH + 110}"><rect width="100%" height="100%" fill="#f4ede6"/>`;
SF.forEach((f, i) => { const a = fam(f, plain), b = fam(f); const ma = atomMetrics(a).stars, mb = atomMetrics(b).stars; const rf = A[PHOTO2_IRIS_FAMILIES.length ? PHOTO2_IRIS_MEASURES[f].ref : ''].stars.feretTop6Mean;
  s += `<g transform="translate(${i * CW},26) scale(${sc})">${zoom(a)}</g><g transform="translate(${i * CW},${CH + 60}) scale(${sc})">${zoom(b)}</g>${T(i * CW + 8, 11, f, 12)}${T(i * CW + 8, 24, `SANS rayons ni teinte · top6 ${ma.feretTop6Mean}`, 11)}${T(i * CW + 8, CH + 50, `AVEC rays/tint/jitter · top6 ${mb.feretTop6Mean} (réf. ${rf})`, 11)}`; });
writeFileSync(`${OUT}/02-etoiles-sans-avec-rayonnement.png`, png(`${s}</svg>`));

// 03 : un paramètre varie à la fois
const star = (e: any, k: string, v: unknown): void => { for (const h of e.highlights.list) if (h.shape === 'sparkle') h[k] = v; };
const rows: { f: Fam; name: string; vals: { label: string; patch: (e: any) => void }[] }[] = [
  { f: 'ice-star', name: 'highlights.rays (aiguilles, en rayons du corps)', vals: [0, 1, 2.5].map((v) => ({ label: `rays ${v}`, patch: (e) => star(e, 'rays', v) })) },
  { f: 'fire-halo', name: 'highlights.tint (cœur → pointes)', vals: [{ l: 'aucune', c: null }, { l: '#ff3030', c: '#ff3030' }, { l: '#40d0ff', c: '#40d0ff' }].map((v) => ({ label: `tint ${v.l}`, patch: (e) => star(e, 'tint', v.c) })) },
  { f: 'emerald-facets', name: 'highlights.jitter (lobes et aiguilles irréguliers)', vals: [0, 0.5, 1].map((v) => ({ label: `jitter ${v}`, patch: (e) => star(e, 'jitter', v) })) },
  { f: 'fire-halo', name: 'iris.lift (demi-teintes ; noirs et blancs en place)', vals: [0, 0.5, 1].map((v) => ({ label: `lift ${v}`, patch: (e) => { e.iris.lift = v; } })) },
  { f: 'prism-star', name: 'slits.curve (° par unité de rayon)', vals: [0, 8, 25].map((v) => ({ label: `curve ${v}`, patch: (e) => { e.iris.detail.slits.curve = v; } })) },
  { f: 'lime-cyan', name: 'lime-cyan : arcs + braises (détail atomique)', vals: [{ l: 'sans', p: (e: any) => { delete e.iris.detail.arcs; delete e.iris.detail.embers; } }, { l: 'arcs seuls', p: (e: any) => { delete e.iris.detail.embers; } }, { l: 'arcs + braises', p: () => {} }].map((v) => ({ label: v.l, patch: v.p })) },
];
const w3 = 3 * 250, h3 = 262; s = `<svg xmlns="http://www.w3.org/2000/svg" width="${w3 * 2}" height="${h3 * 3}"><rect width="100%" height="100%" fill="#f4ede6"/>`;
rows.forEach((r, i) => { const ox = (i % 2) * w3, oy = Math.floor(i / 2) * h3; s += T(ox + 6, oy + 14, `${r.f} · ${r.name}`, 12); r.vals.forEach((v, j) => { s += `<g transform="translate(${ox + j * 250},${oy + 20}) scale(${250 / ZW})">${zoom(fam(r.f, v.patch))}</g>${T(ox + j * 250 + 6, oy + 20 + 226, v.label, 12)}`; }); });
writeFileSync(`${OUT}/03-un-parametre-a-la-fois.png`, png(`${s}</svg>`));

// 04 : têtes entières (une identité par famille d'iris, galerie 4) + gros plans
const rc4 = extra4Recipes(); const pick = (f: string, n: number): number[] => rc4.filter((r) => r.irisFamily === f).slice(0, n).map((r) => EXTENDED3_IDENTITIES + r.index);
const ids = PHOTO2_IRIS_FAMILIES.flatMap((f) => pick(f, 2)); const L = layout(ids.length, 5, 220, 400, 0.56, (i) => ({ seed: 1900 + i * 11, opts: { eyeSource: 'extended4', identity: ids[i], lashFamily: null } as never }));
writeFileSync(`${OUT}/04-tetes-entieres.png`, render(L.objects as never, 1100, 800, '', '#3b4157', 1100));
for (const f of PHOTO2_IRIS_FAMILIES) { const c = layout(1, 1, 700, 900, 1.5, () => ({ seed: 4343, opts: { eyeSource: 'extended4', identity: pick(f, 1)[0], lashFamily: null } as never })); writeFileSync(`${OUT}/04b-tete-gros-plan-${f}.png`, render(c.objects as never, 700, 900, '', '#3b4157', 700)); }

// 05 : rapport chiffré
const rep: Record<string, unknown> = {};
for (const f of PHOTO2_IRIS_FAMILIES) { const id = PHOTO2_IRIS_MEASURES[f].ref; const e = fam(f); const m = atomMetrics(e); const t = irisTone(e); const r = verifyEyeRender(e as never);
  rep[f] = { ref: id, lumMean: { moteur: t.lumMean, reference: tones[id].lumMean }, darkShare: { moteur: t.darkShare, reference: tones[id].darkShare }, satPeaks: { moteur: t.satPeaks, reference: tones[id].satPeaks },
    etoiles: { moteurTop6Moy: m.stars.feretTop6Mean, referenceTop6Moy: A[id].stars?.feretTop6Mean ?? null, moteurTop6: m.stars.top.slice(0, 6).map((x) => x.feretOverR), referenceTop6: (A[id].stars?.top ?? []).slice(0, 6).map((x: any) => x.feretOverR) },
    cellules: { moteur: m.cells.count, reference: A[id].cells?.count ?? null }, fentes: { moteur: m.slits.persistentCount, reference: A[id].slits?.persistentCount ?? null, derive: { moteur: (m.slits as any).meanDriftPerRho ?? null, reference: A[id].slits?.meanDriftPerRho ?? null } },
    regles: Object.fromEntries(r.filter((c) => /luminance|white|edge|dark|arcs|slits|texture/.test(c.id)).map((c) => [c.id, { ok: c.ok, valeur: c.value, limite: c.limit }])), echecs: r.filter((c) => !c.ok).map((c) => c.id) }; }
const fails: Record<string, number> = {}; for (let i = 0; i < EXTRA4_COUNT; i++) for (const c of verifyEyeRender(generateExtra4Eye(i) as never)) if (!c.ok) fails[c.id] = (fails[c.id] ?? 0) + 1;
writeFileSync(`${OUT}/05-rapport-passe13.json`, JSON.stringify({ familles: rep, echecsPixelsGalerie4: fails }, null, 1));
console.log('ok');
