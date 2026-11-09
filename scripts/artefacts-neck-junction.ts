import { mkdirSync, writeFileSync } from 'node:fs';
import { board } from './lib/board';
import { rasterPng } from './lib/raster';
import { compileScene, generateRandomFace, renderScene, SceneSpec } from '../src';
import { anchorFromLandmarks, bodyMarkup, composeFigure } from '../src/body';
import { neckModelFor } from '../src/neck';
import { dominantColor } from '../src/materials';
import { decodePng } from '../src/regression/png';
import { hostFace } from '../src/render/face';
import { neckPath } from '../src/render/neck';
import type { HostSpec } from '../src/schema';
import { checkNeckJunctionRender } from '../src/verify/neck-junction';

/**
 * Artefacts du RACCORD COU ↔ CORPS : `npx tsx scripts/artefacts-neck-junction.ts` → `artefacts/neck-junction/`.
 *  01 : AVANT (ancienne formule d'ancre `half × (1 + flare)` + fondu non borné) / APRÈS (ancre unique + fondu borné), recadrage sur la base du cou ;
 *  03 : têtes complètes (tête + cou + épaules) pour 5 cous, même visage ;
 *  04 : mesures (JSON) : écart d'ancre et contrôles du rendu final (géométrie · anatomie · style).
 * (`02-scm-torse-avant-apres.png` est une capture de la session : le code des SCM du torse est retiré, elle n'est pas reproductible par ce script.)
 */
const OUT = 'artefacts/neck-junction';
mkdirSync(OUT, { recursive: true });
const BG: [number, number, number] = [0xf4, 0xf1, 0xec];
const NECKS: Record<string, Record<string, unknown>> = {
  'défaut': {},
  'évasé (flare 0,6)': { flare: 0.6 },
  'cône (taper 0,9)': { length: 0.6, system: { profile: { taper: 0.9 } } },
  'massif + trapèzes': { width: 0.5, system: { modifiers: { mass: 0.85 }, musculature: { trapezius: 1 } } },
  compression: { system: { pose: { compression: 0.8 } } },
};
const BODY = { age: 28, sex: 1, muscularity: 0.6 };
const scene = (seed: number, neck: Record<string, unknown>, body: boolean) => {
  const f = generateRandomFace(seed, { id: 'f0', transform: { x: 320, y: 330, scale: 1 }, neck: { visible: true, ...neck } } as never);
  return { width: 640, height: 900, background: '#f4f1ec', objects: [...f.objects, ...(body ? [{ kind: 'body', id: 'b0', host: 'f0', body: BODY }] : [])] };
};
const hostOf = (sc: ReturnType<typeof scene>): HostSpec => SceneSpec.parse(sc).objects.find((o) => o.kind === 'host') as HostSpec;
/** Recadrage SANS toucher au SVG de la scène : resvg plante si un élément à filtre se retrouve entièrement hors cadre (région de filtre vide). On rastérise la scène entière à 2× puis on recadre via une enveloppe qui ne contient qu'une image. */
const crop = (svg: string, x: number, y: number, w: number, h: number, px: number): Buffer => {
  const full = rasterPng(svg, { fitWidth: 1280 }).toString('base64');
  return rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${w}" height="${h}"><image x="0" y="0" width="640" height="900" href="data:image/png;base64,${full}"/></svg>`, { fitWidth: px });
};

// ── 01 : avant / après ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const cells: { png: Buffer; label: string }[] = [], anchors: Record<string, unknown>[] = [];
for (const seed of [3, 42]) for (const name of ['défaut', 'cône (taper 0,9)', 'massif + trapèzes']) {
  const sc = scene(seed, NECKS[name]!, false), host = hostOf(sc), { params, lm } = hostFace(host), sceneSvg = renderScene(SceneSpec.parse(sc));
  const skin = dominantColor(host.material.base), base = { skin, level: 3 as const, mode: 'skin' as const, uid: 'b0' };
  const now = anchorFromLandmarks(params, lm), legacy = { ...now, baseHalf: lm.neck.half * (1 + params.neck.flare) };
  const before = composeFigure(sceneSvg, bodyMarkup(BODY, legacy, base)), after = composeFigure(sceneSvg, bodyMarkup(BODY, now, { ...base, neckContour: neckPath(params, lm) }));
  const cx = 320, cy = 330 + lm.neck.bottomY, w = 340, h = 230, x = cx - w / 2, y = cy - 135;
  cells.push({ png: crop(before, x, y, w, h, 420), label: `AVANT · graine ${seed} · ${name}` }, { png: crop(after, x, y, w, h, 420), label: `APRÈS · graine ${seed} · ${name}` });
  anchors.push({ seed, cou: name, baseHalfAncienne: +legacy.baseHalf.toFixed(2), baseHalfMoteur: +now.baseHalf.toFixed(2), ecartPct: +((100 * (legacy.baseHalf - now.baseHalf)) / now.baseHalf).toFixed(1) });
}
writeFileSync(`${OUT}/01-raccord-avant-apres.png`, board('Raccord cou ↔ torse : AVANT (ancre recopiée, fondu libre) / APRÈS', cells, 2, 420, Math.round((420 * 230) / 340)));

// ── 03 : têtes complètes ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const heads: { png: Buffer; label: string }[] = [];
for (const [name, neck] of Object.entries(NECKS)) {
  const r = compileScene(scene(3, neck, true) as never);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  heads.push({ png: crop(r.svg, 20, 40, 600, 840, 300), label: `graine 3 · ${name}` });
}
writeFileSync(`${OUT}/03-tetes-completes.png`, board('Têtes complètes (tête + cou + corps, même peau, même lumière) : 5 cous, même visage', heads, 5, 300, 420));

// ── 04 : mesures ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const checks: Record<string, unknown>[] = [];
for (const seed of [3, 11, 42, 77]) for (const [name, neck] of Object.entries(NECKS)) {
  const sc = scene(seed, neck, true), host = hostOf(sc), r = compileScene(sc as never);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  const last = neckModelFor(...(Object.values(hostFace(host)) as [never, never])).stations.at(-1)!;
  const cs = checkNeckJunctionRender(host, decodePng(rasterPng(r.svg, { fitWidth: 640 })), { background: BG });
  checks.push({ seed, cou: name, derniereSectionDemiLargeur: +((last.aL + last.aR) / 2).toFixed(2), controles: cs.map((c) => ({ id: c.id, couche: c.layer, severite: c.severity, ok: c.ok, valeur: +c.value.toFixed(2), limite: c.limit })) });
}
writeFileSync(`${OUT}/04-mesures.json`, JSON.stringify({ ecartsAncre: anchors, rendu: checks }, null, 2));
console.log(`artefacts écrits dans ${OUT}/ : 01, 03, 04`);
