import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { generateRandomFace } from '../src';
import { faceLandmarks, hairGeometry } from '../src/face';
import { outlinePath } from '../src/face/outline';
import { posedFace } from '../src/face/pose';
import { PROFILES } from '../src/face/hair/sim/profiles';
import { HAIR_ARCHETYPES } from '../src/schema';
import { verifyFace } from '../src/verify';
import { layout, render } from './lib/proof';
import { rasterPixels } from './lib/raster';

/**
 * Preuves de la passe « masses de région + silhouettes + encre + pose 3/4 » : `artefacts/hair-masses/`.
 * Même visage partout (seed 321, yeux d'identité 3, sans pilosité). `npx tsx scripts/artefacts-hair-masses.ts`.
 */
const DIR = 'artefacts/hair-masses';
mkdirSync(DIR, { recursive: true });
const CEL = { shading: { mode: 'cel', bands: 3, highlightBand: 0.6, castShadow: 0.8 } };
const NOFH = { mustache: 'none', beard: 'none' } as const;
const ARCH = HAIR_ARCHETYPES.filter((a) => a !== 'none');
const MAP = ['tousled', 'side_sweep', 'swept_back', 'bun_undercut', 'messy_bangs', 'wavy_swept', 'quiff_undercut', 'braid_updo', 'fluffy_messy', 'messy_long_bangs', 'pompadour_strand', 'cornrows_side'];
const hairOf = (a: string, extra: Record<string, unknown> = {}) => ({ style: 'short', texture: 'straight', fringe: 'none', color: '#23232b', seed: 5, volume: 0.5, density: 0.85, part: 0.2, appearance: CEL, sim: { enabled: true, archetype: a, regions: true, ink: true, ...extra } }) as never;
const mk = (a: string, extra: Record<string, unknown> = {}) => generateRandomFace(321, { identity: 3, hairEngine: 'classic', hair: hairOf(a, extra), facialHair: NOFH } as never);
const png = (name: string, b: Buffer): void => { writeFileSync(`${DIR}/${name}`, b); console.log(`${DIR}/${name}`); };

// 01 — les 15 archétypes (régions + encre).
const CW = 420; const CH = 560;
{
  const L = layout(ARCH.length, 4, CW, CH, 0.7, (i) => ({ seed: 321, opts: { identity: 3, hairEngine: 'classic', hair: hairOf(ARCH[i]!), facialHair: NOFH } as never }));
  png('01-archetypes-regions-encre.png', render(L.objects, 4 * CW, 4 * CH, '', '#f4f1ea'));
}

