import { mkdirSync, writeFileSync } from 'node:fs';
import { EyeSpec, compileScene, generateRandomFace, renderScene } from '../src';
import { applyTurnAbout, eyeTurn, openingPolygon, type Vec } from '../src/geometry/eye';
import { irisCenter, irisRadii } from '../src/render/eye/helpers';
import { resolveEye } from '../src/render/eye/eye';
import { verifyEye } from '../src/verify/eye';
import { famEye } from './eye-refs/calibrate-atoms-lib';
import { makeKit } from './lib/artefacts-kit';

/**
 * Artefacts de la PASSE 18 : `npx tsx scripts/artefacts-eyes-pass18.ts` → `artefacts/eyes-pass18/` (+ rapport.json).
 *   01 : rotation de tête — l'œil rendu (graine 3, œil droit, azimut +22°) à lacet 0 / 30 / 60° avec, en surimpression, l'ouverture (bleu), l'iris TEL QUE DESSINÉ (vert)
 *        et le centre d'iris : ancien (rouge, décalage du regard non comprimé) contre corrigé (vert) ;
 *   02 : chiffres avant / après sur 10 graines × 2 yeux (fraction d'iris dans l'ouverture, centre dans l'ouverture) ;
 *   03 : tête entière (graine 23, lacet 25°), yeux émeraude avec plis des canthi, gros plan rendu à pixelRatio 1 puis 6 (le LOD des plis dépend des pixels réels : fine 0 à 40 px, 0,34 à 120 px, 1 à 245 px) ;
 *   rapport.json : poids du SVG de la tête par groupe (cause des 16 Mo, voir docs/EYES-PASS-18.md).
 */
const OUT = 'artefacts/eyes-pass18'; mkdirSync(OUT, { recursive: true });
const { BG, png, cropPng, T, eyeScene, sheet } = makeKit(OUT);
const report: Record<string, unknown> = {};
const SEEDS = [11, 23, 5, 42, 77, 3, 9, 14, 31, 58];
const eyesOf = (seed: number): Record<string, unknown>[] => (generateRandomFace(seed, { id: 'f0', transform: { x: 400, y: 420, scale: 1 } } as never).objects as { kind: string; place?: unknown; transform?: unknown; id?: unknown }[]).filter((o) => o.kind === 'eye').map(({ place: _p, transform: _t, id: _i, ...e }) => e);
const turned = (e: Record<string, unknown>, az: number, yaw: number): Record<string, unknown> => ({ ...e, headTurn: { model: 'sphere', yawDeg: yaw, pitchDeg: 0, azimuthDeg: az, parallax: false } });
const inside = (p: Vec, poly: readonly Vec[]): boolean => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i] as Vec, b = poly[j] as Vec; if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c; } return c; };
const share = (c: Vec, rx: number, ry: number, poly: readonly Vec[], map: (p: Vec) => Vec): number => { const ring = Array.from({ length: 24 }, (_, i) => map({ x: c.x + Math.cos((i / 24) * 2 * Math.PI) * rx, y: c.y + Math.sin((i / 24) * 2 * Math.PI) * ry })); return [c, ...ring].filter((p) => inside(p, poly)).length / 25; };

// ── 01 : surimpression ────────────────────────────────────────────────────────────────────────────
const SC = 1.6, W = 520, H = 400, cells: { img: Buffer; label: string }[] = [];
const base = eyesOf(3)[1] as Record<string, unknown>;
for (const yaw of [0, 30, 60]) {
  const spec = turned(base, 22, yaw); const svg = eyeScene(spec, SC, W, H);
  const eye = resolveEye(EyeSpec.parse({ kind: 'eye', id: 'z', ...spec })); const { g, turned: tr } = eyeTurn(eye); const poly = openingPolygon(g);
  const cNew = irisCenter(eye, g, tr?.jac ?? null), cOld = irisCenter(eye, g), { rx, ry } = irisRadii(eye);
  const ring = Array.from({ length: 48 }, (_, i) => { const p = { x: cNew.x + Math.cos((i / 48) * 2 * Math.PI) * rx, y: cNew.y + Math.sin((i / 48) * 2 * Math.PI) * ry }; return tr ? applyTurnAbout(p, cNew, tr.jac) : p; });
  const pl = (pts: readonly Vec[]): string => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join('') + 'Z';
  const ov = `<g transform="translate(${W / 2} ${H / 2 + 4}) scale(${SC})" fill="none" stroke-width="${(1.2 / SC).toFixed(3)}"><path d="${pl(poly)}" stroke="#1f6feb"/><path d="${pl(ring)}" stroke="#16a34a"/>`
    + `<circle cx="${cOld.x.toFixed(2)}" cy="${cOld.y.toFixed(2)}" r="${(4 / SC).toFixed(2)}" fill="#dc2626" stroke="none"/><circle cx="${cNew.x.toFixed(2)}" cy="${cNew.y.toFixed(2)}" r="${(4 / SC).toFixed(2)}" fill="#16a34a" stroke="none"/></g>`;
  const r = verifyEye({ kind: 'eye', id: 'z', ...spec }); const m = (id: string): string => { const c = r.checks.find((k) => k.id === id); return c ? `${c.ok ? 'ok' : 'ÉCHEC'} ${c.value.toFixed(2)}` : '—'; };
  cells.push({ img: png(svg.replace('</svg>', `${ov}${T(10, 20, `lacet ${yaw}° · azimut +22° — rouge : ancien centre · vert : centre corrigé`, 12)}${T(10, H - 24, `iris-meets-opening ${m('iris-meets-opening')} · centre dans l’ouverture : ${inside(cOld, poly) ? 'oui' : 'NON'} (ancien) / ${inside(cNew, poly) ? 'oui' : 'non'} (corrigé)`, 11)}${T(10, H - 8, `highlights-confined ${m('highlights-confined')} · iris-center-in-opening ${m('iris-center-in-opening')}`, 11)}</svg>`)), label: `lacet ${yaw}°` });
}
sheet('01-rotation-iris-mesure.png', cells, W, H, 3);

