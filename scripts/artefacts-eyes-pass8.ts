import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { openingGeometry, openingProfile } from '../src/geometry/eye';
import { EXTRA_EYE_COUNT, distinctness, extraEyeRecipes, generateExtraEye } from '../src/generation/eye-gallery-ext';
import { Canthi } from '../src/schema/eye-canthi-fold';
import { Shape } from '../src/schema/eye-shape';
import { eyeCellSvg, eyeSheetPng } from './lib/eye-sheet';
import { layout, render } from './lib/proof';
import { eyeToneShare, verifyEyeRender } from './lib/verify-eye-render';

/**
 * Artefacts de la PASSE 8 : `npx tsx scripts/artefacts-eyes-pass8.ts` → `artefacts/eyes-pass8/`
 *   01 encre AVANT (rendus du commit 915f14d, dossier avant/) contre APRÈS (fini flat) · 02 contrat de hauteur sharp / drooping (contours avant / après / hauteur demandée)
 *   03 galerie des 100 après refit · 04 têtes entières (dont 4 yeux d'encre) + gros plan · 05 rapport chiffré recalculé ici.
 * Les « avant » viennent d'un rendu RÉEL de l'ancien commit (git worktree), jamais d'une reconstitution : voir avant/.
 */
const OUT = 'artefacts/eyes-pass8';
mkdirSync(OUT, { recursive: true });
const b64 = (b: Buffer | Uint8Array): string => `data:image/png;base64,${Buffer.from(b).toString('base64')}`;
const rc = extraEyeRecipes();
const REFS = ['17-P07', '17-P14', '13-R2C1', '13-R4C3'];

// 01 : encre avant / après
const cellW = 480, cellH = 320;
let s01 = `<svg xmlns="http://www.w3.org/2000/svg" width="${REFS.length * cellW}" height="${2 * cellH + 60}"><rect width="100%" height="100%" fill="#fefef6"/>`;
const tone: Record<string, { avant?: number; apres: number }> = {};
REFS.forEach((ref, i) => {
  const idx = rc.find((r) => r.ref === ref)!.index; const eye = generateExtraEye(idx) as Record<string, unknown>;
  const after = new Resvg(eyeCellSvg(eye as never, cellW, cellH, '#fefef6', 'n')).render().asPng();
  const beforePath = `${OUT}/avant/encre-${ref}.png`;
  if (existsSync(beforePath)) s01 += `<image href="${b64(readFileSync(beforePath))}" x="${i * cellW}" y="30" width="${cellW}" height="${cellH}"/>`;
  s01 += `<image href="${b64(after)}" x="${i * cellW}" y="${cellH + 60}" width="${cellW}" height="${cellH}"/><text x="${i * cellW + 8}" y="22" font-size="14" font-family="DejaVu Sans" fill="#222">${ref} · avant (commit 915f14d)</text><text x="${i * cellW + 8}" y="${cellH + 52}" font-size="14" font-family="DejaVu Sans" fill="#222">${ref} · après (finish: flat) toneShare ${eyeToneShare(eye).toFixed(3)}</text>`;
  tone[ref] = { apres: +eyeToneShare(eye).toFixed(4), avant: +eyeToneShare({ ...eye, finish: 'shaded' }).toFixed(4) };
});
writeFileSync(`${OUT}/01-encre-avant-apres.png`, new Resvg(`${s01}</svg>`, { font: { loadSystemFonts: true } }).render().asPng());

// 02 : contrat de hauteur — contours (cubiques) avant (rouge) / après (vert) / hauteur demandée (trait blanc pointillé)
type G = { pi: { x: number; y: number }; po: { x: number; y: number }; u1: { x: number; y: number }; u2: { x: number; y: number }; l1: { x: number; y: number }; l2: { x: number; y: number } };
const old = JSON.parse(readFileSync(`${OUT}/avant/geometrie-avant-passe8.json`, 'utf8')) as Record<string, { g: G; aspect: number; wanted: number }>;
const P = (p: { x: number; y: number }, ox: number, oy: number): string => `${(p.x + ox).toFixed(1)},${(p.y + oy).toFixed(1)}`;
const outline = (g: G, ox: number, oy: number, col: string): string => `<path d="M${P(g.pi, ox, oy)} C${P(g.u1, ox, oy)} ${P(g.u2, ox, oy)} ${P(g.po, ox, oy)} C${P(g.l1, ox, oy)} ${P(g.l2, ox, oy)} ${P(g.pi, ox, oy)}Z" fill="none" stroke="${col}" stroke-width="2.5"/>`;
let s02 = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="520"><rect width="100%" height="100%" fill="#2b2f3f"/>';
const cases: [string, number][] = [['sharp', 0.62], ['drooping', 0.62], ['sharp', 0.4], ['drooping', 0.4]];
const heights: Record<string, { avantPct: number; apresPct: number }> = {};
cases.forEach(([style, uf], i) => {
  const ox = 300 + (i % 2) * 600, oy = 150 + Math.floor(i / 2) * 250, lx = 20 + (i % 2) * 600; const o = old[`${style}-${uf === 0.62 ? 0.62 : 0.4}`]; if (!o) return;
  const g = openingGeometry(Shape.parse({ style, width: 240, height: 240 * 0.55, upperFraction: uf, tiltDeg: 6 }), Canthi.parse({}));
  const aspect = openingProfile(g).aspect;
  s02 += outline(o.g, ox, oy, '#ff7a7a') + outline({ pi: g.pi, po: g.po, u1: g.u1, u2: g.u2, l1: g.l1, l2: g.l2 }, ox, oy, '#6be58a');
  const rel = (v: number, w: number): string => (((v - w) / w) * 100).toFixed(1);
  s02 += `<text x="${lx}" y="${oy - 112}" font-size="14" font-family="DejaVu Sans" fill="#fff">${style} · fraction haute ${uf} · hauteur demandée ${(g.hEff / g.w).toFixed(3)}</text><text x="${lx}" y="${oy - 92}" font-size="13" font-family="DejaVu Sans" fill="#ff7a7a">avant ${o.aspect.toFixed(3)} (${rel(o.aspect, o.wanted)} %)</text><text x="${lx + 200}" y="${oy - 92}" font-size="13" font-family="DejaVu Sans" fill="#6be58a">après ${aspect.toFixed(3)} (${rel(aspect, g.hEff / g.w)} %)</text>`;
  heights[`${style}-${uf}`] = { avantPct: +(((o.aspect - o.wanted) / o.wanted) * 100).toFixed(1), apresPct: +(((aspect - g.hEff / g.w) / (g.hEff / g.w)) * 100).toFixed(1) };
});
s02 += '<text x="20" y="510" font-size="12" font-family="DejaVu Sans" fill="#ff7a7a">rouge : avant (commit 915f14d)</text><text x="260" y="510" font-size="12" font-family="DejaVu Sans" fill="#6be58a">vert : après (contrat de hauteur)</text></svg>';
writeFileSync(`${OUT}/02-hauteur-sharp-drooping-avant-apres.png`, new Resvg(s02, { font: { loadSystemFonts: true } }).render().asPng());