// 02/03 — références (haut) contre moteur (bas), puis mesure INDÉPENDANTE sur les pixels (hors métriques du moteur).
const inkStats = (px: Uint8Array, w: number, x0: number, y0: number, cw: number, ch: number): { fill: number; cx: number; top: number; aspect: number } => {
  let n = 0; let sx = 0; let minX = 1e9; let maxX = -1; let minY = 1e9; let maxY = -1;
  for (let y = y0; y < y0 + ch; y++) for (let x = x0; x < x0 + cw; x++) {
    const i = (y * w + x) * 4;
    const lum = 0.299 * (px[i] as number) + 0.587 * (px[i + 1] as number) + 0.114 * (px[i + 2] as number);
    if (lum < 70 && (px[i + 3] as number) > 200) { n++; sx += x; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  }
  if (!n) return { fill: 0, cx: 0, top: 0, aspect: 0 };
  const bw = maxX - minX + 1; const bh = maxY - minY + 1;
  return { fill: n / (bw * bh), cx: ((sx / n - minX) / bw) * 2 - 1, top: (minY - y0) / ch, aspect: bh / bw };
};
const cmpRows: Record<string, unknown>[] = [];
const compare = (name: string, from: number): void => {
  const idx = [0, 1, 2, 3, 4, 5].map((k) => from + k);
  const L = layout(6, 6, 280, 380, 0.5, (i) => ({ seed: 321, opts: { identity: 3, hairEngine: 'classic', hair: hairOf(MAP[idx[i]!]!), facialHair: NOFH } as never }));
  const mine = render(L.objects, 6 * 280, 380, '', '#ffffff');
  const refs = idx.map((k) => readFileSync(`artefacts/hair-sim/refs/h${String(k + 1).padStart(2, '0')}.png`).toString('base64'));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1680" height="760"><rect width="100%" height="100%" fill="#fff"/>${refs.map((b, i) => `<image x="${i * 280 + 10}" y="0" width="260" height="360" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${b}"/>`).join('')}<image x="0" y="380" width="1680" height="380" href="data:image/png;base64,${mine.toString('base64')}"/>${idx.map((k, i) => `<text x="${i * 280 + 140}" y="372" text-anchor="middle" font-size="14" fill="#333">${String(k + 1).padStart(2, '0')} → ${MAP[k]}</text>`).join('')}</svg>`;
  png(name, new Resvg(svg, { font: { loadSystemFonts: true } }).render().asPng());
  const { pixels, width } = rasterPixels(svg, { fonts: true });
  idx.forEach((k, i) => {
    // Bande des cheveux : tiers supérieur (références) / même bande dans le rendu du moteur.
    const ref = inkStats(pixels, width, i * 280 + 10, 0, 260, 150);
    const me = inkStats(pixels, width, i * 280 + 10, 380, 260, 150);
    cmpRows.push({ ref: `h${String(k + 1).padStart(2, '0')}`, archetype: MAP[k], referenceInk: ref, engineInk: me, dFill: +(me.fill - ref.fill).toFixed(3), dCentroidX: +(me.cx - ref.cx).toFixed(3), dAspect: +(me.aspect - ref.aspect).toFixed(3) });
  });
};
compare('02-references-01-06-vs-moteur.png', 0);
compare('03-references-07-12-vs-moteur.png', 6);

// 04 — vue des ZONES : tempes+pattes, mèches de joue, nuque, zone rasée, volume du dessus (couleurs de diagnostic).
{
  const COL: Record<string, string> = { side: '#e4572e', cheek: '#2e86ab', nape: '#76b041', top: '#f2a900', shaved: '#8e5ea2' };
  const cell = (a: string, i: number): string => {
    const f = mk(a); const lm = faceLandmarks(f.params, f.width, f.height); const g = hairGeometry(f.params, lm)!;
    const ox = (i % 5) * 300 + 150; const oy = Math.floor(i / 5) * 400 + 190;
    const d = (p: { x: number; y: number }[]): string => `M${p.map((q) => `${(q.x * 0.62 + ox).toFixed(1)} ${(q.y * 0.62 + oy).toFixed(1)}`).join('L')}Z`;
    const outline = `<g transform="translate(${ox} ${oy}) scale(0.62)"><path d="${outlinePath(lm.outline)}" fill="#f3e6d8" stroke="#555" stroke-width="2"/></g>`;
    const zones = g.locks.filter((l) => l.zone).map((l) => `<path d="${d(l.poly)}" fill="${COL[l.zone!]}" fill-opacity="0.8" stroke="#222" stroke-width="0.8"/>`);
    const shaved = (g.shaved ?? []).map((p) => `<path d="${d(p)}" fill="${COL.shaved}" fill-opacity="0.8"/>`);
    return `${outline}${shaved.join('')}${zones.join('')}<text x="${ox}" y="${oy + 215}" text-anchor="middle" font-size="14" fill="#222">${a}</text>`;
  };
  const legend = Object.entries(COL).map(([k, c], i) => `<rect x="${20 + i * 150}" y="1210" width="14" height="14" fill="${c}"/><text x="${40 + i * 150}" y="1222" font-size="14" fill="#222">${{ side: 'tempe + patte', cheek: 'mèche de joue', nape: 'nuque', top: 'volume du dessus', shaved: 'zone rasée' }[k]}</text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="1240"><rect width="100%" height="100%" fill="#fff"/>${ARCH.map(cell).join('')}${legend}</svg>`;
  png('04-zones-par-archetype.png', new Resvg(svg, { font: { loadSystemFonts: true } }).render().asPng());
}

// 05 — pose 3/4 (SCHÉMA géométrique : crâne, cou, composants posés ; ce n'est pas encore le rendu complet du visage).
{
  const f = mk('tousled'); const lm = faceLandmarks(f.params, f.width, f.height);
  const yaws = [0, 20, 35, 50, 70];
  const cells = yaws.map((yw, i) => {
    const p = posedFace(lm, yw);
    const ox = i * 330 + 165; const oy = 260; const s = 0.62;
    const X = (x: number): number => ox + x * s; const Y = (y: number): number => oy + y * s;
    const ys = Array.from({ length: 40 }, (_, k) => p.skull.topY + ((lm.chinY - p.skull.topY) * k) / 39);
    const cx = p.nodes.get('skull')!.x;
    const right = ys.map((y) => `${X(cx + p.skullHalf(y)).toFixed(1)} ${Y(y).toFixed(1)}`);
    const left = [...ys].reverse().map((y) => `${X(cx - p.skullHalf(y)).toFixed(1)} ${Y(y).toFixed(1)}`);
    const nk = p.nodes.get('neck')!; const nh = p.neckHalf();
    const neck = `<rect x="${X(nk.x - nh)}" y="${Y(lm.neck.topY)}" width="${2 * nh * s}" height="${(lm.neck.bottomY - lm.neck.topY) * s}" fill="#d9c3ad" stroke="#555"/>`;
    const dots = [...p.nodes.values()].filter((n) => !['head', 'skull', 'face', 'jaw', 'neck'].includes(n.id)).map((n) => {
      const w = Math.max(0.1, n.scaleX);
      return `<ellipse cx="${X(n.x).toFixed(1)}" cy="${Y(n.y).toFixed(1)}" rx="${(7 * w).toFixed(1)}" ry="6" fill="${n.visible ? '#2e86ab' : 'none'}" stroke="${n.visible ? '#123' : '#aaa'}" stroke-dasharray="${n.visible ? '' : '3 2'}"/><text x="${X(n.x).toFixed(1)}" y="${(Y(n.y) - 9).toFixed(1)}" font-size="9" text-anchor="middle" fill="#333">${n.id}</text>`;
    });
    return `${neck}<path d="M${right.join('L')}L${left.join('L')}Z" fill="#f3e6d8" fill-opacity="0.9" stroke="#444" stroke-width="2"/>${dots.join('')}<text x="${ox}" y="40" text-anchor="middle" font-size="16" fill="#222">yaw ${yw}°</text>`;
  });
  png('05-pose-3-4-schema.png', new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="1650" height="620"><rect width="100%" height="100%" fill="#fff"/>${cells.join('')}<text x="20" y="600" font-size="13" fill="#555">Schéma géométrique (pas le rendu final) : ellipses pleines = composant visible (largeur = raccourcissement), pointillés = masqué.</text></svg>`, { font: { loadSystemFonts: true } }).render().asPng());
}

// 06 — avant / après : mêmes archétypes sans (haut) puis avec (bas) régions + encre.
{
  const pick = ['side_sweep', 'quiff_undercut', 'hime', 'messy_long_bangs', 'bun_undercut', 'fluffy_messy'];
  const mkSet = (extra: Record<string, unknown>) => layout(6, 6, 280, 380, 0.5, (i) => ({ seed: 321, opts: { identity: 3, hairEngine: 'classic', hair: hairOf(pick[i]!, extra), facialHair: NOFH } as never }));
  const a = render(mkSet({ regions: false, ink: false }).objects, 6 * 280, 380, '', '#ffffff');
  const b = render(mkSet({}).objects, 6 * 280, 380, '', '#ffffff');
  png('06-avant-apres.png', new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="1680" height="800"><rect width="100%" height="100%" fill="#fff"/><image x="0" y="20" width="1680" height="380" href="data:image/png;base64,${a.toString('base64')}"/><image x="0" y="410" width="1680" height="380" href="data:image/png;base64,${b.toString('base64')}"/><text x="8" y="14" font-size="13" fill="#333">avant (ni régions ni encre)</text><text x="8" y="404" font-size="13" fill="#333">après (régions + silhouette + encre)</text></svg>`, { font: { loadSystemFonts: true } }).render().asPng());
}

// 07 — vérification (3 couches) + silhouettes mesurées + temps.
const rows = ARCH.map((a) => {
  const f = mk(a); const r = verifyFace(f); const p = PROFILES[a]!;
  return { archetype: a, region: p.region, silhouette: p.sil, ok: r.ok, failures: r.failures.map((c) => c.id), warnings: r.warnings.map((c) => c.id), zoneChecks: r.checks.filter((c) => c.id.startsWith('zone-') || c.id.startsWith('sil-') || c.id.startsWith('ink-')).map((c) => ({ id: c.id, ok: c.ok, value: +c.value.toFixed(4), limit: +c.limit.toFixed(4) })) };
});
const t0 = performance.now();
const L2 = layout(12, 4, CW, CH, 0.7, (i) => ({ seed: 321, opts: { identity: 3, hairEngine: 'classic', hair: hairOf(MAP[i]!), facialHair: NOFH } as never }));
render(L2.objects, 4 * CW, 3 * CH, '', '#f4f1ea');
const timing = { facesRendered: 12, totalMs: Math.round(performance.now() - t0) };
writeFileSync(`${DIR}/metrics.json`, JSON.stringify({ verification: rows, referenceComparison: cmpRows, timing }, null, 2));
console.log('ok', rows.every((r) => r.ok), timing);