// ── 02 : chiffres avant / après (même formule de fraction d'iris que verify/eye.ts, avec et sans la matrice locale) ─────
const rows: Record<string, unknown>[] = [];
for (const yaw of [0, 30, 45, 60]) {
  let n = 0, oldBelow = 0, newBelow = 0, oldCentreOut = 0, newCentreOut = 0, minOld = 1, minNew = 1;
  for (const seed of SEEDS) for (const [i, e] of eyesOf(seed).entries()) {
    const eye = resolveEye(EyeSpec.parse({ kind: 'eye', id: 'z', ...turned(e, i === 0 ? -22 : 22, yaw) })); const { g, turned: tr } = eyeTurn(eye); const poly = openingPolygon(g); const { rx, ry } = irisRadii(eye);
    const cOld = irisCenter(eye, g), cNew = irisCenter(eye, g, tr?.jac ?? null);
    const vOld = share(cOld, rx, ry, poly, (p) => p), vNew = share(cNew, rx, ry, poly, (p) => (tr ? applyTurnAbout(p, cNew, tr.jac) : p));
    n++; minOld = Math.min(minOld, vOld); minNew = Math.min(minNew, vNew); if (vOld < 0.2) oldBelow++; if (vNew < 0.2) newBelow++; if (!inside(cOld, poly)) oldCentreOut++; if (!inside(cNew, poly)) newCentreOut++;
  }
  rows.push({ yaw, yeux: n, 'iris-meets-opening < 0,2 : avant': oldBelow, 'après': newBelow, 'min fraction avant': +minOld.toFixed(2), 'min après': +minNew.toFixed(2), 'centre hors ouverture : avant': oldCentreOut, 'après ': newCentreOut });
}
report.rotation = rows;
const tbl = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="${70 + rows.length * 34}"><rect width="100%" height="100%" fill="${BG}"/>${T(20, 28, 'Rotation sphérique, 10 graines × 2 yeux (azimut ±22°) : l’iris mesuré tel que dessiné (après) contre non comprimé (avant)', 15)}`
  + rows.map((r, i) => T(20, 66 + i * 34, `lacet ${r.yaw}° — iris &lt; 0,2 : ${r['iris-meets-opening < 0,2 : avant']} → ${r['après']} · fraction min ${r['min fraction avant']} → ${r['min après']} · centre hors ouverture : ${r['centre hors ouverture : avant']} → ${r['après ']}  (sur ${r.yeux} yeux)`, 14)).join('') + '</svg>';
writeFileSync(`${OUT}/02-avant-apres.png`, png(tbl));

// ── 03 : tête entière + gros plan à pixelRatio 1 et 3 ────────────────────────────────────────────
const E = famEye('emerald-facets') as any;
const FEATURES = { cornea: { refraction: 1.2, haze: 0.5 }, microdetail: { edge: { irregularity: 0.55, grain: 0.5 }, canthusLines: { outer: 0.7, count: 4, spread: 0.6, inner: 0.6 }, vessels: { density: 0.5, thickness: 0.4, tint: '#c4574e', visibility: 0.35, branching: 0.6 }, imperfections: 4 } };
function head(seed: number, yaw: number, bald = false): { scene: any; svg: string } {
  const g = generateRandomFace(seed, { id: 'f0', transform: { x: 400, y: 400, scale: 1 } } as never);
  (g.objects[0] as any).face = { ...(g.objects[0] as any).face, headPose: { yawDeg: yaw }, ...(bald ? { hair: { ...(g.objects[0] as any).face.hair, style: 'bald' } } : {}) };
  for (const o of g.objects as any[]) if (o.kind === 'eye') Object.assign(o, { iris: E.iris, pupil: E.pupil, highlights: E.highlights }, FEATURES, { archetype: null });
  const r: any = compileScene({ width: 800, height: 800, background: BG, objects: g.objects } as never); if (!r.ok) throw new Error(r.issues.join('\n')); return { scene: r.scene, svg: r.svg };
}
const hd = head(23, 25); const hd3 = renderScene(hd.scene, { pixelRatio: 6 });
const c1 = cropPng(hd.svg, 5, 262, 340, 300, 116), c3 = cropPng(hd3, 5, 262, 340, 300, 116);
sheet('03-tete-graine-23.png', [{ img: png(hd.svg, 560), label: 'graine 23, lacet 25° — tête entière (yeux ≈ 35 px)' }, { img: c1, label: 'gros plan ×5, pixelRatio 1 (œil ≈ 40 px) : plis retirés (fine 0)' }, { img: c3, label: 'gros plan ×5, pixelRatio 6 (œil ≈ 245 px) : plis à 100 % (fine 1)' }], 520, 520, 3);
const bd = head(23, 25, true), bd6 = renderScene(bd.scene, { pixelRatio: 6 });
report.bald = { 'Mo SVG (chauve, pixelRatio 1)': +(bd.svg.length / 1e6).toFixed(2), 'Mo SVG (chauve, pixelRatio 6)': +(bd6.length / 1e6).toFixed(2) };
sheet('04-oeil-gauche-tete.png', [{ img: cropPng(bd.svg, 8, 332, 396, 54, 36), label: 'œil gauche (tête chauve), pixelRatio 1 (fine 0)' }, { img: cropPng(bd6, 8, 332, 396, 54, 36), label: 'même œil, pixelRatio 6 (fine 1) : plis et vaisseaux complets' }], 432, 288, 2);
const by = (s: string): number => s.length;
report.head = { 'graine 23 lacet 25° — Mo SVG': +(by(hd.svg) / 1e6).toFixed(2), 'pixelRatio 6 — Mo SVG': +(by(hd3) / 1e6).toFixed(2), 'tracés': (hd.svg.match(/<path[ >]/g) ?? []).length, 'segments par tracé (médiane approx.)': 'voir docs/EYES-PASS-18.md § 3' };
// ── poids du SVG d'une tête posée : segments par tracé selon la peinture (cause des 16 Mo : `densify`, voir docs/EYES-PASS-18.md § 3) ──
const plainHead = (yaw: number): string => { const g = generateRandomFace(23, { id: 'f0', transform: { x: 400, y: 400, scale: 1 } } as never); (g.objects[0] as any).face = { ...(g.objects[0] as any).face, headPose: { yawDeg: yaw } }; const r: any = compileScene({ width: 800, height: 800, background: BG, objects: g.objects } as never); return r.svg as string; };
const pathStats = (svg: string): Record<string, unknown> => {
  const by: Record<string, { n: number; b: number; seg: number }> = {};
  for (const m of svg.matchAll(/<path([^>]*?) d="([^"]*)"([^>]*)\/?>/g)) { const rest = m[1]! + m[3]!; const f = (rest.match(/fill="([^"]*)"/) ?? [])[1] ?? '-', st = (rest.match(/stroke="([^"]*)"/) ?? [])[1] ?? '-'; const k = `${f.startsWith('url') ? 'url' : f}/${st}`; const o = (by[k] ??= { n: 0, b: 0, seg: 0 }); o.n++; o.b += m[2]!.length; o.seg += (m[2]!.match(/[LQC]/g) ?? []).length; }
  const gloss = (svg.match(/<clipPath id="f0-hair-gloss-clip"><path d="([^"]*)"/) ?? [])[1] ?? '';
  return { 'Mo SVG': +(svg.length / 1e6).toFixed(2), 'clip du reflet des cheveux (Mo)': +(gloss.length / 1e6).toFixed(2), 'segments du clip': (gloss.match(/[LQC]/g) ?? []).length, 'tracés les plus lourds': Object.entries(by).sort((a, b) => b[1].b - a[1].b).slice(0, 4).map(([k, v]) => ({ peinture: k, tracés: v.n, Mo: +(v.b / 1e6).toFixed(2), 'segments par tracé': Math.round(v.seg / v.n) })) };
};
report.weight = { 'graine 23, lacet 0°': pathStats(plainHead(0)), 'graine 23, lacet 25°': pathStats(plainHead(25)) };
writeFileSync(`${OUT}/rapport.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.rotation), JSON.stringify(report.head));