// 03 : galerie des 100 après refit
writeFileSync(`${OUT}/03-galerie-100.png`, eyeSheetPng(Array.from({ length: EXTRA_EYE_COUNT }, (_, i) => ({ label: `${i} ${rc[i]!.style}${rc[i]!.ref ? ` · ${rc[i]!.ref}` : ''}`, eye: generateExtraEye(i) as Record<string, unknown> })), 10, 230, 175));

// 04 : têtes entières (4 yeux d'encre + 8 autres, identités étendues) + gros plan
const inkIdx = rc.filter((r) => r.ref && !r.ref.startsWith('15-')).map((r) => r.index).slice(0, 4);
const ids = [...inkIdx, 22, 31, 47, 58, 64, 71, 80, 88].map((k) => 48 + k);
const L = layout(ids.length, 4, 300, 520, 0.62, (i) => ({ seed: 1200 + i * 11, opts: { eyeSource: 'extended', identity: ids[i], lashFamily: 'auto' } as never }));
writeFileSync(`${OUT}/04-tetes-entieres.png`, render(L.objects as never, 1200, 1560, '', '#3b4157', 1200));
const close = layout(1, 1, 700, 900, 1.5, () => ({ seed: 4242, opts: { eyeSource: 'extended', identity: 48 + 22, lashFamily: 'fin-feminin' } as never }));
writeFileSync(`${OUT}/04b-tete-gros-plan.png`, render(close.objects as never, 700, 900, '', '#3b4157', 700));

// 05 : rapport chiffré
const tally: Record<string, { checked: number; failed: number }> = {};
for (let i = 0; i < EXTRA_EYE_COUNT; i++) for (const c of verifyEyeRender(generateExtraEye(i) as never)) { const t = (tally[`${c.layer}/${c.id}`] ??= { checked: 0, failed: 0 }); t.checked++; if (!c.ok) t.failed++; }
const sweep = (style: 'sharp' | 'drooping'): { moyenne: number; min: number; max: number; n: number } => {
  const d: number[] = [];
  for (const asp of [0.35, 0.45, 0.55, 0.65]) for (const upF of [0.4, 0.5, 0.62, 0.75]) for (const tilt of [-4, 2, 8, 14]) { const g = openingGeometry(Shape.parse({ style, width: 240, height: 240 * asp, upperFraction: upF, tiltDeg: tilt }), Canthi.parse({})); d.push(((openingProfile(g).aspect - g.hEff / g.w) / (g.hEff / g.w)) * 100); }
  return { moyenne: +(d.reduce((a, b) => a + b, 0) / d.length).toFixed(2), min: +Math.min(...d).toFixed(2), max: +Math.max(...d).toFixed(2), n: d.length };
};
const dist = distinctness();
writeFileSync(`${OUT}/05-rapport-passe8.json`, JSON.stringify({
  encre: { toneShare: tone, referencesMesurees: JSON.parse(readFileSync('references/eyes/measures-ink.json', 'utf8')).refs, note: 'toneShare : 0 = aplats francs ; avant = même œil au fini shaded ; refs 12 et 17 = 0, ref 13 = 0,12 (iris en dégradé vectoriel)' },
  hauteurDemandeeObtenue: { sharp: sweep('sharp'), drooping: sweep('drooping'), avantPassE8_pct: { sharp: -25.4, drooping: -26.0 }, cas: heights },
  galerie100: { distanceMinAuxExistants: dist.minToExisting, distanceMinEntreLes100: dist.minAmongNew, quotasParStyle: dist.byStyle },
  verifierPixelsGalerie100: tally,
}, null, 1));
console.log('artefacts passe 8 OK');
